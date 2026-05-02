// Simple per-profile PIN gate. Not real security — just a soft lock so the
// other person can't open the app and accidentally land on someone else's
// session. PIN is stored in localStorage as plain text since the whole app
// already trusts localStorage for the active session.

const PIN_KEY = (id: string) => `rumbo_pin_${id}`;
const VERIFIED_KEY = (id: string) => `rumbo_pin_verified_${id}`;

// After this many days idle, the user has to re-enter the PIN.
export const PIN_THRESHOLD_DAYS = 7;
const PIN_THRESHOLD_MS = PIN_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

export function isPinSet(profileId: string): boolean {
  if (typeof window === "undefined") return false;
  const v = localStorage.getItem(PIN_KEY(profileId));
  return Boolean(v && /^\d{4}$/.test(v));
}

export function setPin(profileId: string, pin: string) {
  if (typeof window === "undefined") return;
  if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be 4 digits");
  localStorage.setItem(PIN_KEY(profileId), pin);
  markVerified(profileId);
}

export function clearPin(profileId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PIN_KEY(profileId));
  localStorage.removeItem(VERIFIED_KEY(profileId));
}

export function checkPin(profileId: string, pin: string): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(PIN_KEY(profileId));
  return Boolean(stored && stored === pin);
}

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
