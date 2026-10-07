import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import {
  VAPID_PUBLIC_KEY,
  diagnosticarPush,
  filaDeSuscripcion,
  registrarDispositivo,
  textoDiagnostico,
  urlBase64ABytes,
  type DatosDispositivo,
  type Entorno,
  type SuscripcionJSON,
} from "@/lib/push";

const base: DatosDispositivo = {
  tieneServiceWorker: true,
  tienePushManager: true,
  tieneNotification: true,
  esIOS: false,
  esAppInstalada: false,
  permiso: "default",
};

describe("diagnosticarPush: qué le decimos a cada dispositivo", () => {
  it("ordenador o Android con todo: pendiente, concedido o denegado según el permiso", () => {
    expect(diagnosticarPush(base)).toBe("pendiente");
    expect(diagnosticarPush({ ...base, permiso: "granted" })).toBe("concedido");
    expect(diagnosticarPush({ ...base, permiso: "denied" })).toBe("denegado");
  });

  it("iPhone sin instalar: se explica cómo instalar, aunque falte soporte (Safari no lo ofrece fuera de la app)", () => {
    expect(diagnosticarPush({ ...base, esIOS: true, esAppInstalada: false })).toBe("iphone_sin_instalar");
    expect(diagnosticarPush({ ...base, esIOS: true, esAppInstalada: false, tienePushManager: false, tieneNotification: false })).toBe("iphone_sin_instalar");
  });

  it("iPhone con la app instalada se comporta como cualquier otro", () => {
    expect(diagnosticarPush({ ...base, esIOS: true, esAppInstalada: true })).toBe("pendiente");
    expect(diagnosticarPush({ ...base, esIOS: true, esAppInstalada: true, permiso: "granted" })).toBe("concedido");
  });

  it("sin soporte del navegador: no soportado", () => {
    expect(diagnosticarPush({ ...base, tieneServiceWorker: false })).toBe("no_soportado");
    expect(diagnosticarPush({ ...base, tienePushManager: false })).toBe("no_soportado");
    expect(diagnosticarPush({ ...base, tieneNotification: false })).toBe("no_soportado");
  });

  it("los textos para el usuario existen para todos los casos y no usan jerga", () => {
    for (const d of ["no_soportado", "iphone_sin_instalar", "denegado", "pendiente", "concedido"] as const) {
      const t = textoDiagnostico(d);
      expect(t.titulo.length).toBeGreaterThan(8);
      expect(t.detalle.length).toBeGreaterThan(20);
      expect(`${t.titulo} ${t.detalle}`.toLowerCase()).not.toMatch(/vapid|endpoint|p256dh|service ?worker|push ?manager/);
    }
    expect(textoDiagnostico("iphone_sin_instalar").detalle).toContain("pantalla de inicio");
  });
});

describe("clave pública de los avisos", () => {
  it("es una clave válida: base64 url-safe de 65 bytes que empieza por 0x04 (punto sin comprimir)", () => {
    expect(VAPID_PUBLIC_KEY).toMatch(/^[A-Za-z0-9_-]{87}$/);
    const bytes = urlBase64ABytes(VAPID_PUBLIC_KEY);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4);
  });

  it("urlBase64ABytes convierte bien, con y sin relleno", () => {
    expect(Array.from(urlBase64ABytes("AQID"))).toEqual([1, 2, 3]);
    expect(Array.from(urlBase64ABytes("AQI"))).toEqual([1, 2]); // sin '=' final
    expect(Array.from(urlBase64ABytes("-_8"))).toEqual([251, 255]); // - y _ del formato url-safe
  });

  it("no hay ninguna clave secreta en el código: la pública es distinta de cualquier valor de 43 caracteres", () => {
    expect(VAPID_PUBLIC_KEY).toHaveLength(87);
  });
});

