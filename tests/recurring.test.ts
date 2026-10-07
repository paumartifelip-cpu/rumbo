import { describe, expect, it } from "vitest";
import { generateRecurring, type RecurringInput } from "@/lib/recurring";
import { fin, seqIds, task } from "./helpers";

const NOW = new Date("2026-10-06T12:00:00.000Z");
const state = (over: Partial<RecurringInput>): RecurringInput => ({
  tasks: [],
  finances: [],
  deletedIds: [],
  primaryCurrency: "EUR",
  ...over,
});

describe("finanzas recurrentes", () => {
  const rent = fin({ id: "rent", title: "Alquiler", amount: 500, date: "2026-07-15T12:00:00.000Z", recurrence: "mensual" });

  it("rellena los meses que faltan, hasta el actual, con ids deterministas", () => {
    const out = generateRecurring(state({ finances: [rent] }), NOW, seqIds());
    const kids = out.finances.filter((f) => f.id.startsWith("rent__rec__"));
    expect(kids.map((f) => f.id)).toEqual(["rent__rec__2026-08", "rent__rec__2026-09", "rent__rec__2026-10"]);
    expect(kids.map((f) => f.date.slice(0, 10))).toEqual(["2026-08-15", "2026-09-15", "2026-10-15"]);
    // Las instancias no son plantillas: no se vuelven a replicar.
    expect(kids.every((f) => f.recurrence === undefined)).toBe(true);
  });

  it("es idempotente: una segunda pasada no cambia nada (misma referencia)", () => {
    const once = generateRecurring(state({ finances: [rent] }), NOW, seqIds());
    const twice = generateRecurring(once, NOW, seqIds());
    expect(twice).toBe(once);
  });

  it("dos dispositivos generan EXACTAMENTE los mismos ids (no se duplican al sincronizar)", () => {
    const a = generateRecurring(state({ finances: [rent] }), NOW, seqIds());
    const b = generateRecurring(state({ finances: [rent] }), NOW, seqIds());
    const ids = (s: RecurringInput) => s.finances.map((f) => f.id).sort();
    expect(ids(a)).toEqual(ids(b));
  });

  it("no recrea una instancia que el usuario borró (tombstone)", () => {
    const out = generateRecurring(state({ finances: [rent], deletedIds: ["rent__rec__2026-09"] }), NOW, seqIds());
    const ids = out.finances.map((f) => f.id);
    expect(ids).not.toContain("rent__rec__2026-09");
    expect(ids).toContain("rent__rec__2026-08");
    expect(ids).toContain("rent__rec__2026-10");
  });

  it("no duplica un mes que ya existe con otro id (misma firma tipo|título|importe|mes)", () => {
    const legacy = fin({ id: "legacy-random", title: "alquiler ", amount: 500, date: "2026-09-03T12:00:00.000Z" });
    const out = generateRecurring(state({ finances: [rent, legacy] }), NOW, seqIds());
    expect(out.finances.some((f) => f.id === "rent__rec__2026-09")).toBe(false);
    expect(out.finances.some((f) => f.id === "rent__rec__2026-08")).toBe(true);
  });

  it("ajusta el día al último del mes (31 → 28 en febrero)", () => {
    const gym = fin({ id: "gym", amount: 30, date: "2026-01-31T12:00:00.000Z", recurrence: "mensual" });
    const out = generateRecurring(state({ finances: [gym] }), new Date("2026-03-10T12:00:00.000Z"), seqIds());
    const feb = out.finances.find((f) => f.id === "gym__rec__2026-02");
    expect(feb?.date.slice(0, 10)).toBe("2026-02-28");
  });

  it("cruza el cambio de año sin saltarse meses", () => {
    const sub = fin({ id: "sub", amount: 9, date: "2025-11-10T12:00:00.000Z", recurrence: "mensual" });
    const out = generateRecurring(state({ finances: [sub] }), new Date("2026-02-20T12:00:00.000Z"), seqIds());
    const periods = out.finances.filter((f) => f.id.startsWith("sub__rec__")).map((f) => f.id.slice(-7));
    expect(periods).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("los anuales generan un cargo por cada año que falta", () => {
    const seguro = fin({ id: "seg", amount: 300, date: "2024-03-10T12:00:00.000Z", recurrence: "anual" });
    const out = generateRecurring(state({ finances: [seguro] }), NOW, seqIds());
    const kids = out.finances.filter((f) => f.id.startsWith("seg__rec__"));
    expect(kids.map((f) => f.id)).toEqual(["seg__rec__2025", "seg__rec__2026"]);
    expect(kids.map((f) => f.date.slice(0, 10))).toEqual(["2025-03-10", "2026-03-10"]);
  });

  it("convierte el importe a la moneda principal al generar", () => {
    const usd = fin({ id: "usd", amount: 100, currency: "USD", date: "2026-08-05T12:00:00.000Z", recurrence: "mensual" });
    const out = generateRecurring(state({ finances: [usd] }), NOW, seqIds());
    const kid = out.finances.find((f) => f.id === "usd__rec__2026-09")!;
    expect(kid.currency).toBe("USD");
    expect(kid.amount).toBe(100);
    expect(kid.amount_in_primary).toBeGreaterThan(0);
    expect(kid.amount_in_primary).not.toBe(100);
  });

  it("no toca lo que no es recurrente y devuelve la misma referencia", () => {
    const s = state({ finances: [fin({ id: "x" })], tasks: [task({ id: "t" })] });
    expect(generateRecurring(s, NOW, seqIds())).toBe(s);
  });

  it("un gasto recurrente de este mismo mes no genera nada", () => {
    const s = state({ finances: [fin({ id: "n", date: "2026-10-01T12:00:00.000Z", recurrence: "mensual" })] });
    expect(generateRecurring(s, NOW, seqIds())).toBe(s);
  });
});

describe("tareas recurrentes", () => {
  it("una diaria genera una copia pendiente sin recurrencia y marca la plantilla", () => {
    const daily = task({ id: "d", title: "Revisar gastos", recurrence: "diaria", status: "completada", created_at: "2026-10-04T08:00:00.000Z" });
    const out = generateRecurring(state({ tasks: [daily] }), NOW, seqIds());
    expect(out.tasks).toHaveLength(2);
    const copy = out.tasks.find((t) => t.id === "t1")!;
    expect(copy.status).toBe("pendiente");
    expect(copy.recurrence).toBeUndefined();
    expect(copy.title).toBe("Revisar gastos");
    expect(out.tasks.find((t) => t.id === "d")!.last_generated_date).toBe(NOW.toISOString());
  });

  it("no genera otra el mismo día ni si ya hay una pendiente con ese título", () => {
    const daily = task({ id: "d", title: "Revisar", recurrence: "diaria", created_at: "2026-10-04T08:00:00.000Z" });
    const once = generateRecurring(state({ tasks: [daily] }), NOW, seqIds());
    expect(generateRecurring(once, NOW, seqIds())).toBe(once);
  });

  it("una semanal espera 7 días; una mensual espera al mes siguiente", () => {
    const weekly = task({ id: "w", title: "W", recurrence: "semanal", status: "completada", created_at: "2026-10-01T12:00:00.000Z" });
    expect(generateRecurring(state({ tasks: [weekly] }), new Date("2026-10-07T12:00:00.000Z"), seqIds()).tasks).toHaveLength(1);
    expect(generateRecurring(state({ tasks: [weekly] }), new Date("2026-10-08T12:00:00.000Z"), seqIds()).tasks).toHaveLength(2);

    const monthly = task({ id: "m", title: "M", recurrence: "mensual", status: "completada", created_at: "2026-09-20T12:00:00.000Z" });
    expect(generateRecurring(state({ tasks: [monthly] }), new Date("2026-09-30T12:00:00.000Z"), seqIds()).tasks).toHaveLength(1);
    expect(generateRecurring(state({ tasks: [monthly] }), new Date("2026-10-01T12:00:00.000Z"), seqIds()).tasks).toHaveLength(2);
  });
});
