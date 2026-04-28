"use client";

import { useMemo } from "react";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/Card";
import { MoneyMetrics } from "@/components/MoneyMetrics";
import { TaskComposer } from "@/components/TaskComposer";
import { TaskRow } from "@/components/TaskRow";
import { useRumbo } from "@/lib/store";

export default function TasksPage() {
  const {
    goals,
    tasks,
    removeTask,
    toggleTask,
    prioritize,
    prioritizing,
    aiSource,
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

  const completed = tasks.filter((t) => t.status === "completada");
  const distractions = ordered.filter((t) => (t.ai_priority_score ?? 100) < 30);
  const main = ordered.filter((t) => (t.ai_priority_score ?? 0) >= 30);

  return (
    <div>
      <PageHeader
        title="Tareas"
        subtitle="Escribe lo que tienes que hacer. Gemini lo interpreta y lo ordena por impacto real."
        action={
          ordered.length > 0 ? (
            <button
              onClick={prioritize}
              className="btn-soft"
              disabled={prioritizing}
            >
              {prioritizing ? "Pensando…" : "Repriorizar"}
            </button>
          ) : null
        }
      />

      <div className="mb-6">
        <MoneyMetrics />
      </div>

      <div className="mb-4">
        <TaskComposer />
      </div>

      <div className="text-xs text-rumbo-muted mb-3">
        Fuente IA:{" "}
        <span className="font-medium text-rumbo-ink">
          {aiSource === "gemini"
            ? "Gemini 2.5 Flash"
            : aiSource === "fallback"
            ? "Heurística local"
            : "Esperando datos"}
        </span>
        {prioritizing && <span className="ml-2 text-rumbo-muted">· evaluando…</span>}
      </div>

      {ordered.length === 0 ? (
        <EmptyState
          icon="✅"
          title="Aún no hay tareas"
          description="Escribe la primera arriba. La IA la puntuará al instante."
        />
      ) : (
        <Card className="mb-4">
          <SectionTitle title="Plan de hoy" hint="Empieza por arriba." />
          <div className="grid gap-2">
            {main.map((t, i) => (
              <TaskRow
                key={t.id}
                rank={i}
                task={t}
                goal={goals.find((g) => g.id === t.goal_id)}
                onToggle={toggleTask}
                onRemove={removeTask}
                highlight={i === 0}
              />
            ))}
          </div>
        </Card>
      )}

      {distractions.length > 0 && (
        <Card className="mb-4">
          <SectionTitle
            title="No hagas esto ahora"
            hint="La IA cree que no acercan a tus objetivos."
          />
          <div className="grid gap-2">
            {distractions.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                goal={goals.find((g) => g.id === t.goal_id)}
                onToggle={toggleTask}
                onRemove={removeTask}
              />
            ))}
          </div>
        </Card>
      )}

      {completed.length > 0 && (
        <Card>
          <SectionTitle title="Completadas" />
          <div className="grid gap-2">
            {completed.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                goal={goals.find((g) => g.id === t.goal_id)}
                onToggle={toggleTask}
                onRemove={removeTask}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
