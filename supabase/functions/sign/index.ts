// Underskrift i to trin. 1) "request": en 6-cifret engangskode sendes til arvingens telefon/mail.
// 2) "verify": koden tjekkes (højst 5 forsøg, 10 minutter), et underskrift_otp-samtykke oprettes, og sign_run
// kaldes som brugeren selv, så underskriften bindes til run-version og dokument-hash.
import { preflight, json, fail, currentUser, userClient, serviceClient, sha256, allow, clientIp } from '../_shared/common.ts';

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return fail('Brug POST', 405);
  const user = await currentUser(req); if (!user) return fail('Ikke logget ind', 401);
  const body = await req.json().catch(() => ({}));
  const runId = String(body.run_id ?? ''); if (!runId) return fail('run_id mangler');
  const s = serviceClient();
  const { data: run } = await s.from('distribution_runs').select('id, estate_id, released_at, superseded_at, result').eq('id', runId).maybeSingle();
  if (!run || !run.released_at || run.superseded_at) return fail('Fordelingen kan ikke underskrives', 409);
  const { data: heir } = await s.from('heirs').select('id, name, phone, email').eq('estate_id', run.estate_id).eq('user_id', user.id).maybeSingle();
  if (!heir) return fail('Du er ikke arving i boet', 403);
  const channel = heir.phone ? 'sms' : heir.email ? 'email' : null;
  if (!channel) return fail('Der er hverken telefon eller mail at sende koden til');

  if (body.step === 'request') {
    if (!(await allow(`sign-req:${heir.id}`, 5, 600))) return fail('Der er sendt for mange koder. Vent 10 minutter.', 429);
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
    await s.from('otp_codes').delete().eq('heir_id', heir.id).eq('run_id', runId);
    await s.from('otp_codes').insert({ heir_id: heir.id, run_id: runId, code_hash: await sha256(`${runId}:${heir.id}:${code}`), expires_at: new Date(Date.now() + 10 * 60e3).toISOString() });
    await s.from('notifications').insert({ estate_id: run.estate_id, heir_id: heir.id, channel, kind: 'underskrift_kode', to_address: heir.phone ?? heir.email, payload: { code, name: heir.name } });
    return json({ ok: true, channel, sent_to_masked: channel === 'sms' ? heir.phone.slice(0, 3) + '••••' + heir.phone.slice(-2) : heir.email.replace(/^(.).*@/, '$1•••@') });
  }
  if (body.step === 'verify') {
    if (!(await allow(`sign-verify:${heir.id}:${clientIp(req)}`, 10, 600))) return fail('For mange forsøg', 429);
    const code = String(body.code ?? '').replace(/\D/g, '');
    const { data: otp } = await s.from('otp_codes').select('id, code_hash, expires_at, attempts').eq('heir_id', heir.id).eq('run_id', runId).maybeSingle();
    if (!otp || new Date(otp.expires_at) < new Date()) return fail('Koden er udløbet. Bed om en ny.', 410);
    if (otp.attempts >= 5) { await s.from('otp_codes').delete().eq('id', otp.id); return fail('For mange forkerte forsøg. Bed om en ny kode.', 429); }
    if (otp.code_hash !== await sha256(`${runId}:${heir.id}:${code}`)) { await s.from('otp_codes').update({ attempts: otp.attempts + 1 }).eq('id', otp.id); return fail('Koden passer ikke', 400); }
    await s.from('otp_codes').delete().eq('id', otp.id);
    await s.from('consent_records').insert({ estate_id: run.estate_id, heir_id: heir.id, user_id: user.id, kind: 'underskrift_otp', run_id: runId, channel });
    const documentHash = run.result?.document_hash ?? await sha256(JSON.stringify(run.result));
    const { error } = await userClient(req).rpc('sign_run', { p_run: runId, p_signed_name: String(body.signed_name ?? heir.name).slice(0, 80), p_document_hash: documentHash, p_user_agent: req.headers.get('user-agent') ?? '' });
    if (error) return fail(error.message, 400);
    return json({ ok: true, document_hash: documentHash });
  }
  return fail('step skal være request eller verify');
});
