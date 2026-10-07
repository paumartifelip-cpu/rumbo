import { getSupabase } from "./supabase";

// ── Paywall: Stripe checkout (suscripción) ────────────────────────────────────
// Todo usuario nuevo paga la suscripción ANTES de crear su cuenta:
//   /login (modo registro) → enlace de pago de Stripe → Stripe redirige a
//   /activar?session_id={CHECKOUT_SESSION_ID} → la Edge Function
//   `verify-payment` comprueba el pago contra Stripe → formulario de cuenta.
// Cada pago solo puede crear una cuenta (columna `used` en paid_codes).

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  PLAN DE PAGO — TODO LO QUE SE CAMBIA AL PONER OTRO LINK DE STRIPE ESTÁ AQUÍ  ║
// ╚════════════════════════════════════════════════════════════════════════════╝
// Si cambias de link de pago o de precio, edita SOLO este bloque (o la variable
// NEXT_PUBLIC_STRIPE_PAYMENT_URL en Cloudflare, para el link). Las pantallas de
// registro y de Ajustes leen de aquí. Ver supabase/PAYWALL_SETUP.md, sección
// "Cambiar el link de pago", antes de cambiarlo: el nuevo link de Stripe DEBE
// redirigir a  https://usarumbo.com/activar?session_id={CHECKOUT_SESSION_ID}

const DEFAULT_PAYMENT_URL = "https://buy.stripe.com/eVqcN74R81YFd9q7xz5Ne0t";

export const PLAN = {
  name: "Rumbo Premium",
  /** Número grande de la pantalla de registro. */
  price: "3,99 €",
  /** Lo que va junto al precio ("al mes", "al año"…). */
  period: "al mes",
  /** Frase corta bajo el precio. Déjala vacía ("") si no quieres ninguna. */
  priceNote: "Unos 13 céntimos al día · menos que un café a la semana",
  /** Resumen de una línea, para Ajustes → Mi plan. */
  summary: "3,99 €/mes",
  /** Días de garantía de devolución. Pon 0 para ocultar el aviso de garantía. */
  guaranteeDays: 30,
  /** Link de pago de Stripe. Se puede sobrescribir con NEXT_PUBLIC_STRIPE_PAYMENT_URL. */
  paymentUrl: DEFAULT_PAYMENT_URL,
};

// ─────────────────────────────────────────────────────────────────────────────

/** Un link de pago válido es una dirección https de Stripe; cualquier otra cosa se rechaza. */
export function isStripePaymentUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const u = new URL(value.trim());
    return (
      u.protocol === "https:" &&
      (u.hostname === "buy.stripe.com" || u.hostname === "checkout.stripe.com")
    );
  } catch {
    return false;
  }
}

/**
 * Link de pago efectivo: el de la variable de entorno si es válido; si alguien
 * pone algo roto (una errata), cae al de PLAN en vez de dejar el botón muerto.
 */
export function resolvePaymentUrl(envValue: string | undefined, fallback: string): string {
  if (isStripePaymentUrl(envValue)) return envValue.trim();
  if (envValue) {
    console.warn("NEXT_PUBLIC_STRIPE_PAYMENT_URL no es un link de Stripe válido; se usa el de PLAN.");
  }
  return fallback;
}

export const STRIPE_PAYMENT_URL = resolvePaymentUrl(
  process.env.NEXT_PUBLIC_STRIPE_PAYMENT_URL,
  PLAN.paymentUrl
);

// Alias antiguos: Ajustes los usa.
export const PLAN_NAME = PLAN.name;
export const PLAN_PRICE_LABEL = PLAN.summary;

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
