"use client";

import { useMemo, useState, useEffect } from "react";
import { useFormatMoney, useRumbo } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";

// ─── helpers ────────────────────────────────────────────────────────────────

function pct(a: number, b: number) {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_ES[m - 1]} ${y}`;
}

interface SlideData {
  bg: string;
  accent: string;
  icon: string;
  title: string;
  hero: string;
  sub: string;
  detail?: string;
}

// ─── component ────────────────────────────────────────────────────────────────

export function RumboWrapped({ onClose }: { onClose: () => void }) {
  const { finances, snapshots, onboarding, user, amountInPrimary } = useRumbo();
  const formatMoney = useFormatMoney();

  // ── compute money-only stats ────────────────────────────────────────────────
  const stats = useMemo(() => {
    const amt = (f: (typeof finances)[number]) => amountInPrimary(f);
    const incomes = finances.filter((f) => f.type === "ingreso");
    const expenses = finances.filter((f) => f.type === "gasto");

    const totalIn = incomes.reduce((s, f) => s + amt(f), 0);
    const totalOut = expenses.reduce((s, f) => s + amt(f), 0);
    const net = totalIn - totalOut;
    const savingsRate = totalIn > 0 ? Math.round((net / totalIn) * 100) : 0;

    const mKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    // Monthly aggregation
    const inByMonth = new Map<string, number>();
    const outByMonth = new Map<string, number>();
    const activeMonths = new Set<string>();
    incomes.forEach((f) => {
      const k = mKey(new Date(f.date));
      inByMonth.set(k, (inByMonth.get(k) ?? 0) + amt(f));
      activeMonths.add(k);
    });
    expenses.forEach((f) => {
      const k = mKey(new Date(f.date));
      outByMonth.set(k, (outByMonth.get(k) ?? 0) + amt(f));
      activeMonths.add(k);
    });
    const monthsActive = Math.max(1, activeMonths.size);

    let bestIncomeMonth: { key: string; v: number } | null = null;
    inByMonth.forEach((v, key) => {
      if (!bestIncomeMonth || v > bestIncomeMonth.v) bestIncomeMonth = { key, v };
    });
    let worstExpenseMonth: { key: string; v: number } | null = null;
    outByMonth.forEach((v, key) => {
      if (!worstExpenseMonth || v > worstExpenseMonth.v) worstExpenseMonth = { key, v };
    });

    // Categories
    const byCat = new Map<string, number>();
    expenses.forEach((f) => {
      const k = f.category || "Otros";
      byCat.set(k, (byCat.get(k) ?? 0) + amt(f));
    });
    const topCat = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

    // Biggest single movements
    const biggestExpense = expenses.reduce<{ title: string; v: number } | null>(
      (best, f) => (!best || amt(f) > best.v ? { title: f.title, v: amt(f) } : best),
      null
    );
    const biggestIncome = incomes.reduce<{ title: string; v: number } | null>(
      (best, f) => (!best || amt(f) > best.v ? { title: f.title, v: amt(f) } : best),
      null
    );

    // Recurring (deduped by title+amount)
    const dedupe = (arr: typeof finances) => {
      const seen = new Map<string, (typeof finances)[number]>();
      arr.forEach((f) => {
        const key = `${f.title.trim().toLowerCase()}|${f.amount}|${f.recurrence}`;
        if (!seen.has(key)) seen.set(key, f);
      });
      return [...seen.values()];
    };
    const recurringExp = dedupe(expenses.filter((f) => f.recurrence));
    const monthlyFixed = recurringExp.reduce(
      (s, f) => s + (f.recurrence === "anual" ? amt(f) / 12 : amt(f)),
      0
    );
    const recurringInc = dedupe(incomes.filter((f) => f.recurrence === "mensual"));
    const monthlyRecurringIncome = recurringInc.reduce((s, f) => s + amt(f), 0);

    // Patrimony
    const sortedSnaps = [...snapshots].sort((a, b) => +new Date(a.date) - +new Date(b.date));
    const firstSnap = sortedSnaps[0]?.total ?? onboarding?.current_money ?? 0;
    const latestSnap = sortedSnaps[sortedSnaps.length - 1]?.total ?? onboarding?.current_money ?? 0;
    const growth = latestSnap - firstSnap;
    const target = onboarding?.total_target ?? 0;
    const targetPct = pct(latestSnap, target);

    // Averages & projection
    const avgMonthlyIn = totalIn / monthsActive;
    const avgMonthlyOut = totalOut / monthsActive;
    const avgMonthlyNet = net / monthsActive;
    const monthsToTarget =
      avgMonthlyNet > 0 && target > latestSnap
        ? Math.ceil((target - latestSnap) / avgMonthlyNet)
        : null;

    return {
      totalIn, totalOut, net, savingsRate,
      incomeCount: incomes.length, expenseCount: expenses.length,
      bestIncomeMonth: bestIncomeMonth as { key: string; v: number } | null,
      worstExpenseMonth: worstExpenseMonth as { key: string; v: number } | null,
      topCat, topCatPct: topCat ? pct(topCat[1], totalOut) : 0,
      biggestExpense, biggestIncome,
      monthlyFixed, recurringExpCount: recurringExp.length,
      monthlyRecurringIncome, recurringIncCount: recurringInc.length,
      firstSnap, latestSnap, growth, target, targetPct,
      avgMonthlyIn, avgMonthlyOut, avgMonthlyNet, monthsToTarget,
      monthsActive: activeMonths.size,
    };
  }, [finances, snapshots, onboarding, amountInPrimary]);

  // ── build slides (money only, skip the ones without data) ────────────────────
  const slides: SlideData[] = useMemo(() => {
    const out: SlideData[] = [];

    out.push({
      bg: "from-emerald-900 via-green-900 to-teal-900",
      accent: "text-emerald-300",
      icon: "💸",
      title: "Tu dinero en Rumbo",
      hero: user.name ? `Hola, ${user.name}` : "Tu resumen de dinero",
      sub: "Un repaso a todo lo que ha entrado, salido y crecido.",
      detail: stats.monthsActive > 0 ? `${stats.monthsActive} ${stats.monthsActive === 1 ? "mes" : "meses"} de actividad` : undefined,
    });

    out.push({
      bg: "from-emerald-900 via-teal-900 to-cyan-900",
      accent: "text-emerald-300",
      icon: "📥",
      title: "Total ingresado",
      hero: formatMoney(stats.totalIn),
      sub: "que ha entrado en total",
      detail: `${stats.incomeCount} ${stats.incomeCount === 1 ? "ingreso registrado" : "ingresos registrados"}`,
    });

    out.push({
      bg: "from-rose-900 via-red-900 to-orange-900",
      accent: "text-rose-300",
      icon: "📤",
      title: "Total gastado",
      hero: formatMoney(stats.totalOut),
      sub: "que ha salido en total",
      detail: `${stats.expenseCount} ${stats.expenseCount === 1 ? "gasto" : "gastos"} · media ${formatMoney(stats.avgMonthlyOut)}/mes`,
    });

    out.push({
      bg: stats.net >= 0 ? "from-green-900 via-emerald-900 to-teal-900" : "from-rose-900 via-red-900 to-rose-950",
      accent: stats.net >= 0 ? "text-emerald-300" : "text-rose-300",
      icon: stats.net >= 0 ? "🟢" : "🔴",
      title: "Balance neto",
      hero: `${stats.net >= 0 ? "+" : "−"}${formatMoney(Math.abs(stats.net))}`,
      sub: stats.net >= 0 ? "ahorrado: ingresos menos gastos" : "gastaste más de lo que ingresaste",
      detail: stats.totalIn > 0 ? `Tasa de ahorro: ${stats.savingsRate}%` : undefined,
    });

    if (stats.bestIncomeMonth) {
      out.push({
        bg: "from-violet-900 via-purple-900 to-indigo-900",
        accent: "text-violet-300",
        icon: "🚀",
        title: "Tu mejor mes",
        hero: formatMoney(stats.bestIncomeMonth.v),
        sub: `lo ganaste en ${monthLabel(stats.bestIncomeMonth.key)}`,
        detail: "Tu récord de ingresos en un mes",
      });
    }

    if (stats.topCat) {
      out.push({
        bg: "from-amber-900 via-orange-900 to-red-900",
        accent: "text-amber-300",
        icon: "🔥",
        title: "Donde más gastas",
        hero: stats.topCat[0],
        sub: `${formatMoney(stats.topCat[1])} en total`,
        detail: `El ${stats.topCatPct}% de todos tus gastos`,
      });
    }

    if (stats.monthlyFixed > 0) {
      out.push({
        bg: "from-fuchsia-900 via-pink-900 to-rose-900",
        accent: "text-fuchsia-300",
        icon: "🔁",
        title: "Tus gastos fijos",
        hero: `${formatMoney(stats.monthlyFixed)}/mes`,
        sub: `en ${stats.recurringExpCount} ${stats.recurringExpCount === 1 ? "suscripción" : "suscripciones"}`,
        detail: `Son ${formatMoney(stats.monthlyFixed * 12)} al año`,
      });
    }

    if (stats.monthlyRecurringIncome > 0) {
      out.push({
        bg: "from-teal-900 via-emerald-900 to-green-900",
        accent: "text-teal-300",
        icon: "💵",
        title: "Ingresos recurrentes",
        hero: `${formatMoney(stats.monthlyRecurringIncome)}/mes`,
        sub: `de ${stats.recurringIncCount} ${stats.recurringIncCount === 1 ? "fuente fija" : "fuentes fijas"}`,
        detail: `≈ ${formatMoney(stats.monthlyRecurringIncome * 12)} garantizados al año`,
      });
    }

    if (stats.biggestExpense && stats.biggestExpense.v > 0) {
      out.push({
        bg: "from-red-900 via-rose-900 to-pink-900",
        accent: "text-red-300",
        icon: "💥",
        title: "Tu mayor gasto",
        hero: formatMoney(stats.biggestExpense.v),
        sub: stats.biggestExpense.title,
        detail: "El golpe más grande a tu cuenta",
      });
    }

    if (stats.biggestIncome && stats.biggestIncome.v > 0) {
      out.push({
        bg: "from-emerald-900 via-green-800 to-lime-900",
        accent: "text-lime-300",
        icon: "🏆",
        title: "Tu mayor ingreso",
        hero: formatMoney(stats.biggestIncome.v),
        sub: stats.biggestIncome.title,
        detail: "El mejor cobro de todos",
      });
    }

    out.push({
      bg: "from-blue-900 via-indigo-900 to-violet-900",
      accent: "text-blue-300",
      icon: "⚖️",
      title: "Tu ritmo mensual",
      hero: `${formatMoney(stats.avgMonthlyIn)}`,
      sub: "ingresas al mes de media",
      detail: `Gastas ${formatMoney(stats.avgMonthlyOut)}/mes · ${stats.avgMonthlyNet >= 0 ? "ahorras" : "pierdes"} ${formatMoney(Math.abs(stats.avgMonthlyNet))}/mes`,
    });

    out.push({
      bg: "from-slate-900 via-zinc-900 to-neutral-900",
      accent: "text-slate-300",
      icon: "🏦",
      title: "Tu patrimonio",
      hero: formatMoney(stats.latestSnap),
      sub: stats.target > 0 ? `el ${stats.targetPct}% de tu meta de ${formatMoney(stats.target)}` : "lo que tienes ahora mismo",
      detail:
        stats.growth !== 0
          ? `${stats.growth > 0 ? "+" : "−"}${formatMoney(Math.abs(stats.growth))} desde tu primera medición`
          : undefined,
    });

    if (stats.monthsToTarget != null) {
      const years = Math.floor(stats.monthsToTarget / 12);
      const rem = stats.monthsToTarget % 12;
      const eta =
        years > 0
          ? `${years} ${years === 1 ? "año" : "años"}${rem ? ` y ${rem} ${rem === 1 ? "mes" : "meses"}` : ""}`
          : `${stats.monthsToTarget} ${stats.monthsToTarget === 1 ? "mes" : "meses"}`;
      out.push({
        bg: "from-indigo-900 via-violet-900 to-fuchsia-900",
        accent: "text-fuchsia-300",
        icon: "🎯",
        title: "A este ritmo…",
        hero: eta,
        sub: `para alcanzar tu meta de ${formatMoney(stats.target)}`,
        detail: `Ahorrando ${formatMoney(stats.avgMonthlyNet)}/mes`,
      });
    }

    out.push({
      bg: "from-emerald-900 via-teal-900 to-cyan-900",
      accent: "text-emerald-300",
      icon: "🌟",
      title: "En resumen",
      hero: stats.net >= 0 ? `+${formatMoney(stats.net)}` : `−${formatMoney(Math.abs(stats.net))}`,
      sub: `${formatMoney(stats.totalIn)} ingresados · ${formatMoney(stats.totalOut)} gastados`,
      detail: "Cada euro cuenta. Sigue tu rumbo 🚀",
    });

    return out;
  }, [stats, user.name, formatMoney]);

  const [slide, setSlide] = useState(0);
  const [dir, setDir] = useState(1);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => {
      if (slide < slides.length - 1) {
        setDir(1);
        setSlide((s) => s + 1);
      } else {
        setAuto(false);
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [slide, auto, slides.length]);

  function go(d: 1 | -1) {
    setAuto(false);
    const next = slide + d;
    if (next < 0 || next >= slides.length) return;
    setDir(d);
    setSlide(next);
  }

  const s = slides[Math.min(slide, slides.length - 1)];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm md:max-w-md">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/60 hover:text-white text-sm font-bold transition-colors"
        >
          ✕ Cerrar
        </button>

        {/* Card */}
        <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${s.bg} shadow-2xl aspect-[9/16] max-h-[85vh] flex flex-col`}>

          {/* Progress dots */}
          <div className="absolute top-5 left-5 right-5 flex gap-1 z-20">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => { setAuto(false); setDir(i > slide ? 1 : -1); setSlide(i); }}
                className="flex-1 h-1 rounded-full overflow-hidden bg-white/20 transition-colors"
              >
                <motion.div
                  className="h-full bg-white rounded-full"
                  animate={{ width: i < slide ? "100%" : i === slide ? "100%" : "0%" }}
                  initial={{ width: i < slide ? "100%" : "0%" }}
                  transition={i === slide && auto ? { duration: 4, ease: "linear" } : { duration: 0.2 }}
                />
              </button>
            ))}
          </div>

          {/* Tap zones */}
          <div className="absolute inset-0 z-10 flex">
            <div className="flex-1 cursor-pointer" onClick={() => go(-1)} />
            <div className="flex-1 cursor-pointer" onClick={() => go(1)} />
          </div>

          {/* Animated content */}
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={slide}
              custom={dir}
              variants={{
                enter:  (d) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }),
                center: { x: 0, opacity: 1 },
                exit:   (d) => ({ x: d > 0 ? "-100%" : "100%", opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center pointer-events-none"
            >
              {/* Ambient glow */}
              <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                <div className="w-64 h-64 rounded-full bg-white blur-[80px]" />
              </div>

              {/* Icon */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 400 }}
                className="text-6xl mb-6 relative z-10"
              >
                {s.icon}
              </motion.div>

              {/* Label */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
                className={`text-xs font-black uppercase tracking-[0.2em] mb-3 ${s.accent} relative z-10`}
              >
                {s.title}
              </motion.div>

              {/* Hero number / text */}
              <motion.div
                initial={{ y: 30, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
                className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight relative z-10 break-words max-w-full"
              >
                {s.hero}
              </motion.div>

              {/* Sub */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-white/70 text-base font-medium mb-4 relative z-10 break-words max-w-full"
              >
                {s.sub}
              </motion.div>

              {/* Detail */}
              {s.detail && (
                <motion.div
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className={`text-sm font-bold px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm ${s.accent} relative z-10`}
                >
                  {s.detail}
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Bottom nav */}
          <div className="absolute bottom-6 left-5 right-5 z-20 flex items-center justify-between">
            <button
              onClick={() => go(-1)}
              disabled={slide === 0}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center disabled:opacity-30 transition-colors text-lg font-bold"
            >
              ‹
            </button>
            <span className="text-white/40 text-xs font-bold">
              {slide + 1} / {slides.length}
            </span>
            <button
              onClick={() => go(1)}
              disabled={slide === slides.length - 1}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center disabled:opacity-30 transition-colors text-lg font-bold"
            >
              ›
            </button>
          </div>
        </div>

        {/* Restart */}
        {slide === slides.length - 1 && (
          <button
            onClick={() => { setSlide(0); setAuto(true); }}
            className="mt-4 w-full py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-colors"
          >
            🔄 Ver de nuevo
          </button>
        )}
      </div>
    </div>
  );
}
