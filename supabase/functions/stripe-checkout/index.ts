// Opretter en Stripe Checkout-session for ét bo (795 kr. inkl. moms). Boet aktiveres først, når webhooken har
// bekræftet betalingen; klientens "succes"-side giver ingen adgang i sig selv.
import Stripe from 'npm:stripe@17.7.0';
import { preflight, json, fail, currentUser, userClient, serviceClient, appUrl, setting } from '../_shared/common.ts';


Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return fail('Brug POST', 405);
  const key = await setting('stripe_secret_key'); if (!key) return fail('Betaling er ikke sat op endnu', 503);
  const PRICE_ORE = Number(await setting('price_ore', '79500')); const APP_URL = await appUrl();
  const user = await currentUser(req); if (!user) return fail('Ikke logget ind', 401);
  const { estate_id } = await req.json().catch(() => ({}));
  if (typeof estate_id !== 'string') return fail('estate_id mangler');
  const u = userClient(req);
  const { data: estate } = await u.from('estates').select('id, name, status, paid_at').eq('id', estate_id).maybeSingle();
  if (!estate) return fail('Boet findes ikke', 404);
  const { data: member } = await u.from('estate_members').select('role').eq('estate_id', estate_id).eq('user_id', user.id).maybeSingle();
  if (member?.role !== 'tovholder') return fail('Kun tovholderen kan betale', 403);
  if (estate.paid_at) return fail('Boet er allerede betalt', 409);
  const stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' });
  const s = serviceClient();
  const { count } = await s.from('payments').select('id', { count: 'exact', head: true }).eq('estate_id', estate_id);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment', currency: 'dkk', customer_email: user.email ?? undefined, locale: 'da',
    line_items: [{ quantity: 1, price_data: { currency: 'dkk', unit_amount: PRICE_ORE, tax_behavior: 'inclusive',
      product_data: { name: 'Arvora: ét bo', description: `Deling af tingene efter ${estate.name}. Op til 6 arvinger og 300 ting.` } } }],
    automatic_tax: { enabled: (await setting('stripe_automatic_tax')) === 'true' },
    metadata: { estate_id, user_id: user.id },
    success_url: `${APP_URL}/bo/${estate_id}?betaling=ok`, cancel_url: `${APP_URL}/bo/${estate_id}?betaling=afbrudt`,
    consent_collection: { terms_of_service: 'required' },
  }, { idempotencyKey: `checkout:${estate_id}:${count ?? 0}` });
  await s.from('payments').insert({ estate_id, checkout_session_id: session.id, amount_ore: PRICE_ORE, currency: 'dkk', status: 'oprettet' });
  return json({ url: session.url });
});
