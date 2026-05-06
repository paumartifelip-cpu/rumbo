"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
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
  fetchPaidUser,
  getPendingPayment,
  markPaidEmailUsed,
  pollForPayment,
  savePendingPayment,
} from "@/lib/payment";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, profile } = useRumbo();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null);
  const [pinMode, setPinMode] = useState<"enter" | "create">("enter");

  // Paywall flow states
  // "paywall" — explain the price + email/name fields
  // "verifying" — returned from Stripe, polling for the webhook
  // "create" — payment confirmed, ask for currency + create profile
  const [createStep, setCreateStep] = useState<null | "paywall" | "verifying" | "create">(null);

  const [payEmail, setPayEmail] = useState("");
  const [payName, setPayName] = useState("");
  const [paidEmail, setPaidEmail] = useState("");
  const [paywallError, setPaywallError] = useState<string | null>(null);
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

    const channel = supa.channel('public:profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        refreshProfiles();
      })
      .subscribe();

    return () => {
      supa.removeChannel(channel);
    };
  }, []);

  // Detect return from Stripe — `?from_stripe=1` triggers verification.
  useEffect(() => {
    if (searchParams.get("from_stripe") !== "1") return;
    const pending = getPendingPayment();
    if (!pending) {
      // No localStorage record — user paid on a different device.
      // Show paywall in "verifying" mode so they can type the email they paid with.
      setCreateStep("paywall");
      setPaywallError("Introduce el email con el que pagaste para verificar tu pago.");
      return;
    }
    setCreateStep("verifying");
    setPayEmail(pending.email);
    setPayName(pending.name);
    pollForPayment(pending.email).then((row) => {
      if (!row) {
        setPaywallError(
          "No hemos recibido tu pago aún. Si pagaste hace unos segundos, espera un momento y vuelve a intentarlo."
        );
        setCreateStep("paywall");
        return;
      }
      // Payment confirmed — move to profile creation
      setPaidEmail(row.email);
      setPayName(row.name || pending.name);
      setCreateStep("create");
      // Clean the URL so a refresh doesn't re-trigger the flow
      router.replace("/login");
    });
  }, [searchParams, router]);

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
    if (isNew) {
      setPin(pendingProfile.id, pin);
    } else {
      markVerified(pendingProfile.id);
    }
    enter(pendingProfile, isNew);
    setPendingProfile(null);
  }

  function startPaywall() {
    setPaywallError(null);
    setPayEmail("");
    setPayName("");
    setCreateStep("paywall");
  }

  function closePaywall() {
    setCreateStep(null);
    setPaywallError(null);
  }

  async function goToStripe() {
    const email = payEmail.trim().toLowerCase();
    const name = payName.trim();
    if (!email || !name) {
      setPaywallError("Necesitamos tu nombre y email para emparejar el pago.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setPaywallError("Ese email no parece válido.");
      return;
    }
    // Maybe the user already paid earlier with this email — check first.
    const existing = await fetchPaidUser(email);
    if (existing && !existing.used) {
      setPaidEmail(existing.email);
      setPayName(existing.name || name);
      setCreateStep("create");
      return;
    }
    savePendingPayment(email, name);
    window.location.href = buildStripeUrl(email);
  }

  async function verifyExistingPayment() {
    const email = payEmail.trim().toLowerCase();
    if (!email) {
      setPaywallError("Introduce el email con el que pagaste.");
      return;
    }
    setPaywallError(null);
    setCreateStep("verifying");
    const row = await pollForPayment(email, { timeoutMs: 10000 });
    if (!row) {
      setCreateStep("paywall");
      setPaywallError(
        "No hay ningún pago registrado con ese email. Si acabas de pagar espera unos segundos."
      );
      return;
    }
    setPaidEmail(row.email);
    setPayName(row.name || payName);
    setCreateStep("create");
  }

  async function createUser() {
    const name = payName.trim();
    if (!name || !paidEmail) return;
    const created = addCustomProfile(name, newCurrency);
    setProfiles(getAllProfiles());
    setCreateStep(null);
    clearPendingPayment();
    // Push the new profile metadata to Supabase immediately so it appears
    // on other devices without waiting for a full data sync.
    pushToSupabase(created.user_id, {
      goals: [], tasks: [], finances: [], snapshots: [], userTools: [],
      primaryCurrency: newCurrency,
      profileMeta: { id: created.id, name: created.name, initials: created.initials, color: created.color, emoji: created.emoji },
    }).catch(() => {});
    // Mark the paid email so it can't be used to spawn another profile.
    markPaidEmailUsed(paidEmail).catch(() => {});
    setPendingProfile(created);
    setPinMode("create");
  }

  function deleteUser(p: Profile, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`¿Borrar el usuario "${p.name}"? Se eliminarán sus datos locales y de la nube.`)) return;
    removeCustomProfile(p.id);
    clearPin(p.id);
    deleteProfileFromSupabase(p.user_id).catch(() => {});
    setProfiles(getAllProfiles());
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="px-6 md:px-10 py-6">
        <Logo size="md" />
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
          <p className="text-rumbo-muted mt-3">
            Elige tu perfil para continuar.
          </p>
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

          <CreateCard
            index={profiles.length}
            onClick={startPaywall}
          />
        </div>

        <p className="text-xs text-rumbo-muted mt-12 max-w-md text-center">
          Cada perfil tiene su PIN. Si pasan 7 días sin entrar te lo pediremos
          de nuevo. Mientras lo uses a menudo, entrarás directo.
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
        {createStep === "paywall" && (
          <PaywallModal
            email={payEmail}
            name={payName}
            error={paywallError}
            onEmailChange={setPayEmail}
            onNameChange={setPayName}
            onCancel={closePaywall}
            onPay={goToStripe}
            onVerifyExisting={verifyExistingPayment}
          />
        )}

        {createStep === "verifying" && (
          <VerifyingModal email={payEmail} />
        )}

        {createStep === "create" && (
          <CreateProfileModal
            email={paidEmail}
            name={payName}
            currency={newCurrency}
            onNameChange={setPayName}
            onCurrencyChange={setNewCurrency}
            onCancel={closePaywall}
            onCreate={createUser}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Paywall Modal ────────────────────────────────────────────────────────────

function PaywallModal({
  email,
  name,
  error,
  onEmailChange,
  onNameChange,
  onCancel,
  onPay,
  onVerifyExisting,
}: {
  email: string;
  name: string;
  error: string | null;
  onEmailChange: (s: string) => void;
  onNameChange: (s: string) => void;
  onCancel: () => void;
  onPay: () => void;
  onVerifyExisting: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-lg">
            🔓
          </div>
          <h2 className="text-xl font-semibold tracking-tight">
            Crear tu perfil
          </h2>
        </div>
        <p className="text-sm text-rumbo-muted">
          Rumbo es una app premium. Para crear tu propio perfil con todas las
          funciones, completa el pago único. Después podrás entrar todas las
          veces que quieras.
        </p>

        <div className="mt-5 space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-rumbo-muted">Tu nombre</label>
            <input
              autoFocus
              className="input mt-1 w-full"
              placeholder="Cómo te llamas"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              maxLength={24}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-rumbo-muted">Tu email</label>
            <input
              type="email"
              className="input mt-1 w-full"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
            />
            <div className="text-[11px] text-rumbo-muted mt-1.5">
              Usaremos este email para emparejar tu pago. Debe ser el mismo
              que introduzcas en Stripe.
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        <button
          onClick={onPay}
          className="mt-5 w-full px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors"
        >
          Pagar y desbloquear →
        </button>

        <div className="mt-3 text-center">
          <button
            onClick={onVerifyExisting}
            className="text-xs text-rumbo-muted hover:text-rumbo-ink underline"
          >
            Ya pagué — verificar mi email
          </button>
        </div>

        <button
          onClick={onCancel}
          className="mt-2 w-full text-xs text-rumbo-muted hover:text-rumbo-ink py-2"
        >
          Cancelar
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Verifying Modal ──────────────────────────────────────────────────────────

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
        <h2 className="text-lg font-semibold">Verificando tu pago…</h2>
        <p className="text-sm text-rumbo-muted mt-2">
          Buscamos el pago asociado a <span className="font-medium">{email}</span>.
          Suele tardar unos segundos.
        </p>
      </motion.div>
    </motion.div>
  );
}

// ─── Create Profile Modal (after payment) ─────────────────────────────────────

function CreateProfileModal({
  email,
  name,
  currency,
  onNameChange,
  onCurrencyChange,
  onCancel,
  onCreate,
}: {
  email: string;
  name: string;
  currency: Currency;
  onNameChange: (s: string) => void;
  onCurrencyChange: (c: Currency) => void;
  onCancel: () => void;
  onCreate: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">✅</span>
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">
            Pago confirmado
          </span>
        </div>
        <h2 className="text-xl font-semibold tracking-tight">
          Crea tu perfil
        </h2>
        <p className="text-sm text-rumbo-muted mt-1">
          Bienvenido a Rumbo, <span className="font-medium">{email}</span>.
          Después elegirás un PIN.
        </p>
        <input
          autoFocus
          className="input mt-5 w-full"
          placeholder="Tu nombre"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCreate();
            if (e.key === "Escape") onCancel();
          }}
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
                    <div className="font-semibold leading-tight">
                      {meta.code}
                    </div>
                    <div className="text-[10px] text-rumbo-muted truncate">
                      {meta.name}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button className="btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={onCreate}
            disabled={!name.trim()}
          >
            Crear y poner PIN →
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Profile / Create cards (unchanged) ───────────────────────────────────────

function ProfileCard({
  profile,
  index,
  onPick,
  onDelete,
}: {
  profile: Profile;
  index: number;
  onPick: () => void;
  onDelete: (e: React.MouseEvent) => void;
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
      <div className="mt-4 text-lg font-semibold text-rumbo-ink">
        {profile.name}
      </div>
      <button
        onClick={onPick}
        className="mt-2 px-5 py-1.5 rounded-full bg-rumbo-ink text-white text-sm font-medium opacity-90 hover:opacity-100 group-hover:bg-rumbo-green transition-colors"
      >
        Entrar →
      </button>
    </motion.div>
  );
}

function CreateCard({
  index,
  onClick,
}: {
  index: number;
  onClick: () => void;
}) {
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
      <div className="mt-4 text-lg font-semibold text-rumbo-ink">
        Nuevo perfil
      </div>
      <button
        onClick={onClick}
        className="mt-2 px-5 py-1.5 rounded-full border border-rumbo-line text-rumbo-ink text-sm font-medium hover:bg-rumbo-ink hover:text-white transition-colors"
      >
        Crear →
      </button>
    </motion.div>
  );
}
