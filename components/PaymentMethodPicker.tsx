"use client";

import { useState } from "react";
import {
  accountSuggestions,
  canonicalAccount,
  MAX_ACCOUNT_LEN,
  methodHasAccount,
  PAYMENT_METHODS,
  paymentLabel,
} from "@/lib/paymentMethods";
import { useRumbo } from "@/lib/store";
import { PaymentMethod } from "@/lib/types";

// "Pagado con · opcional": plegado por defecto para que anotar un gasto siga
// siendo igual de rápido. Siempre empieza vacío.
export function PaymentMethodPicker({
  method,
  account,
  onChange,
}: {
  method: PaymentMethod | null;
  account: string;
  onChange: (method: PaymentMethod | null, account: string) => void;
}) {
  const { finances } = useRumbo();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const suggestions = method && methodHasAccount(method) ? accountSuggestions(finances, method) : [];

  const summary = method
    ? `${paymentLabel(method)}${account ? ` · ${account}` : ""}`
    : null;

  function pickMethod(m: PaymentMethod) {
    setAdding(false);
    setDraft("");
    // Tocar el mismo método otra vez lo deselecciona.
    if (method === m) onChange(null, "");
    else onChange(m, "");
  }

  function confirmDraft() {
    if (!method) return;
    const name = canonicalAccount(draft, suggestions);
    if (name) onChange(method, name);
    setAdding(false);
    setDraft("");
  }

  const chip = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 ${
      active
        ? "bg-rumbo-ink text-white border-rumbo-ink shadow-sm"
        : "bg-white text-rumbo-muted border-rumbo-line hover:border-rumbo-ink hover:text-rumbo-ink"
    }`;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 text-sm text-rumbo-muted hover:text-rumbo-ink transition-colors"
      >
        <span className="text-[11px] uppercase tracking-wider">Pagado con</span>
        <span className="text-xs">{summary ?? "· opcional"}</span>
        <span className={`text-xs transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Método de pago">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-pressed={method === m.key}
                onClick={() => pickMethod(m.key)}
                className={chip(method === m.key)}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          {method && methodHasAccount(method) && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Tarjeta">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={account === s}
                  onClick={() => onChange(method, account === s ? "" : s)}
                  className={chip(account === s)}
                >
                  {s}
                </button>
              ))}
              {account && !suggestions.includes(account) && (
                <button type="button" aria-pressed className={chip(true)} onClick={() => onChange(method, "")}>
                  {account}
                </button>
              )}
              {adding ? (
                <input
                  autoFocus
                  className="input !py-1.5 !text-sm w-44"
                  placeholder="Ej: BBVA Visa"
                  maxLength={MAX_ACCOUNT_LEN}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={confirmDraft}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); confirmDraft(); }
                    if (e.key === "Escape") { setAdding(false); setDraft(""); }
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="px-3 py-1.5 rounded-full text-sm text-emerald-700 border border-dashed border-emerald-300 hover:bg-emerald-50 transition-colors"
                >
                  + Nueva tarjeta
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
