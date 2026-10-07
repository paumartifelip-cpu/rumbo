// Lógica pura de suscripciones (sin Deno, sin red, sin base de datos) para poder
// probarla con tests. La usan la Edge Function `stripe-webhook` y, más adelante,
// la comprobación de acceso de la app.

export type PlanKind = "paid" | "free_forever";

/** Días de cortesía tras un cobro fallido, antes de cortar el acceso. */
export const GRACE_DAYS = 7;

export interface AccessRow {
  plan_kind: PlanKind;
  status: string;
  current_period_end?: string | null;
}

/**
 * ¿Tiene acceso quien tiene estas filas de suscripción?
 * - Gratis para siempre: siempre.
 * - Activa o en prueba: sí.
 * - Cobro fallido (past_due): sí durante GRACE_DAYS desde el fin del periodo pagado.
 * - Cualquier otra cosa (cancelada, impagada, incompleta…): no.
 * Basta con que UNA fila dé acceso.
 */
export function hasAccess(rows: AccessRow[], now: Date, graceDays = GRACE_DAYS): boolean {
  return rows.some((r) => {
    if (r.plan_kind === "free_forever") return true;
    if (r.status === "active" || r.status === "trialing") return true;
    if (r.status === "past_due") {
      if (!r.current_period_end) return false;
      const end = new Date(r.current_period_end).getTime();
      if (Number.isNaN(end)) return false;
      return now.getTime() <= end + graceDays * 24 * 60 * 60 * 1000;
    }
    return false;
  });
}

// ── Stripe → fila de la tabla `subscriptions` ────────────────────────────────

/** Solo los campos de una suscripción de Stripe que usamos. */
export interface StripeSubscriptionLike {
  id: string;
  status: string;
  customer: string | { id: string };
  items?: {
    data: Array<{
      price?: { id?: string | null } | null;
      // Las versiones nuevas de la API de Stripe mueven el fin del periodo a cada "item".
      current_period_end?: number | null;
    }>;
  } | null;
  current_period_end?: number | null; // segundos Unix
  cancel_at_period_end?: boolean | null;
  trial_end?: number | null;
}

export interface SubscriptionRow {
  email: string;
  plan_kind: "paid";
  status: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_end: string | null;
  last_event_at: string;
  updated_at: string;
}

/**
 * La cuenta de Stripe también la usan OTROS negocios (otros productos y clientes).
 * Solo se anotan las suscripciones de Rumbo: las que tienen alguno de estos
 * precios (price_...). Si la lista está vacía NO se acepta nada ("falla cerrado"):
 * es mejor no anotar que mezclar clientes de otro negocio.
 */
export function parsePriceIds(raw?: string | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.startsWith("price_"));
}

export function isRumboSubscription(sub: StripeSubscriptionLike, allowedPriceIds: string[]): boolean {
  if (allowedPriceIds.length === 0) return false;
  const prices = (sub.items?.data ?? []).map((i) => i.price?.id).filter((x): x is string => Boolean(x));
  return prices.some((p) => allowedPriceIds.includes(p));
}

/**
 * Fin del periodo pagado. Según la versión de la API de Stripe del aviso, está en la
 * suscripción (antigua) o en sus items (nueva); se acepta cualquiera de las dos.
 */
export function periodEnd(sub: StripeSubscriptionLike): number | null {
  if (typeof sub.current_period_end === "number") return sub.current_period_end;
  const ends = (sub.items?.data ?? [])
    .map((i) => i.current_period_end)
    .filter((x): x is number => typeof x === "number");
  return ends.length > 0 ? Math.max(...ends) : null;
}

const iso = (seconds?: number | null) =>
  typeof seconds === "number" && Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null;

export const normalizeEmail = (email?: string | null) => (email ?? "").trim().toLowerCase();

export function rowFromSubscription(
  sub: StripeSubscriptionLike,
  email: string,
  eventCreated: number,
  now: Date = new Date()
): SubscriptionRow {
  return {
    email: normalizeEmail(email),
    plan_kind: "paid",
    status: sub.status,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    current_period_end: iso(periodEnd(sub)),
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    trial_end: iso(sub.trial_end),
    last_event_at: iso(eventCreated)!,
    updated_at: now.toISOString(),
  };
}

/**
 * Stripe puede entregar eventos desordenados o repetidos. Solo se aplica un
 * evento si es más nuevo (o igual) que el último ya guardado para esa suscripción.
 */
export function shouldApplyEvent(storedLastEventAt: string | null | undefined, eventCreated: number): boolean {
  if (!storedLastEventAt) return true;
  const stored = new Date(storedLastEventAt).getTime();
  if (Number.isNaN(stored)) return true;
  return eventCreated * 1000 >= stored;
}

/** Eventos de Stripe que cambian el estado de una suscripción. */
export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
] as const;

export const isHandledEvent = (type: string): boolean =>
  (HANDLED_EVENTS as readonly string[]).includes(type);
