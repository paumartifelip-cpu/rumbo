import { Currency } from "./currency";
import { Profile } from "./profiles";
import { getSupabase } from "./supabase";
import {
  FinancialEntry,
  Goal,
  MoneySnapshot,
  OnboardingData,
  Task,
  UserTool,
} from "./types";

export interface SyncSnapshot {
  goals: Goal[];
  tasks: Task[];
  finances: FinancialEntry[];
  snapshots: MoneySnapshot[];
  userTools: UserTool[];
  onboarding?: OnboardingData;
  primaryCurrency?: Currency;
  profileMeta?: Pick<Profile, "id" | "name" | "initials" | "color" | "emoji">;
}

const isCurrency = (v: any): v is Currency =>
  v === "EUR" || v === "USD" || v === "MXN" || v === "ARS";

const DEFAULT_PROFILE_IDS = new Set(["pau", "michelle"]);

/**
 * Pull the full list of profiles from Supabase so any device can discover all
 * existing profiles without relying on localStorage.
 */
export async function pullProfileRegistry(): Promise<Profile[] | null> {
  const supa = getSupabase();
  if (!supa) return null;
  try {
    const { data, error } = await supa
      .from("profiles")
      .select("user_id, profile_id, name, initials, emoji, color, primary_currency")
      .not("profile_id", "is", null);
    if (error || !data) return null;
    return (data as any[]).map((r): Profile => ({
      id: r.profile_id,
      user_id: r.user_id,
      name: r.name ?? r.profile_id,
      initials: r.initials ?? (r.name?.[0]?.toUpperCase() ?? "?"),
      color: r.color ?? "from-slate-200 to-slate-400",
      emoji: r.emoji ?? undefined,
      primary_currency: isCurrency(r.primary_currency) ? r.primary_currency : undefined,
      custom: !DEFAULT_PROFILE_IDS.has(r.profile_id),
    }));
  } catch {
    return null;
  }
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
    const [g, t, f, s, p, ut] = await Promise.all([
      supa.from("goals").select("*").eq("user_id", userId),
      supa.from("tasks").select("*").eq("user_id", userId),
      supa.from("financial_entries").select("*").eq("user_id", userId),
      supa.from("money_snapshots").select("*").eq("user_id", userId),
      supa.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supa.from("user_tools").select("*").eq("user_id", userId),
    ]);

    if (g.error || t.error || f.error || s.error || ut.error) {
      console.warn("Supabase pull error", {
        g: g.error,
        t: t.error,
        f: f.error,
        s: s.error,
        ut: ut.error,
      });
      return null;
    }

    const profile = p.data as any | null;
    const hasOnboardingData =
      profile &&
      (profile.name != null ||
        profile.current_money != null ||
        profile.total_target != null ||
        profile.current_monthly_income != null ||
        profile.monthly_target != null ||
        profile.target_date != null);
    const onboarding: OnboardingData | undefined = hasOnboardingData
      ? {
          name: profile.name ?? "",
          current_money: Number(profile.current_money ?? 0),
          total_target: Number(profile.total_target ?? 0),
          current_monthly_income: Number(profile.current_monthly_income ?? 0),
          monthly_target: Number(profile.monthly_target ?? 0),
          income_type: profile.income_type as "salariado" | "empresario" | undefined,
          target_date: profile.target_date ?? new Date().toISOString(),
        }
      : undefined;
    const primaryCurrency = isCurrency(profile?.primary_currency)
      ? profile.primary_currency
      : undefined;

    const profileMeta = profile ? {
      id: profile.profile_id ?? profile.user_id,
      name: profile.name ?? "Sin nombre",
      initials: profile.initials ?? "?",
      color: profile.color ?? "from-slate-200 to-slate-400",
      emoji: profile.emoji ?? undefined,
    } : undefined;

    return {
      goals: (g.data ?? []).map(normalizeGoal),
      tasks: (t.data ?? []).map(normalizeTask),
      finances: (f.data ?? []).map(normalizeFinance),
      snapshots: (s.data ?? []).map(normalizeSnapshot),
      userTools: (ut.data ?? []).map(normalizeUserTool),
      onboarding,
      primaryCurrency,
      profileMeta,
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
    // Profile row — upsert whenever there's anything to write.
    if (snap.onboarding || snap.primaryCurrency || snap.profileMeta) {
      const profileRow: Record<string, any> = {
        user_id: userId,
        updated_at: new Date().toISOString(),
      };
      if (snap.profileMeta) {
        profileRow.profile_id = snap.profileMeta.id;
        profileRow.name       = snap.profileMeta.name;
        profileRow.initials   = snap.profileMeta.initials;
        profileRow.color      = snap.profileMeta.color;
        profileRow.emoji      = snap.profileMeta.emoji ?? null;
      }
      if (snap.onboarding) {
        profileRow.name                    = snap.onboarding.name ?? profileRow.name ?? null;
        profileRow.current_money           = snap.onboarding.current_money;
        profileRow.total_target            = snap.onboarding.total_target;
        profileRow.current_monthly_income  = snap.onboarding.current_monthly_income;
        profileRow.monthly_target          = snap.onboarding.monthly_target;
        profileRow.income_type             = snap.onboarding.income_type;
        profileRow.target_date             = snap.onboarding.target_date;
      }
      if (snap.primaryCurrency) {
        profileRow.primary_currency = snap.primaryCurrency;
      }
      const { error: pe } = await supa
        .from("profiles")
        .upsert(profileRow, { onConflict: "user_id" });
      if (pe) console.warn("profiles upsert error", pe);
    }

    await Promise.all([
      syncTable(userId, "goals", snap.goals.map(stripGoal(userId))),
      syncTable(userId, "tasks", snap.tasks.map(stripTask(userId))),
      syncTable(
        userId,
        "financial_entries",
        snap.finances.map(stripFinance(userId))
      ),
      syncTable(
        userId,
        "money_snapshots",
        snap.snapshots.map(stripSnapshot(userId))
      ),
      syncTable(
        userId,
        "user_tools",
        (snap.userTools || []).map(stripUserTool(userId))
      ),
    ]);

    return true;
  } catch (e) {
    console.warn("Supabase push threw", e);
    return false;
  }
}

