-- Rumbo · Supabase schema
-- Ejecuta este SQL en tu proyecto de Supabase para preparar la base de datos.

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  created_at timestamptz default now()
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
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

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
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

create table if not exists financial_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  type text not null,
  title text not null,
  amount numeric not null,
  date timestamptz default now(),
  category text,
  created_at timestamptz default now()
);

create table if not exists ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  recommendation text not null,
  created_at timestamptz default now()
);

-- RLS sugerido: cada usuario sólo puede leer/escribir sus propias filas.
alter table goals enable row level security;
alter table tasks enable row level security;
alter table financial_entries enable row level security;
alter table ai_recommendations enable row level security;

create policy "owner can read goals" on goals for select using (auth.uid() = user_id);
create policy "owner can write goals" on goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner can read tasks" on tasks for select using (auth.uid() = user_id);
create policy "owner can write tasks" on tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner can read finances" on financial_entries for select using (auth.uid() = user_id);
create policy "owner can write finances" on financial_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner can read ai" on ai_recommendations for select using (auth.uid() = user_id);
create policy "owner can write ai" on ai_recommendations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
