import { describe, expect, it } from "vitest";
import {
  budgetAlertForNewExpense,
  budgetId,
  budgetLevel,
  budgetLimitInPrimary,
  monthlySpendByCategory,
  normalizeCategory,
} from "@/lib/budgets";
import { convertAmount } from "@/lib/currency";
import type { Budget } from "@/lib/types";
import { fin } from "./helpers";

const OCT = new Date("2026-10-15T12:00:00.000Z");
const same = (f: { amount: number }) => f.amount;
const fmt = (v: number) => `${Math.round(v)}€`;
const budget = (over: Partial<Budget> = {}): Budget => ({
  id: "b", user_id: "u", category: "Comida", amount: 300, currency: "EUR", created_at: "2026-10-01T00:00:00Z", ...over,
});

describe("monthlySpendByCategory", () => {
  const finances = [
    fin({ id: "1", amount: 200, category: "Comida" }),
    fin({ id: "2", amount: 50, category: "Comida", type: "ingreso" }),
    fin({ id: "3", amount: 30, category: "Deudas" }),
    fin({ id: "4", amount: 10, category: "Inventada" }),
    fin({ id: "5", amount: 99, category: "Comida", date: "2026-09-30T12:00:00.000Z" }),
    fin({ id: "6", amount: 5 }),
  ];

  it("solo cuenta gastos del mes, incluidas las deudas", () => {
    const m = monthlySpendByCategory(finances, OCT, same);
    expect(m.get("Comida")).toBe(200);
    expect(m.get("Deudas")).toBe(30);
  });

  it("las categorías desconocidas o vacías caen en Otros", () => {
    const m = monthlySpendByCategory(finances, OCT, same);
    expect(m.get("Otros")).toBe(15);
    expect(normalizeCategory(undefined)).toBe("Otros");
    expect(normalizeCategory("Salud")).toBe("Salud");
  });
});

describe("budgetLevel", () => {
  it("ok < 80 % ≤ warn < 100 % ≤ over", () => {
    expect(budgetLevel(0.79)).toBe("ok");
    expect(budgetLevel(0.8)).toBe("warn");
    expect(budgetLevel(0.99)).toBe("warn");
    expect(budgetLevel(1)).toBe("over");
    expect(budgetLevel(2)).toBe("over");
  });
});

describe("budgetLimitInPrimary", () => {
  it("al cambiar de moneda principal, el límite se convierte con ella", () => {
    const b = budget({ amount: 300, currency: "EUR" });
    expect(budgetLimitInPrimary(b, "EUR")).toBe(300);
    const mxn = budgetLimitInPrimary(b, "MXN");
    expect(mxn).toBeCloseTo(convertAmount(300, "EUR", "MXN"), 6);
    expect(mxn).toBeGreaterThan(300);
  });

  it("un presupuesto sin moneda se trata como moneda principal", () => {
    expect(budgetLimitInPrimary(budget({ currency: undefined }), "USD")).toBe(300);
  });
});

describe("budgetAlertForNewExpense", () => {
  const base = [fin({ id: "1", amount: 200, category: "Comida" })];
  const run = (amount: number, over: Record<string, unknown> = {}, finances = base) =>
    budgetAlertForNewExpense({
      finances,
      budgets: [budget()],
      primary: "EUR",
      toPrimary: same,
      format: fmt,
      entry: { type: "gasto", title: "x", amount, category: "Comida", date: "2026-10-10T12:00:00.000Z", ...over } as never,
    });

  it("no avisa por debajo del 80 %", () => expect(run(30)).toBeNull());

  it("avisa al cruzar el 80 %", () => {
    const a = run(50);
    expect(a?.level).toBe("warn");
    expect(a?.message).toContain("83 %");
    expect(a?.message).toContain("50€");
  });

  it("avisa al superar el 100 % con cuánto se ha pasado", () => {
    const a = run(110);
    expect(a?.level).toBe("over");
    expect(a?.message).toContain("10€");
  });

  it("no repite el aviso si ya estaba en ese nivel", () => {
    const high = [...base, fin({ id: "2", amount: 60, category: "Comida" })]; // 87 %
    expect(run(10, {}, high)).toBeNull();
    expect(run(50, {}, high)?.level).toBe("over");
  });

  it("ignora categorías sin presupuesto, ingresos y otros meses", () => {
    expect(run(500, { category: "Salud" })).toBeNull();
    expect(run(500, { type: "ingreso" })).toBeNull();
    // Noviembre empieza de cero: 250/300 = 83 % → warn. Si contara los 200 € de
    // octubre serían 450/300 → over.
    expect(run(250, { date: "2026-11-02T12:00:00.000Z" })?.level).toBe("warn");
  });

  it("categoriza por título cuando no se elige categoría", () => {
    const a = run(110, { category: undefined, title: "Mercadona" });
    expect(a?.category).toBe("Comida");
  });
});

describe("budgetId", () => {
  it("es determinista por usuario y categoría", () => {
    expect(budgetId("u1", "Comida")).toBe(budgetId("u1", "Comida"));
    expect(budgetId("u1", "Comida")).not.toBe(budgetId("u2", "Comida"));
  });
});
