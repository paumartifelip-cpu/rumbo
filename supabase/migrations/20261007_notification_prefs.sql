-- Rumbo · preferencias de avisos (paso 1 de las notificaciones)
-- Ya incluido en supabase/schema.sql. Ejecutar UNA vez en Supabase → SQL Editor.
-- Es idempotente: se puede repetir. No toca ninguna tabla existente.

create table if not exists public.notification_prefs (
  user_id uuid primary key,
  reminder_enabled boolean not null default false,
  reminder_time text not null default '21:00'
    check (reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  timezone text not null default 'UTC',          -- zona IANA: "las 21:00" es la de SU ciudad
  skip_if_logged boolean not null default true,  -- no avisar si ya apuntó algo hoy
  updated_at timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;

drop policy if exists "own_notification_prefs" on public.notification_prefs;
create policy "own_notification_prefs" on public.notification_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
