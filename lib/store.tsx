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
  updateProfileLocally,
} from "./profiles";
import { pullFromSupabase, pushToSupabase, SyncSnapshot } from "./sync";
import { getSupabase, supabaseEnabled } from "./supabase";
import {
  FinancialEntry,
  Goal,
  MoneySnapshot,
  OnboardingData,
  Task,
  User,
  UserTool,
} from "./types";
import { uid } from "./utils";

interface RumboState {
  user: User;
  goals: Goal[];
  tasks: Task[];
  finances: FinancialEntry[];
  snapshots: MoneySnapshot[];
  userTools: UserTool[];
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
  reorderTasks: (reorderedTasks: Task[]) => void;
  addFinance: (f: Omit<FinancialEntry, "id" | "user_id" | "created_at">) => void;
  updateFinance: (id: string, patch: Partial<FinancialEntry>) => void;
  removeFinance: (id: string) => void;
  addSnapshot: (s: Omit<MoneySnapshot, "id" | "user_id" | "created_at">) => void;
  removeSnapshot: (id: string) => void;
  addUserTool: (ut: Omit<UserTool, "id" | "user_id" | "created_at">) => void;
  removeUserTool: (id: string) => void;
  updateUserTool: (id: string, patch: Partial<UserTool>) => void;
  reorderUserTools: (orderedIds: string[]) => void;
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

// Curated default tool list — every new profile starts with these.
// Order here = default display order; users can drag-and-drop to customize.
const BASE_DEFAULT_TOOLS = [
  // ── IA ────────────────────────────────────────────────────────────────────
  { name: "Gemini",                  icon: "✨",  category: "IA",     url: "https://gemini.google.com/app", description: "Asistente IA de Google. Multimodal y rápido.",                                       free: true, rating: 5, highlight: true },
  { name: "Claude",                  icon: "🧠",  category: "IA",     url: "https://claude.ai",            description: "El modelo de Anthropic. Para análisis profundo y código.",                            free: true, rating: 5, highlight: true },
  { name: "ChatGPT",                 icon: "🤖",  category: "IA",     url: "https://chatgpt.com",          description: "Asistente IA de OpenAI. Texto, imágenes y código.",                                   free: true, rating: 5, highlight: true },
  { name: "DeepSeek",                icon: "🔬",  category: "IA",     url: "https://chat.deepseek.com",    description: "Razonamiento y código. Alternativa potente y económica.",                              free: true, rating: 5 },
  { name: "Grok",                    icon: "🦾",  category: "IA",     url: "https://grok.com",             description: "Asistente IA de X con tendencias de internet en tiempo real.",                         free: true, rating: 4 },
  { name: "Perplexity",              icon: "🔍",  category: "IA",     url: "https://www.perplexity.ai",    description: "Buscador IA con fuentes citadas. Investigación rápida.",                               free: true, rating: 5 },
  { name: "Codex",                   icon: "💻",  category: "IA",     url: "https://openai.com/es-419/codex/", description: "Agente de código de OpenAI.",                                                       free: true, rating: 5 },
  { name: "Investigaciones profundas", icon: "🧪", category: "IA",     url: "https://gemini.google.com/app", description: "Modo Deep Research de Gemini. Para informes largos con fuentes.",                  free: true, rating: 5 },
  { name: "Canvas o Lienzo",         icon: "🖼️",  category: "IA",     url: "https://chatgpt.com",          description: "Modo Canvas de ChatGPT para escribir y editar en colaboración con la IA.",            free: true, rating: 4 },
  { name: "Max Prompt",              icon: "🎯",  category: "IA",     url: "https://chatgpt.com/g/g-688089637d1c8191bbf0c2a936580018-max-prompt", description: "GPT especializado en optimizar prompts.",  free: true, rating: 5 },
  { name: "Articulero",              icon: "📰",  category: "IA",     url: "https://chatgpt.com/g/g-691a768560748191a76e32f2f960eb1e-articulero-2-0", description: "GPT para redactar artículos optimizados.", free: true, rating: 4 },
  { name: "IA para niños",           icon: "🧸",  category: "IA",     url: "https://chatgpt.com/g/g-68711f8bed148191b3391b1f24652b1d-ia-para-ninos", description: "GPT educativo y seguro para niños.",      free: true, rating: 4 },

  // ── Imagen / Vídeo / Audio ────────────────────────────────────────────────
  { name: "Midjourney",              icon: "🎨",  category: "Imagen", url: "https://www.midjourney.com",   description: "Generación de imágenes IA de calidad cinematográfica.",                                free: false, rating: 5, highlight: true },
  { name: "Nanobanana",              icon: "🍌",  category: "Imagen", url: "https://gemini.google.com/app", description: "Generador de imágenes de Google integrado en Gemini.",                              free: true, rating: 4 },
  { name: "Whisk",                   icon: "🥣",  category: "Imagen", url: "https://labs.google/fx/tools/whisk", description: "Combina sujeto + escena + estilo desde imágenes de referencia.",               free: true, rating: 4 },
  { name: "Recraft",                 icon: "🎯",  category: "Imagen", url: "https://www.recraft.ai",       description: "Diseño gráfico, branding y vectores con IA.",                                          free: true, rating: 5 },
  { name: "Google Flow",             icon: "🎬",  category: "Vídeo",  url: "https://labs.google/flow/about", description: "Generación de vídeo cinematográfico con IA.",                                       free: true, rating: 5, highlight: true },
  { name: "Runway",                  icon: "🎞️",  category: "Vídeo",  url: "https://runwayml.com",         description: "Vídeo generativo y edición. Modelos Gen-3/Gen-4.",                                     free: true, rating: 5 },
  { name: "Kling AI",                icon: "🎥",  category: "Vídeo",  url: "https://app.klingai.com/global/", description: "Generación de vídeo IA de alta calidad.",                                            free: true, rating: 4 },
  { name: "Opus Clip",               icon: "✂️",  category: "Vídeo",  url: "https://www.opus.pro/es-es",   description: "Convierte vídeos largos en clips virales para redes.",                                 free: true, rating: 5 },
  { name: "Suno",                    icon: "🎵",  category: "Audio",  url: "https://suno.com",             description: "Genera canciones completas con letra y música a partir de texto.",                     free: true, rating: 5 },

  // ── No-code / Automatización / Web ────────────────────────────────────────
  { name: "Lovable",                 icon: "💖",  category: "No-code", url: "https://lovable.dev",         description: "Construye apps web completas con lenguaje natural.",                                  free: true, rating: 5, highlight: true },
  { name: "Google Antigravity",      icon: "🚀",  category: "No-code", url: "https://antigravity.google",  description: "Asistente de código IA de Google DeepMind.",                                          free: true, rating: 5 },
  { name: "Google Opal",             icon: "💠",  category: "No-code", url: "https://opal.google",         description: "Apps mini sin código por Google Labs.",                                                free: true, rating: 4 },
  { name: "n8n",                     icon: "⚙️",  category: "No-code", url: "https://n8n.io",              description: "Automatización open-source. Conecta apps con lógica visual.",                          free: true, rating: 5 },
  { name: "Make",                    icon: "🔄",  category: "No-code", url: "https://www.make.com",        description: "Automatización visual con cientos de integraciones.",                                  free: true, rating: 5 },
  { name: "Napkin AI",               icon: "📋",  category: "No-code", url: "https://www.napkin.ai",       description: "Convierte texto en gráficos visuales automáticamente.",                                free: true, rating: 4 },

  // ── Google Workspace ──────────────────────────────────────────────────────
  { name: "Google",                  icon: "🔎",  category: "Google", url: "https://www.google.com",      description: "El buscador.",                                                                          free: true, rating: 5 },
  { name: "Gmail",                   icon: "📧",  category: "Google", url: "https://mail.google.com",     description: "Correo de Google.",                                                                     free: true, rating: 5 },
  { name: "Google Calendar",         icon: "📅",  category: "Google", url: "https://calendar.google.com", description: "Tu agenda.",                                                                            free: true, rating: 5 },
  { name: "Google Drive",            icon: "📁",  category: "Google", url: "https://drive.google.com",    description: "Almacenamiento en la nube.",                                                            free: true, rating: 5 },
  { name: "Google Docs",             icon: "📄",  category: "Google", url: "https://docs.google.com",     description: "Documentos en la nube.",                                                                free: true, rating: 5 },
  { name: "Google Sheets",           icon: "📊",  category: "Google", url: "https://sheets.google.com",   description: "Hojas de cálculo en la nube.",                                                          free: true, rating: 5 },
  { name: "Google Slides",           icon: "🖥️",  category: "Google", url: "https://slides.google.com",   description: "Presentaciones en la nube.",                                                            free: true, rating: 5 },
  { name: "Google Forms",            icon: "📝",  category: "Google", url: "https://forms.google.com",    description: "Formularios y encuestas.",                                                              free: true, rating: 4 },
  { name: "Google Meet",             icon: "📹",  category: "Google", url: "https://meet.google.com",     description: "Videollamadas.",                                                                        free: true, rating: 5 },
  { name: "Google Keep",             icon: "📌",  category: "Google", url: "https://keep.google.com",     description: "Notas rápidas.",                                                                        free: true, rating: 4 },
  { name: "Google Tasks",            icon: "✅",  category: "Google", url: "https://tasks.google.com",    description: "Tareas integradas con Gmail y Calendar.",                                               free: true, rating: 4 },
  { name: "Google Photos",           icon: "🖼️",  category: "Google", url: "https://photos.google.com",   description: "Tus fotos en la nube.",                                                                 free: true, rating: 5 },
  { name: "Google Maps",             icon: "🗺️",  category: "Google", url: "https://maps.google.com",     description: "Mapas y rutas.",                                                                        free: true, rating: 5 },
  { name: "Google Vids",             icon: "🎬",  category: "Google", url: "https://workspace.google.com/intl/es-419/products/vids/", description: "Editor de vídeo online de Google.",                          free: true, rating: 4 },
  { name: "NotebookLM",              icon: "📚",  category: "Google", url: "https://notebooklm.google",   description: "Analiza documentos y genera podcasts y resúmenes.",                                     free: true, rating: 5 },
  { name: "Google AI Studio",        icon: "🧪",  category: "Google", url: "https://aistudio.google.com", description: "Estudio para probar y construir con modelos Gemini.",                                   free: true, rating: 5 },
  { name: "YouTube",                 icon: "📺",  category: "Google", url: "https://youtube.com",         description: "Vídeo a la carta.",                                                                     free: true, rating: 5 },
  { name: "YouTube Studio",          icon: "🎬",  category: "Google", url: "https://studio.youtube.com",  description: "Panel de creador de YouTube.",                                                          free: true, rating: 5 },
  { name: "Google Trends",           icon: "📈",  category: "Google", url: "https://trends.google.com",   description: "Tendencias de búsqueda en tiempo real.",                                                free: true, rating: 4 },
  { name: "Google Ads",              icon: "📣",  category: "Google", url: "https://ads.google.com",      description: "Plataforma de publicidad de Google.",                                                   free: true, rating: 4 },
];

// Bump this on every curated-list change to force a one-time reset of cached
// user_tools across all profiles. Read by the hydration logic below.
export const TOOLS_VERSION = "v2";

export const buildDefaultUserTools = (userId: string): UserTool[] => {
  const seed = "2026-05-07T00:00:00.000Z";
  return BASE_DEFAULT_TOOLS.map((t, idx) => ({
    ...t,
    id: `default-tool-${idx}`,
    user_id: userId,
    created_at: seed,
    order_index: idx,
  }));
};

const defaultState: RumboState = {
  user: mockUser,
  goals: mockGoals,
  tasks: mockTasks,
  finances: mockFinances,
  snapshots: mockSnapshots,
  userTools: [],
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
          // One-time migration: replace tools when the curated list has been
          // bumped, so every existing profile picks up the new defaults.
          const needsToolsReset = parsed._toolsVersion !== TOOLS_VERSION;
          const userTools =
            !needsToolsReset && Array.isArray(parsed.userTools) && parsed.userTools.length > 0
              ? parsed.userTools
              : buildDefaultUserTools(p.user_id);
          setState({
            ...defaultState,
            ...parsed,
            userTools,
            prioritizing: false,
            aiSource: parsed.aiSource ?? "idle",
            syncStatus: supabaseEnabled ? "syncing" : "offline",
            primaryCurrency: profileCurrency,
          });
        } else {
          setState({
            ...defaultState,
            user: { ...mockUser, name: p.name, email: p.email ?? "" },
            userTools: buildDefaultUserTools(p.user_id),
            primaryCurrency: profileCurrency,
          });
        }
      } catch {
        setState({
          ...defaultState,
          userTools: buildDefaultUserTools(p.user_id),
          primaryCurrency: profileCurrency,
        });
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
    const mergeById = <T extends { id: string; created_at?: string }>(local: T[], rem: T[]): T[] => {
      const map = new Map<string, T>();
      // Remote is authoritative for IDs it knows about
      for (const r of rem) map.set(r.id, r);
      // Preserve local items not yet on the server:
      // - if we've never synced (no lastSyncAt), keep all local items
      // - if we have synced, keep local items created AFTER the last sync
      for (const l of local) {
        if (!map.has(l.id)) {
          const createdAfterSync = !cur.lastSyncAt ||
            !l.created_at ||
            l.created_at >= cur.lastSyncAt;
          if (createdAfterSync) {
            map.set(l.id, l);
          }
        }
      }
      return Array.from(map.values());
    };

    const mergedGoals = mergeById(cur.goals, remote.goals);
    const mergedTasks = mergeById(cur.tasks, remote.tasks);
    const mergedFinances = mergeById(cur.finances, remote.finances);
    const mergedSnapshots = mergeById(cur.snapshots, remote.snapshots);
    const mergedOnboarding = remote.onboarding ?? cur.onboarding;

    // Sort by user-defined order_index first, then fall back to created_at + name
    // for tools that don't have an order yet.
    let mergedUserTools = mergeById(cur.userTools || [], remote.userTools || []).sort((a, b) => {
      const ai = a.order_index;
      const bi = b.order_index;
      if (ai != null && bi != null) return ai - bi;
      if (ai != null) return -1;
      if (bi != null) return 1;
      const ca = a.created_at ?? "";
      const cb = b.created_at ?? "";
      if (ca !== cb) return ca < cb ? -1 : 1;
      return (a.name || "").localeCompare(b.name || "");
    });
    // If both local and remote ended up empty, seed the defaults so the user
    // never lands on a blank Stack page. Defaults have stable IDs/timestamps
    // so this doesn't cause re-render flicker.
    if (mergedUserTools.length === 0) {
      mergedUserTools = buildDefaultUserTools(p.user_id);
    }

    // If the merge added anything the server didn't have, push it back so
    // the next device that pulls sees the same union. Also push if this
    // device has a primary currency the server hasn't recorded yet.
    const cachedCurrency = stateRef.current.primaryCurrency;
    const currencyMissingOnRemote =
      !remote.primaryCurrency && Boolean(cachedCurrency);
    const localAddedItems =
      mergedGoals.length > remote.goals.length ||
      mergedTasks.length > remote.tasks.length ||
      mergedFinances.length > remote.finances.length ||
      mergedSnapshots.length > remote.snapshots.length ||
      mergedUserTools.length > (remote.userTools || []).length ||
      currencyMissingOnRemote;

    justPulledRef.current = true;
    // If the remote profile has a primary_currency, adopt it (and keep the
    // local profile cache in sync so currency picks survive without Supabase).
    if (remote.primaryCurrency) {
      try {
        updateProfileCurrency(p.id, remote.primaryCurrency);
      } catch {
        // ignore
      }
    }
    if (remote.profileMeta) {
      try {
        updateProfileLocally({ ...remote.profileMeta, id: p.id });
      } catch {
        // ignore
      }
    }
    setState((s) => ({
      ...s,
      goals: mergedGoals,
      tasks: mergedTasks,
      finances: mergedFinances,
      snapshots: mergedSnapshots,
      userTools: mergedUserTools,
      onboarding: mergedOnboarding,
      onboardingDone: Boolean(mergedOnboarding) || s.onboardingDone,
      user: {
        ...mockUser,
        id: p.user_id,
        name: remote.profileMeta?.name || mergedOnboarding?.name || p.name,
        email: p.email ?? "",
      },
      primaryCurrency: remote.primaryCurrency ?? s.primaryCurrency,
      syncStatus: "synced",
      lastSyncAt: new Date().toISOString(),
    }));

    if (localAddedItems) {
      pushToSupabase(p.user_id, {
        goals: mergedGoals,
        tasks: mergedTasks,
        finances: mergedFinances,
        snapshots: mergedSnapshots,
        userTools: mergedUserTools,
        onboarding: mergedOnboarding,
        primaryCurrency: remote.primaryCurrency ?? cachedCurrency,
        profileMeta: { id: p.id, name: p.name, initials: p.initials, color: p.color, emoji: p.emoji },
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
          // Guard: don't duplicate if a pending copy already exists
          const alreadyHasPending = newTasks.some(
            (x) => x.id !== t.id && x.title === t.title && x.status === "pendiente"
          );
          if (alreadyHasPending) return;

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
      const { prioritizing, syncStatus, ...persisted } = state;
      localStorage.setItem(
        storageKeyFor(profile.id),
        JSON.stringify({ ...persisted, _toolsVersion: TOOLS_VERSION })
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
        userTools: state.userTools,
        onboarding: state.onboarding,
        primaryCurrency: state.primaryCurrency,
        profileMeta: {
          id: profile.id,
          name: profile.name,
          initials: profile.initials,
          color: profile.color,
          emoji: profile.emoji,
        },
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
    state.userTools,
    state.onboarding,
    state.primaryCurrency,
    profile,
    hydrated,
  ]);

  // Real-time Supabase subscriptions + fallback polling.
  // Any INSERT/UPDATE/DELETE on the user's tables triggers an instant pull.
  useEffect(() => {
    if (!profile || !supabaseEnabled) return;

    let cancelled = false;
    const supa = getSupabase();

    async function refresh() {
      if (cancelled || !profile) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (pushPendingRef.current) return;
      if (stateRef.current.syncStatus === "syncing") return;
      const remote = await pullFromSupabase(profile.user_id);
      if (cancelled || !profile) return;
      if (remote) applyRemote(profile, remote);
    }

    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") refresh();
    };
    const onFocus = () => refresh();

    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
    if (typeof window !== "undefined") window.addEventListener("focus", onFocus);

    // 30s fallback poll (Realtime handles the fast path)
    const interval = setInterval(refresh, 30000);

    // Supabase Realtime — listen to all 5 tables for this user.
    const channel = supa
      ?.channel(`rumbo-${profile.user_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "financial_entries", filter: `user_id=eq.${profile.user_id}` }, () => { if (!pushPendingRef.current) refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "goals", filter: `user_id=eq.${profile.user_id}` }, () => { if (!pushPendingRef.current) refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${profile.user_id}` }, () => { if (!pushPendingRef.current) refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "money_snapshots", filter: `user_id=eq.${profile.user_id}` }, () => { if (!pushPendingRef.current) refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_tools", filter: `user_id=eq.${profile.user_id}` }, () => { if (!pushPendingRef.current) refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${profile.user_id}` }, () => { if (!pushPendingRef.current) refresh(); })
      .subscribe();

    return () => {
      cancelled = true;
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
      if (typeof window !== "undefined") window.removeEventListener("focus", onFocus);
      clearInterval(interval);
      if (channel) supa?.removeChannel(channel);
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
        const needsToolsReset = parsed._toolsVersion !== TOOLS_VERSION;
        const userTools =
          !needsToolsReset && Array.isArray(parsed.userTools) && parsed.userTools.length > 0
            ? parsed.userTools
            : buildDefaultUserTools(p.user_id);
        setState({
          ...defaultState,
          ...parsed,
          userTools,
          prioritizing: false,
          aiSource: parsed.aiSource ?? "idle",
          syncStatus: supabaseEnabled ? "syncing" : "offline",
          primaryCurrency: profileCurrency,
        });
      } else {
        setState({
          ...defaultState,
          user: { ...mockUser, id: p.user_id, name: p.name, email: p.email ?? "" },
          userTools: buildDefaultUserTools(p.user_id),
          syncStatus: supabaseEnabled ? "syncing" : "offline",
          primaryCurrency: profileCurrency,
        });
      }
    } catch {
      setState({
        ...defaultState,
        user: { ...mockUser, id: p.user_id, name: p.name, email: p.email ?? "" },
        userTools: buildDefaultUserTools(p.user_id),
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

  const reorderTasks: RumboContext["reorderTasks"] = useCallback((reorderedTasks) => {
    setState((s) => {
      // Create a map for quick lookup
      const orderMap = new Map<string, number>();
      reorderedTasks.forEach((t, i) => orderMap.set(t.id, i));

      // Update existing tasks with the new manual_order_index
      const newTasks = s.tasks.map((t) => {
        if (orderMap.has(t.id)) {
          return { ...t, manual_order_index: orderMap.get(t.id) };
        }
        return t;
      });

      return { ...s, tasks: newTasks };
    });
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
          const final = cat ?? heuristicCategorize(f.title) ?? "Otros";
          setState((s) => ({
            ...s,
            finances: s.finances.map((x) =>
              x.id === id ? { ...x, category: final } : x
            ),
          }));
        })
        .catch(() => {
          const final = heuristicCategorize(f.title) ?? "Otros";
          setState((s) => ({
            ...s,
            finances: s.finances.map((x) =>
              x.id === id ? { ...x, category: final } : x
            ),
          }));
        });
    }
  }, []);

  const updateFinance: RumboContext["updateFinance"] = useCallback((id, patch) => {
    setState((s) => ({
      ...s,
      finances: s.finances.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
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

  const addUserTool: RumboContext["addUserTool"] = useCallback((ut) => {
    setState((state) => {
      const maxOrder = state.userTools.reduce(
        (m, t) => (t.order_index != null && t.order_index > m ? t.order_index : m),
        -1
      );
      return {
        ...state,
        userTools: [
          ...state.userTools,
          {
            ...ut,
            id: uid(),
            user_id: state.user.id,
            created_at: new Date().toISOString(),
            order_index: maxOrder + 1,
          },
        ],
      };
    });
  }, []);

  const removeUserTool: RumboContext["removeUserTool"] = useCallback((id) => {
    setState((state) => ({
      ...state,
      userTools: state.userTools.filter((ut) => ut.id !== id),
    }));
  }, []);

  const updateUserTool: RumboContext["updateUserTool"] = useCallback((id, patch) => {
    setState((state) => ({
      ...state,
      userTools: state.userTools.map((ut) => (ut.id === id ? { ...ut, ...patch } : ut)),
    }));
  }, []);

  const reorderUserTools: RumboContext["reorderUserTools"] = useCallback((orderedIds) => {
    setState((state) => {
      const byId = new Map(state.userTools.map((t) => [t.id, t]));
      const reordered: UserTool[] = [];
      orderedIds.forEach((id, idx) => {
        const t = byId.get(id);
        if (t) reordered.push({ ...t, order_index: idx });
      });
      // Append any tool that wasn't in the ordered list (shouldn't happen, defensive)
      state.userTools.forEach((t) => {
        if (!orderedIds.includes(t.id)) reordered.push(t);
      });
      return { ...state, userTools: reordered };
    });
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
      reorderTasks,
      addFinance,
      updateFinance,
      removeFinance,
      addSnapshot,
      removeSnapshot,
      addUserTool,
      removeUserTool,
      updateUserTool,
      reorderUserTools,
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
      reorderTasks,
      addFinance,
      updateFinance,
      removeFinance,
      addSnapshot,
      removeSnapshot,
      addUserTool,
      removeUserTool,
      updateUserTool,
      reorderUserTools,
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
