"use client";

import { useMemo } from "react";
import { useFormatMoney, useRumbo } from "@/lib/store";
import { Card } from "./Card";
import { motion } from "framer-motion";

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <HeroMetric
        label="Tienes en total"
        value={formatMoney(total)}
        tone="green"
        icon="💰"
        progress={totalProgress}
      />
      <HeroMetric
        label="Has ganado este mes"
        value={formatMoney(monthIncome)}
        tone="green"
        icon="📈"
        progress={incomeProgress}
      />
      <HeroMetric
        label="Has gastado este mes"
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
  );
}

function RadialProgress({ progress, tone }: { progress: number; tone: "green" | "red" | "blue" }) {
  const color = tone === "green" ? "#064E3B" : tone === "red" ? "#FF0000" : "#4F46E5";
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative w-10 h-10">
      <svg className="w-full h-full -rotate-90">
        <circle
          cx="20"
          cy="20"
          r={radius}
          stroke="currentColor"
          strokeWidth="3.5"
          fill="transparent"
          className="text-slate-100"
        />
        <motion.circle
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          cx="20"
          cy="20"
          r={radius}
          stroke={color}
          strokeWidth="3.5"
          strokeDasharray={circumference}
          fill="transparent"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">
        {Math.round(progress)}%
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

  return (
    <Card className="p-8 flex flex-col justify-between hover:shadow-soft transition-all duration-300 relative overflow-hidden min-h-[160px]">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-widest text-rumbo-muted font-bold">
            {label}
          </span>
          {progress !== undefined ? (
            <RadialProgress progress={progress} tone={tone} />
          ) : (
            <span className="text-3xl">{icon}</span>
          )}
        </div>
        <div className={`text-3xl md:text-4xl font-bold tracking-tight leading-tight ${colors} ${isTask ? 'line-clamp-2' : ''}`}>
          {value}
        </div>
      </div>
    </Card>
  );
}
