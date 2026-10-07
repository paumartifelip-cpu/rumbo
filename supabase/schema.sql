-- Rumbo · esquema de la base de datos (Supabase / PostgreSQL)
--
-- Refleja la base de datos REAL de producción, leída el 2026-10-07.
-- Se puede ejecutar entero en Supabase → SQL Editor las veces que haga falta:
--   · En una base vacía crea todo desde cero.
--   · En una base antigua añade lo que falta (sección 2) sin tocar los datos.
-- Está probado en tests/schema.test.ts: ejecutarlo en una base vacía da exactamente
-- la estructura de producción, y repetirlo no cambia nada.
--
-- Cuando se cambie la base de datos, actualiza ESTE archivo (y supabase/migrations/)
-- y ejecuta `npm test`: el test avisa si dejan de coincidir.
--
-- NO está aquí a propósito:
--   · Los disparadores propios de Supabase (p. ej. `ensure_rls`, que activa la seguridad
--     por filas en cada tabla nueva), ni las extensiones que trae por defecto.
--   · `paid_codes_backup_20261007`: copia de seguridad puntual de los pagos, hecha antes de
--     crear la tabla de suscripciones. Se puede borrar cuando ya no haga falta.
--   · Los perfiles de demostración que traía la primera versión de este archivo: una base
--     nueva no debe nacer con cuentas falsas.

-- =============================================
-- 1. Tablas
-- =============================================

-- Una fila por usuario. `user_id` = auth.uid() (Supabase Auth). Sin clave foránea a
-- auth.users: la app siempre ha vivido con ids propios, y borrar un usuario exige borrar
-- también sus filas (ver wipeProfileData / deleteProfileFromSupabase en lib/sync.ts).
create table if not exists public.profiles (
  user_id uuid primary key,
  name text,
  email text,
  current_money numeric default 0,
  total_target numeric default 0,
  current_monthly_income numeric default 0,
  monthly_target numeric default 0,
  target_date timestamptz,
  updated_at timestamptz default now(),
  primary_currency text,        -- EUR, USD, MXN, ARS, COP, CLP, PEN, PYG
  profile_id text,
  emoji text,
  color text,
  initials text,
  income_type text,             -- salariado | empresario
  pin_hash text                 -- SHA-256 del PIN de 4 cifras (bloqueo "suave")
);

create table if not exists public.goals (
  id text primary key,
  user_id uuid not null,
  title text not null,
  description text,
  category text not null,
  target_amount numeric,
  current_amount numeric default 0,
  deadline timestamptz,
  importance integer default 5,
  status text default 'activo',
  progress integer default 0,
  created_at timestamptz default now(),
  timeframe text,               -- diario | semanal | mensual | anual
  unit text
);

create table if not exists public.tasks (
  id text primary key,
  user_id uuid not null,
  goal_id text,
  title text not null,
  description text,
  due_date timestamptz,
  estimated_minutes integer,
  energy_level text,
  difficulty integer,
  urgency integer,
  money_impact numeric default 0,
  ai_priority_score integer,
  ai_reason text,
  status text default 'pendiente',
  created_at timestamptz default now(),
  recurrence text,              -- diaria | semanal | mensual
  last_generated_date timestamptz,
  manual_order_index integer
);

create table if not exists public.financial_entries (
  id text primary key,
  user_id uuid not null,
  type text not null,           -- ingreso | gasto | ahorro | deuda
  title text not null,
  amount numeric not null,
  date timestamptz default now(),
  category text,
  created_at timestamptz default now(),
  currency text,
  amount_in_primary numeric,
  recurrence text,              -- mensual | anual
  last_generated_date timestamptz,
  payment_method text,          -- efectivo | debito | credito | transferencia | bizum (opcional)
  payment_account text          -- nombre de la tarjeta, solo débito/crédito (opcional)
);

create table if not exists public.money_snapshots (
  id text primary key,
  user_id uuid not null,
  date timestamptz not null,
  total numeric not null,
  note text,
  created_at timestamptz default now()
);

