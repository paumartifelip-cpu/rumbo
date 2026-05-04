"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { useFormatMoney, useRumbo } from "@/lib/store";

export function IncomeVsExpensesChart() {
  const { finances, amountInPrimary, onboarding } = useRumbo();
  const formatMoney = useFormatMoney();

  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

  const data = useMemo(() => {
    const now = new Date();
    const buckets = [];
    const isEntrepreneur = onboarding?.income_type === "empresario";
    const baseSalary = isEntrepreneur ? 0 : (onboarding?.current_monthly_income ?? 0);

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d);
      const label = d
        .toLocaleDateString("es-ES", { month: "short" })
        .replace(".", "");

      const income = finances
        .filter((f) => f.type === "ingreso" && monthKey(new Date(f.date)) === key)
        .reduce((a, b) => a + amountInPrimary(b), 0) + baseSalary;

      const expenses = finances
        .filter((f) => f.type === "gasto" && monthKey(new Date(f.date)) === key)
        .reduce((a, b) => a + amountInPrimary(b), 0);

      buckets.push({ label, ingresos: income, gastos: expenses });
    }
    return buckets;
  }, [finances, amountInPrimary, onboarding]);

  return (
    <div className="h-64 mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#EEF0F4" vertical={false} />
          <XAxis 
            dataKey="label" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "#6B7280", fontSize: 11 }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "#6B7280", fontSize: 11 }}
          />
          <Tooltip
            formatter={(v: number) => formatMoney(v)}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #EEF0F4",
              fontSize: 12,
            }}
          />
          <Legend 
            verticalAlign="top" 
            align="right" 
            iconType="circle"
            wrapperStyle={{ fontSize: 11, paddingBottom: 10 }}
          />
          <Bar 
            dataKey="ingresos" 
            fill="#064E3B" 
            radius={[4, 4, 0, 0]} 
            barSize={16}
          />
          <Bar 
            dataKey="gastos" 
            fill="#FF0000" 
            radius={[4, 4, 0, 0]} 
            barSize={16}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
