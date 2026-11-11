// Efter engangskoden er bekræftet (Supabase Auth OTP) kobler vi brugeren til arvingen.
// Kræver både et gyldigt token OG at den indloggede brugers telefon/mail er den, invitationen blev sendt til.
import { preflight, json, fail, currentUser, serviceClient, sha256, allow, clientIp } from '../_shared/common.ts';

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return fail('Brug POST', 405);
  const user = await currentUser(req); if (!user) return fail('Ikke logget ind', 401);
  if (!(await allow(`link:${clientIp(req)}`, 20, 600))) return fail('For mange forsøg', 429);
  const { token } = await req.json().catch(() => ({}));
  if (typeof token !== 'string') return fail('Linket er ikke gyldigt');
  const s = serviceClient();
  const { data: inv } = await s.from('invitations').select('id, heir_id, estate_id, channel, sent_to, expires_at, used_at, revoked_at')
    .eq('token_hash', await sha256(token)).maybeSingle();
  if (!inv || inv.revoked_at || new Date(inv.expires_at) < new Date()) return fail('Linket er ikke gyldigt længere', 410);
  const mine = inv.channel === 'sms' ? (user.phone ? '+' + user.phone.replace(/^\+/, '') : '') : (user.email ?? '');
  if (!mine || mine.toLowerCase() !== String(inv.sent_to).toLowerCase()) return fail('Koden blev bekræftet på et andet nummer end det, invitationen blev sendt til', 403);
  const { data: heir } = await s.from('heirs').select('id, user_id, estate_id').eq('id', inv.heir_id).single();
  if (!heir) return fail('Arvingen findes ikke', 404);
  if (heir.user_id && heir.user_id !== user.id) return fail('En anden bruger er allerede koblet til denne arving. Kontakt tovholderen.', 409);
  if (!heir.user_id) {
    const { error } = await s.from('heirs').update({ user_id: user.id }).eq('id', heir.id);
    if (error) return fail('Kunne ikke koble brugeren: ' + error.message, 500);
    await s.from('estate_members').upsert({ estate_id: heir.estate_id, user_id: user.id, role: 'arving', heir_id: heir.id }, { onConflict: 'estate_id,user_id' });
  }
  if (!inv.used_at) await s.from('invitations').update({ used_at: new Date().toISOString() }).eq('id', inv.id);
  return json({ ok: true, estate_id: heir.estate_id, heir_id: heir.id });
});
