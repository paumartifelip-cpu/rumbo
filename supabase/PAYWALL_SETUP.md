# Paywall setup — Stripe + Supabase (code-based)

The app's login page now requires a paid **access code** to create any new
profile. Pau and Michelle (the two default profiles) bypass this entirely.

## How the flow works

1. User clicks **"Crear nuevo perfil"** on `/login`.
2. The app generates a random 8-character code (e.g. `R5H2-K9P3`) and shows it
   prominently. The same code is saved in `localStorage` so the user can come
   back even if they close the modal.
3. User clicks **"Pagar y desbloquear"**. The app redirects to your Stripe
   Payment Link with `client_reference_id=R5H2K9P3`.
4. After Stripe collects payment, it redirects the buyer to
   `<APP_URL>/login?from_stripe=1`.
5. Stripe also POSTs `checkout.session.completed` to the webhook URL →
   `stripe-webhook` Edge Function → upserts `{ code: "R5H2K9P3", used: false }`
   into `public.paid_codes`.
6. The login page polls `paid_codes` for that code. As soon as the row appears
   (`used=false`), the profile-creation form unlocks.
7. After the profile is created, the row is marked `used=true`, so the same
   payment can't spawn a second profile.
8. If the user lost localStorage (paid on another device, cleared cache, etc.)
   they can click **"Ya tengo un código pagado"** and type their code manually.

## One-time configuration

### 1. Stripe Dashboard

#### a. Edit the Payment Link

https://dashboard.stripe.com/payment-links → select the link
`fZu14perIavbc5mf015Ne0n` and:

- **After payment → Confirmation page**: redirect to your app
  - URL: `https://<YOUR_DOMAIN>/login?from_stripe=1`
  - For example: `https://b9a40822.rumbo-efg.pages.dev/login?from_stripe=1`
- The `client_reference_id` query param is passed automatically — you don't
  need to configure anything there.

#### b. Create the webhook endpoint

https://dashboard.stripe.com/webhooks → **Add endpoint**:

- **Endpoint URL**: `https://rwizskngajpmuisbdsaz.supabase.co/functions/v1/stripe-webhook`
- **Events to send**: `checkout.session.completed`
- Save and copy the **Signing secret** (`whsec_...`).

### 2. Supabase secrets

In `Project Settings → Edge Functions → Manage secrets`, add these two:

| Key | Value |
|-----|-------|
| `STRIPE_SECRET_KEY` | Your live secret key (`sk_live_...`) from https://dashboard.stripe.com/apikeys |
| `STRIPE_WEBHOOK_SECRET` | The `whsec_...` value you copied above |

> Supabase auto-injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for all
> Edge Functions, so you don't need to set those.

### 3. (Optional) Cloudflare Pages env

If you want to override the Stripe link without a redeploy, add
`NEXT_PUBLIC_STRIPE_PAYMENT_URL` in Cloudflare Pages → Settings →
Environment variables. Otherwise the hardcoded link in `lib/payment.ts` is used.

## Testing

1. In Stripe Dashboard, switch to **Test mode** and create a test Payment Link
   with a $0.50 product.
2. Update `STRIPE_SECRET_KEY` to your `sk_test_...` and `STRIPE_WEBHOOK_SECRET`
   to the test webhook secret.
3. Go to `/login`, click **"Nuevo perfil"**, copy the code shown, complete
   Stripe with `4242 4242 4242 4242`.
4. After redirect, you should see "Verificando tu pago…" briefly then the
   profile-creation form.

Logs are at https://supabase.com/dashboard/project/rwizskngajpmuisbdsaz/functions/stripe-webhook/logs.

## Bypassing the paywall manually

If you ever need to grant access to someone without payment, run:

```sql
insert into public.paid_codes (code, name, paid_at)
values ('GRANT001', 'Nombre', now());
```

Then they click **"Ya tengo un código pagado"** in the paywall and type
`GRANT001` (or any code you choose, 8 chars, uppercase A-Z 2-9).
