// Envía un aviso de PRUEBA a los dispositivos registrados de la persona que pulsa el botón
// «Enviar aviso de prueba» en Ajustes → Avisos y recordatorios.
//
// Seguridad: exige sesión (verify_jwt activado) y además comprueba el token para saber QUIÉN
// es: solo se avisa a los dispositivos de esa misma persona, nunca a los de otra.
//
// Secretos necesarios (Supabase → Edge Functions → Secrets):
//   VAPID_PRIVATE_KEY   clave privada del sistema de avisos (la pareja de VAPID_PUBLIC_KEY)

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  VAPID_PUBLIC_KEY,
  VAPID_SUBJECT,
  avisoDePrueba,
  clasificarEstado,
  resumir,
  serializarAviso,
  type ResultadoEnvio,
} from './push.ts';

const supa = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);
const vapidPrivada = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// Máximo de dispositivos por persona al que se envía de una vez (evita abusos).
const MAX_DISPOSITIVOS = 10;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, motivo: 'metodo' }, 405);
  if (!vapidPrivada) return json({ ok: false, motivo: 'sin_clave' }, 500);

  // ¿Quién es? Se valida el token de la sesión; no nos fiamos de lo que diga el navegador.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: sesion, error: errSesion } = await supa.auth.getUser(token);
  if (errSesion || !sesion?.user) return json({ ok: false, motivo: 'no_autenticado' }, 401);
  const userId = sesion.user.id;

  const { data: dispositivos, error: errDisp } = await supa
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)
    .limit(MAX_DISPOSITIVOS);
  if (errDisp) {
    console.error('push_subscriptions select error', errDisp);
    return json({ ok: false, motivo: 'db_error' }, 500);
  }
  if (!dispositivos || dispositivos.length === 0) {
    return json({ ok: true, dispositivos: 0, enviados: 0, caducados: 0, config: 0, temporales: 0, otros: 0 });
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, vapidPrivada);
  const mensaje = serializarAviso(avisoDePrueba());

  const resultados: ResultadoEnvio[] = await Promise.all(
    dispositivos.map(async (d): Promise<ResultadoEnvio> => {
      try {
        const r = await webpush.sendNotification(
          { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
          mensaje,
          { TTL: 60, urgency: 'high' }
        );
        return { endpoint: d.endpoint, estado: r.statusCode };
      } catch (err) {
        const estado = (err as { statusCode?: number })?.statusCode ?? 0;
        console.error('envío fallido', estado, String((err as Error)?.message ?? err).slice(0, 200));
        return { endpoint: d.endpoint, estado };
      }
    })
  );

  // Dispositivos que ya no existen (410/404): se borran para no volver a intentarlo.
  const caducados = resultados.filter((r) => clasificarEstado(r.estado) === 'caducado').map((r) => r.endpoint);
  if (caducados.length > 0) {
    const { error } = await supa.from('push_subscriptions').delete().eq('user_id', userId).in('endpoint', caducados);
    if (error) console.error('no se pudieron borrar dispositivos caducados', error);
  }

  // Solo se devuelven CANTIDADES, nunca las direcciones de entrega.
  return json({ ok: true, dispositivos: dispositivos.length, ...resumir(resultados) });
});
