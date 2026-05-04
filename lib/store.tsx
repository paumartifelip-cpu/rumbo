"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { aiCategorize, aiPrioritize, heuristicCategorize } from "./gemini";
import {
  convertAmount,
  Currency,
  fetchRates,
  formatCurrency,
} from "./currency";
import { mockFinances, mockGoals, mockSnapshots, mockTasks, mockUser } from "./mock";
import { localPrioritize } from "./priority";
import {
  findProfile,
  getCurrentProfileId,
  getProfileCurrency,
  Profile,
  setCurrentProfileId,
  updateProfileCurrency,
} from "./profiles";
import { pullFromSupabase, pushToSupabase, SyncSnapshot } from "./sync";
import { supabaseEnabled } from "./supabase";
import {
  FinancialEntry,
  Goal,
  MoneySnapshot,
  OnboardingData,
  Task,
  User,
} from "./types";
import { uid } from "./utils";

interface RumboState {
  user: User;
  goals: Goal[];
  tasks: Task[];
  finances: FinancialEntry[];
  snapshots: MoneySnapshot[];
  onboarding?: OnboardingData;
  onboardingDone: boolean;
  aiAdvice?: { today_focus: string; financial_advice: string };
  prioritizing: boolean;
  aiSource: "openai" | "gemini" | "fallback" | "idle";
  syncStatus: "idle" | "syncing" | "synced" | "offline" | "error";
  lastSyncAt?: string;
  primaryCurrency: Currency;
}

interface RumboContext extends RumboState {
  profile: Profile | null;
  signIn: (profileId: string) => void;
  signOut: () => void;
  addGoal: (g: Omit<Goal, "id" | "user_id" | "created_at" | "progress">) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  addTask: (t: Omit<Task, "id" | "user_id" | "created_at" | "status">) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  toggleTask: (id: string) => void;
  addFinance: (f: Omit<FinancialEntry, "id" | "user_id" | "created_at">) => void;
  removeFinance: (id: string) => void;
  addSnapshot: (s: Omit<MoneySnapshot, "id" | "user_id" | "created_at">) => void;
  removeSnapshot: (id: string) => void;
  saveOnboarding: (data: OnboardingData) => void;
  updateOnboarding: (patch: Partial<OnboardingData>) => void;
  resetDemo: () => void;
  prioritize: () => Promise<void>;
  setPrimaryCurrency: (c: Currency) => void;
  /** Returns the entry's amount converted into the user's primary currency. */
  amountInPrimary: (entry: FinancialEntry) => number;
}

const STORAGE_PREFIX = "rumbo_state_v5_";
const storageKeyFor = (profileId: string) => `${STORAGE_PREFIX}${profileId}`;

const defaultState: RumboState = {
  user: mockUser,
  goals: mockGoals,
  tasks: mockTasks,
  finances: mockFinances,
  snapshots: mockSnapshots,
  onboardingDone: false,
  prioritizing: false,
  aiSource: "idle",
  syncStatus: supabaseEnabled ? "idle" : "offline",
  primaryCurrency: "EUR",
};

const Ctx = createContext<RumboContext | null>(null);

