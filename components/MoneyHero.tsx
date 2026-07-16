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

  const total = latest?.total ?? onboarding?.current_money ?? 0;
  const totalTarget = onboarding?.total_target ?? 0;
  const totalProgress = totalTarget
    ? Math.min(100, (total / totalTarget) * 100)
    : 0;

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
      {/* Ingresos del mes — el protagonista */}
      <div className="p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-wider text-rumbo-muted font-bold">
            📈 Ingresos del mes
          </div>
          {monthTarget > 0 && (
            <span className="chip bg-violet-100 text-violet-700 font-bold shrink-0">
              {Math.round(incomeProgress)}%
            </span>
          )}
        </div>

        <div className="mt-2 text-4xl sm:text-5xl font-black tracking-tighter tabular-nums text-emerald-700">
          {formatMoney(monthIncome)}
          {monthTarget > 0 && (
            <span className="text-base sm:text-lg font-medium text-rumbo-muted ml-2 tracking-normal">
              de {formatMoney(monthTarget)}
            </span>
          )}
        </div>

        {monthTarget > 0 ? (
          <>
            <div className="mt-5 h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-violet-600 to-indigo-600"
                initial={false}
                animate={{ width: `${incomeProgress}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-3 text-sm text-rumbo-muted">
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
            Define tu meta mensual en &quot;Mis metas&quot; para ver la línea de progreso.
          </div>
        )}
      </div>

      {/* Patrimonio total — discreto, una sola línea sin barra */}
      <div className="px-5 sm:px-7 py-3 border-t border-rumbo-line bg-slate-50/60 flex items-center justify-between gap-3">
        <span className="text-xs text-rumbo-muted">💰 Patrimonio total</span>
        <span className="text-sm tabular-nums">
          <span className="font-semibold">{formatMoney(total)}</span>
          {totalTarget > 0 && (
            <span className="text-rumbo-muted">
              {" "}de {formatMoney(totalTarget)} · {Math.round(totalProgress)}%
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
