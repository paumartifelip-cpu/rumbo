"use client";

import { useEffect, useState } from "react";
import { filaParaGuardar, prefsIniciales, zonaDelDispositivo } from "@/lib/avisos";
import { datosDelDispositivo, diagnosticarPush, entornoReal, registrarDispositivo } from "@/lib/push";
import { getSupabase } from "@/lib/supabase";

const CLAVE_DESCARTADA = "rumbo_invitacion_avisos";

function yaDescartada(): boolean {
  try { return window.localStorage.getItem(CLAVE_DESCARTADA) === "1"; } catch { return false; }
}
function descartar() {
  try { window.localStorage.setItem(CLAVE_DESCARTADA, "1"); } catch { /* sin almacenamiento: volverá a salir, no pasa nada */ }
}

/**
 * Tarjeta que sale UNA vez a quien aún no tiene el recordatorio diario: un toque y queda
 * activado (21:00, en su ciudad). El permiso del móvil lo pide el propio sistema al pulsar.
 * No sale si ya tiene preferencias guardadas, si ya dijo «ahora no», ni si el aparato no
 * puede recibir avisos (navegador antiguo, iPhone sin instalar, permiso bloqueado).
 */
export function AvisosInvitacion({ userId }: { userId: string }) {
  const [visible, setVisible] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    if (yaDescartada()) return;
    const diag = diagnosticarPush(datosDelDispositivo());
    if (diag !== "pendiente" && diag !== "concedido") return;
    const supa = getSupabase();
    if (!supa) return;
    let vivo = true;
    supa
      .from("notification_prefs")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (vivo && !error && !data) setVisible(true);
      });
    return () => { vivo = false; };
  }, [userId]);

  async function activar() {
    if (trabajando) return;
    setTrabajando(true);
    setFallo(false);
    // El permiso se pide lo PRIMERO, directamente al tocar el botón (Safari lo exige).
    const registro = await registrarDispositivo(userId, entornoReal());
    const supa = getSupabase();
    const { borrador } = prefsIniciales(null, zonaDelDispositivo());
    const fila = filaParaGuardar(userId, borrador);
    if (!registro.ok || !fila || !supa) {
      setTrabajando(false);
      setFallo(true);
      return;
    }
    const { error } = await supa.from("notification_prefs").upsert(fila, { onConflict: "user_id" });
    setTrabajando(false);
    if (error) { setFallo(true); return; }
    descartar();
    setVisible(false);
  }

  function ahoraNo() {
    descartar();
    setVisible(false);
  }

  if (!visible) return null;
  return (
    <div className="fixed left-4 right-4 bottom-24 md:left-auto md:right-6 md:bottom-6 md:max-w-sm z-40 rounded-2xl bg-white shadow-lg border border-black/10 p-4">
      <div className="text-sm font-semibold">🔔 ¿Te recuerdo apuntar tus gastos?</div>
      <p className="text-xs text-rumbo-muted mt-1">
        Un aviso cada noche a las 21:00, y solo si ese día aún no has apuntado nada. Puedes cambiarlo o quitarlo cuando quieras en Ajustes.
      </p>
      {fallo && (
        <p className="text-xs text-rose-700 mt-2">
          No se pudo activar. Puedes probar otra vez o mirarlo con calma en Ajustes → Avisos y recordatorios.
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={activar}
          disabled={trabajando}
          className="flex-1 rounded-xl bg-rumbo-ink text-white text-sm font-medium py-2 disabled:opacity-60"
        >
          {trabajando ? "Activando…" : "Sí, avísame"}
        </button>
        <button type="button" onClick={ahoraNo} className="rounded-xl border border-black/10 text-sm py-2 px-3">
          Ahora no
        </button>
      </div>
    </div>
  );
}
