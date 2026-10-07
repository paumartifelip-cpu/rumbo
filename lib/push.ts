// Notificaciones push en el navegador: permiso, suscripción del dispositivo y su registro en
// la tabla `push_subscriptions`. La lógica que no depende del navegador está separada y
// probada; lo que sí (pedir permiso, suscribirse) entra por `Entorno` para poder simularlo.

import { getSupabase } from "./supabase";

/** Clave PÚBLICA del sistema de avisos (VAPID). Es pública por diseño; la privada vive solo en
 *  los secretos de Supabase y se usa para firmar los envíos (paso 3). */
export const VAPID_PUBLIC_KEY =
  "BBLI0YbZF2UQKy6rgXtiAiiQoZrvMM18Kw2zvcjpEpPM-noZBwrX_Zf9X_Q7R0dbrO8ZlVsVVJwgYwhpyW_HCEE";

export type PermisoNotificaciones = "default" | "granted" | "denied";

/** Qué situación tiene ESTE dispositivo respecto a los avisos. */
export type DiagnosticoPush =
  | "no_soportado" // el navegador no sabe de avisos
  | "iphone_sin_instalar" // iPhone/iPad: solo funcionan con Rumbo en la pantalla de inicio
  | "denegado" // el usuario dijo que no (hay que activarlo en los ajustes del móvil)
  | "pendiente" // aún no se ha preguntado
  | "concedido"; // permiso dado

export interface DatosDispositivo {
  tieneServiceWorker: boolean;
  tienePushManager: boolean;
  tieneNotification: boolean;
  esIOS: boolean;
  esAppInstalada: boolean; // abierta desde el icono de la pantalla de inicio
  permiso: PermisoNotificaciones;
}

/** Decide qué decirle al usuario. Pura: se prueba sin móvil. */
export function diagnosticarPush(d: DatosDispositivo): DiagnosticoPush {
  // En iPhone, fuera de la app instalada, Safari ni siquiera ofrece push: se explica cómo instalar.
  if (d.esIOS && !d.esAppInstalada) return "iphone_sin_instalar";
  if (!d.tieneServiceWorker || !d.tienePushManager || !d.tieneNotification) return "no_soportado";
  if (d.permiso === "denied") return "denegado";
  if (d.permiso === "granted") return "concedido";
  return "pendiente";
}

/** La clave pública va en base64 "url-safe"; el navegador la quiere como bytes. */
export function urlBase64ABytes(b64: string): Uint8Array {
  const relleno = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const crudo = atob(base64);
  const bytes = new Uint8Array(crudo.length);
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
  return bytes;
}

