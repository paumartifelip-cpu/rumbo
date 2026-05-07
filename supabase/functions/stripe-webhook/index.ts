// Stripe webhook → Supabase paid_codes
// Verifies the Stripe signature, then upserts the buyer's record so the app
// can unlock profile creation by looking up the customer's email.
// JWT verification is disabled — Stripe sends its own signature header.

import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret  = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const supaUrl        = Deno.env.get('SUPABASE_URL') ?? '';
const supaServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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

  if (event.type !== 'checkout.session.completed') return new Response('ignored', { status: 200 });

  const session = event.data.object as Stripe.Checkout.Session;
  const code  = (session.client_reference_id ?? '').toUpperCase().trim();
  const email = (session.customer_details?.email ?? '').trim().toLowerCase();
  const name  = session.customer_details?.name ?? null;

  if (!code) {
    console.warn('no client_reference_id on session', session.id);
    return new Response('no code', { status: 200 });
  }

  const supa = createClient(supaUrl, supaServiceKey);
  const { error } = await supa.from('paid_codes').upsert(
    {
      code,
      email:             email || null,
      name,
      paid_at:           new Date().toISOString(),
      stripe_session_id: session.id,
      used:              false,
    },
    { onConflict: 'code' }
  );

  if (error) {
    console.error('supabase upsert error', error);
    return new Response('db error', { status: 500 });
  }

  return new Response('ok', { status: 200 });
});
