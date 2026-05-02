"use client";

import { useEffect, useMemo, useState } from "react";
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

  const [configuredAi, setConfiguredAi] = useState<"openai" | "gemini" | null>(null);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (localStorage.getItem("rumbo_gpt_key")) setConfiguredAi("openai");
      else if (localStorage.getItem("rumbo_gemini_key")) setConfiguredAi("gemini");
    }
  }, []);

  const displayAiSource = aiSource !== "idle" ? aiSource : configuredAi || "fallback";

  const ordered = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== "completada" && t.status !== "descartada")
        .sort(
          (a, b) =>
            (b.ai_priority_score ?? 100) - (a.ai_priority_score ?? 100)
        ),
    [tasks]
  );

  const completed = tasks.filter((t) => t.status === "completada");
  const distractions = ordered.filter((t) => (t.ai_priority_score ?? 100) < 30);
  const main = ordered.filter((t) => (t.ai_priority_score ?? 100) >= 30);

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

      <div className={`mb-6 p-4 rounded-xl border ${displayAiSource === 'gemini' ? 'bg-indigo-50 border-indigo-100 text-indigo-900' : displayAiSource === 'openai' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-800'} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
        <div>
          <div className="text-sm font-bold flex items-center gap-2">
            {displayAiSource === "gemini" ? "✨ IA Activa (Gemini)" : displayAiSource === "openai" ? "✨ IA Activa (OpenAI)" : "⚙️ Orden Básico Local"}
          </div>
          <div className="text-xs mt-1 opacity-80">
            {displayAiSource === "gemini" || displayAiSource === "openai"
              ? "Tus tareas se están ordenando inteligentemente por impacto."
              : displayAiSource === "fallback"
              ? "Añade tu API Key en Ajustes para activar el motor de Inteligencia Artificial."
              : "Añade una tarea para comenzar la evaluación."}
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-2 ${displayAiSource === 'gemini' ? 'bg-indigo-600 text-white' : displayAiSource === 'openai' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
          {prioritizing ? (
            <>
              <span className="animate-pulse">●</span> Evaluando...
            </>
          ) : displayAiSource === "gemini" || displayAiSource === "openai" ? (
            "Conectado"
          ) : (
            "IA Inactiva"
          )}
        </div>
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
