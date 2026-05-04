"use client";

import { useFormatMoney, useRumbo } from "@/lib/store";
import { ProgressBar } from "./Card";

export function MoneyMetrics({ compact = false }: { compact?: boolean }) {
  const { snapshots, onboarding, finances, amountInPrimary } = useRumbo();
  const formatMoney = useFormatMoney();

  const sortedSnaps = [...snapshots].sort(
    (a, b) => +new Date(a.date) - +new Date(b.date)
  );
  const latest = sortedSnaps[sortedSnaps.length - 1];

  const total = latest?.total ?? onboarding?.current_money ?? 0;
  const totalTarget = onboarding?.total_target ?? 0;

  // Ingresos del mes actual a partir de movimientos en finances + sueldo base.
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
      .reduce((a, b) => a + amountInPrimary(b), 0);
  const monthTarget = onboarding?.monthly_target ?? 0;

  const totalProgress = totalTarget
    ? Math.min(100, (total / totalTarget) * 100)
    : 0;
  const monthProgress = monthTarget
    ? Math.min(100, (monthIncome / monthTarget) * 100)
    : 0;

  return (
    <div
      className={
        compact
          ? "grid grid-cols-2 lg:grid-cols-4 gap-3"
          : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
      }
    >
      <Metric
        label="Tienes en total"
        value={total}
        target={totalTarget}
        progress={totalProgress}
        tone="green"
      />
      <Metric
        label="Quieres tener"
        value={totalTarget}
        muted
      />
      <Metric
        label="Ganas al mes"
        value={monthIncome}
        target={monthTarget}
        progress={monthProgress}
        tone="violet"
      />
      <Metric
        label="Quieres ganar"
        value={monthTarget}
        suffix="/ mes"
        muted
      />
    </div>
  );
}

function Metric({
  label,
  value,
  target,
  progress,
  tone = "green",
  muted,
  suffix,
}: {
  label: string;
  value: number;
  target?: number;
  progress?: number;
  tone?: "green" | "violet";
  muted?: boolean;
  suffix?: string;
}) {
  const formatMoney = useFormatMoney();
  return (
    <div className="card p-4">
      <div className="text-[11px] uppercase tracking-wider text-rumbo-muted">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5 mt-1.5">
        <div
          className={`text-2xl md:text-[28px] font-semibold tracking-tight ${
            muted ? "text-rumbo-muted" : "text-rumbo-ink"
          }`}
        >
          {formatMoney(value)}
        </div>
        {suffix && <span className="text-xs text-rumbo-muted">{suffix}</span>}
      </div>
      {target !== undefined && progress !== undefined && (
        <>
          <div className="mt-3">
            <ProgressBar value={progress} tone={tone} />
          </div>
          <div className="text-[11px] text-rumbo-muted mt-1.5">
            {progress.toFixed(0)}% · faltan{" "}
            {formatMoney(Math.max(0, target - value))}
          </div>
        </>
      )}
    </div>
  );
}
