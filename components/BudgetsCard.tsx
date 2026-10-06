"use client";

import { useMemo, useState } from "react";
import { Card, SectionTitle } from "@/components/Card";
import {
  BUDGET_CATEGORIES,
  budgetLevel,
  budgetLimitInPrimary,
  monthlySpendByCategory,
} from "@/lib/budgets";
import { CURRENCIES } from "@/lib/currency";
import { useFormatMoney, useRumbo } from "@/lib/store";

const ICONS: Record<string, string> = {
  Comida: "🍽️", Transporte: "🚗", Alojamiento: "🏠", Trabajo: "💼", Compras: "🛍️",
  Educación: "🎓", Salud: "🩺", Caridad: "🤝", Otros: "📦", Deudas: "💳",
};

const TONE = {
  ok: { bar: "bg-emerald-500", text: "text-emerald-700" },
  warn: { bar: "bg-amber-500", text: "text-amber-700" },
  over: { bar: "bg-rose-500", text: "text-rose-600" },
} as const;

export function BudgetsCard({ selectedDate }: { selectedDate: Date }) {
  const { finances, budgets, setBudget, removeBudget, primaryCurrency, amountInPrimary } = useRumbo();
  const format = useFormatMoney();
  // Edición inline: "new" = añadir uno nuevo, o la categoría que se edita.
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState<number | "">("");

  const spend = useMemo(
    () => monthlySpendByCategory(finances, selectedDate, amountInPrimary),
    [finances, selectedDate, amountInPrimary]
  );

  const rows = useMemo(
    () =>
      (budgets || [])
        .filter((b) => !b.month)
        .map((b) => {
          const limit = budgetLimitInPrimary(b, primaryCurrency);
          const spent = spend.get(b.category) ?? 0;
          const ratio = limit > 0 ? spent / limit : 0;
          return { b, limit, spent, ratio, level: budgetLevel(ratio) };
        })
        .sort((a, b) => b.ratio - a.ratio),
    [budgets, spend, primaryCurrency]
  );

  const free = BUDGET_CATEGORIES.filter((c) => !rows.some((r) => r.b.category === c));
  const alerts = rows.filter((r) => r.level !== "ok");

  function startNew() {
    setCategory(free[0] ?? "");
    setAmount("");
    setEditing("new");
  }
  function startEdit(cat: string, limit: number) {
    setCategory(cat);
    setAmount(Math.round(limit * 100) / 100);
    setEditing(cat);
  }
  function save() {
    if (!category || typeof amount !== "number" || amount <= 0) return;
    setBudget(category, amount);
    setEditing(null);
  }

  const form = (
    <div className="mt-3 rounded-2xl border border-rumbo-line bg-slate-50/60 p-3 flex flex-col sm:flex-row gap-2">
      <select
        className="input sm:w-44"
        value={category}
        disabled={editing !== "new"}
        onChange={(e) => setCategory(e.target.value)}
      >
        {(editing === "new" ? free : [category]).map((c) => (
          <option key={c} value={c}>{ICONS[c]} {c}</option>
        ))}
      </select>
      <div className="relative flex-1">
        <input
          type="number"
          inputMode="decimal"
          step="1"
          min="0"
          autoFocus
          className="input w-full pr-10"
          placeholder="Límite al mes"
          value={amount}
          onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(null); }}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rumbo-muted text-sm">
          {CURRENCIES[primaryCurrency].symbol}
        </span>
      </div>
      <button
        className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={!category || typeof amount !== "number" || amount <= 0}
        onClick={save}
      >
        Guardar
      </button>
      <button className="btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
    </div>
  );

  return (
    <Card className="card-hover">
      <SectionTitle
        title="Presupuesto del mes"
        hint={
          rows.length === 0
            ? "Ponle un límite mensual a una categoría y te avisamos al llegar al 80 %."
            : alerts.length > 0
              ? `${alerts.length} ${alerts.length === 1 ? "categoría cerca o por encima del límite" : "categorías cerca o por encima del límite"}`
              : "Todo dentro de lo previsto."
        }
        action={
          free.length > 0 && editing === null ? (
            <button onClick={startNew} className="btn-ghost text-sm">+ Añadir</button>
          ) : undefined
        }
      />

      {rows.length === 0 && editing === null && (
        <button
          onClick={startNew}
          className="w-full mt-1 rounded-2xl border border-dashed border-rumbo-line py-6 text-sm text-rumbo-muted hover:border-rumbo-ink hover:text-rumbo-ink transition-colors"
        >
          🎯 Definir mi primer presupuesto
        </button>
      )}

      {editing === "new" && form}

      <div className="mt-4 flex flex-col gap-5">
        {rows.map(({ b, limit, spent, ratio, level }) => {
          const tone = TONE[level];
          const remaining = limit - spent;
          return (
            <div key={b.id}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-rumbo-ink">{ICONS[b.category] ?? "📦"} {b.category}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold tabular-nums">
                    {format(spent)} <span className="font-normal text-rumbo-muted">/ {format(limit)}</span>
                  </span>
                  <button
                    onClick={() => startEdit(b.category, limit)}
                    aria-label={`Editar presupuesto de ${b.category}`}
                    className="w-7 h-7 rounded-lg text-rumbo-muted hover:text-rumbo-ink hover:bg-slate-100 transition active:scale-90"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => removeBudget(b.category)}
                    aria-label={`Quitar presupuesto de ${b.category}`}
                    className="w-7 h-7 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition active:scale-90"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="mt-1.5 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${tone.bar}`}
                  style={{ width: `${Math.min(100, ratio * 100)}%` }}
                />
              </div>
              <div className={`mt-1 text-xs font-medium ${tone.text}`}>
                {level === "over"
                  ? `Te has pasado ${format(-remaining)} (${Math.round(ratio * 100)} %)`
                  : level === "warn"
                    ? `Cuidado: ${Math.round(ratio * 100)} %. Te quedan ${format(remaining)}`
                    : `Te quedan ${format(remaining)} (${Math.round(ratio * 100)} % usado)`}
              </div>
              {editing === b.category && form}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
