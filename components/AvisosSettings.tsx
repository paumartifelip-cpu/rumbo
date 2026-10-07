"use client";

import { useEffect, useRef, useState } from "react";
import {
  HORAS,
  PrefsAvisos,
  ZONAS_COMUNES,
  filaParaGuardar,
  hayCambios,
  normalizarPrefs,
  zonaDelDispositivo,
} from "@/lib/avisos";
import {
  DiagnosticoPush,
  MotivoFallo,
  datosDelDispositivo,
  diagnosticarPush,
  dispositivoSuscrito,
  enviarAvisoDePrueba,
  entornoReal,
  quitarDispositivo,
  registrarDispositivo,
  textoDiagnostico,
  type TextoPrueba,
} from "@/lib/push";
import { getSupabase } from "@/lib/supabase";

type Estado = "cargando" | "listo" | "error_carga";
type Guardado = "nada" | "guardando" | "ok" | "error";

const MENSAJES_FALLO: Record<MotivoFallo, string> = {
  no_soportado: "Este navegador no admite avisos.",
  iphone_sin_instalar: "Instala Rumbo en la pantalla de inicio para poder recibir avisos.",
  denegado: "No diste permiso para las notificaciones, así que este dispositivo no recibirá avisos.",
  error_suscripcion: "No se pudo preparar este dispositivo para los avisos. Inténtalo otra vez.",
  error_guardado: "No se pudo registrar este dispositivo. Inténtalo otra vez.",
};

