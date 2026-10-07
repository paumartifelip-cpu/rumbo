import { describe, expect, it } from "vitest";
import {
  CLAVE_BETA, HORAS, HORA_POR_DEFECTO, ZONAS_COMUNES, aplicarParametroAvisos, avisosBetaActivo,
  esHora, esZonaHoraria, filaParaGuardar, hayCambios, normalizarPrefs, zonaDelDispositivo,
} from "@/lib/avisos";

describe("horas", () => {
  it("acepta HH:MM válidos y rechaza el resto", () => {
    for (const ok of ["00:00", "07:30", "21:00", "23:59"]) expect(esHora(ok), ok).toBe(true);
    for (const mal of ["24:00", "9:00", "21:60", "21:5", "las nueve", "", null, undefined, 2100]) expect(esHora(mal), String(mal)).toBe(false);
  });

  it("la lista para elegir va de 06:00 a 23:30 de media en media hora, y todas son válidas", () => {
    expect(HORAS[0]).toBe("06:00");
    expect(HORAS.at(-1)).toBe("23:30");
    expect(HORAS).toHaveLength(36);
    expect(new Set(HORAS).size).toBe(HORAS.length);
    expect(HORAS.every(esHora)).toBe(true);
    expect(HORAS).toContain(HORA_POR_DEFECTO);
  });

  it("la hora por defecto es las 21:00", () => expect(HORA_POR_DEFECTO).toBe("21:00"));
});

describe("zonas horarias", () => {
  it("reconoce zonas reales y rechaza inventadas o vacías", () => {
    for (const ok of ["Europe/Madrid", "America/Mexico_City", "UTC"]) expect(esZonaHoraria(ok), ok).toBe(true);
    for (const mal of ["Marte/Olympus", "", "  ", null, undefined, 5]) expect(esZonaHoraria(mal), String(mal)).toBe(false);
  });

  it("todas las zonas de la lista que se enseña al usuario son válidas y no se repiten", () => {
    for (const z of ZONAS_COMUNES) expect(esZonaHoraria(z.id), z.id).toBe(true);
    expect(new Set(ZONAS_COMUNES.map((z) => z.id)).size).toBe(ZONAS_COMUNES.length);
  });

  it("incluye España y los países de los usuarios de Rumbo", () => {
    const ids = ZONAS_COMUNES.map((z) => z.id);
    for (const z of ["Europe/Madrid", "Atlantic/Canary", "America/Mexico_City", "America/Bogota", "America/Argentina/Buenos_Aires"]) expect(ids).toContain(z);
  });

  it("la del dispositivo siempre es válida", () => expect(esZonaHoraria(zonaDelDispositivo())).toBe(true));
});

describe("normalizarPrefs (lo que haya en la tabla, o nada)", () => {
  it("sin fila: apagado, 21:00, zona del dispositivo y no avisar si ya apuntó", () => {
    expect(normalizarPrefs(null, "America/Mexico_City")).toEqual({
      reminder_enabled: false, reminder_time: "21:00", timezone: "America/Mexico_City", skip_if_logged: true,
    });
    expect(normalizarPrefs(undefined, "Europe/Madrid").reminder_enabled).toBe(false);
  });

  it("respeta lo guardado cuando es válido", () => {
    const p = normalizarPrefs({ reminder_enabled: true, reminder_time: "08:30", timezone: "Europe/Madrid", skip_if_logged: false }, "UTC");
    expect(p).toEqual({ reminder_enabled: true, reminder_time: "08:30", timezone: "Europe/Madrid", skip_if_logged: false });
  });

  it("un dato roto se sustituye por el valor por defecto, sin romper la pantalla", () => {
    const p = normalizarPrefs({ reminder_enabled: "sí", reminder_time: "tarde", timezone: "Marte/Olympus", skip_if_logged: "no" }, "America/Lima");
    expect(p).toEqual({ reminder_enabled: false, reminder_time: "21:00", timezone: "America/Lima", skip_if_logged: true });
  });

  it("si hasta la zona del dispositivo es inválida, cae en UTC", () => {
    expect(normalizarPrefs({}, "inventada").timezone).toBe("UTC");
  });

  it("tolera basura que no es un objeto", () => {
    for (const x of [42, "texto", [], true]) expect(() => normalizarPrefs(x, "UTC")).not.toThrow();
  });
});

