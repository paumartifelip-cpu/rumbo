"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, PageHeader, SectionTitle } from "@/components/Card";
import { useRumbo } from "@/lib/store";
import { supabaseEnabled } from "@/lib/supabase";

const PLANS = [
  {
    name: "Free",
    price: "0 €",
    perks: ["3 objetivos", "20 tareas", "Gráficos básicos"],
    current: true,
  },
  {
    name: "Pro",
    price: "19 €/mes",
    perks: ["Objetivos ilimitados", "Gemini IA", "Gráficos avanzados"],
  },
  {
    name: "Business",
    price: "49 €/mes",
    perks: ["Equipos", "Objetivos compartidos", "Reportes"],
  },
  {
    name: "Mentor IA",
    price: "99 €/mes",
    perks: ["Recomendaciones avanzadas", "Planificación semanal automática"],
  },
];

const KEY_STORAGE = "rumbo_gemini_key";

export default function SettingsPage() {
  const router = useRouter();
  const { user, resetDemo, onboarding, profile, signOut } = useRumbo();
  const [apiKey, setApiKey] = useState("");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  useEffect(() => {
    const k = localStorage.getItem(KEY_STORAGE);
    if (k) {
      setSavedKey(k);
      setApiKey(k);
    }
  }, []);

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

  return (
    <div>
      <PageHeader title="Ajustes" subtitle="Tu cuenta, IA y plan." />

      <div className="grid gap-4">
        <Card>
          <SectionTitle
            title="Inteligencia artificial"
            hint="Pega tu API key de Gemini para que la app priorice tus tareas con IA real."
          />
          <div className="grid gap-3">
            <div>
              <label className="label">API key de Gemini</label>
              <div className="flex gap-2 mt-1">
                <input
                  type={showKey ? "text" : "password"}
                  className="input flex-1 font-mono text-sm"
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <button
                  className="btn-soft"
                  onClick={() => setShowKey((s) => !s)}
                >
                  {showKey ? "Ocultar" : "Mostrar"}
                </button>
                <button className="btn-primary" onClick={saveKey}>
                  Guardar
                </button>
              </div>
              <div className="text-xs text-rumbo-muted mt-2">
                Se guarda solo en tu navegador (localStorage). Se envía a la
                ruta API <code>/api/prioritize</code> cuando pides repriorizar.
                Consigue tu clave en{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  aistudio.google.com/app/apikey
                </a>
                .
              </div>
              {savedHint && (
                <div className="text-xs text-emerald-600 mt-1">{savedHint}</div>
              )}
            </div>

            <div className="text-sm">
              Estado actual:{" "}
              {savedKey ? (
                <span className="text-emerald-600 font-medium">
                  Conectado (Gemini activo)
                </span>
              ) : (
                <span className="text-rumbo-muted">
                  Sin clave — usando heurística local
                </span>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Cuenta" />
          <div className="grid gap-2 text-sm">
            <div>
              <span className="text-rumbo-muted">Nombre:</span>{" "}
              <span className="font-medium">{user.name || "—"}</span>
            </div>
            <div>
              <span className="text-rumbo-muted">Tienes en total:</span>{" "}
              <span className="font-medium">
                {onboarding?.current_money
                  ? `${onboarding.current_money} €`
                  : "—"}
              </span>
            </div>
            <div>
              <span className="text-rumbo-muted">Objetivo total:</span>{" "}
              <span className="font-medium">
                {onboarding?.total_target
                  ? `${onboarding.total_target} €`
                  : "—"}
              </span>
            </div>
            <div>
              <span className="text-rumbo-muted">Cobras al mes:</span>{" "}
              <span className="font-medium">
                {onboarding?.current_monthly_income
                  ? `${onboarding.current_monthly_income} €/mes`
                  : "—"}
              </span>
            </div>
            <div>
              <span className="text-rumbo-muted">Objetivo mensual:</span>{" "}
              <span className="font-medium">
                {onboarding?.monthly_target
                  ? `${onboarding.monthly_target} €/mes`
                  : "—"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            <a href="/onboarding" className="btn-soft">
              Editar onboarding
            </a>
            {profile && (
              <button
                onClick={() => {
                  signOut();
                  router.push("/login");
                }}
                className="btn-soft"
              >
                Cambiar de usuario ({profile.name})
              </button>
            )}
            <button onClick={resetDemo} className="btn-ghost text-rose-600">
              Reiniciar mis datos
            </button>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Integraciones" />
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span>Supabase</span>
              <span
                className={
                  supabaseEnabled ? "text-emerald-600" : "text-rumbo-muted"
                }
              >
                {supabaseEnabled ? "Conectado" : "Sin configurar"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Gemini</span>
              <span
                className={
                  savedKey ? "text-emerald-600" : "text-rumbo-muted"
                }
              >
                {savedKey ? "Conectado" : "Pega tu API key arriba"}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-8">
        <SectionTitle
          title="Planes"
          hint="Estructura preparada para añadir Stripe más adelante."
        />
        <div className="grid md:grid-cols-4 gap-3">
          {PLANS.map((p) => (
            <Card
              key={p.name}
              className={p.current ? "ring-2 ring-rumbo-ink/10" : ""}
            >
              <div className="text-[11px] uppercase tracking-wider text-rumbo-muted">
                {p.name}
              </div>
              <div className="text-2xl font-semibold mt-1">{p.price}</div>
              <ul className="mt-3 space-y-1 text-sm">
                {p.perks.map((x) => (
                  <li key={x}>• {x}</li>
                ))}
              </ul>
              <button
                disabled={p.current}
                className="btn-primary mt-4 w-full disabled:bg-slate-200 disabled:text-rumbo-muted"
              >
                {p.current ? "Plan actual" : "Elegir"}
              </button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