describe("filaDeSuscripcion", () => {
  const sub: SuscripcionJSON = { endpoint: "https://push.example.com/abc", keys: { p256dh: "P", auth: "A" } };
  const ahora = new Date("2026-10-07T12:00:00.000Z");

  it("produce la fila con el usuario y la fecha", () => {
    expect(filaDeSuscripcion("u-1", sub, "iPhone Safari", ahora)).toEqual({
      user_id: "u-1", endpoint: "https://push.example.com/abc", p256dh: "P", auth: "A",
      user_agent: "iPhone Safari", last_seen_at: "2026-10-07T12:00:00.000Z",
    });
  });

  it("rechaza lo incompleto, sin usuario o con una dirección que no sea https", () => {
    expect(filaDeSuscripcion("u-1", { endpoint: sub.endpoint }, null)).toBeNull();
    expect(filaDeSuscripcion("u-1", { ...sub, keys: { p256dh: "P" } }, null)).toBeNull();
    expect(filaDeSuscripcion("u-1", { keys: sub.keys }, null)).toBeNull();
    expect(filaDeSuscripcion("", sub, null)).toBeNull();
    expect(filaDeSuscripcion("u-1", { ...sub, endpoint: "http://inseguro.com/x" }, null)).toBeNull();
    expect(filaDeSuscripcion("u-1", { ...sub, endpoint: "file:///etc/passwd" }, null)).toBeNull();
    expect(filaDeSuscripcion("u-1", null, null)).toBeNull();
  });

  it("recorta un navegador con un nombre larguísimo", () => {
    expect(filaDeSuscripcion("u-1", sub, "x".repeat(900))!.user_agent).toHaveLength(200);
  });
});

describe("registrarDispositivo (con un navegador simulado)", () => {
  const sub: SuscripcionJSON = { endpoint: "https://push.example.com/abc", keys: { p256dh: "P", auth: "A" } };
  const entorno = (over: Partial<Entorno> = {}): Entorno & { guardadas: unknown[] } => {
    const guardadas: unknown[] = [];
    return {
      diagnostico: () => "pendiente",
      pedirPermiso: async () => "granted",
      suscribir: async () => sub,
      guardar: async (fila) => { guardadas.push(fila); return { error: null }; },
      userAgent: () => "Test",
      ...over,
      guardadas,
    } as Entorno & { guardadas: unknown[] };
  };

  it("camino feliz: pide permiso, suscribe y guarda UNA fila", async () => {
    const e = entorno();
    expect(await registrarDispositivo("u-1", e)).toEqual({ ok: true });
    expect(e.guardadas).toHaveLength(1);
    expect(e.guardadas[0]).toMatchObject({ user_id: "u-1", endpoint: sub.endpoint });
  });

  it("lo PRIMERO que hace es pedir el permiso (Safari exige que sea inmediato tras el toque)", async () => {
    const orden: string[] = [];
    const e = entorno({
      pedirPermiso: async () => { orden.push("permiso"); return "granted"; },
      suscribir: async () => { orden.push("suscribir"); return sub; },
      guardar: async () => { orden.push("guardar"); return { error: null }; },
    });
    await registrarDispositivo("u-1", e);
    expect(orden).toEqual(["permiso", "suscribir", "guardar"]);
  });

  it("si ya tiene permiso no vuelve a preguntar", async () => {
    const pedir = vi.fn(async () => "granted" as const);
    await registrarDispositivo("u-1", entorno({ diagnostico: () => "concedido", pedirPermiso: pedir }));
    expect(pedir).not.toHaveBeenCalled();
  });

  it("si dice que no (o cierra el aviso sin elegir), no suscribe ni guarda nada", async () => {
    for (const permiso of ["denied", "default"] as const) {
      const suscribir = vi.fn(async () => sub);
      const e = entorno({ pedirPermiso: async () => permiso, suscribir });
      expect(await registrarDispositivo("u-1", e)).toEqual({ ok: false, motivo: "denegado" });
      expect(suscribir).not.toHaveBeenCalled();
      expect(e.guardadas).toHaveLength(0);
    }
  });

  it("si el dispositivo no puede (iPhone sin instalar, bloqueado, sin soporte) ni pregunta", async () => {
    for (const diag of ["iphone_sin_instalar", "denegado", "no_soportado"] as const) {
      const pedir = vi.fn(async () => "granted" as const);
      expect(await registrarDispositivo("u-1", entorno({ diagnostico: () => diag, pedirPermiso: pedir }))).toEqual({ ok: false, motivo: diag });
      expect(pedir).not.toHaveBeenCalled();
    }
  });

  it("si suscribirse falla, o devuelve algo incompleto, avisa y no guarda", async () => {
    const e1 = entorno({ suscribir: async () => { throw new Error("push service caído"); } });
    expect(await registrarDispositivo("u-1", e1)).toEqual({ ok: false, motivo: "error_suscripcion" });
    expect(e1.guardadas).toHaveLength(0);
    const e2 = entorno({ suscribir: async () => ({ endpoint: "https://x.y/z" }) });
    expect(await registrarDispositivo("u-1", e2)).toEqual({ ok: false, motivo: "error_suscripcion" });
  });

  it("si la base de datos rechaza el guardado, lo dice (no finge que salió bien)", async () => {
    const e = entorno({ guardar: async () => ({ error: new Error("RLS") }) });
    expect(await registrarDispositivo("u-1", e)).toEqual({ ok: false, motivo: "error_guardado" });
  });
});

