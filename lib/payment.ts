import { getSupabase } from "./supabase";
import { DEFAULT_PROFILES } from "./profiles";

// ── Public Stripe payment link ────────────────────────────────────────────────
export const STRIPE_PAYMENT_URL =
  process.env.NEXT_PUBLIC_STRIPE_PAYMENT_URL ||
  "https://buy.stripe.com/fZu14perIavbc5mf015Ne0n";

// localStorage keys for the pending purchase.
const PENDING_CODE_KEY = "rumbo_pending_payment_code";
const PENDING_NAME_KEY = "rumbo_pending_payment_name";

const PRIVILEGED_PROFILE_IDS = new Set(DEFAULT_PROFILES.map((p) => p.id));

/** Pau and Michelle never see the paywall. */
export function isPrivilegedProfile(id: string): boolean {
  return PRIVILEGED_PROFILE_IDS.has(id);
}

// ── Code generation ───────────────────────────────────────────────────────────
// Crockford-ish alphabet (no 0/O, 1/I, etc.) → 8 chars → ~1.1 trillion combos.
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateCode(): string {
  let code = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint8Array(8);
    crypto.getRandomValues(buf);
    for (let i = 0; i < 8; i++) {
      code += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
    }
  } else {
    for (let i = 0; i < 8; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
  }
  return code;
}

/** Normalize user-typed codes (uppercase, strip whitespace + dashes). */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "").trim();
}

// ── Pending purchase state (localStorage) ────────────────────────────────────

export function savePendingPayment(code: string, name: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PENDING_CODE_KEY, normalizeCode(code));
  localStorage.setItem(PENDING_NAME_KEY, name.trim());
}

export function getPendingPayment(): { code: string; name: string } | null {
  if (typeof window === "undefined") return null;
  const code = localStorage.getItem(PENDING_CODE_KEY);
  const name = localStorage.getItem(PENDING_NAME_KEY) || "";
  if (!code) return null;
  return { code, name };
}

export function clearPendingPayment() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PENDING_CODE_KEY);
  localStorage.removeItem(PENDING_NAME_KEY);
}

// ── Supabase access ──────────────────────────────────────────────────────────

export interface PaidCode {
  code: string;
  name: string | null;
  paid_at: string;
  used: boolean;
}

/** Fetch a paid_codes row by code. Returns null if not found. */
export async function fetchPaidCode(code: string): Promise<PaidCode | null> {
  const supa = getSupabase();
  if (!supa) return null;
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  try {
    const { data, error } = await supa
      .from("paid_codes")
      .select("code, name, paid_at, used")
      .eq("code", normalized)
      .maybeSingle();
    if (error || !data) return null;
    return data as PaidCode;
  } catch {
    return null;
  }
}

/** Mark a code as used so the same payment can't unlock multiple profiles. */
export async function markCodeUsed(code: string): Promise<void> {
  const supa = getSupabase();
  if (!supa) return;
  const normalized = normalizeCode(code);
  if (!normalized) return;
  try {
    await supa.from("paid_codes").update({ used: true }).eq("code", normalized);
  } catch {
    // ignore
  }
}

/**
 * Build the Stripe Checkout URL with `client_reference_id` set to the code.
 * Stripe Payment Links accept this query param and forward it on the
 * `checkout.session.completed` event so the webhook knows which code paid.
 */
export function buildStripeUrl(code: string): string {
  const url = new URL(STRIPE_PAYMENT_URL);
  url.searchParams.set("client_reference_id", normalizeCode(code));
  return url.toString();
}

/**
 * Poll paid_codes every `intervalMs` for up to `timeoutMs`. Resolves when an
 * unused row is found, returns null on timeout. Used right after Stripe
 * redirect since the webhook may still be processing.
 */
export async function pollForPayment(
  code: string,
  { intervalMs = 2000, timeoutMs = 60000 }: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<PaidCode | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const row = await fetchPaidCode(code);
    if (row && !row.used) return row;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}
