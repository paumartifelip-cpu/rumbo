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

  const isHighImpact  = score !== undefined && score >= 50;
  const isDistraction = score !== undefined && score < 50;
  const done = task.status === "completada";

  const rowTone =
    score === undefined
      ? "bg-slate-50 border-slate-200"
      : isHighImpact
      ? "bg-emerald-700 border-emerald-800 shadow-md"
      : "bg-rose-700 border-rose-800 shadow-md";

  const textTone =
    score === undefined
      ? "text-slate-700"
      : "text-white";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{
        y: -3,
        scale: 1.01,
        transition: { type: "spring", stiffness: 350, damping: 22 },
      }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "group relative flex items-center gap-2.5 sm:gap-4 py-3 sm:py-4 px-3 sm:px-5 border transition-colors shadow-sm rounded-xl mb-2.5 sm:mb-3 mx-2 sm:mx-4 overflow-hidden",
        highlight ? "ring-2 ring-emerald-400" : "",
        done ? "bg-slate-100 border-slate-200 opacity-60 grayscale" : rowTone,
        !done && isHighImpact ? "border-l-[5px] sm:border-l-[6px] border-l-emerald-400" : "",
        !done && isDistraction ? "border-l-[5px] sm:border-l-[6px] border-l-rose-400" : ""
      )}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(task.id)}
        className={cn(
          "shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors shadow-sm",
          done
            ? "bg-slate-800 border-slate-800 text-white"
            : isHighImpact
            ? "border-emerald-400 bg-emerald-800 text-white hover:bg-emerald-900"
            : isDistraction
            ? "border-rose-400 bg-rose-800 text-white hover:bg-rose-900"
            : "border-slate-400 bg-white hover:bg-slate-50"
        )}
        aria-label="Completar tarea"
      >
        {done && (
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6.5l2 2 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Rank — hidden on mobile to save horizontal room */}
      {rank !== undefined && (
        <div className={cn(
          "hidden sm:block shrink-0 w-8 text-center text-xs font-bold",
          done
            ? "text-slate-400"
            : isHighImpact
            ? "text-emerald-200"
            : isDistraction
            ? "text-rose-200"
            : "text-slate-400"
        )}>
          #{rank + 1}
        </div>
      )}

      {/* Title (single-line, truncated) */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className={cn(
            "font-semibold text-sm sm:text-base leading-snug truncate",
            done ? "line-through text-slate-500" : textTone
          )}>
            {task.title}
          </h3>
          {!done && isHighImpact && (
            <span className="text-base shrink-0" title="Alto impacto" aria-label="Alto impacto">🚀</span>
          )}
          {!done && isDistraction && (
            <span className="text-base shrink-0" title="Distracción" aria-label="Distracción">🛑</span>
          )}
          {task.recurrence && (
            <span className={cn(
              "hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded items-center gap-1 font-bold uppercase tracking-wider",
              isHighImpact ? "bg-emerald-800/80 text-emerald-100" : "bg-white/50 text-slate-600"
            )}>
              🔁 {task.recurrence}
            </span>
          )}
        </div>
      </div>

      {/* Score badge — compact on mobile */}
      {score !== undefined && (
        <div className={cn(
          "shrink-0 flex flex-col items-center justify-center w-11 sm:w-14 rounded-xl py-1 shadow-sm border",
          done
            ? "bg-slate-100 border-slate-200"
            : isHighImpact
            ? "bg-emerald-800 border-emerald-900 text-white"
            : isDistraction
            ? "bg-rose-800 border-rose-900 text-white"
            : "bg-white border-slate-200"
        )}>
          <div className={cn(
            "text-sm sm:text-base font-black leading-none",
            done ? "text-slate-400" : "text-current"
          )}>
            {score}
          </div>
          <div className={cn(
            "text-[8px] sm:text-[9px] font-bold uppercase tracking-widest mt-0.5",
            done ? "text-slate-400" : isHighImpact ? "text-emerald-200" : isDistraction ? "text-rose-200" : "text-slate-500"
          )}>
            Prio.
          </div>
        </div>
      )}

      {/* Remove button — visible on mobile (always) and on hover desktop */}
      {onRemove && (
        <button
          onClick={() => onRemove(task.id)}
          className={cn(
            "shrink-0 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg transition-colors text-sm sm:opacity-0 sm:group-hover:opacity-100",
            isHighImpact
              ? "text-emerald-200 hover:text-white hover:bg-emerald-600"
              : isDistraction
              ? "text-rose-200 hover:text-white hover:bg-rose-600"
              : "text-slate-400 hover:text-rose-600 hover:bg-white"
          )}
          aria-label="Eliminar tarea"
        >
          ✕
        </button>
      )}
    </motion.div>
  );
}
