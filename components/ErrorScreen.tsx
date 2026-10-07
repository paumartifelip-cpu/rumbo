import type { VarianteError } from "@/lib/pantallasError";

// Pantalla de error con personalidad. Presentacional: sin hooks ni estado, para poder
// usarla tanto desde componentes de error (cliente) como desde la página 404 (servidor).
export function ErrorScreen({
  variante,
  onRetry,
  retryLabel = "Probar otra vez",
  homeLabel = "Volver al inicio",
  homeHref = "/",
  compact = false,
}: {
  variante: VarianteError;
  /** Si se pasa, aparece el botón de reintentar. */
  onRetry?: () => void;
  retryLabel?: string;
  homeLabel?: string;
  homeHref?: string;
  /** Versión pequeña para dentro de la aplicación (el menú sigue visible). */
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center px-6 ${
        compact ? "py-16" : "min-h-screen py-16"
      }`}
    >
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute inset-0 -m-3 rounded-full bg-amber-200/60 blur-xl"
        />
        <div
          aria-hidden="true"
          className="compass-wobble relative w-24 h-24 rounded-full bg-white ring-4 ring-amber-100 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.25)] flex items-center justify-center text-5xl select-none"
        >
          {variante.emoji}
        </div>
      </div>

      <h1 className="mt-8 text-3xl md:text-4xl font-black tracking-tight text-rumbo-ink max-w-lg">
        {variante.title}
      </h1>
      <p className="mt-3 text-rumbo-muted max-w-md leading-relaxed">{variante.text}</p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <button type="button" onClick={onRetry} className="btn-primary">
            {retryLabel}
          </button>
        )}
        <a href={homeHref} className={onRetry ? "btn-soft" : "btn-primary"}>
          {homeLabel}
        </a>
      </div>

      <p className="mt-10 text-[11px] font-bold uppercase tracking-[0.2em] text-rumbo-muted/70">
        Rumbo · Menos ruido, más rumbo
      </p>
    </div>
  );
}
