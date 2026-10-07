import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ruta = (p: string) => new URL(`../${p}`, import.meta.url);
const leer = (p: string) => readFileSync(ruta(p), "utf8");

interface Icono { src: string; sizes: string; type: string; purpose?: string }
const manifest = JSON.parse(leer("public/manifest.webmanifest")) as {
  name: string; short_name: string; start_url: string; scope: string; display: string;
  background_color: string; theme_color: string; lang: string; icons: Icono[];
};

/** Ancho y alto de un PNG, leídos de su cabecera (sin librerías). */
function medidasPng(p: string): { w: number; h: number } {
  const b = readFileSync(ruta(`public${p}`));
  expect(b.subarray(1, 4).toString("ascii"), `${p} no es un PNG`).toBe("PNG");
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe("manifiesto de la app (lo que el móvil lee para instalarla)", () => {
  it("tiene nombre, idioma y modo app a pantalla completa", () => {
    expect(manifest.name).toBe("Rumbo");
    expect(manifest.short_name).toBe("Rumbo");
    expect(manifest.lang).toBe("es");
    expect(manifest.display).toBe("standalone");
  });

  it("al abrir la app instalada se entra en el panel (que redirige al login si no hay sesión)", () => {
    expect(manifest.start_url).toBe("/dashboard/");
    expect(existsSync(ruta("app/(app)/dashboard/page.tsx"))).toBe(true);
    expect(manifest.start_url.startsWith(manifest.scope)).toBe(true);
  });

  it("los colores son los de la marca", () => {
    expect(manifest.background_color.toLowerCase()).toBe("#faf7f2");
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("trae los iconos que exigen Android y Chrome: 192, 512 y uno 'maskable'", () => {
    const hay = (sizes: string, purpose: string) => manifest.icons.some((i) => i.sizes === sizes && i.purpose === purpose);
    expect(hay("192x192", "any")).toBe(true);
    expect(hay("512x512", "any")).toBe(true);
    expect(hay("512x512", "maskable")).toBe(true);
  });

  it("cada icono existe y mide exactamente lo que dice el manifiesto", () => {
    for (const i of manifest.icons) {
      const [w, h] = i.sizes.split("x").map(Number);
      expect(medidasPng(i.src), i.src).toEqual({ w, h });
      expect(i.type).toBe("image/png");
    }
  });
});

describe("iconos de Apple y de la pestaña", () => {
  it("el icono de iPhone mide 180x180", () => {
    expect(medidasPng("/icons/apple-touch-icon.png")).toEqual({ w: 180, h: 180 });
  });

  it("el icono de la pestaña del navegador mide 32x32", () => {
    expect(medidasPng("/icons/favicon-32.png")).toEqual({ w: 32, h: 32 });
  });

  it("el icono de iPhone no tiene transparencia (iOS la pinta en negro)", () => {
    const b = readFileSync(ruta("public/icons/apple-touch-icon.png"));
    const tipoColor = b[25]; // 2 = RGB, 6 = RGBA
    expect(tipoColor).toBe(2);
  });
});

describe("la web enlaza todo lo anterior", () => {
  const layout = leer("app/layout.tsx");

  it("el layout apunta al manifiesto y a los iconos, y todos esos archivos existen", () => {
    expect(layout).toContain('manifest: "/manifest.webmanifest"');
    expect(existsSync(ruta("public/manifest.webmanifest"))).toBe(true);
    for (const m of layout.matchAll(/url: "(\/icons\/[^"]+)"/g)) {
      expect(existsSync(ruta(`public${m[1]}`)), m[1]).toBe(true);
    }
  });

  it("la app instalada en iPhone lleva el nombre Rumbo y modo app", () => {
    expect(layout).toContain("appleWebApp");
    expect(layout).toContain('title: "Rumbo"');
    expect(layout).toContain("capable: true");
  });

  it("el programa de fondo se registra desde el layout", () => {
    expect(layout).toContain("<RegistrarSW />");
    expect(leer("components/RegistrarSW.tsx")).toContain('register("/sw.js"');
  });
});

describe("programa de fondo (sw.js)", () => {
  const sw = leer("public/sw.js");

  it("existe y se activa enseguida", () => {
    expect(sw).toContain("skipWaiting");
    expect(sw).toContain("clients.claim");
  });

  it("NO guarda páginas ni datos en caché: el usuario siempre ve la última versión", () => {
    const codigo = sw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""); // sin comentarios
    expect(codigo).not.toMatch(/caches\.|cache\.(put|add)|respondWith/);
  });

  it("no toca las peticiones (deja que vayan a la red)", () => {
    const codigo = sw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(codigo).toMatch(/addEventListener\("fetch",\s*\(\)\s*=>\s*\{\s*\}\)/);
  });
});
