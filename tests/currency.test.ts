import { describe, expect, it } from "vitest";
import { CURRENCIES, convertAmount, formatCurrency, type Currency } from "@/lib/currency";

const ALL = Object.keys(CURRENCIES) as Currency[];

describe("convertAmount", () => {
  it("misma moneda: devuelve el importe exacto", () => {
    expect(convertAmount(123.45, "EUR", "EUR")).toBe(123.45);
  });

  it("ida y vuelta entre cualquier par de monedas recupera el importe", () => {
    for (const a of ALL) for (const b of ALL) {
      expect(convertAmount(convertAmount(100, a, b), b, a)).toBeCloseTo(100, 6);
    }
  });

  it("nunca devuelve NaN ni Infinity (envenenaría las sumas y el push a Supabase)", () => {
    for (const a of ALL) for (const b of ALL) {
      expect(Number.isFinite(convertAmount(50, a, b))).toBe(true);
    }
  });

  it("es lineal", () => {
    expect(convertAmount(200, "EUR", "USD")).toBeCloseTo(2 * convertAmount(100, "EUR", "USD"), 6);
  });
});

describe("formatCurrency", () => {
  it("formatea sin decimales y con el símbolo correcto", () => {
    expect(formatCurrency(1234.6, "EUR")).toMatch(/1\.?235 €/);
    expect(formatCurrency(10, "USD")).toBe("$10");
    expect(formatCurrency(10, "MXN")).toContain("MX");
  });
});
