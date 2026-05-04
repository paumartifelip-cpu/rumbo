"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useFormatMoney, useRumbo } from "@/lib/store";
import { FinancialType } from "@/lib/types";

interface Spec {
  kind: "ingreso" | "gasto" | "ahorro";
  title: string;
  caption: string;
  color: string;
  gradFrom: string;
  gradTo: string;
  bg: string;
  text: string;
  ring: string;
  includeBaseSalary?: boolean;
}

const SPECS: Spec[] = [
  {
    kind: "ingreso",
    title: "Ganado este mes",
    caption: "Lo que has cobrado o facturado",
    color: "#16A34A",
    gradFrom: "#34D399",
    gradTo: "#16A34A",
    bg: "from-emerald-50 to-white",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
    includeBaseSalary: true,
  },
  {
    kind: "gasto",
    title: "Gastado este mes",
    caption: "Todo lo que ha salido",
    color: "#E11D48",
    gradFrom: "#FB7185",
    gradTo: "#E11D48",
    bg: "from-rose-50 to-white",
    text: "text-rose-700",
    ring: "ring-rose-200",
  },
  {
    kind: "ahorro",
    title: "Ahorrado este mes",
    caption: "Ingresos menos gastos",
    color: "#2563EB",
    gradFrom: "#60A5FA",
    gradTo: "#2563EB",
    bg: "from-blue-50 to-white",
    text: "text-blue-700",
    ring: "ring-blue-200",
  },
];

export function CashflowHero({ selectedDate }: { selectedDate: Date }) {
  const { finances, onboarding, amountInPrimary } = useRumbo();

  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const currentKey = monthKey(selectedDate);

  const cards = useMemo(
    () =>
      SPECS.map((spec) => {
        const baseSalary =
          (spec.includeBaseSalary || spec.kind === "ahorro")
            ? onboarding?.current_monthly_income ?? 0
            : 0;

        const sumFor = (type: FinancialType, key: string) =>
          finances
            .filter(
              (f) => f.type === type && monthKey(new Date(f.date)) === key
            )
            .reduce((a, b) => a + amountInPrimary(b), 0);

        const monthTotal =
          spec.kind === "ahorro"
            ? baseSalary +
              sumFor("ingreso", currentKey) -
              sumFor("gasto", currentKey)
            : baseSalary + sumFor(spec.kind as FinancialType, currentKey);

        const last6 = (() => {
          const buckets: Array<{ label: string; total: number }> = [];
          for (let i = 5; i >= 0; i--) {
            const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - i, 1);
            const key = monthKey(d);
            const label = d
              .toLocaleDateString("es-ES", { month: "short" })
              .replace(".", "");
            const base =
              (spec.includeBaseSalary || spec.kind === "ahorro")
                ? onboarding?.current_monthly_income ?? 0
                : 0;
            const total =
              spec.kind === "ahorro"
                ? base + sumFor("ingreso", key) - sumFor("gasto", key)
                : base + sumFor(spec.kind as FinancialType, key);
            buckets.push({ label, total });
          }
          return buckets;
        })();

        const last = last6[last6.length - 2]?.total ?? 0;
        const delta = monthTotal - last;

        return { spec, monthTotal, last6, delta };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finances, onboarding, currentKey, amountInPrimary]
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map(({ spec, monthTotal, last6, delta }) => (
        <Card
          key={spec.kind}
          spec={spec}
          monthTotal={monthTotal}
          last6={last6}
          delta={delta}
        />
      ))}
    </div>
  );
}

function Card({
  spec,
  monthTotal,
  last6,
  delta,
}: {
  spec: Spec;
  monthTotal: number;
  last6: Array<{ label: string; total: number }>;
  delta: number;
}) {
  const formatMoney = useFormatMoney();
  const animated = useCounter(monthTotal);
  const gradId = `g-${spec.kind}`;
  const isCurrentMonth = (i: number) => i === last6.length - 1;

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
      className={`card overflow-hidden p-5 bg-gradient-to-br ${spec.bg} relative`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-[11px] uppercase tracking-wider ${spec.text}`}>
            {spec.title}
          </div>
          <div className="text-xs text-rumbo-muted mt-0.5">{spec.caption}</div>
        </div>
        {delta !== 0 && (
          <span
            className={`chip ${
              spec.kind === "gasto"
                ? delta < 0
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-rose-100 text-rose-700"
                : delta > 0
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
            }`}
          >
            {delta >= 0 ? "+" : ""}
            {formatMoney(delta)}
          </span>
        )}
      </div>

      <motion.div
        key={monthTotal}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl sm:text-4xl md:text-[40px] font-semibold tracking-tight tabular-nums mt-2 break-words"
      >
        {formatMoney(animated)}
      </motion.div>

      <div className="h-32 mt-3 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={last6} margin={{ top: 10, right: 6, bottom: 0, left: 6 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={spec.gradFrom} stopOpacity={1} />
                <stop offset="100%" stopColor={spec.gradTo} stopOpacity={0.95} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(0,0,0,0.04)" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#6B7280", fontSize: 11 }}
            />
            <YAxis hide />
            <Tooltip
              formatter={(v: number) => formatMoney(v)}
              cursor={{ fill: "rgba(0,0,0,0.03)" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #EEF0F4",
                fontSize: 12,
                padding: "6px 10px",
              }}
              labelStyle={{ color: "#6B7280", fontSize: 11 }}
            />
            <Bar
              dataKey="total"
              radius={[8, 8, 0, 0]}
              fill={`url(#${gradId})`}
              isAnimationActive={true}
            >
              {last6.map((_, i) => (
                <Bar
                  key={i}
                  dataKey="total"
                  fillOpacity={isCurrentMonth(i) ? 1 : 0.55}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

function useCounter(target: number, duration = 800) {
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
