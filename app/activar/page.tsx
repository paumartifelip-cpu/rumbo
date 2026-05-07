"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { PinModal } from "@/components/PinModal";
import { useRumbo } from "@/lib/store";
import { addCustomProfile, getAllProfiles, getCurrentProfileId, Profile } from "@/lib/profiles";
import { Currency } from "@/lib/currency";
import {
  checkPin,
  markVerified,
  setPin,
} from "@/lib/pin";
import {
  clearPendingPayment,
  getPendingPayment,
  markCodeUsed,
  PaidCode,
  pollForPaymentByEmail,
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

type Step = "polling" | "pin" | "error";

function ActivarPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useRumbo();

  const [step, setStep] = useState<Step>("polling");
  const [errorMsg, setErrorMsg] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [newProfile, setNewProfile] = useState<Profile | null>(null);

  useEffect(() => {
    // If there's already a session, profile was created — go straight to app.
    if (getCurrentProfileId()) { router.replace("/dashboard"); return; }

    const pending = getPendingPayment();
    const email = pending?.email || searchParams.get("email") || "";

    if (!email) {
      setErrorMsg("No encontramos ninguna compra pendiente. Vuelve a la pantalla de perfiles.");
      setStep("error");
      return;
    }

    activate(email, pending?.name || "", (pending?.currency as Currency) ?? "EUR");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function activate(email: string, fallbackName: string, currency: Currency) {
    setStep("polling");

    const row = await pollForPaymentByEmail(email, { timeoutMs: 120000 });
    if (!row) {
      setErrorMsg("No recibimos confirmación del pago. Introduce tu email para intentarlo de nuevo.");
      setRecoveryEmail(email);
      setStep("error");
      return;
    }

    createProfile(row, fallbackName, currency);
  }

  function createProfile(row: PaidCode, fallbackName: string, currency: Currency) {
    if (getCurrentProfileId()) { router.replace("/dashboard"); return; }
    if (localStorage.getItem(CREATING_LOCK_KEY)) { setStep("pin"); return; }
    localStorage.setItem(CREATING_LOCK_KEY, "1");

    const name = (row.name || fallbackName || "").trim() || "Usuario";
    const created = addCustomProfile(name, currency);
    clearPendingPayment();

    pushToSupabase(created.user_id, {
      goals: [], tasks: [], finances: [], snapshots: [], userTools: [],
      primaryCurrency: currency,
      profileMeta: {
        id: created.id, name: created.name,
        initials: created.initials, color: created.color, emoji: created.emoji,
      },
    }).catch(() => {});
    markCodeUsed(row.code).catch(() => {});

    setNewProfile(created);
    setStep("pin");
  }

  function handlePinSuccess(pin: string) {
    if (!newProfile) return;
    setPin(newProfile.id, pin);
    markVerified(newProfile.id);
    signIn(newProfile.id);
    router.push("/onboarding");
  }

  async function retryWithEmail() {
    const email = recoveryEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    await activate(email, "", "EUR");
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="px-6 md:px-10 py-6">
        <Logo size="md" />
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <AnimatePresence mode="wait">
          {step === "polling" && (
            <motion.div
              key="polling"
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
                Estamos confirmando tu pago con Stripe.<br />
                Solo tardará unos segundos.
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
                <div className="w-16 h-16 rounded-full mx-auto bg-rose-50 flex items-center justify-center text-2xl mb-4">⚠️</div>
                <h1 className="text-xl font-semibold tracking-tight">No encontramos tu pago</h1>
                <p className="text-sm text-rumbo-muted mt-2">{errorMsg}</p>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">
                  Tu email de pago
                </label>
                <input
                  type="email"
                  className="input w-full"
                  placeholder="nombre@ejemplo.com"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") retryWithEmail(); }}
                />
                <button
                  onClick={retryWithEmail}
                  className="mt-3 w-full px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors"
                >
                  Buscar mi pago →
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
          verify={(pin) => checkPin(newProfile.id, pin)}
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
