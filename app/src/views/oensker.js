// Ønskerne. Arvingen giver sine i hemmelighed; de gemmes løbende og låses med "Afgiv".
// Tovholderen ser kun, hvem der har svaret, og kan afgive for en arving uden smartphone efter registreret samtykke.
import { sb } from '../supabase.js';
import { must, rpc, fn } from '../api.js';
import { freeItems, pointsUsed, bidTotal, T, allIn } from '../bo.js';
import { art, bg } from '../art.js';
import { $, esc, lot, kr, toast, busy, av, msg, dato } from '../ui.js';

let proxy = null; // { heirId, wishes: {itemId:{points,bid}} } når tovholderen afgiver for en anden
let saveT = null, dirty = false;

export function view(ctx) {
  const B = ctx.B, me = B.myHeir, bid = B.method === 'kroner';
  const header = `<div class="eyebrow">trin 3 af 5</div>`;
  if (B.status === 'kladde') return `${header}<h1>Boet er ikke åbnet endnu</h1><p class="lead">${B.isTov ? 'Åbn boet på oversigten, så kan I give ønsker.' : 'Tovholderen åbner boet, når tingene og arvingerne er på plads. Du får besked.'}</p><a class="btn" href="/bo/${B.id}/oversigt">Til oversigten</a>`;
  if (!['aaben'].includes(B.status) && !proxy) {
    return `${header}<h1>Ønskerne er låst</h1><p class="lead">${B.status === 'laast' ? 'Fordelingen beregnes nu.' : 'Fordelingen er vist. Vil I rette ønsker, skal alle sige ja til en ny runde; det sker under Fordeling.'}</p><a class="btn go" href="/bo/${B.id}/fordeling">Se fordelingen</a>${me && B.explanation ? '' : ''}`;
  }

  // Tovholderens overblik og valg af, hvem der afgives for
  let tovPart = '';
  if (B.isTov) {
    const missing = B.heirs.filter(h => !h.submitted_at);
    tovPart = `<div class="card rest" style="margin-bottom:22px"><h2 style="margin:0">${allIn(B) ? 'Alle har svaret' : `${B.heirs.length - missing.length} af ${B.heirs.length} har svaret`}${B.deadline ? ` <span class="soft" style="font-size:14px;font-weight:400">· frist ${dato(B.deadline)}</span>` : ''}</h2>
      <div class="row">${B.heirs.map(h => `<span class="chip ${h.submitted_at ? 'good' : 'warn'}">${esc(h.name)}${h.submitted_at ? '' : ' · mangler'}${h.proxy_by ? ' · via dig' : ''}</span>`).join('')}</div>
      ${allIn(B) ? `<div class="row"><a class="btn go" href="/bo/${B.id}/fordeling">Videre til fordelingen</a></div>` : `<div class="row">${missing.filter(h => h.user_id !== ctx.user.id).map(h => `<button class="btn sm" type="button" data-remind="${h.id}">Påmind ${esc(h.name)}</button>`).join('')}
      ${missing.filter(h => !h.user_id && h.user_id !== ctx.user.id && h.id !== me?.id).map(h => `<button class="btn sm" type="button" data-proxy="${h.id}">Afgiv for ${esc(h.name)} (uden smartphone)</button>`).join('')}</div>`}
      <p class="soft" style="margin:0;font-size:13px">Du kan ikke se nogens ønsker, heller ikke efter fordelingen. Hver arving får kun sin egen forklaring.</p></div>`;
    if (!me && !proxy) return `${header}<h1>Ønskerne</h1><p class="lead">Du er tovholder uden selv at være arving, så du giver ingen ønsker.</p>${tovPart}`;
  }

  // Hvem afgives der for?
  const who = proxy ? B.heirs.find(h => h.id === proxy.heirId) : me;
  const W = proxy ? proxy.wishes : B.wishes;
  const F = freeItems(B);
  const used = Object.entries(W).filter(([k]) => F.some(i => i.id === k)).reduce((a, [, w]) => a + (w.points || 0), 0);
  const total = Object.entries(W).filter(([k]) => F.some(i => i.id === k)).reduce((a, [, w]) => a + (w.bid || 0), 0);
  const left = 100 - used, done = !proxy && !!who.submitted_at;

  if (proxy && !proxy.consented) {
    return `${header}<h1>Afgiv ønsker for ${esc(who.name)}</h1><p class="lead">${esc(who.name)} har ikke selv et link. Du kan afgive ønskerne på ${esc(who.name)}s vegne, når ${esc(who.name)} har givet lov. Det skrives ned, og det står i fordelingslisten, at du afgav dem.</p>
    <form class="card lock" id="proxyConsent"><label class="f" style="width:100%">Hvordan gav ${esc(who.name)} lov?<select id="pcChannel"><option value="telefon">I telefonen</option><option value="personligt">Ansigt til ansigt</option><option value="brev">På papir</option><option value="andet">På anden måde</option></select></label>
    <label class="f" style="width:100%">Hvornår, og hvad sagde ${esc(who.name)}?<input id="pcNote" required maxlength="300" placeholder="Fx '10. nov. kl. 14, i telefonen: Mette må skrive mine ønsker ind'"></label>
    <div class="row"><button class="btn go" type="submit">Registrér, og fortsæt</button><button class="btn" type="button" id="proxyCancel">Fortryd</button></div></form>`;
  }

  return `${header}<h1>${proxy ? `${esc(who.name)}s ønsker` : 'Hvad betyder mest for dig?'}</h1>
  <p class="lead">${bid ? 'Byd det, tingen er værd for ' + (proxy ? esc(who.name) : 'dig') + '. Man betaler kun for det, man får, og beløbet udlignes i arven.' : (proxy ? esc(who.name) + ' har' : 'Du har') + ' 100 point. Giv flest til det, der betyder mest. Man kan sagtens give alle point til én ting.'}</p>
  ${B.isTov && !proxy ? `<div class="method" role="group" aria-label="Metode"><button type="button" data-method="point" aria-pressed="${!bid}" ${B.heirs.some(h => h.submitted_at) ? 'disabled' : ''}><b>Pointmetoden</b><span>Bedst til ting med følelser i. Ingen penge involveret.</span></button><button type="button" data-method="kroner" aria-pressed="${bid}" ${B.heirs.some(h => h.submitted_at) ? 'disabled' : ''}><b>Kronemetoden</b><span>Til værdifulde ting. Højeste bud vinder, forskellen udlignes i arven.</span></button></div>` : ''}
  ${tovPart}
  <div class="secret"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor"/><path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>${proxy ? `Du skriver ind for ${esc(who.name)}. Det logges.` : `Kun du kan se dine ${bid ? 'bud' : 'point'}. Ikke tovholderen, ikke de andre.`}${proxy ? `<button class="btn sm" type="button" id="proxyCancel" style="margin-left:auto">Stop</button>` : ''}</div>
  <div class="card purse">${bid ? `<b>${esc(who.name)}s bud</b><span class="soft grow">Bud i alt: <span class="num">${kr(total)}</span></span>` :
    done && who.no_wish ? `<b>${esc(who.name)} ønsker ikke noget af tingene</b><span class="soft grow">Det er helt i orden. De andre deler.</span>` :
    `<b class="num">${left} point tilbage</b><div class="coins" aria-hidden="true">${Array.from({ length: 20 }, (_, k) => `<span class="coin ${k >= left / 5 ? 'spent' : ''}"></span>`).join('')}</div>`}
   ${done ? `<button class="btn sm" type="button" id="unsubmit">Ret mine ønsker</button>` : `<button class="btn ochre sm" type="button" id="submit" ${!bid && left !== 0 ? 'disabled' : ''}>${!bid && left !== 0 ? 'Brug alle point først' : proxy ? `Afgiv for ${esc(who.name)}` : 'Afgiv mine ønsker'}</button>${!bid && left === 100 ? `<button class="btn sm" type="button" id="nothing">${proxy ? esc(who.name) + ' ønsker' : 'Jeg ønsker'} ikke noget</button>` : ''}`}</div>
  <div class="grid">${F.map(i => { const w = W[i.id] || {}, val = bid ? (w.bid || 0) : (w.points || 0); const img = B.images[i.id];
    return `<article class="tag"><span class="lot">${lot(i)}</span><div class="pic" style="${bg(i.room)}">${img ? `<img src="${esc(img.url)}" alt="${esc(i.name)}" loading="lazy">` : art(i.kind, i.room)}</div>
    <div class="txt"><div class="name">${esc(i.name)}</div><div class="room">${esc(i.room)}${i.description ? ' · ' + esc(i.description) : ''}</div>
    ${bid ? `<label class="f" style="margin-top:6px">Bud<input type="number" min="0" step="100" inputmode="numeric" value="${val || ''}" placeholder="0 kr." data-bid="${i.id}" ${done ? 'disabled' : ''}></label>` :
    `<div class="pips" aria-hidden="true">${Array.from({ length: Math.floor(val / 5) }, () => '<span class="pip"></span>').join('')}</div>
     <div class="stepper"><button type="button" data-dec="${i.id}" aria-label="5 point mindre til ${esc(i.name)}" ${done || !val ? 'disabled' : ''}>−</button><span class="val">${val} p</span><button type="button" data-inc="${i.id}" aria-label="5 point mere til ${esc(i.name)}" ${done || !left ? 'disabled' : ''}>+</button></div>`}
    </div></article>`; }).join('') || '<p class="soft">Der er ingen ting at ønske endnu.</p>'}</div>
  <p class="soft" style="font-size:13px;margin-top:20px">${B.items.filter(i => i.will_heir_id).length ? B.items.filter(i => i.will_heir_id).length + ' ting er testamenteret og vises ikke her.' : ''}</p>`;
}

