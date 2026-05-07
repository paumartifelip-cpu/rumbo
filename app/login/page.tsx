"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { PinModal } from "@/components/PinModal";
import { useRumbo } from "@/lib/store";
import {
  Profile,
  getAllProfiles,
  getCurrentProfileId,
  removeCustomProfile,
  syncRegistryLocally,
} from "@/lib/profiles";
import { CURRENCIES, Currency } from "@/lib/currency";
import { getSupabase } from "@/lib/supabase";
import { deleteProfileFromSupabase, pullProfileRegistry } from "@/lib/sync";
import { checkPin, clearPin, isPinSet, markVerified, needsPinPrompt, setPin } from "@/lib/pin";
import {
  buildStripeUrl,
  generateCode,
  getPendingPayment,
  pollForPaymentByEmail,
  savePendingPayment,
} from "@/lib/payment";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

type CreateStep = null | "start" | "verifying";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, profile } = useRumbo();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null);
  const [pinMode, setPinMode] = useState<"enter" | "create">("enter");

  const [createStep, setCreateStep] = useState<CreateStep>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCurrency, setNewCurrency] = useState<Currency>("EUR");

  const stripeTabRef = useRef<Window | null>(null);

  useEffect(() => {
    if (profile) router.replace("/dashboard");
  }, [profile, router]);

  // If Stripe redirected back here, forward straight to /activar.
  useEffect(() => {
    if (searchParams.get("from_stripe") !== "1") return;
    if (getCurrentProfileId()) { router.replace("/dashboard"); return; }
    router.replace("/activar");
  }, [searchParams, router]);

  useEffect(() => {
    const refresh = () => {
      pullProfileRegistry().then((remote) => {
        if (!remote) return;
        syncRegistryLocally(remote);
        setProfiles(getAllProfiles());
      });
    };
    setProfiles(getAllProfiles());
    refresh();

    const supa = getSupabase();
    if (!supa) return;
    const channel = supa
      .channel("public:profiles")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, refresh)
      .subscribe();
    return () => { supa.removeChannel(channel); };
  }, []);

  // ── Existing profile selection ──────────────────────────────────────────────

  function pick(p: Profile) {
    if (!isPinSet(p.id)) { setPendingProfile(p); setPinMode("create"); return; }
    if (needsPinPrompt(p.id)) { setPendingProfile(p); setPinMode("enter"); return; }
    enter(p);
  }

  function enter(p: Profile, isNew = false) {
    markVerified(p.id);
    signIn(p.id);
    router.push(isNew ? "/onboarding" : "/dashboard");
  }

  function handlePinSuccess(pin: string) {
    if (!pendingProfile) return;
    const isNew = pinMode === "create";
    if (isNew) setPin(pendingProfile.id, pin);
    else markVerified(pendingProfile.id);
    enter(pendingProfile, isNew);
    setPendingProfile(null);
  }

  function deleteUser(p: Profile, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`¿Borrar el perfil "${p.name}"? Se eliminarán sus datos locales y de la nube.`)) return;
    removeCustomProfile(p.id);
    clearPin(p.id);
    deleteProfileFromSupabase(p.user_id).catch(() => {});
    setProfiles(getAllProfiles());
  }

  // ── New profile (paywall) ───────────────────────────────────────────────────

  function startPaywall() {
    setFormError(null);
    const pending = getPendingPayment();
    setNewName(pending?.name || "");
    setNewEmail(pending?.email || "");
    setNewCurrency("EUR");
    setCreateStep("start");
  }

  function closePaywall() {
    stripeTabRef.current?.close();
    stripeTabRef.current = null;
    setCreateStep(null);
    setFormError(null);
  }

  function goToStripe() {
    const name  = newName.trim();
    const email = newEmail.trim().toLowerCase();
    if (!name)  { setFormError("Escribe tu nombre."); return; }
    if (!email || !email.includes("@")) { setFormError("Introduce un email válido."); return; }

    setFormError(null);
    localStorage.removeItem("rumbo_profile_creating");
    const code = generateCode();
    savePendingPayment(code, name, email, newCurrency);

    // Open Stripe in a new tab.
    // When Stripe is configured to redirect to /activar?from_stripe=1 that tab
    // handles the full activation. Meanwhile this tab polls as backup.
    const tab = window.open(buildStripeUrl(code, email), "_blank");
    if (!tab) {
      // Popup blocked — go to Stripe in this tab (will return via redirect).
      window.location.href = buildStripeUrl(code, email);
      return;
    }
    stripeTabRef.current = tab;
    setCreateStep("verifying");

    // Backup polling: if payment found here, navigate to /activar.
    pollForPaymentByEmail(email, { timeoutMs: 300000 }).then((row) => {
      if (!row) return; // timeout or user cancelled — they can go to /activar manually
      stripeTabRef.current?.close();
      router.push("/activar");
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="px-6 md:px-10 py-6 flex items-center justify-between">
        <Logo size="md" />
        <Link href="/" className="flex items-center gap-1.5 text-sm text-rumbo-muted hover:text-rumbo-ink transition-colors">
          <span>←</span><span>Inicio</span>
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">¿Quién eres?</h1>
          <p className="text-rumbo-muted mt-3">Elige tu perfil para continuar.</p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 md:gap-8 w-full max-w-4xl">
          {profiles.map((p, i) => (
            <ProfileCard key={p.id} profile={p} index={i} onPick={() => pick(p)} onDelete={(e) => deleteUser(p, e)} />
          ))}
          <CreateCard index={profiles.length} onClick={startPaywall} />
        </div>

        <p className="text-xs text-rumbo-muted mt-12 max-w-md text-center">
          Cada perfil tiene su PIN. Si pasan 7 días sin entrar te lo pediremos de nuevo.
        </p>
      </main>

      {pendingProfile && (
        <PinModal
          profile={pendingProfile}
          mode={pinMode}
          onSuccess={handlePinSuccess}
          onCancel={() => setPendingProfile(null)}
          verify={(pin) => checkPin(pendingProfile.id, pin)}
        />
      )}

      <AnimatePresence>
        {createStep === "start" && (
          <StartCheckoutModal
            name={newName} email={newEmail} currency={newCurrency} error={formError}
            onNameChange={setNewName} onEmailChange={setNewEmail} onCurrencyChange={setNewCurrency}
            onPay={goToStripe} onCancel={closePaywall}
          />
        )}
        {createStep === "verifying" && (
          <VerifyingModal email={newEmail} onCancel={closePaywall} onActivar={() => router.push("/activar")} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Checkout form ────────────────────────────────────────────────────────────

function StartCheckoutModal({
  name, email, currency, error,
  onNameChange, onEmailChange, onCurrencyChange,
  onPay, onCancel,
}: {
  name: string; email: string; currency: Currency; error: string | null;
  onNameChange: (s: string) => void; onEmailChange: (s: string) => void;
  onCurrencyChange: (c: Currency) => void;
  onPay: () => void; onCancel: () => void;
}) {
  return (
    <Overlay onClose={onCancel}>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-lg">✦</div>
        <h2 className="text-xl font-semibold tracking-tight">Crea tu cuenta</h2>
      </div>
      <p className="text-sm text-rumbo-muted">Suscripción mensual · Cancela cuando quieras.</p>

      <div className="mt-5 space-y-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">Nombre</label>
          <input
            autoFocus className="input w-full" placeholder="Cómo quieres que te llamemos"
            value={name} maxLength={24}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onPay(); if (e.key === "Escape") onCancel(); }}
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">Email</label>
          <input
            type="email" className="input w-full" placeholder="nombre@ejemplo.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onPay(); if (e.key === "Escape") onCancel(); }}
          />
          <p className="text-[11px] text-rumbo-muted mt-1">Lo usamos para activar tu cuenta tras el pago.</p>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-2">Moneda principal</label>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
              <button
                key={c} onClick={() => onCurrencyChange(c)}
                className={`flex flex-col items-center py-2 rounded-xl border transition-all text-sm ${
                  currency === c
                    ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="text-xl">{CURRENCIES[c].flag}</span>
                <span className="text-[11px] font-semibold mt-0.5">{CURRENCIES[c].code}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      <button onClick={onPay} className="mt-5 w-full px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors">
        Ir a pagar →
      </button>
      <button onClick={onCancel} className="mt-2 w-full text-xs text-rumbo-muted hover:text-rumbo-ink py-2">Cancelar</button>
    </Overlay>
  );
}

// ─── Waiting modal ────────────────────────────────────────────────────────────

function VerifyingModal({ email, onCancel, onActivar }: {
  email: string; onCancel: () => void; onActivar: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm text-center"
      >
        <div className="w-14 h-14 rounded-full mx-auto bg-emerald-50 flex items-center justify-center mb-4">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <h2 className="text-lg font-semibold">Esperando tu pago…</h2>
        <p className="text-sm text-rumbo-muted mt-2">
          Paga en la otra pestaña con{" "}
          <span className="font-medium text-rumbo-ink">{email}</span>. En cuanto
          Stripe confirme, esta pantalla avanzará sola.
        </p>
        <p className="text-xs text-rumbo-muted mt-3">No cierres esta ventana.</p>
        <button
          onClick={onActivar}
          className="mt-5 w-full px-4 py-2.5 rounded-xl border border-rumbo-line text-sm font-medium text-rumbo-ink hover:bg-slate-50 transition-colors"
        >
          Ya pagué → Continuar aquí
        </button>
        <button onClick={onCancel} className="mt-2 text-xs text-rumbo-muted hover:text-rumbo-ink underline">
          Cancelar
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mt-4 text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
      {message}
    </div>
  );
}

// ─── Profile / Create cards ───────────────────────────────────────────────────

function ProfileCard({ profile, index, onPick, onDelete }: {
  profile: Profile; index: number; onPick: () => void; onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.05 }}
      className="flex flex-col items-center group"
    >
      <motion.button
        onClick={onPick}
        whileHover={{ scale: 1.08, y: -6 }} whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 280, damping: 18 }}
        className={`relative w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-gradient-to-br ${profile.color}
          flex items-center justify-center shadow-soft
          group-hover:shadow-card group-hover:ring-4 group-hover:ring-rumbo-ink/10
          transition-shadow ring-0 cursor-pointer`}
        aria-label={`Entrar como ${profile.name}`}
      >
        <span className="text-6xl md:text-7xl select-none drop-shadow-sm">{profile.emoji ?? profile.initials}</span>
        {isPinSet(profile.id) && (
          <span title="Protegido con PIN" className="absolute bottom-2 right-2 bg-white/95 rounded-full w-8 h-8 flex items-center justify-center text-sm shadow-card">🔒</span>
        )}
        {profile.custom && (
          <button
            onClick={onDelete}
            className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border border-rumbo-line text-rumbo-muted hover:text-rose-600 hover:border-rose-200 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm shadow-card"
            aria-label="Borrar perfil"
          >✕</button>
        )}
      </motion.button>
      <div className="mt-4 text-lg font-semibold text-rumbo-ink">{profile.name}</div>
      <button onClick={onPick} className="mt-2 px-5 py-1.5 rounded-full bg-rumbo-ink text-white text-sm font-medium opacity-90 hover:opacity-100 group-hover:bg-rumbo-green transition-colors">
        Entrar →
      </button>
    </motion.div>
  );
}

function CreateCard({ index, onClick }: { index: number; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.05 }}
      className="flex flex-col items-center group"
    >
      <motion.button
        onClick={onClick}
        whileHover={{ scale: 1.08, y: -6 }} whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 280, damping: 18 }}
        className="relative w-32 h-32 md:w-40 md:h-40 rounded-3xl border-2 border-dashed border-rumbo-line bg-rumbo-greenSoft/30 flex items-center justify-center cursor-pointer group-hover:border-rumbo-green/50 group-hover:bg-rumbo-greenSoft/60 transition-colors"
        aria-label="Crear nuevo perfil"
      >
        <span className="text-6xl md:text-7xl text-rumbo-muted group-hover:text-rumbo-green transition-colors">+</span>
      </motion.button>
      <div className="mt-4 text-lg font-semibold text-rumbo-ink">Nuevo perfil</div>
      <button onClick={onClick} className="mt-2 px-5 py-1.5 rounded-full border border-rumbo-line text-rumbo-ink text-sm font-medium hover:bg-rumbo-ink hover:text-white transition-colors">
        Crear →
      </button>
    </motion.div>
  );
}
