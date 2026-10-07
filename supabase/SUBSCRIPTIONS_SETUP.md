# Suscripciones — fases 0 y 1 (guía sencilla)

Objetivo: que Rumbo **sepa de verdad quién paga**, haciéndole caso a Stripe.
Estas fases solo ANOTAN; **no bloquean a nadie**.

Cómo funciona: Stripe "llama por teléfono" a la función `stripe-webhook` cada vez que
algo cambia (alta, renovación, cobro fallido, cancelación) y esta lo apunta en la tabla
`subscriptions`. La regla "¿tiene acceso?" está en
`supabase/functions/stripe-webhook/subscription.ts` (`hasAccess`) y tiene tests.

## Pasos (en este orden)

### 1. Crear las tablas (Supabase)
Pega **todo** `supabase/migrations/20261007_subscriptions.sql` en Supabase → SQL Editor → Run.
Hace una copia de seguridad de los pagos actuales y crea `subscriptions` y `stripe_events`.
No toca nada existente.

### 2. Marcar las cuentas "gratis para siempre"
En el SQL Editor (los correos NO se guardan en el repositorio porque es público):

```sql
insert into public.subscriptions (email, user_id, plan_kind, status, note)
select lower(u.email), u.id, 'free_forever', 'active', 'cuenta fundadora'
from auth.users u
where lower(u.email) in ('correo1@...', 'correo2@...')   -- pon aquí los correos
on conflict do nothing;
```

### 3. Crear el aviso en Stripe
Stripe → Developers → Webhooks → **Add endpoint**:
- URL: `https://rwizskngajpmuisbdsaz.supabase.co/functions/v1/stripe-webhook`
- Eventos: `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`
- Copia el "Signing secret" (empieza por `whsec_`).

Haz primero todo esto en **modo de pruebas** de Stripe; el modo real después.

### 4. Guardar los secretos en Supabase
Supabase → Edge Functions → Secrets:
- `STRIPE_WEBHOOK_SECRET` = el `whsec_...` del paso 3.
- `STRIPE_RUMBO_PRICE_IDS` = el/los precio(s) de Rumbo, separados por comas
  (`price_...`; en Stripe → Catálogo de productos → el producto de Rumbo → el precio → su ID).
  **Imprescindible:** esa cuenta de Stripe la comparten otros negocios, y sin esta lista
  la función NO anota nada (así no se mezclan clientes ajenos). Si algún día añades un plan
  anual, añade su `price_...` a la lista.
(`STRIPE_SECRET_KEY` ya existe: la usa `verify-payment`.)

### 5. Publicar la función
Publicar `supabase/functions/stripe-webhook` en Supabase con JWT verification **desactivado**.

### 6. Probar con dinero de mentira
Hacer una compra de prueba (tarjeta `4242 4242 4242 4242`) y comprobar que aparece una fila
en `subscriptions` y otra en `stripe_events` con `processed_at` relleno.
Repetir con una cancelación y con un cobro fallido (tarjeta `4000 0000 0000 0341`).

### 7. (Fase 2) Poner al día a quien ya paga — HECHO el 2026-10-07
Stripe no reenvía avisos antiguos, así que se usó una función de un solo uso
(`backfill-subscriptions`) que preguntó a Stripe por las suscripciones de Rumbo y las apuntó
en la libreta (3 activas; las canceladas no se apuntan). Ya está APAGADA: el código que queda
en `supabase/functions/backfill-subscriptions/` es un stub que responde 410. Si hiciera falta
repetirlo, se puede recuperar la versión completa desde el historial de git (commit 63ead9f).

## Qué NO hace todavía
No bloquea el acceso, no cierra el registro libre y no añade el botón de baja. Eso son las
fases 3, 4 y 5 del plan.
