-- Rumbo · recordatorio diario (parte B): el reloj que despierta a la función cada 5 minutos.
-- NO está en supabase/schema.sql a propósito: necesita las extensiones pg_cron y pg_net de
-- Supabase, que no existen en la base de datos de pruebas. Es idempotente.
--
-- Cómo se enlaza todo:
--   pg_cron (cada 5 min) → public.disparar_recordatorios() → pg_net llama a la función
--   `send-reminders` con un token secreto → la función pregunta a recordatorios_pendientes()
--   y envía los avisos.
--
-- El token vive SOLO en la base de datos (esquema privado), generado aquí mismo: no sale
-- por el chat ni por el código.
--
-- INTERRUPTOR DE EMERGENCIA (apaga los recordatorios al instante):
--     select cron.unschedule('send-reminders');
-- Para volver a encenderlos: la orden `cron.schedule` del final de este archivo.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.cron_config (
  clave text primary key,
  valor text not null
);
alter table private.cron_config enable row level security;   -- sin políticas: invisible desde la web

insert into private.cron_config (clave, valor)
values ('recordatorios_token', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (clave) do nothing;

-- La función del servidor lee el token con esto para comprobar que quien la llama es el reloj.
create or replace function public.leer_cron_token()
returns text
language sql
security definer
set search_path = pg_catalog, private
as $$
  select valor from private.cron_config where clave = 'recordatorios_token'
$$;
revoke all on function public.leer_cron_token() from public, anon, authenticated;
grant execute on function public.leer_cron_token() to service_role;

-- Llama a la función `send-reminders`. Con solo_contar = true NO envía nada: solo dice a
-- cuántas personas avisaría (prueba en seco). Devuelve el id de la llamada; su respuesta queda
-- en net._http_response.
create or replace function public.disparar_recordatorios(solo_contar boolean default false)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  llamada bigint;
begin
  select net.http_post(
    url := 'https://rwizskngajpmuisbdsaz.supabase.co/functions/v1/send-reminders'
           || case when solo_contar then '?dry=1' else '' end,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-token', (select valor from private.cron_config where clave = 'recordatorios_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  ) into llamada;
  return llamada;
end;
$$;
revoke all on function public.disparar_recordatorios(boolean) from public, anon, authenticated;
grant execute on function public.disparar_recordatorios(boolean) to service_role;

-- ENCENDER EL RELOJ (cada 5 minutos). Se ejecuta aparte, cuando todo está probado:
-- select cron.schedule('send-reminders', '*/5 * * * *', $$select public.disparar_recordatorios()$$);
