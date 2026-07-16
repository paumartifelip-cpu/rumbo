# Paywall — Stripe + Supabase (suscripción 3,99 €/mes)

Todo usuario nuevo paga ANTES de crear su cuenta. Las cuentas que ya existían
("cuentas fundadoras") no pagan nada y siguen funcionando igual.

## Cómo funciona el flujo

1. En `/login` (o desde la landing), "Crear cuenta" muestra el precio y un
   botón **"Pagar y crear mi cuenta →"** que abre el Payment Link de Stripe
   (`https://buy.stripe.com/eVqcN74R81YFd9q7xz5Ne0t`, 3,99 €/mes).
2. Al completar el pago, Stripe redirige a
   `https://rumbo-efg.pages.dev/activar?session_id={CHECKOUT_SESSION_ID}`.
3. `/activar` llama a la Edge Function **`verify-payment`** con ese
   `session_id`. La función lo comprueba contra la API de Stripe
   (`payment_status === "paid"`) y lo registra en `public.paid_codes`
   (`code` = session id, `used` = false).
4. Con el pago verificado, `/activar` muestra el formulario (nombre y email
   prellenados desde Stripe + contraseña) y crea la cuenta de Supabase Auth.
   Después marca la sesión como `used = true` — **un pago = una cuenta** — y
   guarda el email definitivo de la cuenta en la fila.
5. El usuario entra directo a `/onboarding` con su cuenta nueva.

## Plan y baja en Ajustes

- Ajustes → **Mi plan** muestra "Rumbo Premium · 3,99 €/mes" si el email del
  usuario tiene fila en `paid_codes` (política RLS `read_own_paid_code`: cada
  cuenta solo ve su propia fila). Sin fila → "Cuenta fundadora · sin coste".
- **Darse de baja**: botón que abre WhatsApp (`https://wa.me/34601108311`) con
  el mensaje prellenado. La baja se tramita a mano: cancela la suscripción del
  cliente en https://dashboard.stripe.com/subscriptions.

## Configuración (una sola vez)

### Secreto de Stripe en Supabase  ⚠️ IMPRESCINDIBLE

La función `verify-payment` necesita tu clave secreta de Stripe:

1. Copia la clave (`sk_live_...`) en
   https://dashboard.stripe.com/acct_1RTHiHQKLVlNRTAX/apikeys
2. Pégala en Supabase → Edge Functions → Secrets:
   https://supabase.com/dashboard/project/rwizskngajpmuisbdsaz/settings/functions
   - Key: `STRIPE_SECRET_KEY` · Value: `sk_live_...`

Sin este secreto, `/activar` no puede verificar pagos (muestra un aviso con
botón de reintento y contacto por WhatsApp; ningún pago se pierde).

### Redirección del Payment Link

Ya configurada por API: tras el pago, el link redirige a
`https://rumbo-efg.pages.dev/activar?session_id={CHECKOUT_SESSION_ID}`.
Si algún día cambias de dominio, actualízala en
https://dashboard.stripe.com/payment-links.

## Probar el flujo

1. En Stripe (modo test) crea un Payment Link de prueba con la misma
   redirección y ponlo en `NEXT_PUBLIC_STRIPE_PAYMENT_URL` (Cloudflare Pages →
   Environment variables) — y usa una `sk_test_...` en `STRIPE_SECRET_KEY`.
2. Paga con la tarjeta `4242 4242 4242 4242`.
3. Debes volver a `/activar`, ver "Pago confirmado", crear la cuenta y entrar.

Logs de la función: https://supabase.com/dashboard/project/rwizskngajpmuisbdsaz/functions/verify-payment/logs

## Dar acceso gratis a alguien (bypass manual)

Inserta un pago "virtual" ya consumido no sirve — lo que hace premium visible
es la fila con su email. Para regalar acceso: crea tú la cuenta desde
`/activar` no es posible sin pago, así que hazlo así:

```sql
-- 1) La persona se crea cuenta... no puede. Créasela tú:
--    Supabase → Authentication → Add user (email + contraseña temporal).
-- 2) (Opcional) para que Ajustes le muestre plan de pago:
insert into public.paid_codes (code, email, name, used)
values ('GRANT-<algo-unico>', 'su@email.com', 'Su Nombre', true);
```

## Nota sobre la función `stripe-webhook`

Es del paywall antiguo (códigos de acceso). Sigue desplegada pero ya no se usa;
se puede borrar cuando quieras.
