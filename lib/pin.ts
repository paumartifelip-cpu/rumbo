// Per-profile PIN gate.
// PIN is stored as a SHA-256 hash in BOTH Supabase (profiles.pin_hash) and
// localStorage (cache, populated by the registry sync). That way the PIN
// follows the user across devices and the gate stops asking to "create" a new
// one every time a different browser opens the app.
//
// Verification is deliberately a soft lock — anyone who can read localStorage
// can also read the rest of the user's data. The hash exists so we never
// store the actual PIN in the database.

import { getSupabase } from "./supabase";

const PIN_KEY = (id: string) => `rumbo_pin_${id}`;
const VERIFIED_KEY = (id: string) => `rumbo_pin_verified_${id}`;

export const PIN_THRESHOLD_DAYS = 7;
const PIN_THRESHOLD_MS = PIN_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

// ── Hash helper ───────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const isHash = (s: string) => /^[0-9a-f]{64}$/.test(s);
const isLegacyPlain = (s: string) => /^\d{4}$/.test(s);

// ── Local cache (populated by the registry sync) ──────────────────────────────

/** Returns true if we have a stored credential (hash or legacy plaintext). */
export function isPinSet(profileId: string): boolean {
  if (typeof window === "undefined") return false;
  const v = localStorage.getItem(PIN_KEY(profileId));
  return Boolean(v);
}

/** Cache a profile's pin hash from Supabase into localStorage. */
export function cachePinHash(profileId: string, hash: string | null | undefined) {
  if (typeof window === "undefined") return;
  if (hash) {
    localStorage.setItem(PIN_KEY(profileId), hash);
  }
  // We don't auto-remove a cached hash here — a Supabase row temporarily
  // missing pin_hash (e.g. mid-write) shouldn't blow away the local cache.
  // clearPin is the explicit way to remove a PIN.
}

// ── Set / clear ───────────────────────────────────────────────────────────────

/**
 * Hash the PIN, save it locally, and push it to Supabase.
 */
export async function setPin(profileId: string, userId: string, pin: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be 4 digits");
  const hash = await sha256(pin);
  localStorage.setItem(PIN_KEY(profileId), hash);
  markVerified(profileId);
  const supa = getSupabase();
  if (supa) {
    try {
      await supa.from("profiles").update({ pin_hash: hash }).eq("user_id", userId);
    } catch {
      // ignore — local cache is still up to date
    }
  }
}

export async function clearPin(profileId: string, userId: string): Promise<void> {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PIN_KEY(profileId));
  localStorage.removeItem(VERIFIED_KEY(profileId));
  const supa = getSupabase();
  if (supa) {
    try {
      await supa.from("profiles").update({ pin_hash: null }).eq("user_id", userId);
    } catch {
      // ignore
    }
  }
}

// ── Check ─────────────────────────────────────────────────────────────────────

/**
 * Verify a PIN against the stored hash. Handles legacy plaintext PINs by
 * upgrading them to a hash on a successful match.
 */
export async function checkPin(profileId: string, userId: string, pin: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(PIN_KEY(profileId));
  if (!stored) return false;

  // Legacy plaintext (from before this change) — compare directly, then upgrade.
  if (isLegacyPlain(stored)) {
    if (stored !== pin) return false;
    // Match: upgrade local + push hash to Supabase so the next check is hash-based.
    const hash = await sha256(pin);
    localStorage.setItem(PIN_KEY(profileId), hash);
    const supa = getSupabase();
    if (supa) {
      try { await supa.from("profiles").update({ pin_hash: hash }).eq("user_id", userId); } catch {}
    }
    markVerified(profileId);
    return true;
  }

  if (isHash(stored)) {
    const inputHash = await sha256(pin);
    if (inputHash !== stored) return false;
    markVerified(profileId);
    return true;
  }

  return false;
}

// ── Idle threshold ────────────────────────────────────────────────────────────

export function markVerified(profileId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(VERIFIED_KEY(profileId), String(Date.now()));
}

export function needsPinPrompt(profileId: string): boolean {
  if (typeof window === "undefined") return false;
  if (!isPinSet(profileId)) return false;
  const ts = Number(localStorage.getItem(VERIFIED_KEY(profileId)) ?? 0);
  if (!ts) return true;
  return Date.now() - ts > PIN_THRESHOLD_MS;
}
