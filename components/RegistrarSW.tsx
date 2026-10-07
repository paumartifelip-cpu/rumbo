"use client";

import { useEffect } from "react";

// Registra el programa de fondo (public/sw.js) que hace instalable la app. Solo en
// producción: en desarrollo molestaría. Si falla (navegador antiguo, modo privado…) no pasa
// nada: la web funciona igual, simplemente no se podrá instalar.
export function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
