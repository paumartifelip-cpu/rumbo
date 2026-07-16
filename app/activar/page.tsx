"use client";

import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { signUpEmail } from "@/lib/auth";
import {
  buildSupportWhatsAppUrl,
  consumePaidSession,
  verifyPaidSession,
} from "@/lib/payment";

// Stripe redirige aquí tras el pago con ?session_id={CHECKOUT_SESSION_ID}.
// Verificamos el pago con la Edge Function y creamos la cuenta al momento.
export default function ActivarPage() {
  return (
    <Suspense fallback={null}>
      <ActivarInner />
    </Suspense>
  );
}

type Phase = "verifying" | "form" | "creating" | "error";

function ActivarInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") ?? "";

  const [phase, setPhase] = useState<Phase>("verifying");
  const [errorKind, setErrorKind] = useState<string>("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function verify() {
    if (!sessionId) {
      setErrorKind("missing");
      setPhase("error");
      return;
    }
    setPhase("verifying");
    // Reintenta un par de veces los fallos de red antes de rendirse.
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await verifyPaidSession(sessionId);
      if (res.ok) {
        setEmail((prev) => prev || res.email);
        setName((prev) => prev || res.name || "");
        setPhase("form");
        return;
      }
      if (res.reason !== "network" && res.reason !== "offline") {
        setErrorKind(res.reason);
        setPhase("error");
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    setErrorKind("network");
    setPhase("error");
  }

  useEffect(() => {
    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function submit() {
    setFormError(null);
    const mail = email.trim().toLowerCase();
    if (!name.trim()) { setFormError("Escribe tu nombre."); return; }
    if (!mail || !mail.includes("@")) { setFormError("Introduce un email válido."); return; }
    if (password.length < 6) { setFormError("La contraseña debe tener al menos 6 caracteres."); return; }

    setPhase("creating");
    const res = await signUpEmail(mail, password, name);
    if (!res.ok) {
      setPhase("form");
      setFormError(res.error ?? "No se pudo crear la cuenta.");
      return;
    }
    // Liga este pago a la cuenta creada: no puede reutilizarse y Ajustes
    // encontrará el plan por email.
    await consumePaidSession(sessionId, mail, name.trim());
    if (res.needsConfirm) {
      setErrorKind("confirm_email");
      setPhase("error");
      return;
    }
    router.replace("/onboarding");
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="px-6 md:px-10 py-6 flex items-center justify-between">
        <Logo size="md" />
        <Link href="/login" className="flex items-center gap-1.5 text-sm text-rumbo-muted hover:text-rumbo-ink transition-colors">
          <span>←</span><span>Iniciar sesión</span>
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          {phase === "verifying" && (
            <div className="text-center">
              <div className="w-8 h-8 mx-auto border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <h1 className="text-2xl font-semibold tracking-tight mt-6">Verificando tu pago…</h1>
              <p className="text-rumbo-muted mt-2 text-sm">Un segundo, estamos confirmándolo con Stripe.</p>
            </div>
          )}

          {(phase === "form" || phase === "creating") && (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
                  ✓ Pago confirmado
                </div>
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-4">Crea tu cuenta</h1>
                <p className="text-rumbo-muted mt-2 text-sm">Último paso: elige tu contraseña y entra.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">Nombre</label>
                  <input
                    className="input w-full" placeholder="Cómo te llamas" value={name} maxLength={24}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">Email</label>
                  <input
                    type="email" autoComplete="email" className="input w-full" placeholder="tu@email.com" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">Contraseña</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"} autoComplete="new-password"
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

                {formError && (
                  <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{formError}</div>
                )}

                <button
                  onClick={submit}
                  disabled={phase === "creating"}
                  className="w-full px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm transition-colors"
                >
                  {phase === "creating" ? "Creando tu cuenta…" : "Entrar a mi cuenta →"}
                </button>
              </div>
            </>
          )}

          {phase === "error" && <ActivarError kind={errorKind} onRetry={verify} />}
        </motion.div>
      </main>
    </div>
  );
}

function ActivarError({ kind, onRetry }: { kind: string; onRetry: () => void }) {
  const copy: Record<string, { title: string; body: string }> = {
    missing: {
      title: "Enlace incompleto",
      body: "Esta página solo funciona llegando desde el pago de Stripe. Si ya tienes cuenta, inicia sesión; si aún no has pagado, hazlo desde «Crear cuenta».",
    },
    used: {
      title: "Este pago ya tiene cuenta",
      body: "Este pago ya se usó para crear una cuenta. Inicia sesión con tu email y contraseña.",
    },
    unpaid: {
      title: "Pago aún no confirmado",
      body: "Stripe todavía no confirma el cobro. Espera unos segundos y vuelve a intentarlo.",
    },
    not_found: {
      title: "No encontramos tu pago",
      body: "No hemos podido localizar este pago. Escríbenos por WhatsApp y lo arreglamos al momento.",
    },
    confirm_email: {
      title: "Confirma tu email",
      body: "Tu cuenta está creada. Confirma tu email desde el enlace que te hemos enviado y luego inicia sesión.",
    },
  };
  const { title, body } = copy[kind] ?? {
    title: "No pudimos verificarlo automáticamente",
    body: "Tu pago está a salvo, pero no hemos podido comprobarlo ahora mismo. Prueba de nuevo o escríbenos por WhatsApp y activamos tu cuenta en persona.",
  };

  return (
    <div className="text-center">
      <div className="text-4xl">{kind === "confirm_email" ? "📬" : "🤔"}</div>
      <h1 className="text-2xl font-semibold tracking-tight mt-4">{title}</h1>
      <p className="text-rumbo-muted mt-2 text-sm leading-relaxed">{body}</p>
      <div className="mt-6 flex flex-col gap-2">
        {(kind === "unpaid" || kind === "network" || kind === "" || kind === "stripe_error" || kind === "db_error") && (
          <button onClick={onRetry} className="w-full px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors">
            Volver a intentar
          </button>
        )}
        <Link href="/login" className="w-full px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-rumbo-ink font-bold text-sm transition-colors">
          Ir a iniciar sesión
        </Link>
        {kind !== "confirm_email" && kind !== "missing" && kind !== "used" && (
          <a
            href={buildSupportWhatsAppUrl("Hola, pagué Rumbo pero mi cuenta no se activó.")}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-rumbo-muted hover:underline mt-1"
          >
            Escribir por WhatsApp →
          </a>
        )}
      </div>
    </div>
  );
}