async function syncTable(userId: string, table: string, rows: any[]) {
  const supa = getSupabase()!;
  const { data } = await supa.from(table).select("id").eq("user_id", userId);
  const remoteIds = new Set((data || []).map((r: any) => r.id));
  const localIds = new Set(rows.map((r) => r.id));
  const idsToDelete = [...remoteIds].filter((id) => !localIds.has(id));

  if (idsToDelete.length > 0) {
    const { error: de } = await supa.from(table).delete().in("id", idsToDelete);
    if (de) console.warn(`${table} delete error`, de);
  }

  if (rows.length > 0) {
    const { error: ie } = await supa.from(table).upsert(rows);
    if (ie) console.warn(`${table} upsert error`, ie);
  }
}

/**
 * Delete ALL data for a user from every Supabase table.
 * Called when a custom profile is removed from the app.
 */
export async function deleteProfileFromSupabase(userId: string): Promise<boolean> {
  const supa = getSupabase();
  if (!supa) return false;
  try {
    await Promise.all([
      supa.from("financial_entries").delete().eq("user_id", userId),
      supa.from("goals").delete().eq("user_id", userId),
      supa.from("tasks").delete().eq("user_id", userId),
      supa.from("money_snapshots").delete().eq("user_id", userId),
      supa.from("user_tools").delete().eq("user_id", userId),
      supa.from("profiles").delete().eq("user_id", userId),
    ]);
    return true;
  } catch (e) {
    console.warn("deleteProfileFromSupabase threw", e);
    return false;
  }
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
  timeframe: g.timeframe ?? null,
  unit: g.unit ?? null,
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
  manual_order_index: t.manual_order_index ?? null,
  status: t.status,
  recurrence: t.recurrence ?? null,
  last_generated_date: t.last_generated_date ?? null,
  created_at: t.created_at,
});

const stripFinance = (userId: string) => (f: FinancialEntry) => ({
  id: f.id,
  user_id: userId,
  type: f.type,
  title: f.title,
  amount: f.amount,
  currency: f.currency ?? null,
  amount_in_primary: f.amount_in_primary ?? null,
  date: f.date,
  category: f.category ?? null,
  recurrence: f.recurrence ?? null,
  last_generated_date: f.last_generated_date ?? null,
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

const stripUserTool = (userId: string) => (ut: UserTool) => ({
  id: ut.id,
  user_id: userId,
  name: ut.name,
  description: ut.description ?? null,
  url: ut.url ?? null,
  category: ut.category,
  tags: ut.tags ?? [],
  free: ut.free,
  cost: ut.cost ?? 0,
  billing_period: ut.billing_period ?? "monthly",
  rating: ut.rating,
  icon: ut.icon,
  highlight: ut.highlight ?? false,
  created_at: ut.created_at,
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
    timeframe: r.timeframe ?? undefined,
    unit: r.unit ?? undefined,
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
    manual_order_index: r.manual_order_index != null ? Number(r.manual_order_index) : undefined,
    status: r.status ?? "pendiente",
    recurrence: r.recurrence ?? undefined,
    last_generated_date: r.last_generated_date ?? undefined,
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
    currency: r.currency ?? undefined,
    amount_in_primary: r.amount_in_primary != null ? Number(r.amount_in_primary) : undefined,
    date: r.date,
    category: r.category ?? undefined,
    recurrence: r.recurrence ?? undefined,
    last_generated_date: r.last_generated_date ?? undefined,
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

function normalizeUserTool(r: any): UserTool {
  return {
    id: r.id,
    user_id: r.user_id,
    name: r.name,
    description: r.description ?? undefined,
    url: r.url ?? undefined,
    category: r.category ?? "Productividad",
    tags: r.tags ?? [],
    free: !!r.free,
    cost: r.cost != null ? Number(r.cost) : undefined,
    billing_period: r.billing_period ?? undefined,
    rating: Number(r.rating ?? 5),
    icon: r.icon ?? "🔧",
    highlight: !!r.highlight,
    created_at: r.created_at,
  };
}
