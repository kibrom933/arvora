// Én klient til hele appen. Kun den offentlige nøgle; RLS i databasen afgør, hvad brugeren må.
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!URL || !KEY) console.error('VITE_SUPABASE_URL og VITE_SUPABASE_PUBLISHABLE_KEY mangler (se .env.example)');

export const sb = createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
export const FN_URL = URL + '/functions/v1/';
