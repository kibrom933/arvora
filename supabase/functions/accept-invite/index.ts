// Arvingen åbner sit link. Uden login: token slås op (hash), og vi fortæller kun, hvem linket er til,
// og hvortil engangskoden sendes. Selve adgangen gives først i link-invite, når koden er bekræftet.
import { preflight, json, fail, serviceClient, sha256, allow, clientIp, maskPhone, maskEmail, sendLoginCode } from '../_shared/common.ts';

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return fail('Brug POST', 405);
  if (!(await allow(`accept:${clientIp(req)}`, 20, 600))) return fail('For mange forsøg. Vent lidt, og prøv igen.', 429);
  const { token } = await req.json().catch(() => ({}));
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return fail('Linket er ikke gyldigt');
  const s = serviceClient();
  const { data: inv } = await s.from('invitations').select('id, heir_id, estate_id, channel, sent_to, expires_at, used_at, revoked_at, attempts')
    .eq('token_hash', await sha256(token)).maybeSingle();
  if (!inv) return fail('Linket findes ikke. Bed tovholderen sende et nyt.', 404);
  await s.from('invitations').update({ attempts: inv.attempts + 1 }).eq('id', inv.id);
  if (inv.revoked_at) return fail('Linket er trukket tilbage. Bed tovholderen sende et nyt.', 410);
  if (new Date(inv.expires_at) < new Date()) return fail('Linket er udløbet. Bed tovholderen sende et nyt.', 410);
  const { data: heir } = await s.from('heirs').select('name, user_id').eq('id', inv.heir_id).single();
  const { data: estate } = await s.from('estates').select('name, mode, status').eq('id', inv.estate_id).single();
  if (!heir || !estate) return fail('Boet findes ikke længere', 404);
  // Engangskoden sendes herfra (Supabase Auth), så klienten ikke selv kan bede om koder til vilkårlige numre.
  if (!(await allow(`otp:${inv.heir_id}`, 5, 900))) return fail('Der er sendt for mange koder. Vent 15 minutter.', 429);
  try {
    if (inv.channel === 'sms') { const { error } = await s.auth.signInWithOtp({ phone: inv.sent_to, options: { shouldCreateUser: true } }); if (error) throw error; }
    else await sendLoginCode(inv.sent_to);
  } catch (e) { console.error('otp', (e as Error).message); return fail('Koden kunne ikke sendes. Prøv igen om lidt.', 502); }
  // Adressen returneres kun til den, der har det hemmelige link (som blev sendt til samme adresse); klienten skal bruge den til verifyOtp.
  return json({
    heir: heir.name, estate: estate.name, mode: estate.mode, channel: inv.channel, send_to: inv.sent_to,
    masked: inv.channel === 'sms' ? maskPhone(inv.sent_to) : maskEmail(inv.sent_to),
    already_linked: !!heir.user_id, used: !!inv.used_at,
  });
});
