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
    removeFinanceCascade,
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
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const toggleGroup = (key: string) =>
    setOpenGroups((o) => (o.includes(key) ? o.filter((x) => x !== key) : [...o, key]));

  // Movimientos del mes agrupados en desplegables (como las categorías de
  // gastos): puntuales por un lado, instancias de recurrentes por otro. Una
  // instancia generada se reconoce por el id determinista (__rec__) o porque
  // es la propia plantilla recurrente fechada este mes.
  const movementGroups = useMemo(() => {
    const isRecurrentRow = (f: (typeof thisMonthEntries)[number]) =>
      Boolean(f.recurrence) || f.id.includes("__rec__");
    const groups = [
      { key: "puntuales", icon: "💵", name: "Ingresos del mes", items: thisMonthEntries.filter((f) => !isRecurrentRow(f)) },
      { key: "recurrentes", icon: "🔁", name: "Recurrentes mensuales", items: thisMonthEntries.filter(isRecurrentRow) },
    ];
    return groups
      .map((g) => ({
        ...g,
        total: g.items.reduce((a, f) => a + amountInPrimary(f), 0),
        count: g.items.length,
      }))
      .filter((g) => g.count > 0);
  }, [thisMonthEntries, amountInPrimary]);

  // Deleting a recurring income removes the template AND all its generated months.
  const deleteSubscriptionCascade = (subId: string) => removeFinanceCascade(subId);

  const deleteSelectedSubscriptions = () => {
    selectedSubIds.forEach(deleteSubscriptionCascade);
    setSelectedSubIds([]);
  };

  // Deleting a single movement removes ONLY that row (tombstoned), never the
  // recurring template behind it.
  const deleteMovementCascade = (moveId: string) => removeFinance(moveId);

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
            className="text-4xl md:text-5xl font-black tracking-tighter tabular-nums text-rumbo-ink"
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

      {/* Entry Form Section — cantidad protagonista, estilo wallet */}
      <div className="mt-10 relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/50 p-5 sm:p-6">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="mb-5">
            <h3 className="text-lg font-black tracking-tight">💸 ¿Has recibido dinero?</h3>
            <p className="text-xs text-rumbo-muted mt-0.5">Apúntalo y tu contador se actualiza al momento.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-3">
            {/* Cantidad — el campo dominante */}
            <div className="flex items-baseline gap-2 bg-white border border-rumbo-line rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-transparent transition-shadow">
              <span className="text-2xl text-rumbo-muted font-light">
                {CURRENCIES[form.currency].symbol}
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0"
                autoComplete="off"
                aria-label="Cantidad del ingreso"
                className="w-full text-3xl font-semibold tabular-nums bg-transparent outline-none placeholder:text-slate-300"
                value={form.amount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    amount: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              />
            </div>
            <input
              className="input bg-white rounded-2xl !py-3 self-stretch h-auto"
              placeholder="Concepto (ej: Pago cliente, venta Wallapop…)"
              autoComplete="off"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
          </div>

          {/* Moneda — pills */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(Object.keys(CURRENCIES) as Currency[]).map((c) => {
              const active = form.currency === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, currency: c })}
                  aria-pressed={active}
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

          {/* Recurrente (switch) + CTA */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={form.recurrence === "mensual"}
              onClick={() => setForm({ ...form, recurrence: form.recurrence ? "" : "mensual" })}
              className="flex items-center gap-2.5 bg-white px-3.5 py-2 rounded-2xl border border-rumbo-line hover:border-emerald-400 transition-colors group"
            >
              <span
                className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${
                  form.recurrence ? "bg-emerald-500" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    form.recurrence ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </span>
              <span className="text-xs font-bold text-rumbo-ink">🔁 Se repite cada mes</span>
              <span className="text-[10px] text-rumbo-muted hidden sm:inline">nóminas, alquileres…</span>
            </button>
            <button
              className="sm:ml-auto px-8 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm shadow-lg shadow-emerald-200/60 transition active:scale-95"
              disabled={!form.title.trim() || typeof form.amount !== "number" || form.amount <= 0}
              onClick={submit}
            >
              Guardar ingreso →
            </button>
          </div>
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
        {thisMonthEntries.length === 0 ? (
          <div className="text-sm text-rumbo-muted py-3">
            Aún no has registrado ingresos este mes.
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-2.5">
            {movementGroups.map((g) => {
              const open = openGroups.includes(g.key);
              return (
                <div key={g.key} className="border border-rumbo-line rounded-2xl overflow-hidden bg-white">
                  {/* Cabecera del grupo — toca para desplegar */}
                  <button
                    onClick={() => toggleGroup(g.key)}
                    aria-expanded={open}
                    className="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-slate-50 transition-colors active:scale-[0.99]"
                  >
                    <span className="text-xl leading-none shrink-0">{g.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-rumbo-ink truncate">{g.name}</div>
                      <div className="text-xs text-rumbo-muted">{g.count} {g.count === 1 ? "ingreso" : "ingresos"}</div>
                    </div>
                    <span className="font-bold text-emerald-600 tabular-nums shrink-0">+{format(g.total)}</span>
                    <svg
                      width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                      className={`shrink-0 text-rumbo-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {/* Lista desplegada */}
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-3.5 pb-1 border-t border-rumbo-line">
                          {g.items.map((f) => {
                            const entryCurrency = f.currency ?? primaryCurrency;
                            const isForeign = entryCurrency !== primaryCurrency;
                            return (
                              <div
                                key={f.id}
                                className="flex items-center justify-between py-2.5 border-b last:border-0 border-rumbo-line/70 group"
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
                                  <div className="min-w-0">
                                    <div className="font-medium truncate flex items-center gap-1.5">
                                      {f.title}
                                      {(f.recurrence || f.id.includes("__rec__")) && (
                                        <span title="Ingreso recurrente mensual" className="text-[10px] bg-emerald-100 text-emerald-900 px-1 rounded">🔁</span>
                                      )}
                                    </div>
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
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
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
