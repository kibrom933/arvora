// Fælles hjælpere til Arvoras serverfunktioner (Supabase Edge Functions, Deno).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Indstillinger: Edge secrets (miljø) har forrang, derefter tabellen app_settings (kun serveren kan læse den), derefter standard. */
const ENV_OF: Record<string, string> = { app_url: 'ARVORA_APP_URL', from_email: 'ARVORA_FROM_EMAIL', price_ore: 'ARVORA_PRICE_ORE', housekeeping_key: 'HOUSEKEEPING_SECRET',
  anthropic_api_key: 'ANTHROPIC_API_KEY', anthropic_model: 'ANTHROPIC_MODEL', resend_api_key: 'RESEND_API_KEY', gatewayapi_token: 'GATEWAYAPI_TOKEN',
  stripe_secret_key: 'STRIPE_SECRET_KEY', stripe_webhook_secret: 'STRIPE_WEBHOOK_SECRET', stripe_automatic_tax: 'STRIPE_AUTOMATIC_TAX' };
let cache: Record<string, string> | null = null; let cachedAt = 0;
export async function setting(key: string, fallback = ''): Promise<string> {
  const env = ENV_OF[key] ? Deno.env.get(ENV_OF[key]) : undefined;
  if (env) return env;
  if (!cache || Date.now() - cachedAt > 60_000) {
    const { data } = await serviceClient().from('app_settings').select('key, value');
    cache = Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value])); cachedAt = Date.now();
  }
  return cache[key] ?? fallback;
}
export async function appUrl(): Promise<string> { return (await setting('app_url', 'https://app.arvora.dk')).replace(/\/$/, ''); }

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': Deno.env.get('ARVORA_ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS, ...extra } });
}
export function fail(message: string, status = 400): Response { return json({ error: message }, status); }
export function preflight(req: Request): Response | null { return req.method === 'OPTIONS' ? new Response('ok', { headers: CORS }) : null; }

/** Klient, der handler som den bruger, der kaldte (RLS gælder). */
export function userClient(req: Request): SupabaseClient {
  const auth = req.headers.get('Authorization') ?? '';
  return createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
}
/** Klient med service role. Går uden om RLS. Bruges kun til det, serveren selv skal, og aldrig i browseren. */
export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}
export async function currentUser(req: Request) {
  const { data, error } = await userClient(req).auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function sha256(s: string | Uint8Array): Promise<string> {
  const bytes = typeof s === 'string' ? new TextEncoder().encode(s) : s;
  const h = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function randomToken(bytes = 32): string {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('cf-connecting-ip') || 'ukendt';
}
/** Rate limit via databasen. Returnerer false, hvis grænsen er nået. */
export async function allow(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await serviceClient().rpc('rate_limit', { p_key: key, p_max: max, p_window: `${windowSeconds} seconds` });
  if (error) { console.error('rate_limit', error.message); return false; }
  return data === true;
}
export function maskPhone(p: string): string { return p.replace(/^(\+\d{2})(\d+)(\d{2})$/, (_, a, b, c) => a + ' ' + '•'.repeat(Math.max(2, b.length)) + c); }
export function maskEmail(e: string): string { const [u, d] = e.split('@'); return (u[0] ?? '') + '•••@' + d; }

/** Send en mail gennem Resend. Afsender og nøgle fra setting(). */
export async function sendMail(to: string, subject: string, body: string): Promise<void> {
  const key = await setting('resend_api_key'); if (!key) throw new Error('ingen mail-udbyder sat op');
  const from = await setting('from_email', 'Arvora <hej@arvora.dk>');
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text: body }) });
  if (!r.ok) throw new Error('Mail ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

/** Login-kode på mail uden Supabase' egne mailskabeloner: koden laves med admin.generateLink (som ikke sender noget),
 *  og vi sender den selv. Brugeren oprettes, hvis hun ikke findes. Klienten bekræfter med verifyOtp({ email, token, type: 'email' }). */
export async function sendLoginCode(email: string): Promise<void> {
  const s = serviceClient();
  let res = await s.auth.admin.generateLink({ type: 'magiclink', email });
  if (res.error) {
    const c = await s.auth.admin.createUser({ email, email_confirm: true });
    if (c.error && !/already/i.test(c.error.message)) throw new Error(c.error.message);
    res = await s.auth.admin.generateLink({ type: 'magiclink', email });
  }
  const code = res.data?.properties?.email_otp;
  if (res.error || !code) throw new Error(res.error?.message ?? 'ingen kode');
  await sendMail(email, 'Din kode til Arvora', `Din kode til Arvora er ${code}\n\nSkriv den på siden, hvor du bad om den. Koden gælder i en time.\nHar du ikke bedt om den, kan du se bort fra mailen.\n\nArvora`);
}

/** Send en SMS gennem GatewayAPI (afsender "Arvora"). */
export async function sendSms(to: string, body: string): Promise<void> {
  const token = await setting('gatewayapi_token'); if (!token) throw new Error('ingen SMS-udbyder sat op');
  const r = await fetch('https://gatewayapi.com/rest/mtsms', { method: 'POST', headers: { Authorization: 'Token ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: 'Arvora', message: body, recipients: [{ msisdn: to.replace(/^\+/, '') }] }) });
  if (!r.ok) throw new Error('SMS ' + r.status + ' ' + (await r.text()).slice(0, 200));
}
/** Hvilken kanal når en person? SMS kun, når en SMS-udbyder er sat op; ellers mail. */
export async function channelFor(p: { phone?: string | null; email?: string | null }): Promise<'sms' | 'email' | null> {
  const sms = !!(await setting('gatewayapi_token'));
  if (p.phone && sms) return 'sms';
  if (p.email) return 'email';
  return p.phone ? 'sms' : null;
}
/** Send beskeder i kø med det samme (i stedet for at vente på det næste kvarter). */
export async function kickHousekeeping(): Promise<void> {
  const key = await setting('housekeeping_key'); if (!key) return;
  try { await fetch(SUPABASE_URL + '/functions/v1/housekeeping', { method: 'POST', headers: { 'x-housekeeping-key': key, 'Content-Type': 'application/json' }, body: '{}' }); }
  catch (e) { console.error('housekeeping', (e as Error).message); }
}