create table if not exists public.user_tools (
  id text primary key,
  user_id uuid not null,
  name text not null,
  description text,
  url text,
  category text not null default 'Productividad',
  tags text[] default '{}',
  free boolean default true,
  rating integer default 5 check (rating >= 1 and rating <= 5),
  icon text default '🔧',
  highlight boolean default false,
  created_at timestamptz default now(),
  cost numeric default 0,
  billing_period text default 'monthly',
  order_index integer,
  is_favorite boolean default false,
  updated_at timestamptz default now()
);

-- Presupuesto mensual por categoría. `currency` = moneda en que se definió (la app lo
-- convierte en vivo a la principal). `month` (YYYY-MM) reservado para presupuestos
-- distintos por mes; null = vale todos los meses.
create table if not exists public.budgets (
  id text primary key,
  user_id uuid not null,
  category text not null,
  amount numeric not null check (amount > 0),
  currency text,
  month text,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Preferencias de avisos (recordatorio diario para apuntar gastos). Una fila por usuario.
create table if not exists public.notification_prefs (
  user_id uuid primary key,
  reminder_enabled boolean not null default false,
  reminder_time text not null default '21:00'
    check (reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  timezone text not null default 'UTC',          -- zona IANA: "las 21:00" es la de SU ciudad
  skip_if_logged boolean not null default true,  -- no avisar si ya apuntó algo hoy
  updated_at timestamptz not null default now(),
  last_reminder_on date                          -- último día (local) en que se le envió el recordatorio
);

-- Dispositivos que pueden recibir avisos (uno por navegador/móvil). La Edge Function que
-- envía los avisos los lee con la service role.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,            -- "dirección de entrega" única de cada dispositivo
  p256dh text not null,                     -- claves del dispositivo para cifrar el aviso
  auth text not null,
  user_agent text,                          -- qué navegador/móvil es (solo para reconocerlo)
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Pagos: cada compra verificada por la Edge Function verify-payment
-- (code = id de la sesión de Stripe; `used` = ya se creó una cuenta con ese pago).
create table if not exists public.paid_codes (
  code text primary key,
  name text,
  paid_at timestamptz default now(),
  stripe_session_id text,
  used boolean default false,
  created_at timestamptz default now(),
  email text                    -- correo de la CUENTA de Rumbo (no el de Stripe)
);

-- La "libreta" de suscripciones: quién tiene acceso y por qué. La mantiene la Edge
-- Function stripe-webhook a partir de los avisos de Stripe.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null,                          -- siempre en minúsculas
  user_id uuid,
  plan_kind text not null default 'paid' check (plan_kind in ('paid', 'free_forever')),
  status text not null,                         -- active, trialing, past_due, canceled, unpaid…
  stripe_customer_id text,
  stripe_subscription_id text unique,           -- null en las cuentas gratis
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_end timestamptz,
  last_event_at timestamptz,                    -- último aviso de Stripe aplicado (anti-desorden)
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email = lower(email))
);

-- Avisos de Stripe ya recibidos: si Stripe repite uno, no se procesa dos veces.
create table if not exists public.stripe_events (
  id text primary key,                          -- id del evento de Stripe (evt_...)
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text                                    -- nota si se ignoró o falló
);

-- =============================================
-- 2. Actualización de bases antiguas
--    (columnas que se añadieron después de crear las tablas; no hace nada si ya existen)
-- =============================================

alter table public.profiles add column if not exists primary_currency text;
alter table public.profiles add column if not exists profile_id text;
alter table public.profiles add column if not exists emoji text;
alter table public.profiles add column if not exists color text;
alter table public.profiles add column if not exists initials text;
alter table public.profiles add column if not exists income_type text;
alter table public.profiles add column if not exists pin_hash text;

alter table public.goals add column if not exists timeframe text;
alter table public.goals add column if not exists unit text;

alter table public.tasks add column if not exists recurrence text;
alter table public.tasks add column if not exists last_generated_date timestamptz;
alter table public.tasks add column if not exists manual_order_index integer;

