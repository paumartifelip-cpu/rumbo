"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useFormatMoney, useRumbo } from "@/lib/store";

export function SavingsChart() {
  const { finances, amountInPrimary } = useRumbo();
  const formatMoney = useFormatMoney();

  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

  const { data, thisMonth, thisMonthSaved } = useMemo(() => {
    const now = new Date();
    const buckets = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d);
      const label = d
        .toLocaleDateString("es-ES", { month: "short" })
        .replace(".", "");
      const income = finances
        .filter((f) => f.type === "ingreso" && monthKey(new Date(f.date)) === key)
        .reduce((a, b) => a + amountInPrimary(b), 0);
      const spent = finances
        .filter((f) => f.type === "gasto" && monthKey(new Date(f.date)) === key)
        .reduce((a, b) => a + amountInPrimary(b), 0);
      buckets.push({ label, saved: income - spent, isCurrent: i === 0 });
    }
    const cur = buckets[buckets.length - 1];
    return { data: buckets, thisMonth: cur?.label ?? "", thisMonthSaved: cur?.saved ?? 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finances, amountInPrimary]);

  const hasData = data.some((d) => d.saved !== 0);

  if (!hasData) {
    return (
      <div className="text-sm text-rumbo-muted py-8 text-center">
        Sin ingresos ni gastos registrados todavía.
      </div>
    );
  }

  const isPositive = thisMonthSaved >= 0;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1 mb-4">
        <div>
          <div
            className={`text-2xl font-semibold tabular-nums ${
              isPositive ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {isPositive ? "+" : ""}
            {formatMoney(thisMonthSaved)}
          </div>
          <div className="text-xs text-rumbo-muted">ahorrado en {thisMonth}</div>
        </div>
        <span
          className={`chip text-xs ${
            isPositive
              ? "bg-emerald-100 text-emerald-700"
              : "bg-rose-100 text-rose-700"
          }`}
        >
          {isPositive ? "Superávit" : "Déficit"}
        </span>
      </div>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="sc-pos-cur" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#059669" stopOpacity={1} />
                <stop offset="100%" stopColor="#047857" stopOpacity={0.9} />
              </linearGradient>
              <linearGradient id="sc-pos-past" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6EE7B7" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#34D399" stopOpacity={0.5} />
              </linearGradient>
              <linearGradient id="sc-neg-cur" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E11D48" stopOpacity={1} />
                <stop offset="100%" stopColor="#BE123C" stopOpacity={0.9} />
              </linearGradient>
              <linearGradient id="sc-neg-past" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FCA5A5" stopOpacity={0.65} />
                <stop offset="100%" stopColor="#F87171" stopOpacity={0.45} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(0,0,0,0.04)" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#6B7280", fontSize: 11 }}
            />
            <YAxis hide domain={["auto", "auto"]} />
            <ReferenceLine y={0} stroke="#CBD5E1" strokeWidth={1} />
            <Tooltip
              formatter={(v: number) => [formatMoney(v), "Ahorrado"]}
              cursor={{ fill: "rgba(0,0,0,0.03)" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #EEF0F4",
                fontSize: 12,
                padding: "6px 10px",
              }}
              labelStyle={{ color: "#6B7280", fontSize: 11 }}
            />
            <Bar dataKey="saved" radius={[8, 8, 0, 0]}>
              {data.map((entry) => {
                const pos = entry.saved >= 0;
                const fill = entry.isCurrent
                  ? pos ? "url(#sc-pos-cur)" : "url(#sc-neg-cur)"
                  : pos ? "url(#sc-pos-past)" : "url(#sc-neg-past)";
                return <Cell key={entry.label} fill={fill} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
