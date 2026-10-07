-- Rumbo · suscripciones (fase 0 y 1 del plan de pago seguro)
-- Ejecutar UNA vez en Supabase → SQL Editor. Es idempotente: se puede repetir.
-- No toca ninguna tabla existente salvo hacer una copia de seguridad de paid_codes.

-- 0) Copia de seguridad de los pagos actuales (por si algo sale mal más adelante).
create table if not exists public.paid_codes_backup_20261007 as
  select * from public.paid_codes;
alter table public.paid_codes_backup_20261007 enable row level security; -- sin políticas: nadie del cliente la ve

-- 1) La "libreta" de suscripciones: quién tiene acceso y por qué.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null,                          -- siempre en minúsculas
  user_id uuid,                                 -- se rellena cuando se conoce la cuenta
  plan_kind text not null default 'paid' check (plan_kind in ('paid', 'free_forever')),
  status text not null,                         -- active, trialing, past_due, canceled, unpaid, incomplete…
  stripe_customer_id text,
  stripe_subscription_id text unique,           -- null en las cuentas gratis
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_end timestamptz,
  last_event_at timestamptz,                    -- el último evento de Stripe aplicado (anti-desorden)
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email = lower(email))
);
create index if not exists subscriptions_email_idx on public.subscriptions (email);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id);
-- Una persona solo puede tener UNA fila de "gratis para siempre".
create unique index if not exists subscriptions_one_free_per_email
  on public.subscriptions (email) where plan_kind = 'free_forever';

-- 2) Registro de avisos de Stripe ya recibidos: si Stripe repite un aviso, no se procesa dos veces.
create table if not exists public.stripe_events (
  id text primary key,                          -- id del evento de Stripe (evt_...)
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

-- 3) Seguridad: cada persona solo puede LEER su propia fila. Nadie escribe desde el cliente;
--    solo las funciones del servidor (que se saltan estas reglas).
alter table public.subscriptions enable row level security;
alter table public.stripe_events enable row level security;

drop policy if exists "read_own_subscription" on public.subscriptions;
create policy "read_own_subscription" on public.subscriptions
  for select to authenticated
  using (
    user_id = auth.uid()
    or email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
-- stripe_events: sin políticas = invisible para el cliente.