/* ---------- Gem ---------- */
function payload(B, W) { const bid = B.method === 'kroner'; return Object.entries(W).filter(([k, w]) => freeItems(B).some(i => i.id === k) && (bid ? w.bid > 0 : w.points > 0)).map(([item_id, w]) => bid ? { item_id, bid: w.bid } : { item_id, points: w.points }); }
async function save(ctx) {
  const B = ctx.B; dirty = false;
  if (proxy) return; // gemmes først ved "Afgiv for X"
  await rpc('set_wishes', { p_estate: B.id, p_wishes: payload(B, B.wishes) });
}
function queueSave(ctx) { dirty = true; clearTimeout(saveT); saveT = setTimeout(() => save(ctx).catch(e => toast(msg(e), true)), 700); }
async function flush(ctx) { clearTimeout(saveT); if (dirty) await save(ctx); }

export async function click(e, ctx) {
  const B = ctx.B, b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  const W = proxy ? proxy.wishes : B.wishes;
  if (d.method) {
    if (d.method === B.method) return;
    must(await sb.from('estates').update({ method: d.method }).eq('id', B.id)); await ctx.reload(); toast(d.method === 'kroner' ? 'Kronemetoden valgt' : 'Pointmetoden valgt'); return;
  }
  if (d.inc || d.dec) {
    const id = d.inc || d.dec, used = Object.entries(W).filter(([k]) => freeItems(B).some(i => i.id === k)).reduce((a, [, w]) => a + (w.points || 0), 0);
    const c = (W[id] || {}).points || 0; const n = d.inc ? c + Math.min(5, 100 - used) : Math.max(0, c - 5);
    if (n) W[id] = { ...(W[id] || {}), points: n }; else delete W[id];
    queueSave(ctx); ctx.render(); return;
  }
  if (b.id === 'submit') {
    if (proxy) {
      await busy(b, rpc('proxy_set_wishes', { p_estate: B.id, p_heir: proxy.heirId, p_wishes: payload(B, proxy.wishes), p_lock: true }), 'Gemmer …');
      const name = B.heirs.find(h => h.id === proxy.heirId)?.name; proxy = null; await ctx.reload(); toast(`Ønskerne for ${name} er afgivet.`); return;
    }
    await busy(b, (async () => { await flush(ctx); await rpc('lock_wishes', { p_estate: B.id }); })(), 'Gemmer …');
    await ctx.reload(); toast('Tak. Dine ønsker er afgivet og låst.');
    if (allIn(ctx.B) && ctx.B.isTov) ctx.nav('/bo/' + B.id + '/fordeling'); return;
  }
  if (b.id === 'nothing') {
    if (proxy) { await busy(b, rpc('proxy_set_wishes', { p_estate: B.id, p_heir: proxy.heirId, p_wishes: [], p_lock: true }), 'Gemmer …'); proxy = null; await ctx.reload(); toast('Registreret: ønsker ikke noget.'); return; }
    B.wishes = {}; await busy(b, (async () => { await rpc('set_wishes', { p_estate: B.id, p_wishes: [] }); await rpc('lock_wishes', { p_estate: B.id }); })(), 'Gemmer …');
    await ctx.reload(); toast('Tak. Du har sagt, at du ikke ønsker noget.'); return;
  }
  if (b.id === 'unsubmit') { await busy(b, rpc('unlock_my_wishes', { p_estate: B.id }), 'Låser op …'); await ctx.reload(); return; }
  if (d.remind) { const h = B.heirs.find(x => x.id === d.remind); try { await busy(b, fn('invite', { heir_id: h.id, channel: h.phone ? 'sms' : 'email' }), 'Sender …'); toast('Nyt link sendt til ' + h.name); } catch (err) { toast(msg(err), true); } return; }
  if (d.proxy) { proxy = { heirId: d.proxy, wishes: {}, consented: false }; ctx.render(); return; }
  if (b.id === 'proxyCancel') { proxy = null; ctx.render(); return; }
}
export async function change(e, ctx) {
  const B = ctx.B, t = e.target, d = t.dataset, W = proxy ? proxy.wishes : B.wishes;
  if (d.bid) { const v = Math.max(0, Math.round(+t.value || 0)); if (v) W[d.bid] = { ...(W[d.bid] || {}), bid: v }; else delete W[d.bid]; queueSave(ctx); ctx.render(); }
}
export async function submit(e, ctx) {
  const B = ctx.B;
  if (e.target.id === 'proxyConsent' && proxy) {
    await busy(e.target.querySelector('button[type=submit]'), rpc('record_consent', { p_estate: B.id, p_kind: 'proxy_oensker', p_heir: proxy.heirId, p_channel: $('#pcChannel').value, p_note: $('#pcNote').value.trim() }), 'Gemmer …');
    proxy.consented = true; ctx.render();
  }
}
