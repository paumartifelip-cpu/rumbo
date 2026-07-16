// Verifica un pago de Stripe a partir del checkout session id que Stripe
// añade a la URL de retorno (/activar?session_id=cs_...). Garantiza que cada
// pago solo pueda usarse para crear UNA cuenta (columna `used` en paid_codes).
// Se llama antes de que exista sesión de usuario → JWT verification off; el
// session id es imposible de adivinar y actúa como credencial.

import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const supa = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, reason: 'method' }, 405);

  let payload: { session_id?: string; consume?: boolean; email?: string; name?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, reason: 'bad_request' }, 400);
  }

  const sessionId = (payload.session_id ?? '').trim();
  if (!sessionId.startsWith('cs_')) return json({ ok: false, reason: 'bad_session' }, 400);

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    const msg = String((err as Error)?.message ?? err);
    console.error('stripe retrieve failed:', msg);
    return json({ ok: false, reason: msg.includes('No such') ? 'not_found' : 'stripe_error' });
  }

  if (session.payment_status !== 'paid') return json({ ok: false, reason: 'unpaid' });

  const { data: row, error: selErr } = await supa
    .from('paid_codes')
    .select('code, used')
    .eq('code', sessionId)
    .maybeSingle();
  if (selErr) {
    console.error('paid_codes select error', selErr);
    return json({ ok: false, reason: 'db_error' }, 500);
  }
  // Un pago = una cuenta. Si ya se consumió, no se puede reutilizar.
  if (row?.used) return json({ ok: false, reason: 'used' });

  const stripeEmail = (session.customer_details?.email ?? '').trim().toLowerCase();
  const stripeName = session.customer_details?.name ?? null;

  if (payload.consume) {
    // La cuenta acaba de crearse: guarda el email real de login (puede
    // diferir del usado en Stripe) para que Ajustes encuentre el plan.
    const email = (payload.email ?? stripeEmail).trim().toLowerCase();
    const { error } = await supa.from('paid_codes').upsert(
      {
        code: sessionId,
        stripe_session_id: sessionId,
        email: email || null,
        name: payload.name ?? stripeName,
        paid_at: new Date().toISOString(),
        used: true,
      },
      { onConflict: 'code' }
    );
    if (error) {
      console.error('paid_codes consume error', error);
      return json({ ok: false, reason: 'db_error' }, 500);
    }
    return json({ ok: true });
  }

  const { error } = await supa.from('paid_codes').upsert(
    {
      code: sessionId,
      stripe_session_id: sessionId,
      email: stripeEmail || null,
      name: stripeName,
      paid_at: new Date().toISOString(),
      used: false,
    },
    { onConflict: 'code' }
  );
  if (error) {
    console.error('paid_codes upsert error', error);
    return json({ ok: false, reason: 'db_error' }, 500);
  }

  return json({ ok: true, email: stripeEmail, name: stripeName });
});
