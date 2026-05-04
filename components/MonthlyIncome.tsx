"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, ProgressBar, SectionTitle } from "./Card";
import { useFormatMoney, useRumbo } from "@/lib/store";
import { CURRENCIES, Currency, formatCurrency } from "@/lib/currency";
import { formatDate } from "@/lib/utils";

export function MonthlyIncome() {
  const {
    finances,
    addFinance,
    removeFinance,
    onboarding,
    primaryCurrency,
    amountInPrimary,
  } = useRumbo();
  const format = useFormatMoney();

  const now = new Date();
  const monthLabel = now.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const currentKey = monthKey(now);

  const baseSalary = onboarding?.current_monthly_income ?? 0;
  const monthlyTarget = onboarding?.monthly_target ?? 0;

  const thisMonthEntries = useMemo(
    () =>
      finances
        .filter(
          (f) =>
            f.type === "ingreso" &&
            monthKey(new Date(f.date)) === currentKey
        )
        .sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [finances, currentKey]
  );

  // Recurring incomes logic (similar to subscriptions)
  const recurringIncomes = useMemo(() => {
    const seen = new Map<string, typeof finances[0]>();
    finances
      .filter((f) => f.type === "ingreso" && f.recurrence === "mensual")
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .forEach((f) => {
        const key = f.title.toLowerCase().trim();
        if (!seen.has(key)) seen.set(key, f);
      });
    return Array.from(seen.values()).sort(
      (a, b) => amountInPrimary(b) - amountInPrimary(a)
    );
  }, [finances, amountInPrimary]);

  const earnedThisMonth =
    baseSalary +
    thisMonthEntries.reduce((a, b) => a + amountInPrimary(b), 0);

  const animated = useCounter(earnedThisMonth);

  const progress = monthlyTarget
    ? Math.min(100, (earnedThisMonth / monthlyTarget) * 100)
    : 0;

  const last6 = useMemo(() => {
    const buckets = new Map<string, { label: string; total: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d);
      buckets.set(key, {
        label: d.toLocaleDateString("es-ES", { month: "short" }),
        total: 0,
      });
    }
    finances
      .filter((f) => f.type === "ingreso")
      .forEach((f) => {
        const k = monthKey(new Date(f.date));
        if (buckets.has(k)) {
          buckets.get(k)!.total += amountInPrimary(f);
        }
      });
    if (baseSalary > 0) {
      buckets.forEach((b) => (b.total += baseSalary));
    }
    return Array.from(buckets.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finances, baseSalary, amountInPrimary]);

  const [form, setForm] = useState<{
    title: string;
    amount: number | "";
    currency: Currency;
    recurrence: "" | "mensual";
  }>({
    title: "",
    amount: "",
    currency: primaryCurrency,
    recurrence: "",
  });

  useEffect(() => {
    setForm((f) => ({ ...f, currency: primaryCurrency }));
  }, [primaryCurrency]);

  function submit() {
    if (!form.title || typeof form.amount !== "number" || form.amount <= 0)
      return;
    addFinance({
      type: "ingreso",
      title: form.title,
      amount: form.amount,
      currency: form.currency,
      date: new Date().toISOString(),
      ...(form.recurrence ? { recurrence: form.recurrence } : {}),
    });
    setForm({ title: "", amount: "", currency: primaryCurrency, recurrence: "" });
  }

  return (
    <Card>
      <SectionTitle
        title={`Ingresos de ${monthLabel}`}
        hint="Apunta cada cobro o ingreso. Tu contador se actualiza al instante."
      />

      <div className="flex flex-col gap-6">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-violet-50 border border-rumbo-line p-8 text-center">
          <div className="text-xs uppercase tracking-[0.2em] text-rumbo-muted font-bold mb-2">
            Total ganado en {monthLabel.split(' ')[0]}
          </div>
          <motion.div
            key={earnedThisMonth}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-5xl md:text-7xl font-black tracking-tighter tabular-nums text-rumbo-ink"
          >
            {format(animated)}
          </motion.div>
          
          {monthlyTarget > 0 && (
            <div className="max-w-md mx-auto mt-6">
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2">
                <span className="text-rumbo-muted">Meta: {format(monthlyTarget)}</span>
                <span className="text-violet-600">{Math.round(progress)}%</span>
              </div>
              <ProgressBar value={progress} tone="violet" />
              <div className="text-sm text-rumbo-muted mt-3 font-medium">
                {earnedThisMonth >= monthlyTarget 
                  ? "🎉 ¡Objetivo conseguido!" 
                  : `Faltan ${format(monthlyTarget - earnedThisMonth)} para tu meta`
                }
              </div>
            </div>
          )}

          {baseSalary > 0 && (
            <div className="text-[10px] text-rumbo-muted mt-6 inline-block px-3 py-1 bg-white/50 rounded-full border border-rumbo-line">
              Incluye sueldo base de {format(baseSalary)}/mes
            </div>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_180px_120px_auto] gap-2">
        <input
          className="input"
          placeholder="Concepto (ej: Cliente A, factura mayo)"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
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
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
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
          + Añadir ingreso
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm text-rumbo-muted">
        <input
          type="checkbox"
          id="inc-rec-check"
          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
          checked={form.recurrence === "mensual"}
          onChange={(e) => setForm({ ...form, recurrence: e.target.checked ? "mensual" : "" })}
        />
        <label htmlFor="inc-rec-check" className="cursor-pointer select-none">🔁 Es un ingreso recurrente (mensual)</label>
      </div>

      {/* Recurring Incomes Section */}
      {recurringIncomes.length > 0 && (
        <div className="mt-8 border-t border-rumbo-line pt-5">
          <SectionTitle 
            title="Ingresos recurrentes activos" 
            hint="Estos ingresos se repiten cada mes automáticamente."
          />
          <div className="grid gap-2">
            <AnimatePresence>
              {recurringIncomes.map((s) => {
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
                        <span className="text-[10px] bg-emerald-100 text-emerald-900 px-1 rounded font-bold">🔁</span>
                        {s.title}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <div className="text-right">
                        <div className="font-medium text-sm text-emerald-600">
                          +{formatCurrency(s.amount, entryCurrency)}
                          <span className="text-[10px] text-rumbo-muted ml-1">/mes</span>
                        </div>
                        {isForeign && (
                          <div className="text-[10px] text-rumbo-muted">
                            ≈ +{format(amountInPrimary(s))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeFinance(s.id)}
                        className="text-rumbo-muted hover:text-rose-600 text-xs p-1"
                        aria-label="Eliminar ingreso recurrente"
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

      {/* Entries this month */}
      <div className="mt-8 border-t border-rumbo-line pt-5">
        <SectionTitle title="Movimientos de este mes" />
        <AnimatePresence>
          {thisMonthEntries.length === 0 ? (
            <div className="text-sm text-rumbo-muted py-3">
              Aún no has registrado ingresos este mes.
            </div>
          ) : (
            thisMonthEntries.map((f) => {
              const entryCurrency = f.currency ?? primaryCurrency;
              const isForeign = entryCurrency !== primaryCurrency;
              return (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-between py-2.5 border-b last:border-0 border-rumbo-line"
                >
                  <div>
                    <div className="font-medium">{f.title}</div>
                    <div className="text-xs text-rumbo-muted">
                      {formatDate(f.date)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-emerald-600 font-medium">
                        +{formatCurrency(f.amount, entryCurrency)}
                      </span>
                      {isForeign && (
                        <div className="text-[10px] text-rumbo-muted">
                          ≈ +{format(amountInPrimary(f))}
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
            })
          )}
        </AnimatePresence>
      </div>

      {/* Historical Chart at bottom */}
      <div className="mt-12 border-t border-rumbo-line pt-8">
        <SectionTitle 
          title="Histórico de ingresos" 
          hint="Comparativa de los últimos 6 meses."
        />
        <div className="h-48 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={last6}>
              <CartesianGrid stroke="#EEF0F4" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#6B7280", fontSize: 11 }}
              />
              <YAxis hide />
              <Tooltip
                formatter={(v: number) => format(v)}
                labelStyle={{ color: "#6B7280" }}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #EEF0F4",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="total" fill="#7C3AED" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

function useCounter(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const initial = value;
    const delta = target - initial;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(initial + delta * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return value;
}
