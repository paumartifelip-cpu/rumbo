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
  const borderTone =
    score === undefined
      ? "border-slate-200"
      : score >= 70
      ? "border-emerald-500 bg-emerald-50/30"
      : score >= 40
      ? "border-amber-400 bg-amber-50/30"
      : "border-rose-400 bg-rose-50/30";

  const badgeTone =
    score === undefined
      ? "bg-slate-200 text-slate-600"
      : score >= 70
      ? "bg-emerald-500 text-white"
      : score >= 40
      ? "bg-amber-400 text-amber-950"
      : "bg-rose-500 text-white";

  const done = task.status === "completada";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={cn(
        "card p-4 flex items-start gap-3 hover:shadow-soft transition-all border-l-[6px]",
        borderTone,
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
              "font-semibold text-lg leading-snug text-rumbo-ink",
              done && "line-through text-rumbo-muted"
            )}
          >
            {task.title}
          </h3>
          {task.recurrence && (
            <span className="text-[10px] bg-slate-100 text-rumbo-muted px-1.5 py-0.5 rounded flex items-center gap-1 font-medium capitalize">
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
          <p className="text-sm text-rumbo-muted/90 mt-2 leading-relaxed">
            {task.ai_reason}
          </p>
        )}
        {goal && !task.ai_reason && (
          <p className="text-xs text-rumbo-muted mt-1">{goal.title}</p>
        )}
      </div>

      {score !== undefined && (
        <div className="flex flex-col items-center justify-center shrink-0 ml-2">
          <div className={cn("text-xl font-black px-3 py-1.5 rounded-xl shadow-sm min-w-[3rem] text-center", badgeTone)}>
            {score}
          </div>
          <div className="text-[9px] font-bold text-rumbo-muted uppercase tracking-widest mt-1.5">
            Impacto
          </div>
        </div>
      )}

      {onRemove && (
        <button
          onClick={() => onRemove(task.id)}
          className="text-rumbo-muted hover:text-rose-600 text-sm shrink-0 ml-2 self-start p-1"
          aria-label="Eliminar tarea"
        >
          ✕
        </button>
      )}
    </motion.div>
  );
}
