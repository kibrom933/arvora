// Login med engangskode på mail eller SMS. Ingen adgangskoder.
import { sb } from '../supabase.js';
import { normPhone, isEmail, fn } from '../api.js';
import { $, esc, toast, busy } from '../ui.js';

let sent = null; // { kind: 'email'|'phone', to }

export function view(ctx) {
  const next = new URLSearchParams(location.search).get('next') || '/';
  if (ctx.user) return `<h1>Du er logget ind</h1><p class="lead"><a class="btn go" href="${esc(next)}">Fortsæt</a></p>`;
  if (sent) return `<div class="eyebrow">log ind</div><h1>Skriv koden</h1>
    <p class="lead">Vi har sendt en kode til <b>${esc(sent.to)}</b>. Tjek også spam, hvis den ikke kommer.</p>
    <form class="card lock" id="codeForm"><label class="f" for="code">Kode</label><input id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="Kode" style="font-size:22px;text-align:center;letter-spacing:.3em;max-width:220px" autofocus>
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
    let error = null;
    if (email) { try { await busy(btn, fn('login-code', { email }, { anon: true }), 'Sender …'); } catch (e) { error = e; } }
    else ({ error } = await busy(btn, sb.auth.signInWithOtp({ phone, options: { shouldCreateUser: true } }), 'Sender …'));
    if (error) { $('#loginMsg').textContent = /mange|rate/i.test(error.message) ? 'Der er sendt for mange koder. Vent lidt.' : phone ? 'Login med mobil er ikke slået til endnu. Brug din mail.' : 'Koden kunne ikke sendes. Tjek adressen, og prøv igen.'; return; }
    sent = { kind: email ? 'email' : 'phone', to: email || phone }; ctx.render();
  }
  if (f.id === 'codeForm') {
    const token = $('#code').value.replace(/\D/g, ''); const btn = f.querySelector('button[type=submit]');
    if (token.length < 6) { $('#codeMsg').textContent = 'Skriv hele koden fra beskeden.'; return; }
    const { error } = await busy(btn, sent.kind === 'email' ? verifyEmail(sent.to, token) : sb.auth.verifyOtp({ phone: sent.to, token, type: 'sms' }), 'Tjekker …');
    if (error) { $('#codeMsg').textContent = 'Koden passer ikke, eller den er udløbet.'; return; }
    sent = null; const next = new URLSearchParams(location.search).get('next') || '/';
    toast('Du er logget ind'); ctx.nav(next, true);
  }
}
export async function click(e, ctx) {
  if (e.target.closest('#again')) { sent = null; ctx.render(); }
}

/** Koden fra vores egen mail er en "magiclink"-kode; nyere Supabase tager den som type 'email', ældre som 'magiclink'. */
export async function verifyEmail(email, token) {
  const a = await sb.auth.verifyOtp({ email, token, type: 'email' });
  if (!a.error) return a;
  const b = await sb.auth.verifyOtp({ email, token, type: 'magiclink' });
  return b.error ? a : b;
}
