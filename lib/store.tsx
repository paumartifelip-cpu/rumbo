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
import { heuristicCategorize } from "./gemini";
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
import { pullFromSupabase, pushToSupabase, SyncSnapshot, wipeProfileData } from "./sync";
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
  /**
   * Tombstones: ids of rows the user has deleted locally. Prevents a racing
   * remote pull from resurrecting them before the delete is pushed, and stops
   * recurring generation from recreating a deleted instance. Capped to the
   * most recent entries so it can't grow unbounded.
   */
  deletedIds: string[];
}

const TOMBSTONE_CAP = 2000;
const addTombstones = (existing: string[] | undefined, ...ids: string[]): string[] => {
  const merged = [...(existing ?? []), ...ids];
  return merged.length > TOMBSTONE_CAP ? merged.slice(merged.length - TOMBSTONE_CAP) : merged;
};

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
  /**
   * Robust delete for recurring entries. If `id` is a recurring template it
   * removes the template AND every generated instance (deterministic children
   * by id prefix + legacy children by title/amount). For a normal entry it just
   * removes that one. Everything removed is tombstoned so it can't come back.
   */
  removeFinanceCascade: (id: string) => void;
  addSnapshot: (s: Omit<MoneySnapshot, "id" | "user_id" | "created_at">) => void;
  removeSnapshot: (id: string) => void;
  addUserTool: (ut: Omit<UserTool, "id" | "user_id" | "created_at">) => void;
  removeUserTool: (id: string) => void;
  updateUserTool: (id: string, patch: Partial<UserTool>) => void;
  toggleToolFavorite: (id: string) => void;
  reorderUserTools: (orderedIds: string[]) => void;
  saveOnboarding: (data: OnboardingData) => void;
  updateOnboarding: (patch: Partial<OnboardingData>) => void;
  resetDemo: () => Promise<void> | void;
  prioritize: () => Promise<void>;
  setPrimaryCurrency: (c: Currency) => void;
  /** Returns the entry's amount converted into the user's primary currency. */
  amountInPrimary: (entry: FinancialEntry) => number;
  adjustedBaseSalary: (monthKey: string) => number;
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
export const TOOLS_VERSION = "v5";
const TOOLS_SEED = "2026-05-07T00:00:00.000Z";

// Names from the previous default list. If any of these are found in the
// user's cached tools we know it's stale and we replace the whole set.
const STALE_DEFAULT_NAMES = new Set([
  "Notion", "Obsidian", "Todoist", "Calendly", "Cal.com", "Linear", "Raycast",
  "Revolut", "YNAB", "Wise", "Stripe", "Google Gemini", "v0", "Bolt",
  "Replit Agent", "Mistral Le Chat", "Antigravity", "Google Whisk",
  "Suno AI", "ElevenLabs", "HeyGen", "Higgsfield", "Krea", "Pomelli",
  "Canva", "CapCut", "Descript", "Figma", "Cursor", "Vercel", "Supabase",
  "Beehiiv", "Kit (ConvertKit)", "Buffer", "Loom", "Slack",
]);

/** Returns true if the cached userTools are from the old curated list. */
export function userToolsAreStale(tools: UserTool[] | undefined): boolean {
  if (!Array.isArray(tools) || tools.length === 0) return false;
  return tools.some((t) => STALE_DEFAULT_NAMES.has(t.name));
}

