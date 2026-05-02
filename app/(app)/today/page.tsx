"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/Card";
import { MoneyHero } from "@/components/MoneyHero";
import { TaskRow } from "@/components/TaskRow";
import { useRumbo } from "@/lib/store";

export default function TodayPage() {
  const {
    goals,
    tasks,
    toggleTask,
    aiAdvice,
    user,
    onboardingDone,
    prioritizing,
    aiSource,
    prioritize,
  } = useRumbo();

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

  const top3 = ordered.slice(0, 3);
  const main = top3[0];
  const distractions = ordered.filter((t) => (t.ai_priority_score ?? 100) < 30);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 20) return "Buenas tardes";
    return "Buenas noches";
  }, []);

  const todayLabel = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, []);

  return (
    <div>
      <div className="mb-5">
        <div className="text-3xl md:text-4xl font-semibold tracking-tight capitalize">
          {todayLabel}
        </div>
      </div>
      <PageHeader
        title={`${greeting}${user.name ? `, ${user.name}` : ""}`}
        subtitle="Una sola tarea importa hoy. Empieza por ella."
        action={
          ordered.length > 0 ? (
            <button onClick={prioritize} className="btn-soft" disabled={prioritizing}>
              {prioritizing ? "Pensando…" : "Repriorizar"}
            </button>
          ) : null
        }
      />

      <div className="mb-6">
        <MoneyHero />
      </div>

      {!onboardingDone && (
        <div className="mb-6">
          <Card className="bg-violet-50 border-violet-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="font-semibold">Configura tus dos metas</div>
                <div className="text-sm text-rumbo-muted">
                  Define cuánto tienes, cuánto cobras al mes, y a dónde quieres
                  llegar.
                </div>
              </div>
              <Link href="/onboarding" className="btn-primary">
                Empezar
              </Link>
            </div>
          </Card>
        </div>
      )}

      <Card className="mb-6">
        <div className="text-[11px] uppercase tracking-wider text-rumbo-muted">
          Tarea #1 de hoy
        </div>
        {main ? (
          <>
            <h2 className="text-2xl md:text-3xl font-semibold mt-2 tracking-tight">
              {main.title}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="chip bg-emerald-100 text-emerald-700">
                Impacto {main.ai_priority_score ?? "—"}/100
              </span>
              <span className="chip bg-slate-100 text-rumbo-muted">
                {aiSource === "gemini" ? "Gemini Flash" : "Local"}
              </span>
            </div>
            {main.ai_reason && (
              <p className="text-rumbo-muted mt-2 max-w-2xl">{main.ai_reason}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-5">
              <button
                className="btn-primary"
                onClick={() => toggleTask(main.id)}
              >
                Marcar como hecha
              </button>
              <Link href="/tasks" className="btn-ghost">
                Ver todas
              </Link>
            </div>
          </>
        ) : (
          <div className="mt-3">
            <p className="text-rumbo-muted">
              No tienes tareas. Crea la primera y la IA la puntuará al instante.
            </p>
            <Link href="/tasks" className="btn-primary mt-4 inline-flex">
              + Nueva tarea
            </Link>
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <SectionTitle title="Las 3 más importantes" />
          {top3.length === 0 ? (
            <EmptyState
              icon="🎯"
              title="Aún no hay tareas"
              description="Empieza creando una. Gemini la puntuará al momento."
              action={
                <Link href="/tasks" className="btn-primary">
                  + Nueva tarea
                </Link>
              }
            />
          ) : (
            <div className="grid gap-2">
              {top3.map((t, i) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  goal={goals.find((g) => g.id === t.goal_id)}
                  onToggle={toggleTask}
                  rank={i}
                  highlight={i === 0}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionTitle title="Consejo del día" />
          <Card>
            <motion.p
              key={aiAdvice?.today_focus}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-rumbo-ink"
            >
              {aiAdvice?.today_focus ??
                "Cuando crees tareas, la IA te dirá qué hacer primero según lo que más te acerca a tus dos metas."}
            </motion.p>
            <div className="text-[11px] text-rumbo-muted mt-3">
              {aiSource === "gemini"
                ? "Gemini 2.5 Flash"
                : aiSource === "fallback"
                ? "Heurística local (añade tu API key en Ajustes para activar Gemini)"
                : "Sin datos aún"}
            </div>
          </Card>

          {distractions.length > 0 && (
            <div className="mt-4">
              <SectionTitle title="No hagas esto ahora" />
              <Card>
                <div className="grid gap-2">
                  {distractions.slice(0, 3).map((t) => (
                    <div key={t.id} className="text-sm">
                      <div className="font-medium">⛔ {t.title}</div>
                      {t.ai_reason && (
                        <div className="text-rumbo-muted">{t.ai_reason}</div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
