// Preferencias de avisos (recordatorio diario para apuntar gastos). Lógica pura, sin
// React ni red, para poder probarla. La tabla `notification_prefs` guarda una fila por usuario.

export interface PrefsAvisos {
  /** ¿Quiere el recordatorio diario? */
  reminder_enabled: boolean;
  /** Hora local a la que avisar, "HH:MM". */
  reminder_time: string;
  /** Zona horaria IANA ("Europe/Madrid", "America/Mexico_City"…): "las 21:00" es de SU ciudad. */
  timezone: string;
  /** No avisar si ya ha apuntado algo hoy: el recordatorio solo molesta a quien se olvidó. */
  skip_if_logged: boolean;
}

export const HORA_POR_DEFECTO = "21:00";

export const esHora = (s: unknown): s is string =>
  typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** ¿Es un nombre de zona horaria que el navegador/servidor entiende? */
export function esZonaHoraria(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.trim().length === 0) return false;
  try {
    new Intl.DateTimeFormat("es", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Zona horaria del dispositivo; "UTC" si el navegador no la sabe decir. */
export function zonaDelDispositivo(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return esZonaHoraria(tz) ? tz : "UTC";
  } catch {
    return "UTC";
  }
}

/** Horas para elegir: de 06:00 a 23:30, de media en media hora. */
export const HORAS: string[] = Array.from({ length: 36 }, (_, i) => {
  const minutos = 6 * 60 + i * 30;
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
});

/** Zonas habituales entre los usuarios de Rumbo (España y Latinoamérica). */
export const ZONAS_COMUNES: { id: string; nombre: string }[] = [
  { id: "Europe/Madrid", nombre: "España (península y Baleares)" },
  { id: "Atlantic/Canary", nombre: "España (Canarias)" },
  { id: "America/Mexico_City", nombre: "México (Ciudad de México)" },
  { id: "America/Cancun", nombre: "México (Cancún)" },
  { id: "America/Tijuana", nombre: "México (Tijuana)" },
  { id: "America/Bogota", nombre: "Colombia" },
  { id: "America/Lima", nombre: "Perú" },
  { id: "America/Santiago", nombre: "Chile" },
  { id: "America/Argentina/Buenos_Aires", nombre: "Argentina" },
  { id: "America/Asuncion", nombre: "Paraguay" },
  { id: "America/New_York", nombre: "EE. UU. (Este)" },
  { id: "America/Chicago", nombre: "EE. UU. (Centro)" },
  { id: "America/Los_Angeles", nombre: "EE. UU. (Pacífico)" },
  { id: "UTC", nombre: "Hora universal (UTC)" },
];

/**
 * Convierte lo que haya en la tabla (o nada) en preferencias válidas. Lo que falte o esté
 * mal se sustituye por el valor por defecto: la pantalla nunca se rompe por un dato raro.
 */
export function normalizarPrefs(fila: unknown, zonaDispositivo: string): PrefsAvisos {
  const f = (fila && typeof fila === "object" ? fila : {}) as Record<string, unknown>;
  return {
    reminder_enabled: f.reminder_enabled === true,
    reminder_time: esHora(f.reminder_time) ? f.reminder_time : HORA_POR_DEFECTO,
    timezone: esZonaHoraria(f.timezone) ? f.timezone : esZonaHoraria(zonaDispositivo) ? zonaDispositivo : "UTC",
    skip_if_logged: typeof f.skip_if_logged === "boolean" ? f.skip_if_logged : true,
  };
}

/** Fila lista para guardar. Devuelve null si algo no es válido (no se guarda basura). */
export function filaParaGuardar(userId: string, p: PrefsAvisos, ahora: Date = new Date()) {
  if (!userId || !esHora(p.reminder_time) || !esZonaHoraria(p.timezone)) return null;
  return {
    user_id: userId,
    reminder_enabled: Boolean(p.reminder_enabled),
    reminder_time: p.reminder_time,
    timezone: p.timezone,
    skip_if_logged: Boolean(p.skip_if_logged),
    updated_at: ahora.toISOString(),
  };
}

// ── Candado de pruebas ────────────────────────────────────────────────────────
// Mientras los avisos no se envíen de verdad, la sección de Ajustes está OCULTA para los
// usuarios. Se activa visitando /settings/?avisos=1 (y se quita con ?avisos=0); la
// elección se recuerda en este dispositivo. Cuando todo funcione, se quita este candado.

export const CLAVE_BETA = "rumbo_avisos_beta";
export const EVENTO_BETA = "rumbo-avisos-beta";

type Almacen = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** ¿Está activado el candado de pruebas en este dispositivo? Solo lee. */
export function avisosBetaActivo(almacen: Pick<Storage, "getItem"> | null): boolean {
  try {
    return almacen?.getItem(CLAVE_BETA) === "1";
  } catch {
    return false;
  }
}

/** Aplica ?avisos=1 / ?avisos=0 de la dirección. Devuelve true si cambió algo. */
export function aplicarParametroAvisos(almacen: Almacen | null, busqueda: string): boolean {
  if (!almacen) return false;
  try {
    const v = new URLSearchParams(busqueda).get("avisos");
    if (v === "1" && almacen.getItem(CLAVE_BETA) !== "1") { almacen.setItem(CLAVE_BETA, "1"); return true; }
    if (v === "0" && almacen.getItem(CLAVE_BETA) !== null) { almacen.removeItem(CLAVE_BETA); return true; }
  } catch {
    /* modo privado o almacenamiento bloqueado: se queda desactivado */
  }
  return false;
}
