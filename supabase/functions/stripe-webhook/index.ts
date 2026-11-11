// Stripes webhook. Signaturen tjekkes; kun bekræftede hændelser ændrer noget. Idempotent pr. session.
import Stripe from 'npm:stripe@17.7.0';
import { json, fail, serviceClient } from '../_shared/common.ts';

Deno.serve(async (req) => {
  const key = Deno.env.get('STRIPE_SECRET_KEY'), whsec = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!key || !whsec) return fail('Betaling er ikke sat op', 503);
  const sig = req.headers.get('stripe-signature'); if (!sig) return fail('Ingen signatur', 400);
  const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });
  let event: Stripe.Event;
  try { event = await stripe.webhooks.constructEventAsync(await req.text(), sig, whsec); }
  catch (e) { return fail('Ugyldig signatur: ' + (e as Error).message, 400); }
  const s = serviceClient();
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== 'paid') return json({ received: true, ignored: 'ikke betalt endnu' });
    const estateId = session.metadata?.estate_id; if (!estateId) return json({ received: true, ignored: 'intet bo' });
    const { data: pay } = await s.from('payments').select('id, status').eq('checkout_session_id', session.id).maybeSingle();
    if (pay?.status === 'betalt') return json({ received: true, duplicate: true });
    const row = { status: 'betalt', paid_at: new Date().toISOString(), payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null, raw: { id: session.id, amount_total: session.amount_total, currency: session.currency } };
    if (pay) await s.from('payments').update(row).eq('id', pay.id);
    else await s.from('payments').insert({ estate_id: estateId, checkout_session_id: session.id, amount_ore: session.amount_total ?? 0, currency: session.currency ?? 'dkk', ...row });
    await s.from('estates').update({ paid_at: new Date().toISOString() }).eq('id', estateId).is('paid_at', null);
    // Boet åbnes automatisk, hvis der allerede er mindst to arvinger; ellers åbner tovholderen det, når de er tilføjet.
    const { count } = await s.from('heirs').select('id', { count: 'exact', head: true }).eq('estate_id', estateId);
    if ((count ?? 0) >= 2) await s.from('estates').update({ status: 'aaben' }).eq('id', estateId).eq('status', 'kladde');
    return json({ received: true });
  }
  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
    if (pi) await s.from('payments').update({ status: 'refunderet', refunded_at: new Date().toISOString() }).eq('payment_intent_id', pi);
    return json({ received: true });
  }
  return json({ received: true, ignored: event.type });
});
