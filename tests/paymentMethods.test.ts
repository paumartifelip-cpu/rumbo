import { describe, expect, it } from "vitest";
import {
  accountSuggestions,
  canonicalAccount,
  isPaymentMethod,
  matchesPayFilter,
  sanitizePayment,
  spendByPayment,
} from "@/lib/paymentMethods";
import { fin } from "./helpers";

describe("sanitizePayment", () => {
  it("descarta métodos inválidos o ausentes", () => {
    expect(sanitizePayment("zzz", "x")).toEqual({});
    expect(sanitizePayment(undefined, undefined)).toEqual({});
    expect(isPaymentMethod("bizum")).toBe(true);
    expect(isPaymentMethod("paypal")).toBe(false);
  });

  it("solo débito y crédito conservan el nombre de la tarjeta", () => {
    expect(sanitizePayment("efectivo", "BBVA")).toEqual({ payment_method: "efectivo" });
    expect(sanitizePayment("bizum", "BBVA")).toEqual({ payment_method: "bizum" });
    expect(sanitizePayment("credito", "BBVA")).toEqual({ payment_method: "credito", payment_account: "BBVA" });
  });

  it("limpia espacios y limita la longitud", () => {
    expect(sanitizePayment("debito", "  bbva   visa  ").payment_account).toBe("bbva visa");
    expect(sanitizePayment("debito", "x".repeat(100)).payment_account).toHaveLength(30);
    expect(sanitizePayment("debito", "   ")).toEqual({ payment_method: "debito" });
  });
});

describe("tarjetas", () => {
  const f = (m: string | undefined, acc?: string) => fin({ id: Math.random().toString(), payment_method: m as never, payment_account: acc });
  const items = [f("credito", "BBVA Visa"), f("credito", "bbva visa"), f("credito", "Revolut"), f("debito", "N26"), f("credito", "BBVA Visa"), f("efectivo")];

  it("sugiere las ya usadas por método, sin duplicar por mayúsculas, más usadas primero", () => {
    expect(accountSuggestions(items, "credito")).toEqual(["BBVA Visa", "Revolut"]);
    expect(accountSuggestions(items, "debito")).toEqual(["N26"]);
    expect(accountSuggestions(items, "bizum")).toEqual([]);
  });

  it("reutiliza el nombre existente si coincide sin mayúsculas", () => {
    const s = ["BBVA Visa"];
    expect(canonicalAccount("bbva  visa", s)).toBe("BBVA Visa");
    expect(canonicalAccount("Nueva", s)).toBe("Nueva");
    expect(canonicalAccount("   ", s)).toBe("");
  });
});

describe("desglose y filtro", () => {
  const items = [
    fin({ id: "1", amount: 100, payment_method: "credito", payment_account: "BBVA Visa" }),
    fin({ id: "2", amount: 50, payment_method: "credito", payment_account: "bbva visa" }),
    fin({ id: "3", amount: 30, payment_method: "credito", payment_account: "Revolut" }),
    fin({ id: "4", amount: 20, payment_method: "efectivo" }),
    fin({ id: "5", amount: 40 }),
  ];
  const toP = (f: { amount: number }) => f.amount;

  it("los totales de los métodos suman el total (los sin indicar van aparte)", () => {
    const { slices, total } = spendByPayment(items, toP);
    expect(total).toBe(240);
    expect(slices.reduce((a, s) => a + s.total, 0)).toBe(total);
    expect(slices.at(-1)?.key).toBe("none");
  });

  it("agrupa las tarjetas sin distinguir mayúsculas y ordena por gasto", () => {
    const credito = spendByPayment(items, toP).slices.find((s) => s.key === "credito")!;
    expect(credito.accounts).toEqual([
      { name: "BBVA Visa", total: 150, count: 2 },
      { name: "Revolut", total: 30, count: 1 },
    ]);
  });

  it("el filtro devuelve exactamente lo esperado", () => {
    const ids = (flt: Parameters<typeof matchesPayFilter>[1]) => items.filter((i) => matchesPayFilter(i, flt)).map((i) => i.id);
    expect(ids(null)).toEqual(["1", "2", "3", "4", "5"]);
    expect(ids({ method: "credito" })).toEqual(["1", "2", "3"]);
    expect(ids({ method: "credito", account: "BBVA Visa" })).toEqual(["1", "2"]);
    expect(ids({ method: "none" })).toEqual(["5"]);
    expect(ids({ method: "efectivo" })).toEqual(["4"]);
  });
});
