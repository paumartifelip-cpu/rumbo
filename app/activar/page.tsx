"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { PinModal } from "@/components/PinModal";
import { useRumbo } from "@/lib/store";
import { addCustomProfile, getCurrentProfileId, Profile } from "@/lib/profiles";
import { Currency } from "@/lib/currency";
import { checkPin, markVerified, setPin } from "@/lib/pin";
import {
  clearPendingPayment,
  fetchPaidCodeByEmail,
  getPendingPayment,
  markCodeUsed,
} from "@/lib/payment";
import { pushToSupabase } from "@/lib/sync";

export default function ActivarPage() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <ActivarPageInner />
    </Suspense>
  );
}

const CREATING_LOCK_KEY = "rumbo_profile_creating";

type Step = "activating" | "pin" | "error";

function ActivarPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useRumbo();

  const [step, setStep] = useState<Step>("activating");
  const [errorMsg, setErrorMsg] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [newProfile, setNewProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (getCurrentProfileId()) { router.replace("/dashboard"); return; }

    const pending = getPendingPayment();
    const fromStripe = searchParams.get("from_stripe") === "1";

    // Fast path — Stripe just redirected us back AND we have the user's data
    // from before the checkout. Trust the redirect (Stripe doesn't redirect
    // unless payment succeeded) and provision the account immediately.
    if (fromStripe && pending?.email && pending?.name && pending?.code) {
      activateImmediately(pending.code, pending.name, pending.email, (pending.currency as Currency) ?? "EUR");
      return;
    }

    // Recovery path — no localStorage data (different device or cleared cookies).
    // Ask the user for the email they paid with and look it up.
    if (!pending?.email) {
      setErrorMsg("Introduce el email con el que pagaste para activar tu cuenta.");
      setStep("error");
      return;
    }

    // Has pending data but didn't come via ?from_stripe=1 — fall through to
    // the same fast path; the user wouldn't have pending data unless they
    // clicked "Ir a pagar" first.
    activateImmediately(pending.code, pending.name, pending.email, (pending.currency as Currency) ?? "EUR");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Provision the profile right away. Uses the data the user typed before
   * being sent to Stripe — does NOT depend on the Stripe webhook firing first.
   */
  function activateImmediately(code: string, name: string, email: string, currency: Currency) {
    if (getCurrentProfileId()) { router.replace("/dashboard"); return; }

    if (localStorage.getItem(CREATING_LOCK_KEY)) {
      // Another tab is provisioning — wait briefly then bounce to /login.
      setTimeout(() => router.replace("/login"), 1500);
      return;
    }
    localStorage.setItem(CREATING_LOCK_KEY, "1");

    let cleanName = name.trim() || "Usuario";
    let created;
    try {
      created = addCustomProfile(cleanName, currency);
    } catch (e: any) {
      // Name collision (rare race across devices) — append a numeric suffix.
      let attempt = 2;
      while (attempt < 99) {
        try {
          created = addCustomProfile(`${cleanName} ${attempt}`, currency);
          cleanName = `${cleanName} ${attempt}`;
          break;
        } catch { attempt++; }
      }
      if (!created) {
        localStorage.removeItem(CREATING_LOCK_KEY);
        setErrorMsg("No pudimos crear tu perfil. Vuelve a intentarlo desde la pantalla de perfiles.");
        setStep("error");
        return;
      }
    }
    clearPendingPayment();

    pushToSupabase(created.user_id, {
      goals: [], tasks: [], finances: [], snapshots: [], userTools: [],
      primaryCurrency: currency,
      profileMeta: {
        id: created.id, name: created.name,
        initials: created.initials, color: created.color, emoji: created.emoji,
        email,
      },
    }).catch(() => {});

    // Best-effort: if the webhook later fires (or already did), mark the code used.
    if (code) markCodeUsed(code).catch(() => {});

    setNewProfile(created);
    setStep("pin");
  }

  async function handleRecovery() {
    const email = recoveryEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setErrorMsg("Introduce un email válido.");
      return;
    }
    setBusy(true);
    setErrorMsg("");

    // Try the webhook-backed lookup. If the webhook never fires (current
    // production state) this returns null — we still recover by name + email.
    const row = await fetchPaidCodeByEmail(email);
    setBusy(false);
    if (row) {
      activateImmediately(row.code, row.name || "Usuario", email, "EUR");
      return;
    }
    setErrorMsg("No localizamos tu pago. Si acabas de pagar, espera unos segundos e inténtalo de nuevo, o vuelve a perfiles para empezar de cero.");
  }

  async function handlePinSuccess(pin: string) {
    if (!newProfile) return;
    await setPin(newProfile.id, newProfile.user_id, pin);
    markVerified(newProfile.id);
    signIn(newProfile.id);
    // The user already supplied their name + currency before checkout, so we
    // skip the onboarding wizard and drop them straight into the dashboard.
    // They can fill in financial goals later from /money or /settings.
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="px-6 md:px-10 py-6">
        <Logo size="md" />
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <AnimatePresence mode="wait">
          {step === "activating" && (
            <motion.div
              key="activating"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="text-center max-w-sm"
            >
              <div className="w-20 h-20 rounded-full mx-auto bg-emerald-50 flex items-center justify-center mb-6">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Activando tu cuenta…</h1>
              <p className="text-rumbo-muted mt-3 text-sm leading-relaxed">
                Preparando tu perfil. Solo un segundo.
              </p>
            </motion.div>
          )}

          {step === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="w-full max-w-sm"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full mx-auto bg-rose-50 flex items-center justify-center text-2xl mb-4">📩</div>
                <h1 className="text-xl font-semibold tracking-tight">Recuperar acceso</h1>
                <p className="text-sm text-rumbo-muted mt-2">{errorMsg}</p>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">
                  Tu email de pago
                </label>
                <input
                  autoFocus
                  type="email"
                  className="input w-full"
                  placeholder="nombre@ejemplo.com"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRecovery(); }}
                />
                <button
                  onClick={handleRecovery}
                  disabled={busy}
                  className="mt-3 w-full px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors disabled:opacity-60"
                >
                  {busy ? "Buscando…" : "Buscar mi pago →"}
                </button>
              </div>
              <button
                onClick={() => router.push("/login")}
                className="mt-4 w-full text-xs text-rumbo-muted hover:text-rumbo-ink py-2"
              >
                ← Volver a perfiles
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {step === "pin" && newProfile && (
        <PinModal
          profile={newProfile}
          mode="create"
          onSuccess={handlePinSuccess}
          onCancel={() => router.push("/login")}
          verify={(pin) => checkPin(newProfile.id, newProfile.user_id, pin)}
        />
      )}
    </div>
  );
}

function FullScreenSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
