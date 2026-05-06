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
  const isEntrepreneur = onboarding?.income_type === "empresario";
  const monthIncome =
    (isEntrepreneur ? 0 : (onboarding?.current_monthly_income ?? 0)) +
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <PremiumMetric
        label="Patrimonio Total"
        value={total}
        target={totalTarget}
        progress={totalProgress}
        tone="emerald"
        icon="💎"
      />
      <PremiumMetric
        label="Ingreso Mensual"
        value={monthIncome}
        target={monthTarget}
        progress={monthProgress}
        tone="violet"
        icon="📈"
      />
    </div>
  );
}

function PremiumMetric({
  label,
  value,
  target,
  progress,
  tone,
  icon,
}: {
  label: string;
  value: number;
  target: number;
  progress: number;
  tone: "emerald" | "violet";
  icon: string;
}) {
  const formatMoney = useFormatMoney();
  
  const bgClass = tone === "emerald" 
    ? "bg-gradient-to-br from-emerald-950 to-slate-900 border-emerald-800 shadow-emerald-900/20" 
    : "bg-gradient-to-br from-violet-950 to-slate-900 border-violet-800 shadow-violet-900/20";
    
  const textClass = tone === "emerald" ? "text-emerald-400" : "text-violet-400";
  const progressBgClass = tone === "emerald" ? "bg-emerald-900/50" : "bg-violet-900/50";
  const progressFillClass = tone === "emerald" ? "bg-emerald-500" : "bg-violet-500";

  return (
    <div className={`relative overflow-hidden border rounded-2xl p-6 shadow-xl ${bgClass}`}>
      {/* Decorative Glow */}
      <div className={`absolute -top-12 -right-12 w-32 h-32 blur-3xl opacity-30 rounded-full ${progressFillClass}`}></div>
      
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{icon}</span>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {label}
            </span>
          </div>
          <div className="text-3xl md:text-4xl font-black text-white tracking-tight mt-1">
            {formatMoney(value)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Objetivo</div>
          <div className={`text-sm md:text-base font-bold ${textClass}`}>
            {formatMoney(target)}
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-8">
        <div className="flex justify-between items-end mb-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            Progreso
          </div>
          <div className="text-xs font-bold text-white">
            {progress.toFixed(1)}%
          </div>
        </div>
        
        {/* Premium Progress Bar */}
        <div className={`w-full h-3 rounded-full overflow-hidden ${progressBgClass}`}>
          <div 
            className={`h-full rounded-full transition-all duration-1000 ease-out ${progressFillClass}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <div className="text-[10px] text-slate-500 mt-2 font-medium tracking-wide">
          Faltan {formatMoney(Math.max(0, target - value))} para la meta
        </div>
      </div>
    </div>
  );
}
