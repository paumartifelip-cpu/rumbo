// HERRAMIENTA DE UN SOLO USO (fase 2 del plan de pago).
// Pregunta a Stripe por TODAS las suscripciones de Rumbo (las que tienen alguno de los
// precios de STRIPE_RUMBO_PRICE_IDS) y las apunta en la tabla `subscriptions`, para que
// la libreta conozca también a quien pagaba antes de conectar los avisos.
//
//   POST ?dry=1  → prueba en seco: cuenta lo que encontraría, NO escribe nada.
//   POST         → escribe en `subscriptions`.
//
// Es idempotente (se puede repetir) y SOLO devuelve cantidades, nunca correos.
// Una vez usada se sustituye por un stub apagado (ver supabase/SUBSCRIPTIONS_SETUP.md).
// Autocontenida a propósito: no importa nada de stripe-webhook para poder desplegarse sola.

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
const priceIds = (Deno.env.get('STRIPE_RUMBO_PRICE_IDS') ?? '')
  .split(',')
  .map((x) => x.trim())
  .filter((x) => x.startsWith('price_'));

// Estados que merece la pena apuntar. Las canceladas no dan acceso: no hace falta la fila.
const KEEP = new Set(['active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete']);

const iso = (s?: number | null) => (typeof s === 'number' ? new Date(s * 1000).toISOString() : null);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (priceIds.length === 0) return json({ error: 'STRIPE_RUMBO_PRICE_IDS vacío: no se hace nada' }, 400);

  const dry = new URL(req.url).searchParams.get('dry') === '1';
  const byStatus: Record<string, number> = {};
  const seen = new Set<string>();
  let written = 0;
  let skippedNoEmail = 0;
  let skippedStatus = 0;

  try {
    for (const price of priceIds) {
      const subs = await stripe.subscriptions
        .list({ price, status: 'all', limit: 100, expand: ['data.customer'] })
        .autoPagingToArray({ limit: 1000 });

      for (const sub of subs) {
        if (seen.has(sub.id)) continue;
        seen.add(sub.id);
        byStatus[sub.status] = (byStatus[sub.status] ?? 0) + 1;
        if (!KEEP.has(sub.status)) { skippedStatus++; continue; }

        const customer = sub.customer as Stripe.Customer | string;
        const email = typeof customer === 'string' ? '' : (customer.deleted ? '' : (customer.email ?? '')).trim().toLowerCase();
        const customerId = typeof customer === 'string' ? customer : customer.id;
        if (!email) { skippedNoEmail++; continue; }

        // API de Stripe nueva: el fin del periodo puede estar en los items.
        const anySub = sub as unknown as { current_period_end?: number; items?: { data?: Array<{ current_period_end?: number }> } };
        const itemEnds = (anySub.items?.data ?? []).map((i) => i.current_period_end).filter((x): x is number => typeof x === 'number');
        const periodEnd = typeof anySub.current_period_end === 'number' ? anySub.current_period_end : (itemEnds.length ? Math.max(...itemEnds) : null);

        if (dry) { written++; continue; }

        // No pisar un aviso más reciente que ya llegó por el webhook.
        const nowSec = Math.floor(Date.now() / 1000);
        const { data: existing } = await supa.from('subscriptions').select('last_event_at').eq('stripe_subscription_id', sub.id).maybeSingle();
        if (existing?.last_event_at && new Date(existing.last_event_at).getTime() > nowSec * 1000) continue;

        const { error } = await supa.from('subscriptions').upsert(
          {
            email,
            plan_kind: 'paid',
            status: sub.status,
            stripe_customer_id: customerId,
            stripe_subscription_id: sub.id,
            current_period_end: iso(periodEnd),
            cancel_at_period_end: Boolean(sub.cancel_at_period_end),
            trial_end: iso(sub.trial_end),
            last_event_at: iso(nowSec),
            note: 'alta por backfill',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'stripe_subscription_id' }
        );
        if (error) throw new Error(`upsert: ${error.message}`);
        written++;
      }
    }
  } catch (err) {
    return json({ error: String((err as Error)?.message ?? err).slice(0, 300), dry, written }, 500);
  }

  return json({
    dry,
    precios_consultados: priceIds.length,
    suscripciones_encontradas: seen.size,
    por_estado: byStatus,
    a_escribir_o_escritas: written,
    omitidas_por_estado: skippedStatus,
    omitidas_sin_email: skippedNoEmail,
  });
});