// ── El programa de fondo (public/sw.js), ejecutado con un navegador simulado ───

type Manejador = (evento: unknown) => void;

function cargarSW() {
  const manejadores: Record<string, Manejador> = {};
  const mostradas: Array<{ titulo: string; opciones: Record<string, any> }> = [];
  const abiertas: string[] = [];
  const enfocadas: string[] = [];
  const navegadas: string[] = [];
  let ventanasAbiertas: Array<{ focus: () => Promise<void>; navigate: (u: string) => Promise<void> }> = [];

  const self = {
    location: { origin: "https://usarumbo.com" },
    addEventListener: (tipo: string, f: Manejador) => { manejadores[tipo] = f; },
    skipWaiting: () => {},
    clients: {
      claim: async () => {},
      matchAll: async () => ventanasAbiertas,
      openWindow: async (u: string) => { abiertas.push(u); },
    },
    registration: {
      showNotification: async (titulo: string, opciones: Record<string, any>) => { mostradas.push({ titulo, opciones }); },
    },
  };
  vm.runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), { self, URL, console });

  const evento = (extra: Record<string, unknown>) => {
    const esperas: Promise<unknown>[] = [];
    return { ev: { waitUntil: (p: Promise<unknown>) => esperas.push(Promise.resolve(p)), ...extra }, esperar: () => Promise.all(esperas) };
  };
  return {
    mostradas, abiertas, enfocadas, navegadas,
    ponerVentanas: (n: number) => {
      ventanasAbiertas = Array.from({ length: n }, () => ({
        focus: async () => { enfocadas.push("focus"); },
        navigate: async (u: string) => { navegadas.push(u); },
      }));
    },
    async push(data: unknown | "ROTO" | "SIN_DATOS") {
      const dato = data === "SIN_DATOS" ? null : data === "ROTO"
        ? { json: () => { throw new Error("JSON roto"); }, text: () => "texto suelto" }
        : { json: () => data, text: () => JSON.stringify(data) };
      const { ev, esperar } = evento({ data: dato });
      manejadores["push"](ev);
      await esperar();
    },
    async clic(url?: string) {
      const cerrada: string[] = [];
      const { ev, esperar } = evento({ notification: { close: () => cerrada.push("x"), data: url === undefined ? undefined : { url } } });
      manejadores["notificationclick"](ev);
      await esperar();
      return cerrada.length === 1;
    },
    tiene: (tipo: string) => typeof manejadores[tipo] === "function",
  };
}

