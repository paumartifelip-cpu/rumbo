"use client";

import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getSupabase } from "@/lib/supabase";
import { signInEmail, sendPasswordReset } from "@/lib/auth";
import { PLAN_PRICE_LABEL, STRIPE_PAYMENT_URL, buildSupportWhatsAppUrl } from "@/lib/payment";

// El link de reset de Supabase aterriza con el marcador en el hash de la URL.
const urlLooksLikeRecovery = () =>
  typeof window !== "undefined" && window.location.hash.includes("type=recovery");

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

type Mode = "signin" | "signup" | "reset" | "recovery";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // True desde el momento en que sabemos que esta visita viene de un link de
  // reset de contraseña. Es un ref (no estado) para que el redirect de sesión
  // de más abajo pueda consultarlo dentro de su .then sin problemas de cierre.
  const recoveryRef = useRef(false);
  const [mode, setMode] = useState<Mode>(
    searchParams.get("mode") === "signup" ? "signup" : "signin"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Detectar la visita desde un link de reset: por la URL (síncrono, antes de
  // que el redirect de sesión pueda dispararse) y por el evento
  // PASSWORD_RECOVERY de supabase-js (cubre cualquier variante del flujo).
  useEffect(() => {
    if (urlLooksLikeRecovery()) {
      recoveryRef.current = true;
      setMode("recovery");
    }
    const supa = getSupabase();
    if (!supa) return;
    const { data: sub } = supa.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        recoveryRef.current = true;
        setMode("recovery");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // If already signed in, skip straight to the app — EXCEPT when this visit
  // comes from a password-reset link: the link itself signs the user in, and
  // redirecting here would skip the "new password" form (users landed on the
  // dashboard without ever being able to change their password).
  useEffect(() => {
    const supa = getSupabase();
    if (!supa) return;
    supa.auth.getSession().then(({ data }) => {
      if (recoveryRef.current || urlLooksLikeRecovery()) return;
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  async function submit() {
    setError(null);
    setInfo(null);

    if (mode === "recovery") {
      if (newPassword.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
      if (newPassword !== confirmPassword) { setError("Las contraseñas no coinciden."); return; }

      setBusy(true);
      const supa = getSupabase();
      if (!supa) { setBusy(false); setError("Sin conexión con el servidor."); return; }

      const { error: err } = await supa.auth.updateUser({ password: newPassword });
      setBusy(false);

      if (err) { setError(err.message || "No se pudo cambiar la contraseña."); return; }
      // El link de recovery ya dejó la sesión iniciada: directo a la app.
      recoveryRef.current = false;
      router.replace("/dashboard");
      return;
    }

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
    // signin
    const res = await signInEmail(mail, password);
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "No se pudo iniciar sesión."); return; }
    router.replace("/dashboard");
  }

  const title =
    mode === "signin"
      ? "Inicia sesión"
      : mode === "signup"
      ? "Crea tu cuenta"
      : mode === "recovery"
      ? "Nueva contraseña"
      : "Recuperar contraseña";
  const subtitle =
    mode === "signin"
      ? "Entra con tu email y contraseña."
      : mode === "signup"
      ? `Tu dinero, solo tuyo, por ${PLAN_PRICE_LABEL}. Paga y crea tu cuenta al momento.`
      : mode === "recovery"
      ? "Escribe tu nueva contraseña."
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

          {mode === "signup" ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black tracking-tight">3,99 €</span>
                  <span className="text-sm text-rumbo-muted">al mes</span>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-rumbo-ink/80">
                  <li>✓ Todos tus ingresos y gastos, claros</li>
                  <li>✓ Objetivos y evolución de tu dinero</li>
                  <li>✓ Sincronizado y privado, solo para ti</li>
                  <li>✓ Date de baja cuando quieras por WhatsApp</li>
                </ul>
              </div>
              <a
                href={STRIPE_PAYMENT_URL}
                className="block w-full text-center px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors"
              >
                Pagar y crear mi cuenta →
              </a>
              <p className="text-[11px] text-rumbo-muted text-center leading-relaxed">
                Pago seguro con Stripe. Nada más pagar volverás aquí para poner tu contraseña y entrar a tu cuenta.
              </p>
            </div>
          ) : (
          <div className="space-y-3">
            {mode !== "recovery" && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">Email</label>
                <input
                  type="email" autoComplete="email" className="input w-full" placeholder="tu@email.com" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                />
              </div>
            )}

            {mode === "recovery" ? (
              <>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">Nueva contraseña</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"} autoComplete="new-password" className="input w-full pr-10" placeholder="Mínimo 6 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-rumbo-muted hover:text-rumbo-ink transition-colors"
                      aria-label={showNewPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showNewPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">Confirmar contraseña</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" className="input w-full pr-10" placeholder="Repite tu nueva contraseña"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-rumbo-muted hover:text-rumbo-ink transition-colors"
                      aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showConfirmPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>
              </>
            ) : mode !== "reset" && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className="input w-full pr-10" placeholder="Mínimo 6 caracteres" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-rumbo-muted hover:text-rumbo-ink transition-colors"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
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
                : mode === "signin"
                ? "Entrar →"
                : mode === "recovery"
                ? "Cambiar contraseña →"
                : "Enviar enlace →"}
            </button>
          </div>
          )}

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
              <>
                <div>
                  ¿Ya tienes cuenta?{" "}
                  <button onClick={() => { setMode("signin"); setError(null); setInfo(null); }} className="font-semibold text-emerald-700 hover:underline">
                    Inicia sesión
                  </button>
                </div>
                <div>
                  <a
                    href={buildSupportWhatsAppUrl("Hola, pagué Rumbo pero no pude crear mi cuenta.")}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs hover:underline"
                  >
                    ¿Pagaste y no pudiste crear tu cuenta? Escríbenos por WhatsApp
                  </a>
                </div>
              </>
            )}
            {(mode === "reset" || mode === "recovery") && (
              <div>
                <button onClick={() => { setMode("signin"); setError(null); setInfo(null); setNewPassword(""); setConfirmPassword(""); }} className="font-semibold text-emerald-700 hover:underline">
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
