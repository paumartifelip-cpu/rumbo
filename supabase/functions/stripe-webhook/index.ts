// Stripe webhook -> Supabase paid_users
// Verifies the Stripe signature, then upserts the buyer's email so the app
// can unlock profile creation for that email. Disable JWT verification on
// this function — Stripe doesn't send a JWT, only its own signature header.

import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const supaUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supaServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('missing signature', { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error('signature verification failed', err);
    return new Response(`invalid signature`, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return new Response('ignored', { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const email = (session.customer_details?.email ?? session.customer_email ?? '').toLowerCase().trim();
  if (!email) {
    console.warn('no email on session', session.id);
    return new Response('no email', { status: 200 });
  }

  const supa = createClient(supaUrl, supaServiceKey);
  const { error } = await supa.from('paid_users').upsert(
    {
      email,
      name: session.customer_details?.name ?? null,
      paid_at: new Date().toISOString(),
      stripe_session_id: session.id,
      used: false,
    },
    { onConflict: 'email' }
  );

  if (error) {
    console.error('supabase upsert error', error);
    return new Response('db error', { status: 500 });
  }

  return new Response('ok', { status: 200 });
});
