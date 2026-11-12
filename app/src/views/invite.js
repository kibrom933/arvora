// Arvingen åbner sit link: /i/<token>. Uden login spørger vi serveren, hvem linket er til, og koden sendes
// til den telefon eller mail, invitationen gik til. Efter koden kobles brugeren til arvingen (link-invite).
import { sb } from '../supabase.js';
import { fn } from '../api.js';
import { $, esc, toast, busy, msg } from '../ui.js';
import { verifyEmail } from './login.js';

let st = { token: null, info: null, error: null, step: 'start' };

export async function view(ctx) {
  const token = ctx.params.token;
  if (st.token !== token) st = { token, info: null, error: null, step: 'start' };
  // Allerede logget ind: prøv at koble direkte (brugeren kan have logget ind på det rigtige nummer før).
  if (ctx.user && st.step === 'start') {
    try { const r = await fn('link-invite', { token }); toast('Du er med i boet'); ctx.nav('/bo/' + r.estate_id + '/oensker', true); return ''; }
    catch (e) { if (e.status !== 403) { st.error = msg(e); } }
  }
  if (!st.info && !st.error) {
    try { st.info = await fn('accept-invite', { token }, { anon: true }); st.step = 'code'; }
    catch (e) { st.error = msg(e); }
  }
  if (st.error) return `<h1>Linket virker ikke</h1><p class="lead">${esc(st.error)}</p><p class="soft">Bed tovholderen sende et nyt link. Er du allerede logget ind som en anden, så <a href="/" id="outFirst">log ud først</a>.</p>`;
  const i = st.info;
  return `<div class="eyebrow">${i.mode === 'live' ? 'mens de lever' : 'boet efter'}</div><h1>Hej ${esc(i.heir)}</h1>
  <p class="lead">Du er inviteret til at dele ${esc(i.estate)}s ting på Arvora. Dine ønsker er hemmelige, og ingen kan se dem, før alle har svaret.</p>
  <form class="card lock" id="inviteCode"><h2 style="margin:0">Skriv koden fra ${i.channel === 'sms' ? 'SMS\'en' : 'mailen'}</h2>
    <p class="soft" style="margin:0">Vi har sendt en kode på 6 cifre til ${esc(i.masked)}. Det sikrer, at kun du kan afgive ${esc(i.heir)}s ønsker.</p>
    <label class="f" for="icode">Kode</label><input id="icode" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="······" style="font-size:22px;text-align:center;letter-spacing:.3em;max-width:220px">
    <label class="row" style="font-weight:400;font-size:13.5px;color:var(--soft)"><input type="checkbox" id="iok" required style="width:auto"> Jeg har læst <a href="/vilkaar">vilkårene</a> og <a href="/privatliv">privatlivspolitikken</a>.</label>
    <div class="row"><button class="btn go" type="submit">Fortsæt</button><button class="btn" type="button" id="iagain">Send koden igen</button></div>
    <p class="soft" id="iMsg" aria-live="polite" style="margin:0"></p></form>
  <p class="soft" style="font-size:13.5px;margin-top:20px">Det tager ca. 15 minutter. Du skal ikke oprette en konto.</p>`;
}

export async function submit(e, ctx) {
  if (e.target.id !== 'inviteCode') return;
  const i = st.info, token = $('#icode').value.replace(/\D/g, ''), btn = e.target.querySelector('button[type=submit]');
  if (token.length < 6) { $('#iMsg').textContent = 'Koden har 6 cifre.'; return; }
  const { error } = await busy(btn, i.channel === 'sms' ? sb.auth.verifyOtp({ phone: i.send_to, token, type: 'sms' }) : verifyEmail(i.send_to, token), 'Tjekker …');
  if (error) { $('#iMsg').textContent = 'Koden passer ikke, eller den er udløbet.'; return; }
  try {
    const r = await busy(btn, fn('link-invite', { token: st.token }), 'Kobler …');
    st = { token: null }; toast('Du er med i boet'); ctx.nav('/bo/' + r.estate_id + '/oensker', true);
  } catch (err) { $('#iMsg').textContent = msg(err); }
}
export async function click(e, ctx) {
  if (e.target.closest('#iagain')) { st.info = null; st.error = null; st.step = 'code'; ctx.render(); }
  if (e.target.closest('#outFirst')) { e.preventDefault(); await sb.auth.signOut(); st = { token: null }; ctx.render(); }
}
