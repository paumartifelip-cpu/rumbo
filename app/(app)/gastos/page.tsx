"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/Card";
import { CashflowHero } from "@/components/CashflowHero";
import { SpendingTrend } from "@/components/SpendingTrend";
import { Reveal } from "@/components/Reveal";
import { AddExpenseSheet } from "@/components/AddExpenseSheet";
import { useFormatMoney, useRumbo } from "@/lib/store";
import { CURRENCIES, Currency, formatCurrency } from "@/lib/currency";
import { formatDate } from "@/lib/utils";

// ─── Quick categories ────────────────────────────────────────────────────────
const QUICK_CATS = [
  { key: "Comida",      icon: "🍽️", label: "Comida" },
  { key: "Transporte",  icon: "🚗", label: "Transporte" },
  { key: "Alojamiento", icon: "🏠", label: "Alojamiento" },
  { key: "Trabajo",     icon: "💼", label: "Trabajo" },
  { key: "Compras",     icon: "🛍️", label: "Compras" },
  { key: "Otros",       icon: "📦", label: "Otros" },
] as const;

type QuickCat = (typeof QUICK_CATS)[number]["key"] | null;

// Icon for each of the 6 fixed categories (anything else falls back to Otros)
const CAT_ICONS: Record<string, string> = {
  Comida: "🍽️", Transporte: "🚗", Alojamiento: "🏠", Trabajo: "💼", Compras: "🛍️", Otros: "📦",
};
const catIcon = (name: string) => CAT_ICONS[name] ?? "📦";

