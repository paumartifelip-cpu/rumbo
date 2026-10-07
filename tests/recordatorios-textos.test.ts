import { describe, expect, it } from "vitest";
import { TEXTOS, avisoRecordatorio } from "../supabase/functions/send-reminders/recordatorios";
import { serializarAviso } from "../supabase/functions/send-reminders/push";

describe("textos del recordatorio diario", () => {
  it("hay variedad (al menos 5 textos distintos)", () => {
    expect(new Set(TEXTOS.map((t) => t.body)).size).toBeGreaterThanOrEqual(5);
  });
  it("la misma fecha da siempre el mismo texto", () => {
    expect(avisoRecordatorio("2026-10-07")).toEqual(avisoRecordatorio("2026-10-07"));
  });
  it("días seguidos dan textos distintos", () => {
    const dia = (n: number) => new Date(Date.UTC(2026, 9, 1 + n)).toISOString().slice(0, 10);
    for (let n = 0; n < 120; n++) expect(avisoRecordatorio(dia(n)).body).not.toBe(avisoRecordatorio(dia(n + 1)).body);
  });
  it("nunca lleva importes ni cifras de dinero", () => {
    for (const t of TEXTOS) expect(t.body).not.toMatch(/\d|€|\$|euro|dólar/i);
  });
  it("es corto y cabe de sobra en un aviso; abre la pantalla de gastos", () => {
    for (const t of TEXTOS) expect(t.body.length).toBeLessThanOrEqual(90);
    const a = avisoRecordatorio("2026-10-07");
    expect(a.url).toBe("/gastos/");
    expect(serializarAviso(a)).toContain(a.body);
  });
});