describe("programa de fondo: mostrar avisos", () => {
  it("registra los manejadores de instalación, activación, red, aviso y toque", () => {
    const sw = cargarSW();
    for (const t of ["install", "activate", "fetch", "push", "notificationclick"]) expect(sw.tiene(t), t).toBe(true);
  });

  it("un aviso normal se muestra con su título, texto, icono y aviso que sustituye al anterior", async () => {
    const sw = cargarSW();
    await sw.push({ title: "Rumbo", body: "¿Qué tal el día? Apunta tus gastos 🧭", url: "/gastos/" });
    expect(sw.mostradas).toHaveLength(1);
    expect(sw.mostradas[0].titulo).toBe("Rumbo");
    expect(sw.mostradas[0].opciones.body).toContain("Apunta tus gastos");
    expect(sw.mostradas[0].opciones.icon).toBe("/icons/icon-192.png");
    expect(sw.mostradas[0].opciones.tag).toBe("rumbo-recordatorio");
    expect(sw.mostradas[0].opciones.data.url).toBe("/gastos/");
  });

  it("SIEMPRE muestra algo, aunque el contenido llegue vacío, roto o sin datos (si no, iPhone retira el permiso)", async () => {
    for (const caso of [{}, "ROTO", "SIN_DATOS", null, { title: "", body: "" }] as const) {
      const sw = cargarSW();
      await sw.push(caso as never);
      expect(sw.mostradas, JSON.stringify(caso)).toHaveLength(1);
      expect(sw.mostradas[0].titulo.length).toBeGreaterThan(0);
      expect(sw.mostradas[0].opciones.body.length).toBeGreaterThan(0);
    }
  });

  it("un aviso sin dirección, o con una dirección que no es texto, lleva al panel (no a «/undefined»)", async () => {
    for (const caso of [{ title: "t", body: "b" }, { title: "t", body: "b", url: "" }, { title: "t", body: "b", url: 42 }, { title: "t", body: "b", url: null }]) {
      const sw = cargarSW();
      await sw.push(caso);
      expect(sw.mostradas[0].opciones.data.url, JSON.stringify(caso)).toBe("/dashboard/");
    }
  });

  it("nunca abre una dirección externa: solo páginas de Rumbo", async () => {
    for (const url of ["https://malo.com/robo", "//malo.com/x", "javascript:alert(1)"]) {
      const sw = cargarSW();
      await sw.push({ title: "t", body: "b", url });
      expect(sw.mostradas[0].opciones.data.url, url).toBe("/dashboard/");
    }
    const sw = cargarSW();
    await sw.push({ title: "t", body: "b", url: "https://usarumbo.com/gastos/?mes=10" });
    expect(sw.mostradas[0].opciones.data.url).toBe("/gastos/?mes=10"); // la propia web sí
  });
});

describe("programa de fondo: tocar un aviso", () => {
  it("cierra el aviso y, si Rumbo no está abierto, lo abre en la pantalla indicada", async () => {
    const sw = cargarSW();
    expect(await sw.clic("/gastos/")).toBe(true);
    expect(sw.abiertas).toEqual(["/gastos/"]);
  });

  it("si Rumbo ya está abierto, lo trae al frente y lo lleva allí, sin abrir otra ventana", async () => {
    const sw = cargarSW();
    sw.ponerVentanas(1);
    await sw.clic("/gastos/");
    expect(sw.enfocadas).toEqual(["focus"]);
    expect(sw.navegadas).toEqual(["/gastos/"]);
    expect(sw.abiertas).toHaveLength(0);
  });

  it("sin dirección, o con una ajena, abre el panel", async () => {
    const sw1 = cargarSW();
    await sw1.clic(undefined);
    expect(sw1.abiertas).toEqual(["/dashboard/"]);
    const sw2 = cargarSW();
    await sw2.clic("https://malo.com/");
    expect(sw2.abiertas).toEqual(["/dashboard/"]);
  });
});
