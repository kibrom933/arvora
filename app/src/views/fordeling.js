// Fordelingen. Tovholderen starter den, serveren regner, alle ser resultatet og sin egen forklaring.
import { sb } from '../supabase.js';
import { must, rpc, fn } from '../api.js';
import { freeItems, allIn, revealed, T, heirById, itemById, signedBy } from '../bo.js';
import { art, bg } from '../art.js';
import { $, esc, lot, kr, og, toast, busy, av, heirColor, msg } from '../ui.js';

let animate = false;
const REST = [['', 'Ikke besluttet'], ['salg', 'Sælges'], ['genbrug', 'Gives til genbrug'], ['rydning', 'Ryddes'], ['faelles', 'Beholdes i fællesskab'], ['udenfor', 'Afgøres uden for Arvora']];

export function view(ctx) {
  const B = ctx.B, me = B.myHeir, bid = B.method === 'kroner', head = `<div class="eyebrow">trin 4 af 5</div>`;
  if (B.status === 'kladde') return `${head}<h1>Boet er ikke åbnet endnu</h1><p class="lead">Fordelingen kan først beregnes, når boet er åbent, og alle har givet ønsker.</p>`;
  if (B.status === 'laast') return `${head}<h1>Fordelingen beregnes</h1><p class="lead">Det tager et øjeblik.</p><button class="btn" type="button" id="refresh">Opdater</button>`;
  if (!revealed(B)) {
    if (!allIn(B)) { const m = B.heirs.filter(h => !h.submitted_at); return `${head}<h1>Venter på ${esc(og(m.map(h => h.name)))}</h1><p class="lead">Fordelingen kan først beregnes, når alle har afgivet deres ønsker. Det sikrer, at ingen kan se de andres ønsker og tilpasse sine egne.</p>${B.isTov ? `<div class="row"><a class="btn" href="/bo/${B.id}/oensker">Se hvem der mangler</a></div>` : ''}`; }
    if (!B.isTov) return `${head}<h1>Alle har svaret</h1><p class="lead">Tovholderen deler tingene, gerne mens I er sammen. Du får besked, når fordelingen er klar.</p><button class="btn" type="button" id="refresh">Opdater</button>`;
    return `${head}<h1>Alle har svaret</h1><p class="lead">${freeItems(B).length} ting venter på at blive delt mellem ${esc(og(B.heirs.map(h => h.name)))}. Tryk, når I er klar. Det er en god idé at gøre det, mens I er sammen eller i telefonen.</p>
    <div class="stage"><div class="pile"><div class="heap">${freeItems(B).slice(0, 7).map((i, k) => `<span style="transform:rotate(${(k - 3) * 7}deg) translate(${(k - 3) * 9}px,${Math.abs(k - 3) * 5 - 10}px)">${lot(i)}</span>`).join('')}</div></div>
    <div class="row" style="justify-content:center"><button class="btn ochre" type="button" id="reveal" style="font-size:17px;padding:14px 26px">Del tingene</button></div>
    <p class="soft" style="text-align:center;font-size:13.5px;margin:0">Står nogen helt lige om en ting, afgør et lod det. Loddet blev trukket, da boet blev oprettet, og kan ikke trækkes om. Når fordelingen er vist, kan ønskerne kun ændres, hvis alle siger ja til en ny runde.</p></div>`;
  }

  const R = B.run.result, out = R.out || {}, rest = (R.rest || []).map(id => itemById(B, id)).filter(Boolean);
  const names = {}; (R.heirs || []).forEach(h => names[h.id] = h.name);
  const boxes = B.heirs.map(h => {
    const list = out[h.id] || [], info = (R.heirs || []).find(x => x.id === h.id) || {}, none = !bid && (R.of?.[h.id] ?? 0) === 0;
    const pct = bid ? null : Math.round(100 * (R.score?.[h.id] ?? 0) / Math.max(1, R.of?.[h.id] ?? 0));
    return `<section class="box"><div class="label"><span class="hand">${esc(h.name)}</span>${av(B.heirs, h)}</div>
    ${bid ? '' : none ? `<div class="fair"><small class="soft">Ønskede ikke noget af tingene</small></div>` : `<div class="fair"><div class="row" style="justify-content:space-between"><small class="soft">Fik af sine ønsker</small><b class="num">${pct} %</b></div><div class="bar2"><span data-w="${pct}" style="width:${animate ? 0 : pct}%;background:${heirColor(B.heirs, h.id)}"></span></div></div>`}
    ${info.proxy ? `<small class="soft">Ønskerne blev afgivet af tovholderen efter aftale.</small>` : ''}
    <ul>${list.map(x => { const it = itemById(B, x.itemId); if (!it) return ''; const img = B.images[it.id];
      return `<li class="it" data-fly><span class="mini" style="${bg(it.room)}">${img ? `<img src="${esc(img.url)}" alt="" style="width:40px;height:30px;object-fit:cover;border-radius:6px">` : art(it.kind, it.room)}</span><span class="nm">${esc(it.name)}</span><span class="p">${x.will ? '<span class="chip will">Testamente</span>' : (bid ? kr(x.price || 0) : (x.points || 0) + ' p') + (x.lod ? ' · lod' : '')}</span></li>`; }).join('') || '<li class="soft">Ingen ting</li>'}</ul>
    ${me && me.id === h.id && B.explanation && !bid && !none ? `<details class="why"><summary>Hvorfor fik du netop det her?</summary>${why(B)}</details>` : ''}
    ${me && me.id === h.id && B.explanation && bid ? `<details class="why"><summary>Dine bud</summary>${whyBids(B)}</details>` : ''}</section>`; }).join('');

  const lodNotes = (B.ties.length ? B.ties.map(t => t.note) : (R.lod_notes || [])).filter(Boolean);
  const lodCard = lodNotes.length ? `<div class="card chk lod"><span class="ic">=</span><div><b>Afgjort ved lodtrækning</b><small>${lodNotes.slice(0, 6).map(esc).join('<br>')}${lodNotes.length > 6 ? `<br>Og ${lodNotes.length - 6} mere, som står på fordelingslisten.` : ''}<br>Loddet blev trukket, da boet blev oprettet, og kan ikke trækkes om.</small></div></div>` : '';
  const zero = (R.zero || []).map(id => names[id]).filter(Boolean);
  const zeroCard = zero.length ? `<div class="card chk no"><span class="ic">!</span><div><b>${esc(og(zero))} fik ingen af ${zero.length > 1 ? 'deres' : 'sine'} ønsker</b><small>Det, ${zero.length > 1 ? 'de' : esc(zero[0])} ønskede, gik til andre. Tal sammen om det, eller prøv kronemetoden i en ny runde, hvor forskellen udlignes i penge.</small></div></div>` : '';
  const ef = R.ef || [];
  const checks = bid ? (lodCard ? `<div class="checks">${lodCard}</div>` : '') : `<div class="checks">
    ${ef.length || !(lodNotes.length || zero.length) ? `<div class="card chk ${ef.length ? 'no' : ''}"><span class="ic">${ef.length ? '!' : '✓'}</span><div><b>${ef.length ? 'Nogen kan misunde en anden' : 'Ingen misunder de andre'}</b><small>${ef.length ? ef.map(([a, b]) => esc(names[a]) + ' foretrækker ' + esc(names[b]) + 's kasse').join('. ') + '. Overvej kronemetoden i en ny runde.' : 'Fjerner man én ting fra en andens kasse, vil alle hellere have deres egen. Det er standarden for fair fordeling af ting, der ikke kan deles.'}</small></div></div>` : ''}${lodCard}${zeroCard}
    <div class="card chk"><span class="ic">✓</span><div><b>Ingen bytning gør det bedre</b><small>${R.swap_check_skipped ? 'Ingen flytning af en enkelt ting kan gøre én gladere uden at gøre en anden mindre glad. Bytninger er ikke efterprøvet, fordi der er mange ting.' : 'Ingen flytning eller bytning af to ting kan gøre én gladere uden at gøre en anden mindre glad.'}</small></div></div>
    <div class="card chk"><span class="ic">✓</span><div><b>Testamentet er fulgt</b><small>${B.items.filter(i => i.will_heir_id).length} ting er givet efter testamentet og tæller ikke med i pointene.</small></div></div></div>`;
  const settle = bid && R.settle ? `<h2 style="margin-top:30px">Udligning i arven</h2><p class="soft">Det fordelte er samlet ${kr(R.total || 0)} værd efter de vindende bud. Hver arving har ret til sin andel, og forskellen udlignes, når boet gøres op. Arvora flytter ingen penge.</p>
    <div class="card tw"><table class="st"><thead><tr><th>Arving</th><th class="r">Har fået for</th><th class="r">Andel</th><th class="r">Udligning</th></tr></thead><tbody>${R.settle.map(s => `<tr><td>${esc(names[s.heirId])}</td><td class="r num">${kr(s.got)}</td><td class="r num">${kr(s.share)}</td><td class="r"><b>${s.diff > 0.5 ? 'Får ' + kr(s.diff) + ' mindre' : s.diff < -0.5 ? 'Får ' + kr(-s.diff) + ' mere' : 'Lige op'}</b></td></tr>`).join('')}</tbody></table></div>` : '';
  const restBox = rest.length ? `<div class="card rest" style="margin-top:22px"><h2 style="margin:0">${rest.length} ting har ingen ønsket</h2><p class="soft" style="margin:0">De kan sælges, gives væk eller ryddes. ${B.isTov ? 'Skriv, hvad I beslutter, så det står på listen.' : ''}</p>
    <div class="row">${rest.map(i => B.isTov && B.status !== 'afsluttet' ? `<label class="chip" style="gap:8px">${lot(i)} · ${esc(i.name)} <select data-rest="${i.id}" style="width:auto;padding:2px 6px;font-size:12px">${REST.map(([v, t]) => `<option value="${v}" ${(i.rest_decision || '') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>` : `<span class="chip">${lot(i)} · ${esc(i.name)}${i.rest_decision ? ' · ' + (REST.find(r => r[0] === i.rest_decision) || [])[1] : ''}</span>`).join('')}</div></div>` : '';

  // Ny runde (model B): tovholderen beder, alle siger ja
  const asked = B.reopen.length > 0, yes = new Set(B.reopen.map(c => c.heir_id)), reason = (B.reopen.find(c => c.note) || {}).note;
  let reopen = '';
  if (B.status !== 'afsluttet') {
    if (asked) reopen = `<div class="card rest" style="margin-top:22px;border-color:var(--ochre)"><h2 style="margin:0">Ny runde?</h2><p class="soft" style="margin:0">Tovholderen har bedt om en ny runde${reason ? ': "' + esc(reason) + '"' : ''}. Når alle har sagt ja, falder underskrifterne, og alle kan rette deres ønsker.</p>
      <div class="row">${B.heirs.map(h => `<span class="chip ${yes.has(h.id) ? 'good' : ''}">${esc(h.name)}${yes.has(h.id) ? ' · ja' : ''}</span>`).join('')}</div>
      ${me && !yes.has(me.id) ? `<div class="row"><button class="btn go" type="button" id="reopenYes">Ja til en ny runde</button></div>` : ''}</div>`;
    else if (B.isTov) reopen = `<details class="why" style="margin-top:22px"><summary>Skal der deles igen?</summary><p class="soft" style="margin:8px 0">Hvis en ting mangler, eller nogen vil rette sine ønsker, kan du bede om en ny runde. Alle skal sige ja. Underskrifterne falder, og der deles igen med samme lod.</p><form class="row" id="reopenForm"><input id="reopenReason" required maxlength="300" placeholder="Hvorfor? Fx 'Vi glemte stuebordet'" style="flex:1;min-width:220px"><button class="btn sm" type="submit">Bed om ny runde</button></form></details>`;
  }

  return `${head}<h1>Sådan bliver det delt</h1><p class="lead">${bid ? 'Hver ting gik til den, der bød højest.' : 'Fordelingen giver den største samlede tilfredshed' + (zero.length ? '.' : ', uden at nogen bliver overset.')} <span class="soft">Version ${B.run.version}.</span></p>
  <div class="boxes" id="boxes">${boxes}</div>${checks}${settle}${restBox}${reopen}
  <div class="row" style="margin-top:24px"><a class="btn go" href="/bo/${B.id}/underskrift">${me && !signedBy(B, me.id) ? T(B, 'Videre til underskrift', 'Videre til godkendelse') : 'Se fordelingslisten'}</a><button class="btn" type="button" id="again">Vis fordelingen igen</button></div>`;
}

function why(B) {
  const ex = B.explanation, me = B.myHeir; if (!ex) return '';
  if (!ex.wishes?.length) return `<p class="soft" style="margin:8px 0 0">Du ønskede ikke noget af tingene.</p>`;
  return '<ul>' + ex.wishes.map(w => `<li>${esc(w.name)}: du gav ${w.mine} p${w.got ? ' – <b>fik den</b>' : w.winner ? ' – gik til ' + esc(w.winner) + ', som gav ' + (w.winnerGave ?? 0) + ' p' : ' – ingen fik den'}${w.lod ? ' <span class="soft">(lodtrækning)</span>' : ''}</li>`).join('') + `</ul><p class="soft" style="margin:8px 0 0">Fordelingen ser på alle ønsker samlet, så alle får mest muligt af det, der betyder mest for dem.</p>`;
}
function whyBids(B) {
  const ex = B.explanation; if (!ex?.wishes?.length) return `<p class="soft" style="margin:8px 0 0">Du bød ikke på noget.</p>`;
  return '<ul>' + ex.wishes.map(w => `<li>${esc(w.name)}: du bød ${kr(w.mine)}${w.got ? ' – <b>fik den</b>' : w.winner ? ' – gik til ' + esc(w.winner) + ' for ' + kr(w.winnerGave ?? 0) : ''}${w.lod ? ' <span class="soft">(lodtrækning)</span>' : ''}</li>`).join('') + '</ul>';
}

export function after(ctx) {
  if (!revealed(ctx.B)) return;
  const bars = () => document.querySelectorAll('.bar2 span').forEach(s => s.style.width = s.dataset.w + '%');
  if (!animate) { bars(); return; }
  animate = false;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { bars(); return; }
  const items = [...document.querySelectorAll('[data-fly]')], box = $('#boxes')?.getBoundingClientRect(); if (!box) { bars(); return; }
  const cx = box.left + box.width / 2, cy = box.top - 60;
  items.forEach((el, k) => { const r = el.getBoundingClientRect(); el.style.transition = 'none'; el.style.opacity = '0'; el.style.transform = `translate(${cx - (r.left + r.width / 2)}px,${cy - (r.top + r.height / 2)}px) rotate(${(k % 5 - 2) * 8}deg) scale(.7)`; });
  requestAnimationFrame(() => requestAnimationFrame(() => { items.forEach((el, k) => { el.style.transition = `transform .7s cubic-bezier(.2,.9,.25,1.15) ${Math.min(k, 40) * 90}ms, opacity .3s ${Math.min(k, 40) * 90}ms`; el.style.opacity = '1'; el.style.transform = 'none'; }); setTimeout(bars, Math.min(items.length, 40) * 90 + 500); }));
}

export async function click(e, ctx) {
  const B = ctx.B, b = e.target.closest('button'); if (!b) return;
  if (b.id === 'refresh') { await ctx.reload(); return; }
  if (b.id === 'reveal') {
    try {
      await busy(b, (async () => { await rpc('start_distribution', { p_estate: B.id }); await fn('run-distribution', { estate_id: B.id }); })(), 'Deler …');
      animate = true; await ctx.reload();
    } catch (err) { toast(msg(err), true); await ctx.reload(); }
    return;
  }
  if (b.id === 'again') { animate = true; ctx.render(); return; }
  if (b.id === 'reopenYes') { await busy(b, rpc('consent_reopen', { p_estate: B.id }), 'Gemmer …'); await ctx.reload(); toast(ctx.B.status === 'aaben' ? 'Alle har sagt ja. Boet er åbent igen.' : 'Dit ja er registreret.'); return; }
}
export async function change(e, ctx) {
  const d = e.target.dataset; if (!d.rest) return;
  must(await sb.from('items').update({ rest_decision: e.target.value || null }).eq('id', d.rest)); const it = itemById(ctx.B, d.rest); if (it) it.rest_decision = e.target.value || null; toast('Gemt');
}
export async function submit(e, ctx) {
  const B = ctx.B; if (e.target.id !== 'reopenForm') return;
  await busy(e.target.querySelector('button'), rpc('request_reopen', { p_estate: B.id, p_reason: $('#reopenReason').value.trim() }), 'Sender …');
  await ctx.reload(); toast(ctx.B.status === 'aaben' ? 'Boet er åbent igen.' : 'Alle arvinger har fået besked og skal sige ja.');
}
