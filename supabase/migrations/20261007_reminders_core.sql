-- Rumbo · recordatorio diario (parte B de las notificaciones): a quién avisar y cuándo.
-- Ya incluido en supabase/schema.sql. Es idempotente: se puede repetir.

-- Último día (en la zona horaria DE LA PERSONA) en que se le envió el recordatorio.
alter table public.notification_prefs add column if not exists last_reminder_on date;

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
