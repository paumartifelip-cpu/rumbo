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
    <div className="h-96 mt-6">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={data} 
          margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
          barGap={12}
        >
          <defs>
            <linearGradient id="ingresoGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#064E3B" stopOpacity={1} />
              <stop offset="100%" stopColor="#064E3B" stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="gastoGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF0000" stopOpacity={1} />
              <stop offset="100%" stopColor="#FF0000" stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#F1F5F9" vertical={false} strokeDasharray="3 3" />
          <XAxis 
            dataKey="label" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "#94A3B8", fontSize: 12, fontWeight: 600 }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "#94A3B8", fontSize: 11 }}
            tickFormatter={(v) => formatMoney(v)}
          />
          <Tooltip
            cursor={{ fill: '#F8FAFC' }}
            formatter={(v: number) => [formatMoney(v), ""]}
            contentStyle={{
              borderRadius: 16,
              border: "none",
              boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)",
              padding: "12px 16px",
              fontWeight: "bold"
            }}
          />
          <Legend 
            verticalAlign="top" 
            align="right" 
            iconType="circle"
            iconSize={10}
            wrapperStyle={{ paddingBottom: 40, fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 10 }}
          />
          <Bar 
            name="Ingresos"
            dataKey="ingresos" 
            fill="url(#ingresoGrad)" 
            radius={[8, 8, 0, 0]} 
            barSize={24}
          />
          <Bar 
            name="Gastos"
            dataKey="gastos" 
            fill="url(#gastoGrad)" 
            radius={[8, 8, 0, 0]} 
            barSize={24}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
