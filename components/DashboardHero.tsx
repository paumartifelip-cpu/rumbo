"use client";

import { useMemo } from "react";
import { useFormatMoney, useRumbo } from "@/lib/store";
import { Card } from "./Card";
import { motion } from "framer-motion";
import { Reveal } from "./Reveal";

export function DashboardHero() {
  const { snapshots, onboarding, finances, tasks, amountInPrimary } = useRumbo();
  const formatMoney = useFormatMoney();

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // 1. Tienes en total
  const sortedSnaps = [...snapshots].sort(
    (a, b) => +new Date(a.date) - +new Date(b.date)
  );
  const total = sortedSnaps[sortedSnaps.length - 1]?.total ?? onboarding?.current_money ?? 0;

  // 2. Cuanto he ganado al mes
  const isEntrepreneur = onboarding?.income_type === "empresario";
  const monthIncome =
    (isEntrepreneur ? 0 : (onboarding?.current_monthly_income ?? 0)) +
    finances
      .filter(
        (f) =>
          f.type === "ingreso" &&
          new Date(f.date).getMonth() === currentMonth &&
          new Date(f.date).getFullYear() === currentYear
      )
      .reduce((a, b) => a + amountInPrimary(b), 0);

  // 3. Cuanto he gastado al mes
  const monthSpent = finances
    .filter(
      (f) =>
        f.type === "gasto" &&
        new Date(f.date).getMonth() === currentMonth &&
        new Date(f.date).getFullYear() === currentYear
    )
    .reduce((a, b) => a + amountInPrimary(b), 0);

  // 4. Que tarea debo hacer ya
  const topTask = useMemo(() => {
    return tasks
      .filter((t) => t.status !== "completada" && t.status !== "descartada")
      .sort((a, b) => (b.ai_priority_score ?? 0) - (a.ai_priority_score ?? 0))[0];
  }, [tasks]);

  // 5. Progress values
  const totalTarget = onboarding?.total_target ?? 0;
  const totalProgress = totalTarget ? Math.min(100, (total / totalTarget) * 100) : 0;

  const monthTarget = onboarding?.monthly_target ?? 0;
  const incomeProgress = monthTarget ? Math.min(100, (monthIncome / monthTarget) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Monthly Goal Progress - HIGH IMPORTANCE */}
      {monthTarget > 0 && (
        <Reveal>
          <Card className="p-8 bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-2xl overflow-hidden relative">
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] font-black opacity-70 mb-2">
                    Progreso hacia tu meta de {formatMoney(monthTarget)}
                  </div>
                  <div className="text-4xl md:text-6xl font-black tracking-tighter">
                    Faltan {formatMoney(Math.max(0, monthTarget - monthIncome))}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-5xl md:text-7xl font-black tracking-tighter opacity-20 leading-none">
                    {Math.round(incomeProgress)}%
                  </div>
                </div>
              </div>
              <div className="mt-8 relative h-4 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${incomeProgress}%` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="absolute inset-y-0 left-0 bg-white shadow-[0_0_20px_rgba(255,255,255,0.5)] rounded-full"
                />
              </div>
              <div className="mt-4 flex justify-between text-sm font-bold opacity-80">
                <span>{formatMoney(monthIncome)} ganados</span>
                <span>{formatMoney(monthTarget)} meta</span>
              </div>
            </div>
            {/* Abstract background shape */}
            <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          </Card>
        </Reveal>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <HeroMetric
          label="Tienes en total"
          value={formatMoney(total)}
          tone="green"
          icon="💰"
          progress={totalProgress}
        />
        <HeroMetric
          label="Ingresos del mes"
          value={formatMoney(monthIncome)}
          tone="green"
          icon="📈"
          progress={incomeProgress}
        />
        <HeroMetric
          label="Gastos del mes"
          value={formatMoney(monthSpent)}
          tone="red"
          icon="📉"
        />
        <HeroMetric
          label="Tarea prioritaria"
          value={topTask?.title ?? "Sin tareas"}
          tone="blue"
          icon="🎯"
          isTask
        />
      </div>
    </div>
  );
}

function RadialProgress({ progress, tone }: { progress: number; tone: "green" | "red" | "blue" }) {
  const color = tone === "green" ? "#064E3B" : tone === "red" ? "#FF0000" : "#4F46E5";
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative w-24 h-24">
      <svg className="w-full h-full -rotate-90">
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          className="text-slate-200/50"
        />
        <motion.circle
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          cx="48"
          cy="48"
          r={radius}
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          fill="transparent"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-black leading-none">{Math.round(progress)}%</span>
      </div>
    </div>
  );
}

function HeroMetric({
  label,
  value,
  tone,
  icon,
  isTask = false,
  progress,
}: {
  label: string;
  value: string;
  tone: "green" | "red" | "blue";
  icon: string;
  isTask?: boolean;
  progress?: number;
}) {
  const colors = {
    green: "text-green-900",
    red: "text-red-600 font-black",
    blue: "text-rumbo-ink",
  }[tone];

  const bg = {
    green: "bg-emerald-50/40",
    red: "bg-rose-50/40",
    blue: "bg-indigo-50/40",
  }[tone];

  return (
    <Card className={`p-10 flex flex-col justify-center hover:shadow-2xl transition-all duration-500 relative overflow-hidden min-h-[260px] ${bg} border-none group`}>
      <div className="relative z-10 flex items-center justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.3em] text-rumbo-muted font-black mb-4 opacity-70 group-hover:opacity-100 transition-opacity">
            {label}
          </div>
          <div className={`text-4xl md:text-5xl font-black tracking-tighter leading-tight ${colors} ${isTask ? 'line-clamp-2' : ''}`}>
            {value}
          </div>
        </div>
        
        <div className="shrink-0 scale-110 group-hover:scale-125 transition-transform duration-500">
          {progress !== undefined ? (
            <RadialProgress progress={progress} tone={tone} />
          ) : (
            <div className="w-24 h-24 rounded-full bg-white/50 flex items-center justify-center text-5xl shadow-inner">
              {icon}
            </div>
          )}
        </div>
      </div>
      
      {/* Subtle background decoration */}
      <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/20 rounded-full blur-3xl group-hover:bg-white/40 transition-colors" />
    </Card>
  );
}
