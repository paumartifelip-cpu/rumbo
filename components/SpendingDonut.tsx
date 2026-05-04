"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { useFormatMoney, useRumbo } from "@/lib/store";

export function SpendingDonut() {
  const { finances, amountInPrimary } = useRumbo();
  const formatMoney = useFormatMoney();

  const data = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const categoryMap: Record<string, number> = {};
    finances
      .filter(
        (f) =>
          f.type === "gasto" &&
          new Date(f.date).getMonth() === currentMonth &&
          new Date(f.date).getFullYear() === currentYear
      )
      .forEach((f) => {
        const cat = f.category || "Otros";
        categoryMap[cat] = (categoryMap[cat] || 0) + amountInPrimary(f);
      });

    return Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [finances, amountInPrimary]);

  const COLORS = ["#0B1220", "#064E3B", "#FF0000", "#4F46E5", "#F59E0B", "#10B981"];

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-rumbo-muted text-sm">
        <span>No hay gastos este mes</span>
      </div>
    );
  }

  return (
    <div className="h-64 mt-4 relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(v: number) => formatMoney(v)}
            contentStyle={{ borderRadius: 12, border: "1px solid #EEF0F4" }}
          />
          <Legend 
            layout="vertical" 
            align="right" 
            verticalAlign="middle"
            iconType="circle"
            wrapperStyle={{ fontSize: 11, paddingLeft: 20 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
        <div className="text-[10px] uppercase text-rumbo-muted font-bold">Total</div>
        <div className="text-lg font-bold text-rumbo-ink">
          {formatMoney(data.reduce((a, b) => a + b.value, 0))}
        </div>
      </div>
    </div>
  );
}
