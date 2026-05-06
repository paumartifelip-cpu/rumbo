"use client";

import { useState } from "react";
import { Card, EmptyState, PageHeader, ProgressBar } from "@/components/Card";
import { MoneyMetrics } from "@/components/MoneyMetrics";
import { CircularProgress } from "@/components/CircularProgress";
import { useFormatMoney, useRumbo } from "@/lib/store";
import { GoalCategory } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { CURRENCIES } from "@/lib/currency";

const CATEGORIES: GoalCategory[] = [
  "dinero",
  "negocio",
  "salud",
  "aprendizaje",
  "contenido",
  "vida personal",
  "productividad",
];

export default function GoalsPage() {
  const { goals, addGoal, updateGoal, removeGoal, tasks, primaryCurrency } =
    useRumbo();
  const formatMoney = useFormatMoney();
  const symbol = CURRENCIES[primaryCurrency].symbol;
  const [open, setOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="Objetivos"
        subtitle="Define lo que de verdad importa. Cada tarea debería empujarte hacia uno de estos."
        action={
          <button className="btn-primary" onClick={() => setOpen(true)}>
            + Nuevo objetivo
          </button>
        }
      />

      <div className="mb-6">
        <MoneyMetrics />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {goals.map((g) => {
          const linked = tasks.filter((t) => t.goal_id === g.id);
          const done = linked.filter((t) => t.status === "completada").length;
          const computed =
            linked.length > 0
              ? Math.round((done / linked.length) * 100)
              : g.target_amount
              ? Math.round(
                  ((g.current_amount ?? 0) / g.target_amount) * 100
                )
              : g.progress;
          const iconMap: Record<string, string> = {
            dinero: "💰",
            negocio: "💼",
            salud: "🏥",
            aprendizaje: "📚",
            contenido: "📹",
            "vida personal": "🧘",
            productividad: "⚡",
          };
          const catIcon = iconMap[g.category] || "🎯";

          return (
            <div key={g.id} className="relative overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-2xl p-5 flex flex-col group">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xl shadow-sm shrink-0">
                    {catIcon}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-tight">{g.title}</h3>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                      {g.category}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => updateGoal(g.id, { status: g.status === "completado" ? "activo" : "completado" })}
                      className={`text-xs px-2 py-1 rounded-md font-bold transition-colors ${
                        g.status === "completado" ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                      }`}
                    >
                      {g.status === "completado" ? "Reabrir" : "✓ Completar"}
                    </button>
                    <button
                      onClick={() => removeGoal(g.id)}
                      className="text-xs px-2 py-1 rounded-md font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                      title="Eliminar"
                    >
                      ✕
                    </button>
                  </div>
                  {g.status === "completado" && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-widest">
                      Logrado
                    </span>
                  )}
                  {g.status === "pausado" && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-widest">
                      Pausado
                    </span>
                  )}
                </div>
              </div>

              {g.description && (
                <p className="text-sm text-slate-500 mb-5 line-clamp-2">
                  {g.description}
                </p>
              )}

              <div className="mt-auto">
                <div className="flex justify-between items-end mb-2">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Progreso</div>
                  <div className="text-lg font-black text-slate-800">{computed}%</div>
                </div>
                
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${
                      computed === 100 ? "bg-emerald-500" : (g.category === "dinero" ? "bg-emerald-400" : "bg-violet-500")
                    }`}
                    style={{ width: `${Math.min(100, computed)}%` }}
                  />
                </div>

                <div className="flex justify-between items-center mt-3">
                  {g.target_amount ? (
                    <div className="text-xs font-bold text-slate-700">
                      {formatMoney(g.current_amount ?? 0)} <span className="text-slate-400 font-medium">/ {formatMoney(g.target_amount)}</span>
                    </div>
                  ) : (
                    <div className="text-xs font-bold text-slate-400">
                      {linked.length > 0 ? `${done} de ${linked.length} tareas` : "Basado en progreso manual"}
                    </div>
                  )}

                  {g.deadline && (
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      🗓️ {formatDate(g.deadline)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {goals.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-center py-16 px-6 border border-slate-800 shadow-2xl">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full blur-[100px] opacity-20 -translate-y-1/2 translate-x-1/2"></div>
              
              <div className="relative z-10 max-w-md mx-auto">
                <div className="w-20 h-20 bg-white/10 rounded-3xl backdrop-blur-xl border border-white/20 flex items-center justify-center text-4xl shadow-xl mx-auto mb-6">
                  🏔️
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-white mb-3 tracking-tight">
                  Un barco sin rumbo no llega a ningún puerto
                </h2>
                <p className="text-slate-400 text-sm md:text-base mb-8">
                  Define tu primer gran objetivo. Ya sea financiero, de salud o de negocio, darle un norte a tus tareas multiplicará tu enfoque.
                </p>
                <button 
                  className="bg-white text-slate-900 hover:bg-slate-100 hover:scale-105 transition-all font-bold px-8 py-3.5 rounded-full shadow-lg"
                  onClick={() => setOpen(true)}
                >
                  + Trazar mi primer rumbo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {open && (
        <GoalForm
          onClose={() => setOpen(false)}
          onSave={addGoal}
          currencySymbol={symbol}
        />
      )}
    </div>
  );
}

function GoalForm({
  onClose,
  onSave,
  currencySymbol,
}: {
  onClose: () => void;
  onSave: ReturnType<typeof useRumbo>["addGoal"];
  currencySymbol: string;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "dinero" as GoalCategory,
    target_amount: 0,
    current_amount: 0,
    deadline: "",
    importance: 8,
    status: "activo" as const,
  });

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card w-full max-w-md p-5">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">Nuevo objetivo</h3>
          <button onClick={onClose} className="text-rumbo-muted">
            ✕
          </button>
        </div>
        <div className="grid gap-3">
          <div>
            <label className="label">Título</label>
            <input
              className="input"
              placeholder={`Ej: Ganar 5.000 ${currencySymbol}/mes`}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea
              className="input"
              rows={2}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoría</label>
              <select
                className="input"
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value as GoalCategory,
                  })
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Importancia (1–10)</label>
              <input
                type="number"
                min={1}
                max={10}
                className="input"
                value={form.importance}
                onChange={(e) =>
                  setForm({
                    ...form,
                    importance: Number(e.target.value) || 1,
                  })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cantidad objetivo ({currencySymbol})</label>
              <input
                type="number"
                className="input"
                value={form.target_amount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    target_amount: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div>
              <label className="label">Cantidad actual ({currencySymbol})</label>
              <input
                type="number"
                className="input"
                value={form.current_amount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    current_amount: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
          <div>
            <label className="label">Fecha límite</label>
            <input
              type="date"
              className="input"
              value={form.deadline}
              onChange={(e) =>
                setForm({ ...form, deadline: e.target.value })
              }
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-ghost">
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!form.title) return;
              onSave({
                ...form,
                deadline: form.deadline
                  ? new Date(form.deadline).toISOString()
                  : undefined,
              });
              onClose();
            }}
            className="btn-primary"
          >
            Crear objetivo
          </button>
        </div>
      </div>
    </div>
  );
}
