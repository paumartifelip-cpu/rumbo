export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

import { Currency, formatCurrency } from "./currency";

/**
 * Backwards-compatible money formatter. Defaults to EUR but accepts any
 * supported currency. Prefer using `useFormatMoney` from the store when
 * you need formatting tied to the user's primary currency.
 */
export function formatMoney(value: number, currency: Currency = "EUR") {
  return formatCurrency(value, currency);
}

export function formatDate(value?: string) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function daysUntil(date?: string) {
  if (!date) return null;
  const d = new Date(date).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((d - now) / (1000 * 60 * 60 * 24)));
}

export function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
