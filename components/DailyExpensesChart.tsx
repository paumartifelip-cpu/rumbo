"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useFormatMoney, useRumbo } from "@/lib/store";
import { FinancialEntry } from "@/lib/types";

export function DailyExpensesChart({
  expenses,
  selectedDate,
}: {
  expenses: FinancialEntry[];
  selectedDate: Date;
}) {
  const { amountInPrimary } = useRumbo();
  const formatMoney = useFormatMoney();

  const data = useMemo(() => {
    // Calcular el número de días del mes seleccionado
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Iniciar el array con todos los días a 0
    const days = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      spent: 0,
      isToday: false,
    }));

    // Marcar cuál es "hoy" si estamos viendo el mes en curso
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
    if (isCurrentMonth) {
      days[now.getDate() - 1].isToday = true;
    }

    // Agregar los gastos por día
    expenses.forEach((f) => {
      const d = new Date(f.date);
      const dayIndex = d.getDate() - 1;
      if (dayIndex >= 0 && dayIndex < daysInMonth) {
        days[dayIndex].spent += amountInPrimary(f);
      }
    });

    return days;
  }, [expenses, selectedDate, amountInPrimary]);

  const hasData = expenses.length > 0;

  if (!hasData) {
    return (
      <div className="text-sm text-rumbo-muted py-8 text-center">
        Aún no hay gastos registrados para trazar el ritmo diario.
      </div>
    );
  }

  return (
    <div className="h-52 mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="dec-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#E11D48" stopOpacity={0.5} />
            </linearGradient>
            <linearGradient id="dec-bar-today" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E11D48" stopOpacity={1} />
              <stop offset="100%" stopColor="#9F1239" stopOpacity={0.9} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(0,0,0,0.03)" vertical={false} />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            tickFormatter={(val) => (val % 5 === 0 || val === 1 ? val : "")}
          />
          <YAxis hide domain={[0, "dataMax"]} />
          <Tooltip
            formatter={(v: number) => [formatMoney(v), "Gastado"]}
            labelFormatter={(label) => `Día ${label}`}
            cursor={{ fill: "rgba(0,0,0,0.03)" }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #EEF0F4",
              fontSize: 12,
              padding: "6px 10px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
            }}
            labelStyle={{ color: "#64748B", fontSize: 11, marginBottom: 4 }}
          />
          <Bar dataKey="spent" radius={[4, 4, 0, 0]}>
            {data.map((entry) => {
              const fill = entry.isToday ? "url(#dec-bar-today)" : "url(#dec-bar)";
              const opacity = entry.spent === 0 ? 0 : 1;
              return <Cell key={entry.day} fill={fill} fillOpacity={opacity} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
