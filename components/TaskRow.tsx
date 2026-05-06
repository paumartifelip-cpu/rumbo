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

  const badgeTone =
    score === undefined
      ? "bg-slate-100 text-slate-500"
      : score >= 50
      ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
      : "bg-rose-100 text-rose-700 border border-rose-200";

  const rowTone =
    score === undefined
      ? "bg-slate-50/30 hover:bg-slate-50"
      : score >= 50
      ? "bg-emerald-50/30 hover:bg-emerald-50/60"
      : "bg-rose-50/30 hover:bg-rose-50/60";

  const done = task.status === "completada";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group flex items-center gap-4 py-3 px-4 border-b border-slate-100 transition-colors last:border-0",
        highlight ? "bg-slate-50/50" : rowTone
      )}
    >
      <div className="shrink-0 flex items-center justify-center w-6">
        <button
          onClick={() => onToggle(task.id)}
          className={cn(
            "w-5 h-5 rounded border flex items-center justify-center transition-colors",
            done
              ? "bg-slate-800 border-slate-800 text-white"
              : "border-slate-300 bg-white hover:border-slate-500"
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
      </div>

      <div className="shrink-0 w-8 text-center text-xs font-medium text-slate-400">
        {rank !== undefined ? `#${rank + 1}` : "—"}
      </div>

      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h3
            className={cn(
              "font-medium text-sm leading-snug text-slate-900",
              done && "line-through text-slate-400"
            )}
          >
            {task.title}
          </h3>
          {task.recurrence && (
            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded flex items-center gap-1 font-medium capitalize">
              🔁 {task.recurrence}
            </span>
          )}
          {score === undefined && (
            <motion.span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-400"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            >
              Evaluando...
            </motion.span>
          )}
        </div>
        {task.ai_reason && (
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 group-hover:line-clamp-none transition-all">
            {task.ai_reason}
          </p>
        )}
        {goal && !task.ai_reason && (
          <p className="text-[11px] text-slate-500 mt-0.5">{goal.title}</p>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-4">
        {score !== undefined && (
          <div className="flex flex-col items-end justify-center w-12">
            <div className={cn(
              "text-sm font-bold px-2.5 py-1 rounded-lg w-full text-center",
              done ? "bg-slate-100 text-slate-400 border border-slate-200" : badgeTone
            )}>
              {score}
            </div>
            <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mt-1">
              Impacto
            </div>
          </div>
        )}

        {onRemove && (
          <button
            onClick={() => onRemove(task.id)}
            className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            aria-label="Eliminar tarea"
          >
            ✕
          </button>
        )}
      </div>
    </motion.div>
  );
}
