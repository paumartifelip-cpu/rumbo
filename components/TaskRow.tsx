"use client";

import { motion } from "framer-motion";
import { Goal, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TaskRow({
  task,
  goal,
  onToggle,
  onRemove,
  rank,
  highlight,
}: {
  task: Task;
  goal?: Goal;
  onToggle: (id: string) => void;
  onRemove?: (id: string) => void;
  rank?: number;
  highlight?: boolean;
}) {
  const score = task.ai_priority_score;
  const tone =
    score === undefined
      ? "bg-slate-100 text-slate-500"
      : score >= 70
      ? "bg-emerald-100 text-emerald-700"
      : score >= 40
      ? "bg-amber-100 text-amber-700"
      : "bg-rose-100 text-rose-700";

  const done = task.status === "completada";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "card p-4 flex items-start gap-3",
        highlight && "ring-2 ring-emerald-200"
      )}
    >
      <button
        onClick={() => onToggle(task.id)}
        className={cn(
          "mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
          done
            ? "bg-rumbo-green border-rumbo-green text-white"
            : "border-rumbo-line bg-white hover:border-rumbo-ink/40"
        )}
        aria-label="Completar tarea"
      >
        {done && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6.5l2 2 5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {rank !== undefined && (
            <span className="chip bg-slate-100 text-rumbo-muted">
              #{rank + 1}
            </span>
          )}
          <h3
            className={cn(
              "font-medium leading-snug",
              done && "line-through text-rumbo-muted"
            )}
          >
            {task.title}
          </h3>
          {score !== undefined ? (
            <span className={cn("chip", tone)}>{score}/100</span>
          ) : (
            <motion.span
              className="chip bg-slate-100 text-rumbo-muted"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            >
              Evaluando…
            </motion.span>
          )}
        </div>
        {task.ai_reason && (
          <p className="text-sm text-rumbo-muted mt-1.5 leading-relaxed">
            {task.ai_reason}
          </p>
        )}
        {goal && !task.ai_reason && (
          <p className="text-xs text-rumbo-muted mt-1">{goal.title}</p>
        )}
      </div>

      {onRemove && (
        <button
          onClick={() => onRemove(task.id)}
          className="text-rumbo-muted hover:text-rose-600 text-sm shrink-0"
          aria-label="Eliminar tarea"
        >
          ✕
        </button>
      )}
    </motion.div>
  );
}
