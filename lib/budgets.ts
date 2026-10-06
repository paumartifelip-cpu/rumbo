import { convertAmount, Currency } from "./currency";
import { EXPENSE_CATEGORIES, heuristicCategorize } from "./gemini";
import { Budget, FinancialEntry } from "./types";

// "Deudas" no se elige al añadir un gasto, pero los pagos de deuda son gastos
// reales y pueden tener presupuesto como cualquier otra categoría.
export const BUDGET_CATEGORIES: readonly string[] = [...EXPENSE_CATEGORIES, "Deudas"];

export const WARN_RATIO = 0.8;

export type BudgetLevel = "ok" | "warn" | "over";

export const budgetLevel = (ratio: number): BudgetLevel =>
  ratio >= 1 ? "over" : ratio >= WARN_RATIO ? "warn" : "ok";

/** Misma regla que el agrupado de Gastos: lo desconocido cae en "Otros". */
export const normalizeCategory = (c?: string): string =>
  c && BUDGET_CATEGORIES.includes(c) ? c : "Otros";

export const budgetId = (userId: string, category: string) =>
  `budget__${userId}__${category}`;

/** Límite del presupuesto convertido en vivo a la moneda principal. */
export function budgetLimitInPrimary(b: Budget, primary: Currency): number {
  return convertAmount(b.amount, b.currency ?? primary, primary);
}

/**
 * Gasto del mes por categoría, en moneda principal. Cuenta exactamente lo que
 * cuenta la página de Gastos: todo `gasto` del mes, incluidos fijos recurrentes
 * y pagos de deuda.
 */
export function monthlySpendByCategory(
  finances: FinancialEntry[],
  date: Date,
  toPrimary: (f: FinancialEntry) => number
): Map<string, number> {
  const y = date.getFullYear();
  const m = date.getMonth();
  const map = new Map<string, number>();
  for (const f of finances) {
    if (f.type !== "gasto") continue;
    const d = new Date(f.date);
    if (d.getFullYear() !== y || d.getMonth() !== m) continue;
    const k = normalizeCategory(f.category);
    map.set(k, (map.get(k) ?? 0) + toPrimary(f));
  }
  return map;
}

export interface BudgetAlert {
  id: string;
  level: "warn" | "over";
  category: string;
  message: string;
}

/**
 * Avisa solo al CRUZAR un umbral (80 % o 100 %) con el gasto que se va a
 * añadir, no en cada gasto posterior. Devuelve null si no hay nada que avisar.
 */
export function budgetAlertForNewExpense(args: {
  finances: FinancialEntry[];
  budgets: Budget[];
  primary: Currency;
  toPrimary: (f: FinancialEntry) => number;
  entry: Omit<FinancialEntry, "id" | "user_id" | "created_at">;
  format: (v: number) => string;
}): BudgetAlert | null {
  const { finances, budgets, primary, toPrimary, entry, format } = args;
  if (entry.type !== "gasto") return null;
  const category = normalizeCategory(entry.category ?? heuristicCategorize(entry.title) ?? "Otros");
  const budget = budgets.find((b) => b.category === category && !b.month);
  if (!budget) return null;
  const limit = budgetLimitInPrimary(budget, primary);
  if (limit <= 0) return null;

  const date = new Date(entry.date);
  const before = monthlySpendByCategory(finances, date, toPrimary).get(category) ?? 0;
  const added = toPrimary({ ...entry, id: "_", user_id: "_", created_at: "" });
  const after = before + added;
  const was = budgetLevel(before / limit);
  const now = budgetLevel(after / limit);
  if (now === "ok" || now === was) return null;

  const id = `${category}-${Date.now()}`;
  if (now === "over") {
    return {
      id, level: "over", category,
      message: `Te has pasado ${format(after - limit)} del presupuesto de ${category} (${format(limit)}).`,
    };
  }
  return {
    id, level: "warn", category,
    message: `Llevas el ${Math.round((after / limit) * 100)} % del presupuesto de ${category}. Te quedan ${format(limit - after)}.`,
  };
}
