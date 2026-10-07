"use client";

import "./globals.css";
import { useEffect } from "react";
import { ErrorScreen } from "@/components/ErrorScreen";
import { ERROR_GRAVE } from "@/lib/pantallasError";

// Último recurso: falla el propio esqueleto de la aplicación. Sustituye al layout raíz,
// por eso lleva su propio <html>. No usa el estado de Rumbo (podría ser lo que falla).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Error grave en la aplicación:", error);
  }, [error]);

  return (
    <html lang="es">
      <body className="min-h-screen font-sans">
        <ErrorScreen variante={ERROR_GRAVE} onRetry={reset} retryLabel="Recargar" />
      </body>
    </html>
  );
}
