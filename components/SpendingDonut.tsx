"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
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

  const totalAmount = data.reduce((a, b) => a + b.value, 0);

  return (
    <div className="mt-6 flex items-center gap-4">
      <div className="h-64 w-64 relative shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={95}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index % COLORS.length]} 
                  className="hover:opacity-80 transition-opacity cursor-pointer outline-none"
                />
              ))}
            </Pie>
            <Tooltip 
              formatter={(v: number) => formatMoney(v)}
              contentStyle={{ 
                borderRadius: 16, 
                border: "none", 
                boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                fontWeight: "bold"
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Perfectly centered text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[10px] uppercase text-rumbo-muted font-black tracking-widest mb-1">Total</div>
          <div className="text-2xl font-black text-rumbo-ink tracking-tighter">
            {formatMoney(totalAmount).split(',')[0]}
          </div>
        </div>
      </div>

      {/* Manual Legend for better control */}
      <div className="flex-1 grid gap-2">
        {data.map((entry, index) => (
          <div key={entry.name} className="flex items-center justify-between group">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full shrink-0" 
                style={{ backgroundColor: COLORS[index % COLORS.length] }} 
              />
              <span className="text-xs font-bold text-rumbo-muted group-hover:text-rumbo-ink transition-colors">
                {entry.name}
              </span>
            </div>
            <span className="text-xs font-black text-rumbo-ink opacity-60 group-hover:opacity-100 transition-opacity">
              {formatMoney(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
