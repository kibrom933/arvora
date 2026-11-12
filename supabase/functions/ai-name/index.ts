// Foreslår navn, rum, slags og "bør vurderes" ud fra et billede, der allerede ligger i boets bucket.
// Kører på serveren, så API-nøglen aldrig er i browseren. Billedet sendes kun til modellen for at få et navn;
// det gemmes ikke hos udbyderen (zero data retention aftales i ejerens API-konto, se owner-action-list.md).
// AI må ikke opfinde værdi, ægthed eller alder. Brugeren kan rette alt.
import { preflight, json, fail, currentUser, userClient, serviceClient, allow, setting } from '../_shared/common.ts';

const ROOMS = ['Stue', 'Køkken', 'Soveværelse', 'Værelse', 'Kælder', 'Have', 'Smykker', 'Andet'];
const KINDS = ['table', 'plates', 'clock', 'sewing', 'painting', 'ring', 'armchair', 'pots', 'box', 'album', 'radio', 'dresser', 'garden', 'tools', 'plate', 'blanket', 'thing'];
const PROMPT = `Du hjælper en familie med at registrere indbo, der skal fordeles mellem arvinger. Se på billedet af én ting (eller en samlet gruppe ting) og svar KUN med JSON på formen
{"name":"...","room":"...","kind":"...","valuable":false,"description":"...","duplicate_of":null,"confidence":"high|medium|low"}.
name: kort dansk navn, højst 6 ord, fx "Spisebord i eg med 6 stole" eller "Kaffestel med blå blomster, 12 dele". Skriv aldrig "antik", "ægte", "original" eller et mærke, medmindre det står tydeligt på billedet.
room: et af ${ROOMS.join(', ')}. kind: det nærmeste af ${KINDS.join(', ')}.
valuable: true kun hvis tingen KAN have betydelig handelsværdi (kunst, smykker, ure, designmøbler, sølv), så familien bør få den vurderet. Sæt aldrig en pris.
description: højst 20 ord, kun det, man kan se. duplicate_of: hvis tingen tydeligt er den samme som en af disse allerede registrerede ting, skriv dens nummer, ellers null.`;

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return fail('Brug POST', 405);
  const user = await currentUser(req); if (!user) return fail('Ikke logget ind', 401);
  const key = await setting('anthropic_api_key'); if (!key) return fail('AI-navne er ikke sat op endnu', 503);
  const { estate_id, path, existing } = await req.json().catch(() => ({}));
  if (typeof estate_id !== 'string' || typeof path !== 'string' || !path.startsWith(estate_id + '/')) return fail('estate_id eller path mangler');
  const { data: member } = await userClient(req).from('estate_members').select('role').eq('estate_id', estate_id).eq('user_id', user.id).maybeSingle();
  if (member?.role !== 'tovholder') return fail('Kun tovholderen', 403);
  if (!(await allow(`ai:${estate_id}`, 400, 86400))) return fail('Dagens grænse for AI-navne er nået', 429);
  const s = serviceClient();
  const { data: file, error } = await s.storage.from('ting').download(path);
  if (error || !file) return fail('Billedet blev ikke fundet', 404);
  if (file.size > 6_000_000) return fail('Billedet er for stort til AI-navn (højst 6 MB)');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let b64 = ''; for (let i = 0; i < bytes.length; i += 0x8000) b64 += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const media = file.type && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? file.type : 'image/jpeg';
  const known = Array.isArray(existing) ? existing.slice(0, 300).map((x: { no: number; name: string }) => `Nr. ${x.no}: ${x.name}`).join('\n') : '';
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: await setting('anthropic_model', 'claude-haiku-4-5'), max_tokens: 300, messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: media, data: btoa(b64) } },
      { type: 'text', text: PROMPT + (known ? '\n\nAllerede registreret:\n' + known : '') },
    ] }] }),
  });
  if (!r.ok) { console.error('anthropic', r.status, await r.text()); return fail('AI svarede ikke. Skriv navnet selv.', 502); }
  const out = await r.json();
  const text: string = out?.content?.find((c: { type: string }) => c.type === 'text')?.text ?? '';
  let p: Record<string, unknown> = {};
  try { p = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); } catch { return json({ ok: false, reason: 'ulæseligt svar' }); }
  const name = String(p.name ?? '').replace(/\b(antik|ægte|original|originalt)\b/gi, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!name) return json({ ok: false, reason: 'intet navn' });
  return json({ ok: true, name, room: ROOMS.includes(String(p.room)) ? p.room : 'Andet', kind: KINDS.includes(String(p.kind)) ? p.kind : 'thing',
    valuable: p.valuable === true, description: String(p.description ?? '').slice(0, 200), duplicate_of: Number.isInteger(p.duplicate_of) ? p.duplicate_of : null,
    confidence: ['high', 'medium', 'low'].includes(String(p.confidence)) ? p.confidence : 'medium' });
});
