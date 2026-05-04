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

export function SpendingTrend() {
  const { finances, amountInPrimary } = useRumbo();
  const formatMoney = useFormatMoney();

  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

  const { data, current, previous, deltaAbs, avg, maxMonth } = useMemo(() => {
    const now = new Date();
    const buckets = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d);
      const label = d
        .toLocaleDateString("es-ES", { month: "short" })
        .replace(".", "");
      const total = finances
        .filter((f) => f.type === "gasto" && monthKey(new Date(f.date)) === key)
        .reduce((a, b) => a + amountInPrimary(b), 0);
      buckets.push({ label, total, key, isCurrent: i === 0 });
    }

    const current = buckets[buckets.length - 1]?.total ?? 0;
    const previous = buckets[buckets.length - 2]?.total ?? 0;
    const deltaAbs = current - previous;

    const nonZero = buckets.filter((b) => b.total > 0);
    const avg =
      nonZero.length > 1
        ? nonZero.slice(0, -1).reduce((a, b) => a + b.total, 0) /
          nonZero.slice(0, -1).length
        : 0;
    const maxMonth = buckets.reduce(
      (best, b) => (b.total > best.total ? b : best),
      buckets[0]
    );

    return { data: buckets, current, previous, deltaAbs, avg, maxMonth };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finances, amountInPrimary]);

  const hasData = data.some((d) => d.total > 0);

  if (!hasData) {
    return (
      <div className="text-sm text-rumbo-muted py-8 text-center">
        Sin datos de gastos todavía.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1 mb-4">
        <div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatMoney(current)}
          </div>
          <div className="text-xs text-rumbo-muted">este mes</div>
        </div>
        {previous > 0 && (
          <span
            className={`chip text-xs ${
              deltaAbs > 0
                ? "bg-rose-100 text-rose-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {deltaAbs >= 0 ? "+" : ""}
            {formatMoney(deltaAbs)} vs mes anterior
          </span>
        )}
        {avg > 0 && (
          <span className="chip text-xs bg-slate-100 text-slate-600">
            Media: {formatMoney(avg)}/mes
          </span>
        )}
      </div>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="st-current" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FB7185" stopOpacity={1} />
                <stop offset="100%" stopColor="#E11D48" stopOpacity={0.9} />
              </linearGradient>
              <linearGradient id="st-past" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FCA5A5" stopOpacity={0.55} />
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
            <YAxis
              hide
              domain={[0, (max: number) => Math.max(max * 1.15, 1)]}
            />
            <Tooltip
              formatter={(v: number) => [formatMoney(v), "Gastado"]}
              cursor={{ fill: "rgba(0,0,0,0.03)" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #EEF0F4",
                fontSize: 12,
                padding: "6px 10px",
              }}
              labelStyle={{ color: "#6B7280", fontSize: 11 }}
            />
            <Bar dataKey="total" radius={[8, 8, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={
                    entry.isCurrent ? "url(#st-current)" : "url(#st-past)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {maxMonth && maxMonth.total > 0 && !maxMonth.isCurrent && (
        <div className="text-xs text-rumbo-muted mt-2 text-center">
          Mes más caro: <span className="font-medium text-rumbo-ink capitalize">{maxMonth.label}</span>{" "}
          con {formatMoney(maxMonth.total)}
        </div>
      )}
    </div>
  );
}
