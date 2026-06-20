"use client";

import { motion } from "framer-motion";
import { useFormatMoney, useRumbo } from "@/lib/store";

export function MoneyHero() {
  const { snapshots, onboarding } = useRumbo();
  const formatMoney = useFormatMoney();

  const sortedSnaps = [...snapshots].sort(
    (a, b) => +new Date(a.date) - +new Date(b.date)
  );
  const latest = sortedSnaps[sortedSnaps.length - 1];
  const previous = sortedSnaps[sortedSnaps.length - 2];

  const total = latest?.total ?? onboarding?.current_money ?? 0;
  const totalTarget = onboarding?.total_target ?? 0;
  const totalProgress = totalTarget
    ? Math.min(100, (total / totalTarget) * 100)
    : 0;
  const missing = Math.max(0, totalTarget - total);
  const monthDelta = latest && previous ? latest.total - previous.total : null;

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-rumbo-muted">
            Patrimonio total
          </div>
          <div className="text-xl sm:text-2xl font-semibold tracking-tight tabular-nums mt-0.5">
            {formatMoney(total)}
            {totalTarget > 0 && (
              <span className="text-sm font-normal text-rumbo-muted ml-1.5">
                de {formatMoney(totalTarget)}
              </span>
            )}
          </div>
        </div>
        {totalTarget > 0 && (
          <span className="chip bg-green-100 text-green-900 font-bold shrink-0">
            {Math.round(totalProgress)}%
          </span>
        )}
      </div>

      {totalTarget > 0 && (
        <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-700 to-emerald-500"
            initial={false}
            animate={{ width: `${totalProgress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-3 text-xs text-rumbo-muted">
        <span className="truncate">
          {monthDelta !== null
            ? `${monthDelta >= 0 ? "+" : ""}${formatMoney(monthDelta)} desde la última medición`
            : "Añade una medición para ver tu evolución"}
        </span>
        {totalTarget > 0 && missing > 0 && (
          <span className="shrink-0">
            Faltan <span className="font-semibold text-rumbo-ink">{formatMoney(missing)}</span>
          </span>
        )}
      </div>
    </div>
  );
}
