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

// ── Desglose y filtro (fase 2) ────────────────────────────────────────────────

/** Filtro de la lista de movimientos. "none" = gastos sin método indicado. */
export type PayFilter = { method: PaymentMethod | "none"; account?: string } | null;

export function matchesPayFilter(f: FinancialEntry, filter: PayFilter): boolean {
  if (!filter) return true;
  if (filter.method === "none") return !f.payment_method;
  if (f.payment_method !== filter.method) return false;
  if (!filter.account) return true;
  return cleanAccount(f.payment_account ?? "").toLowerCase() === filter.account.toLowerCase();
}

export interface PaymentSlice {
  key: PaymentMethod | "none";
  total: number;
  count: number;
  /** Tarjetas con nombre dentro de débito/crédito, de mayor a menor gasto. */
  accounts: { name: string; total: number; count: number }[];
}

/**
 * Reparte el gasto de una lista entre métodos de pago (en moneda principal).
 * Los gastos sin método van a "none", así los porcentajes suman siempre 100 %.
 */
export function spendByPayment(
  items: FinancialEntry[],
  toPrimary: (f: FinancialEntry) => number
): { slices: PaymentSlice[]; total: number } {
  const map = new Map<string, PaymentSlice & { acc: Map<string, { name: string; total: number; count: number }> }>();
  let total = 0;
  for (const f of items) {
    const amt = toPrimary(f);
    total += amt;
    const key = f.payment_method ?? "none";
    let s = map.get(key);
    if (!s) {
      s = { key: key as PaymentSlice["key"], total: 0, count: 0, accounts: [], acc: new Map() };
      map.set(key, s);
    }
    s.total += amt;
    s.count += 1;
    if (f.payment_method && methodHasAccount(f.payment_method) && f.payment_account) {
      const name = cleanAccount(f.payment_account);
      const k = name.toLowerCase();
      const a = s.acc.get(k) ?? { name, total: 0, count: 0 };
      a.total += amt;
      a.count += 1;
      s.acc.set(k, a);
    }
  }
  const slices = [...map.values()]
    .map(({ acc, ...s }) => ({ ...s, accounts: [...acc.values()].sort((a, b) => b.total - a.total) }))
    .sort((a, b) => (a.key === "none" ? 1 : b.key === "none" ? -1 : b.total - a.total));
  return { slices, total };
}
