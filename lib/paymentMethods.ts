import { FinancialEntry, PaymentMethod } from "./types";

export const PAYMENT_METHODS: { key: PaymentMethod; icon: string; label: string }[] = [
  { key: "efectivo",      icon: "💵", label: "Efectivo" },
  { key: "debito",        icon: "💳", label: "Débito" },
  { key: "credito",       icon: "💳", label: "Crédito" },
  { key: "transferencia", icon: "🏦", label: "Transferencia" },
  { key: "bizum",         icon: "📲", label: "Bizum" },
];

const KEYS = new Set<string>(PAYMENT_METHODS.map((m) => m.key));
export const isPaymentMethod = (v: unknown): v is PaymentMethod =>
  typeof v === "string" && KEYS.has(v);

export const paymentLabel = (m: PaymentMethod) =>
  PAYMENT_METHODS.find((x) => x.key === m)!.label;

/** Solo débito y crédito llevan nombre de tarjeta. */
export const methodHasAccount = (m?: PaymentMethod) => m === "debito" || m === "credito";

export const MAX_ACCOUNT_LEN = 30;
const cleanAccount = (s: string) => s.trim().replace(/\s+/g, " ").slice(0, MAX_ACCOUNT_LEN);

/**
 * Tarjetas ya usadas para ese método (más usadas primero), sin duplicados por
 * mayúsculas: "bbva visa" y "BBVA Visa" son la misma. Sin tabla propia: la
 * lista sale del historial de gastos.
 */
export function accountSuggestions(finances: FinancialEntry[], method: PaymentMethod): string[] {
  const counts = new Map<string, { label: string; n: number }>();
  for (const f of finances) {
    if (f.payment_method !== method || !f.payment_account) continue;
    const label = cleanAccount(f.payment_account);
    if (!label) continue;
    const k = label.toLowerCase();
    const cur = counts.get(k);
    counts.set(k, { label: cur?.label ?? label, n: (cur?.n ?? 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).map((x) => x.label);
}

/** Si el texto coincide (sin mayúsculas) con una tarjeta existente, usa la existente. */
export function canonicalAccount(input: string, suggestions: string[]): string {
  const clean = cleanAccount(input);
  return suggestions.find((s) => s.toLowerCase() === clean.toLowerCase()) ?? clean;
}

/** Normaliza los campos de pago de un gasto antes de guardarlo. */
export function sanitizePayment(
  method: unknown,
  account: unknown
): { payment_method?: PaymentMethod; payment_account?: string } {
  if (!isPaymentMethod(method)) return {};
  const acc = methodHasAccount(method) && typeof account === "string" ? cleanAccount(account) : "";
  return { payment_method: method, ...(acc ? { payment_account: acc } : {}) };
}
