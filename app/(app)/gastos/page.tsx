"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/Card";
import { CashflowHero } from "@/components/CashflowHero";
import { SpendingTrend } from "@/components/SpendingTrend";
import { Reveal } from "@/components/Reveal";
import { useFormatMoney, useRumbo } from "@/lib/store";
import { CURRENCIES, Currency, formatCurrency } from "@/lib/currency";
import { formatDate } from "@/lib/utils";

function useDateLabels(date: Date) {
  const isCurrentMonth = date.getMonth() === new Date().getMonth() && date.getFullYear() === new Date().getFullYear();
  const today = isCurrentMonth ? new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }) : date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const month = date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return { today, month, isCurrentMonth };
}

export default function GastosPage() {
  const {
    finances,
    addFinance,
    removeFinance,
    primaryCurrency,
    amountInPrimary,
  } = useRumbo();
  const format = useFormatMoney();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { today, month, isCurrentMonth } = useDateLabels(selectedDate);
  const [form, setForm] = useState<{
    title: string;
    amount: number | "";
    recurrence: "" | "mensual";
    currency: Currency;
  }>({
    title: "",
    amount: "",
    recurrence: "",
    currency: primaryCurrency,
  });

  // Sync form currency to primary when it changes (until user picks one).
  useEffect(() => {
    setForm((f) => ({ ...f, currency: primaryCurrency }));
  }, [primaryCurrency]);

  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const currentKey = monthKey(selectedDate);

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
      map.set(k, (map.get(k) ?? 0) + amountInPrimary(f));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [thisMonth, amountInPrimary]);

  // Deduplicated active subscriptions (most recent entry per title)
  const subscriptions = useMemo(() => {
    const seen = new Map<string, typeof finances[0]>();
    finances
      .filter((f) => f.type === "gasto" && f.recurrence)
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .forEach((f) => {
        const key = f.title.toLowerCase().trim();
        if (!seen.has(key)) seen.set(key, f);
      });
    return Array.from(seen.values()).sort(
      (a, b) => amountInPrimary(b) - amountInPrimary(a)
    );
  }, [finances, amountInPrimary]);

  const totalMonthlySubscriptions = useMemo(
    () =>
      subscriptions.reduce((acc, f) => {
        const amt = amountInPrimary(f);
        if (f.recurrence === "mensual") return acc + amt;
        if (f.recurrence === "anual") return acc + amt / 12;
        return acc;
      }, 0),
    [subscriptions, amountInPrimary]
  );

  function submit() {
    if (!form.title || typeof form.amount !== "number" || form.amount <= 0)
      return;
    addFinance({
      type: "gasto",
      title: form.title,
      amount: form.amount,
      currency: form.currency,
      date: selectedDate.toISOString(),
      ...(form.recurrence ? { recurrence: form.recurrence } : {}),
    });
    setForm({
      title: "",
      amount: "",
      recurrence: "",
      currency: primaryCurrency,
    });
  }

  return (
    <div>
      <PageHeader
        title="Gastos"
        subtitle={`Todo lo que añadas cuenta para ${month}.`}
      />
      <div className="flex items-center gap-4 -mt-2 mb-6">
        <button
          onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))}
          className="p-2 -ml-2 rounded-lg hover:bg-slate-100 text-rumbo-muted hover:text-rumbo-ink transition-colors"
          aria-label="Mes anterior"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div className="text-2xl md:text-3xl font-semibold capitalize tracking-tight flex-1">
          {isCurrentMonth ? `📅 ${today}` : today}
        </div>
        <button
          onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))}
          className="p-2 -mr-2 rounded-lg hover:bg-slate-100 text-rumbo-muted hover:text-rumbo-ink transition-colors"
          aria-label="Mes siguiente"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>

      <Reveal>
      <Card className="mb-6 card-hover border-emerald-100 shadow-sm">
        <SectionTitle
          title="Añadir gasto"
          hint="Concepto, cantidad y moneda. La IA elige la categoría."
        />
        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_120px_auto] gap-2">
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
              className="input pr-10"
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
              {CURRENCIES[form.currency].symbol}
            </span>
          </div>
          <select
            className="input"
            value={form.currency}
            onChange={(e) =>
              setForm({ ...form, currency: e.target.value as Currency })
            }
            aria-label="Moneda"
          >
            {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
              <option key={c} value={c}>
                {CURRENCIES[c].flag} {c}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={submit}>
            Añadir gasto
          </button>
        </div>
        {form.currency !== primaryCurrency && typeof form.amount === "number" && form.amount > 0 && (
          <div className="mt-2 text-xs text-rumbo-muted">
            ≈ {format(
              amountInPrimary({
                id: "_",
                user_id: "_",
                type: "gasto",
                title: "_",
                amount: form.amount,
                currency: form.currency,
                date: selectedDate.toISOString(),
                created_at: new Date().toISOString(),
              })
            )}{" "}
            en tu moneda principal
          </div>
        )}
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

      <Reveal delay={0.06}>
        <div className="mb-6">
          <CashflowHero selectedDate={selectedDate} />
        </div>
      </Reveal>

      {/* Tendencia + Suscripciones */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Reveal delay={0.08} className="lg:col-span-2">
          <Card className="card-hover h-full">
            <SectionTitle
              title="Tendencia mensual"
              hint="Últimos 6 meses. Barra oscura = mes actual."
            />
            <SpendingTrend />
          </Card>
        </Reveal>

        <Reveal delay={0.12}>
          <Card className="card-hover h-full">
            <SectionTitle
              title="Suscripciones activas"
              hint={
                subscriptions.length > 0
                  ? `${format(totalMonthlySubscriptions)}/mes en fijos`
                  : "Marca un gasto como 🔁 para verlo aquí"
              }
            />
            {subscriptions.length === 0 ? (
              <EmptyState
                icon="🔁"
                title="Sin suscripciones"
                description="Al añadir un gasto, marca 'Es una suscripción' para que aparezca aquí."
              />
            ) : (
              <div>
                <div className="text-2xl font-semibold tabular-nums mb-4">
                  {format(totalMonthlySubscriptions)}
                  <span className="text-sm font-normal text-rumbo-muted ml-1">/mes</span>
                </div>
                <div className="grid gap-2">
                  <AnimatePresence>
                    {subscriptions.map((s) => {
                      const entryCurrency = s.currency ?? primaryCurrency;
                      const isForeign = entryCurrency !== primaryCurrency;
                      return (
                        <motion.div
                          key={s.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center justify-between py-2 border-b last:border-0 border-rumbo-line"
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate flex items-center gap-1.5">
                              <span className="text-[10px] bg-slate-100 px-1 rounded">🔁</span>
                              {s.title}
                            </div>
                            {s.category && (
                              <div className="text-[11px] text-rumbo-muted mt-0.5">
                                {s.category}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <div className="text-right">
                              <div className="font-medium text-sm text-rose-600">
                                {formatCurrency(s.amount, entryCurrency)}
                                {s.recurrence === "anual" && (
                                  <span className="text-[10px] text-rumbo-muted ml-1">/año</span>
                                )}
                              </div>
                              {isForeign && (
                                <div className="text-[10px] text-rumbo-muted">
                                  ≈ {format(amountInPrimary(s))}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => removeFinance(s.id)}
                              className="text-rumbo-muted hover:text-rose-600 text-xs p-1"
                              aria-label="Eliminar suscripción"
                            >
                              ✕
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </Card>
        </Reveal>
      </div>

      <div className="mb-6">
        <Reveal delay={0.1}>
          <Card className="card-hover">
            <SectionTitle
              title="Tus categorías de este mes"
              hint="La IA agrupa los gastos automáticamente."
            />
            {expensesByCategory.length === 0 ? (
              <EmptyState
                icon="📊"
                title="Aún sin gastos"
                description="Añade tu primer gasto y verás cómo se ordena solo."
              />
            ) : (
              <div className="mt-4 flex flex-col gap-5">
                {expensesByCategory.map((c, i) => {
                  const maxVal = Math.max(...expensesByCategory.map(x => x.value), 1);
                  const total = expensesByCategory.reduce((a, b) => a + b.value, 0);
                  const pct = total ? (c.value / total) * 100 : 0;
                  const barPct = (c.value / maxVal) * 100;
                  // Use a nice array of colors for the bars
                  const colors = [
                    "bg-indigo-500",
                    "bg-emerald-500",
                    "bg-amber-500",
                    "bg-rose-500",
                    "bg-blue-500",
                    "bg-purple-500",
                    "bg-teal-500"
                  ];
                  const colorClass = colors[i % colors.length];

                  return (
                    <div key={c.name} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-rumbo-ink capitalize">{c.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-rumbo-muted text-xs font-medium w-8 text-right">{Math.round(pct)}%</span>
                          <span className="font-bold text-rumbo-ink min-w-[4rem] text-right">
                            {format(c.value)}
                          </span>
                        </div>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barPct}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.05 }}
                          className={`h-full rounded-full ${colorClass}`}
                        />
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
          hint={`${thisMonth.length} gastos en ${selectedDate.toLocaleDateString(
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
              {thisMonth.map((f) => {
                const entryCurrency = f.currency ?? primaryCurrency;
                const isForeign = entryCurrency !== primaryCurrency;
                return (
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
                          {(f.recurrence || subscriptions.some(s => s.title.toLowerCase().trim() === f.title.toLowerCase().trim())) && (
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
                      <div className="text-right">
                        <span className="text-rose-600 font-medium">
                          -{formatCurrency(f.amount, entryCurrency)}
                        </span>
                        {isForeign && (
                          <div className="text-[10px] text-rumbo-muted">
                            ≈ -{format(amountInPrimary(f))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeFinance(f.id)}
                        className="text-rumbo-muted hover:text-rose-600"
                        aria-label="Eliminar"
                      >
                        ✕
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </Card>
      </Reveal>
    </div>
  );
}
