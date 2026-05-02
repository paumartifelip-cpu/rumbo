"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/Card";
import { CashflowHero } from "@/components/CashflowHero";
import { BubbleChart } from "@/components/BubbleChart";
import { Reveal } from "@/components/Reveal";
import { useRumbo } from "@/lib/store";
import { formatDate, formatMoney } from "@/lib/utils";

function useDateLabels() {
  const now = new Date();
  const today = now.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const month = now.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return { today, month };
}

export default function GastosPage() {
  const { finances, addFinance, removeFinance } = useRumbo();
  const { today, month } = useDateLabels();
  const [form, setForm] = useState({
    title: "",
    amount: "" as number | "",
    recurrence: "" as "" | "mensual",
  });

  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const now = new Date();
  const currentKey = monthKey(now);

  const thisMonth = useMemo(
    () =>
      finances
        .filter(
          (f) => f.type === "gasto" && monthKey(new Date(f.date)) === currentKey
        )
        .sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [finances, currentKey]
  );

  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    thisMonth.forEach((f) => {
      const k = f.category || "Pendiente…";
      map.set(k, (map.get(k) ?? 0) + f.amount);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [thisMonth]);

  function submit() {
    if (!form.title || typeof form.amount !== "number" || form.amount <= 0)
      return;
    addFinance({
      type: "gasto",
      title: form.title,
      amount: form.amount,
      date: new Date().toISOString(),
      ...(form.recurrence ? { recurrence: form.recurrence } : {}),
    });
    setForm({ title: "", amount: "", recurrence: "" });
  }

  return (
    <div>
      <PageHeader
        title="Gastos"
        subtitle={`Todo lo que añadas cuenta para ${month}.`}
      />
      <div className="text-2xl md:text-3xl font-semibold capitalize tracking-tight -mt-2 mb-6">
        📅 {today}
      </div>

      <Reveal>
        <div className="mb-6">
          <CashflowHero />
        </div>
      </Reveal>

      <Reveal delay={0.06}>
      <Card className="mb-6 card-hover">
        <SectionTitle
          title="Añadir gasto"
          hint="Solo el concepto y la cantidad. Gemini elige la categoría."
        />
        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-2">
          <input
            className="input"
            placeholder="Concepto (ej: Mercadona, Netflix, alquiler)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              className="input pr-8"
              placeholder="Cantidad"
              value={form.amount}
              onChange={(e) =>
                setForm({
                  ...form,
                  amount: e.target.value === "" ? "" : Number(e.target.value),
                })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rumbo-muted text-sm">
              €
            </span>
          </div>
          <button className="btn-primary" onClick={submit}>
            Añadir gasto
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm text-rumbo-muted">
          <input
            type="checkbox"
            id="rec-check"
            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
            checked={form.recurrence === "mensual"}
            onChange={(e) => setForm({ ...form, recurrence: e.target.checked ? "mensual" : "" })}
          />
          <label htmlFor="rec-check" className="cursor-pointer select-none">🔁 Es una suscripción o gasto fijo mensual</label>
        </div>
      </Card>
      </Reveal>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Reveal delay={0.1} className="lg:col-span-2">
        <Card className="card-hover">
          <SectionTitle
            title="Tus categorías de este mes"
            hint="Tamaño = cuánto. La IA agrupa los gastos similares."
          />
          {expensesByCategory.length === 0 ? (
            <EmptyState
              icon="💭"
              title="Aún sin gastos"
              description="Añade tu primer gasto y verás cómo se ordena solo."
            />
          ) : (
            <BubbleChart data={expensesByCategory} />
          )}
        </Card>
        </Reveal>

        <Reveal delay={0.14}>
        <Card className="card-hover">
          <SectionTitle title="Resumen por categoría" />
          {expensesByCategory.length === 0 ? (
            <div className="text-sm text-rumbo-muted py-6 text-center">
              Sin datos.
            </div>
          ) : (
            <div className="grid gap-1.5 text-sm">
              {expensesByCategory.map((c) => {
                const total = expensesByCategory.reduce(
                  (a, b) => a + b.value,
                  0
                );
                const pct = total ? (c.value / total) * 100 : 0;
                return (
                  <div
                    key={c.name}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate">{c.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-rumbo-muted text-xs">
                        {Math.round(pct)}%
                      </span>
                      <span className="font-medium">
                        {formatMoney(c.value)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        </Reveal>
      </div>

      <Reveal delay={0.18}>
      <Card className="card-hover">
        <SectionTitle
          title="Movimientos del mes"
          hint={`${thisMonth.length} gastos en ${now.toLocaleDateString(
            "es-ES",
            { month: "long", year: "numeric" }
          )}`}
        />
        {thisMonth.length === 0 ? (
          <EmptyState
            icon="🧾"
            title="Sin gastos este mes"
            description="Apunta el primero arriba."
          />
        ) : (
          <div>
            <AnimatePresence>
              {thisMonth.map((f) => (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-between py-3 border-b last:border-0 border-rumbo-line"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-1.5">
                        {f.title}
                        {f.recurrence && (
                          <span title="Gasto fijo mensual" className="text-[10px] bg-slate-100 px-1 rounded">🔁</span>
                        )}
                      </div>
                      <div className="text-xs text-rumbo-muted">
                        {formatDate(f.date)}
                        {" · "}
                        {f.category ? (
                          <span>{f.category}</span>
                        ) : (
                          <motion.span
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 1.2, repeat: Infinity }}
                          >
                            clasificando…
                          </motion.span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-rose-600 font-medium">
                      -{formatMoney(f.amount)}
                    </span>
                    <button
                      onClick={() => removeFinance(f.id)}
                      className="text-rumbo-muted hover:text-rose-600"
                      aria-label="Eliminar"
                    >
                      ✕
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Card>
      </Reveal>
    </div>
  );
}
