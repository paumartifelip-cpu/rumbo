import { getSupabase } from "./supabase";
import {
  FinancialEntry,
  Goal,
  MoneySnapshot,
  OnboardingData,
  Task,
} from "./types";

export interface SyncSnapshot {
  goals: Goal[];
  tasks: Task[];
  finances: FinancialEntry[];
  snapshots: MoneySnapshot[];
  onboarding?: OnboardingData;
}

/**
 * Pull all data for a user from Supabase. Returns null if Supabase isn't
 * configured or the request fails.
 */
export async function pullFromSupabase(
  userId: string
): Promise<SyncSnapshot | null> {
  const supa = getSupabase();
  if (!supa) return null;

  try {
    const [g, t, f, s, p] = await Promise.all([
      supa.from("goals").select("*").eq("user_id", userId),
      supa.from("tasks").select("*").eq("user_id", userId),
      supa.from("financial_entries").select("*").eq("user_id", userId),
      supa.from("money_snapshots").select("*").eq("user_id", userId),
      supa.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    if (g.error || t.error || f.error || s.error) {
      console.warn("Supabase pull error", {
        g: g.error,
        t: t.error,
        f: f.error,
        s: s.error,
      });
      return null;
    }

    const profile = p.data as any | null;
    const onboarding: OnboardingData | undefined = profile
      ? {
          name: profile.name ?? "",
          current_money: Number(profile.current_money ?? 0),
          total_target: Number(profile.total_target ?? 0),
          current_monthly_income: Number(profile.current_monthly_income ?? 0),
          monthly_target: Number(profile.monthly_target ?? 0),
          target_date: profile.target_date ?? new Date().toISOString(),
        }
      : undefined;

    return {
      goals: (g.data ?? []).map(normalizeGoal),
      tasks: (t.data ?? []).map(normalizeTask),
      finances: (f.data ?? []).map(normalizeFinance),
      snapshots: (s.data ?? []).map(normalizeSnapshot),
      onboarding,
    };
  } catch (e) {
    console.warn("Supabase pull threw", e);
    return null;
  }
}

/**
 * Push current state to Supabase. Strategy: replace all rows for this user_id.
 * Cheap and correct for a small personal dataset.
 */
export async function pushToSupabase(
  userId: string,
  snap: SyncSnapshot
): Promise<boolean> {
  const supa = getSupabase();
  if (!supa) return false;

  try {
    // Profile (onboarding) — upsert.
    if (snap.onboarding) {
      const { error: pe } = await supa.from("profiles").upsert(
        {
          user_id: userId,
          name: snap.onboarding.name ?? null,
          current_money: snap.onboarding.current_money,
          total_target: snap.onboarding.total_target,
          current_monthly_income: snap.onboarding.current_monthly_income,
          monthly_target: snap.onboarding.monthly_target,
          target_date: snap.onboarding.target_date,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (pe) console.warn("profiles upsert error", pe);
    }

    await Promise.all([
      replaceTable(userId, "goals", snap.goals.map(stripGoal(userId))),
      replaceTable(userId, "tasks", snap.tasks.map(stripTask(userId))),
      replaceTable(
        userId,
        "financial_entries",
        snap.finances.map(stripFinance(userId))
      ),
      replaceTable(
        userId,
        "money_snapshots",
        snap.snapshots.map(stripSnapshot(userId))
      ),
    ]);

    return true;
  } catch (e) {
    console.warn("Supabase push threw", e);
    return false;
  }
}

async function replaceTable(userId: string, table: string, rows: any[]) {
  const supa = getSupabase()!;
  const { error: de } = await supa.from(table).delete().eq("user_id", userId);
  if (de) console.warn(`${table} delete error`, de);
  if (rows.length === 0) return;
  const { error: ie } = await supa.from(table).insert(rows);
  if (ie) console.warn(`${table} insert error`, ie);
}

// --- Strippers: remove client-only fields and force user_id ---

const stripGoal = (userId: string) => (g: Goal) => ({
  id: g.id,
  user_id: userId,
  title: g.title,
  description: g.description ?? null,
  category: g.category,
  target_amount: g.target_amount ?? null,
  current_amount: g.current_amount ?? 0,
  deadline: g.deadline ?? null,
  importance: g.importance,
  status: g.status,
  progress: g.progress,
  created_at: g.created_at,
});

const stripTask = (userId: string) => (t: Task) => ({
  id: t.id,
  user_id: userId,
  goal_id: t.goal_id ?? null,
  title: t.title,
  description: t.description ?? null,
  due_date: t.due_date ?? null,
  estimated_minutes: t.estimated_minutes ?? null,
  energy_level: t.energy_level ?? null,
  difficulty: t.difficulty ?? null,
  urgency: t.urgency ?? null,
  money_impact: t.money_impact ?? 0,
  ai_priority_score: t.ai_priority_score ?? null,
  ai_reason: t.ai_reason ?? null,
  status: t.status,
  created_at: t.created_at,
});

const stripFinance = (userId: string) => (f: FinancialEntry) => ({
  id: f.id,
  user_id: userId,
  type: f.type,
  title: f.title,
  amount: f.amount,
  date: f.date,
  category: f.category ?? null,
  created_at: f.created_at,
});

const stripSnapshot = (userId: string) => (s: MoneySnapshot) => ({
  id: s.id,
  user_id: userId,
  date: s.date,
  total: s.total,
  note: s.note ?? null,
  created_at: s.created_at,
});

// --- Normalizers ---

function normalizeGoal(r: any): Goal {
  return {
    id: r.id,
    user_id: r.user_id,
    title: r.title,
    description: r.description ?? undefined,
    category: r.category,
    target_amount: r.target_amount != null ? Number(r.target_amount) : undefined,
    current_amount:
      r.current_amount != null ? Number(r.current_amount) : undefined,
    deadline: r.deadline ?? undefined,
    importance: Number(r.importance ?? 5),
    status: r.status ?? "activo",
    progress: Number(r.progress ?? 0),
    created_at: r.created_at,
  };
}

function normalizeTask(r: any): Task {
  return {
    id: r.id,
    user_id: r.user_id,
    goal_id: r.goal_id ?? undefined,
    title: r.title,
    description: r.description ?? undefined,
    due_date: r.due_date ?? undefined,
    estimated_minutes:
      r.estimated_minutes != null ? Number(r.estimated_minutes) : undefined,
    energy_level: r.energy_level ?? undefined,
    difficulty: r.difficulty != null ? Number(r.difficulty) : undefined,
    urgency: r.urgency != null ? Number(r.urgency) : undefined,
    money_impact:
      r.money_impact != null ? Number(r.money_impact) : undefined,
    ai_priority_score:
      r.ai_priority_score != null ? Number(r.ai_priority_score) : undefined,
    ai_reason: r.ai_reason ?? undefined,
    status: r.status ?? "pendiente",
    created_at: r.created_at,
  };
}

function normalizeFinance(r: any): FinancialEntry {
  return {
    id: r.id,
    user_id: r.user_id,
    type: r.type,
    title: r.title,
    amount: Number(r.amount),
    date: r.date,
    category: r.category ?? undefined,
    created_at: r.created_at,
  };
}

function normalizeSnapshot(r: any): MoneySnapshot {
  return {
    id: r.id,
    user_id: r.user_id,
    date: r.date,
    total: Number(r.total),
    note: r.note ?? undefined,
    created_at: r.created_at,
  };
}
