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

-- =============================================
-- Pre-cargar las dos sesiones (Pau y Michelle)
-- =============================================

insert into profiles (user_id, name, email)
values
  ('11111111-1111-1111-1111-111111111111', 'Pau', 'pau@rumbo.app'),
  ('22222222-2222-2222-2222-222222222222', 'Michelle', 'michelle@rumbo.app')
on conflict (user_id) do nothing;

-- =============================================
-- RLS abierto (sin auth)
-- Permite lectura/escritura con la clave anon. Apto para una app personal
-- de dos perfiles preconfigurados. Si añades auth real más adelante,
-- reemplaza estas políticas por las basadas en auth.uid().
-- =============================================

alter table profiles enable row level security;
alter table goals enable row level security;
alter table tasks enable row level security;
alter table financial_entries enable row level security;
alter table money_snapshots enable row level security;

-- Borra políticas previas para que el script sea repetible.
drop policy if exists "open_all_profiles" on profiles;
drop policy if exists "open_all_goals" on goals;
drop policy if exists "open_all_tasks" on tasks;
drop policy if exists "open_all_financial_entries" on financial_entries;
drop policy if exists "open_all_money_snapshots" on money_snapshots;

create policy "open_all_profiles" on profiles for all using (true) with check (true);
create policy "open_all_goals" on goals for all using (true) with check (true);
create policy "open_all_tasks" on tasks for all using (true) with check (true);
create policy "open_all_financial_entries" on financial_entries for all using (true) with check (true);
create policy "open_all_money_snapshots" on money_snapshots for all using (true) with check (true);
