"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/Card";
import { MoneyHero } from "@/components/MoneyHero";
import { MoneyGoalsEditor } from "@/components/MoneyGoalsEditor";
import { MonthlyIncome } from "@/components/MonthlyIncome";
import { IncomeVsExpensesChart } from "@/components/IncomeVsExpensesChart";
import { Reveal } from "@/components/Reveal";
import { useFormatMoney, useRumbo } from "@/lib/store";
import { CURRENCIES } from "@/lib/currency";
import { formatDate } from "@/lib/utils";

function useTodayLabel() {
  return new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function MoneyPage() {
  const { snapshots, addSnapshot, removeSnapshot, onboarding } = useRumbo();
  const formatMoney = useFormatMoney();
  const todayLabel = useTodayLabel();

  const sorted = useMemo(
    () => [...snapshots].sort((a, b) => +new Date(a.date) - +new Date(b.date)),
    [snapshots]
  );

  const chartData = useMemo(
    () =>
      sorted.map((s) => ({
        date: new Date(s.date).toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "short",
        }),
        total: s.total,
      })),
    [sorted]
  );

  const totalTarget = onboarding?.total_target ?? 0;

  return (
    <div>
      <PageHeader
        title="Dinero"
        subtitle="Cuatro cifras claras: lo que tienes, lo que quieres tener, lo que ganas y lo que quieres ganar."
      />
      <div className="text-2xl md:text-3xl font-semibold capitalize tracking-tight -mt-2 mb-6">
        📅 {todayLabel}
      </div>

      <Reveal>
        <div className="mb-6">
          <MoneyHero />
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="mb-6">
          <IncomeVsExpensesChart />
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="mb-6">
          <MonthlyIncome />
        </div>
      </Reveal>

      <Reveal delay={0.1}>
      <Card className="mb-6 card-hover">
        <SectionTitle
          title="Evolución de tu dinero total"
          hint="Marca la fecha y cuánto tienes ahora. Cada actualización queda guardada."
        />
        <SnapshotForm onSave={addSnapshot} />
        {sorted.length === 0 ? (
          <div className="py-12 text-center text-rumbo-muted text-sm">
            Aún no hay mediciones. Guarda tu primera arriba.
          </div>
        ) : (
          <div className="h-72 mt-5">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16A34A" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#16A34A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#EEF0F4" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#6B7280", fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#6B7280", fontSize: 12 }}
                />
                <Tooltip
                  formatter={(v: number) => formatMoney(v)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #EEF0F4",
                    boxShadow: "0 8px 24px -16px rgba(15,23,42,0.1)",
                  }}
                />
                {totalTarget > 0 && (
                  <ReferenceLine
                    y={totalTarget}
                    stroke="#94A3B8"
                    strokeDasharray="4 4"
                    label={{
                      value: `Meta ${formatMoney(totalTarget)}`,
                      fill: "#6B7280",
                      fontSize: 11,
                      position: "right",
                    }}
                  />
                )}
                <Area
                  dataKey="total"
                  stroke="#16A34A"
                  fill="url(#grad)"
                  strokeWidth={2.5}
                  dot={{ fill: "#16A34A", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
      </Reveal>

      <Reveal delay={0.12}>
      <Card className="card-hover mb-6">
        <SectionTitle title="Tus mediciones" />
        {sorted.length === 0 ? (
          <EmptyState
            icon="💸"
            title="Sin mediciones aún"
            description="Cada vez que actualices tu dinero total se guardará aquí. Ideal una vez al mes."
          />
        ) : (
          <div className="grid gap-1">
            {[...sorted].reverse().map((s, i, arr) => {
              const next = arr[i + 1];
              const diff = next ? s.total - next.total : 0;
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between py-3 border-b last:border-0 border-rumbo-line"
                >
                  <div>
                    <div className="font-medium">{formatMoney(s.total)}</div>
                    <div className="text-xs text-rumbo-muted">
                      {formatDate(s.date)}
                      {s.note ? ` · ${s.note}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {next && (
                      <span
                        className={
                          diff >= 0
                            ? "text-green-900 text-sm font-bold"
                            : "text-red-600 text-sm font-black"
                        }
                      >
                        {diff >= 0 ? "+" : ""}
                        {formatMoney(diff)}
                      </span>
                    )}
                    <button
                      onClick={() => removeSnapshot(s.id)}
                      className="text-rumbo-muted hover:text-red-600"
                      aria-label="Eliminar"
                    >
                      ✕
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>
      </Reveal>

      <Reveal delay={0.15}>
        <div className="mb-10">
          <MoneyGoalsEditor />
        </div>
      </Reveal>
    </div>
  );
}

function SnapshotForm({
  onSave,
}: {
  onSave: ReturnType<typeof useRumbo>["addSnapshot"];
}) {
  const { primaryCurrency } = useRumbo();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [total, setTotal] = useState<number | "">("");
  const [note, setNote] = useState("");

  return (
    <div className="grid grid-cols-1 md:grid-cols-[160px_180px_1fr_auto] gap-2">
      <input
        type="date"
        className="input"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          className="input pr-8"
          placeholder="Tu dinero hoy"
          value={total}
          onChange={(e) =>
            setTotal(e.target.value === "" ? "" : Number(e.target.value))
          }
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rumbo-muted text-sm">
          {CURRENCIES[primaryCurrency].symbol}
        </span>
      </div>
      <input
        className="input"
        placeholder="Nota (opcional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button
        className="btn-primary"
        onClick={() => {
          if (typeof total !== "number" || total <= 0) return;
          onSave({
            date: new Date(date).toISOString(),
            total,
            note: note || undefined,
          });
          setNote("");
          setTotal("");
        }}
      >
        Guardar
      </button>
    </div>
  );
}
