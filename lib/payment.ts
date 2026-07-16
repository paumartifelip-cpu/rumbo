import { getSupabase } from "./supabase";

// ── Paywall: Stripe checkout (suscripción) ────────────────────────────────────
// Todo usuario nuevo paga la suscripción ANTES de crear su cuenta:
//   /login (modo registro) → enlace de pago de Stripe → Stripe redirige a
//   /activar?session_id={CHECKOUT_SESSION_ID} → la Edge Function
//   `verify-payment` comprueba el pago contra Stripe → formulario de cuenta.
// Cada pago solo puede crear una cuenta (columna `used` en paid_codes).

export const STRIPE_PAYMENT_URL =
  process.env.NEXT_PUBLIC_STRIPE_PAYMENT_URL ||
  "https://buy.stripe.com/eVqcN74R81YFd9q7xz5Ne0t";

export const PLAN_NAME = "Rumbo Premium";
export const PLAN_PRICE_LABEL = "3,99 €/mes";

// ── Baja por WhatsApp ─────────────────────────────────────────────────────────

const WHATSAPP_NUMBER = "34601108311";

export function buildCancelWhatsAppUrl(email?: string): string {
  const msg = `Hola, quiero darme de baja de Rumbo.${email ? ` Mi email es ${email}.` : ""}`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

export function buildSupportWhatsAppUrl(topic: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(topic)}`;
}

// ── Verificación del pago (Edge Function verify-payment) ─────────────────────

export type VerifyResult =
  | { ok: true; email: string; name: string | null }
  | { ok: false; reason: string };

export async function verifyPaidSession(sessionId: string): Promise<VerifyResult> {
  const supa = getSupabase();
  if (!supa) return { ok: false, reason: "offline" };
  try {
    const { data, error } = await supa.functions.invoke("verify-payment", {
      body: { session_id: sessionId },
    });
    if (error || !data) return { ok: false, reason: "network" };
    return data as VerifyResult;
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** Marca la sesión de pago como usada y liga el email definitivo de la cuenta. */
export async function consumePaidSession(sessionId: string, email: string, name: string): Promise<void> {
  const supa = getSupabase();
  if (!supa) return;
  try {
    await supa.functions.invoke("verify-payment", {
      body: { session_id: sessionId, consume: true, email, name },
    });
  } catch {
    // No bloquea la cuenta recién creada; el pago ya quedó registrado.
  }
}

// ── Plan del usuario (Ajustes) ────────────────────────────────────────────────

/**
 * True si el email tiene un pago registrado en paid_codes (RLS solo deja ver
 * la fila cuyo email coincide con el del JWT). Las cuentas anteriores al
 * paywall no tienen fila: son las "cuentas fundadoras", sin coste.
 */
export async function fetchIsPremium(email: string | undefined): Promise<boolean> {
  if (!email) return false;
  const supa = getSupabase();
  if (!supa) return false;
  try {
    const { data, error } = await supa
      .from("paid_codes")
      .select("code")
      .eq("email", email.trim().toLowerCase())
      .limit(1);
    if (error) return false;
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
