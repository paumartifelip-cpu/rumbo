"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, EmptyState, PageHeader } from "@/components/Card";
import { TaskComposer } from "@/components/TaskComposer";
import { TaskRow } from "@/components/TaskRow";
import { useRumbo } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Reorder } from "framer-motion";
import { FocusMode } from "@/components/FocusMode";
import { Task } from "@/lib/types";

type TaskFilter = "all" | "pending" | "completed" | "distractions";

export default function TasksPage() {
  const {
    goals,
    tasks,
    removeTask,
    toggleTask,
    reorderTasks,
    prioritize,
    prioritizing,
    aiSource,
  } = useRumbo();

  const [filter, setFilter] = useState<TaskFilter>("pending");
  const [focusMode, setFocusMode] = useState(false);
  
  useEffect(() => {
    // keeping for potential future use or can be safely removed entirely
  }, []);

  const ordered = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== "completada" && t.status !== "descartada")
        .sort((a, b) => {
          if (a.manual_order_index !== undefined && b.manual_order_index !== undefined) {
            return a.manual_order_index - b.manual_order_index;
          }
          if (a.manual_order_index !== undefined) return -1;
          if (b.manual_order_index !== undefined) return 1;
          return (b.ai_priority_score ?? 100) - (a.ai_priority_score ?? 100);
        }),
    [tasks]
  );

  const completed = useMemo(() => tasks.filter((t) => t.status === "completada"), [tasks]);
  const distractions = useMemo(() => ordered.filter((t) => (t.ai_priority_score ?? 100) < 30), [ordered]);
  const pending = useMemo(() => ordered.filter((t) => (t.ai_priority_score ?? 100) >= 30), [ordered]);

  // pending = high-impact not completed
  // distractions = low-score not completed
  // completed = all completed
  // 'all' tab = pending + distractions (non-completed)
  const displayedTasks = useMemo(() => {
    switch (filter) {
      case "all":
        return [...pending, ...distractions];
      case "pending":
        return pending;
      case "completed":
        return completed;
      case "distractions":
        return distractions;
    }
  }, [filter, pending, distractions, completed]);

  // Handle reorder
  const handleReorder = (newOrder: Task[]) => {
    // Reorder only makes sense within the 'pending' or 'all' list context
    // We pass the new sorted pending tasks to the store
    if (filter === "pending") {
      reorderTasks(newOrder);
    }
  };

  if (focusMode && pending.length > 0) {
    return <FocusMode tasks={pending} onExit={() => setFocusMode(false)} />;
  }

  return (
    <div>
      <PageHeader
        title="Tareas"
        subtitle="Organiza tus acciones por impacto real. La IA puntúa cada tarea para enfocarte en lo que importa."
        action={
          <div className="flex items-center gap-2">
            {pending.length > 0 && (
              <button
                onClick={() => setFocusMode(true)}
                className="bg-emerald-600 text-white font-bold py-2 px-4 rounded-xl shadow-sm hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <span>🎯</span> Modo Enfoque
              </button>
            )}
            {ordered.length > 0 ? (
              <button
                onClick={prioritize}
                className="btn-soft"
                disabled={prioritizing}
                title="Recalcular impacto de IA y borrar orden manual"
              >
                {prioritizing ? "Pensando…" : "Repriorizar todo"}
              </button>
            ) : null}
          </div>
        }
      />

      <div className="mb-4">
        <TaskComposer />
      </div>

      <Card className="mb-4 p-0 overflow-hidden">
        {/* Table Header / Filters */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50/50 overflow-x-auto no-scrollbar">
          {(
            [
              { id: "pending", label: "Plan de Acción", count: pending.length },
              { id: "all", label: "Todas", count: ordered.length },
              { id: "distractions", label: "Distracciones", count: distractions.length },
              { id: "completed", label: "✓ Completadas", count: completed.length },
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
        ) : filter === "pending" ? (
          <Reorder.Group axis="y" values={displayedTasks} onReorder={handleReorder} className="flex flex-col pt-3">
            {displayedTasks.map((t, i) => {
              let rank: number | undefined;
              if (filter === "pending" || filter === "all") {
                rank = ordered.findIndex(ot => ot.id === t.id);
                if (rank === -1) rank = undefined;
              }
              
              return (
                <Reorder.Item key={t.id} value={t} className="relative z-0">
                  <TaskRow
                    rank={rank !== undefined ? rank : undefined}
                    task={t}
                    goal={goals.find((g) => g.id === t.goal_id)}
                    onToggle={toggleTask}
                    onRemove={removeTask}
                    highlight={filter === "pending" && i === 0}
                  />
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        ) : (
          <div className="flex flex-col pt-3">
            {displayedTasks.map((t, i) => {
              let rank: number | undefined;
              if (filter === "all") {
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
                  highlight={false}
                />
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
