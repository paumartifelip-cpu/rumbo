import { describe, expect, it } from "vitest";
import { listSignature, mergeRowsById, mergeRowsByUpdated } from "@/lib/merge";

type Row = { id: string; created_at?: string; updated_at?: string; v?: string };
const none = new Set<string>();

describe("mergeRowsById", () => {
  it("el remoto manda en los ids que conoce", () => {
    const out = mergeRowsById<Row>([{ id: "a", v: "local" }], [{ id: "a", v: "remoto" }], none, "2026-10-01T00:00:00Z");
    expect(out).toEqual([{ id: "a", v: "remoto" }]);
  });

  it("no resucita lo que el usuario borró (tombstone), aunque el remoto aún lo tenga", () => {
    const out = mergeRowsById<Row>([], [{ id: "a" }, { id: "b" }], new Set(["a"]), "x");
    expect(out.map((r) => r.id)).toEqual(["b"]);
  });

  it("conserva lo local creado DESPUÉS del último sync (aún no subido)", () => {
    const out = mergeRowsById<Row>(
      [{ id: "nuevo", created_at: "2026-10-05T10:00:00Z" }],
      [],
      none,
      "2026-10-05T09:00:00Z"
    );
    expect(out.map((r) => r.id)).toEqual(["nuevo"]);
  });

  it("descarta lo local ANTERIOR al último sync que el remoto ya no tiene (borrado en otro dispositivo)", () => {
    const out = mergeRowsById<Row>(
      [{ id: "viejo", created_at: "2026-10-01T10:00:00Z" }],
      [],
      none,
      "2026-10-05T09:00:00Z"
    );
    expect(out).toEqual([]);
  });

  it("sin sync previo conserva todo lo local (dispositivo con historial offline)", () => {
    const out = mergeRowsById<Row>([{ id: "a", created_at: "2020-01-01T00:00:00Z" }], [], none, undefined);
    expect(out.map((r) => r.id)).toEqual(["a"]);
  });

  it("conserva lo local sin created_at (no se puede saber si es viejo)", () => {
    const out = mergeRowsById<Row>([{ id: "a" }], [], none, "2026-10-05T09:00:00Z");
    expect(out.map((r) => r.id)).toEqual(["a"]);
  });
});

describe("mergeRowsByUpdated", () => {
  const sync = "2026-10-05T09:00:00Z";

  it("gana la edición local si es más nueva que la remota", () => {
    const out = mergeRowsByUpdated<Row>(
      [{ id: "a", v: "local", updated_at: "2026-10-05T12:00:00Z" }],
      [{ id: "a", v: "remoto", updated_at: "2026-10-05T10:00:00Z" }],
      none,
      sync
    );
    expect(out[0].v).toBe("local");
  });

  it("gana la remota si es más nueva", () => {
    const out = mergeRowsByUpdated<Row>(
      [{ id: "a", v: "local", updated_at: "2026-10-05T10:00:00Z" }],
      [{ id: "a", v: "remoto", updated_at: "2026-10-05T12:00:00Z" }],
      none,
      sync
    );
    expect(out[0].v).toBe("remoto");
  });

  it("usa created_at si no hay updated_at", () => {
    const out = mergeRowsByUpdated<Row>(
      [{ id: "a", v: "local", created_at: "2026-10-05T12:00:00Z" }],
      [{ id: "a", v: "remoto", created_at: "2026-10-05T10:00:00Z" }],
      none,
      sync
    );
    expect(out[0].v).toBe("local");
  });

  it("respeta tombstones y la regla de 'creado tras el sync'", () => {
    const out = mergeRowsByUpdated<Row>(
      [
        { id: "nuevo", created_at: "2026-10-05T10:00:00Z" },
        { id: "viejo", created_at: "2026-10-01T00:00:00Z" },
      ],
      [{ id: "borrado" }],
      new Set(["borrado"]),
      sync
    );
    expect(out.map((r) => r.id)).toEqual(["nuevo"]);
  });
});

describe("listSignature", () => {
  const a = { id: "1", title: "a", amount: 10, category: "Comida" };
  const b = { id: "2", title: "b", amount: 20, category: "Salud" };

  it("no depende del orden de la lista", () => {
    expect(listSignature([a, b])).toBe(listSignature([b, a]));
  });

  it("detecta cambios en campos editables, incluidos método de pago y mes", () => {
    const base = listSignature([a]);
    expect(listSignature([{ ...a, amount: 11 }])).not.toBe(base);
    expect(listSignature([{ ...a, category: "Otros" }])).not.toBe(base);
    expect(listSignature([{ ...a, payment_method: "bizum" }])).not.toBe(base);
    expect(listSignature([{ ...a, payment_account: "BBVA Visa" }])).not.toBe(base);
    expect(listSignature([{ ...a, month: "2026-10" }])).not.toBe(base);
  });

  it("ignora campos recalculados localmente (evita bucles pull/push)", () => {
    const base = listSignature([a]);
    expect(listSignature([{ ...a, ai_priority_score: 9, ai_reason: "x", amount_in_primary: 5 }])).toBe(base);
  });
});
