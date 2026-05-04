export interface Profile {
  id: string;
  user_id: string; // UUID estable usado para Supabase
  name: string;
  initials: string;
  color: string;
  emoji?: string;
  email?: string;
  custom?: boolean;
  primary_currency?: "EUR" | "USD" | "MXN" | "ARS";
}

export const DEFAULT_PROFILES: Profile[] = [
  {
    id: "pau",
    user_id: "11111111-1111-1111-1111-111111111111",
    name: "Pau",
    initials: "P",
    emoji: "🌱",
    color: "from-emerald-200 to-emerald-400",
  },
  {
    id: "michelle",
    user_id: "22222222-2222-2222-2222-222222222222",
    name: "Michelle",
    initials: "M",
    emoji: "💜",
    color: "from-violet-200 to-violet-400",
  },
];

// Kept as an alias for legacy imports.
export const PROFILES = DEFAULT_PROFILES;

const CUSTOM_KEY = "rumbo_custom_profiles";

const CUSTOM_COLORS = [
  "from-amber-200 to-amber-400",
  "from-rose-200 to-rose-400",
  "from-blue-200 to-blue-400",
  "from-cyan-200 to-cyan-400",
  "from-fuchsia-200 to-fuchsia-400",
  "from-orange-200 to-orange-400",
  "from-teal-200 to-teal-400",
  "from-pink-200 to-pink-400",
];

const CUSTOM_EMOJIS = [
  "🚀", "⭐", "🔥", "✨", "🎯", "🌈", "⚡", "💎",
  "🦊", "🐻", "🦁", "🐯", "🐼", "🦄", "🐙", "🦋",
  "🌺", "🌸", "🍀", "🌻", "🍉", "🍑", "🥑", "🍍",
  "🎨", "🎵", "🏆", "🎮", "🛸", "🌙", "☀️", "🌊",
];

export const SESSION_KEY = "rumbo_current_profile";

export function getCurrentProfileId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

export function setCurrentProfileId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(SESSION_KEY, id);
  else localStorage.removeItem(SESSION_KEY);
}

export function getCustomProfiles(): Profile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p) => ({ ...p, custom: true }));
  } catch {
    return [];
  }
}

function writeCustomProfiles(list: Profile[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
}

export function getAllProfiles(): Profile[] {
  return [...DEFAULT_PROFILES, ...getCustomProfiles()];
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "user"
  );
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function addCustomProfile(
  name: string,
  primary_currency: "EUR" | "USD" | "MXN" | "ARS" = "EUR"
): Profile {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nombre vacío");
  const existing = getCustomProfiles();
  const taken = new Set([
    ...DEFAULT_PROFILES.map((p) => p.id),
    ...existing.map((p) => p.id),
  ]);
  const base = slugify(trimmed);
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  const profile: Profile = {
    id,
    user_id: uuid(),
    name: trimmed,
    initials: trimmed.charAt(0).toUpperCase(),
    color: CUSTOM_COLORS[existing.length % CUSTOM_COLORS.length],
    emoji: pick(CUSTOM_EMOJIS),
    custom: true,
    primary_currency,
  };
  writeCustomProfiles([...existing, profile]);
  return profile;
}

export function removeCustomProfile(id: string) {
  writeCustomProfiles(getCustomProfiles().filter((p) => p.id !== id));
}

export function updateProfileCurrency(
  id: string,
  currency: "EUR" | "USD" | "MXN" | "ARS"
) {
  if (typeof window === "undefined") return;
  // Custom profiles: persist on the profile itself.
  const customs = getCustomProfiles();
  const idx = customs.findIndex((p) => p.id === id);
  if (idx >= 0) {
    customs[idx] = { ...customs[idx], primary_currency: currency };
    writeCustomProfiles(customs);
    return;
  }
  // Default profiles (Pau, Michelle): persist per-profile in a separate map.
  try {
    const raw = localStorage.getItem(DEFAULT_CURRENCY_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[id] = currency;
    localStorage.setItem(DEFAULT_CURRENCY_KEY, JSON.stringify(map));
  } catch {}
}

const DEFAULT_CURRENCY_KEY = "rumbo_default_profile_currencies";

export function getProfileCurrency(
  id: string
): "EUR" | "USD" | "MXN" | "ARS" {
  if (typeof window === "undefined") return "EUR";
  const customs = getCustomProfiles();
  const custom = customs.find((p) => p.id === id);
  if (custom?.primary_currency) return custom.primary_currency;
  try {
    const raw = localStorage.getItem(DEFAULT_CURRENCY_KEY);
    if (raw) {
      const map = JSON.parse(raw);
      if (map[id]) return map[id];
    }
  } catch {}
  return "EUR";
}

export function findProfile(id: string | null): Profile | null {
  if (!id) return null;
  return getAllProfiles().find((p) => p.id === id) ?? null;
}
