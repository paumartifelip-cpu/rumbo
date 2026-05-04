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
  currency?: "EUR" | "USD" | "MXN" | "ARS"; // if absent, treat as primary
  date: string;
  category?: string;
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
