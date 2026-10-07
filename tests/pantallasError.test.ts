import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ErrorScreen } from "@/components/ErrorScreen";
import { ERROR_GRAVE, PAGINA_NO_ENCONTRADA, VARIANTES_ERROR, elegirVariante } from "@/lib/pantallasError";

describe("textos de las pantallas de error", () => {
  it("hay variedad y todas tienen emoji, título y texto", () => {
    expect(VARIANTES_ERROR.length).toBeGreaterThanOrEqual(3);
    for (const v of [...VARIANTES_ERROR, PAGINA_NO_ENCONTRADA, ERROR_GRAVE]) {
      expect(v.emoji.length).toBeGreaterThan(0);
      expect(v.title.length).toBeGreaterThan(5);
      expect(v.text.length).toBeGreaterThan(20);
    }
  });

  it("no aparece jerga técnica que asuste al usuario", () => {
    const todo = [...VARIANTES_ERROR, PAGINA_NO_ENCONTRADA, ERROR_GRAVE].map((v) => `${v.title} ${v.text}`).join(" ").toLowerCase();
    for (const mala of ["exception", "stack", "undefined", "null", "500", "error:", "traceback", "supabase"]) {
      expect(todo).not.toContain(mala);
    }
  });

  it("no promete cosas que no sabemos (que ya lo estamos arreglando)", () => {
    const todo = [...VARIANTES_ERROR, ERROR_GRAVE].map((v) => v.text).join(" ").toLowerCase();
    expect(todo).not.toContain("estamos arreglando");
    expect(todo).not.toContain("ya lo sabemos");
  });

  it("elegirVariante siempre devuelve una variante válida, incluso con números raros", () => {
    for (const n of [0, 1, 2, 3, 4, 5, 1_790_000_000, -7, 3.9, Number.MAX_SAFE_INTEGER]) {
      expect(VARIANTES_ERROR).toContain(elegirVariante(n));
    }
  });

  it("es estable: la misma semilla da la misma variante", () => {
    expect(elegirVariante(42)).toBe(elegirVariante(42));
  });
});

describe("pantalla de error (dibujo)", () => {
  const dibuja = (props: Parameters<typeof ErrorScreen>[0]) => renderToStaticMarkup(createElement(ErrorScreen, props));

  it("muestra el título, el texto y el emoji", () => {
    const html = dibuja({ variante: VARIANTES_ERROR[0] });
    expect(html).toContain("nos hemos salido del rumbo");
    expect(html).toContain(VARIANTES_ERROR[0].emoji);
    expect(html).toContain('role="alert"');
  });

  it("con reintento enseña los dos botones; sin reintento, solo volver al inicio", () => {
    const con = dibuja({ variante: VARIANTES_ERROR[0], onRetry: () => {} });
    expect(con).toContain("Probar otra vez");
    expect(con).toContain("Volver al inicio");
    const sin = dibuja({ variante: PAGINA_NO_ENCONTRADA });
    expect(sin).not.toContain("Probar otra vez");
    expect(sin).toContain('href="/"');
  });

  it("el enlace de inicio y las etiquetas se pueden cambiar (dentro de la app va a /dashboard)", () => {
    const html = dibuja({ variante: VARIANTES_ERROR[1], onRetry: () => {}, homeHref: "/dashboard", homeLabel: "Ir a mi inicio", compact: true });
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain("Ir a mi inicio");
    expect(html).not.toContain("min-h-screen"); // la versión pequeña no ocupa toda la pantalla
  });

  it("la brújula tiene animación pero está oculta a lectores de pantalla", () => {
    const html = dibuja({ variante: VARIANTES_ERROR[0] });
    expect(html).toContain("compass-wobble");
    expect(html).toContain('aria-hidden="true"');
  });
});
