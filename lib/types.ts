import type { Currency } from "./currency";

export type GoalCategory =
  | "dinero"
  | "negocio"
  | "salud"
  | "aprendizaje"
  | "contenido"
  | "vida personal"
  | "productividad";

export type GoalStatus = "activo" | "pausado" | "completado";

export type EnergyLevel = "baja" | "media" | "alta";

export type TaskStatus = "pendiente" | "en_curso" | "completada" | "descartada";

export type PaymentMethod = "efectivo" | "debito" | "credito" | "transferencia" | "bizum";

export type FinancialType = "ingreso" | "gasto" | "ahorro" | "deuda";

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  category: GoalCategory;
  target_amount?: number;
  current_amount?: number;
  deadline?: string;
  importance: number; // 1-10
  status: GoalStatus;
  progress: number; // 0-100
  timeframe?: "diario" | "semanal" | "mensual" | "anual"; // Periodo de la meta
  unit?: string; // Unidad de la meta (ej. "vídeos", "sesiones", "km")
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  goal_id?: string;
  title: string;
  description?: string;
  due_date?: string;
  estimated_minutes?: number;
  energy_level?: EnergyLevel;
  difficulty?: number; // 1-5
  urgency?: number; // 1-5
  money_impact?: number;
  ai_priority_score?: number;
  ai_reason?: string;
  manual_order_index?: number; // Overrides AI sorting when user explicitly reorders
  status: TaskStatus;
  recurrence?: "diaria" | "semanal" | "mensual";
  last_generated_date?: string; // ISO date of last duplication
  created_at: string;
}

export interface FinancialEntry {
  id: string;
  user_id: string;
  type: FinancialType;
  title: string;
  amount: number;
  currency?: Currency; // if absent, treat as primary
  amount_in_primary?: number; // Snapshot of the value in primary currency at creation time
  date: string;
  category?: string;
  payment_method?: PaymentMethod; // opcional: cómo se pagó el gasto
  payment_account?: string; // opcional: nombre de la tarjeta (solo débito/crédito)
  recurrence?: "mensual" | "anual";
  last_generated_date?: string; // ISO date of last duplication
  created_at: string;
}

export interface OnboardingData {
  name?: string;
  current_money: number;        // total que tienes ahora
  total_target: number;         // total que quieres tener
  current_monthly_income: number; // lo que ganas/cobras al mes hoy
  monthly_target: number;       // lo que quieres ganar al mes
  income_type?: "salariado" | "empresario";
  target_date: string;
}

export interface MoneySnapshot {
  id: string;
  user_id: string;
  date: string; // ISO
  total: number;
  note?: string;
  created_at: string;
}

/**
 * Límite mensual de gasto en una categoría. Se guarda en la moneda en que se
 * definió y se convierte en vivo a la principal, así que al cambiar de moneda
 * el presupuesto cambia con ella. `month` (YYYY-MM) queda reservado para
 * presupuestos distintos por mes; null = vale todos los meses.
 */
export interface Budget {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  currency?: Currency;
  month?: string;
  updated_at?: string;
  created_at: string;
}

export interface AIPriorityResult {
  ordered_tasks: Array<{
    task_id: string;
    priority_score: number;
    reason: string;
    next_action?: string;
    risk_if_skipped?: string;
  }>;
  distractions: Array<{ task_id: string; reason: string }>;
  financial_advice: string;
  today_focus: string;
}

export interface UserTool {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  url?: string;
  category: string;
  tags?: string[];
  free: boolean;
  cost?: number;
  billing_period?: "monthly" | "yearly";
  rating: number; // 1-5
  icon: string;
  highlight?: boolean;
  is_favorite?: boolean; // user-marked favorites (heart icon)
  order_index?: number;  // legacy, kept for round-trip but no longer surfaced in UI
  updated_at?: string;   // ISO; bumped on every local mutation, used as merge tiebreaker
  created_at: string;
}
