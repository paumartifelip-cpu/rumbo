"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getSupabase } from "@/lib/supabase";
import { signInEmail, signUpEmail, sendPasswordReset } from "@/lib/auth";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

type Mode = "signin" | "signup" | "reset";

function LoginInner() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // If already signed in, skip straight to the app.
  useEffect(() => {
    const supa = getSupabase();
    if (!supa) return;
    supa.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  async function submit() {
    setError(null);
    setInfo(null);
    const mail = email.trim().toLowerCase();
    if (!mail || !mail.includes("@")) { setError("Introduce un email válido."); return; }

    if (mode === "reset") {
      setBusy(true);
      const res = await sendPasswordReset(mail);
      setBusy(false);
      if (!res.ok) { setError(res.error ?? "No se pudo enviar el correo."); return; }
      setInfo("Te hemos enviado un email para restablecer tu contraseña.");
      return;
    }

    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }

    setBusy(true);
    if (mode === "signup") {
      if (!name.trim()) { setBusy(false); setError("Escribe tu nombre."); return; }
      const res = await signUpEmail(mail, password, name);
      setBusy(false);
      if (!res.ok) { setError(res.error ?? "No se pudo crear la cuenta."); return; }
      if (res.needsConfirm) {
        setInfo("Cuenta creada. Confirma tu email desde el enlace que te hemos enviado y luego inicia sesión.");
        setMode("signin");
        return;
      }
      router.replace("/onboarding");
      return;
    }

    // signin
    const res = await signInEmail(mail, password);
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "No se pudo iniciar sesión."); return; }
    router.replace("/dashboard");
  }

  const title =
    mode === "signin" ? "Inicia sesión" : mode === "signup" ? "Crea tu cuenta" : "Recuperar contraseña";
  const subtitle =
    mode === "signin"
      ? "Entra con tu email y contraseña."
      : mode === "signup"
      ? "Tu dinero, solo tuyo. Empieza en un minuto."
      : "Te enviaremos un enlace para crear una nueva.";

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="px-6 md:px-10 py-6 flex items-center justify-between">
        <Logo size="md" />
        <Link href="/" className="flex items-center gap-1.5 text-sm text-rumbo-muted hover:text-rumbo-ink transition-colors">
          <span>←</span><span>Inicio</span>
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{title}</h1>
            <p className="text-rumbo-muted mt-2 text-sm">{subtitle}</p>
          </div>

          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {mode === "signup" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">Nombre</label>
                  <input
                    className="input w-full" placeholder="Cómo te llamas" value={name} maxLength={24}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">Email</label>
              <input
                type="email" autoComplete="email" className="input w-full" placeholder="tu@email.com" value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              />
            </div>

            {mode !== "reset" && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">Contraseña</label>
                <input
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className="input w-full" placeholder="Mínimo 6 caracteres" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                />
              </div>
            )}

            {error && (
              <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{error}</div>
            )}
            {info && (
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">{info}</div>
            )}

            <button
              onClick={submit}
              disabled={busy}
              className="w-full px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm transition-colors"
            >
              {busy
                ? "Un momento…"
                : mode === "signin" ? "Entrar →" : mode === "signup" ? "Crear cuenta →" : "Enviar enlace →"}
            </button>
          </div>

          {/* Mode switches */}
          <div className="mt-6 text-center text-sm text-rumbo-muted space-y-2">
            {mode === "signin" && (
              <>
                <div>
                  ¿No tienes cuenta?{" "}
                  <button onClick={() => { setMode("signup"); setError(null); setInfo(null); }} className="font-semibold text-emerald-700 hover:underline">
                    Créala aquí
                  </button>
                </div>
                <div>
                  <button onClick={() => { setMode("reset"); setError(null); setInfo(null); }} className="text-xs hover:underline">
                    Olvidé mi contraseña
                  </button>
                </div>
              </>
            )}
            {mode === "signup" && (
              <div>
                ¿Ya tienes cuenta?{" "}
                <button onClick={() => { setMode("signin"); setError(null); setInfo(null); }} className="font-semibold text-emerald-700 hover:underline">
                  Inicia sesión
                </button>
              </div>
            )}
            {mode === "reset" && (
              <div>
                <button onClick={() => { setMode("signin"); setError(null); setInfo(null); }} className="font-semibold text-emerald-700 hover:underline">
                  ← Volver a iniciar sesión
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
