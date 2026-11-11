// Alt, appen beder serveren om. RPC'er går gennem supabase.rpc (RLS + security definer), serverfunktioner gennem fn().
import { sb, FN_URL } from './supabase.js';

export class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }

/** Kald en serverfunktion med brugerens token. Uden token (anon) kun til accept-invite. */
export async function fn(name, body, { anon = false } = {}) {
  const headers = { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY };
  if (!anon) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new ApiError('Du er ikke logget ind', 401);
    headers.Authorization = 'Bearer ' + session.access_token;
  }
  let r;
  try { r = await fetch(FN_URL + name, { method: 'POST', headers, body: JSON.stringify(body ?? {}) }); }
  catch { throw new ApiError('Ingen forbindelse. Prøv igen om lidt.', 0); }
  const text = await r.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!r.ok) throw new ApiError(data.error || 'Noget gik galt (' + r.status + ')', r.status);
  return data;
}

/** Kald en RPC. Fejlbeskeder fra databasen er på dansk og vises direkte. */
export async function rpc(name, args) {
  const { data, error } = await sb.rpc(name, args);
  if (error) throw new ApiError(clean(error.message), 400);
  return data;
}

function clean(m) { return String(m || 'Noget gik galt').replace(/^.*?: /, '').replace(/\s*\(SQLSTATE.*$/, ''); }

export function must({ data, error }) { if (error) throw new ApiError(clean(error.message), 400); return data; }

/** Hent PDF'en som fil. */
export async function pdfBlob(runId) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new ApiError('Du er ikke logget ind', 401);
  const r = await fetch(FN_URL + 'pdf?run_id=' + encodeURIComponent(runId), { headers: { Authorization: 'Bearer ' + session.access_token, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
  if (!r.ok) { let m = 'PDF kunne ikke laves'; try { m = (await r.json()).error || m; } catch {} throw new ApiError(m, r.status); }
  return r.blob();
}

/** Telefonnumre: 8 danske cifre bliver til +45. Alt andet skal starte med +. */
export function normPhone(s) {
  const t = String(s || '').replace(/[\s\-().]/g, '');
  if (/^\d{8}$/.test(t)) return '+45' + t;
  if (/^00\d{8,15}$/.test(t)) return '+' + t.slice(2);
  if (/^\+[1-9]\d{6,14}$/.test(t)) return t;
  return null;
}
export const isEmail = s => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || '').trim());
