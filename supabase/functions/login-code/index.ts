// Sender en login-kode på mail. Kaldes uden login (verify_jwt = false). Begrænset pr. IP og pr. adresse.
import { preflight, json, fail, allow, clientIp, sendLoginCode } from '../_shared/common.ts';

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return fail('Brug POST', 405);
  const { email } = await req.json().catch(() => ({}));
  const e = String(email ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || e.length > 200) return fail('Skriv en gyldig mailadresse');
  if (!(await allow(`login:${clientIp(req)}`, 10, 600))) return fail('For mange forsøg. Vent lidt, og prøv igen.', 429);
  if (!(await allow(`login:${e}`, 5, 900))) return fail('Der er sendt for mange koder. Vent 15 minutter.', 429);
  try { await sendLoginCode(e); } catch (err) { console.error('login-code', (err as Error).message); return fail('Koden kunne ikke sendes. Prøv igen om lidt.', 502); }
  return json({ ok: true });
});