export const buildDefaultUserTools = (userId: string): UserTool[] => {
  return BASE_DEFAULT_TOOLS.map((t, idx) => ({
    ...t,
    id: `default-tool-${idx}`,
    user_id: userId,
    created_at: TOOLS_SEED,
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
  deletedIds: [],
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
          // bumped, OR when we detect any name from the previous default list.
          const needsToolsReset =
            parsed._toolsVersion !== TOOLS_VERSION ||
            userToolsAreStale(parsed.userTools);
          const userTools =
            !needsToolsReset && Array.isArray(parsed.userTools) && parsed.userTools.length > 0
              ? parsed.userTools
              : buildDefaultUserTools(p.user_id);
          const onboardingDone = Boolean(
            parsed.onboarding &&
            parsed.onboarding.total_target > 0 &&
            parsed.onboarding.monthly_target > 0
          );
          setState({
            ...defaultState,
            ...parsed,
            userTools,
            onboardingDone,
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
    // Rows the user deleted locally must never be re-added by a racing pull,
    // even if the remote still has them (the delete push may not have landed).
    const tombstoned = new Set(cur.deletedIds ?? []);
    // Merge by id: remote items are authoritative, but any local items not
    // yet on the server are preserved (so a device with offline-only history
    // doesn't get wiped the first time it syncs). Edits to the same id keep
    // the remote version; pure-local items survive.
    const mergeById = <T extends { id: string; created_at?: string }>(local: T[], rem: T[]): T[] => {
      const map = new Map<string, T>();
      // Remote is authoritative for IDs it knows about — except tombstoned ones.
      for (const r of rem) {
        if (tombstoned.has(r.id)) continue;
        map.set(r.id, r);
      }
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

    // Tools merge: same union as mergeById but for IDs in BOTH, take the row
    // whose updated_at is newer. Local mutations bump updated_at to now() so
    // a heart-toggle that hasn't been pushed yet still wins over a stale
    // remote pull. Falls back to created_at if no updated_at exists.
    const mergeToolsByUpdated = (local: UserTool[], rem: UserTool[]): UserTool[] => {
      const map = new Map<string, UserTool>();
      const ts = (t: UserTool) => t.updated_at || t.created_at || "";
      for (const r of rem) {
        if (tombstoned.has(r.id)) continue;
        map.set(r.id, r);
      }
      for (const l of local) {
        const r = map.get(l.id);
        if (!r) {
          const createdAfterSync = !cur.lastSyncAt ||
            !l.created_at ||
            l.created_at >= cur.lastSyncAt;
          if (createdAfterSync) map.set(l.id, l);
        } else if (ts(l) > ts(r)) {
          map.set(l.id, l);
        }
      }
      return Array.from(map.values());
    };

    let mergedUserTools = mergeToolsByUpdated(cur.userTools || [], remote.userTools || []).sort((a, b) => {
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
      onboardingDone: Boolean(
        mergedOnboarding &&
        mergedOnboarding.total_target > 0 &&
        mergedOnboarding.monthly_target > 0
      ),
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

      // Deterministic id for a generated recurring finance instance. Using a
      // stable key (parent id + period) instead of a random uid makes
      // regeneration idempotent: running the generator twice — or on two
      // devices — produces the SAME id, so an upsert overwrites instead of
      // creating a duplicate. This is what prevents the double/triple counting.
      const tombstoned = new Set(s.deletedIds ?? []);
      const existingFinanceIds = new Set(newFinances.map((f) => f.id));
      // Month-level logical signature: a recurring instance must appear AT MOST
      // ONCE per month. This guards against duplicating a row that already
      // exists for the same month under a different (legacy random) id or on a
      // slightly different day — the real cause of the recurring duplication.
      const financeSig = (f: { type: string; title: string; amount: number; date: string }) =>
        `${f.type}|${f.title.trim().toLowerCase()}|${f.amount}|${f.date.slice(0, 7)}`;
      const existingFinanceSigs = new Set(newFinances.map(financeSig));
      const recurringChildId = (parentId: string, period: string) =>
        `${parentId}__rec__${period}`;
      const pushFinanceInstance = (instance: FinancialEntry) => {
        // Never recreate something the user deleted, and never duplicate an
        // instance that already exists — by id OR by logical signature.
        if (
          tombstoned.has(instance.id) ||
          existingFinanceIds.has(instance.id) ||
          existingFinanceSigs.has(financeSig(instance))
        ) {
          return;
        }
        existingFinanceIds.add(instance.id);
        existingFinanceSigs.add(financeSig(instance));
        newFinances.push(instance);
        hasNew = true;
      };

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

      const getMissedMonths = (lastGenStr: string, currentMonthStr: string): string[] => {
        const result: string[] = [];
        let [year, month] = lastGenStr.split("-").map(Number);
        const [curYear, curMonth] = currentMonthStr.split("-").map(Number);
        while (true) {
          month++;
          if (month > 12) {
            month = 1;
            year++;
          }
          if (year > curYear || (year === curYear && month > curMonth)) {
            break;
          }
          result.push(`${year}-${String(month).padStart(2, "0")}`);
        }
        return result;
      };

      const getMissedYears = (lastGenStr: string, currentYearStr: string): string[] => {
        const result: string[] = [];
        let year = Number(lastGenStr);
        const curYear = Number(currentYearStr);
        while (true) {
          year++;
          if (year > curYear) {
            break;
          }
          result.push(String(year));
        }
        return result;
      };

      s.finances.forEach((f) => {
        if (!f.recurrence) return;
        
        // Fallback to f.date instead of f.created_at so backdated recurring finances generate correctly
        const lastGen = f.last_generated_date ? f.last_generated_date.slice(0, 7) : f.date.slice(0, 7);
        const entryCurrency = f.currency ?? s.primaryCurrency;
        const currentPrimaryAmt = convertAmount(f.amount, entryCurrency, s.primaryCurrency);
        const { recurrence, last_generated_date, ...financeWithoutRecurrence } = f;

        if (f.recurrence === "mensual" && lastGen < thisMonthStr) {
          const missedMonths = getMissedMonths(lastGen, thisMonthStr);
          if (missedMonths.length > 0) {
            const idx = newFinances.findIndex(x => x.id === f.id);
            if (idx >= 0) {
              newFinances[idx] = { ...newFinances[idx], last_generated_date: now.toISOString() };
              hasNew = true;
            }
            missedMonths.forEach((monthStr) => {
              const origDate = new Date(f.date);
              const origDay = origDate.getDate();
              const [genYear, genMonth] = monthStr.split("-").map(Number);
              const genDate = new Date(origDate);
              genDate.setFullYear(genYear);
              genDate.setMonth(genMonth - 1, 1);
              const lastDay = new Date(genYear, genMonth, 0).getDate();
              genDate.setDate(Math.min(origDay, lastDay));

              pushFinanceInstance({
                ...financeWithoutRecurrence,
                id: recurringChildId(f.id, monthStr),
                date: genDate.toISOString(),
                amount_in_primary: currentPrimaryAmt,
                created_at: now.toISOString(),
              });
            });
          }
        } else if (f.recurrence === "anual") {
          const lastYear = f.last_generated_date ? f.last_generated_date.slice(0, 4) : f.date.slice(0, 4);
          const curYear = todayStr.slice(0, 4);
          if (lastYear < curYear) {
            const missedYears = getMissedYears(lastYear, curYear);
            if (missedYears.length > 0) {
              const idx = newFinances.findIndex(x => x.id === f.id);
              if (idx >= 0) {
                newFinances[idx] = { ...newFinances[idx], last_generated_date: now.toISOString() };
                hasNew = true;
              }
              missedYears.forEach((yearStr) => {
                const origDate = new Date(f.date);
                const origDay = origDate.getDate();
                const origMonth = origDate.getMonth();
                const genYear = Number(yearStr);
                const genDate = new Date(origDate);
                genDate.setFullYear(genYear);
                genDate.setMonth(origMonth, 1);
                const lastDay = new Date(genYear, origMonth + 1, 0).getDate();
                genDate.setDate(Math.min(origDay, lastDay));

                pushFinanceInstance({
                  ...financeWithoutRecurrence,
                  id: recurringChildId(f.id, yearStr),
                  date: genDate.toISOString(),
                  amount_in_primary: currentPrimaryAmt,
                  created_at: now.toISOString(),
                });
              });
            }
          }
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
        const needsToolsReset =
          parsed._toolsVersion !== TOOLS_VERSION ||
          userToolsAreStale(parsed.userTools);
        const userTools =
          !needsToolsReset && Array.isArray(parsed.userTools) && parsed.userTools.length > 0
            ? parsed.userTools
            : buildDefaultUserTools(p.user_id);
        const onboardingDone = Boolean(
          parsed.onboarding &&
          parsed.onboarding.total_target > 0 &&
          parsed.onboarding.monthly_target > 0
        );
        setState({
          ...defaultState,
          ...parsed,
          userTools,
          onboardingDone,
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
      const primary = stateRef.current.primaryCurrency;
      const from = entry.currency ?? primary;
      // Always convert LIVE from the entry's own currency to the CURRENT primary
      // currency. We deliberately ignore any stored `amount_in_primary` snapshot:
      // it was frozen against whatever the primary currency was at creation time,
      // so trusting it silently corrupts every sum the moment the user changes
      // their primary currency. Same-currency entries return their exact amount.
      if (from === primary) return entry.amount;
      return convertAmount(entry.amount, from, primary);
    },
    []
  );

  const adjustedBaseSalary = useCallback((mKey: string) => {
    const isEntrepreneur = stateRef.current.onboarding?.income_type === "empresario";
    if (isEntrepreneur) return 0;
    
    const baseSalary = stateRef.current.onboarding?.current_monthly_income ?? 0;
    if (baseSalary <= 0) return 0;

    const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

    // Suppress the implicit base salary only when the user has EXPLICITLY logged
    // a salary that month, detected by title. We intentionally do NOT match by
    // amount: an unrelated income that merely happens to equal the base salary
    // would otherwise wipe it out and undercount the month.
    const hasLoggedSalary = stateRef.current.finances.some((f) => {
      if (f.type !== "ingreso") return false;
      if (monthKey(new Date(f.date)) !== mKey) return false;
      const title = f.title.toLowerCase();
      return (
        title.includes("sueldo") ||
        title.includes("nómina") ||
        title.includes("nomina") ||
        title.includes("salary") ||
        title.includes("payroll")
      );
    });

    return hasLoggedSalary ? 0 : baseSalary;
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

    setState((cur) => ({ ...cur, prioritizing: false }));

    const local = localPrioritize(pending, s.goals);
    const scores = local.ordered.map((o) => ({
      task_id: o.task.id,
      score: o.score,
      reason: o.reason,
    }));
    const advice = {
      today_focus: local.today_focus,
      financial_advice: local.financial_advice,
    };

    setState((cur) => ({
      ...cur,
      prioritizing: false,
      aiSource: "fallback",
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
      deletedIds: addTombstones(
        s.deletedIds,
        id,
        ...s.tasks.filter((t) => t.goal_id === id).map((t) => t.id)
      ),
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
      deletedIds: addTombstones(s.deletedIds, id),
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
    // Defensive: never store a broken amount (NaN/Infinity/negative). Keeps
    // every downstream sum well-defined no matter what the form passes in.
    const amount = Number(f.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    f = { ...f, amount };
    const id = uid();
    setState((s) => {
      const from = f.currency ?? s.primaryCurrency;
      const amount_in_primary = convertAmount(f.amount, from, s.primaryCurrency);
      const finalCategory = f.type === "gasto" && !f.category
        ? (heuristicCategorize(f.title) ?? "Otros")
        : f.category;

      return {
        ...s,
        finances: [
          ...s.finances,
          {
            ...f,
            id,
            amount_in_primary,
            category: finalCategory,
            user_id: s.user.id,
            created_at: new Date().toISOString(),
          },
        ],
      };
    });
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
      deletedIds: addTombstones(s.deletedIds, id),
    }));
  }, []);

  const removeFinanceCascade: RumboContext["removeFinanceCascade"] = useCallback((id) => {
    setState((s) => {
      const target = s.finances.find((f) => f.id === id);
      if (!target) return s;
      const ids = new Set<string>([id]);
      // Only a recurring template fans out to its instances.
      if (target.recurrence) {
        const t = target.title.trim().toLowerCase();
        const prefix = `${id}__rec__`;
        s.finances.forEach((f) => {
          if (f.id === id) return;
          const isDeterministicChild = f.id.startsWith(prefix);
          const isLegacyChild =
            !f.recurrence &&
            f.type === target.type &&
            f.amount === target.amount &&
            f.title.trim().toLowerCase() === t;
          if (isDeterministicChild || isLegacyChild) ids.add(f.id);
        });
      }
      return {
        ...s,
        finances: s.finances.filter((f) => !ids.has(f.id)),
        deletedIds: addTombstones(s.deletedIds, ...ids),
      };
    });
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
      deletedIds: addTombstones(s.deletedIds, id),
    }));
  }, []);

  const addUserTool: RumboContext["addUserTool"] = useCallback((ut) => {
    setState((state) => {
      const maxOrder = state.userTools.reduce(
        (m, t) => (t.order_index != null && t.order_index > m ? t.order_index : m),
        -1
      );
      const now = new Date().toISOString();
      return {
        ...state,
        userTools: [
          ...state.userTools,
          {
            ...ut,
            id: uid(),
            user_id: state.user.id,
            created_at: now,
            updated_at: now,
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
      deletedIds: addTombstones(state.deletedIds, id),
    }));
  }, []);

  const updateUserTool: RumboContext["updateUserTool"] = useCallback((id, patch) => {
    setState((state) => ({
      ...state,
      userTools: state.userTools.map((ut) =>
        ut.id === id ? { ...ut, ...patch, updated_at: new Date().toISOString() } : ut
      ),
    }));
  }, []);

  const toggleToolFavorite: RumboContext["toggleToolFavorite"] = useCallback((id) => {
    setState((state) => ({
      ...state,
      userTools: state.userTools.map((ut) =>
        ut.id === id
          ? { ...ut, is_favorite: !ut.is_favorite, updated_at: new Date().toISOString() }
          : ut
      ),
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
      setState((s) => {
        const nextOnboarding = {
          name: s.onboarding?.name ?? "",
          current_money: s.onboarding?.current_money ?? 0,
          total_target: s.onboarding?.total_target ?? 0,
          current_monthly_income: s.onboarding?.current_monthly_income ?? 0,
          monthly_target: s.onboarding?.monthly_target ?? 0,
          target_date:
            s.onboarding?.target_date ?? new Date().toISOString(),
          ...patch,
        };
        const hasTargets = Boolean(
          nextOnboarding.total_target > 0 &&
          nextOnboarding.monthly_target > 0
        );
        return {
          ...s,
          onboarding: nextOnboarding,
          onboardingDone: hasTargets,
        };
      });
    },
    []
  );

  /**
   * Wipe ALL of the active profile's data — locally AND in Supabase.
   * The profile itself stays alive (still signed in, name/email preserved),
   * but goals, tasks, finances, snapshots, tools and onboarding all reset.
   * Defaults (tools, etc.) are re-seeded on the next mount.
   */
  const resetDemo = useCallback(async () => {
    if (!profile) return;
    // Mark this state push as a clean wipe so the debounced push doesn't
    // race the delete (and re-create rows we're trying to remove).
    pushPendingRef.current = true;

    // 1) Server-side wipe.
    if (supabaseEnabled) {
      await wipeProfileData(profile.user_id).catch(() => {});
    }

    // 2) Local cache wipe.
    try { localStorage.removeItem(storageKeyFor(profile.id)); } catch {}

    // 3) Reset in-memory state to defaults (with fresh default tools).
    setState({
      ...defaultState,
      user: { ...mockUser, id: profile.user_id, name: profile.name, email: profile.email ?? "" },
      userTools: buildDefaultUserTools(profile.user_id),
      primaryCurrency: getProfileCurrency(profile.id),
      syncStatus: "synced",
      lastSyncAt: new Date().toISOString(),
    });

    pushPendingRef.current = false;
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
      removeFinanceCascade,
      addSnapshot,
      removeSnapshot,
      addUserTool,
      removeUserTool,
      updateUserTool,
      toggleToolFavorite,
      reorderUserTools,
      saveOnboarding,
      updateOnboarding,
      resetDemo,
      prioritize,
      setPrimaryCurrency,
      amountInPrimary,
      adjustedBaseSalary,
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
      removeFinanceCascade,
      addSnapshot,
      removeSnapshot,
      addUserTool,
      removeUserTool,
      updateUserTool,
      toggleToolFavorite,
      reorderUserTools,
      saveOnboarding,
      updateOnboarding,
      resetDemo,
      prioritize,
      setPrimaryCurrency,
      amountInPrimary,
      adjustedBaseSalary,
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
