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
  generateCode,
  getPendingPayment,
  markCodeUsed,
  normalizeCode,
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
  // "intro"     — explain the price, show the user-generated code + Stripe button
  // "verifying" — returned from Stripe (or pressed "Ya pagué"), polling for the webhook
  // "redeem"    — manual entry: user types the code they have
  // "create"    — payment confirmed, ask for name + currency to create profile
  const [createStep, setCreateStep] = useState<null | "intro" | "verifying" | "redeem" | "create">(null);

  const [accessCode, setAccessCode] = useState(""); // current code (generated or typed)
  const [paywallError, setPaywallError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
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
      setCreateStep("redeem");
      setPaywallError("Introduce el código que generaste antes de pagar.");
      return;
    }
    setCreateStep("verifying");
    setAccessCode(pending.code);
    setNewName(pending.name);
    pollForPayment(pending.code).then((row) => {
      if (!row) {
        setPaywallError(
          "Aún no hemos recibido confirmación de Stripe. Espera unos segundos y vuelve a intentarlo."
        );
        setCreateStep("intro");
        return;
      }
      setNewName(row.name || pending.name || "");
      setCreateStep("create");
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
    setNewName("");
    setNewCurrency("EUR");
    // Reuse a pending code if there's one in localStorage; otherwise generate
    // a fresh one. This way, if the user closes the modal mid-purchase, they
    // can resume with the same code.
    const pending = getPendingPayment();
    setAccessCode(pending?.code || generateCode());
    setCreateStep("intro");
  }

  function closePaywall() {
    setCreateStep(null);
    setPaywallError(null);
  }

  function regenerateCode() {
    const fresh = generateCode();
    setAccessCode(fresh);
    setPaywallError(null);
  }

  function goToStripe() {
    if (!accessCode) {
      setPaywallError("No hay código generado.");
      return;
    }
    savePendingPayment(accessCode, newName);
    window.location.href = buildStripeUrl(accessCode);
  }

  function openRedeem() {
    setPaywallError(null);
    setAccessCode("");
    setCreateStep("redeem");
  }

  async function verifyTypedCode() {
    const code = normalizeCode(accessCode);
    if (!code) {
      setPaywallError("Introduce tu código de 8 caracteres.");
      return;
    }
    setPaywallError(null);
    setCreateStep("verifying");
    const row = await pollForPayment(code, { timeoutMs: 12000 });
    if (!row) {
      setCreateStep("redeem");
      setPaywallError(
        "Ese código no se ha pagado todavía. Si acabas de pagar, espera unos segundos."
      );
      return;
    }
    setAccessCode(code);
    setNewName(row.name || newName);
    setCreateStep("create");
  }

  async function createUser() {
    const name = newName.trim();
    const code = normalizeCode(accessCode);
    if (!name || !code) return;
    const created = addCustomProfile(name, newCurrency);
    setProfiles(getAllProfiles());
    setCreateStep(null);
    clearPendingPayment();
    pushToSupabase(created.user_id, {
      goals: [], tasks: [], finances: [], snapshots: [], userTools: [],
      primaryCurrency: newCurrency,
      profileMeta: { id: created.id, name: created.name, initials: created.initials, color: created.color, emoji: created.emoji },
    }).catch(() => {});
    markCodeUsed(code).catch(() => {});
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
        {createStep === "intro" && (
          <PaywallIntroModal
            code={accessCode}
            error={paywallError}
            onRegenerate={regenerateCode}
            onPay={goToStripe}
            onRedeem={openRedeem}
            onCancel={closePaywall}
          />
        )}

        {createStep === "redeem" && (
          <RedeemModal
            code={accessCode}
            error={paywallError}
            onChange={(v) => setAccessCode(v)}
            onVerify={verifyTypedCode}
            onBack={() => {
              setCreateStep("intro");
              setPaywallError(null);
              if (!accessCode) setAccessCode(generateCode());
            }}
            onCancel={closePaywall}
          />
        )}

        {createStep === "verifying" && (
          <VerifyingModal code={accessCode} />
        )}

        {createStep === "create" && (
          <CreateProfileModal
            code={accessCode}
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

// ─── Paywall Intro Modal ──────────────────────────────────────────────────────

function PaywallIntroModal({
  code,
  error,
  onRegenerate,
  onPay,
  onRedeem,
  onCancel,
}: {
  code: string;
  error: string | null;
  onRegenerate: () => void;
  onPay: () => void;
  onRedeem: () => void;
  onCancel: () => void;
}) {
  const [copied, setCopied] = useState(false);
  function copyCode() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    }
  }
  // Display formatted as XXXX-XXXX for readability.
  const display = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;

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
            Crear perfil premium
          </h2>
        </div>
        <p className="text-sm text-rumbo-muted">
          Rumbo es una app premium. Para crear tu propio perfil con todas las
          funciones, completa el pago único y obtendrás acceso ilimitado.
        </p>

        <div className="mt-5 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-1">
            Tu código de acceso
          </div>
          <div className="flex items-center justify-between gap-3">
            <code className="text-2xl font-mono font-bold tracking-[0.2em] text-emerald-900 select-all">
              {display}
            </code>
            <div className="flex gap-1">
              <button
                onClick={copyCode}
                className="px-2.5 py-1.5 rounded-lg bg-white text-emerald-700 text-[11px] font-bold uppercase tracking-wider hover:bg-emerald-100 transition-colors border border-emerald-200"
                title="Copiar código"
              >
                {copied ? "✓" : "📋"}
              </button>
              <button
                onClick={onRegenerate}
                className="px-2.5 py-1.5 rounded-lg bg-white text-emerald-700 text-[11px] font-bold uppercase tracking-wider hover:bg-emerald-100 transition-colors border border-emerald-200"
                title="Generar otro"
              >
                ↻
              </button>
            </div>
          </div>
          <div className="text-[11px] text-emerald-700/80 mt-2.5 leading-relaxed">
            Anótalo o cópialo. Lo necesitarás después del pago para crear tu
            perfil. Lo guardaremos en este navegador automáticamente.
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
            onClick={onRedeem}
            className="text-xs text-rumbo-muted hover:text-rumbo-ink underline"
          >
            Ya tengo un código pagado
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

// ─── Redeem (manual code entry) Modal ─────────────────────────────────────────

function RedeemModal({
  code,
  error,
  onChange,
  onVerify,
  onBack,
  onCancel,
}: {
  code: string;
  error: string | null;
  onChange: (s: string) => void;
  onVerify: () => void;
  onBack: () => void;
  onCancel: () => void;
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
        <h2 className="text-xl font-semibold tracking-tight">
          Canjear código
        </h2>
        <p className="text-sm text-rumbo-muted mt-1">
          Introduce el código de 8 caracteres que generaste cuando pagaste.
        </p>

        <input
          autoFocus
          className="input mt-5 w-full text-lg font-mono tracking-widest text-center uppercase"
          placeholder="XXXX-XXXX"
          value={code}
          maxLength={9}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onVerify();
            if (e.key === "Escape") onCancel();
          }}
        />

        {error && (
          <div className="mt-3 text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        <button
          onClick={onVerify}
          className="mt-5 w-full px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors"
        >
          Verificar →
        </button>

        <div className="mt-3 flex justify-between">
          <button
            onClick={onBack}
            className="text-xs text-rumbo-muted hover:text-rumbo-ink underline"
          >
            ← No tengo código aún
          </button>
          <button
            onClick={onCancel}
            className="text-xs text-rumbo-muted hover:text-rumbo-ink"
          >
            Cancelar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Verifying Modal ──────────────────────────────────────────────────────────

function VerifyingModal({ code }: { code: string }) {
  const display = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
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
          Buscamos el código <code className="font-mono font-bold tracking-wider">{display}</code>.
          Suele tardar unos segundos.
        </p>
      </motion.div>
    </motion.div>
  );
}

// ─── Create Profile Modal (after payment) ─────────────────────────────────────

function CreateProfileModal({
  code,
  name,
  currency,
  onNameChange,
  onCurrencyChange,
  onCancel,
  onCreate,
}: {
  code: string;
  name: string;
  currency: Currency;
  onNameChange: (s: string) => void;
  onCurrencyChange: (c: Currency) => void;
  onCancel: () => void;
  onCreate: () => void;
}) {
  const display = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
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
          Código <code className="font-mono font-bold">{display}</code> verificado.
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

// ─── Profile / Create cards ───────────────────────────────────────────────────

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
