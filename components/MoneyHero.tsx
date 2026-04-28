"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  PolarAngleAxis,
} from "recharts";
import { useRumbo } from "@/lib/store";
import { formatMoney } from "@/lib/utils";

export function MoneyHero() {
  const { snapshots, onboarding, finances } = useRumbo();

  const sortedSnaps = [...snapshots].sort(
    (a, b) => +new Date(a.date) - +new Date(b.date)
  );
  const latest = sortedSnaps[sortedSnaps.length - 1];
  const previous = sortedSnaps[sortedSnaps.length - 2];

  const total = latest?.total ?? onboarding?.current_money ?? 0;
  const totalTarget = onboarding?.total_target ?? 0;

  const now = new Date();
  const monthIncome =
    (onboarding?.current_monthly_income ?? 0) +
    finances
      .filter(
        (f) =>
          f.type === "ingreso" &&
          new Date(f.date).getMonth() === now.getMonth() &&
          new Date(f.date).getFullYear() === now.getFullYear()
      )
      .reduce((a, b) => a + b.amount, 0);
  const monthTarget = onboarding?.monthly_target ?? 0;

  const totalProgress = totalTarget
    ? Math.min(100, (total / totalTarget) * 100)
    : 0;
  const monthProgress = monthTarget
    ? Math.min(100, (monthIncome / monthTarget) * 100)
    : 0;

  const monthDelta =
    latest && previous ? latest.total - previous.total : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <RadialCard
        title="Patrimonio total"
        subtitle="Lo que tienes vs lo que quieres tener"
        current={total}
        target={totalTarget}
        progress={totalProgress}
        from="#22C55E"
        to="#0EA5E9"
        accent="emerald"
        footer={
          monthDelta !== null
            ? `${monthDelta >= 0 ? "+" : ""}${formatMoney(monthDelta)} desde la última medición`
            : "Añade una medición en Dinero para ver tu evolución"
        }
      />
      <RadialCard
        title="Ingreso mensual"
        subtitle="Lo que ganas vs lo que quieres ganar"
        current={monthIncome}
        target={monthTarget}
        progress={monthProgress}
        from="#A78BFA"
        to="#F472B6"
        accent="violet"
        footer={
          monthTarget
            ? `Faltan ${formatMoney(Math.max(0, monthTarget - monthIncome))} este mes`
            : "Define tu objetivo mensual en Dinero"
        }
      />
    </div>
  );
}

function useCounter(target: number, duration = 900) {
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

function RadialCard({
  title,
  subtitle,
  current,
  target,
  progress,
  from,
  to,
  accent,
  footer,
}: {
  title: string;
  subtitle: string;
  current: number;
  target: number;
  progress: number;
  from: string;
  to: string;
  accent: "emerald" | "violet";
  footer?: string;
}) {
  const animatedCurrent = useCounter(current);
  const animatedProgress = useCounter(progress);
  const gradientId = useMemo(
    () => `g-${title.replace(/\s/g, "-")}`,
    [title]
  );

  const data = [{ name: title, value: animatedProgress, fill: `url(#${gradientId})` }];
  const missing = Math.max(0, target - current);

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 200, damping: 18 }}
      className="card p-6 overflow-hidden relative group"
    >
      <div
        className={`absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-30 ${
          accent === "emerald" ? "bg-emerald-300" : "bg-violet-300"
        }`}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-rumbo-muted">
              {title}
            </div>
            <div className="text-xs text-rumbo-muted mt-0.5">{subtitle}</div>
          </div>
          <span
            className={`chip ${
              accent === "emerald"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-violet-100 text-violet-700"
            }`}
          >
            {Math.round(progress)}%
          </span>
        </div>

        <div className="mt-2 grid grid-cols-[1fr_auto] gap-3 md:gap-4 items-center">
          <div className="min-w-0">
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight tabular-nums break-words"
            >
              {formatMoney(animatedCurrent)}
            </motion.div>
            <div className="text-xs sm:text-sm text-rumbo-muted mt-1">
              de {formatMoney(target)}
            </div>
            <div className="text-sm mt-3">
              <span className="text-rumbo-muted">Faltan</span>{" "}
              <span className="font-semibold">{formatMoney(missing)}</span>
            </div>
          </div>

          <div className="w-[120px] h-[120px] sm:w-[140px] sm:h-[140px] md:w-[160px] md:h-[160px] -mr-1 md:-mr-2 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="72%"
                outerRadius="100%"
                barSize={14}
                data={data}
                startAngle={90}
                endAngle={-270}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={from} />
                    <stop offset="100%" stopColor={to} />
                  </linearGradient>
                </defs>
                <PolarAngleAxis
                  type="number"
                  domain={[0, 100]}
                  angleAxisId={0}
                  tick={false}
                />
                <RadialBar
                  background={{ fill: "#F1F5F9" } as any}
                  dataKey="value"
                  cornerRadius={20}
                  isAnimationActive={false}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-4 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <motion.div
            className="h-full"
            style={{
              background: `linear-gradient(90deg, ${from}, ${to})`,
            }}
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>

        {footer && (
          <div className="text-xs text-rumbo-muted mt-3">{footer}</div>
        )}
      </div>
    </motion.div>
  );
}
