// Beregner fordelingen på serveren, når tovholderen har startet den (RPC start_distribution satte status = laast).
// Læser alle ønsker med service role (det eneste sted, de samles), kører motoren, gemmer resultatet, forklaringerne
// pr. arving og lod-afgørelserne, og frigiver fordelingen til alle i boet.
import { preflight, json, fail, currentUser, serviceClient, sha256 } from '../_shared/common.ts';
import { solvePoints, solveBids, validatePoints, validateBids } from '../_shared/engine.js';

const ENGINE_VERSION = '1';

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return fail('Brug POST', 405);
  const user = await currentUser(req); if (!user) return fail('Ikke logget ind', 401);
  const { estate_id } = await req.json().catch(() => ({}));
  if (typeof estate_id !== 'string') return fail('estate_id mangler');
  const s = serviceClient();
  const { data: member } = await s.from('estate_members').select('role').eq('estate_id', estate_id).eq('user_id', user.id).maybeSingle();
  if (member?.role !== 'tovholder') return fail('Kun tovholderen kan dele tingene', 403);
  const { data: estate } = await s.from('estates').select('id, name, status, method, lod, mode').eq('id', estate_id).single();
  if (!estate) return fail('Boet findes ikke', 404);
  if (estate.status !== 'laast') return fail('Start fordelingen først (boet skal være låst)');

  try {
    const [{ data: heirsRows }, { data: itemRows }, { data: wishRows }] = await Promise.all([
      s.from('heirs').select('id, name, share, submitted_at, no_wish, proxy_by, sort').eq('estate_id', estate_id).order('sort').order('created_at'),
      s.from('items').select('id, no, name, room, will_heir_id').eq('estate_id', estate_id).is('deleted_at', null).order('no'),
      s.from('wishes').select('heir_id, item_id, points, bid').eq('estate_id', estate_id),
    ]);
    const heirs = (heirsRows ?? []).map(h => ({ id: h.id, name: h.name, w: Number(h.share) }));
    const items = (itemRows ?? []).map(i => ({ id: i.id, name: i.name, no: i.no, will: i.will_heir_id ?? '' }));
    if (!heirs.length || !items.length) throw new Error('Intet at fordele');
    if ((heirsRows ?? []).some(h => !h.submitted_at)) throw new Error('Alle har ikke afgivet ønsker');
    const pts: Record<string, Record<string, number>> = {}, bids: Record<string, Record<string, number>> = {};
    heirs.forEach(h => { pts[h.id] = {}; bids[h.id] = {}; });
    for (const w of wishRows ?? []) { if (!pts[w.heir_id]) continue; if (w.points) pts[w.heir_id][w.item_id] = w.points; if (w.bid) bids[w.heir_id][w.item_id] = Number(w.bid); }
    const bad = estate.method === 'point' ? validatePoints(heirs, items, pts) : validateBids(heirs, items, bids);
    if (bad.length) {
      // En ting er ændret, efter nogen låste. De må svare igen.
      const ids = [...new Set(bad.map((b: { heirId: string }) => b.heirId))];
      await s.from('heirs').update({ submitted_at: null }).in('id', ids);
      await s.rpc('abort_distribution', { p_estate: estate_id });
      return fail('Ønskerne passer ikke længere for ' + heirs.filter(h => ids.includes(h.id)).map(h => h.name).join(', ') + '. De skal fordele deres point igen.', 409);
    }
    const lod = Number(estate.lod);
    const input = { engine: ENGINE_VERSION, method: estate.method, lod, heirs, items, pts, bids };
    // deno-lint-ignore no-explicit-any
    const r: any = estate.method === 'point' ? solvePoints({ heirs, items, pts, lod }) : solveBids({ heirs, items, bids, lod });
    const { data: last } = await s.from('distribution_runs').select('version').eq('estate_id', estate_id).order('version', { ascending: false }).limit(1).maybeSingle();
    const version = (last?.version ?? 0) + 1;
    const nameOf: Record<string, string> = {}; heirs.forEach(h => nameOf[h.id] = h.name);
    const itemName: Record<string, string> = {}; items.forEach(i => itemName[i.id] = i.name);
    const owner: Record<string, string> = {};
    for (const h of heirs) for (const x of r.out[h.id]) owner[x.itemId] = h.id;
    const result = {
      version, engine: ENGINE_VERSION, method: r.method, lod, out: r.out, rest: r.rest, ef1_ok: r.ef.length === 0, ef: r.ef,
      lod_notes: r.lod, lod_ids: r.lodIds, zero: r.zero, score: r.score ?? null, of: r.of ?? null,
      price: r.price ?? null, total: r.total ?? null, settle: r.settle ?? null,
      heirs: (heirsRows ?? []).map(h => ({ id: h.id, name: h.name, share: Number(h.share), no_wish: h.no_wish, proxy: !!h.proxy_by })),
      items: items.map(i => ({ id: i.id, no: i.no, name: i.name, will: i.will || null })),
      swap_check_skipped: items.filter(i => !i.will && heirs.some(h => (pts[h.id] ?? {})[i.id] > 0)).length > 60,
    };
    const input_hash = await sha256(JSON.stringify(input));
    const document_hash = await sha256(JSON.stringify({ estate: estate_id, version, result }));
    const { data: run, error: runErr } = await s.from('distribution_runs').insert({
      estate_id, version, method: estate.method, lod, input_hash, result: { ...result, document_hash }, ef1_ok: r.ef.length === 0,
      engine_version: ENGINE_VERSION, released_at: new Date().toISOString(), created_by: user.id,
    }).select('id').single();
    if (runErr || !run) throw new Error('Kunne ikke gemme fordelingen: ' + runErr?.message);
    await s.from('distribution_inputs').insert({ run_id: run.id, input });
    // Forklaring pr. arving: egne ønsker, hvem der fik tingen, og hvad vinderen gav. Kun arvingen selv kan læse den.
    const expl = heirs.map(h => {
      const mine = estate.method === 'point'
        ? Object.entries(pts[h.id]).filter(([k]) => itemName[k]).sort((a, b) => b[1] - a[1]).map(([itemId, p]) => ({ itemId, name: itemName[itemId], mine: p, winnerId: owner[itemId] ?? null, winner: owner[itemId] ? nameOf[owner[itemId]] : null, winnerGave: owner[itemId] ? (pts[owner[itemId]][itemId] ?? 0) : null, got: owner[itemId] === h.id, lod: r.lodIds.includes(itemId) }))
        : Object.entries(bids[h.id]).filter(([k]) => itemName[k]).sort((a, b) => b[1] - a[1]).map(([itemId, b]) => ({ itemId, name: itemName[itemId], mine: b, winnerId: owner[itemId] ?? null, winner: owner[itemId] ? nameOf[owner[itemId]] : null, winnerGave: r.price ? r.price[itemId] ?? null : null, got: owner[itemId] === h.id, lod: r.lodIds.includes(itemId) }));
      return { run_id: run.id, heir_id: h.id, data: { wishes: mine, got: r.out[h.id].map((x: any) => x.itemId), score: r.score?.[h.id] ?? null, of: r.of?.[h.id] ?? null } };
    });
    await s.from('distribution_explanations').insert(expl);
    if (r.ties.length) await s.from('tie_break_records').insert(r.ties.map((t: { kind: string; itemId?: string; itemIds?: string[]; heirIds: string[]; winnerId: string }, k: number) => ({
      run_id: run.id, estate_id, kind: t.kind, item_ids: t.itemIds ?? (t.itemId ? [t.itemId] : []), heir_ids: t.heirIds, winner_heir_id: t.winnerId, note: r.lod[k] ?? '',
    })));
    await s.from('estates').update({ status: 'fordelt' }).eq('id', estate_id);
    const notes = (heirsRows ?? []).map(h => ({ estate_id, heir_id: h.id, kind: 'fordeling_klar', payload: { estate: estate.name, version } }));
    for (const n of notes) await s.rpc('enqueue_notification', { p_estate: estate_id, p_heir: n.heir_id, p_kind: n.kind, p_payload: n.payload });
    return json({ ok: true, run_id: run.id, version, ef1_ok: r.ef.length === 0, lod: r.lod.length });
  } catch (e) {
    console.error('run-distribution', e);
    await s.rpc('abort_distribution', { p_estate: estate_id });
    return fail((e as Error).message || 'Fordelingen kunne ikke beregnes', 500);
  }
});
