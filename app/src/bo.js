// Henter ét bo med alt, brugeren må se, og lægger det i en model, visningerne tegner fra.
import { sb } from './supabase.js';
import { must, ApiError } from './api.js';

export async function loadBo(id, userId) {
  const { data: estate, error } = await sb.from('estates').select('*').eq('id', id).maybeSingle();
  if (error) throw new ApiError(error.message, 500);
  if (!estate) throw new ApiError('Boet findes ikke, eller du har ikke adgang til det', 404);
  const [member, heirs, items, images, runs] = await Promise.all([
    must(await sb.from('estate_members').select('role, heir_id').eq('estate_id', id).eq('user_id', userId).maybeSingle()),
    must(await sb.from('heirs').select('*').eq('estate_id', id).order('sort').order('created_at')),
    must(await sb.from('items').select('*').eq('estate_id', id).is('deleted_at', null).order('no')),
    must(await sb.from('item_images').select('item_id, path').eq('estate_id', id).order('created_at')),
    must(await sb.from('distribution_runs').select('id, version, method, lod, result, ef1_ok, created_at, superseded_at').eq('estate_id', id).is('superseded_at', null).order('version', { ascending: false }).limit(1)),
  ]);
  const me = { userId, role: member?.role ?? null, heirId: member?.heir_id ?? null };
  const run = runs?.[0] ?? null;
  const B = { ...estate, me, heirs: heirs ?? [], items: items ?? [], images: {}, wishes: {}, run, ties: [], signatures: [], explanation: null, reopen: [], payments: [] };
  B.isTov = me.role === 'tovholder';
  B.myHeir = B.heirs.find(h => h.id === me.heirId) || null;

  // Billeder: signerede links, én time. Det seneste billede pr. ting.
  const paths = (images ?? []).map(x => x.path);
  if (paths.length) {
    const { data: signed } = await sb.storage.from('ting').createSignedUrls(paths, 3600);
    (images ?? []).forEach((x, k) => { const s = signed?.[k]; if (s?.signedUrl) B.images[x.item_id] = { path: x.path, url: s.signedUrl }; });
  }

  const more = [];
  if (B.myHeir) more.push(sb.from('wishes').select('item_id, points, bid').eq('heir_id', B.myHeir.id).then(r => { (must(r) ?? []).forEach(w => B.wishes[w.item_id] = { points: w.points, bid: Number(w.bid) }); }));
  if (run) {
    more.push(sb.from('tie_break_records').select('kind, item_ids, heir_ids, winner_heir_id, note').eq('run_id', run.id).then(r => { B.ties = must(r) ?? []; }));
    more.push(sb.from('signatures').select('heir_id, signed_name, method, created_at').eq('run_id', run.id).then(r => { B.signatures = must(r) ?? []; }));
    more.push(sb.from('consent_records').select('heir_id, user_id, note, given_at').eq('estate_id', id).eq('kind', 'ny_runde').eq('run_id', run.id).then(r => { B.reopen = must(r) ?? []; }));
    if (B.myHeir) more.push(sb.from('distribution_explanations').select('data').eq('run_id', run.id).eq('heir_id', B.myHeir.id).maybeSingle().then(r => { B.explanation = must(r)?.data ?? null; }));
  }
  if (B.isTov) more.push(sb.from('payments').select('status, amount_ore, paid_at, receipt_url').eq('estate_id', id).then(r => { B.payments = must(r) ?? []; }));
  await Promise.all(more);
  return B;
}

/* Afledte spørgsmål, som visningerne stiller. */
export const live = B => B.mode === 'live';
export const T = (B, a, b) => live(B) ? b : a;
export const freeItems = B => B.items.filter(i => !i.will_heir_id);
export const allIn = B => B.heirs.length > 0 && B.heirs.every(h => h.submitted_at);
export const revealed = B => !!B.run && ['fordelt', 'underskrevet', 'afsluttet'].includes(B.status);
export const signedBy = (B, heirId) => B.signatures.find(s => s.heir_id === heirId) || null;
export const allSigned = B => B.heirs.length > 0 && B.heirs.every(h => signedBy(B, h.id));
export const canEdit = B => ['kladde', 'aaben'].includes(B.status);
export const paid = B => !!B.paid_at;
export const heirById = (B, id) => B.heirs.find(h => h.id === id);
export const itemById = (B, id) => B.items.find(i => i.id === id);
export const pointsUsed = B => Object.entries(B.wishes).filter(([k]) => freeItems(B).some(i => i.id === k)).reduce((a, [, w]) => a + (w.points || 0), 0);
export const bidTotal = B => Object.entries(B.wishes).filter(([k]) => freeItems(B).some(i => i.id === k)).reduce((a, [, w]) => a + (w.bid || 0), 0);
