-- Rumbo · Supabase schema
-- Ejecuta este SQL en Supabase (SQL Editor) para preparar la base de datos.
-- Este script es idempotente: puedes ejecutarlo varias veces.

create extension if not exists "pgcrypto";

-- =============================================
-- Tablas
-- =============================================

create table if not exists profiles (
  user_id uuid primary key,
  name text,
  email text,
  current_money numeric default 0,
  total_target numeric default 0,
  current_monthly_income numeric default 0,
  monthly_target numeric default 0,
  target_date timestamptz,
  updated_at timestamptz default now()
);

create table if not exists goals (
  id text primary key,
  user_id uuid not null,
  title text not null,
  description text,
  category text not null,
  target_amount numeric,
  current_amount numeric default 0,
  deadline timestamptz,
  importance int default 5,
  status text default 'activo',
  progress int default 0,
  created_at timestamptz default now()
);
create index if not exists goals_user_id_idx on goals(user_id);

create table if not exists tasks (
  id text primary key,
  user_id uuid not null,
  goal_id text,
  title text not null,
  description text,
  due_date timestamptz,
  estimated_minutes int,
  energy_level text,
  difficulty int,
  urgency int,
  money_impact numeric default 0,
  ai_priority_score int,
  ai_reason text,
  status text default 'pendiente',
  manual_order_index int,
  created_at timestamptz default now()
);
create index if not exists tasks_user_id_idx on tasks(user_id);

create table if not exists financial_entries (
  id text primary key,
  user_id uuid not null,
  type text not null,
  title text not null,
  amount numeric not null,
  date timestamptz default now(),
  category text,
  created_at timestamptz default now()
);
create index if not exists financial_entries_user_id_idx on financial_entries(user_id);

create table if not exists money_snapshots (
  id text primary key,
  user_id uuid not null,
  date timestamptz not null,
  total numeric not null,
  note text,
  created_at timestamptz default now()
);
create index if not exists money_snapshots_user_id_idx on money_snapshots(user_id);

create table if not exists user_tools (
  id text primary key,
  user_id uuid not null,
  name text not null,
  description text,
  url text,
  category text not null default 'Productividad',
  tags text[] default '{}',
  free boolean default true,
  cost numeric default 0,
  billing_period text default 'monthly',
  rating int default 5 check (rating between 1 and 5),
  icon text default '🔧',
  highlight boolean default false,
  created_at timestamptz default now()
  -- NOTE: no FK to auth.users — app uses custom UUIDs without Supabase Auth
);
create index if not exists user_tools_user_id_idx on user_tools(user_id);

-- Paywall: cada pago de Stripe queda registrado aquí por la Edge Function
-- verify-payment (code = checkout session id). Crear una cuenta nueva exige
-- un pago verificado; `used` garantiza que un pago solo crea UNA cuenta.
-- El email se actualiza al de la cuenta creada para que Ajustes muestre el plan.
create table if not exists paid_codes (
  code text primary key,
  name text,
  email text,                      -- customer email from Stripe, used for lookup
  paid_at timestamptz default now(),
  stripe_session_id text,
  used boolean default false,
  created_at timestamptz default now()
);
create index if not exists paid_codes_session_idx on paid_codes(stripe_session_id);
create index if not exists paid_codes_email_idx   on paid_codes(email);

-- =============================================
-- Pre-cargar las dos sesiones (Pau y Michelle)
-- =============================================

insert into profiles (user_id, name, email)
values
  ('11111111-1111-1111-1111-111111111111', 'Pau', 'pau@rumbo.app'),
  ('22222222-2222-2222-2222-222222222222', 'Michelle', 'michelle@rumbo.app')
on conflict (user_id) do nothing;

-- =============================================
-- RLS por usuario (Supabase Auth)
-- Cada usuario inicia sesión con email + contraseña; user_id = auth.uid().
-- La base de datos GARANTIZA que cada uno solo lee/escribe sus propias filas,
-- aunque tenga la clave anon. NO uses políticas "using(true)": reabren todo.
-- =============================================

alter table profiles enable row level security;
alter table goals enable row level security;
alter table tasks enable row level security;
alter table financial_entries enable row level security;
alter table money_snapshots enable row level security;
alter table user_tools enable row level security;
alter table paid_codes enable row level security;

-- Borra políticas previas (abiertas o no) para que el script sea repetible.
drop policy if exists "open_all_profiles" on profiles;
drop policy if exists "open_all_goals" on goals;
drop policy if exists "open_all_tasks" on tasks;
drop policy if exists "open_all_financial_entries" on financial_entries;
drop policy if exists "open_all_money_snapshots" on money_snapshots;
drop policy if exists "open_all_user_tools" on user_tools;
drop policy if exists "anon_read_paid_codes"   on paid_codes;
drop policy if exists "anon_update_paid_codes" on paid_codes;
drop policy if exists "own_profiles" on profiles;
drop policy if exists "own_goals" on goals;
drop policy if exists "own_tasks" on tasks;
drop policy if exists "own_financial_entries" on financial_entries;
drop policy if exists "own_money_snapshots" on money_snapshots;
drop policy if exists "own_user_tools" on user_tools;

-- Cada usuario solo puede ver/editar sus propias filas.
create policy "own_profiles" on profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_goals" on goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_tasks" on tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_financial_entries" on financial_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_money_snapshots" on money_snapshots for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_user_tools" on user_tools for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- paid_codes: las Edge Functions (service role) leen y escriben saltándose RLS.
-- Desde el cliente solo se permite UNA lectura: la fila cuyo email coincide con
-- el del propio JWT, para que Ajustes muestre el plan. Nada de escrituras.
drop policy if exists "read_own_paid_code" on paid_codes;
create policy "read_own_paid_code" on paid_codes
  for select to authenticated
  using (email is not null and email = lower(coalesce(auth.jwt()->>'email', '')));
