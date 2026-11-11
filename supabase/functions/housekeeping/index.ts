// Serverens faste opgaver. Kaldes hvert kvarter af pg_cron (se migration 20261111000700) med en delt nøgle.
// 1) Sender beskeder i kø (SMS via GatewayAPI, mail via Resend). 2) Påmindelser 3 dage før frist.
// 3) Sletter billeder i storage for slettede boer. Uden udbydernøgler markeres beskeder som fejl (dev).
import { json, fail, serviceClient, APP_URL } from '../_shared/common.ts';

const SMS_TOKEN = Deno.env.get('GATEWAYAPI_TOKEN');
const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('ARVORA_FROM_EMAIL') ?? 'Arvora <hej@arvora.dk>';
const SENDER = 'Arvora';

type Note = { id: string; estate_id: string | null; heir_id: string | null; channel: 'sms' | 'email' | 'papir'; kind: string; to_address: string; payload: Record<string, unknown> };

// Teksterne er rolige og korte. Ingen udråbstegn.
function text(n: Note): { subject: string; body: string } {
  const p = n.payload as Record<string, string>;
  const app = APP_URL;
  switch (n.kind) {
    case 'invitation': return { subject: `Del tingene efter ${p.estate}`, body: p.mode === 'live'
      ? `Hej ${p.heir}. ${p.from} har inviteret dig til at give dine ønsker til tingene hos ${p.estate}. Dine ønsker er hemmelige. Åbn: ${p.link}`
      : `Hej ${p.heir}. ${p.from} har inviteret dig til at dele tingene efter ${p.estate}. Dine ønsker er hemmelige, og ingen skal forhandle. Åbn: ${p.link}` };
    case 'paamindelse': return { subject: 'Husk dine ønsker', body: `Hej ${p.heir}. Der er ${p.days} dage til fristen for jeres ønsker til tingene efter ${p.estate}. Åbn: ${app}` };
    case 'alle_har_svaret': return { subject: 'Alle har afgivet ønsker', body: `Alle har nu afgivet deres ønsker. Du kan dele tingene, gerne når familien er samlet: ${app}` };
    case 'fordeling_klar': return { subject: 'Fordelingen er klar', body: `Fordelingen af tingene efter ${p.estate} er klar. Se din kasse og forklaringen, og skriv under, når du er klar: ${app}` };
    case 'underskrift_kode': return { subject: 'Din kode til underskrift', body: `Din kode til at skrive under i Arvora er ${p.code}. Den gælder i 10 minutter. Har du ikke bedt om den, kan du se bort fra beskeden.` };
    case 'alle_har_underskrevet': return { subject: 'Alle har skrevet under', body: `Alle har skrevet under på fordelingen. Fordelingslisten kan hentes som PDF: ${app}` };
    case 'ny_runde_spoergsmaal': return { subject: 'Skal tingene deles igen?', body: `Tovholderen foreslår en ny runde: "${p.reason}". Boet åbnes kun, hvis alle siger ja. Svar her: ${app}` };
    case 'ny_runde_aabnet': return { subject: 'Boet er åbnet igen', body: `Alle har sagt ja til en ny runde. Gennemgå dine ønsker igen, og lås dem, når du er klar: ${app}` };
    default: return { subject: 'Arvora', body: `Der er nyt i Arvora: ${app}` };
  }
}

async function sendSms(to: string, body: string): Promise<void> {
  if (!SMS_TOKEN) throw new Error('ingen SMS-udbyder sat op');
  const r = await fetch('https://gatewayapi.com/rest/mtsms', { method: 'POST', headers: { Authorization: 'Token ' + SMS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: SENDER, message: body, recipients: [{ msisdn: to.replace(/^\+/, '') }] }) });
  if (!r.ok) throw new Error('SMS ' + r.status + ' ' + (await r.text()).slice(0, 200));
}
async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  if (!RESEND_KEY) throw new Error('ingen mail-udbyder sat op');
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, text: body }) });
  if (!r.ok) throw new Error('Mail ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('HOUSEKEEPING_SECRET');
  if (!secret || req.headers.get('x-housekeeping-key') !== secret) return fail('Ingen adgang', 401);
  const s = serviceClient();
  const stats = { sent: 0, failed: 0, reminders: 0, purged: 0 };

  // 2) påmindelser: frist om 3 dage, ikke svaret, ikke allerede mindet om
  const soon = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  const { data: due } = await s.from('estates').select('id, name, deadline').eq('status', 'aaben').eq('deadline', soon);
  for (const e of due ?? []) {
    const { data: hs } = await s.from('heirs').select('id, name, phone, email').eq('estate_id', e.id).is('submitted_at', null);
    for (const h of hs ?? []) {
      const { count } = await s.from('notifications').select('id', { count: 'exact', head: true }).eq('heir_id', h.id).eq('kind', 'paamindelse');
      if (count) continue;
      const to = h.phone ?? h.email; if (!to) continue;
      await s.from('notifications').insert({ estate_id: e.id, heir_id: h.id, channel: h.phone ? 'sms' : 'email', kind: 'paamindelse', to_address: to, payload: { heir: h.name, estate: e.name, days: 3 } });
      stats.reminders++;
    }
  }
  // 1) kø
  const { data: queue } = await s.from('notifications').select('*').eq('status', 'koe').lte('scheduled_for', new Date().toISOString()).order('created_at').limit(100);
  for (const n of (queue ?? []) as Note[]) {
    const t = text(n);
    try {
      if (n.channel === 'sms') await sendSms(n.to_address, t.body); else if (n.channel === 'email') await sendEmail(n.to_address, t.subject, t.body); else throw new Error('papir sendes ikke');
      await s.from('notifications').update({ status: 'sendt', sent_at: new Date().toISOString(), payload: { ...n.payload, code: n.payload.code ? '••••••' : undefined } }).eq('id', n.id);
      stats.sent++;
    } catch (e) {
      await s.from('notifications').update({ status: 'fejl', error: String((e as Error).message).slice(0, 300) }).eq('id', n.id);
      stats.failed++;
    }
  }
  // 3) billeder for slettede boer
  const { data: purge } = await s.from('purge_queue').select('id, paths').is('done_at', null).limit(20);
  for (const p of purge ?? []) {
    const { error } = await s.storage.from('ting').remove(p.paths);
    if (!error) { await s.from('purge_queue').update({ done_at: new Date().toISOString() }).eq('id', p.id); stats.purged += p.paths.length; }
  }
  // udløbne engangskoder
  await s.from('otp_codes').delete().lt('expires_at', new Date().toISOString());
  return json({ ok: true, ...stats });
});