describe("filaParaGuardar", () => {
  const ok = { reminder_enabled: true, reminder_time: "21:00", timezone: "Europe/Madrid", skip_if_logged: true };
  const ahora = new Date("2026-10-07T12:00:00.000Z");

  it("produce la fila con el usuario y la fecha", () => {
    expect(filaParaGuardar("u-1", ok, ahora)).toEqual({ user_id: "u-1", ...ok, updated_at: "2026-10-07T12:00:00.000Z" });
  });

  it("no guarda basura: hora o zona inválidas, o sin usuario → null", () => {
    expect(filaParaGuardar("u-1", { ...ok, reminder_time: "25:00" })).toBeNull();
    expect(filaParaGuardar("u-1", { ...ok, timezone: "Marte" })).toBeNull();
    expect(filaParaGuardar("", ok)).toBeNull();
  });
});

describe("candado de pruebas de los avisos", () => {
  const almacenFalso = () => {
    const d = new Map<string, string>();
    return { getItem: (k: string) => d.get(k) ?? null, setItem: (k: string, v: string) => void d.set(k, v), removeItem: (k: string) => void d.delete(k) };
  };

  it("por defecto está cerrado: los usuarios no ven la sección", () => {
    expect(avisosBetaActivo(almacenFalso())).toBe(false);
    expect(avisosBetaActivo(null)).toBe(false);
  });

  it("?avisos=1 lo abre y se recuerda; ?avisos=0 lo cierra", () => {
    const a = almacenFalso();
    expect(aplicarParametroAvisos(a, "?avisos=1")).toBe(true);
    expect(a.getItem(CLAVE_BETA)).toBe("1");
    expect(avisosBetaActivo(a)).toBe(true);
    expect(aplicarParametroAvisos(a, "")).toBe(false); // sin parámetro no cambia nada
    expect(avisosBetaActivo(a)).toBe(true);
    expect(aplicarParametroAvisos(a, "?avisos=0")).toBe(true);
    expect(avisosBetaActivo(a)).toBe(false);
  });

  it("repetir el parámetro no avisa de cambios otra vez", () => {
    const a = almacenFalso();
    aplicarParametroAvisos(a, "?avisos=1");
    expect(aplicarParametroAvisos(a, "?avisos=1")).toBe(false);
  });

  it("valores raros no lo abren", () => {
    const a = almacenFalso();
    for (const q of ["?avisos=2", "?avisos=true", "?otra=1", "avisos=1x"]) aplicarParametroAvisos(a, q);
    expect(avisosBetaActivo(a)).toBe(false);
  });

  it("si el almacenamiento falla (modo privado), no rompe y queda cerrado", () => {
    const roto = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("bloqueado"); }, removeItem: () => { throw new Error("bloqueado"); } };
    expect(() => aplicarParametroAvisos(roto, "?avisos=1")).not.toThrow();
    expect(avisosBetaActivo(roto)).toBe(false);
  });
});

describe("hayCambios (activa el botón Guardar)", () => {
  const base = { reminder_enabled: true, reminder_time: "21:00", timezone: "Europe/Madrid", skip_if_logged: true };

  it("sin tocar nada no hay cambios: el botón queda apagado", () => {
    expect(hayCambios(base, { ...base })).toBe(false);
  });

  it("cualquier campo distinto cuenta como cambio", () => {
    expect(hayCambios(base, { ...base, reminder_enabled: false })).toBe(true);
    expect(hayCambios(base, { ...base, reminder_time: "22:00" })).toBe(true);
    expect(hayCambios(base, { ...base, timezone: "America/Bogota" })).toBe(true);
    expect(hayCambios(base, { ...base, skip_if_logged: false })).toBe(true);
  });

  it("volver al valor original deja de ser un cambio", () => {
    const tocado = { ...base, reminder_time: "22:00" };
    expect(hayCambios(base, tocado)).toBe(true);
    expect(hayCambios(base, { ...tocado, reminder_time: "21:00" })).toBe(false);
  });

  it("mientras no se han cargado las preferencias no hay nada que guardar", () => {
    expect(hayCambios(null, base)).toBe(false);
    expect(hayCambios(base, null)).toBe(false);
    expect(hayCambios(null, null)).toBe(false);
  });
});