export interface SuscripcionJSON {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

export interface FilaSuscripcion {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  last_seen_at: string;
}

/** Fila lista para guardar, o null si la suscripción no trae todo lo necesario. */
export function filaDeSuscripcion(
  userId: string,
  sub: SuscripcionJSON | null | undefined,
  userAgent: string | null | undefined,
  ahora: Date = new Date()
): FilaSuscripcion | null {
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!userId || !endpoint || !p256dh || !auth) return null;
  // Solo direcciones https: así nunca se guarda un destino raro o local.
  if (!/^https:\/\//.test(endpoint)) return null;
  return {
    user_id: userId,
    endpoint,
    p256dh,
    auth,
    user_agent: userAgent ? userAgent.slice(0, 200) : null,
    last_seen_at: ahora.toISOString(),
  };
}

export type MotivoFallo = "no_soportado" | "iphone_sin_instalar" | "denegado" | "error_suscripcion" | "error_guardado";
export type ResultadoRegistro = { ok: true } | { ok: false; motivo: MotivoFallo };

/** Lo que necesitamos del navegador y de la base de datos. En los tests se simula. */
export interface Entorno {
  diagnostico(): DiagnosticoPush;
  pedirPermiso(): Promise<PermisoNotificaciones>;
  suscribir(): Promise<SuscripcionJSON>;
  guardar(fila: FilaSuscripcion): Promise<{ error: unknown }>;
  userAgent(): string | null;
}

/**
 * Pide permiso (si hace falta), suscribe el dispositivo y lo registra.
 * IMPORTANTE: debe llamarse DIRECTAMENTE desde un toque del usuario, y lo primero que hace
 * es pedir el permiso, antes de cualquier espera: Safari exige que sea inmediato.
 */
export async function registrarDispositivo(userId: string, entorno: Entorno): Promise<ResultadoRegistro> {
  const diag = entorno.diagnostico();
  if (diag === "no_soportado" || diag === "iphone_sin_instalar" || diag === "denegado") {
    return { ok: false, motivo: diag };
  }

  if (diag === "pendiente") {
    const permiso = await entorno.pedirPermiso();
    // "default" tras preguntar significa que cerró el aviso sin elegir: no se activa nada.
    if (permiso !== "granted") return { ok: false, motivo: "denegado" };
  }

  let sub: SuscripcionJSON;
  try {
    sub = await entorno.suscribir();
  } catch {
    return { ok: false, motivo: "error_suscripcion" };
  }
  const fila = filaDeSuscripcion(userId, sub, entorno.userAgent());
  if (!fila) return { ok: false, motivo: "error_suscripcion" };

  const { error } = await entorno.guardar(fila);
  return error ? { ok: false, motivo: "error_guardado" } : { ok: true };
}

/** Texto para el usuario según el diagnóstico (sin jerga). */
export function textoDiagnostico(d: DiagnosticoPush): { titulo: string; detalle: string } {
  switch (d) {
    case "iphone_sin_instalar":
      return {
        titulo: "Para recibir avisos en iPhone, instala Rumbo",
        detalle:
          "En Safari pulsa el botón de compartir ⬆️ y elige «Añadir a pantalla de inicio». Luego abre Rumbo desde ese icono y vuelve aquí.",
      };
    case "denegado":
      return {
        titulo: "Las notificaciones están bloqueadas",
        detalle:
          "Rumbo no puede avisarte porque las rechazaste. Actívalas en los ajustes del móvil (Notificaciones → Rumbo) o, en el navegador, en el candado junto a la dirección.",
      };
    case "no_soportado":
      return {
        titulo: "Este navegador no admite avisos",
        detalle: "Prueba con Chrome, Edge o Safari actualizados, o desde el móvil con Rumbo instalado.",
      };
    case "concedido":
      return { titulo: "Permiso concedido", detalle: "Este dispositivo puede recibir avisos de Rumbo." };
    default:
      return {
        titulo: "Aún no hemos pedido permiso",
        detalle: "Al guardar con el recordatorio activado, el móvil te preguntará si permites las notificaciones.",
      };
  }
}

// ── Lo que sí toca el navegador y la base de datos ───────────────────────────

/** Entorno real: el navegador de verdad y Supabase. Solo se usa desde un toque del usuario. */
export function entornoReal(): Entorno {
  return {
    diagnostico: () => diagnosticarPush(datosDelDispositivo()),
    pedirPermiso: () => Notification.requestPermission() as Promise<PermisoNotificaciones>,
    suscribir: async () => {
      const reg = await navigator.serviceWorker.ready;
      const existente = await reg.pushManager.getSubscription();
      const sub =
        existente ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ABytes(VAPID_PUBLIC_KEY) as BufferSource,
        }));
      return sub.toJSON() as SuscripcionJSON;
    },
    guardar: async (fila) => {
      const supa = getSupabase();
      if (!supa) return { error: new Error("sin conexión con Supabase") };
      return supa.from("push_subscriptions").upsert(fila, { onConflict: "endpoint" });
    },
    userAgent: () => (typeof navigator !== "undefined" ? navigator.userAgent : null),
  };
}

/** Lo que este navegador sabe hacer y en qué situación está. */
export function datosDelDispositivo(): DatosDispositivo {
  const hayVentana = typeof window !== "undefined" && typeof navigator !== "undefined";
  const ua = hayVentana ? navigator.userAgent : "";
  // Los iPad modernos se presentan como Mac: se distinguen por tener pantalla táctil.
  const esIOS =
    /iPad|iPhone|iPod/.test(ua) || (hayVentana && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const esAppInstalada =
    hayVentana &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true);
  return {
    tieneServiceWorker: hayVentana && "serviceWorker" in navigator,
    tienePushManager: hayVentana && "PushManager" in window,
    tieneNotification: hayVentana && "Notification" in window,
    esIOS,
    esAppInstalada,
    permiso: hayVentana && "Notification" in window ? (Notification.permission as PermisoNotificaciones) : "default",
  };
}

/** ¿Está ESTE dispositivo ya suscrito (en el navegador)? */
export async function dispositivoSuscrito(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    return Boolean(reg && (await reg.pushManager.getSubscription()));
  } catch {
    return false;
  }
}

/** Quita ESTE dispositivo: se da de baja en el navegador y se borra su fila. */
export async function quitarDispositivo(): Promise<{ ok: boolean }> {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return { ok: true };
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (!sub) return { ok: true };
    const endpoint = sub.endpoint;
    const supa = getSupabase();
    if (supa) {
      const { error } = await supa.from("push_subscriptions").delete().eq("endpoint", endpoint);
      if (error) return { ok: false }; // no se da de baja en el navegador si no se pudo borrar la fila
    }
    await sub.unsubscribe();
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
