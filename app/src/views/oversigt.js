// Oversigten: hvor langt er boet, og hvad er næste skridt. Tovholderen ser betaling og åbning her.
import { sb } from '../supabase.js';
import { rpc, fn } from '../api.js';
import { T, allIn, revealed, allSigned, paid, signedBy, live } from '../bo.js';
import { tint } from '../art.js';
import { esc, toast, busy, dato, arm, msg } from '../ui.js';

export function view(ctx) {
  const B = ctx.B, me = B.myHeir, tovName = (B.heirs.find(h => h.user_id === B.created_by) || {}).name || 'tovholderen';
  const sub = B.heirs.filter(h => h.submitted_at).length, signed = B.heirs.filter(h => signedBy(B, h.id)).length;
  const st = [
    { t: 'Ting fotograferet', d: `${B.items.length} ting i ${new Set(B.items.map(i => i.room)).size} rum`, done: B.items.length > 0, href: 'ting' },
    { t: T(B, 'Arvinger inviteret', 'Børn inviteret'), d: `${B.heirs.length} ${T(B, 'arvinger', 'børn')}${B.heirs.filter(h => h.user_id).length ? ', ' + B.heirs.filter(h => h.user_id).length + ' har åbnet deres link' : ''}`, done: B.heirs.length > 1, href: 'arvinger' },
    { t: 'Ønsker afgivet', d: `${sub} af ${B.heirs.length}${B.deadline ? ' · frist ' + dato(B.deadline) : ''}`, done: allIn(B), href: 'oensker' },
    { t: 'Fordeling', d: revealed(B) ? `Vist for alle (version ${B.run.version})` : B.status === 'laast' ? 'Beregnes nu' : 'Beregnes, når alle har afgivet ønsker', done: revealed(B), href: 'fordeling' },
    { t: T(B, 'Underskrift', 'Godkendelse'), d: `${signed} af ${B.heirs.length} har underskrevet`, done: allSigned(B), href: 'underskrift' }];
  const now = st.findIndex(s => !s.done);
  const nextTxt = B.isTov ? (['Fotografér tingene', 'Inviter arvingerne', 'Se hvem der mangler', 'Del tingene', 'Underskriv fordelingen'][now] || 'Se fordelingslisten')
    : (me && !me.submitted_at && B.status === 'aaben' ? 'Giv dine ønsker' : revealed(B) && me && !signedBy(B, me.id) ? 'Skriv under' : 'Se fordelingen');
  const nextHref = B.isTov ? (st[now]?.href || 'underskrift') : (me && !me.submitted_at && B.status === 'aaben' ? 'oensker' : revealed(B) && me && !signedBy(B, me.id) ? 'underskrift' : 'fordeling');
  const missing = B.heirs.filter(h => !h.submitted_at);

  let gate = '';
  if (B.isTov && B.status === 'kladde') {
    const heirsOk = B.heirs.length >= 2;
    gate = `<div class="card rest" style="margin-bottom:22px"><h2 style="margin:0">${paid(B) ? 'Boet er betalt' : 'Boet er ikke åbnet endnu'}</h2>
      <p class="soft" style="margin:0">${paid(B) ? (heirsOk ? 'Åbn det, så arvingerne kan give ønsker. Tingene kan stadig rettes bagefter.' : 'Tilføj mindst to arvinger, før boet kan åbnes.') : 'Ét bo koster 795 kr. inkl. moms og dækker op til 6 arvinger og 300 ting. Du kan registrere ting og arvinger, før du betaler.'}</p>
      <div class="row">${paid(B) ? `<button class="btn go" type="button" id="open" ${heirsOk ? '' : 'disabled'}>Åbn boet for ønsker</button>` : `<button class="btn go" type="button" id="pay">Betal 795 kr.</button>`}</div></div>`;
  }
  if (B.isTov && B.status === 'underskrevet') {
    gate = `<div class="card rest" style="margin-bottom:22px"><h2 style="margin:0">Alle har underskrevet</h2><p class="soft" style="margin:0">Hent fordelingslisten som PDF under Underskrift. Når I er færdige, kan du afslutte boet; så slettes alt automatisk efter ${B.retention_days} dage.</p>
      <div class="row"><button class="btn go" type="button" id="close">Afslut boet</button></div></div>`;
  }
  if (B.status === 'afsluttet') gate = `<div class="card rest" style="margin-bottom:22px"><h2 style="margin:0">Boet er afsluttet</h2><p class="soft" style="margin:0">Alt slettes automatisk ${dato(B.retention_until)}. Hent PDF'en inden da.</p></div>`;
  const danger = B.isTov && B.status !== 'afsluttet' ? `<p class="soft" style="font-size:13px;margin-top:28px"><button class="btn sm" type="button" id="delnow">Slet boet nu</button> Sletter alt med det samme: ting, billeder, ønsker og fordeling.</p>` : '';

  return `<div class="hero"><div>
  <div class="memorial"><div class="portrait">${esc([...B.name][0] || '')}</div><div><div class="eyebrow">${T(B, 'boet efter', 'tingene hos')}</div><h1 style="margin:0">${esc(B.name)}</h1><div class="years">${esc(B.years || '')}</div></div></div>
  <p class="lead">${B.isTov ? T(B, `Her er status på jeres deling. Alle vælger i hemmelighed, og ingen skal sidde om bordet og forhandle.`, `Her er status. Børnene giver deres ønsker i hemmelighed, og resultatet kan blive grundlaget for et indbotestamente.`)
    : `${esc(tovName)} er tovholder. Dine ønsker er hemmelige, og ingen kan se dem, før alle har svaret.`}</p>
  ${gate}
  <div class="card track">${st.map((s, i) => `<a class="trk ${s.done ? 'done' : i === now ? 'now' : ''}" href="/bo/${B.id}/${s.href}" style="text-decoration:none"><span class="dot">${s.done ? '✓' : i + 1}</span><span><b>${s.t}</b><small>${s.d}</small></span><span class="soft">→</span></a>`).join('')}</div>
  <div class="row" style="margin-top:18px"><a class="btn go" href="/bo/${B.id}/${nextHref}">${nextTxt}</a>
   ${B.isTov && missing.length && B.status === 'aaben' ? `<button class="btn" type="button" id="remindAll">Send påmindelse til ${esc(missing.map(h => h.name).join(' og '))}</button>` : ''}</div>
  <div class="rooms">${[...new Set(B.items.map(i => i.room))].map(g => `<span class="chip"><span style="width:8px;height:8px;border-radius:50%;background:${tint(g)[0]}"></span>${esc(g)} · ${B.items.filter(i => i.room === g).length}</span>`).join('')}</div>
  ${danger}
 </div>
 <div><div class="card" style="padding:18px"><h3 style="margin-bottom:8px">Sådan foregår det</h3><ol style="margin:0;padding-left:20px;display:grid;gap:6px;font-size:14px;color:var(--soft)"><li>Tovholderen fotograferer tingene og inviterer ${T(B, 'arvingerne', 'børnene')} på SMS.</li><li>Hver især giver sine ønsker i hemmelighed: 100 point${B.method === 'kroner' ? ' eller bud i kroner' : ''}.</li><li>Når alle har svaret, deles tingene, så alle får mest muligt af det, der betyder mest for dem. Står nogen lige, afgør et lod det.</li><li>Alle ${T(B, 'skriver under', 'godkender')} med en kode fra SMS. Først da gælder fordelingen.</li></ol>
  ${B.isTov ? `<p class="soft" style="font-size:13px;margin:14px 0 0"><a href="/bo/${B.id}/oversigt#log" id="showlog">Vis, hvem der har ændret hvad</a></p><div id="log"></div>` : ''}</div></div></div>`;
}

