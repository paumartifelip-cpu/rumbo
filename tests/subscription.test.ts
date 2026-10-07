import { describe, expect, it } from "vitest";
import {
  GRACE_DAYS,
  hasAccess,
  isHandledEvent,
  rowFromSubscription,
  shouldApplyEvent,
  type AccessRow,
} from "../supabase/functions/stripe-webhook/subscription";

const NOW = new Date("2026-10-07T12:00:00.000Z");
const day = 24 * 60 * 60 * 1000;
const paid = (status: string, endOffsetDays?: number): AccessRow => ({
  plan_kind: "paid",
  status,
  current_period_end: endOffsetDays === undefined ? null : new Date(NOW.getTime() + endOffsetDays * day).toISOString(),
});

describe("hasAccess", () => {
  it("las cuentas gratis para siempre siempre entran", () => {
    expect(hasAccess([{ plan_kind: "free_forever", status: "active" }], NOW)).toBe(true);
    expect(hasAccess([{ plan_kind: "free_forever", status: "canceled" }], NOW)).toBe(true);
  });

  it("activa y en prueba dan acceso", () => {
    expect(hasAccess([paid("active", 20)], NOW)).toBe(true);
    expect(hasAccess([paid("trialing", 5)], NOW)).toBe(true);
  });

  it("cancelada, impagada o sin completar no da acceso", () => {
    for (const s of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]) {
      expect(hasAccess([paid(s, 20)], NOW)).toBe(false);
    }
  });

  it("cobro fallido: acceso durante los días de cortesía y no después", () => {
    expect(hasAccess([paid("past_due", -(GRACE_DAYS - 1))], NOW)).toBe(true); // venció hace 6 días
    expect(hasAccess([paid("past_due", -GRACE_DAYS)], NOW)).toBe(true); // justo el último día
    expect(hasAccess([paid("past_due", -(GRACE_DAYS + 1))], NOW)).toBe(false); // ya pasó
    expect(hasAccess([paid("past_due", 3)], NOW)).toBe(true); // el periodo aún no ha acabado
  });

  it("past_due sin fecha de fin no da acceso (no hay forma de saber hasta cuándo)", () => {
    expect(hasAccess([paid("past_due")], NOW)).toBe(false);
  });

  it("basta una fila válida entre varias", () => {
    expect(hasAccess([paid("canceled"), paid("active", 10)], NOW)).toBe(true);
    expect(hasAccess([paid("canceled"), paid("unpaid")], NOW)).toBe(false);
  });

  it("sin filas no hay acceso", () => {
    expect(hasAccess([], NOW)).toBe(false);
  });

  it("los días de cortesía se pueden cambiar", () => {
    expect(hasAccess([paid("past_due", -10)], NOW, 14)).toBe(true);
    expect(hasAccess([paid("past_due", -10)], NOW, 3)).toBe(false);
  });
});

describe("rowFromSubscription", () => {
  const sub = {
    id: "sub_123",
    status: "active",
    customer: "cus_9",
    current_period_end: 1_790_000_000,
    cancel_at_period_end: true,
    trial_end: null,
  };

  it("traduce los campos de Stripe (segundos → fechas) y normaliza el email", () => {
    const r = rowFromSubscription(sub, "  Persona@Correo.COM ", 1_789_000_000, NOW);
    expect(r.email).toBe("persona@correo.com");
    expect(r.plan_kind).toBe("paid");
    expect(r.stripe_subscription_id).toBe("sub_123");
    expect(r.stripe_customer_id).toBe("cus_9");
    expect(r.current_period_end).toBe(new Date(1_790_000_000 * 1000).toISOString());
    expect(r.cancel_at_period_end).toBe(true);
    expect(r.trial_end).toBeNull();
    expect(r.last_event_at).toBe(new Date(1_789_000_000 * 1000).toISOString());
  });

  it("acepta el cliente como objeto y campos que faltan", () => {
    const r = rowFromSubscription({ id: "sub_1", status: "trialing", customer: { id: "cus_2" } }, "a@b.c", 1_789_000_000, NOW);
    expect(r.stripe_customer_id).toBe("cus_2");
    expect(r.current_period_end).toBeNull();
    expect(r.cancel_at_period_end).toBe(false);
  });
});

describe("shouldApplyEvent (avisos desordenados)", () => {
  it("aplica si no hay nada guardado", () => {
    expect(shouldApplyEvent(null, 1_789_000_000)).toBe(true);
    expect(shouldApplyEvent(undefined, 1_789_000_000)).toBe(true);
  });

  it("ignora un aviso más viejo que el guardado, aplica uno igual o más nuevo", () => {
    const stored = new Date(1_789_000_100 * 1000).toISOString();
    expect(shouldApplyEvent(stored, 1_789_000_000)).toBe(false);
    expect(shouldApplyEvent(stored, 1_789_000_100)).toBe(true);
    expect(shouldApplyEvent(stored, 1_789_000_200)).toBe(true);
  });

  it("si la fecha guardada está rota, aplica", () => {
    expect(shouldApplyEvent("no es una fecha", 1_789_000_000)).toBe(true);
  });
});

describe("isHandledEvent", () => {
  it("solo los eventos que cambian una suscripción", () => {
    expect(isHandledEvent("customer.subscription.updated")).toBe(true);
    expect(isHandledEvent("customer.subscription.deleted")).toBe(true);
    expect(isHandledEvent("checkout.session.completed")).toBe(true);
    expect(isHandledEvent("invoice.paid")).toBe(false);
    expect(isHandledEvent("charge.succeeded")).toBe(false);
  });
});
