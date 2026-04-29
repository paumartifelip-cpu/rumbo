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
import { geminiCategorize, geminiPrioritize, heuristicCategorize } from "./gemini";
import { mockFinances, mockGoals, mockSnapshots, mockTasks, mockUser } from "./mock";
import { localPrioritize } from "./priority";
import { findProfile, getCurrentProfileId, Profile, setCurrentProfileId } from "./profiles";
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
  aiSource: "gemini" | "fallback" | "idle";
  syncStatus: "idle" | "syncing" | "synced" | "offline" | "error";
  lastSyncAt?: string;
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
    const id = getCurrentProfileId();
    const p = findProfile(id);
    setProfile(p);
    if (p) {
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
          });
        } else {
          setState({
            ...defaultState,
            user: { ...mockUser, name: p.name, email: p.email },
          });
        }
      } catch {
        setState(defaultState);
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
    const remoteEmpty =
      remote.goals.length === 0 &&
      remote.tasks.length === 0 &&
      remote.finances.length === 0 &&
      remote.snapshots.length === 0 &&
      !remote.onboarding;
    const localHasRealData =
      cur.onboardingDone &&
      (cur.goals.length > 0 ||
        cur.tasks.length > 0 ||
        cur.finances.length > 0 ||
        cur.snapshots.length > 0 ||
        cur.onboarding != null);

    if (remoteEmpty && localHasRealData) {
      // Server has nothing for this user yet, but we have real local data —
      // upload it instead of wiping the device. Happens the first time a
      // device with pre-existing localStorage data hits a fresh Supabase.
      setState((s) => ({
        ...s,
        syncStatus: "synced",
        lastSyncAt: new Date().toISOString(),
      }));
      pushToSupabase(p.user_id, {
        goals: cur.goals,
        tasks: cur.tasks,
        finances: cur.finances,
        snapshots: cur.snapshots,
        onboarding: cur.onboarding,
      }).then((ok) => {
        if (!ok) setState((s) => ({ ...s, syncStatus: "error" }));
      });
      return;
    }

    justPulledRef.current = true;
    setState((s) => ({
      ...s,
      goals: remote.goals,
      tasks: remote.tasks,
      finances: remote.finances,
      snapshots: remote.snapshots,
      onboarding: remote.onboarding ?? s.onboarding,
      onboardingDone: Boolean(remote.onboarding) || s.onboardingDone,
      user: {
        ...mockUser,
        id: p.user_id,
        name: remote.onboarding?.name || p.name,
        email: p.email,
      },
      syncStatus: "synced",
      lastSyncAt: new Date().toISOString(),
    }));
  }

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
        });
      } else {
        setState({
          ...defaultState,
          user: { ...mockUser, id: p.user_id, name: p.name, email: p.email },
          syncStatus: supabaseEnabled ? "syncing" : "offline",
        });
      }
    } catch {
      setState({
        ...defaultState,
        user: { ...mockUser, id: p.user_id, name: p.name, email: p.email },
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

    let source: "gemini" | "fallback" = "fallback";
    let scores: Array<{ task_id: string; score: number; reason: string }> = [];
    let advice = { today_focus: "", financial_advice: "" };

    try {
      const remote = await geminiPrioritize(pending, s.goals, {
        current_money: currentMoney,
        monthly_target: s.onboarding?.monthly_target,
      });
      if (remote) {
        source = "gemini";
        scores = (remote.ordered_tasks ?? []).map((o) => ({
          task_id: o.task_id,
          score: o.priority_score,
          reason: o.reason,
        }));
        advice = {
          today_focus: remote.today_focus ?? "",
          financial_advice: remote.financial_advice ?? "",
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
    setState((s) => ({
      ...s,
      finances: [
        ...s.finances,
        {
          ...f,
          id,
          user_id: s.user.id,
          created_at: new Date().toISOString(),
        },
      ],
    }));

    // AI categorization for expenses without a category.
    if (f.type === "gasto" && !f.category) {
      const existingCategories = Array.from(
        new Set(
          stateRef.current.finances
            .filter((x) => x.type === "gasto" && x.category)
            .map((x) => x.category as string)
        )
      );
      geminiCategorize({
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
        ? { ...mockUser, name: profile.name, email: profile.email }
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
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRumbo() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRumbo debe usarse dentro de RumboProvider");
  return ctx;
}