// Preferencias del recordatorio diario y registro de ESTE dispositivo para recibir avisos.
// De momento NO se envía nada (paso 3): se guarda qué quiere cada persona y a qué aparatos
// se puede avisar. Se lee y se escribe directamente en las tablas, sin pasar por la
// sincronización de datos de la app, para no tocar lo delicado.
//
// Los cambios son un BORRADOR hasta pulsar «Guardar cambios». Para que nadie se olvide:
// el botón solo se activa si hay algo que guardar, se avisa de que hay cambios sin guardar
// y el navegador pregunta si se intenta salir de la página con cambios pendientes.
export function AvisosSettings({ userId }: { userId: string }) {
  // Sin conexión con Supabase no hay nada que cargar: se sabe ya al empezar.
  const [estado, setEstado] = useState<Estado>(() => (getSupabase() ? "cargando" : "error_carga"));
  const [guardado, setGuardado] = useState<Guardado>("nada");
  const [prefs, setPrefs] = useState<PrefsAvisos | null>(null); // lo que se ve (borrador)
  const [guardadas, setGuardadas] = useState<PrefsAvisos | null>(null); // lo que hay en la base de datos
  const zonaDispositivo = useRef(zonaDelDispositivo());
  const turno = useRef(0); // para que un guardado viejo no pise el estado de uno nuevo

  // Situación de ESTE dispositivo respecto a los avisos.
  const [diag, setDiag] = useState<DiagnosticoPush>(() => diagnosticarPush(datosDelDispositivo()));
  const [suscrito, setSuscrito] = useState(false);
  const [avisoDispositivo, setAvisoDispositivo] = useState<string | null>(null);
  const [activando, setActivando] = useState(false);
  const [enviandoPrueba, setEnviandoPrueba] = useState(false);
  const [resultadoPrueba, setResultadoPrueba] = useState<TextoPrueba | null>(null);

  async function refrescarDispositivo() {
    setDiag(diagnosticarPush(datosDelDispositivo()));
    setSuscrito(await dispositivoSuscrito());
  }

  useEffect(() => {
    let vivo = true;
    dispositivoSuscrito().then((s) => { if (vivo) setSuscrito(s); });
    return () => { vivo = false; };
  }, []);

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
        const cargadas = normalizarPrefs(data, zonaDispositivo.current);
        setPrefs(cargadas);
        setGuardadas(cargadas);
        setEstado("listo");
      });
    return () => { vivo = false; };
  }, [userId]);

  const pendiente = hayCambios(guardadas, prefs);

  // Avisa al navegador si se intenta cerrar o recargar la página con cambios sin guardar.
  useEffect(() => {
    if (!pendiente) return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [pendiente]);

  // Tocar un campo solo cambia el borrador; no se guarda nada todavía.
  function cambiar(parcial: Partial<PrefsAvisos>) {
    if (!prefs) return;
    setPrefs({ ...prefs, ...parcial });
    setGuardado("nada");
  }

  function descartar() {
    if (guardadas) setPrefs(guardadas);
    setGuardado("nada");
  }

  async function guardar() {
    if (!prefs || !pendiente || guardado === "guardando") return;
    const fila = filaParaGuardar(userId, prefs);
    const supa = getSupabase();
    if (!fila || !supa) { setGuardado("error"); return; }

    // El permiso del móvil se pide AQUÍ, lo primero y sin esperar a nada: Safari exige que
    // la pregunta salga justo al tocar el botón. El guardado de las preferencias va en paralelo.
    const registro = prefs.reminder_enabled ? registrarDispositivo(userId, entornoReal()) : null;

    const mio = ++turno.current;
    setGuardado("guardando");
    setAvisoDispositivo(null);
    const { error } = await supa.from("notification_prefs").upsert(fila, { onConflict: "user_id" });
    const resultado = registro ? await registro : null;
    // Si apaga el recordatorio, este dispositivo se da de baja de los avisos.
    const baja = prefs.reminder_enabled ? null : await quitarDispositivo();
    if (mio !== turno.current) return;

    if (error) {
      console.warn("notification_prefs: no se pudo guardar", error);
      setGuardado("error"); // el borrador se conserva: no se pierde lo que escribió
      return;
    }
    setGuardadas(prefs);
    setGuardado("ok");
    if (resultado && !resultado.ok) setAvisoDispositivo(MENSAJES_FALLO[resultado.motivo]);
    if (baja && !baja.ok) setAvisoDispositivo("No se pudo quitar este dispositivo de los avisos. Inténtalo otra vez.");
    await refrescarDispositivo();
  }

  // Botón «Activar en este dispositivo»: para cuando las preferencias ya están guardadas
  // pero este aparato aún no está registrado (p. ej. se rechazó el permiso y luego se cambió de idea).
  async function activarDispositivo() {
    if (activando) return;
    setActivando(true);
    setAvisoDispositivo(null);
    const r = await registrarDispositivo(userId, entornoReal());
    setActivando(false);
    if (!r.ok) setAvisoDispositivo(MENSAJES_FALLO[r.motivo]);
    await refrescarDispositivo();
  }

  // Botón «Enviar aviso de prueba»: el servidor manda un aviso real a tus dispositivos.
  async function probarAviso() {
    if (enviandoPrueba) return;
    setEnviandoPrueba(true);
    setResultadoPrueba(null);
    setResultadoPrueba(await enviarAvisoDePrueba());
    setEnviandoPrueba(false);
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

  const quiereAvisos = prefs.reminder_enabled || Boolean(guardadas?.reminder_enabled);
  const puedeActivar = Boolean(guardadas?.reminder_enabled) && !pendiente && (diag === "pendiente" || diag === "concedido");
  // «Permiso concedido» sin estar registrado no es «todo listo»: falta el último paso.
  const textoEstado =
    diag === "concedido"
      ? { titulo: "Falta un último paso", detalle: "Tienes el permiso, pero este dispositivo todavía no está registrado. Pulsa «Activar avisos en este dispositivo»." }
      : textoDiagnostico(diag);

  return (
    <div className="flex flex-col gap-5">
      <div className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
        🧪 Función en pruebas: ya puedes activar los avisos en este dispositivo, pero todavía no se envían.
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

      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${prefs.reminder_enabled ? "" : "opacity-50"}`}>
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

      {quiereAvisos && (
        <div className="rounded-xl border border-rumbo-line bg-slate-50/70 px-3.5 py-3">
          {suscrito ? (
            <>
              <p className="text-sm font-medium text-emerald-800">✅ Avisos activados en este dispositivo</p>
              <button type="button" onClick={probarAviso} disabled={enviandoPrueba} className="btn-soft mt-3 disabled:opacity-50">
                {enviandoPrueba ? "Enviando…" : "Enviar aviso de prueba"}
              </button>
              {resultadoPrueba && (
                <p
                  role="status"
                  className={`text-xs font-medium mt-2 ${
                    resultadoPrueba.tipo === "ok" ? "text-emerald-700" : resultadoPrueba.tipo === "aviso" ? "text-amber-700" : "text-rose-700"
                  }`}
                >
                  {resultadoPrueba.texto}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-rumbo-ink">{textoEstado.titulo}</p>
              <p className="text-xs text-rumbo-muted mt-1 leading-relaxed">{textoEstado.detalle}</p>
              {puedeActivar && (
                <button type="button" onClick={activarDispositivo} disabled={activando} className="btn-soft mt-3 disabled:opacity-50">
                  {activando ? "Activando…" : "Activar avisos en este dispositivo"}
                </button>
              )}
            </>
          )}
          {avisoDispositivo && <p className="text-xs font-medium text-rose-700 mt-2">{avisoDispositivo}</p>}
        </div>
      )}

      <p className="text-xs text-rumbo-muted leading-relaxed">
        Cada dispositivo (móvil, ordenador) se activa por separado. Los avisos nunca llevan importes: se ven en la
        pantalla bloqueada.
      </p>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={guardar}
          disabled={!pendiente || guardado === "guardando"}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {guardado === "guardando" ? "Guardando…" : "Guardar cambios"}
        </button>
        {pendiente && guardado !== "guardando" && (
          <button type="button" onClick={descartar} className="text-sm text-rumbo-muted hover:text-rumbo-ink underline underline-offset-2">
            Descartar
          </button>
        )}
        <div aria-live="polite" className="text-xs">
          {pendiente && guardado !== "guardando" && guardado !== "error" && (
            <span className="text-amber-700 font-medium">Tienes cambios sin guardar</span>
          )}
          {!pendiente && guardado === "ok" && <span className="text-emerald-700 font-medium">Guardado ✓</span>}
          {guardado === "error" && (
            <span className="text-rose-700 font-medium">No se pudo guardar. Tus cambios siguen aquí: inténtalo otra vez.</span>
          )}
        </div>
      </div>
    </div>
  );
}
