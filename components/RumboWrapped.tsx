"use client";

import { useMemo, useState, useEffect } from "react";
import { useFormatMoney, useRumbo } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";

// ─── helpers ────────────────────────────────────────────────────────────────

function pct(a: number, b: number) {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}

function topBy<T>(arr: T[], key: (x: T) => string, n = 1): string[] {
  const counts: Record<string, number> = {};
  for (const x of arr) {
    const k = key(x);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

// ─── slide configs ────────────────────────────────────────────────────────────

interface SlideData {
  bg: string;       // gradient class
  accent: string;   // accent colour class
  icon: string;
  title: string;
  hero: string;
  sub: string;
  detail?: string;
}

// ─── component ────────────────────────────────────────────────────────────────

export function RumboWrapped({ onClose }: { onClose: () => void }) {
  const { tasks, goals, finances, snapshots, onboarding, user } = useRumbo();
  const formatMoney = useFormatMoney();

  // ── compute stats ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const completed   = tasks.filter((t) => t.status === "completada");
    const pending     = tasks.filter((t) => t.status === "pendiente");
    const highImpact  = completed.filter((t) => (t.ai_priority_score ?? 0) >= 70);
    const totalMins   = completed.reduce((s, t) => s + (t.estimated_minutes ?? 0), 0);
    const topCat      = topBy(completed, (t) => t.goal_id ?? "sin objetivo")[0] ?? "—";
    const linkedGoal  = goals.find((g) => g.id === topCat);
    const topCatLabel = linkedGoal ? linkedGoal.title : "Tareas sin objetivo";

    const goalsCompleted = goals.filter((g) => g.status === "completado");
    const topGoalCat     = topBy(goals, (g) => g.category)[0] ?? "—";

    const incomes    = finances.filter((f) => f.type === "ingreso");
    const expenses   = finances.filter((f) => f.type === "gasto");
    const totalIn    = incomes.reduce((s, f) => s + (f.amount_in_primary ?? f.amount), 0);
    const totalOut   = expenses.reduce((s, f) => s + (f.amount_in_primary ?? f.amount), 0);
    const topExpCat  = topBy(expenses, (f) => f.category ?? "otros")[0] ?? "—";
    const topIncCat  = topBy(incomes,  (f) => f.category ?? "otros")[0] ?? "—";

    const latestSnap = snapshots.length
      ? [...snapshots].sort((a, b) => +new Date(b.date) - +new Date(a.date))[0].total
      : onboarding?.current_money ?? 0;

    return {
      totalTasks:      tasks.length,
      completedTasks:  completed.length,
      pendingTasks:    pending.length,
      highImpact:      highImpact.length,
      completionRate:  pct(completed.length, tasks.length),
      focusHours:      Math.round(totalMins / 60),
      topCatLabel,
      goalsTotal:      goals.length,
      goalsCompleted:  goalsCompleted.length,
      topGoalCat,
      totalIn,
      totalOut,
      netBalance:      totalIn - totalOut,
      topExpCat,
      topIncCat,
      latestSnap,
    };
  }, [tasks, goals, finances, snapshots, onboarding]);

  // ── slides ──────────────────────────────────────────────────────────────────
  const slides: SlideData[] = useMemo(() => [
    {
      bg: "from-violet-900 via-purple-900 to-indigo-900",
      accent: "text-violet-300",
      icon: "🚀",
      title: "Tu año en Rumbo",
      hero: user.name ? `Hola, ${user.name}` : "Tu resumen",
      sub: "Esto es todo lo que has construido. Es más de lo que crees.",
      detail: undefined,
    },
    {
      bg: "from-emerald-900 via-teal-900 to-cyan-900",
      accent: "text-emerald-300",
      icon: "✅",
      title: "Tareas completadas",
      hero: `${stats.completedTasks}`,
      sub: `de ${stats.totalTasks} tareas en total`,
      detail: `Tasa de finalización: ${stats.completionRate}%`,
    },
    {
      bg: "from-orange-900 via-red-900 to-rose-900",
      accent: "text-orange-300",
      icon: "⚡",
      title: "Alto impacto",
      hero: `${stats.highImpact}`,
      sub: "tareas de alto impacto completadas",
      detail: `${stats.focusHours > 0 ? `~${stats.focusHours}h de trabajo estimado` : "El impacto real no se mide en horas"}`,
    },
    {
      bg: "from-blue-900 via-indigo-900 to-violet-900",
      accent: "text-blue-300",
      icon: "🎯",
      title: "Tu zona de trabajo",
      hero: stats.topCatLabel.length > 22 ? stats.topCatLabel.slice(0, 22) + "…" : stats.topCatLabel,
      sub: "fue donde más te enfocaste",
      detail: undefined,
    },
    {
      bg: "from-amber-900 via-yellow-900 to-orange-900",
      accent: "text-amber-300",
      icon: "🏆",
      title: "Objetivos",
      hero: `${stats.goalsCompleted} / ${stats.goalsTotal}`,
      sub: "objetivos completados",
      detail: `Categoría favorita: ${stats.topGoalCat}`,
    },
    {
      bg: "from-slate-900 via-zinc-900 to-neutral-900",
      accent: "text-slate-300",
      icon: "💰",
      title: "Tus finanzas",
      hero: formatMoney(stats.totalIn),
      sub: "ingresos registrados",
      detail: `Gastos: ${formatMoney(stats.totalOut)} · Mayor gasto: ${stats.topExpCat}`,
    },
    {
      bg: "from-pink-900 via-rose-900 to-red-900",
      accent: "text-pink-300",
      icon: "📈",
      title: "Balance neto",
      hero: formatMoney(Math.abs(stats.netBalance)),
      sub: stats.netBalance >= 0 ? "de balance positivo 🎉" : "de balance negativo — toca ajustar",
      detail: `Patrimonio actual: ${formatMoney(stats.latestSnap)}`,
    },
    {
      bg: "from-violet-900 via-fuchsia-900 to-pink-900",
      accent: "text-fuchsia-300",
      icon: "🌟",
      title: "Resumen final",
      hero: "Sigue así",
      sub: `${stats.completedTasks} tareas. ${stats.goalsCompleted} objetivos. ${formatMoney(stats.netBalance >= 0 ? stats.netBalance : 0)} ahorrado.`,
      detail: "Cada día cuenta. Rumbo 🚀",
    },
  ], [stats, user.name, formatMoney]);

  const [slide, setSlide] = useState(0);
  const [dir, setDir]     = useState(1);
  const [auto, setAuto]   = useState(true);

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

  const s = slides[slide];

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
                className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight relative z-10"
              >
                {s.hero}
              </motion.div>

              {/* Sub */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-white/70 text-base font-medium mb-4 relative z-10"
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