alter table public.financial_entries add column if not exists currency text;
alter table public.financial_entries add column if not exists amount_in_primary numeric;
alter table public.financial_entries add column if not exists recurrence text;
alter table public.financial_entries add column if not exists last_generated_date timestamptz;
alter table public.financial_entries add column if not exists payment_method text;
alter table public.financial_entries add column if not exists payment_account text;

alter table public.user_tools add column if not exists cost numeric default 0;
alter table public.user_tools add column if not exists billing_period text default 'monthly';
alter table public.user_tools add column if not exists order_index integer;
alter table public.user_tools add column if not exists is_favorite boolean default false;
alter table public.user_tools add column if not exists updated_at timestamptz default now();

alter table public.notification_prefs add column if not exists last_reminder_on date;

-- =============================================
-- 3. Índices
-- =============================================

create index if not exists goals_user_id_idx on public.goals (user_id);
create index if not exists tasks_user_id_idx on public.tasks (user_id);
create index if not exists financial_entries_user_id_idx on public.financial_entries (user_id);
create index if not exists money_snapshots_user_id_idx on public.money_snapshots (user_id);
create index if not exists budgets_user_id_idx on public.budgets (user_id);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
create index if not exists user_tools_favorite_idx on public.user_tools (user_id, is_favorite);
create index if not exists user_tools_order_idx on public.user_tools (user_id, order_index);
create index if not exists paid_codes_session_idx on public.paid_codes (stripe_session_id);
create index if not exists paid_codes_email_idx on public.paid_codes (email);
create index if not exists subscriptions_email_idx on public.subscriptions (email);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id);
-- Una persona solo puede tener UNA fila de "gratis para siempre".
create unique index if not exists subscriptions_one_free_per_email
  on public.subscriptions (email) where plan_kind = 'free_forever';

-- =============================================
-- 4. Disparador: `updated_at` de las herramientas se actualiza solo en cada cambio
--    (la sincronización lo usa para decidir qué edición es más reciente)
-- =============================================

create or replace function public.user_tools_touch_updated_at()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_tools_touch_updated_at_trg on public.user_tools;
create trigger user_tools_touch_updated_at_trg
  before update on public.user_tools
  for each row execute function public.user_tools_touch_updated_at();

-- =============================================
-- 5. Seguridad por filas (RLS)
--    Cada usuario solo lee y escribe sus propias filas, aunque tenga la clave anon.
--    NO uses políticas "using (true)": reabren todo.
-- =============================================

alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.tasks enable row level security;
alter table public.financial_entries enable row level security;
alter table public.money_snapshots enable row level security;
alter table public.user_tools enable row level security;
alter table public.budgets enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.paid_codes enable row level security;
alter table public.subscriptions enable row level security;
alter table public.stripe_events enable row level security;

-- Políticas antiguas (abiertas o con otro nombre), por si se ejecuta sobre una base vieja.
drop policy if exists "open_all_profiles" on public.profiles;
drop policy if exists "open_all_goals" on public.goals;
drop policy if exists "open_all_tasks" on public.tasks;
drop policy if exists "open_all_financial_entries" on public.financial_entries;
drop policy if exists "open_all_money_snapshots" on public.money_snapshots;
drop policy if exists "open_all_user_tools" on public.user_tools;
drop policy if exists "anon_read_paid_codes" on public.paid_codes;
drop policy if exists "anon_update_paid_codes" on public.paid_codes;

drop policy if exists "own_profiles" on public.profiles;
drop policy if exists "own_goals" on public.goals;
drop policy if exists "own_tasks" on public.tasks;
drop policy if exists "own_financial_entries" on public.financial_entries;
drop policy if exists "own_money_snapshots" on public.money_snapshots;
drop policy if exists "own_user_tools" on public.user_tools;
drop policy if exists "own_budgets" on public.budgets;
drop policy if exists "own_notification_prefs" on public.notification_prefs;
drop policy if exists "own_push_subscriptions" on public.push_subscriptions;
drop policy if exists "read_own_paid_code" on public.paid_codes;
drop policy if exists "read_own_subscription" on public.subscriptions;

