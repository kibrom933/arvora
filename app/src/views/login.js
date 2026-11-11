// Login med engangskode på mail eller SMS. Ingen adgangskoder.
import { sb } from '../supabase.js';
import { normPhone, isEmail } from '../api.js';
import { $, esc, toast, busy } from '../ui.js';

let sent = null; // { kind: 'email'|'phone', to }

export function view(ctx) {
  const next = new URLSearchParams(location.search).get('next') || '/';
  if (ctx.user) return `<h1>Du er logget ind</h1><p class="lead"><a class="btn go" href="${esc(next)}">Fortsæt</a></p>`;
  if (sent) return `<div class="eyebrow">log ind</div><h1>Skriv koden</h1>
    <p class="lead">Vi har sendt en kode på 6 cifre til <b>${esc(sent.to)}</b>. Den gælder i 10 minutter.</p>
    <form class="card lock" id="codeForm"><label class="f" for="code">Kode</label><input id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="······" style="font-size:22px;text-align:center;letter-spacing:.3em;max-width:220px" autofocus>
    <div class="row"><button class="btn go" type="submit">Log ind</button><button class="btn" type="button" id="again">Send en ny kode</button></div>
    <p class="soft" id="codeMsg" aria-live="polite" style="margin:0"></p></form>`;
  return `<div class="eyebrow">log ind</div><h1>Hvem er du?</h1>
    <p class="lead">Skriv din mail eller dit mobilnummer. Du får en kode med det samme og skal ikke oprette en konto.</p>
    <form class="card lock" id="loginForm"><label class="f" for="who">Mail eller mobilnummer</label><input id="who" autocomplete="email" inputmode="email" placeholder="Fx mette@mail.dk eller 20 30 40 50" required>
    <label class="row" style="font-weight:400;font-size:13.5px;color:var(--soft)"><input type="checkbox" id="ok" required style="width:auto"> Jeg har læst <a href="/vilkaar">vilkårene</a> og <a href="/privatliv">privatlivspolitikken</a>.</label>
    <button class="btn go" type="submit">Send mig en kode</button><p class="soft" id="loginMsg" aria-live="polite" style="margin:0"></p></form>
    <p class="soft" style="margin-top:24px;font-size:13.5px">Er du arving og har fået et link på SMS? Åbn linket; så går det af sig selv.</p>`;
}

export async function submit(e, ctx) {
  const f = e.target;
  if (f.id === 'loginForm') {
    const raw = $('#who').value.trim(); const btn = f.querySelector('button[type=submit]');
    const email = isEmail(raw) ? raw.toLowerCase() : null, phone = email ? null : normPhone(raw);
    if (!email && !phone) { $('#loginMsg').textContent = 'Skriv en mailadresse eller et mobilnummer med 8 cifre.'; return; }
    const { error } = await busy(btn, email ? sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }) : sb.auth.signInWithOtp({ phone, options: { shouldCreateUser: true } }), 'Sender …');
    if (error) { $('#loginMsg').textContent = error.message.includes('rate') ? 'Der er sendt for mange koder. Vent lidt.' : 'Koden kunne ikke sendes. ' + (phone ? 'Prøv med din mail i stedet.' : 'Tjek adressen.'); return; }
    sent = { kind: email ? 'email' : 'phone', to: email || phone }; ctx.render();
  }
  if (f.id === 'codeForm') {
    const token = $('#code').value.replace(/\D/g, ''); const btn = f.querySelector('button[type=submit]');
    if (token.length < 6) { $('#codeMsg').textContent = 'Koden har 6 cifre.'; return; }
    const { error } = await busy(btn, sent.kind === 'email' ? sb.auth.verifyOtp({ email: sent.to, token, type: 'email' }) : sb.auth.verifyOtp({ phone: sent.to, token, type: 'sms' }), 'Tjekker …');
    if (error) { $('#codeMsg').textContent = 'Koden passer ikke, eller den er udløbet.'; return; }
    sent = null; const next = new URLSearchParams(location.search).get('next') || '/';
    toast('Du er logget ind'); ctx.nav(next, true);
  }
}
export async function click(e, ctx) {
  if (e.target.closest('#again')) { sent = null; ctx.render(); }
}
