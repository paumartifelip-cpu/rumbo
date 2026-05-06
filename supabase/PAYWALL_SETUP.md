# Paywall setup — Stripe + Supabase

The app's login page now requires a paid email to create any new profile.
Pau and Michelle (the two default profiles) bypass this.

## How the flow works

1. User clicks **"Crear nuevo perfil"** on `/login`.
2. They enter name + email, click **"Pagar y desbloquear"**.
3. The app saves email/name in `localStorage` and redirects to your Stripe Payment Link with `prefilled_email` and `client_reference_id` set to the same email.
4. After Stripe collects payment, it redirects the buyer back to `<APP_URL>/login?from_stripe=1`.
5. Stripe also POSTs `checkout.session.completed` to the webhook URL → `stripe-webhook` Edge Function → inserts a row into `public.paid_users`.
6. The login page polls `paid_users` for that email. As soon as the row appears (`used=false`), the profile-creation form unlocks.
7. After the profile is created, the row is marked `used=true`, so the same payment can't spawn a second profile.

## One-time configuration

### 1. Stripe Dashboard

#### a. Edit the Payment Link

Open https://dashboard.stripe.com/payment-links → select the link `fZu14perIavbc5mf015Ne0n` and:

- **After payment → Confirmation page**: redirect to your app
  - URL: `https://<YOUR_DOMAIN>/login?from_stripe=1`
  - For example: `https://b9a40822.rumbo-efg.pages.dev/login?from_stripe=1`
- **Customer information**: ensure **Collect email** is on (it is by default).

#### b. Create the webhook endpoint

https://dashboard.stripe.com/webhooks → **Add endpoint**:

- **Endpoint URL**: `https://rwizskngajpmuisbdsaz.supabase.co/functions/v1/stripe-webhook`
- **Events to send**: `checkout.session.completed`
- Save and copy the **Signing secret** (`whsec_...`).

### 2. Supabase secrets

In `Project Settings → Edge Functions → Manage secrets`, add these three secrets:

| Key | Value |
|-----|-------|
| `STRIPE_SECRET_KEY` | Your live secret key (`sk_live_...`) from https://dashboard.stripe.com/apikeys |
| `STRIPE_WEBHOOK_SECRET` | The `whsec_...` value you copied above |
| `SUPABASE_SERVICE_ROLE_KEY` | Already auto-injected — only set if your project doesn't auto-inject it |

> Supabase auto-injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for all Edge Functions. The Stripe secrets are the only ones you need to add manually.

### 3. (Optional) Cloudflare Pages env

If you want to override the Stripe link without a redeploy, add `NEXT_PUBLIC_STRIPE_PAYMENT_URL` in Cloudflare Pages → Settings → Environment variables. Otherwise the hardcoded link in `lib/payment.ts` is used.

## Testing

1. In Stripe Dashboard, switch to **Test mode** and create a test Payment Link with a $0.50 product.
2. Update `STRIPE_SECRET_KEY` to your `sk_test_...` and `STRIPE_WEBHOOK_SECRET` to the test webhook secret.
3. Go to `/login`, click **"Nuevo perfil"**, complete Stripe with `4242 4242 4242 4242`.
4. After redirect, you should see "Verificando tu pago…" briefly then the profile-creation form.

Logs are at https://supabase.com/dashboard/project/rwizskngajpmuisbdsaz/functions/stripe-webhook/logs.

## Bypassing the paywall manually

If you ever need to grant access to someone without payment, run:

```sql
insert into public.paid_users (email, name, paid_at) values ('alguien@example.com', 'Nombre', now());
```

Then they can click **"Ya pagué — verificar mi email"** in the paywall to unlock.
