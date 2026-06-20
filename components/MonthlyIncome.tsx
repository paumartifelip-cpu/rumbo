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
    adjustedBaseSalary,
  } = useRumbo();
  const format = useFormatMoney();

  const now = new Date();
  const monthLabel = now.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const currentKey = monthKey(now);

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

  // Recurring incomes — deduped so the same one never shows twice.
  const recurringIncomes = useMemo(() => {
    const seen = new Map<string, (typeof finances)[number]>();
    finances
      .filter((f) => f.type === "ingreso" && f.recurrence === "mensual")
      .forEach((f) => {
        const key = `${f.title.trim().toLowerCase()}|${f.amount}|${f.currency ?? primaryCurrency}`;
        const prev = seen.get(key);
        if (!prev || (f.created_at ?? "") < (prev.created_at ?? "")) seen.set(key, f);
      });
    return Array.from(seen.values()).sort((a, b) => amountInPrimary(b) - amountInPrimary(a));
  }, [finances, amountInPrimary, primaryCurrency]);

  const totalMonthlyRecurring = useMemo(
    () => recurringIncomes.reduce((acc, f) => acc + amountInPrimary(f), 0),
    [recurringIncomes, amountInPrimary]
  );

  const currentBaseSalary = adjustedBaseSalary(currentKey);
  const earnedThisMonth =
    currentBaseSalary +
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
    buckets.forEach((val, k) => {
      val.total += adjustedBaseSalary(k);
    });
    return Array.from(buckets.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finances, amountInPrimary, adjustedBaseSalary]);

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

  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [selectedMoveIds, setSelectedMoveIds] = useState<string[]>([]);

  const deleteSubscriptionCascade = (subId: string) => {
    const sub = finances.find((f) => f.id === subId);
    if (!sub) return;
    removeFinance(subId);
    const generatedCopy = finances.find(
      (f) =>
        f.type === "ingreso" &&
        !f.recurrence &&
        f.title.toLowerCase().trim() === sub.title.toLowerCase().trim() &&
        monthKey(new Date(f.date)) === currentKey
    );
    if (generatedCopy) {
      removeFinance(generatedCopy.id);
    }
  };

  const deleteSelectedSubscriptions = () => {
    selectedSubIds.forEach(deleteSubscriptionCascade);
    setSelectedSubIds([]);
  };

  const deleteMovementCascade = (moveId: string) => {
    const move = finances.find((f) => f.id === moveId);
    if (!move) return;
    removeFinance(moveId);
    const matchingTemplate = finances.find(
      (f) =>
        f.type === "ingreso" &&
        f.recurrence &&
        f.title.toLowerCase().trim() === move.title.toLowerCase().trim()
    );
    if (matchingTemplate) {
      removeFinance(matchingTemplate.id);
    }
  };

  const deleteSelectedMovements = () => {
    selectedMoveIds.forEach(deleteMovementCascade);
    setSelectedMoveIds([]);
  };

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

          {currentBaseSalary > 0 && (
            <div className="text-[10px] text-rumbo-muted mt-6 inline-block px-3 py-1 bg-white/50 rounded-full border border-rumbo-line">
              Incluye sueldo base de {format(currentBaseSalary)}/mes
            </div>
          )}
        </div>
      </div>

      {/* Entry Form Section */}
      <div className="mt-12 bg-slate-50/50 rounded-3xl p-6 border border-rumbo-line shadow-inner">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-xl shadow-lg">
            💰
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight">¿Has recibido dinero?</h3>
            <p className="text-xs text-rumbo-muted font-medium italic">Anota cualquier entrada para que tu balance sea real.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3">
          <div className="relative group">
            <input
              className="input bg-white group-hover:border-emerald-400 transition-colors pl-10"
              placeholder="Concepto (ej: Pago cliente, venta Wallapop...)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg opacity-50 group-focus-within:opacity-100 transition-opacity">📝</span>
          </div>
          <div className="relative group">
            <input
              type="number"
              inputMode="numeric"
              className="input bg-white pr-10 group-hover:border-emerald-400 transition-colors"
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
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rumbo-muted text-sm font-bold">
              {CURRENCIES[form.currency].symbol}
            </span>
          </div>
          <button className="btn-primary bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 px-8" onClick={submit}>
            + Guardar ingreso
          </button>
        </div>

        {/* Moneda — botones (como categorías), no desplegable */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-rumbo-muted font-bold mr-1">Moneda</span>
          {(Object.keys(CURRENCIES) as Currency[]).map((c) => {
            const active = form.currency === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setForm({ ...form, currency: c })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 ${
                  active
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-white text-rumbo-muted border-rumbo-line hover:border-emerald-400 hover:text-emerald-700"
                }`}
              >
                <span>{CURRENCIES[c].flag}</span>
                <span>{c}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-3 text-sm text-rumbo-muted">
          <label className="flex items-center gap-2 cursor-pointer group bg-white px-3 py-1.5 rounded-full border border-rumbo-line hover:border-emerald-400 transition-colors">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
              checked={form.recurrence === "mensual"}
              onChange={(e) => setForm({ ...form, recurrence: e.target.checked ? "mensual" : "" })}
            />
            <span className="font-bold text-[11px] uppercase tracking-wider group-hover:text-emerald-700">🔁 Es un ingreso recurrente</span>
          </label>
          <span className="text-[10px] opacity-60">Ideal para nóminas o alquileres</span>
        </div>
      </div>

      {/* Ingresos recurrentes mensuales — apartado claro con bloques */}
      <div className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50/40 p-5">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl shadow-lg shrink-0">🔁</span>
            <div>
              <h3 className="text-lg font-black tracking-tight">Ingresos recurrentes mensuales</h3>
              <p className="text-xs text-rumbo-muted font-medium">
                {recurringIncomes.length > 0
                  ? `${format(totalMonthlyRecurring)}/mes garantizados · ${recurringIncomes.length} ${recurringIncomes.length === 1 ? "ingreso fijo" : "ingresos fijos"}`
                  : "Marca un ingreso como 🔁 al añadirlo para verlo aquí."}
              </p>
            </div>
          </div>
          {selectedSubIds.length > 0 && (
            <button
              onClick={deleteSelectedSubscriptions}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95 flex items-center gap-1 shrink-0"
            >
              ✕ Eliminar ({selectedSubIds.length})
            </button>
          )}
        </div>

        {recurringIncomes.length === 0 ? (
          <div className="text-sm text-rumbo-muted py-4 text-center">
            Aún no tienes ingresos recurrentes. Al añadir un ingreso, marca <span className="font-semibold">🔁 recurrente</span>.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <AnimatePresence>
              {recurringIncomes.map((s) => {
                const entryCurrency = s.currency ?? primaryCurrency;
                const isForeign = entryCurrency !== primaryCurrency;
                const selected = selectedSubIds.includes(s.id);
                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className={`relative flex flex-col gap-2 rounded-2xl border p-3.5 transition-colors ${
                      selected ? "border-rose-300 bg-rose-50/60" : "border-emerald-200 bg-white hover:border-emerald-400"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSubIds([...selectedSubIds, s.id]);
                            } else {
                              setSelectedSubIds(selectedSubIds.filter((id) => id !== s.id));
                            }
                          }}
                          className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 transition-colors shrink-0"
                        />
                        <span className="text-[10px] bg-emerald-100 text-emerald-900 px-1 rounded font-bold shrink-0">🔁</span>
                        <span className="font-semibold text-sm truncate">{s.title}</span>
                      </div>
                      <button
                        onClick={() => deleteSubscriptionCascade(s.id)}
                        aria-label="Eliminar ingreso recurrente"
                        className="w-7 h-7 -mt-0.5 -mr-0.5 shrink-0 rounded-lg flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition active:scale-90"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-600 tabular-nums leading-tight">
                        +{formatCurrency(s.amount, entryCurrency)}
                        <span className="text-[10px] text-rumbo-muted ml-0.5 font-normal">/mes</span>
                      </div>
                      {isForeign && (
                        <div className="text-[10px] text-rumbo-muted">≈ +{format(amountInPrimary(s))}</div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Entries this month */}
      <div className="mt-8 border-t border-rumbo-line pt-5">
        <div className="flex justify-between items-center mb-2">
          <SectionTitle title="Movimientos de este mes" />
          {selectedMoveIds.length > 0 && (
            <button
              onClick={deleteSelectedMovements}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95 flex items-center gap-1"
            >
              ✕ Eliminar ({selectedMoveIds.length})
            </button>
          )}
        </div>
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
                  className="flex items-center justify-between py-2.5 border-b last:border-0 border-rumbo-line group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedMoveIds.includes(f.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMoveIds([...selectedMoveIds, f.id]);
                        } else {
                          setSelectedMoveIds(selectedMoveIds.filter((id) => id !== f.id));
                        }
                      }}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 transition-colors"
                    />
                    <div>
                      <div className="font-medium">{f.title}</div>
                      <div className="text-xs text-rumbo-muted">
                        {formatDate(f.date)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
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
                      onClick={() => deleteMovementCascade(f.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-100/50 shadow-sm transition active:scale-90"
                      aria-label="Eliminar ingreso"
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