// ─── Inline category picker for existing entries ──────────────────────────────
function CategoryPicker({
  current,
  onChange,
}: {
  current?: string;
  onChange: (cat: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const match = QUICK_CATS.find((c) => c.key === current);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[11px] text-rumbo-muted hover:text-rumbo-ink transition-colors group"
        title="Cambiar categoría"
      >
        {match ? (
          <span>{match.icon} {match.label}</span>
        ) : current ? (
          <span>{current}</span>
        ) : (
          <span>sin categoría</span>
        )}
        <span className="opacity-0 group-hover:opacity-60 transition-opacity">✎</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-full mt-1 z-50 bg-white border border-rumbo-line rounded-2xl shadow-card p-1.5 flex gap-1"
          >
            {QUICK_CATS.map((c) => (
              <button
                key={c.key}
                onClick={() => { onChange(c.key); setOpen(false); }}
                className={`flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all hover:bg-slate-50 ${
                  current === c.key ? "bg-rumbo-ink text-white hover:bg-rumbo-ink" : "text-rumbo-ink"
                }`}
              >
                <span className="text-base leading-none">{c.icon}</span>
                <span className="leading-none">{c.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Date labels ──────────────────────────────────────────────────────────────
function useDateLabels(date: Date) {
  const isCurrentMonth = date.getMonth() === new Date().getMonth() && date.getFullYear() === new Date().getFullYear();
  const today = isCurrentMonth
    ? new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const month = date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return { today, month, isCurrentMonth };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function GastosPage() {
  const { finances, addFinance, updateFinance, removeFinance, primaryCurrency, amountInPrimary } = useRumbo();
  const format = useFormatMoney();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { today, month, isCurrentMonth } = useDateLabels(selectedDate);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<{
    title: string;
    amount: number | "";
    recurrence: "" | "mensual";
    currency: Currency;
    category: QuickCat;
  }>({ title: "", amount: "", recurrence: "", currency: primaryCurrency, category: null });

  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [selectedMoveIds, setSelectedMoveIds] = useState<string[]>([]);
  const [openCats, setOpenCats] = useState<string[]>([]);
  const toggleCat = (name: string) =>
    setOpenCats((o) => (o.includes(name) ? o.filter((x) => x !== name) : [...o, name]));

  useEffect(() => {
    setForm((f) => ({ ...f, currency: primaryCurrency }));
  }, [primaryCurrency]);

  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const currentKey = monthKey(selectedDate);

  const deleteSubscriptionCascade = (subId: string) => {
    const sub = finances.find((f) => f.id === subId);
    if (!sub) return;
    removeFinance(subId);
    const generatedCopy = finances.find(
      (f) =>
        f.type === "gasto" &&
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
        f.type === "gasto" &&
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

  const thisMonth = useMemo(
    () =>
      finances
        .filter((f) => f.type === "gasto" && monthKey(new Date(f.date)) === currentKey)
        .sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [finances, currentKey]
  );

  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    thisMonth.forEach((f) => {
      const k = f.category || "Pendiente…";
      map.set(k, (map.get(k) ?? 0) + amountInPrimary(f));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [thisMonth, amountInPrimary]);

  // Movements grouped into collapsible categories, each sorted by date (newest first).
  // Any category outside the 6 fixed ones is bucketed into "Otros".
  const expenseGroups = useMemo(() => {
    const map = new Map<string, typeof thisMonth>();
    thisMonth.forEach((f) => {
      const k = f.category && CAT_ICONS[f.category] ? f.category : "Otros";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(f);
    });
    return Array.from(map.entries())
      .map(([name, items]) => ({
        name,
        items: [...items].sort((a, b) => +new Date(b.date) - +new Date(a.date)),
        total: items.reduce((acc, f) => acc + amountInPrimary(f), 0),
        count: items.length,
      }))
      .sort((a, b) => b.total - a.total);
  }, [thisMonth, amountInPrimary]);

  const subscriptions = useMemo(() => {
    // Dedupe defensively: never show the same subscription twice. Key by
    // normalized title + amount + recurrence; keep the earliest-created one.
    const seen = new Map<string, (typeof finances)[number]>();
    finances
      .filter((f) => f.type === "gasto" && f.recurrence)
      .forEach((f) => {
        const key = `${f.title.trim().toLowerCase()}|${f.amount}|${f.recurrence}`;
        const prev = seen.get(key);
        if (!prev || (f.created_at ?? "") < (prev.created_at ?? "")) seen.set(key, f);
      });
    return Array.from(seen.values()).sort((a, b) => amountInPrimary(b) - amountInPrimary(a));
  }, [finances, amountInPrimary]);

  const totalMonthlySubscriptions = useMemo(
    () => subscriptions.reduce((acc, f) => {
      const amt = amountInPrimary(f);
      if (f.recurrence === "mensual") return acc + amt;
      if (f.recurrence === "anual") return acc + amt / 12;
      return acc;
    }, 0),
    [subscriptions, amountInPrimary]
  );

  function submit() {
    if (!form.title || typeof form.amount !== "number" || form.amount <= 0) return;
    addFinance({
      type: "gasto",
      title: form.title,
      amount: form.amount,
      currency: form.currency,
      date: selectedDate.toISOString(),
      ...(form.recurrence ? { recurrence: form.recurrence } : {}),
      ...(form.category ? { category: form.category } : {}),
    });
    setForm({ title: "", amount: "", recurrence: "", currency: primaryCurrency, category: null });
  }

  return (
    <div>
      <PageHeader title="Gastos" subtitle={`Todo lo que añadas cuenta para ${month}.`} />
      <div className="flex items-center gap-2 -mt-2 mb-6">
        <button
          onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))}
          aria-label="Mes anterior"
          className="w-11 h-11 -ml-2 flex items-center justify-center rounded-xl hover:bg-slate-100 text-rumbo-muted hover:text-rumbo-ink transition-colors active:scale-95"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div className="text-xl md:text-3xl font-semibold capitalize tracking-tight flex-1 text-center md:text-left">
          {isCurrentMonth ? `📅 ${today}` : today}
        </div>
        <button
          onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))}
          aria-label="Mes siguiente"
          className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl hover:bg-slate-100 text-rumbo-muted hover:text-rumbo-ink transition-colors active:scale-95"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>

      {/* ── Add expense form (desktop only — móvil usa el FAB) ── */}
      <Reveal className="hidden md:block">
        <Card className="mb-6 card-hover border-emerald-100 shadow-sm">
          <SectionTitle
            title="Añadir gasto"
            hint={form.category ? `Categoría: ${form.category}` : "Sin categoría → se asigna por reglas"}
          />
          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_120px_auto] gap-2">
            <input
              className="input"
              placeholder="Concepto (ej: Mercadona, Netflix, alquiler)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                className="input pr-10"
                placeholder="Cantidad"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value === "" ? "" : Number(e.target.value) })}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rumbo-muted text-sm">
                {CURRENCIES[form.currency].symbol}
              </span>
            </div>
            <select
              className="input"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value as Currency })}
            >
              {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
                <option key={c} value={c}>{CURRENCIES[c].flag} {c}</option>
              ))}
            </select>
            <button className="btn-primary" onClick={submit}>Añadir</button>
          </div>

          {/* Quick category picker */}
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_CATS.map((c) => {
              const active = form.category === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setForm({ ...form, category: active ? null : c.key })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 ${
                    active
                      ? "bg-rumbo-ink text-white border-rumbo-ink shadow-sm"
                      : "bg-white text-rumbo-muted border-rumbo-line hover:border-rumbo-ink hover:text-rumbo-ink"
                  }`}
                >
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                </button>
              );
            })}
            {form.category && (
              <button
                onClick={() => setForm({ ...form, category: null })}
                className="px-3 py-1.5 rounded-full text-sm text-rumbo-muted hover:text-rose-600 transition-colors"
              >
                Clasificación automática
              </button>
            )}
          </div>

          {form.currency !== primaryCurrency && typeof form.amount === "number" && form.amount > 0 && (
            <div className="mt-2 text-xs text-rumbo-muted">
              ≈ {format(amountInPrimary({ id: "_", user_id: "_", type: "gasto", title: "_", amount: form.amount, currency: form.currency, date: selectedDate.toISOString(), created_at: new Date().toISOString() }))} en tu moneda principal
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

      {/* Tendencia mensual */}
      <Reveal delay={0.08}>
        <Card className="card-hover mb-6">
          <SectionTitle title="Tendencia mensual" hint="Últimos 6 meses. Barra oscura = mes actual." />
          <SpendingTrend />
        </Card>
      </Reveal>

      {/* Suscripciones — bloques claros, sin duplicados */}
      <Reveal delay={0.12}>
        <Card className="card-hover mb-6">
          <div className="flex justify-between items-center mb-3">
            <SectionTitle
              title="Suscripciones activas"
              hint={subscriptions.length > 0 ? `${format(totalMonthlySubscriptions)}/mes en fijos` : "Marca un gasto como 🔁 para verlo aquí"}
            />
            {selectedSubIds.length > 0 && (
              <button
                onClick={deleteSelectedSubscriptions}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95 flex items-center gap-1"
              >
                ✕ Eliminar ({selectedSubIds.length})
              </button>
            )}
          </div>
          {subscriptions.length === 0 ? (
            <EmptyState icon="🔁" title="Sin suscripciones" description="Al añadir un gasto, marca 'Es una suscripción' para que aparezca aquí." />
          ) : (
            <>
              <div className="text-2xl font-semibold tabular-nums mb-4">
                {format(totalMonthlySubscriptions)}
                <span className="text-sm font-normal text-rumbo-muted ml-1">/mes</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <AnimatePresence>
                  {subscriptions.map((s) => {
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
                          selected ? "border-rose-300 bg-rose-50/60" : "border-rumbo-line bg-white hover:border-rumbo-ink/30"
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
                            <span className="text-[10px] bg-slate-100 px-1 rounded shrink-0">🔁</span>
                            <span className="font-semibold text-sm truncate">{s.title}</span>
                          </div>
                          <button
                            onClick={() => deleteSubscriptionCascade(s.id)}
                            aria-label={`Eliminar suscripción ${s.title}`}
                            className="w-7 h-7 -mt-0.5 -mr-0.5 shrink-0 rounded-lg flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition active:scale-90"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="flex items-end justify-between gap-2">
                          <CategoryPicker
                            current={s.category}
                            onChange={(cat) => updateFinance(s.id, { category: cat })}
                          />
                          <div className="text-right">
                            <div className="font-bold text-rose-600 tabular-nums leading-tight">
                              {formatCurrency(s.amount, entryCurrency)}
                              <span className="text-[10px] text-rumbo-muted ml-0.5 font-normal">
                                /{s.recurrence === "anual" ? "año" : "mes"}
                              </span>
                            </div>
                            {isForeign && <div className="text-[10px] text-rumbo-muted">≈ {format(amountInPrimary(s))}</div>}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </>
          )}
        </Card>
      </Reveal>

      <div className="mb-6">
        <Reveal delay={0.1}>
          <Card className="card-hover">
            <SectionTitle title="Tus categorías de este mes" hint="Toca la categoría de cualquier gasto para cambiarla." />
            {expensesByCategory.length === 0 ? (
              <EmptyState icon="📊" title="Aún sin gastos" description="Añade tu primer gasto y verás cómo se ordena solo." />
            ) : (
              <div className="mt-4 flex flex-col gap-5">
                {expensesByCategory.map((c, i) => {
                  const maxVal = Math.max(...expensesByCategory.map((x) => x.value), 1);
                  const total = expensesByCategory.reduce((a, b) => a + b.value, 0);
                  const pct = total ? (c.value / total) * 100 : 0;
                  const barPct = (c.value / maxVal) * 100;
                  const colors = ["bg-indigo-500","bg-green-900","bg-amber-500","bg-red-600","bg-blue-500","bg-purple-500","bg-teal-500"];
                  return (
                    <div key={c.name} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-rumbo-ink capitalize">{c.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-rumbo-muted text-xs font-medium w-8 text-right">{Math.round(pct)}%</span>
                          <span className="font-bold text-rumbo-ink min-w-[4rem] text-right">{format(c.value)}</span>
                        </div>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barPct}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.05 }}
                          className={`h-full rounded-full ${colors[i % colors.length]}`}
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

      {/* Expense list */}
      <Reveal delay={0.18}>
        <Card className="card-hover">
          <div className="flex justify-between items-center mb-2">
            <SectionTitle
              title="Movimientos del mes"
              hint={`${thisMonth.length} gastos en ${selectedDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}`}
            />
            {selectedMoveIds.length > 0 && (
              <button
                onClick={deleteSelectedMovements}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95 flex items-center gap-1"
              >
                ✕ Eliminar ({selectedMoveIds.length})
              </button>
            )}
          </div>
          {thisMonth.length === 0 ? (
            <EmptyState icon="🧾" title="Sin gastos este mes" description="Apunta el primero arriba." />
          ) : (
            <div className="mt-2 flex flex-col gap-2.5">
              {expenseGroups.map((g) => {
                const open = openCats.includes(g.name);
                return (
                  <div key={g.name} className="border border-rumbo-line rounded-2xl overflow-hidden bg-white">
                    {/* Category header — tap to expand */}
                    <button
                      onClick={() => toggleCat(g.name)}
                      aria-expanded={open}
                      className="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-slate-50 transition-colors active:scale-[0.99]"
                    >
                      <span className="text-xl leading-none shrink-0">{catIcon(g.name)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-rumbo-ink capitalize truncate">{g.name}</div>
                        <div className="text-xs text-rumbo-muted">{g.count} {g.count === 1 ? "gasto" : "gastos"}</div>
                      </div>
                      <span className="font-bold text-rose-600 tabular-nums shrink-0">-{format(g.total)}</span>
                      <svg
                        width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                        className={`shrink-0 text-rumbo-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>

                    {/* Expanded list — gastos ordenados por fecha */}
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
                                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 transition-colors shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <div className="font-medium truncate flex items-center gap-1.5">
                                        {f.title}
                                        {f.recurrence && <span title="Gasto fijo mensual" className="text-[10px] bg-slate-100 px-1 rounded">🔁</span>}
                                      </div>
                                      <div className="flex items-center gap-1.5 text-xs text-rumbo-muted">
                                        <span>{formatDate(f.date)}</span>
                                        <span>·</span>
                                        <CategoryPicker
                                          current={f.category}
                                          onChange={(cat) => updateFinance(f.id, { category: cat })}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0 ml-2">
                                    <div className="text-right">
                                      <span className="text-rose-600 font-medium">-{formatCurrency(f.amount, entryCurrency)}</span>
                                      {isForeign && <div className="text-[10px] text-rumbo-muted">≈ -{format(amountInPrimary(f))}</div>}
                                    </div>
                                    <button
                                      onClick={() => deleteMovementCascade(f.id)}
                                      className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-100/50 shadow-sm transition active:scale-90"
                                      aria-label={`Eliminar gasto ${f.title}`}
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
        </Card>
      </Reveal>

      {/* FAB móvil — primary action siempre al alcance del pulgar */}
      <button
        type="button"
        onClick={() => setAddOpen(true)}
        aria-label="Añadir gasto"
        className="md:hidden fixed right-4 z-40 w-14 h-14 rounded-full bg-emerald-500 text-white text-3xl flex items-center justify-center shadow-[0_12px_28px_-6px_rgba(16,185,129,0.6)] active:scale-95 hover:bg-emerald-600 transition"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
      >
        <span aria-hidden="true" className="-mt-1 leading-none">+</span>
      </button>

      <AddExpenseSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        date={selectedDate}
      />
    </div>
  );
}
