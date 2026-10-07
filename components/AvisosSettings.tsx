"use client";

import { useEffect, useRef, useState } from "react";
import {
  HORAS,
  PrefsAvisos,
  ZONAS_COMUNES,
  filaParaGuardar,
  normalizarPrefs,
  zonaDelDispositivo,
} from "@/lib/avisos";
import { getSupabase } from "@/lib/supabase";

type Estado = "cargando" | "listo" | "error_carga";
type Guardado = "nada" | "guardando" | "ok" | "error";

// Preferencias del recordatorio diario. De momento NO envía nada (paso 1): solo guarda
// qué quiere cada persona. Se lee y se escribe directamente en la tabla, sin pasar por la
// sincronización de datos de la app, para no tocar lo delicado.
export function AvisosSettings({ userId }: { userId: string }) {
  // Sin conexión con Supabase no hay nada que cargar: se sabe ya al empezar.
  const [estado, setEstado] = useState<Estado>(() => (getSupabase() ? "cargando" : "error_carga"));
  const [guardado, setGuardado] = useState<Guardado>("nada");
  const [prefs, setPrefs] = useState<PrefsAvisos | null>(null);
  const zonaDispositivo = useRef(zonaDelDispositivo());
  const turno = useRef(0); // para que un guardado viejo no pise el estado de uno nuevo

  useEffect(() => {
    let vivo = true;
    const supa = getSupabase();
    if (!supa) return;
    supa
      .from("notification_prefs")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) { console.warn("notification_prefs: no se pudo leer", error); setEstado("error_carga"); return; }
        setPrefs(normalizarPrefs(data, zonaDispositivo.current));
        setEstado("listo");
      });
    return () => { vivo = false; };
  }, [userId]);

  async function cambiar(parcial: Partial<PrefsAvisos>) {
    if (!prefs) return;
    const siguiente = { ...prefs, ...parcial };
    setPrefs(siguiente);
    const fila = filaParaGuardar(userId, siguiente);
    const supa = getSupabase();
    if (!fila || !supa) { setGuardado("error"); return; }
    const mio = ++turno.current;
    setGuardado("guardando");
    const { error } = await supa.from("notification_prefs").upsert(fila, { onConflict: "user_id" });
    if (mio !== turno.current) return;
    if (error) console.warn("notification_prefs: no se pudo guardar", error);
    setGuardado(error ? "error" : "ok");
  }

  if (estado === "cargando") return <p className="text-sm text-rumbo-muted">Cargando tus preferencias…</p>;
  if (estado === "error_carga" || !prefs) {
    return (
      <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
        No hemos podido cargar tus preferencias de avisos. Recarga la página y vuelve a probar.
      </p>
    );
  }

  const zonas = ZONAS_COMUNES.some((z) => z.id === prefs.timezone)
    ? ZONAS_COMUNES
    : [{ id: prefs.timezone, nombre: prefs.timezone.replace(/_/g, " ") }, ...ZONAS_COMUNES];

  return (
    <div className="flex flex-col gap-5">
      <div className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
        🧪 Función en pruebas: tus preferencias se guardan, pero los avisos todavía no se envían.
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-medium text-rumbo-ink">Recordarme apuntar mis gastos</div>
          <div className="text-xs text-rumbo-muted mt-0.5">Un aviso al día, a la hora que elijas.</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.reminder_enabled}
          aria-label="Recordarme apuntar mis gastos"
          onClick={() => cambiar({ reminder_enabled: !prefs.reminder_enabled })}
          className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${prefs.reminder_enabled ? "bg-emerald-500" : "bg-slate-300"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${prefs.reminder_enabled ? "translate-x-5" : ""}`}
          />
        </button>
      </div>

      <div className={`grid gap-4 sm:grid-cols-2 ${prefs.reminder_enabled ? "" : "opacity-50"}`}>
        <label className="block">
          <span className="label">A qué hora</span>
          <select
            className="input mt-1"
            value={prefs.reminder_time}
            disabled={!prefs.reminder_enabled}
            onChange={(e) => cambiar({ reminder_time: e.target.value })}
          >
            {!HORAS.includes(prefs.reminder_time) && <option value={prefs.reminder_time}>{prefs.reminder_time}</option>}
            {HORAS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Tu zona horaria</span>
          <select
            className="input mt-1"
            value={prefs.timezone}
            disabled={!prefs.reminder_enabled}
            onChange={(e) => cambiar({ timezone: e.target.value })}
          >
            {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          </select>
        </label>
      </div>

      <label className={`flex items-start gap-3 text-sm ${prefs.reminder_enabled ? "" : "opacity-50"}`}>
        <input
          type="checkbox"
          className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
          checked={prefs.skip_if_logged}
          disabled={!prefs.reminder_enabled}
          onChange={(e) => cambiar({ skip_if_logged: e.target.checked })}
        />
        <span>
          <span className="font-medium text-rumbo-ink">No avisarme si ya he apuntado algo hoy</span>
          <span className="block text-xs text-rumbo-muted mt-0.5">Así el recordatorio solo te molesta si se te ha olvidado.</span>
        </span>
      </label>

      <p className="text-xs text-rumbo-muted leading-relaxed">
        📱 En iPhone, para recibir avisos hace falta tener Rumbo añadido a la pantalla de inicio. Los avisos nunca
        llevan importes: se ven en la pantalla bloqueada.
      </p>

      <div aria-live="polite" className="text-xs h-4">
        {guardado === "guardando" && <span className="text-rumbo-muted">Guardando…</span>}
        {guardado === "ok" && <span className="text-emerald-700 font-medium">Guardado ✓</span>}
        {guardado === "error" && <span className="text-rose-700 font-medium">No se pudo guardar. Inténtalo otra vez.</span>}
      </div>
    </div>
  );
}
