// Fælles hjælpere til Arvoras serverfunktioner (Supabase Edge Functions, Deno).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
export const APP_URL = (Deno.env.get('ARVORA_APP_URL') ?? 'https://app.arvora.dk').replace(/\/$/, '');

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
  const h = await crypto.subtle.digest('SHA-256', bytes);
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
