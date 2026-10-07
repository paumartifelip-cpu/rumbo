import { readFileSync, readdirSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  VAPID_PUBLIC_KEY as CLAVE_SERVIDOR,
  VAPID_SUBJECT,
  avisoDePrueba,
  clasificarEstado,
  resumir,
  serializarAviso,
} from "../supabase/functions/send-test-push/push";
import { VAPID_PUBLIC_KEY as CLAVE_NAVEGADOR, textoResultadoPrueba } from "@/lib/push";

describe("clasificarEstado: qué significa la respuesta de Apple/Google", () => {
  it("2xx = entregado", () => {
    for (const s of [200, 201, 202]) expect(clasificarEstado(s), String(s)).toBe("ok");
  });
  it("404 y 410 = ese dispositivo ya no existe (se borra)", () => {
    expect(clasificarEstado(404)).toBe("caducado");
    expect(clasificarEstado(410)).toBe("caducado");
  });
  it("400/401/403/413 = nos rechazan a nosotros (clave o formato): no se borra el dispositivo", () => {
    for (const s of [400, 401, 403, 413]) expect(clasificarEstado(s), String(s)).toBe("config");
  });
  it("429, 5xx y sin conexión = pasajero: reintentar luego, sin borrar nada", () => {
    for (const s of [429, 500, 502, 503, 0]) expect(clasificarEstado(s), String(s)).toBe("temporal");
  });
  it("lo raro cae en «otro» y nunca se interpreta como entregado ni como caducado", () => {
    for (const s of [301, 418, 499]) expect(clasificarEstado(s), String(s)).toBe("otro");
  });
});

describe("resumir", () => {
  it("cuenta cada tipo por separado y suma todo", () => {
    const r = resumir([
      { endpoint: "a", estado: 201 }, { endpoint: "b", estado: 201 }, { endpoint: "c", estado: 410 },
      { endpoint: "d", estado: 403 }, { endpoint: "e", estado: 503 }, { endpoint: "f", estado: 418 },
    ]);
    expect(r).toEqual({ enviados: 2, caducados: 1, config: 1, temporales: 1, otros: 1 });
  });
  it("sin envíos, todo a cero", () => {
    expect(resumir([])).toEqual({ enviados: 0, caducados: 0, config: 0, temporales: 0, otros: 0 });
  });
});

describe("el aviso de prueba", () => {
  it("lleva título, texto, etiqueta y dirección de Rumbo, y NO lleva importes", () => {
    const a = avisoDePrueba();
    expect(a.title).toBe("Rumbo");
    expect(a.body.length).toBeGreaterThan(10);
    expect(a.url.startsWith("/")).toBe(true); // una página de Rumbo, nunca una web externa
    expect(JSON.stringify(a)).not.toMatch(/[€$]\s?\d|\d\s?[€$]/);
  });

  it("serializarAviso produce JSON válido que se recupera igual", () => {
    expect(JSON.parse(serializarAviso(avisoDePrueba()))).toEqual(avisoDePrueba());
  });

  it("un cuerpo larguísimo se recorta para no pasar del límite del servicio de avisos", () => {
    const largo = { ...avisoDePrueba(), body: "x".repeat(20000) };
    const t = serializarAviso(largo);
    expect(new TextEncoder().encode(t).length).toBeLessThanOrEqual(2000);
    expect(JSON.parse(t).body.endsWith("…")).toBe(true);
  });

  it("los emojis (varios bytes) no rompen el límite", () => {
    const t = serializarAviso({ ...avisoDePrueba(), body: "🧭".repeat(3000) });
    expect(new TextEncoder().encode(t).length).toBeLessThanOrEqual(2000);
    expect(() => JSON.parse(t)).not.toThrow();
  });
});

describe("las dos claves públicas (servidor y navegador) son la misma", () => {
  it("si no coincidieran, los avisos se rechazarían: el navegador suscribe con una y el servidor firma con otra", () => {
    expect(CLAVE_SERVIDOR).toBe(CLAVE_NAVEGADOR);
  });
  it("el contacto del envío es un correo de Rumbo", () => {
    expect(VAPID_SUBJECT).toBe("mailto:menosruidomasrumbo@gmail.com");
  });
});

