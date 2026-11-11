// Arvingerne. Tovholderen tilføjer, sætter arvelod og sender links. Hver arving får sit eget link på SMS eller mail.
import { sb } from '../supabase.js';
import { must, fn, rpc, normPhone, isEmail } from '../api.js';
import { canEdit, T } from '../bo.js';
import { $, esc, toast, arm, busy, av, heirColor, msg, datoKort } from '../ui.js';

let invites = null, invitesFor = null;

export async function view(ctx) {
  const B = ctx.B, edit = B.isTov && canEdit(B);
  if (B.isTov && invitesFor !== B.id + B.heirs.length) { invites = must(await sb.from('invitations').select('heir_id, channel, sent_to, expires_at, used_at, revoked_at, created_at').eq('estate_id', B.id).order('created_at', { ascending: false })) ?? []; invitesFor = B.id + B.heirs.length; }
  const inv = id => (invites || []).find(x => x.heir_id === id && !x.revoked_at) || null;
  return `<div class="eyebrow">${edit ? 'trin 2 af 5' : T(B, 'arvingerne', 'børnene')}</div><h1>${T(B, 'Hvem skal dele?', 'Hvem skal give ønsker?')}</h1>
  <p class="lead">${B.isTov ? 'Hver ' + T(B, 'arving', '') + ' får sit eget link på SMS eller mail. Arvelod bruges, hvis nogen arver mere eller mindre, fx et barnebarn, der arver halvdelen af en afdød forælders del.' : 'Her er dem, der deler. Ingen kan se de andres ønsker.'}</p>
  <div class="heirs">${B.heirs.map(h => {
    const i = inv(h.id); const isMe = h.user_id === ctx.user.id;
    const status = h.submitted_at ? '<span class="chip good">Ønsker afgivet</span>' : h.user_id ? '<span class="chip">Har åbnet sit link</span>' : i && !i.used_at ? '<span class="chip warn">Link sendt ' + datoKort(i.created_at) + '</span>' : B.isTov ? '<span class="chip warn">Ikke inviteret</span>' : '<span class="chip warn">Har ikke svaret endnu</span>';
    return `<div class="card heir"><div class="top">${av(B.heirs, h)}<div><div class="nm" style="--c:${heirColor(B.heirs, h.id)}">${esc(h.name)}${isMe ? ' <span class="soft" style="font:600 12px var(--body)">(dig)</span>' : ''}</div><div class="soft" style="font-size:13px">${esc(h.relation || T(B, 'Arving', 'Barn'))}${h.proxy_by ? ' · ønsker afgives af tovholderen' : ''}</div></div></div>
    <div class="row">${status}</div>
    ${B.isTov ? `<div class="soft" style="font-size:13px">${esc(h.phone || '')}${h.phone && h.email ? ' · ' : ''}${esc(h.email || '')}${!h.phone && !h.email ? 'Hverken telefon eller mail' : ''}</div>` : ''}
    ${edit ? `<label class="f">Arvelod<select data-w="${h.id}">${[[1, 'Hel andel'], [0.5, 'Halv andel'], [0.25, 'Kvart andel'], [2, 'Dobbelt andel'], [1.5, 'Halvanden andel']].map(([v, t]) => `<option value="${v}" ${+h.share === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <div class="row">${!isMe && !h.submitted_at && (h.phone || h.email) ? `<button class="btn sm" type="button" data-invite="${h.id}">${i || h.user_id ? 'Send nyt link' : 'Send link'}</button>` : ''}${!isMe && !h.submitted_at ? `<button class="btn sm" type="button" data-rmheir="${h.id}">Fjern</button>` : ''}</div>`
    : B.isTov && !h.submitted_at && !isMe && (h.phone || h.email) && B.status === 'aaben' ? `<div class="row"><button class="btn sm" type="button" data-invite="${h.id}">Send nyt link</button></div>` : ''}</div>`; }).join('')}
  ${edit ? `<form class="card heir" id="addHeir" style="border-style:dashed;box-shadow:none"><h3>Tilføj ${T(B, 'arving', 'barn')}</h3>
    <label class="f">Navn<input id="hName" required maxlength="80" placeholder="Fx Jonas"></label>
    <label class="f">Mobilnummer<input id="hTel" inputmode="tel" autocomplete="off" placeholder="Fx 20 30 40 50"></label>
    <label class="f">Mail (hvis ingen mobil)<input id="hMail" inputmode="email" autocomplete="off" placeholder="Fx jonas@mail.dk"></label>
    <label class="f">Relation<input id="hRel" maxlength="60" placeholder="Fx Barnebarn"></label>
    <label class="row" style="font-weight:400;font-size:13.5px;color:var(--soft)"><input type="checkbox" id="hSend" checked style="width:auto"> Send linket med det samme</label>
    <button class="btn go" type="submit">Tilføj</button></form>` : ''}</div>
  ${B.isTov && B.status === 'kladde' ? `<p class="soft" style="margin-top:18px;font-size:13.5px">Links kan sendes nu, men ${T(B, 'arvingerne', 'børnene')} kan først give ønsker, når boet er åbnet (betalt og mindst to ${T(B, 'arvinger', 'børn')}).</p>` : ''}`;
}

export async function change(e, ctx) {
  const d = e.target.dataset;
  if (d.w) { must(await sb.from('heirs').update({ share: Number(e.target.value) }).eq('id', d.w)); toast('Arvelod ændret'); const h = ctx.B.heirs.find(x => x.id === d.w); if (h) h.share = Number(e.target.value); }
}
export async function click(e, ctx) {
  const B = ctx.B, b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  if (d.invite) {
    const h = B.heirs.find(x => x.id === d.invite); if (!h) return;
    try { const r = await busy(b, fn('invite', { heir_id: h.id, channel: h.phone ? 'sms' : 'email' }), 'Sender …'); invitesFor = null; toast(`Link sendt til ${h.name} (${r.sent_to}). Det gælder i 14 dage.`, true); ctx.render(); }
    catch (err) { toast(msg(err), true); }
    return;
  }
  if (d.rmheir) {
    const h = B.heirs.find(x => x.id === d.rmheir); if (!h) return;
    if (!arm('rm' + h.id, b, 'Fjern ' + h.name + '? Tryk igen')) return;
    must(await sb.from('heirs').delete().eq('id', h.id)); await ctx.reload(); toast(h.name + ' er fjernet');
  }
}
export async function submit(e, ctx) {
  const B = ctx.B; if (e.target.id !== 'addHeir') return;
  const name = $('#hName').value.trim(), telRaw = $('#hTel').value.trim(), mailRaw = $('#hMail').value.trim();
  const phone = telRaw ? normPhone(telRaw) : null, email = mailRaw ? mailRaw.toLowerCase() : null;
  if (telRaw && !phone) { toast('Mobilnummeret skal have 8 cifre (eller landekode med +).'); return; }
  if (mailRaw && !isEmail(mailRaw)) { toast('Mailadressen ser ikke rigtig ud.'); return; }
  const btn = e.target.querySelector('button[type=submit]');
  const h = await busy(btn, (async () => must(await sb.from('heirs').insert({ estate_id: B.id, name, relation: $('#hRel').value.trim() || null, phone, email, sort: B.heirs.length }).select('*').single()))(), 'Tilføjer …');
  let sent = '';
  if ($('#hSend').checked && (phone || email)) { try { await fn('invite', { heir_id: h.id, channel: phone ? 'sms' : 'email' }); sent = ' Linket er sendt.'; } catch (err) { sent = ' Linket kunne ikke sendes: ' + msg(err); } }
  invitesFor = null; await ctx.reload(); toast(`${name} er tilføjet.${sent}`, true);
}
