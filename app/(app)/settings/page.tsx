"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/Card";
import { SettingsAccordion } from "@/components/SettingsAccordion";
import { useFormatMoney, useRumbo } from "@/lib/store";
import { supabaseEnabled } from "@/lib/supabase";
import { CURRENCIES, Currency } from "@/lib/currency";
import { sendPasswordReset } from "@/lib/auth";
import { RumboWrapped } from "@/components/RumboWrapped";

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

  const [showWrapped, setShowWrapped] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwHint, setPwHint] = useState<string | null>(null);

  async function handleChangePassword() {
    const email = user.email;
    if (!email) { setPwHint("No hay email en tu cuenta."); return; }
    setPwBusy(true);
    const res = await sendPasswordReset(email);
    setPwBusy(false);
    setPwHint(res.ok ? "Te hemos enviado un email para cambiar tu contraseña." : (res.error ?? "No se pudo enviar."));
    setTimeout(() => setPwHint(null), 4000);
  }



  return (
    <div>
      <PageHeader title="Ajustes" subtitle="Tu cuenta, seguridad y configuración." />

      <div className="flex flex-col gap-3">

        {/* ── Rumbo Wrapped ────────────────────────────────── */}
        <button
          onClick={() => setShowWrapped(true)}
          className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 text-white p-5 flex items-center gap-4 hover:scale-[1.01] active:scale-[0.99] transition-transform shadow-lg"
        >
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl shrink-0">💸</div>
          <div className="text-left relative z-10">
            <div className="font-black text-base">Mi Rumbo Wrapped</div>
            <div className="text-white/70 text-xs mt-0.5">Tu dinero en cifras: ingresos, gastos, récords y patrimonio.</div>
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
          title="Cuenta y seguridad"
          icon="🔒"
          hint="Tu cuenta está protegida con email y contraseña. Solo tú ves tus datos."
          activeId={activeSection}
          onToggle={toggleSection}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="text-sm">
              <div className="font-medium flex items-center gap-2">
                {user.email || "Sin email"}
              </div>
              <div className="text-rumbo-muted text-xs mt-1 max-w-sm">
                Tus datos están aislados por usuario: nadie más puede verlos ni modificarlos.
              </div>
            </div>
            <button
              className="btn-soft"
              onClick={handleChangePassword}
              disabled={pwBusy}
            >
              {pwBusy ? "Enviando…" : "Cambiar contraseña"}
            </button>
          </div>
          {pwHint && (
            <div className="text-emerald-600 text-sm mt-3 bg-emerald-50 px-3 py-2 rounded-lg inline-block">{pwHint}</div>
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

          </div>
        </SettingsAccordion>
      </div>

      {showWrapped && <RumboWrapped onClose={() => setShowWrapped(false)} />}
    </div>
  );
}
