import { describe, expect, it } from "vitest";
import {
  HORAS, HORA_POR_DEFECTO, ZONAS_COMUNES,
  esHora, esZonaHoraria, filaParaGuardar, hayCambios, normalizarPrefs, prefsIniciales, zonaDelDispositivo,
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

describe("prefsIniciales: el recordatorio viene activado por defecto", () => {
  it("sin nada guardado: el borrador viene ACTIVADO, pero lo guardado sigue desactivado (no se activa a escondidas)", () => {
    for (const nada of [null, undefined, {}]) {
      const r = prefsIniciales(nada, "Europe/Madrid");
      expect(r.hayFila).toBe(false);
      expect(r.borrador).toEqual({ reminder_enabled: true, reminder_time: "21:00", timezone: "Europe/Madrid", skip_if_logged: true });
      expect(r.guardadas.reminder_enabled).toBe(false);
      expect(hayCambios(r.guardadas, r.borrador)).toBe(true); // el botón Guardar queda disponible
    }
  });
  it("con preferencias ya guardadas: se respeta lo que eligió, también si lo apagó", () => {
    const apagado = prefsIniciales({ reminder_enabled: false, reminder_time: "08:00", timezone: "UTC", skip_if_logged: true }, "Europe/Madrid");
    expect(apagado.hayFila).toBe(true);
    expect(apagado.borrador.reminder_enabled).toBe(false);
    expect(hayCambios(apagado.guardadas, apagado.borrador)).toBe(false);
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
