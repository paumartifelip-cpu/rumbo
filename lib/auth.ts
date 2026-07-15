import type { User } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { Profile } from "./profiles";

export interface AuthResult {
  ok: boolean;
  error?: string;
  /** True when sign-up succeeded but the email still needs confirmation. */
  needsConfirm?: boolean;
}

// Turn raw Supabase auth errors into friendly Spanish messages.
function friendly(msg?: string): string {
  const m = (msg ?? "").toLowerCase();
  if (m.includes("invalid login")) return "Email o contraseña incorrectos.";
  if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already"))
    return "Ya existe una cuenta con ese email. Inicia sesión.";
  if (m.includes("at least") || m.includes("password should") || m.includes("weak password"))
    return "La contraseña debe tener al menos 6 caracteres.";
  if (m.includes("invalid email") || m.includes("unable to validate email"))
    return "Introduce un email válido.";
  if (m.includes("email not confirmed"))
    return "Confirma tu email antes de entrar (revisa tu correo).";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
  return msg || "Algo salió mal. Inténtalo de nuevo.";
}

/**
 * Make sure a profiles row exists for this auth user (idempotent).
 * If the row already exists, only backfill fields that are EMPTY: this must
 * never overwrite a name the user set in onboarding (the old upsert clobbered
 * it with the auth-metadata name on every app boot), and it restores emails
 * that an older sync bug erased from the column.
 */
export async function ensureProfileRow(uid: string, name: string, email: string) {
  const supa = getSupabase();
  if (!supa) return;
  try {
    const { data } = await supa
      .from("profiles")
      .select("user_id, name, email")
      .eq("user_id", uid)
      .maybeSingle();

    if (!data) {
      await supa.from("profiles").insert({
        user_id: uid,
        profile_id: uid,
        name,
        email,
        updated_at: new Date().toISOString(),
      });
      return;
    }

    const patch: Record<string, any> = {};
    if (!data.name && name) patch.name = name;
    if (!data.email && email) patch.email = email;
    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date().toISOString();
      await supa.from("profiles").update(patch).eq("user_id", uid);
    }
  } catch {
    // ignore — the row may already exist; data still works.
  }
}

export async function signUpEmail(email: string, password: string, name: string): Promise<AuthResult> {
  const supa = getSupabase();
  if (!supa) return { ok: false, error: "Sin conexión con el servidor." };
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim() || cleanEmail.split("@")[0];
  const { data, error } = await supa.auth.signUp({
    email: cleanEmail,
    password,
    options: { data: { name: cleanName } },
  });
  if (error) return { ok: false, error: friendly(error.message) };
  // Email confirmation ON → user exists but no active session yet.
  if (!data.session) return { ok: true, needsConfirm: true };
  if (data.user) await ensureProfileRow(data.user.id, cleanName, cleanEmail);
  return { ok: true };
}

export async function signInEmail(email: string, password: string): Promise<AuthResult> {
  const supa = getSupabase();
  if (!supa) return { ok: false, error: "Sin conexión con el servidor." };
  const { data, error } = await supa.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) return { ok: false, error: friendly(error.message) };
  if (data.user) {
    const name = (data.user.user_metadata?.name as string) || data.user.email!.split("@")[0];
    await ensureProfileRow(data.user.id, name, data.user.email ?? "");
  }
  return { ok: true };
}

export async function signOutAuth() {
  const supa = getSupabase();
  await supa?.auth.signOut();
}

export async function sendPasswordReset(email: string): Promise<AuthResult> {
  const supa = getSupabase();
  if (!supa) return { ok: false, error: "Sin conexión con el servidor." };
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
  const { error } = await supa.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true };
}

/** Build the app's Profile object from an authenticated Supabase user. */
export function profileFromAuthUser(u: User): Profile {
  const name =
    (u.user_metadata?.name as string) || (u.email ? u.email.split("@")[0] : "Yo");
  return {
    id: u.id,
    user_id: u.id,
    name,
    initials: name.charAt(0).toUpperCase(),
    color: "from-emerald-200 to-emerald-400",
    emoji: "🌱",
    email: u.email ?? undefined,
    custom: true,
  };
}
