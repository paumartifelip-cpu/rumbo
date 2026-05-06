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

  const rowTone =
    score === undefined
      ? "bg-slate-50 border-slate-100"
      : score >= 50
      ? "bg-emerald-50 border-emerald-100"
      : "bg-rose-50 border-rose-100";

  const textTone =
    score === undefined
      ? "text-slate-600"
      : score >= 50
      ? "text-emerald-800"
      : "text-rose-800";

  const done = task.status === "completada";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1, transition: { duration: 0.15 } }}
      className={cn(
        "group flex items-center gap-4 py-3 px-4 border-b transition-colors last:border-0 shadow-sm rounded-xl mb-2 mx-4",
        highlight ? "ring-2 ring-emerald-300" : "",
        done ? "bg-slate-50 border-slate-100 opacity-60" : rowTone
      )}
    >
      <div className="shrink-0 flex items-center justify-center w-6">
        <button
          onClick={() => onToggle(task.id)}
          className={cn(
            "w-5 h-5 rounded border flex items-center justify-center transition-colors",
            done
              ? "bg-slate-800 border-slate-800 text-white"
              : "border-slate-300 bg-white hover:border-slate-500 shadow-sm"
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
              "font-semibold text-sm leading-snug",
              done ? "line-through text-slate-400" : textTone
            )}
          >
            {task.title}
          </h3>
          {task.recurrence && (
            <span className="text-[10px] bg-white/50 text-slate-600 px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold uppercase tracking-wider shadow-sm">
              🔁 {task.recurrence}
            </span>
          )}
          {score === undefined && (
            <motion.span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-500"
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
          <div className="flex flex-col items-center justify-center w-12 bg-white/60 rounded-xl py-1 shadow-sm border border-white/40">
            <div className={cn(
              "text-sm font-black",
              done ? "text-slate-400" : textTone
            )}>
              {score}
            </div>
            <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Impacto
            </div>
          </div>
        )}

        {onRemove && (
          <button
            onClick={() => onRemove(task.id)}
            className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-white rounded-lg transition-colors opacity-0 group-hover:opacity-100 shadow-sm"
            aria-label="Eliminar tarea"
          >
            ✕
          </button>
        )}
      </div>
    </motion.div>
  );
}
