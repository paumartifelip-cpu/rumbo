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

  const isHighImpact = score !== undefined && score >= 50;
  const isDistraction = score !== undefined && score < 50;

  const rowTone =
    score === undefined
      ? "bg-slate-50 border-slate-200"
      : isHighImpact
      ? "bg-emerald-700 border-emerald-800 shadow-md"
      : "bg-rose-50 border-rose-200 shadow-sm";

  const textTone =
    score === undefined
      ? "text-slate-700"
      : isHighImpact
      ? "text-white"
      : "text-rose-950";

  const done = task.status === "completada";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -2, scale: 1.01, transition: { type: "spring", stiffness: 400, damping: 25 } }}
      whileTap={{ scale: 0.98, cursor: "grabbing" }}
      className={cn(
        "group flex items-center gap-4 py-4 px-5 border transition-all shadow-sm rounded-xl mb-3 mx-4 cursor-grab",
        highlight ? "ring-2 ring-emerald-400" : "",
        done ? "bg-slate-100 border-slate-200 opacity-60 grayscale" : rowTone,
        !done && isHighImpact ? "border-l-[6px] border-l-emerald-500" : "",
        !done && isDistraction ? "border-l-[6px] border-l-rose-500" : ""
      )}
    >
      <div className="shrink-0 flex items-center justify-center w-6">
        <button
          onClick={() => onToggle(task.id)}
          className={cn(
            "w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors shadow-sm",
            done
              ? "bg-slate-800 border-slate-800 text-white"
              : isHighImpact
              ? "border-emerald-400 bg-emerald-800 text-white hover:bg-emerald-900"
              : isDistraction
              ? "border-rose-400 bg-white hover:bg-rose-50"
              : "border-slate-400 bg-white hover:bg-slate-50"
          )}
          aria-label="Completar tarea"
        >
          {done && (
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 6.5l2 2 5-5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>

      <div className={cn(
        "shrink-0 w-8 text-center text-xs font-bold",
        done ? "text-slate-400" : (isHighImpact ? "text-emerald-200" : "text-rose-600")
      )}>
        {rank !== undefined ? `#${rank + 1}` : "—"}
      </div>

      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h3
            className={cn(
              "font-bold text-base leading-snug",
              done ? "line-through text-slate-500" : textTone
            )}
          >
            {task.title}
          </h3>
          {!done && isHighImpact && (
            <span className="text-lg" title="Alto Impacto" aria-label="Alto impacto">🚀</span>
          )}
          {!done && isDistraction && (
            <span className="text-lg" title="Distracción" aria-label="Distracción">🛑</span>
          )}
          {task.recurrence && (
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-bold uppercase tracking-wider shadow-sm",
              isHighImpact ? "bg-emerald-800/80 text-emerald-100" : "bg-white/50 text-slate-600"
            )}>
              🔁 {task.recurrence}
            </span>
          )}
          {score === undefined && (
            <motion.span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-600"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            >
              Evaluando...
            </motion.span>
          )}
        </div>
        {task.ai_reason && (
          <p className={cn(
            "text-xs mt-1.5 line-clamp-1 group-hover:line-clamp-none transition-all",
            done ? "text-slate-400" : (isHighImpact ? "text-emerald-100" : "text-rose-700")
          )}>
            {task.ai_reason}
          </p>
        )}
        {goal && !task.ai_reason && (
          <p className={cn("text-xs mt-0.5", isHighImpact ? "text-emerald-200" : "text-slate-500")}>{goal.title}</p>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-4">
        {score !== undefined && (
          <div className={cn(
            "flex flex-col items-center justify-center w-14 rounded-xl py-1 shadow-sm border",
            done ? "bg-slate-100 border-slate-200" : (isHighImpact ? "bg-emerald-800 border-emerald-900 text-white" : "bg-white border-rose-200")
          )}>
            <div className={cn(
              "text-base font-black",
              done ? "text-slate-400" : (isHighImpact ? "text-white" : textTone)
            )}>
              {score}
            </div>
            <div className={cn(
              "text-[9px] font-bold uppercase tracking-widest mt-0.5",
              done ? "text-slate-400" : (isHighImpact ? "text-emerald-200" : "text-rose-600")
            )}>
              Impacto
            </div>
          </div>
        )}

        {onRemove && (
          <button
            onClick={() => onRemove(task.id)}
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded-lg transition-colors opacity-0 group-hover:opacity-100 shadow-sm",
              isHighImpact ? "text-emerald-200 hover:text-white hover:bg-emerald-600" : "text-slate-400 hover:text-red-600 hover:bg-white"
            )}
            aria-label="Eliminar tarea"
          >
            ✕
          </button>
        )}
      </div>
    </motion.div>
  );
}
