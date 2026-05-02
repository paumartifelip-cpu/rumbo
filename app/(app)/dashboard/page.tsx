"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/Card";
import { MoneyMetrics } from "@/components/MoneyMetrics";
import { Reveal } from "@/components/Reveal";
import { useRumbo } from "@/lib/store";
import { formatMoney } from "@/lib/utils";

export default function DashboardPage() {
  const { goals, tasks, snapshots, aiAdvice } = useRumbo();

  const completedByWeek = useMemo(() => {
    const result = [
      { name: "L", v: 0 },
      { name: "M", v: 0 },
      { name: "X", v: 0 },
      { name: "J", v: 0 },
      { name: "V", v: 0 },
      { name: "S", v: 0 },
      { name: "D", v: 0 },
    ];
    tasks
      .filter((t) => t.status === "completada")
      .forEach((t) => {
        const day = (new Date(t.created_at).getDay() + 6) % 7;
        result[day].v += 1;
      });
    return result;
  }, [tasks]);

  const moneyEvolution = useMemo(
    () =>
      [...snapshots]
        .sort((a, b) => +new Date(a.date) - +new Date(b.date))
        .map((s) => ({
          date: new Date(s.date).toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "short",
          }),
          total: s.total,
        })),
    [snapshots]
  );

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Tu rumbo de un vistazo."
        action={
          <Link href="/today" className="btn-primary">
            Ir a Hoy
          </Link>
        }
      />

      <Reveal>
        <div className="mb-6">
          <MoneyMetrics />
        </div>
      </Reveal>

      <div className="grid lg:grid-cols-3 gap-4">
        <Reveal className="lg:col-span-2">
          <Card className="card-hover h-full">
            <SectionTitle title="Foco de hoy" />
            <p className="text-rumbo-ink">
              {aiAdvice?.today_focus ??
                "Cuando crees objetivos y tareas, aquí verás qué hacer primero."}
            </p>
            {aiAdvice?.financial_advice && (
              <p className="text-rumbo-muted mt-3 text-sm">
                {aiAdvice.financial_advice}
              </p>
            )}
          </Card>
        </Reveal>

        <Reveal delay={0.06}>
        <Card className="card-hover">
          <SectionTitle title="Resumen" />
          <ul className="text-sm space-y-2">
            <li className="flex justify-between">
              <span className="text-rumbo-muted">Objetivos</span>
              <span className="font-medium">{goals.length}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-rumbo-muted">Tareas pendientes</span>
              <span className="font-medium">
                {tasks.filter((t) => t.status !== "completada").length}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-rumbo-muted">Tareas completadas</span>
              <span className="font-medium">
                {tasks.filter((t) => t.status === "completada").length}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-rumbo-muted">Mediciones de dinero</span>
              <span className="font-medium">{snapshots.length}</span>
            </li>
          </ul>
        </Card>
        </Reveal>

        <Reveal delay={0.12} className="lg:col-span-2">
        <Card className="card-hover">
          <SectionTitle title="Evolución de tu dinero total" />
          {moneyEvolution.length === 0 ? (
            <EmptyState
              icon="📈"
              title="Sin datos aún"
              description="Añade tu primera medición en la pantalla de Dinero."
              action={
                <Link href="/money" className="btn-primary">
                  Ir a Dinero
                </Link>
              }
            />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={moneyEvolution}>
                  <defs>
                    <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#16A34A" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#16A34A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#EEF0F4" vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number) => formatMoney(v)}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #EEF0F4",
                    }}
                  />
                  <Area
                    dataKey="total"
                    stroke="#16A34A"
                    fill="url(#dg)"
                    strokeWidth={2.5}
                    dot={{ fill: "#16A34A", r: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        </Reveal>

        <Reveal delay={0.18}>
        <Card className="card-hover">
          <SectionTitle title="Completadas (semana)" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={completedByWeek}>
                <CartesianGrid stroke="#EEF0F4" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #EEF0F4",
                  }}
                />
                <Bar dataKey="v" fill="#0B1220" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        </Reveal>
      </div>
    </div>
  );
}
