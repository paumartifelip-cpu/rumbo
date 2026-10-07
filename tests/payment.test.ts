import { describe, expect, it, vi } from "vitest";
import { isStripePaymentUrl, PLAN, resolvePaymentUrl } from "@/lib/payment";

describe("link de pago de Stripe", () => {
  it("acepta links https de Stripe", () => {
    expect(isStripePaymentUrl("https://buy.stripe.com/abc123")).toBe(true);
    expect(isStripePaymentUrl("https://checkout.stripe.com/c/pay/cs_live_x")).toBe(true);
    expect(isStripePaymentUrl("  https://buy.stripe.com/abc123  ")).toBe(true);
  });

  it("rechaza lo que no es un link de Stripe (errata, otra web, http)", () => {
    for (const bad of [undefined, "", "buy.stripe.com/abc", "http://buy.stripe.com/abc", "https://evil.com/buy.stripe.com", "https://buy.stripe.com.evil.com/x", "no es un link"]) {
      expect(isStripePaymentUrl(bad)).toBe(false);
    }
  });

  it("usa el de la variable de entorno si es válido y quita espacios", () => {
    expect(resolvePaymentUrl(" https://buy.stripe.com/nuevo ", PLAN.paymentUrl)).toBe("https://buy.stripe.com/nuevo");
  });

  it("si la variable está rota, cae al link del plan en vez de dejar el botón muerto", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolvePaymentUrl("https://evil.com/x", PLAN.paymentUrl)).toBe(PLAN.paymentUrl);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("sin variable usa el del plan, sin avisar", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolvePaymentUrl(undefined, PLAN.paymentUrl)).toBe(PLAN.paymentUrl);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("el link por defecto del plan es un link de Stripe válido", () => {
    expect(isStripePaymentUrl(PLAN.paymentUrl)).toBe(true);
  });
});
