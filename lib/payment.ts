import { getSupabase } from "./supabase";
import { DEFAULT_PROFILES } from "./profiles";

// ── Public Stripe payment link ────────────────────────────────────────────────
// Set on Cloudflare Pages via NEXT_PUBLIC_STRIPE_PAYMENT_URL too if you want.
export const STRIPE_PAYMENT_URL =
  process.env.NEXT_PUBLIC_STRIPE_PAYMENT_URL ||
  "https://buy.stripe.com/fZu14perIavbc5mf015Ne0n";

// localStorage key holding the email a user typed before going to Stripe.
const PENDING_EMAIL_KEY = "rumbo_pending_payment_email";
const PENDING_NAME_KEY = "rumbo_pending_payment_name";

const PRIVILEGED_PROFILE_IDS = new Set(DEFAULT_PROFILES.map((p) => p.id));

/** Pau and Michelle never see the paywall. */
export function isPrivilegedProfile(id: string): boolean {
  return PRIVILEGED_PROFILE_IDS.has(id);
}

export function savePendingPayment(email: string, name: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PENDING_EMAIL_KEY, email.toLowerCase().trim());
  localStorage.setItem(PENDING_NAME_KEY, name.trim());
}

export function getPendingPayment(): { email: string; name: string } | null {
  if (typeof window === "undefined") return null;
  const email = localStorage.getItem(PENDING_EMAIL_KEY);
  const name = localStorage.getItem(PENDING_NAME_KEY) || "";
  if (!email) return null;
  return { email, name };
}

export function clearPendingPayment() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PENDING_EMAIL_KEY);
  localStorage.removeItem(PENDING_NAME_KEY);
}

export interface PaidUser {
  email: string;
  name: string | null;
  paid_at: string;
  used: boolean;
}

/**
 * Fetch a paid_users row by email. Returns null if not found / not paid.
 */
export async function fetchPaidUser(email: string): Promise<PaidUser | null> {
  const supa = getSupabase();
  if (!supa) return null;
  const normalized = email.toLowerCase().trim();
  try {
    const { data, error } = await supa
      .from("paid_users")
      .select("email, name, paid_at, used")
      .eq("email", normalized)
      .maybeSingle();
    if (error || !data) return null;
    return data as PaidUser;
  } catch {
    return null;
  }
}

/**
 * Mark a paid email as `used = true` once the profile has been created.
 * Prevents reusing the same payment to spawn unlimited profiles.
 */
export async function markPaidEmailUsed(email: string): Promise<void> {
  const supa = getSupabase();
  if (!supa) return;
  const normalized = email.toLowerCase().trim();
  try {
    await supa.from("paid_users").update({ used: true }).eq("email", normalized);
  } catch {
    // ignore
  }
}

/**
 * Build the Stripe Checkout URL with prefilled email + client_reference_id
 * (Stripe Payment Links accept these query params).
 */
export function buildStripeUrl(email: string): string {
  const url = new URL(STRIPE_PAYMENT_URL);
  url.searchParams.set("prefilled_email", email);
  url.searchParams.set("client_reference_id", email.toLowerCase().trim());
  return url.toString();
}

/**
 * Poll paid_users every `intervalMs` for up to `timeoutMs`. Resolves once a
 * row is found, rejects on timeout. Used right after Stripe redirect since
 * the webhook may still be processing.
 */
export async function pollForPayment(
  email: string,
  { intervalMs = 2000, timeoutMs = 60000 }: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<PaidUser | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const row = await fetchPaidUser(email);
    if (row && !row.used) return row;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}
