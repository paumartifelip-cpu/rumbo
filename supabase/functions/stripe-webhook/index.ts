// Stripe → Supabase: mantiene la tabla `subscriptions` al día.
// Stripe "llama por teléfono" a esta función cada vez que cambia una suscripción
// (alta, renovación, cobro fallido, cancelación). Aquí solo se ANOTA el estado;
// no se bloquea a nadie (eso llega en una fase posterior).
// JWT verification desactivado: Stripe no envía JWT, se verifica su FIRMA.
//
// Secretos necesarios (Supabase → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY      clave secreta de Stripe (la misma de verify-payment)
//   STRIPE_WEBHOOK_SECRET  "Signing secret" (whsec_...) del endpoint creado en Stripe
//   STRIPE_RUMBO_PRICE_IDS precios de Rumbo separados por comas (price_...). La cuenta de
//                          Stripe tiene también otros negocios: sin esto NO se anota nada.

import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  describeIgnored,
  isHandledEvent,
  isRumboSubscription,
  normalizeEmail,
  parsePriceIds,
  rowFromSubscription,
  shouldApplyEvent,
} from './subscription.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const rumboPriceIds = parsePriceIds(Deno.env.get('STRIPE_RUMBO_PRICE_IDS'));
const supa = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

/** Error permanente (reintentar no lo arregla): se anota y se responde 200. */
class SkipEvent extends Error {}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('missing signature', { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error('signature verification failed', err);
    return new Response('invalid signature', { status: 400 });
  }

  if (!isHandledEvent(event.type)) return new Response('ignored', { status: 200 });

  // Idempotencia: si Stripe repite el aviso, no se procesa dos veces.
  const { error: insErr } = await supa.from('stripe_events').insert({ id: event.id, type: event.type });
  if (insErr) {
    if (insErr.code !== '23505') {
      console.error('stripe_events insert error', insErr);
      return new Response('db error', { status: 500 });
    }
    const { data } = await supa.from('stripe_events').select('processed_at').eq('id', event.id).maybeSingle();
    if (data?.processed_at) return new Response('duplicate', { status: 200 });
    // visto pero sin terminar: se reintenta
  }

  try {
    // handleEvent devuelve una nota cuando decide ignorar el aviso (no es un error).
    const note = await handleEvent(event);
    await supa
      .from('stripe_events')
      .update({ processed_at: new Date().toISOString(), error: note ?? null })
      .eq('id', event.id);
    return new Response('ok', { status: 200 });
  } catch (err) {
    const msg = String((err as Error)?.message ?? err).slice(0, 500);
    console.error('event failed', event.id, event.type, msg);
    await supa.from('stripe_events').update({ error: msg }).eq('id', event.id);
    // Permanente → 200 (no tiene sentido que Stripe reintente); transitorio → 500 (que reintente).
    return new Response(err instanceof SkipEvent ? 'skipped' : 'error', {
      status: err instanceof SkipEvent ? 200 : 500,
    });
  }
});

async function handleEvent(event: Stripe.Event): Promise<string | undefined> {
  let sub: Stripe.Subscription;
  let email = '';

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== 'subscription' || !session.subscription) return 'ignorado: pago suelto, no es una suscripción';
    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
    sub = await stripe.subscriptions.retrieve(subId);
    email = normalizeEmail(session.customer_details?.email);
  } else {
    sub = event.data.object as Stripe.Subscription;
  }

  // La cuenta de Stripe es compartida con otros negocios: solo suscripciones de Rumbo.
  if (!isRumboSubscription(sub, rumboPriceIds)) return describeIgnored(sub, rumboPriceIds);

  if (!email) {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) throw new SkipEvent('cliente borrado en Stripe');
    email = normalizeEmail(customer.email);
  }
  if (!email) throw new SkipEvent('la suscripción no tiene email asociado');

  // Anti-desorden: ignora un aviso más viejo que el último ya aplicado.
  const { data: existing, error: selErr } = await supa
    .from('subscriptions')
    .select('last_event_at')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle();
  if (selErr) throw new Error(`select subscriptions: ${selErr.message}`);
  if (existing && !shouldApplyEvent(existing.last_event_at, event.created)) return 'ignorado: aviso más antiguo que el ya guardado';

  const row = rowFromSubscription(sub, email, event.created);
  const { error } = await supa.from('subscriptions').upsert(row, { onConflict: 'stripe_subscription_id' });
  if (error) throw new Error(`upsert subscriptions: ${error.message}`);
  return undefined;
}
