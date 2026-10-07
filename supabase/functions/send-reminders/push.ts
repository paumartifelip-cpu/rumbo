// Lógica pura del envío de avisos (sin red, sin Deno), para poder probarla con tests.
// IMPORTANTE: este archivo existe con el MISMO contenido en cada función que envía avisos
// (send-test-push y, más adelante, send-reminders); un test comprueba que no se separen.

/** Clave PÚBLICA del sistema de avisos (VAPID). Pública por diseño; la privada vive solo en
 *  los secretos de Supabase (VAPID_PRIVATE_KEY) y nunca se escribe en el código. */
export const VAPID_PUBLIC_KEY =
  "BBLI0YbZF2UQKy6rgXtiAiiQoZrvMM18Kw2zvcjpEpPM-noZBwrX_Zf9X_Q7R0dbrO8ZlVsVVJwgYwhpyW_HCEE";

/** Contacto que Apple y Google ven en cada envío, por si tuvieran que avisarnos de un problema. */
export const VAPID_SUBJECT = "mailto:menosruidomasrumbo@gmail.com";

/** Qué significa la respuesta de Apple/Google a un envío. */
export type ClaseEstado =
  | "ok" // aceptado: llegará al dispositivo
  | "caducado" // ese dispositivo ya no existe (app desinstalada, permiso retirado): hay que borrarlo
  | "config" // rechazan NUESTRA firma o el mensaje: clave mal copiada, o formato inválido
  | "temporal" // fallo pasajero del servicio de Apple/Google o límite de velocidad: reintentar luego
  | "otro";

export function clasificarEstado(estado: number): ClaseEstado {
  if (estado >= 200 && estado < 300) return "ok";
  if (estado === 404 || estado === 410) return "caducado";
  if (estado === 400 || estado === 401 || estado === 403 || estado === 413) return "config";
  if (estado === 429 || estado === 0 || (estado >= 500 && estado < 600)) return "temporal";
  return "otro";
}

export interface ResultadoEnvio {
  endpoint: string;
  /** Código HTTP que devolvió el servicio de Apple/Google; 0 si ni siquiera se pudo conectar. */
  estado: number;
}

export interface Resumen {
  enviados: number;
  caducados: number;
  config: number;
  temporales: number;
  otros: number;
}

export function resumir(resultados: ResultadoEnvio[]): Resumen {
  const r: Resumen = { enviados: 0, caducados: 0, config: 0, temporales: 0, otros: 0 };
  for (const x of resultados) {
    const c = clasificarEstado(x.estado);
    if (c === "ok") r.enviados++;
    else if (c === "caducado") r.caducados++;
    else if (c === "config") r.config++;
    else if (c === "temporal") r.temporales++;
    else r.otros++;
  }
  return r;
}

export interface AvisoPush {
  title: string;
  body: string;
  tag: string;
  url: string;
}

/** El aviso de prueba que se manda al pulsar el botón de Ajustes. */
export function avisoDePrueba(): AvisoPush {
  return {
    title: "Rumbo",
    body: "🧪 Aviso de prueba: ¡esto funciona!",
    tag: "rumbo-prueba",
    url: "/settings/",
  };
}

/** Máximo que admite un aviso push es unos 4 KB; se queda muy por debajo. */
const MAX_BYTES = 2000;

/** Convierte el aviso en el texto que viaja cifrado; recorta el cuerpo si fuera demasiado largo. */
export function serializarAviso(a: AvisoPush): string {
  let cuerpo = a.body;
  let texto = JSON.stringify({ ...a, body: cuerpo });
  while (new TextEncoder().encode(texto).length > MAX_BYTES && cuerpo.length > 10) {
    cuerpo = cuerpo.slice(0, Math.floor(cuerpo.length * 0.8)) + "…";
    texto = JSON.stringify({ ...a, body: cuerpo });
  }
  return texto;
}
