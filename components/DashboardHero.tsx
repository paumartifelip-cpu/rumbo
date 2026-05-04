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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <HeroMetric
        label="Tienes en total"
        value={formatMoney(total)}
        tone="green"
        icon="💰"
      />
      <HeroMetric
        label="Has ganado este mes"
        value={formatMoney(monthIncome)}
        tone="green"
        icon="📈"
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

function HeroMetric({
  label,
  value,
  tone,
  icon,
  isTask = false,
}: {
  label: string;
  value: string;
  tone: "green" | "red" | "blue";
  icon: string;
  isTask?: boolean;
}) {
  const colors = {
    green: "text-green-900",
    red: "text-red-600 font-black",
    blue: "text-rumbo-ink",
  }[tone];

  return (
    <Card className="p-5 flex flex-col justify-between hover:shadow-soft transition-all duration-300">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wider text-rumbo-muted font-bold">
            {label}
          </span>
          <span className="text-lg">{icon}</span>
        </div>
        <div className={`text-xl md:text-2xl font-bold tracking-tight leading-tight ${colors} ${isTask ? 'line-clamp-2' : ''}`}>
          {value}
        </div>
      </div>
    </Card>
  );
}