describe("las copias de push.ts de las funciones de envío no se separan", () => {
  it("todas las que existan son idénticas", () => {
    const base = new URL("../supabase/functions/", import.meta.url);
    const copias = readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(new URL(`${d.name}/push.ts`, base)))
      .map((d) => readFileSync(new URL(`${d.name}/push.ts`, base), "utf8"));
    expect(copias.length).toBeGreaterThanOrEqual(1);
    for (const c of copias) expect(c).toBe(copias[0]);
  });
  it("la clave PRIVADA no está escrita en ninguna función", () => {
    const base = new URL("../supabase/functions/", import.meta.url);
    for (const d of readdirSync(base, { withFileTypes: true }).filter((x) => x.isDirectory())) {
      for (const f of readdirSync(new URL(`${d.name}/`, base))) {
        const texto = readFileSync(new URL(`${d.name}/${f}`, base), "utf8");
        expect(texto, `${d.name}/${f}`).not.toMatch(/VAPID_PRIVATE_KEY\s*=\s*['"`][A-Za-z0-9_-]{30,}/);
        expect(texto, `${d.name}/${f}`).not.toMatch(/-----BEGIN (EC )?PRIVATE KEY-----/);
      }
    }
  });
});

describe("textoResultadoPrueba: lo que ve el usuario tras pulsar el botón", () => {
  it("entregado: confirma y dice que llegará en segundos", () => {
    const t = textoResultadoPrueba({ ok: true, dispositivos: 1, enviados: 1 });
    expect(t.tipo).toBe("ok");
    expect(t.texto).toContain("Aviso enviado");
  });
  it("si solo llegó a algunos dispositivos, lo dice", () => {
    expect(textoResultadoPrueba({ ok: true, dispositivos: 2, enviados: 1, caducados: 1 }).texto).toContain("a 1 de 2");
  });
  it("sin dispositivos registrados: avisa y explica qué hacer", () => {
    const t = textoResultadoPrueba({ ok: true, dispositivos: 0, enviados: 0 });
    expect(t.tipo).toBe("aviso");
    expect(t.texto).toContain("Activa los avisos");
  });
  it("rechazo de Apple/Google: error de configuración nuestro, no culpa del usuario", () => {
    const t = textoResultadoPrueba({ ok: true, dispositivos: 1, enviados: 0, config: 1 });
    expect(t.tipo).toBe("error");
    expect(t.texto).toContain("configuración nuestro");
  });
  it("servicio ocupado o dispositivo caducado: aviso amable, no error", () => {
    expect(textoResultadoPrueba({ ok: true, dispositivos: 1, enviados: 0, temporales: 1 }).tipo).toBe("aviso");
    expect(textoResultadoPrueba({ ok: true, dispositivos: 1, enviados: 0, caducados: 1 }).tipo).toBe("aviso");
  });
  it("sesión caducada, fallo del servidor o sin conexión: mensajes claros y distintos", () => {
    expect(textoResultadoPrueba({ ok: false, motivo: "no_autenticado" }).texto).toContain("sesión");
    expect(textoResultadoPrueba({ ok: false, motivo: "db_error" }).tipo).toBe("error");
    expect(textoResultadoPrueba(null).texto).toContain("servidor");
  });
  it("ningún texto usa jerga técnica", () => {
    const casos = [
      { ok: true, dispositivos: 1, enviados: 1 }, { ok: true, dispositivos: 0 }, { ok: true, dispositivos: 1, config: 1 },
      { ok: true, dispositivos: 1, temporales: 1 }, { ok: true, dispositivos: 1, caducados: 1 }, { ok: false }, null,
    ];
    for (const c of casos) expect(textoResultadoPrueba(c).texto.toLowerCase()).not.toMatch(/vapid|endpoint|jwt|http|410|403|payload|push/);
  });
});