export async function click(e, ctx) {
  const B = ctx.B, b = e.target.closest('button, a#showlog'); if (!b) return;
  if (b.id === 'pay') {
    try { const r = await busy(b, fn('stripe-checkout', { estate_id: B.id }), 'Åbner betaling …'); location.href = r.url; }
    catch (err) { toast(err.status === 503 ? 'Betaling er ikke sat op i denne testversion endnu.' : msg(err), true); }
    return;
  }
  if (b.id === 'open') { await busy(b, rpc('open_estate', { p_estate: B.id }), 'Åbner …'); toast('Boet er åbent. Inviter arvingerne, hvis du ikke har gjort det.'); await ctx.reload(); return; }
  if (b.id === 'close') { if (!arm('close', b, 'Afslut boet? Tryk igen')) return; await busy(b, rpc('close_estate', { p_estate: B.id }), 'Afslutter …'); toast('Boet er afsluttet'); await ctx.reload(); return; }
  if (b.id === 'delnow') { if (!arm('del', b, 'Slet alt? Tryk igen')) return; await busy(b, rpc('delete_estate_now', { p_estate: B.id }), 'Sletter …'); toast('Boet er slettet'); ctx.B = null; ctx.nav('/', true); return; }
  if (b.id === 'remindAll') {
    const who = B.heirs.filter(h => !h.submitted_at && h.user_id !== ctx.user.id && (h.phone || h.email));
    let n = 0; for (const h of who) { try { await fn('invite', { heir_id: h.id, channel: h.phone ? 'sms' : 'email' }); n++; } catch (err) { toast(h.name + ': ' + msg(err), true); } }
    if (n) toast('Nyt link sendt til ' + n + (n === 1 ? ' arving' : ' arvinger')); return;
  }
  if (b.id === 'showlog') {
    e.preventDefault();
    const { data } = await sb.from('audit_events').select('action, table_name, meta, created_at, actor').eq('estate_id', B.id).order('created_at', { ascending: false }).limit(60);
    const who = id => (B.heirs.find(h => h.user_id === id) || {}).name || (id ? 'en bruger' : 'serveren');
    const TB = { estates: 'boet', heirs: 'arving', items: 'ting', invitations: 'invitation', wishes: 'ønsker', distribution_runs: 'fordeling', signatures: 'underskrift', consent_records: 'samtykke', payments: 'betaling', estate_members: 'medlem' };
    const AC = { insert: 'tilføjede', update: 'ændrede', delete: 'fjernede', slet_nu: 'slettede', slettet: 'slettet' };
    document.getElementById('log').innerHTML = `<ul style="margin:8px 0 0;padding-left:18px;font-size:13px;color:var(--soft);display:grid;gap:3px">${(data || []).map(r => `<li>${new Date(r.created_at).toLocaleString('da-DK', { dateStyle: 'short', timeStyle: 'short' })}: ${esc(who(r.actor))} ${AC[r.action] || r.action} ${TB[r.table_name] || r.table_name || ''}${r.meta?.name ? ' "' + esc(r.meta.name) + '"' : ''}</li>`).join('') || '<li>Intet endnu</li>'}</ul>`;
  }
}
