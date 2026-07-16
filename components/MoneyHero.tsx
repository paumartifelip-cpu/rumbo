"use client";

import { motion } from "framer-motion";
import { useFormatMoney, useRumbo } from "@/lib/store";

export function MoneyHero() {
  const { snapshots, onboarding, finances, amountInPrimary, adjustedBaseSalary } = useRumbo();
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
  const totalMissing = Math.max(0, totalTarget - total);
  const monthDelta = latest && previous ? latest.total - previous.total : null;

  // Ingresos del mes — mismo cálculo que la pantalla de inicio, para que las
  // dos pantallas cuenten siempre la misma historia.
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const monthIncome =
    adjustedBaseSalary(monthKey) +
    finances
      .filter(
        (f) =>
          f.type === "ingreso" &&
          new Date(f.date).getMonth() === now.getMonth() &&
          new Date(f.date).getFullYear() === now.getFullYear()
      )
      .reduce((a, b) => a + amountInPrimary(b), 0);
  const monthTarget = onboarding?.monthly_target ?? 0;
  const incomeProgress = monthTarget
    ? Math.min(100, (monthIncome / monthTarget) * 100)
    : 0;
  const incomeMissing = Math.max(0, monthTarget - monthIncome);

  return (
    <div className="card p-0 overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-rumbo-line">
        {/* Patrimonio total — discreto, en pequeño */}
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-rumbo-muted">
                💰 Patrimonio total
              </div>
              <div className="text-lg sm:text-xl font-semibold tracking-tight tabular-nums mt-0.5">
                {formatMoney(total)}
                {totalTarget > 0 && (
                  <span className="text-xs font-normal text-rumbo-muted ml-1.5">
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

          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-rumbo-muted">
            <span className="truncate">
              {monthDelta !== null
                ? `${monthDelta >= 0 ? "+" : ""}${formatMoney(monthDelta)} desde la última medición`
                : "Añade una medición para ver tu evolución"}
            </span>
            {totalTarget > 0 && totalMissing > 0 && (
              <span className="shrink-0">
                Faltan <span className="font-semibold text-rumbo-ink">{formatMoney(totalMissing)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Ingresos del mes — la línea clara, como la pantalla de inicio */}
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-rumbo-muted">
                📈 Ingresos del mes
              </div>
              <div className="text-lg sm:text-xl font-semibold tracking-tight tabular-nums mt-0.5 text-emerald-700">
                {formatMoney(monthIncome)}
                {monthTarget > 0 && (
                  <span className="text-xs font-normal text-rumbo-muted ml-1.5">
                    de {formatMoney(monthTarget)}
                  </span>
                )}
              </div>
            </div>
            {monthTarget > 0 && (
              <span className="chip bg-violet-100 text-violet-700 font-bold shrink-0">
                {Math.round(incomeProgress)}%
              </span>
            )}
          </div>

          {monthTarget > 0 ? (
            <>
              <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-violet-600 to-indigo-600"
                  initial={false}
                  animate={{ width: `${incomeProgress}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-rumbo-muted">
                <span className="truncate">{formatMoney(monthIncome)} ganados</span>
                <span className="shrink-0">
                  {incomeMissing > 0 ? (
                    <>
                      Faltan <span className="font-semibold text-violet-700">{formatMoney(incomeMissing)}</span> para tu meta
                    </>
                  ) : (
                    <span className="font-semibold text-emerald-700">🎉 Meta conseguida</span>
                  )}
                </span>
              </div>
            </>
          ) : (
            <div className="mt-2 text-xs text-rumbo-muted">
              Define tu meta mensual en "Mis metas" para ver la línea de progreso.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
