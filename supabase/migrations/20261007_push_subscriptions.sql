-- Rumbo · dispositivos que pueden recibir avisos (paso 2 de las notificaciones)
-- Ya incluido en supabase/schema.sql. Ejecutar UNA vez en Supabase → SQL Editor.
-- Es idempotente: se puede repetir. No toca ninguna tabla existente.

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
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "own_push_subscriptions" on public.push_subscriptions;
create policy "own_push_subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
