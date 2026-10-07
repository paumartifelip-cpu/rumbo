import type { Metadata } from "next";
import { ErrorScreen } from "@/components/ErrorScreen";
import { PAGINA_NO_ENCONTRADA } from "@/lib/pantallasError";

export const metadata: Metadata = { title: "Página no encontrada · Rumbo" };

// Cualquier dirección que no existe (404).
export default function NotFound() {
  return <ErrorScreen variante={PAGINA_NO_ENCONTRADA} />;
}
