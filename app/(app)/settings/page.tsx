"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/Card";
import { SettingsAccordion } from "@/components/SettingsAccordion";
import { PinModal } from "@/components/PinModal";
import { useFormatMoney, useRumbo } from "@/lib/store";
import { supabaseEnabled } from "@/lib/supabase";
import { CURRENCIES, Currency } from "@/lib/currency";
import {
  PIN_THRESHOLD_DAYS,
  checkPin,
  clearPin,
  isPinSet,
  setPin,
} from "@/lib/pin";
import { verifyOpenAI } from "@/lib/gemini";
import { RumboWrapped } from "@/components/RumboWrapped";

const KEY_STORAGE = "rumbo_gemini_key";
const KEY_STORAGE_GPT = "rumbo_gpt_key";

export default function SettingsPage() {
  const router = useRouter();
  const {
    user,
    resetDemo,
    onboarding,
    snapshots,
    profile,
    signOut,
    primaryCurrency,
    setPrimaryCurrency,
  } = useRumbo();

  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<"idle" | "asking" | "wiping">("idle");

  function toggleSection(id: string) {
    setActiveSection((prev) => (prev === id ? null : id));
  }

  // Latest snapshot total = the same figure shown in the money evolution chart
  const latestTotal = snapshots.length
    ? [...snapshots].sort((a, b) => +new Date(b.date) - +new Date(a.date))[0].total
    : onboarding?.current_money ?? null;
  const formatMoney = useFormatMoney();
  const [apiKey, setApiKey] = useState("");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const [gptKey, setGptKey] = useState("");
  const [savedGptKey, setSavedGptKey] = useState<string | null>(null);
  const [showGptKey, setShowGptKey] = useState(false);
  const [savedGptHint, setSavedGptHint] = useState<string | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<null | "loading" | "ok" | "error">(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [pinModal, setPinModal] = useState<null | "create" | "change">(null);
  const [pinHasValue, setPinHasValue] = useState(false);
  const [pinHint, setPinHint] = useState<string | null>(null);
  const [showWrapped, setShowWrapped] = useState(false);

  useEffect(() => {
    const k = localStorage.getItem(KEY_STORAGE);
    if (k) {
      setSavedKey(k);
      setApiKey(k);
    }
    const gpt_k = localStorage.getItem(KEY_STORAGE_GPT);
    if (gpt_k) {
      setSavedGptKey(gpt_k);
      setGptKey(gpt_k);
    }
    if (profile) setPinHasValue(isPinSet(profile.id));
  }, [profile]);

  function handleSetPin(pin: string) {
    if (!profile) return;
    setPin(profile.id, pin);
    setPinHasValue(true);
    setPinModal(null);
    setPinHint("PIN guardado");
    setTimeout(() => setPinHint(null), 2500);
  }

  function handleRemovePin() {
    if (!profile) return;
    if (!confirm("¿Quitar el PIN de esta cuenta? Cualquiera podrá entrar.")) return;
    clearPin(profile.id);
    setPinHasValue(false);
    setPinHint("PIN eliminado");
    setTimeout(() => setPinHint(null), 2500);
  }

  function saveKey() {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      localStorage.removeItem(KEY_STORAGE);
      setSavedKey(null);
      setSavedHint("Clave eliminada");
    } else {
      localStorage.setItem(KEY_STORAGE, trimmed);
      setSavedKey(trimmed);
      setSavedHint("Clave guardada en este navegador");
    }
    setTimeout(() => setSavedHint(null), 2500);
  }

  function saveGptKey() {
    const trimmed = gptKey.trim();
    if (!trimmed) {
      localStorage.removeItem(KEY_STORAGE_GPT);
      setSavedGptKey(null);
      setSavedGptHint("Clave OpenAI eliminada");
    } else {
      localStorage.setItem(KEY_STORAGE_GPT, trimmed);
      setSavedGptKey(trimmed);
      setSavedGptHint("Clave OpenAI guardada en este navegador");
    }
    setTimeout(() => setSavedGptHint(null), 2500);
  }

  return (
    <div>
      <PageHeader title="Ajustes" subtitle="Tu cuenta, IA y plan." />

      <div className="flex flex-col gap-3">

        {/* ── Rumbo Wrapped ────────────────────────────────── */}
        <button
          onClick={() => setShowWrapped(true)}
          className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 text-white p-5 flex items-center gap-4 hover:scale-[1.01] active:scale-[0.99] transition-transform shadow-lg"
        >
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl shrink-0">🎬</div>
          <div className="text-left relative z-10">
            <div className="font-black text-base">Mi Rumbo Wrapped</div>
            <div className="text-white/70 text-xs mt-0.5">Tu resumen personal al estilo Spotify. Genera uno ahora.</div>
          </div>
          <div className="ml-auto text-white/60 text-xl relative z-10">›</div>
        </button>

        <SettingsAccordion
          id="currency"
          title="Moneda principal"
          icon="🌍"
          hint="Todos los totales se mostrarán en esta moneda. Puedes elegir otra al añadir un gasto."
          activeId={activeSection}
          onToggle={toggleSection}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.keys(CURRENCIES) as Currency[]).map((c) => {
              const meta = CURRENCIES[c];
              const active = primaryCurrency === c;
              return (
                <button
                  key={c}
                  onClick={() => setPrimaryCurrency(c)}
                  className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border transition-all ${
                    active
                      ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:-translate-y-0.5"
                  }`}
                >
                  <span className="text-2xl">{meta.flag}</span>
                  <span className="text-xs font-semibold">
                    {meta.code}
                  </span>
                  <span className="text-[10px] text-rumbo-muted text-center leading-tight">
                    {meta.name}
                  </span>
                </button>
              );
            })}
          </div>
        </SettingsAccordion>

        <SettingsAccordion
          id="ai"
          title="Inteligencia artificial"
          icon="🤖"
          hint="La IA categoriza tus gastos y prioriza tus tareas automáticamente."
          activeId={activeSection}
          onToggle={toggleSection}
        >
          {(() => {
            const builtinKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
            const hasBuiltin = !!builtinKey;
            const hasManual = !!savedGptKey;
            const aiActive = hasBuiltin || hasManual;

            async function handleVerify() {
              setVerifyStatus("loading");
              setVerifyMsg(null);
              const result = await verifyOpenAI();
              if (result === "ok") {
                setVerifyStatus("ok");
                setVerifyMsg("Conexión perfecta. La IA está funcionando correctamente.");
              } else if (result === "no_key") {
                setVerifyStatus("error");
                setVerifyMsg("No hay ninguna clave configurada.");
              } else {
                setVerifyStatus("error");
                setVerifyMsg(result.replace("error:", ""));
              }
            }

            return (
              <div className="grid gap-4">
                {/* Main AI status card */}
                <div className={`p-5 rounded-2xl border ${aiActive ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 shadow-sm" : "border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100 shadow-sm"}`}>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1">
                      <div className={`text-base font-bold flex items-center gap-2 ${aiActive ? "text-emerald-900" : "text-rose-900"}`}>
                        {aiActive ? "✨ IA Activa y Conectada" : "⚠️ IA Inactiva"}
                        {hasBuiltin && (
                          <span className="text-[10px] uppercase tracking-wider font-bold bg-emerald-800 text-white px-2 py-0.5 rounded-full shadow-sm">
                            Motor Integrado
                          </span>
                        )}
                      </div>
                      <div className={`text-sm mt-1.5 opacity-90 ${aiActive ? "text-emerald-800" : "text-rose-800"}`}>
                        {hasBuiltin
                          ? "El motor OpenAI gpt-4o-mini está activo para todos los perfiles de tu cuenta. No necesitas configurar nada más."
                          : hasManual
                          ? "Estás utilizando tu clave personal de OpenAI."
                          : "Añade una clave de OpenAI o Gemini abajo para activar la inteligencia de la aplicación."}
                      </div>
                    </div>
                    <button
                      onClick={handleVerify}
                      disabled={verifyStatus === "loading" || !aiActive}
                      className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                        aiActive
                          ? "bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow active:scale-95 border border-emerald-700"
                          : "bg-white text-slate-400 border border-slate-200 cursor-not-allowed"
                      }`}
                    >
                      {verifyStatus === "loading" ? "Verificando..." : "Realizar test de conexión"}
                    </button>
                  </div>
                  {verifyMsg && (
                    <div className={`mt-4 text-xs px-3 py-2.5 rounded-xl font-medium border ${verifyStatus === "ok" ? "bg-emerald-100 border-emerald-200 text-emerald-900" : "bg-rose-100 border-rose-200 text-rose-900"}`}>
                      {verifyStatus === "ok" ? "✅ " : "❌ "}{verifyMsg}
                    </div>
                  )}
                </div>

                {/* OpenAI key (personal override) */}
                <div className="border border-rumbo-line rounded-xl p-4 bg-white">
                  <label className="label">
                    {hasBuiltin ? "Tu clave personal de OpenAI (opcional)" : "API key de OpenAI"}
                  </label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type={showGptKey ? "text" : "password"}
                      className="input flex-1 font-mono text-sm"
                      placeholder={hasBuiltin ? "sk-… (ya tienes una incorporada)" : "sk-…"}
                      value={gptKey}
                      onChange={(e) => setGptKey(e.target.value)}
                    />
                    <button className="btn-soft" onClick={() => setShowGptKey((s) => !s)}>
                      {showGptKey ? "Ocultar" : "Mostrar"}
                    </button>
                    <button className="btn-primary" onClick={saveGptKey}>
                      Guardar
                    </button>
                  </div>
                  <div className="text-xs text-rumbo-muted mt-2">
                    {hasBuiltin
                      ? "Tu clave personal tiene prioridad sobre la incorporada si la añades aquí."
                      : "Consigue tu clave en platform.openai.com/api-keys"}
                  </div>
                  {savedGptHint && (
                    <div className="text-xs text-emerald-600 mt-1">{savedGptHint}</div>
                  )}
                </div>

                {/* Gemini key */}
                <div className="border border-rumbo-line rounded-xl p-4 bg-white">
                  <label className="label">API key de Gemini (opcional)</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type={showKey ? "text" : "password"}
                      className="input flex-1 font-mono text-sm"
                      placeholder="AIzaSy…"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <button className="btn-soft" onClick={() => setShowKey((s) => !s)}>
                      {showKey ? "Ocultar" : "Mostrar"}
                    </button>
                    <button className="btn-primary" onClick={saveKey}>
                      Guardar
                    </button>
                  </div>
                  <div className="text-xs text-rumbo-muted mt-2">
                    Usado como respaldo si OpenAI no responde.{" "}
                    {savedKey && <span className="text-emerald-600 font-medium">Configurado.</span>}
                  </div>
                  {savedHint && (
                    <div className="text-xs text-emerald-600 mt-1">{savedHint}</div>
                  )}
                </div>
              </div>
            );
          })()}
        </SettingsAccordion>

        <SettingsAccordion
          id="account"
          title="Mi Cuenta"
          icon="👤"
          hint="Gestiona tu información personal, patrimonio y objetivos."
          activeId={activeSection}
          onToggle={toggleSection}
        >
          <div className="grid gap-3 text-sm bg-white p-4 rounded-xl border border-rumbo-line">
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-rumbo-muted">Nombre</span>
              <span className="font-medium">{user.name || "—"}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-rumbo-muted">Tienes en total</span>
              <span className="font-medium">
                {latestTotal != null ? formatMoney(latestTotal) : "—"}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-rumbo-muted">Objetivo total</span>
              <span className="font-medium">
                {onboarding?.total_target ? formatMoney(onboarding.total_target) : "—"}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-rumbo-muted">Cobras al mes</span>
              <span className="font-medium">
                {onboarding?.current_monthly_income
                  ? `${formatMoney(onboarding.current_monthly_income)}/mes`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-rumbo-muted">Objetivo mensual</span>
              <span className="font-medium">
                {onboarding?.monthly_target
                  ? `${formatMoney(onboarding.monthly_target)}/mes`
                  : "—"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-5">
            <a href="/onboarding" className="btn-primary">
              Editar información
            </a>
            {profile && (
              <button
                onClick={() => {
                  signOut();
                  router.push("/login");
                }}
                className="btn-soft"
              >
                Cerrar sesión
              </button>
            )}
            {confirmReset === "idle" && (
              <button
                onClick={() => setConfirmReset("asking")}
                className="btn-ghost text-rose-600"
              >
                Borrar todos mis datos
              </button>
            )}
            {confirmReset === "asking" && (
              <div className="w-full mt-2 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">⚠️</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-rose-900 text-sm">
                      ¿De verdad vas a perder todo?
                    </div>
                    <p className="text-xs text-rose-800/80 mt-1 leading-relaxed">
                      Borraremos todos tus objetivos, tareas, dinero, gastos,
                      snapshots y herramientas — tanto en este dispositivo como
                      en la nube. Esta acción no se puede deshacer. Tu perfil
                      seguirá activo, pero empezará desde cero.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        onClick={async () => {
                          setConfirmReset("wiping");
                          await resetDemo();
                          setConfirmReset("idle");
                        }}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider transition-colors"
                      >
                        Sí, borrar TODO
                      </button>
                      <button
                        onClick={() => setConfirmReset("idle")}
                        className="px-4 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold uppercase tracking-wider transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {confirmReset === "wiping" && (
              <div className="w-full mt-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-rose-900 font-medium">Borrando todos tus datos…</span>
              </div>
            )}
          </div>
        </SettingsAccordion>

        <SettingsAccordion
          id="security"
          title="Seguridad"
          icon="🔒"
          hint={`Añade un PIN de 4 dígitos para bloquear tu app tras ${PIN_THRESHOLD_DAYS} días.`}
          activeId={activeSection}
          onToggle={toggleSection}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="text-sm">
              <div className="font-medium flex items-center gap-2">
                {pinHasValue ? "PIN activado 🔒" : "Sin PIN"}
              </div>
              <div className="text-rumbo-muted text-xs mt-1 max-w-sm">
                {pinHasValue
                  ? `Tendrás que escribirlo después de ${PIN_THRESHOLD_DAYS} días sin entrar.`
                  : "Crea uno para que nadie más pueda abrir tu cuenta."}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {pinHasValue ? (
                <>
                  <button
                    className="btn-soft"
                    onClick={() => setPinModal("change")}
                  >
                    Cambiar PIN
                  </button>
                  <button
                    className="btn-ghost text-rose-600"
                    onClick={handleRemovePin}
                  >
                    Quitar PIN
                  </button>
                </>
              ) : (
                <button
                  className="btn-primary"
                  onClick={() => setPinModal("create")}
                >
                  Crear PIN
                </button>
              )}
            </div>
          </div>
          {pinHint && (
            <div className="text-emerald-600 text-sm mt-3 bg-emerald-50 px-3 py-2 rounded-lg inline-block">{pinHint}</div>
          )}
        </SettingsAccordion>

        <SettingsAccordion
          id="integrations"
          title="Integraciones"
          icon="🔌"
          hint="Estado de conexión con servicios externos."
          activeId={activeSection}
          onToggle={toggleSection}
        >
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between items-center p-3 rounded-lg border border-rumbo-line bg-white">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${supabaseEnabled ? "bg-emerald-500" : "bg-slate-300"}`} />
                <span className="font-medium">Supabase</span>
              </div>
              <span className={supabaseEnabled ? "text-emerald-600 font-medium" : "text-rumbo-muted"}>
                {supabaseEnabled ? "Conectado (Tiempo real)" : "Desconectado"}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg border border-rumbo-line bg-white">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${savedKey ? "bg-emerald-500" : "bg-slate-300"}`} />
                <span className="font-medium">Google Gemini</span>
              </div>
              <span className={savedKey ? "text-emerald-600 font-medium" : "text-rumbo-muted"}>
                {savedKey ? "API Key guardada" : "Falta configuración"}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg border border-rumbo-line bg-white">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${savedGptKey ? "bg-emerald-500" : "bg-slate-300"}`} />
                <span className="font-medium">OpenAI</span>
              </div>
              <span className={savedGptKey ? "text-emerald-600 font-medium" : "text-rumbo-muted"}>
                {savedGptKey ? "API Key guardada" : "Falta configuración"}
              </span>
            </div>
          </div>
        </SettingsAccordion>
      </div>

      {pinModal && profile && (
        <PinModal
          profile={profile}
          mode="create"
          onSuccess={handleSetPin}
          onCancel={() => setPinModal(null)}
          verify={(pin) => checkPin(profile.id, pin)}
        />
      )}
      {showWrapped && <RumboWrapped onClose={() => setShowWrapped(false)} />}
    </div>
  );
}
