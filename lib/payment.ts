import { getSupabase } from "./supabase";
import { DEFAULT_PROFILES } from "./profiles";

export const STRIPE_PAYMENT_URL =
  process.env.NEXT_PUBLIC_STRIPE_PAYMENT_URL ||
  "https://buy.stripe.com/fZu14perIavbc5mf015Ne0n";

const PENDING_CODE_KEY  = "rumbo_pending_code";
const PENDING_NAME_KEY  = "rumbo_pending_name";
const PENDING_EMAIL_KEY = "rumbo_pending_email";

const PRIVILEGED_PROFILE_IDS = new Set(DEFAULT_PROFILES.map((p) => p.id));

export function isPrivilegedProfile(id: string): boolean {
  return PRIVILEGED_PROFILE_IDS.has(id);
}

// ── Code generation (internal — never shown to the user) ─────────────────────
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateCode(): string {
  let code = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint8Array(8);
    crypto.getRandomValues(buf);
    for (let i = 0; i < 8; i++) code += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
  } else {
    for (let i = 0; i < 8; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "").trim();
}

// ── Pending purchase state (localStorage) ────────────────────────────────────

export function savePendingPayment(code: string, name: string, email: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PENDING_CODE_KEY,  normalizeCode(code));
  localStorage.setItem(PENDING_NAME_KEY,  name.trim());
  localStorage.setItem(PENDING_EMAIL_KEY, email.trim().toLowerCase());
}

export function getPendingPayment(): { code: string; name: string; email: string } | null {
  if (typeof window === "undefined") return null;
  const code  = localStorage.getItem(PENDING_CODE_KEY);
  const name  = localStorage.getItem(PENDING_NAME_KEY)  || "";
  const email = localStorage.getItem(PENDING_EMAIL_KEY) || "";
  if (!code) return null;
  return { code, name, email };
}

export function clearPendingPayment() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PENDING_CODE_KEY);
  localStorage.removeItem(PENDING_NAME_KEY);
  localStorage.removeItem(PENDING_EMAIL_KEY);
}

// ── Supabase types ────────────────────────────────────────────────────────────

export interface PaidCode {
  code: string;
  name: string | null;
  email: string | null;
  paid_at: string;
  used: boolean;
}

// ── Lookup by email (primary recovery path) ───────────────────────────────────

export async function fetchPaidCodeByEmail(email: string): Promise<PaidCode | null> {
  const supa = getSupabase();
  if (!supa) return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  try {
    const { data, error } = await supa
      .from("paid_codes")
      .select("code, name, email, paid_at, used")
      .eq("email", normalized)
      .eq("used", false)
      .maybeSingle();
    if (error || !data) return null;
    return data as PaidCode;
  } catch {
    return null;
  }
}

// ── Mark code used after profile creation ─────────────────────────────────────

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

// ── Stripe URL ────────────────────────────────────────────────────────────────

/**
 * Build the Stripe Checkout URL.
 * - client_reference_id  → internal code so the webhook knows which purchase it is
 * - prefilled_email       → pre-fills the email field in Stripe checkout
 */
export function buildStripeUrl(code: string, email: string): string {
  const url = new URL(STRIPE_PAYMENT_URL);
  url.searchParams.set("client_reference_id", normalizeCode(code));
  if (email) url.searchParams.set("prefilled_email", email.trim());
  return url.toString();
}

// ── Polling ───────────────────────────────────────────────────────────────────

/**
 * Poll paid_codes by email until a paid-but-unused row appears.
 * Used right after Stripe redirects back, while the webhook may still be processing.
 */
export async function pollForPaymentByEmail(
  email: string,
  { intervalMs = 2000, timeoutMs = 30000 }: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<PaidCode | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const row = await fetchPaidCodeByEmail(email);
    if (row) return row;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}
