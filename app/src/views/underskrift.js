// Underskrift: hver arving bekræfter med en kode fra SMS eller mail. Fordelingslisten kan hentes som PDF eller kopieres.
import { fn, pdfBlob } from '../api.js';
import { revealed, allSigned, signedBy, T, itemById, freeItems } from '../bo.js';
import { $, esc, lot, kr, toast, busy, av, msg, datoKort } from '../ui.js';

let otp = null; // { runId, masked, channel } når koden er sendt til mig

export function view(ctx) {
  const B = ctx.B, me = B.myHeir, head = `<div class="eyebrow">trin 5 af 5</div>`;
  if (!revealed(B)) return `${head}<h1>Intet at ${T(B, 'underskrive', 'godkende')} endnu</h1><p class="lead">Når fordelingen er vist, ${T(B, 'underskriver', 'godkender')} alle her.</p><a class="btn go" href="/bo/${B.id}/fordeling">Gå til fordelingen</a>`;
  const R = B.run.result, bid = R.method === 'kroner', names = {}; (R.heirs || []).forEach(h => names[h.id] = h.name);
  const mine = me ? signedBy(B, me.id) : null;
  const rows = B.heirs.map(h => { const s = signedBy(B, h.id); const isMe = me && h.id === me.id;
    return `<div class="card sig">${av(B.heirs, h)}<div><div class="line">${s ? esc(s.signed_name) : ''}</div>${s ? `<small class="soft">${datoKort(s.created_at)} · bekræftet med kode på ${s.method === 'otp_email' ? 'mail' : 'SMS'}</small>` : ''}</div>
    ${s ? '' : isMe ? (otp && otp.runId === B.run.id ? `<form data-verify="1"><label class="f" style="position:absolute;left:-9999px" for="sgname">Navn</label><input id="sgname" placeholder="${esc(h.name)}" autocomplete="name" maxlength="80"><label class="f" style="position:absolute;left:-9999px" for="sgcode">Kode</label><input class="pin" id="sgcode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="Kode"><button class="btn go sm" type="submit">${T(B, 'Underskriv', 'Godkend')}</button><small class="soft">Koden er sendt til ${esc(otp.masked)}. Den gælder i 10 minutter. <button type="button" class="btn sm" data-otp="again" style="padding:2px 8px">Send igen</button></small></form>`
      : `<form data-request="1"><small class="soft" style="grid-column:1/-1">Du får en kode på ${h.phone ? 'SMS' : 'mail'}, så ingen kan skrive under for dig.</small><button class="btn go sm" type="submit" style="grid-column:1/-1;justify-self:start">Send mig en kode</button></form>`)
      : `<small class="soft">${B.isTov && !isMe ? 'Mangler' : 'Har ikke skrevet under endnu'}</small>`}</div>`; }).join('');
  const doc = `<div class="doc">${allSigned(B) ? '<div class="stamp">Alle enige</div>' : ''}<div class="eyebrow">Fordelingsliste</div><h3>${T(B, 'Boet efter', 'Ønskeliste for')} ${esc(B.name)}</h3><div class="soft">${bid ? 'Kronemetoden' : 'Pointmetoden'} · version ${B.run.version} · ${B.items.length} ting · ${B.heirs.length} ${T(B, 'arvinger', 'børn')}</div>
    ${B.heirs.map(h => { const info = (R.heirs || []).find(x => x.id === h.id) || {}; const list = R.out?.[h.id] || [];
      return `<div class="who">${esc(h.name)}${info.proxy ? ' <span class="soft" style="font-weight:400">(ønsker afgivet af tovholderen efter aftale)</span>' : ''}</div><ul>${list.map(x => { const it = itemById(B, x.itemId); return it ? `<li>${lot(it)} ${esc(it.name)}${x.will ? ' (testamente)' : ''}${bid && !x.will ? ' · ' + kr(x.price || 0) : ''}${x.lod ? ' (lod)' : ''}</li>` : ''; }).join('') || `<li class="soft">${info.no_wish ? 'Ønskede ikke noget' : 'Ingen ting'}</li>`}</ul>`; }).join('')}
    ${bid && R.settle ? `<div class="who">Udligning i arven</div><ul>${R.settle.map(s => `<li>${esc(names[s.heirId])}: ${s.diff > 0.5 ? 'får ' + kr(s.diff) + ' mindre' : s.diff < -0.5 ? 'får ' + kr(-s.diff) + ' mere' : 'lige op'}</li>`).join('')}</ul>` : ''}
    ${R.rest?.length ? `<div class="who">Til salg, genbrug eller rydning</div><ul>${R.rest.map(id => { const it = itemById(B, id); return it ? `<li>${lot(it)} ${esc(it.name)}</li>` : ''; }).join('')}</ul>` : ''}
    ${B.ties.length ? `<div class="who">Afgjort ved lodtrækning</div><ul>${B.ties.map(t => `<li>${esc(t.note)}</li>`).join('')}</ul>` : ''}
    <div class="who">${T(B, 'Underskrevet', 'Godkendt')}</div><ul>${B.heirs.map(h => { const s = signedBy(B, h.id); return `<li>${esc(h.name)}: ${s ? esc(s.signed_name) + ', ' + datoKort(s.created_at) : '<span class="soft">mangler</span>'}</li>`; }).join('')}</ul></div>`;
  return `${head}<h1>${allSigned(B) ? 'Alle er enige' : 'Er I enige?'}</h1>
  <p class="lead">Fordelingen gælder først, når alle har ${T(B, 'underskrevet', 'godkendt')}. Hver især bekræfter med en kode fra sin egen telefon eller mail, så ingen kan skrive under for en anden. Er I ikke enige, kan tovholderen bede om en ny runde under Fordeling.${T(B, '', ' Listen kan bruges som grundlag for et indbotestamente hos en advokat.')}</p>
  <div class="sign"><div style="display:grid;gap:12px">${rows}
   <div class="row"><button class="btn go" type="button" id="pdf">Hent som PDF</button><button class="btn" type="button" id="copy">Kopiér fordelingslisten</button><span class="soft" id="copied" aria-live="polite"></span></div>
   <p class="soft" style="font-size:13px">${T(B, 'Indboets værdi skal stadig med i boopgørelsen. ', '')}Godkendelsen med kode er en elektronisk godkendelse, ikke en kvalificeret elektronisk signatur. Arvora er en hjælp til at blive enige og ikke juridisk rådgivning.</p></div>
  ${doc}</div>`;
}

function listText(B) {
  const R = B.run.result, bid = R.method === 'kroner', names = {}; (R.heirs || []).forEach(h => names[h.id] = h.name);
  let t = `${T(B, 'FORDELINGSLISTE – boet efter', 'ØNSKELISTE for')} ${B.name}\n${bid ? 'Kronemetoden' : 'Pointmetoden'} · version ${B.run.version}\n${T(B, 'Underskrevet', 'Godkendt')} af: ${B.heirs.map(h => { const s = signedBy(B, h.id); return s ? s.signed_name : '(' + h.name + ' mangler)'; }).join(', ')}\n\n`;
  B.heirs.forEach(h => { t += h.name + '\n'; (R.out?.[h.id] || []).forEach(x => { const it = itemById(B, x.itemId); if (it) t += `  ${lot(it)}  ${it.name}${x.will ? '  [testamente]' : ''}${bid && !x.will ? '  ' + kr(x.price || 0) : ''}\n`; }); if (!(R.out?.[h.id] || []).length) t += '  (ingen ting)\n'; t += '\n'; });
  if (bid && R.settle) { t += 'Udligning:\n'; R.settle.forEach(s => t += `  ${names[s.heirId]}: ${s.diff > 0.5 ? 'får ' + kr(s.diff) + ' mindre' : s.diff < -0.5 ? 'får ' + kr(-s.diff) + ' mere' : 'lige op'}\n`); }
  if (R.rest?.length) { t += '\nTil salg, genbrug eller rydning:\n'; R.rest.forEach(id => { const it = itemById(B, id); if (it) t += `  ${lot(it)}  ${it.name}\n`; }); }
  if (B.ties.length) { t += '\nAfgjort ved lodtrækning:\n'; B.ties.forEach(x => t += `  ${x.note}\n`); }
  return t;
}

export async function submit(e, ctx) {
  const B = ctx.B, f = e.target;
  if (f.dataset.request) {
    const r = await busy(f.querySelector('button'), fn('sign', { run_id: B.run.id, step: 'request' }), 'Sender …');
    otp = { runId: B.run.id, masked: r.sent_to_masked, channel: r.channel }; ctx.render(); toast('Koden er sendt');
  }
  if (f.dataset.verify) {
    const code = $('#sgcode').value.replace(/\D/g, ''); if (code.length < 6) { toast('Koden har 6 cifre.'); return; }
    await busy(f.querySelector('button[type=submit]'), fn('sign', { run_id: B.run.id, step: 'verify', code, signed_name: $('#sgname').value.trim() || B.myHeir.name }), 'Tjekker …');
    otp = null; await ctx.reload(); toast(allSigned(ctx.B) ? 'Alle har underskrevet. Fordelingen gælder.' : 'Din underskrift er gemt.');
  }
}
export async function click(e, ctx) {
  const B = ctx.B, b = e.target.closest('button'); if (!b) return;
  if (b.dataset.otp === 'again') { otp = null; ctx.render(); return; }
  if (b.id === 'pdf') {
    try { const blob = await busy(b, pdfBlob(B.run.id), 'Laver PDF …'); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'fordelingsliste-' + B.name.toLowerCase().replace(/[^a-z0-9æøå]+/g, '-') + '.pdf'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); }
    catch (err) { toast(msg(err) + ' Brug Kopiér i stedet.', true); }
    return;
  }
  if (b.id === 'copy') {
    const t = listText(B); const ok = () => $('#copied').textContent = 'Kopieret';
    const manual = () => { $('#copied').textContent = 'Kopiér selv teksten herunder'; let ta = $('#copyText'); if (!ta) { ta = document.createElement('textarea'); ta.id = 'copyText'; ta.readOnly = true; ta.rows = 10; ta.className = 'copytext'; ta.setAttribute('aria-label', 'Fordelingslisten som tekst'); b.closest('.row').after(ta); } ta.value = t; ta.focus(); ta.select(); };
    try { navigator.clipboard.writeText(t).then(ok, manual); } catch { manual(); }
  }
}
