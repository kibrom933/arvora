// Tovholderen sender (eller gensender) et personligt engangslink til en arving.
// Linket indeholder et tilfældigt token; kun hash gemmes. Udløber efter 14 dage. Kan tilbagekaldes.
import { preflight, json, fail, currentUser, userClient, serviceClient, sha256, randomToken, allow, appUrl, kickHousekeeping } from '../_shared/common.ts';

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return fail('Brug POST', 405);
  const user = await currentUser(req); if (!user) return fail('Ikke logget ind', 401);
  const body = await req.json().catch(() => ({}));
  const heirId = String(body.heir_id ?? ''); const channel = body.channel === 'email' ? 'email' : 'sms';
  if (!heirId) return fail('heir_id mangler');

  // Må brugeren det? Tovholder i arvingens bo. Tjekkes gennem RLS (userClient ser kun egne boer).
  const u = userClient(req);
  const { data: heir } = await u.from('heirs').select('id, estate_id, name, phone, email, user_id').eq('id', heirId).maybeSingle();
  if (!heir) return fail('Arvingen findes ikke', 404);
  const { data: member } = await u.from('estate_members').select('role').eq('estate_id', heir.estate_id).eq('user_id', user.id).maybeSingle();
  if (member?.role !== 'tovholder') return fail('Kun tovholderen kan invitere', 403);
  const to = channel === 'sms' ? heir.phone : heir.email;
  if (!to) return fail(channel === 'sms' ? 'Arvingen har intet telefonnummer' : 'Arvingen har ingen mailadresse');
  if (!(await allow(`invite:${heir.estate_id}`, 60, 3600))) return fail('For mange invitationer på én time. Prøv igen senere.', 429);

  const s = serviceClient();
  const { data: estate } = await s.from('estates').select('name, status, mode').eq('id', heir.estate_id).single();
  if (!estate || !['kladde', 'aaben'].includes(estate.status)) return fail('Boet er ikke åbent for invitationer');
  // Gamle, ubrugte invitationer til samme arving tilbagekaldes, så der kun er ét gyldigt link ad gangen.
  await s.from('invitations').update({ revoked_at: new Date().toISOString() }).eq('heir_id', heirId).is('used_at', null).is('revoked_at', null);
  const token = randomToken(32);
  const { error } = await s.from('invitations').insert({
    estate_id: heir.estate_id, heir_id: heirId, token_hash: await sha256(token), channel, sent_to: to,
    expires_at: new Date(Date.now() + 14 * 864e5).toISOString(), created_by: user.id,
  });
  if (error) return fail('Kunne ikke oprette invitationen', 500);
  const link = `${await appUrl()}/i/${token}`;
  const { data: tov } = await s.from('heirs').select('name').eq('estate_id', heir.estate_id).eq('user_id', user.id).maybeSingle();
  await s.from('notifications').insert({
    estate_id: heir.estate_id, heir_id: heirId, channel, kind: 'invitation', to_address: to,
    payload: { link, heir: heir.name, estate: estate.name, mode: estate.mode, from: tov?.name ?? 'Tovholderen' },
  });
  await kickHousekeeping();
  return json({ ok: true, sent_to: to, expires_in_days: 14 });
});
