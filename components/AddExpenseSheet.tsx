"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "./Sheet";
import { useFormatMoney, useRumbo } from "@/lib/store";
import { CURRENCIES, Currency } from "@/lib/currency";

const QUICK_CATS = [
  { key: "Comida",      icon: "🍽️", label: "Comida" },
  { key: "Transporte",  icon: "🚗", label: "Transporte" },
  { key: "Trabajo",     icon: "💼", label: "Trabajo" },
  { key: "Alojamiento", icon: "🏠", label: "Casa" },
  { key: "Otros",       icon: "📦", label: "Otros" },
] as const;

type QuickCat = (typeof QUICK_CATS)[number]["key"] | null;

export function AddExpenseSheet({
  open,
  onClose,
  date,
}: {
  open: boolean;
  onClose: () => void;
  date: Date;
}) {
  const { addFinance, primaryCurrency, amountInPrimary } = useRumbo();
  const format = useFormatMoney();
  const amountRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<QuickCat>(null);
  const [recurrence, setRecurrence] = useState<"" | "mensual">("");
  const [currency, setCurrency] = useState<Currency>(primaryCurrency);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  // Reset state and focus the amount field every time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setAmount("");
    setTitle("");
    setCategory(null);
    setRecurrence("");
    setCurrency(primaryCurrency);
    setShowCurrencyPicker(false);
    const t = setTimeout(() => amountRef.current?.focus(), 260);
    return () => clearTimeout(t);
  }, [open, primaryCurrency]);

  const valid = typeof amount === "number" && amount > 0;

  function submit() {
    if (!valid) return;
    addFinance({
      type: "gasto",
      title: title.trim() || (category ?? "Gasto"),
      amount,
      currency,
      date: date.toISOString(),
      ...(recurrence ? { recurrence } : {}),
      ...(category ? { category } : {}),
    });
    onClose();
  }

  const isForeign = currency !== primaryCurrency;
  const conversion =
    isForeign && typeof amount === "number" && amount > 0
      ? amountInPrimary({
          id: "_",
          user_id: "_",
          type: "gasto",
          title: "_",
          amount,
          currency,
          date: date.toISOString(),
          created_at: new Date().toISOString(),
        })
      : null;

  return (
    <Sheet open={open} onClose={onClose} title="Nuevo gasto" ariaLabel="Añadir gasto">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col"
      >
        <div className="px-5 pt-5 flex flex-col gap-6">
          {/* Cantidad — el campo dominante, como en Apple Wallet/Cash */}
          <div>
            <label
              htmlFor="exp-amount"
              className="block text-[11px] uppercase tracking-wider text-rumbo-muted mb-2"
            >
              Cantidad
            </label>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl text-rumbo-muted font-light tabular-nums">
                {CURRENCIES[currency].symbol}
              </span>
              <input
                ref={amountRef}
                id="exp-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="w-full text-4xl font-semibold tabular-nums bg-transparent outline-none placeholder:text-slate-300"
                aria-label="Cantidad del gasto"
              />
            </div>
            {conversion !== null && (
              <div className="text-xs text-rumbo-muted mt-1">
                ≈ {format(conversion)} en tu moneda principal
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowCurrencyPicker((s) => !s)}
              aria-expanded={showCurrencyPicker}
              className="mt-2 text-xs text-rumbo-muted hover:text-rumbo-ink"
            >
              {CURRENCIES[currency].flag} {currency} · cambiar divisa
            </button>
            {showCurrencyPicker && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCurrency(c);
                      setShowCurrencyPicker(false);
                    }}
                    aria-pressed={currency === c}
                    className={`px-3 py-2 rounded-full text-sm border transition active:scale-95 ${
                      currency === c
                        ? "bg-rumbo-ink text-white border-rumbo-ink"
                        : "bg-white text-rumbo-ink border-rumbo-line"
                    }`}
                  >
                    {CURRENCIES[c].flag} {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Categoría: grid grande, fácil de tocar con el pulgar */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-rumbo-muted mb-2">
              Categoría
            </div>
            <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Categoría del gasto">
              {QUICK_CATS.map((c) => {
                const active = category === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={c.label}
                    onClick={() => setCategory(active ? null : c.key)}
                    className={`flex flex-col items-center justify-center gap-1 py-3 min-h-[64px] rounded-2xl border transition active:scale-95 ${
                      active
                        ? "bg-rumbo-ink text-white border-rumbo-ink"
                        : "bg-white text-rumbo-ink border-rumbo-line"
                    }`}
                  >
                    <span className="text-xl leading-none" aria-hidden="true">
                      {c.icon}
                    </span>
                    <span className="text-[10px] font-medium leading-none">
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {!category && (
              <p className="text-[11px] text-rumbo-muted mt-2">
                Si no eliges, la IA la asigna por ti ✦
              </p>
            )}
          </div>

          {/* Concepto */}
          <div>
            <label
              htmlFor="exp-title"
              className="block text-[11px] uppercase tracking-wider text-rumbo-muted mb-2"
            >
              Concepto <span className="text-slate-400 normal-case">(opcional)</span>
            </label>
            <input
              id="exp-title"
              type="text"
              placeholder="Mercadona, Netflix, alquiler…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input min-h-[44px]"
              autoComplete="off"
            />
          </div>

          {/* Suscripción — toggle con área grande */}
          <label className="flex items-center gap-3 py-3 px-4 rounded-2xl border border-rumbo-line cursor-pointer min-h-[56px] active:scale-[0.99] transition">
            <input
              type="checkbox"
              className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
              checked={recurrence === "mensual"}
              onChange={(e) =>
                setRecurrence(e.target.checked ? "mensual" : "")
              }
            />
            <div className="flex-1">
              <div className="text-sm font-medium">🔁 Suscripción mensual</div>
              <div className="text-xs text-rumbo-muted">
                Se repite automáticamente cada mes
              </div>
            </div>
          </label>
        </div>

        {/* CTA principal sticky */}
        <div className="sticky bottom-0 mt-5 px-5 pt-3 pb-4 bg-white border-t border-rumbo-line">
          <button
            type="submit"
            disabled={!valid}
            className="btn-primary w-full text-base min-h-[52px]"
          >
            {valid
              ? `Añadir ${CURRENCIES[currency].symbol}${amount}`
              : "Añadir gasto"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
