"use client";

import { useEffect, useState } from "react";
import { ErrorScreen } from "@/components/ErrorScreen";
import { elegirVariante } from "@/lib/pantallasError";

// Fallo dentro de la aplicación: el menú lateral y la sesión se mantienen; solo la
// zona de contenido muestra el aviso. `reset` reintenta pintar la página sin recargar.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [variante] = useState(() => elegirVariante(Date.now() / 1000));

  useEffect(() => {
    console.error("Error en la aplicación:", error);
  }, [error]);

  return <ErrorScreen variante={variante} onRetry={reset} homeHref="/dashboard" homeLabel="Ir a mi inicio" compact />;
}