create policy "own_profiles" on public.profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_goals" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_tasks" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_financial_entries" on public.financial_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_money_snapshots" on public.money_snapshots for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_user_tools" on public.user_tools for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_budgets" on public.budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_notification_prefs" on public.notification_prefs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_push_subscriptions" on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- paid_codes y subscriptions: las Edge Functions (service role) escriben saltándose RLS.
-- Desde el cliente solo se permite LEER la fila propia; nada de escrituras.
-- stripe_events: sin políticas = invisible para el cliente.
create policy "read_own_paid_code" on public.paid_codes
  for select to authenticated
  using (email is not null and email = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "read_own_subscription" on public.subscriptions
  for select to authenticated
  using (
    user_id = auth.uid()
    or email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- =============================================
-- 6. Tiempo real: la app se suscribe a estas tablas para ver los cambios al instante
--    desde otros dispositivos.
-- =============================================

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['profiles','goals','tasks','financial_entries','money_snapshots','user_tools','budgets']
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- =============================================
-- 7. Recordatorio diario: a quién avisar y cuándo
--    (el reloj que lo dispara cada 5 minutos —pg_cron + pg_net— está en
--    supabase/migrations/20261007_reminders_cron.sql: necesita extensiones de Supabase)
-- =============================================

-- ¿A quién le toca el recordatorio AHORA?
--
-- Recibe "la hora actual" como parámetro (por defecto, la real) para poder probarla con
-- horas inventadas en cualquier zona horaria.
--
-- Le toca a quien cumple TODO esto:
--   · tiene el recordatorio activado;
--   · su hora local ya ha llegado y no han pasado más de 60 minutos (sin cruzar la medianoche):
--     si el reloj falla un rato todavía llega a tiempo, pero nunca un aviso "de ayer";
--   · todavía no se le ha enviado hoy (en su día local);
--   · si marcó «no avisarme si ya he apuntado algo hoy»: no ha apuntado nada hoy. Los gastos fijos
--     que la app genera sola (ids con «__rec__») NO cuentan como "haber apuntado".
--
-- Una zona horaria inválida o un dato raro de UNA persona no impide avisar a las demás.
create or replace function public.recordatorios_pendientes(ahora timestamptz default now())
returns table (usuario uuid, fecha_local date, hora_local text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  p record;
  local_ahora timestamp;
  hoy date;
  inicio timestamp;
  fin timestamp;
begin
  for p in
    select n.user_id as uid, n.reminder_time, n.timezone, n.skip_if_logged, n.last_reminder_on
    from public.notification_prefs n
    where n.reminder_enabled
  loop
    begin
      local_ahora := ahora at time zone p.timezone;            -- la hora en SU ciudad
      hoy := local_ahora::date;
      inicio := hoy + p.reminder_time::time;
      fin := least(inicio + interval '60 minutes', (hoy + 1)::timestamp);

      if local_ahora >= inicio
         and local_ahora < fin
         and p.last_reminder_on is distinct from hoy
         and (
           not p.skip_if_logged
           or not exists (
             select 1 from public.financial_entries f
             where f.user_id = p.uid
               and (f.created_at at time zone p.timezone)::date = hoy
               and f.id not like '%\_\_rec\_\_%'
           )
         )
      then
        usuario := p.uid;
        fecha_local := hoy;
        hora_local := to_char(local_ahora, 'HH24:MI');
        return next;
      end if;
    exception when others then
      continue;   -- zona horaria inválida o dato raro de esta persona: se salta, el resto sigue
    end;
  end loop;
end;
$$;

-- Solo la función del servidor (service_role) puede preguntar quién tiene recordatorio pendiente:
-- es información de otros usuarios, nunca debe poder llamarla alguien desde la web.
revoke all on function public.recordatorios_pendientes(timestamptz) from public, anon, authenticated;
grant execute on function public.recordatorios_pendientes(timestamptz) to service_role;