export function RumboProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [state, setState] = useState<RumboState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  // Set right before applyRemote runs so the next push-effect tick skips
  // pushing the data we just pulled.
  const justPulledRef = useRef(false);
  // True from the moment a local edit happens until the push completes,
  // so auto-refresh doesn't overwrite a pending local change.
  const pushPendingRef = useRef(false);

  // Load current profile + its data on mount.
  useEffect(() => {
    // Kick off live FX-rate fetch in the background.
    fetchRates().catch(() => {});
    const id = getCurrentProfileId();
    const p = findProfile(id);
    setProfile(p);
    if (p) {
      const profileCurrency = getProfileCurrency(p.id);
      // Local cache first (instant load).
      try {
        const raw = localStorage.getItem(storageKeyFor(p.id));
        if (raw) {
          const parsed = JSON.parse(raw);
          setState({
            ...defaultState,
            ...parsed,
            prioritizing: false,
            aiSource: parsed.aiSource ?? "idle",
            syncStatus: supabaseEnabled ? "syncing" : "offline",
            primaryCurrency: profileCurrency,
          });
        } else {
          setState({
            ...defaultState,
            user: { ...mockUser, name: p.name, email: p.email ?? "" },
            primaryCurrency: profileCurrency,
          });
        }
      } catch {
        setState({ ...defaultState, primaryCurrency: profileCurrency });
      }
      // Then pull from Supabase to get the latest authoritative state.
      if (supabaseEnabled) {
        pullFromSupabase(p.user_id).then((remote) => {
          if (remote) {
            applyRemote(p, remote);
          } else {
            setState((s) => ({ ...s, syncStatus: "error" }));
          }
        });
      }
    } else {
      setState(defaultState);
    }
    setHydrated(true);
  }, []);

  function applyRemote(p: Profile, remote: SyncSnapshot) {
    const cur = stateRef.current;
    // Merge by id: remote items are authoritative, but any local items not
    // yet on the server are preserved (so a device with offline-only history
    // doesn't get wiped the first time it syncs). Edits to the same id keep
    // the remote version; pure-local items survive.
    const mergeById = <T extends { id: string }>(local: T[], rem: T[]): T[] => {
      const map = new Map<string, T>();
      for (const r of rem) map.set(r.id, r);
      for (const l of local) if (!map.has(l.id)) map.set(l.id, l);
      return Array.from(map.values());
    };

    const mergedGoals = mergeById(cur.goals, remote.goals);
    const mergedTasks = mergeById(cur.tasks, remote.tasks);
    const mergedFinances = mergeById(cur.finances, remote.finances);
    const mergedSnapshots = mergeById(cur.snapshots, remote.snapshots);
    const mergedOnboarding = remote.onboarding ?? cur.onboarding;

    // If the merge added anything the server didn't have, push it back so
    // the next device that pulls sees the same union.
    const localAddedItems =
      mergedGoals.length > remote.goals.length ||
      mergedTasks.length > remote.tasks.length ||
      mergedFinances.length > remote.finances.length ||
      mergedSnapshots.length > remote.snapshots.length;

    justPulledRef.current = true;
    setState((s) => ({
      ...s,
      goals: mergedGoals,
      tasks: mergedTasks,
      finances: mergedFinances,
      snapshots: mergedSnapshots,
      onboarding: mergedOnboarding,
      onboardingDone: Boolean(mergedOnboarding) || s.onboardingDone,
      user: {
        ...mockUser,
        id: p.user_id,
        name: mergedOnboarding?.name || p.name,
        email: p.email ?? "",
      },
      syncStatus: "synced",
      lastSyncAt: new Date().toISOString(),
    }));

    if (localAddedItems) {
      pushToSupabase(p.user_id, {
        goals: mergedGoals,
        tasks: mergedTasks,
        finances: mergedFinances,
        snapshots: mergedSnapshots,
        onboarding: mergedOnboarding,
      }).then((ok) => {
        if (!ok) setState((s) => ({ ...s, syncStatus: "error" }));
      });
    }
  }

  // Auto-generate recurring tasks and finances
  useEffect(() => {
    if (!hydrated) return;

    setState((s) => {
      const newTasks = [...s.tasks];
      const newFinances = [...s.finances];
      let hasNew = false;
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const thisMonthStr = todayStr.slice(0, 7);

      s.tasks.forEach((t) => {
        if (!t.recurrence) return;
        const lastGen = t.last_generated_date ? t.last_generated_date.slice(0, 10) : t.created_at.slice(0, 10);
        let shouldGenerate = false;
        
        if (t.recurrence === "diaria" && lastGen < todayStr) {
          shouldGenerate = true;
        } else if (t.recurrence === "semanal") {
           const diff = now.getTime() - new Date(t.last_generated_date || t.created_at).getTime();
           if (diff >= 7 * 24 * 60 * 60 * 1000) shouldGenerate = true;
        } else if (t.recurrence === "mensual" && lastGen.slice(0, 7) < thisMonthStr) {
          shouldGenerate = true;
        }

        if (shouldGenerate) {
          const idx = newTasks.findIndex(x => x.id === t.id);
          if (idx >= 0) {
            newTasks[idx] = { ...newTasks[idx], last_generated_date: now.toISOString() };
          }
          const { recurrence, last_generated_date, ...taskWithoutRecurrence } = t;
          newTasks.push({
            ...taskWithoutRecurrence,
            id: uid(),
            created_at: now.toISOString(),
            status: "pendiente",
          });
          hasNew = true;
        }
      });

      s.finances.forEach((f) => {
        if (!f.recurrence) return;
        const lastGen = f.last_generated_date ? f.last_generated_date.slice(0, 7) : f.created_at.slice(0, 7);
        let shouldGenerate = false;
        
        if (f.recurrence === "mensual" && lastGen < thisMonthStr) {
          shouldGenerate = true;
        } else if (f.recurrence === "anual") {
          const lastYear = f.last_generated_date ? f.last_generated_date.slice(0, 4) : f.created_at.slice(0, 4);
          if (lastYear < todayStr.slice(0, 4)) shouldGenerate = true;
        }

        if (shouldGenerate) {
          const idx = newFinances.findIndex(x => x.id === f.id);
          if (idx >= 0) {
            newFinances[idx] = { ...newFinances[idx], last_generated_date: now.toISOString() };
          }
          const entryCurrency = f.currency ?? s.primaryCurrency;
          const currentPrimaryAmt = convertAmount(f.amount, entryCurrency, s.primaryCurrency);
          const { recurrence, last_generated_date, ...financeWithoutRecurrence } = f;
          newFinances.push({
            ...financeWithoutRecurrence,
            id: uid(),
            date: now.toISOString(),
            amount_in_primary: currentPrimaryAmt,
            created_at: now.toISOString(),
          });
          hasNew = true;
        }
      });

      if (hasNew) {
        return { ...s, tasks: newTasks, finances: newFinances };
      }
      return s;
    });
  }, [hydrated]);

  // Persist state to the active profile bucket (local cache).
  useEffect(() => {
    if (!hydrated || !profile) return;
    try {
      const { prioritizing, syncStatus, lastSyncAt, ...persisted } = state;
      localStorage.setItem(
        storageKeyFor(profile.id),
        JSON.stringify(persisted)
      );
    } catch {
      // ignore
    }
  }, [state, hydrated, profile]);

  // Debounced push to Supabase.
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated || !profile || !supabaseEnabled) return;
    // Skip pushing while we're still pulling the initial remote state.
    if (state.syncStatus === "syncing") return;
    // The state change came from a remote pull — don't echo it back.
    if (justPulledRef.current) {
      justPulledRef.current = false;
      return;
    }

    pushPendingRef.current = true;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      setState((s) => ({ ...s, syncStatus: "syncing" }));
      const ok = await pushToSupabase(profile.user_id, {
        goals: state.goals,
        tasks: state.tasks,
        finances: state.finances,
        snapshots: state.snapshots,
        onboarding: state.onboarding,
      });
      pushPendingRef.current = false;
      setState((s) => ({
        ...s,
        syncStatus: ok ? "synced" : "error",
        lastSyncAt: ok ? new Date().toISOString() : s.lastSyncAt,
      }));
    }, 800);

    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.goals,
    state.tasks,
    state.finances,
    state.snapshots,
    state.onboarding,
    profile,
    hydrated,
  ]);

  // Auto-refresh from Supabase when the tab regains focus, becomes visible,
  // or every 15s while visible. Skips if a local push is pending so we never
  // overwrite an in-flight local change.
  useEffect(() => {
    if (!profile || !supabaseEnabled) return;

    let cancelled = false;

    async function refresh() {
      if (cancelled || !profile) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible")
        return;
      if (pushPendingRef.current) return;
      if (stateRef.current.syncStatus === "syncing") return;
      const remote = await pullFromSupabase(profile.user_id);
      if (cancelled || !profile) return;
      if (remote) applyRemote(profile, remote);
    }

    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        refresh();
      }
    };
    const onFocus = () => refresh();

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", onFocus);
    }
    const interval = setInterval(refresh, 15000);

    return () => {
      cancelled = true;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", onFocus);
      }
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.user_id]);

  const signIn = useCallback((profileId: string) => {
    const p = findProfile(profileId);
    if (!p) return;
    setCurrentProfileId(p.id);
    setProfile(p);
    const profileCurrency = getProfileCurrency(p.id);
    // Local cache first.
    try {
      const raw = localStorage.getItem(storageKeyFor(p.id));
      if (raw) {
        const parsed = JSON.parse(raw);
        setState({
          ...defaultState,
          ...parsed,
          prioritizing: false,
          aiSource: parsed.aiSource ?? "idle",
          syncStatus: supabaseEnabled ? "syncing" : "offline",
          primaryCurrency: profileCurrency,
        });
      } else {
        setState({
          ...defaultState,
          user: { ...mockUser, id: p.user_id, name: p.name, email: p.email ?? "" },
          syncStatus: supabaseEnabled ? "syncing" : "offline",
          primaryCurrency: profileCurrency,
        });
      }
    } catch {
      setState({
        ...defaultState,
        user: { ...mockUser, id: p.user_id, name: p.name, email: p.email ?? "" },
        primaryCurrency: profileCurrency,
      });
    }
    // Pull authoritative state from Supabase.
    if (supabaseEnabled) {
      pullFromSupabase(p.user_id).then((remote) => {
        if (remote) {
          applyRemote(p, remote);
        } else {
          setState((s) => ({ ...s, syncStatus: "error" }));
        }
      });
    }
  }, []);

  const setPrimaryCurrency = useCallback(
    (c: Currency) => {
      setState((s) => ({ ...s, primaryCurrency: c }));
      if (profile) updateProfileCurrency(profile.id, c);
    },
    [profile]
  );

  const amountInPrimary = useCallback(
    (entry: FinancialEntry) => {
      if (entry.amount_in_primary !== undefined) return entry.amount_in_primary;
      const from = entry.currency ?? stateRef.current.primaryCurrency;
      return convertAmount(entry.amount, from, stateRef.current.primaryCurrency);
    },
    []
  );

  const signOut = useCallback(() => {
    setCurrentProfileId(null);
    setProfile(null);
    setState(defaultState);
  }, []);

  const prioritize = useCallback(async () => {
    const s = stateRef.current;
    const pending = s.tasks.filter(
      (t) => t.status !== "completada" && t.status !== "descartada"
    );
    if (pending.length === 0) {
      setState((cur) => ({ ...cur, aiSource: "idle" }));
      return;
    }

    setState((cur) => ({ ...cur, prioritizing: true }));

    const currentMoney =
      (s.snapshots[s.snapshots.length - 1]?.total ??
        s.onboarding?.current_money) ??
      0;

    let source: "openai" | "gemini" | "fallback" = "fallback";
    let scores: Array<{ task_id: string; score: number; reason: string }> = [];
    let advice = { today_focus: "", financial_advice: "" };

    try {
      const remote = await aiPrioritize(pending, s.goals, {
        current_money: currentMoney,
        monthly_target: s.onboarding?.monthly_target,
      });
      if (remote) {
        source = remote.source;
        scores = (remote.data.ordered_tasks ?? []).map((o) => ({
          task_id: o.task_id,
          score: o.priority_score,
          reason: o.reason,
        }));
        advice = {
          today_focus: remote.data.today_focus ?? "",
          financial_advice: remote.data.financial_advice ?? "",
        };
      } else {
        const local = localPrioritize(pending, s.goals);
        scores = local.ordered.map((o) => ({
          task_id: o.task.id,
          score: o.score,
          reason: o.reason,
        }));
        advice = {
          today_focus: local.today_focus,
          financial_advice: local.financial_advice,
        };
      }
    } catch {
      const local = localPrioritize(pending, s.goals);
      scores = local.ordered.map((o) => ({
        task_id: o.task.id,
        score: o.score,
        reason: o.reason,
      }));
      advice = {
        today_focus: local.today_focus,
        financial_advice: local.financial_advice,
      };
    }

    setState((cur) => ({
      ...cur,
      prioritizing: false,
      aiSource: source,
      aiAdvice: advice,
      tasks: cur.tasks.map((t) => {
        const found = scores.find((x) => x.task_id === t.id);
        if (!found) return t;
        return {
          ...t,
          ai_priority_score: found.score,
          ai_reason: found.reason,
        };
      }),
    }));
  }, []);

  // Auto-prioritize when pending task IDs or goal importance changes.
  const taskHash = state.tasks
    .filter((t) => t.status !== "completada" && t.status !== "descartada")
    .map((t) => t.id)
    .join(",");
  const goalHash = state.goals
    .map((g) => `${g.id}:${g.importance}:${g.status}`)
    .join(",");

  useEffect(() => {
    if (!hydrated) return;
    if (!taskHash) return;
    const t = setTimeout(() => {
      prioritize();
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskHash, goalHash, hydrated]);

  const addGoal: RumboContext["addGoal"] = useCallback((g) => {
    setState((s) => ({
      ...s,
      goals: [
        ...s.goals,
        {
          ...g,
          id: uid(),
          user_id: s.user.id,
          created_at: new Date().toISOString(),
          progress: 0,
        },
      ],
    }));
  }, []);

  const updateGoal: RumboContext["updateGoal"] = useCallback((id, patch) => {
    setState((s) => ({
      ...s,
      goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  }, []);

  const removeGoal: RumboContext["removeGoal"] = useCallback((id) => {
    setState((s) => ({
      ...s,
      goals: s.goals.filter((g) => g.id !== id),
      tasks: s.tasks.filter((t) => t.goal_id !== id),
    }));
  }, []);

  const addTask: RumboContext["addTask"] = useCallback((t) => {
    setState((s) => ({
      ...s,
      tasks: [
        ...s.tasks,
        {
          ...t,
          id: uid(),
          user_id: s.user.id,
          created_at: new Date().toISOString(),
          status: "pendiente",
        },
      ],
    }));
  }, []);

  const updateTask: RumboContext["updateTask"] = useCallback((id, patch) => {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }, []);

  const removeTask: RumboContext["removeTask"] = useCallback((id) => {
    setState((s) => ({
      ...s,
      tasks: s.tasks.filter((t) => t.id !== id),
    }));
  }, []);

  const toggleTask: RumboContext["toggleTask"] = useCallback((id) => {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              status: t.status === "completada" ? "pendiente" : "completada",
            }
          : t
      ),
    }));
  }, []);

  const addFinance: RumboContext["addFinance"] = useCallback((f) => {
    const id = uid();
    setState((s) => {
      const from = f.currency ?? s.primaryCurrency;
      const amount_in_primary = convertAmount(f.amount, from, s.primaryCurrency);
      return {
        ...s,
        finances: [
          ...s.finances,
          {
            ...f,
            id,
            amount_in_primary,
            user_id: s.user.id,
            created_at: new Date().toISOString(),
          },
        ],
      };
    });

    // AI categorization for expenses without a category.
    if (f.type === "gasto" && !f.category) {
      const existingCategories = Array.from(
        new Set(
          stateRef.current.finances
            .filter((x) => x.type === "gasto" && x.category)
            .map((x) => x.category as string)
        )
      );
      aiCategorize({
        title: f.title,
        amount: f.amount,
        existing_categories: existingCategories,
      })
        .then((cat) => {
          const final = cat || heuristicCategorize(f.title);
          setState((s) => ({
            ...s,
            finances: s.finances.map((x) =>
              x.id === id ? { ...x, category: final } : x
            ),
          }));
        })
        .catch(() => {
          const final = heuristicCategorize(f.title);
          setState((s) => ({
            ...s,
            finances: s.finances.map((x) =>
              x.id === id ? { ...x, category: final } : x
            ),
          }));
        });
    }
  }, []);

  const removeFinance: RumboContext["removeFinance"] = useCallback((id) => {
    setState((s) => ({
      ...s,
      finances: s.finances.filter((f) => f.id !== id),
    }));
  }, []);

  const addSnapshot: RumboContext["addSnapshot"] = useCallback((s) => {
    setState((state) => ({
      ...state,
      snapshots: [
        ...state.snapshots.filter(
          (x) => x.date.slice(0, 10) !== s.date.slice(0, 10)
        ),
        {
          ...s,
          id: uid(),
          user_id: state.user.id,
          created_at: new Date().toISOString(),
        },
      ].sort((a, b) => +new Date(a.date) - +new Date(b.date)),
    }));
  }, []);

  const removeSnapshot: RumboContext["removeSnapshot"] = useCallback((id) => {
    setState((s) => ({
      ...s,
      snapshots: s.snapshots.filter((x) => x.id !== id),
    }));
  }, []);

  const saveOnboarding: RumboContext["saveOnboarding"] = useCallback((data) => {
    setState((s) => {
      const now = new Date().toISOString();
      const firstSnapshot: MoneySnapshot = {
        id: uid(),
        user_id: s.user.id,
        date: now,
        total: data.current_money,
        note: "Punto de partida",
        created_at: now,
      };
      return {
        ...s,
        onboarding: data,
        onboardingDone: true,
        user: data.name ? { ...s.user, name: data.name } : s.user,
        snapshots:
          data.current_money > 0 ? [firstSnapshot, ...s.snapshots] : s.snapshots,
      };
    });
  }, []);

  const updateOnboarding: RumboContext["updateOnboarding"] = useCallback(
    (patch) => {
      setState((s) => ({
        ...s,
        onboarding: {
          name: s.onboarding?.name ?? "",
          current_money: s.onboarding?.current_money ?? 0,
          total_target: s.onboarding?.total_target ?? 0,
          current_monthly_income: s.onboarding?.current_monthly_income ?? 0,
          monthly_target: s.onboarding?.monthly_target ?? 0,
          target_date:
            s.onboarding?.target_date ?? new Date().toISOString(),
          ...patch,
        },
        onboardingDone: true,
      }));
    },
    []
  );

  const resetDemo = useCallback(() => {
    setState((s) => ({
      ...defaultState,
      user: profile
        ? { ...mockUser, name: profile.name, email: profile.email ?? "" }
        : s.user,
    }));
    try {
      if (profile) localStorage.removeItem(storageKeyFor(profile.id));
    } catch {
      // ignore
    }
  }, [profile]);

  const value = useMemo<RumboContext>(
    () => ({
      ...state,
      profile,
      signIn,
      signOut,
      addGoal,
      updateGoal,
      removeGoal,
      addTask,
      updateTask,
      removeTask,
      toggleTask,
      addFinance,
      removeFinance,
      addSnapshot,
      removeSnapshot,
      saveOnboarding,
      updateOnboarding,
      resetDemo,
      prioritize,
      setPrimaryCurrency,
      amountInPrimary,
    }),
    [
      state,
      profile,
      signIn,
      signOut,
      addGoal,
      updateGoal,
      removeGoal,
      addTask,
      updateTask,
      removeTask,
      toggleTask,
      addFinance,
      removeFinance,
      addSnapshot,
      removeSnapshot,
      saveOnboarding,
      updateOnboarding,
      resetDemo,
      prioritize,
      setPrimaryCurrency,
      amountInPrimary,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRumbo() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRumbo debe usarse dentro de RumboProvider");
  return ctx;
}

/**
 * Returns a formatter bound to the user's primary currency.
 * Use this for aggregate displays where the value is already in primary.
 */
export function useFormatMoney() {
  const { primaryCurrency } = useRumbo();
  return useCallback(
    (value: number) => formatCurrency(value, primaryCurrency),
    [primaryCurrency]
  );
}
