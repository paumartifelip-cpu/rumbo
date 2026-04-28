export interface Profile {
  id: string;
  user_id: string; // UUID estable usado para Supabase
  name: string;
  initials: string;
  color: string;
  email: string;
}

export const PROFILES: Profile[] = [
  {
    id: "pau",
    user_id: "11111111-1111-1111-1111-111111111111",
    name: "Pau",
    initials: "P",
    color: "from-emerald-200 to-emerald-400",
    email: "pau@rumbo.app",
  },
  {
    id: "michelle",
    user_id: "22222222-2222-2222-2222-222222222222",
    name: "Michelle",
    initials: "M",
    color: "from-violet-200 to-violet-400",
    email: "michelle@rumbo.app",
  },
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

export function findProfile(id: string | null): Profile | null {
  if (!id) return null;
  return PROFILES.find((p) => p.id === id) ?? null;
}
