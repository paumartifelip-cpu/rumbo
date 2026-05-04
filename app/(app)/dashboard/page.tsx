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
import { DashboardHero } from "@/components/DashboardHero";
import { SpendingTrend } from "@/components/SpendingTrend";
import { TaskRow } from "@/components/TaskRow";
import { Reveal } from "@/components/Reveal";
import { useFormatMoney, useRumbo } from "@/lib/store";

export default function DashboardPage() {
  const { goals, tasks, snapshots, aiAdvice, toggleTask } = useRumbo();
  const formatMoney = useFormatMoney();

  const ordered = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== "completada" && t.status !== "descartada")
        .sort(
          (a, b) =>
            (b.ai_priority_score ?? 0) - (a.ai_priority_score ?? 0)
        ),
    [tasks]
  );

  const mainTask = ordered[0];

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
        title="Inicio"
        subtitle="Todo bajo control. Aquí tienes tus cifras y tu siguiente paso."
      />

      <Reveal>
        <DashboardHero />
      </Reveal>

      <div className="grid lg:grid-cols-3 gap-4">
        <Reveal delay={0.05} className="lg:col-span-2">
          <Card className="bg-rumbo-ink text-white p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-20 text-6xl group-hover:scale-110 transition-transform">🎯</div>
            <div className="relative">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                Tu prioridad número 1
              </div>
              {mainTask ? (
                <>
                  <h2 className="text-2xl md:text-3xl font-bold mt-2 tracking-tight">
                    {mainTask.title}
                  </h2>
                  <p className="text-slate-300 mt-2 text-sm max-w-xl">
                    {mainTask.ai_reason || "Esta es la tarea que más te acerca a tus metas hoy."}
                  </p>
                  <div className="flex gap-3 mt-6">
                    <button 
                      onClick={() => toggleTask(mainTask.id)}
                      className="px-6 py-2.5 bg-white text-rumbo-ink rounded-xl font-bold hover:bg-slate-100 transition-all active:scale-95"
                    >
                      Completar ahora
                    </button>
                    <Link href="/tasks" className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-all">
                      Ver todas
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold mt-2">Todo despejado</h2>
                  <p className="text-slate-300 mt-2">No tienes tareas pendientes. ¡Buen trabajo!</p>
                  <Link href="/tasks" className="btn-primary mt-6 inline-flex bg-white text-rumbo-ink hover:bg-slate-100">
                    + Nueva tarea
                  </Link>
                </>
              )}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.1}>
          <Card className="card-hover h-full">
            <SectionTitle title="Consejo de la IA" />
            <p className="text-rumbo-ink text-sm leading-relaxed">
              {aiAdvice?.financial_advice ?? aiAdvice?.today_focus ??
                "Cuando crees objetivos y tareas, aquí verás qué hacer primero."}
            </p>
          </Card>
        </Reveal>

        <Reveal delay={0.15} className="lg:col-span-2">
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
                        <stop offset="0%" stopColor="#064E3B" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#064E3B" stopOpacity={0} />
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
                      stroke="#064E3B"
                      fill="url(#dg)"
                      strokeWidth={2.5}
                      dot={{ fill: "#064E3B", r: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </Reveal>

        <Reveal delay={0.2}>
          <Card className="card-hover">
            <SectionTitle title="Tendencia de gastos" />
            <SpendingTrend />
          </Card>
        </Reveal>

        <Reveal delay={0.25} className="lg:col-span-2">
          <Card className="card-hover">
            <SectionTitle title="Tus próximas tareas" />
            <div className="grid gap-2">
              {ordered.slice(1, 4).map((t, i) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  goal={goals.find((g) => g.id === t.goal_id)}
                  onToggle={toggleTask}
                />
              ))}
              {ordered.length <= 1 && (
                <p className="text-sm text-rumbo-muted py-4 text-center">No hay más tareas próximas.</p>
              )}
            </div>
            {ordered.length > 4 && (
              <Link href="/tasks" className="text-xs text-rumbo-muted hover:text-rumbo-ink mt-3 block text-center">
                Ver {ordered.length - 4} tareas más...
              </Link>
            )}
          </Card>
        </Reveal>

        <Reveal delay={0.3}>
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
              <li className="flex justify-between text-green-900 font-bold">
                <span className="">Tareas completadas</span>
                <span className="font-medium">
                  {tasks.filter((t) => t.status === "completada").length}
                </span>
              </li>
            </ul>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
