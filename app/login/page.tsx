"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { PinModal } from "@/components/PinModal";
import { useRumbo } from "@/lib/store";
import {
  Profile,
  addCustomProfile,
  getAllProfiles,
  removeCustomProfile,
  syncRegistryLocally,
} from "@/lib/profiles";
import { CURRENCIES, Currency } from "@/lib/currency";
import { getSupabase } from "@/lib/supabase";
import { deleteProfileFromSupabase, pullProfileRegistry, pushToSupabase } from "@/lib/sync";
import {
  checkPin,
  clearPin,
  isPinSet,
  markVerified,
  needsPinPrompt,
  setPin,
} from "@/lib/pin";
import {
  buildStripeUrl,
  clearPendingPayment,
  generateCode,
  getPendingPayment,
  markCodeUsed,
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

// Flow states:
// null        → profile grid
// "start"     → collect name + email, then redirect to Stripe
// "verifying" → polling Supabase after Stripe redirect
// "recover"   → user enters their email to recover a lost purchase
// "create"    → payment confirmed, set final name + currency
type CreateStep = null | "start" | "verifying" | "recover" | "create";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, profile } = useRumbo();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null);
  const [pinMode, setPinMode] = useState<"enter" | "create">("enter");

  const [createStep, setCreateStep] = useState<CreateStep>(null);
  const [accessCode, setAccessCode] = useState("");
  const [paywallError, setPaywallError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCurrency, setNewCurrency] = useState<Currency>("EUR");

  useEffect(() => {
    if (profile) router.replace("/dashboard");
  }, [profile, router]);

  useEffect(() => {
    const refreshProfiles = () => {
      pullProfileRegistry().then((remote) => {
        if (!remote) return;
        syncRegistryLocally(remote);
        setProfiles(getAllProfiles());
      });
    };

    setProfiles(getAllProfiles());
    refreshProfiles();

    const supa = getSupabase();
    if (!supa) return;

    const channel = supa
      .channel("public:profiles")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, refreshProfiles)
      .subscribe();

    return () => { supa.removeChannel(channel); };
  }, []);

  // Detect return from Stripe (?from_stripe=1) and auto-verify by email.
  useEffect(() => {
    if (searchParams.get("from_stripe") !== "1") return;

    const pending = getPendingPayment();

    if (!pending?.email) {
      // localStorage lost (different device / browser) — ask for email
      setCreateStep("recover");
      return;
    }

    setNewEmail(pending.email);
    setNewName(pending.name);
    setCreateStep("verifying");

    pollForPaymentByEmail(pending.email).then((row) => {
      if (!row) {
        setPaywallError("No hemos recibido la confirmación de tu pago. Introduce tu email para buscarlo.");
        setCreateStep("recover");
        return;
      }
      setAccessCode(row.code);
      setNewName(row.name || pending.name || "");
      setCreateStep("create");
      router.replace("/login");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Profile selection ───────────────────────────────────────────────────────

  function pick(p: Profile) {
    if (!isPinSet(p.id)) {
      setPendingProfile(p);
      setPinMode("create");
      return;
    }
    if (needsPinPrompt(p.id)) {
      setPendingProfile(p);
      setPinMode("enter");
      return;
    }
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

  // ── Paywall ─────────────────────────────────────────────────────────────────

  function startPaywall() {
    setPaywallError(null);
    // Pre-fill from any interrupted pending checkout so the user doesn't retype
    const pending = getPendingPayment();
    setNewName(pending?.name || "");
    setNewEmail(pending?.email || "");
    setNewCurrency("EUR");
    setCreateStep("start");
  }

  function closePaywall() {
    setCreateStep(null);
    setPaywallError(null);
  }

  function goToStripe() {
    const name  = newName.trim();
    const email = newEmail.trim().toLowerCase();
    if (!name)  { setPaywallError("Escribe tu nombre."); return; }
    if (!email || !email.includes("@")) { setPaywallError("Introduce un email válido."); return; }
    setPaywallError(null);
    const code = generateCode();
    setAccessCode(code);
    savePendingPayment(code, name, email);
    window.location.href = buildStripeUrl(code, email);
  }

  async function verifyByEmail() {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setPaywallError("Introduce un email válido.");
      return;
    }
    setPaywallError(null);
    setCreateStep("verifying");
    const row = await pollForPaymentByEmail(email, { timeoutMs: 12000 });
    if (!row) {
      setCreateStep("recover");
      setPaywallError("No encontramos ningún pago con ese email. Si acabas de pagar, espera unos segundos e inténtalo de nuevo.");
      return;
    }
    setAccessCode(row.code);
    setNewName(row.name || newName);
    setCreateStep("create");
  }

  async function createUser() {
    const name = newName.trim();
    const code = accessCode;
    if (!name || !code) return;
    const created = addCustomProfile(name, newCurrency);
    setProfiles(getAllProfiles());
    setCreateStep(null);
    clearPendingPayment();
    pushToSupabase(created.user_id, {
      goals: [], tasks: [], finances: [], snapshots: [], userTools: [],
      primaryCurrency: newCurrency,
      profileMeta: {
        id: created.id, name: created.name,
        initials: created.initials, color: created.color, emoji: created.emoji,
      },
    }).catch(() => {});
    markCodeUsed(code).catch(() => {});
    setPendingProfile(created);
    setPinMode("create");
  }

  function deleteUser(p: Profile, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`¿Borrar el perfil "${p.name}"? Se eliminarán sus datos locales y de la nube.`)) return;
    removeCustomProfile(p.id);
    clearPin(p.id);
    deleteProfileFromSupabase(p.user_id).catch(() => {});
    setProfiles(getAllProfiles());
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="px-6 md:px-10 py-6 flex items-center justify-between">
        <Logo size="md" />
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-rumbo-muted hover:text-rumbo-ink transition-colors"
        >
          <span>←</span>
          <span>Inicio</span>
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
            ¿Quién eres?
          </h1>
          <p className="text-rumbo-muted mt-3">Elige tu perfil para continuar.</p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 md:gap-8 w-full max-w-4xl">
          {profiles.map((p, i) => (
            <ProfileCard
              key={p.id}
              profile={p}
              index={i}
              onPick={() => pick(p)}
              onDelete={(e) => deleteUser(p, e)}
            />
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
            name={newName}
            email={newEmail}
            error={paywallError}
            onNameChange={setNewName}
            onEmailChange={setNewEmail}
            onPay={goToStripe}
            onCancel={closePaywall}
          />
        )}

        {createStep === "verifying" && (
          <VerifyingModal email={newEmail} />
        )}

        {createStep === "recover" && (
          <RecoverModal
            email={newEmail}
            error={paywallError}
            onChange={setNewEmail}
            onVerify={verifyByEmail}
            onCancel={closePaywall}
          />
        )}

        {createStep === "create" && (
          <CreateProfileModal
            name={newName}
            currency={newCurrency}
            onNameChange={setNewName}
            onCurrencyChange={setNewCurrency}
            onCancel={closePaywall}
            onCreate={createUser}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Step 1: Collect name + email ─────────────────────────────────────────────

function StartCheckoutModal({
  name, email, error,
  onNameChange, onEmailChange,
  onPay, onCancel,
}: {
  name: string; email: string; error: string | null;
  onNameChange: (s: string) => void; onEmailChange: (s: string) => void;
  onPay: () => void; onCancel: () => void;
}) {
  return (
    <Overlay onClose={onCancel}>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-lg">
          ✦
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Crea tu cuenta</h2>
      </div>
      <p className="text-sm text-rumbo-muted">
        Rumbo es premium. El pago es único y el acceso es para siempre.
      </p>

      <div className="mt-6 space-y-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">
            Tu nombre
          </label>
          <input
            autoFocus
            className="input w-full"
            placeholder="Cómo quieres que te llamemos"
            value={name}
            maxLength={24}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onPay(); if (e.key === "Escape") onCancel(); }}
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">
            Tu email
          </label>
          <input
            type="email"
            className="input w-full"
            placeholder="nombre@ejemplo.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onPay(); if (e.key === "Escape") onCancel(); }}
          />
          <p className="text-[11px] text-rumbo-muted mt-1.5">
            Lo usamos para vincular tu pago con tu cuenta. Sin spam.
          </p>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      <button
        onClick={onPay}
        className="mt-5 w-full px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors"
      >
        Ir a pagar →
      </button>

      <button
        onClick={onCancel}
        className="mt-2 w-full text-xs text-rumbo-muted hover:text-rumbo-ink py-2"
      >
        Cancelar
      </button>
    </Overlay>
  );
}

// ─── Step 2: Verifying (spinner) ──────────────────────────────────────────────

function VerifyingModal({ email }: { email: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
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
        <h2 className="text-lg font-semibold">Confirmando tu pago…</h2>
        <p className="text-sm text-rumbo-muted mt-2">
          Buscando el pago de{" "}
          <span className="font-medium text-rumbo-ink">{email}</span>.{" "}
          Suele tardar unos segundos.
        </p>
      </motion.div>
    </motion.div>
  );
}

// ─── Fallback: recover by email ───────────────────────────────────────────────

function RecoverModal({
  email, error,
  onChange, onVerify, onCancel,
}: {
  email: string; error: string | null;
  onChange: (s: string) => void; onVerify: () => void; onCancel: () => void;
}) {
  return (
    <Overlay onClose={onCancel}>
      <h2 className="text-xl font-semibold tracking-tight">Recuperar acceso</h2>
      <p className="text-sm text-rumbo-muted mt-1">
        Introduce el email con el que realizaste el pago y localizaremos tu compra.
      </p>

      <input
        autoFocus
        type="email"
        className="input mt-5 w-full"
        placeholder="nombre@ejemplo.com"
        value={email}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onVerify(); if (e.key === "Escape") onCancel(); }}
      />

      {error && <ErrorBox message={error} />}

      <button
        onClick={onVerify}
        className="mt-5 w-full px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors"
      >
        Recuperar mi acceso →
      </button>

      <button
        onClick={onCancel}
        className="mt-2 w-full text-xs text-rumbo-muted hover:text-rumbo-ink py-2"
      >
        Cancelar
      </button>
    </Overlay>
  );
}

// ─── Step 3: Create profile (after payment confirmed) ─────────────────────────

function CreateProfileModal({
  name, currency,
  onNameChange, onCurrencyChange,
  onCancel, onCreate,
}: {
  name: string; currency: Currency;
  onNameChange: (s: string) => void; onCurrencyChange: (c: Currency) => void;
  onCancel: () => void; onCreate: () => void;
}) {
  return (
    <Overlay onClose={onCancel}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">✅</span>
        <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">
          Pago confirmado
        </span>
      </div>
      <h2 className="text-xl font-semibold tracking-tight">Configura tu perfil</h2>
      <p className="text-sm text-rumbo-muted mt-1">
        Confirma tu nombre y elige tu moneda. Después elegirás un PIN de acceso.
      </p>

      <input
        autoFocus
        className="input mt-5 w-full"
        placeholder="Tu nombre"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onCreate(); if (e.key === "Escape") onCancel(); }}
        maxLength={24}
      />

      <div className="mt-4">
        <div className="text-xs uppercase tracking-wider text-rumbo-muted mb-2">
          Moneda principal
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(CURRENCIES) as Currency[]).map((c) => {
            const meta = CURRENCIES[c];
            const active = currency === c;
            return (
              <button
                key={c}
                onClick={() => onCurrencyChange(c)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-left text-sm ${
                  active
                    ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="text-xl">{meta.flag}</span>
                <div className="min-w-0">
                  <div className="font-semibold leading-tight">{meta.code}</div>
                  <div className="text-[10px] text-rumbo-muted truncate">{meta.name}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 mt-5 justify-end">
        <button className="btn-ghost" onClick={onCancel}>Cancelar</button>
        <button
          className="btn-primary"
          onClick={onCreate}
          disabled={!name.trim()}
        >
          Crear y poner PIN →
        </button>
      </div>
    </Overlay>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
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

function ProfileCard({
  profile, index, onPick, onDelete,
}: {
  profile: Profile; index: number;
  onPick: () => void; onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.05 }}
      className="flex flex-col items-center group"
    >
      <motion.button
        onClick={onPick}
        whileHover={{ scale: 1.08, y: -6 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 280, damping: 18 }}
        className={`relative w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-gradient-to-br ${profile.color}
          flex items-center justify-center shadow-soft
          group-hover:shadow-card group-hover:ring-4 group-hover:ring-rumbo-ink/10
          transition-shadow ring-0 cursor-pointer`}
        aria-label={`Entrar como ${profile.name}`}
      >
        <span className="text-6xl md:text-7xl select-none drop-shadow-sm">
          {profile.emoji ?? profile.initials}
        </span>
        {isPinSet(profile.id) && (
          <span
            title="Protegido con PIN"
            className="absolute bottom-2 right-2 bg-white/95 rounded-full w-8 h-8 flex items-center justify-center text-sm shadow-card"
          >
            🔒
          </span>
        )}
        {profile.custom && (
          <button
            onClick={onDelete}
            className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border border-rumbo-line text-rumbo-muted hover:text-rose-600 hover:border-rose-200 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm shadow-card"
            aria-label="Borrar perfil"
          >
            ✕
          </button>
        )}
      </motion.button>
      <div className="mt-4 text-lg font-semibold text-rumbo-ink">{profile.name}</div>
      <button
        onClick={onPick}
        className="mt-2 px-5 py-1.5 rounded-full bg-rumbo-ink text-white text-sm font-medium opacity-90 hover:opacity-100 group-hover:bg-rumbo-green transition-colors"
      >
        Entrar →
      </button>
    </motion.div>
  );
}

function CreateCard({ index, onClick }: { index: number; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.05 }}
      className="flex flex-col items-center group"
    >
      <motion.button
        onClick={onClick}
        whileHover={{ scale: 1.08, y: -6 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 280, damping: 18 }}
        className="relative w-32 h-32 md:w-40 md:h-40 rounded-3xl border-2 border-dashed border-rumbo-line bg-rumbo-greenSoft/30 flex items-center justify-center cursor-pointer group-hover:border-rumbo-green/50 group-hover:bg-rumbo-greenSoft/60 transition-colors"
        aria-label="Crear nuevo perfil"
      >
        <span className="text-6xl md:text-7xl text-rumbo-muted group-hover:text-rumbo-green transition-colors">
          +
        </span>
      </motion.button>
      <div className="mt-4 text-lg font-semibold text-rumbo-ink">Nuevo perfil</div>
      <button
        onClick={onClick}
        className="mt-2 px-5 py-1.5 rounded-full border border-rumbo-line text-rumbo-ink text-sm font-medium hover:bg-rumbo-ink hover:text-white transition-colors"
      >
        Crear →
      </button>
    </motion.div>
  );
}
