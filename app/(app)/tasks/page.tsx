"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, EmptyState, PageHeader } from "@/components/Card";
import { TaskComposer } from "@/components/TaskComposer";
import { TaskRow } from "@/components/TaskRow";
import { useRumbo } from "@/lib/store";
import { cn } from "@/lib/utils";

type TaskFilter = "all" | "pending" | "completed" | "distractions";

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
  const [filter, setFilter] = useState<TaskFilter>("pending");
  
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

  const completed = useMemo(() => tasks.filter((t) => t.status === "completada"), [tasks]);
  const distractions = useMemo(() => ordered.filter((t) => (t.ai_priority_score ?? 100) < 30), [ordered]);
  const pending = useMemo(() => ordered.filter((t) => (t.ai_priority_score ?? 100) >= 30), [ordered]);

  const displayedTasks = useMemo(() => {
    switch (filter) {
      case "all":
        return [...pending, ...distractions, ...completed];
      case "pending":
        return pending;
      case "completed":
        return completed;
      case "distractions":
        return distractions;
    }
  }, [filter, pending, distractions, completed]);

  return (
    <div>
      <PageHeader
        title="Tareas"
        subtitle="Organiza tus acciones por impacto real. La IA puntúa cada tarea para enfocarte en lo que importa."
        action={
          ordered.length > 0 ? (
            <button
              onClick={prioritize}
              className="btn-soft"
              disabled={prioritizing}
            >
              {prioritizing ? "Pensando…" : "Repriorizar todo"}
            </button>
          ) : null
        }
      />

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

      <Card className="mb-4 p-0 overflow-hidden">
        {/* Table Header / Filters */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50/50 overflow-x-auto no-scrollbar">
          {(
            [
              { id: "pending", label: "Plan de Acción", count: pending.length },
              { id: "all", label: "Todas", count: tasks.length },
              { id: "distractions", label: "Distracciones", count: distractions.length },
              { id: "completed", label: "Completadas", count: completed.length },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors",
                filter === f.id
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
              )}
            >
              {f.label}
              <span className={cn(
                "ml-2 text-xs px-1.5 py-0.5 rounded-full",
                filter === f.id ? "bg-slate-100 text-slate-600" : "bg-slate-100/50 text-slate-400"
              )}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Table Body */}
        {displayedTasks.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={filter === "completed" ? "🏆" : "✅"}
              title={`No hay tareas ${filter === "completed" ? "completadas" : filter === "distractions" ? "distractoras" : filter === "pending" ? "pendientes" : "aquí"}`}
              description={filter === "pending" ? "Escribe la primera arriba. La IA la puntuar\u00e1 al instante." : ""}
            />
          </div>
        ) : (
          <div className="flex flex-col">
            {displayedTasks.map((t, i) => {
              // Only compute rank if we are looking at pending/all ordered lists
              let rank: number | undefined;
              if (filter === "pending" || filter === "all") {
                rank = ordered.findIndex(ot => ot.id === t.id);
                if (rank === -1) rank = undefined;
              }
              
              return (
                <TaskRow
                  key={t.id}
                  rank={rank !== undefined ? rank : undefined}
                  task={t}
                  goal={goals.find((g) => g.id === t.goal_id)}
                  onToggle={toggleTask}
                  onRemove={removeTask}
                  highlight={filter === "pending" && i === 0}
                />
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
