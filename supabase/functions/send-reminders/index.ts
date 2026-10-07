// Recordatorio diario. Lo despierta el reloj de la base de datos (pg_cron) cada 5 minutos.
//
// Seguridad: sin sesión de usuario (verify_jwt desactivado). Solo acepta llamadas con la
// cabecera x-cron-token igual al token secreto guardado en la base de datos (esquema privado).
//
// Modo `?dry=1` (prueba en seco): solo cuenta a cuántas personas avisaría, no envía nada
// y no marca nada.
//
// Secretos necesarios: VAPID_PRIVATE_KEY.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  VAPID_PUBLIC_KEY,
  VAPID_SUBJECT,
  clasificarEstado,
  serializarAviso,
  type ResultadoEnvio,
} from './push.ts';
import { avisoRecordatorio } from './recordatorios.ts';

const supa = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);
const vapidPrivada = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

/** Comparación que tarda lo mismo acierte o falle (no delata el token por el tiempo). */
function iguales(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let dif = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) dif |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return dif === 0;
}

const MAX_DISPOSITIVOS = 10;
const MAX_PERSONAS = 500;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ ok: false, motivo: 'metodo' }, 405);

  const { data: esperado, error: errTok } = await supa.rpc('leer_cron_token');
  const recibido = req.headers.get('x-cron-token') ?? '';
  if (errTok || typeof esperado !== 'string' || esperado.length < 32 || !iguales(recibido, esperado)) {
    return json({ ok: false, motivo: 'no_autorizado' }, 401);
  }

  const seco = new URL(req.url).searchParams.get('dry') === '1';
  if (!seco && !vapidPrivada) return json({ ok: false, motivo: 'sin_clave' }, 500);

  const { data: pendientes, error: errPend } = await supa.rpc('recordatorios_pendientes');
  if (errPend) {
    console.error('recordatorios_pendientes error', errPend);
    return json({ ok: false, motivo: 'db_error' }, 500);
  }
  const lista = (pendientes ?? []).slice(0, MAX_PERSONAS) as { usuario: string; fecha_local: string }[];
  if (seco) return json({ ok: true, seco: true, avisaria_a: lista.length });
  if (lista.length === 0) return json({ ok: true, personas: 0, avisados: 0 });

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, vapidPrivada);

  let avisados = 0, sinDispositivo = 0, reintentar = 0, yaReclamado = 0, caducadosTotal = 0;

  for (const p of lista) {
    // Reclamar el día de forma atómica: si dos llamadas coinciden, solo una gana y avisa.
    const { data: reclamado, error: errRec } = await supa
      .from('notification_prefs')
      .update({ last_reminder_on: p.fecha_local })
      .eq('user_id', p.usuario)
      .or(`last_reminder_on.is.null,last_reminder_on.neq.${p.fecha_local}`)
      .select('user_id');
    if (errRec) { console.error('reclamar error', errRec); reintentar++; continue; }
    if (!reclamado || reclamado.length === 0) { yaReclamado++; continue; }

    const soltar = async () => {
      await supa.from('notification_prefs').update({ last_reminder_on: null }).eq('user_id', p.usuario).eq('last_reminder_on', p.fecha_local);
    };

    const { data: dispositivos, error: errDisp } = await supa
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', p.usuario)
      .limit(MAX_DISPOSITIVOS);
    if (errDisp) { console.error('dispositivos error', errDisp); await soltar(); reintentar++; continue; }
    if (!dispositivos || dispositivos.length === 0) { sinDispositivo++; continue; }

    const mensaje = serializarAviso(avisoRecordatorio(p.fecha_local));
    const resultados: ResultadoEnvio[] = await Promise.all(
      dispositivos.map(async (d): Promise<ResultadoEnvio> => {
        try {
          const r = await webpush.sendNotification(
            { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
            mensaje,
            { TTL: 3600, urgency: 'normal' }
          );
          return { endpoint: d.endpoint, estado: r.statusCode };
        } catch (err) {
          const estado = (err as { statusCode?: number })?.statusCode ?? 0;
          console.error('envío fallido', estado, String((err as Error)?.message ?? err).slice(0, 200));
          return { endpoint: d.endpoint, estado };
        }
      })
    );

    const caducados = resultados.filter((r) => clasificarEstado(r.estado) === 'caducado').map((r) => r.endpoint);
    if (caducados.length > 0) {
      const { error } = await supa.from('push_subscriptions').delete().eq('user_id', p.usuario).in('endpoint', caducados);
      if (error) console.error('no se pudieron borrar dispositivos caducados', error);
      caducadosTotal += caducados.length;
    }

    if (resultados.some((r) => clasificarEstado(r.estado) === 'ok')) {
      avisados++;
    } else if (resultados.every((r) => clasificarEstado(r.estado) === 'caducado')) {
      sinDispositivo++; // todos los dispositivos habían desaparecido: no hay a quién avisar
    } else {
      await soltar(); // fallo pasajero o de configuración: se reintenta en el siguiente turno (dentro de su hora)
      reintentar++;
    }
  }

  // Solo cantidades, nunca identificadores ni direcciones.
  return json({
    ok: true,
    personas: lista.length,
    avisados,
    sin_dispositivo: sinDispositivo,
    para_reintentar: reintentar,
    ya_reclamado: yaReclamado,
    caducados: caducadosTotal,
  });
});
