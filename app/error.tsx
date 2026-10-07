"use client";

import { useEffect, useState } from "react";
import { ErrorScreen } from "@/components/ErrorScreen";
import { elegirVariante } from "@/lib/pantallasError";

// Algo ha fallado en una página pública (inicio, login…). `reset` vuelve a pintarla
// SIN recargar, así que no se pierde la sesión.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Se elige al montar (solo existe en el navegador, tras un fallo): no hay desajuste con el servidor.
  const [variante] = useState(() => elegirVariante(Date.now() / 1000));

  useEffect(() => {
    console.error("Error en la aplicación:", error);
  }, [error]);

  return <ErrorScreen variante={variante} onRetry={reset} />;
}
