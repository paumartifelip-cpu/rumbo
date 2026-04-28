"use client";

import { useState } from "react";
import { Card, EmptyState, PageHeader, ProgressBar } from "@/components/Card";
import { MoneyMetrics } from "@/components/MoneyMetrics";
import { CircularProgress } from "@/components/CircularProgress";
import { useRumbo } from "@/lib/store";
import { GoalCategory } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/utils";

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
  const { goals, addGoal, updateGoal, removeGoal, tasks } = useRumbo();
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
          return (
            <Card key={g.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-rumbo-muted">
                    {g.category}
                  </div>
                  <h3 className="text-lg font-semibold mt-1">{g.title}</h3>
                  {g.description && (
                    <p className="text-sm text-rumbo-muted mt-1">
                      {g.description}
                    </p>
                  )}
                </div>
                <span className="chip bg-slate-100 text-slate-600">
                  ⭐ {g.importance}/10
                </span>
              </div>

              <div className="my-5 flex justify-center">
                <CircularProgress
                  value={computed}
                  size={170}
                  tone={g.category === "dinero" ? "green" : "violet"}
                  label={`Faltan ${100 - computed}%`}
                />
              </div>

              {g.deadline && (
                <div className="text-xs text-rumbo-muted text-center -mt-1">
                  Hasta {formatDate(g.deadline)}
                </div>
              )}

              {g.target_amount ? (
                <div className="mt-3 text-sm">
                  {formatMoney(g.current_amount ?? 0)} /{" "}
                  <span className="text-rumbo-muted">
                    {formatMoney(g.target_amount)}
                  </span>
                </div>
              ) : null}

              <div className="mt-4 flex gap-2">
                <select
                  className="input text-xs flex-1"
                  value={g.status}
                  onChange={(e) =>
                    updateGoal(g.id, { status: e.target.value as any })
                  }
                >
                  <option value="activo">Activo</option>
                  <option value="pausado">Pausado</option>
                  <option value="completado">Completado</option>
                </select>
                <button
                  onClick={() => removeGoal(g.id)}
                  className="btn-ghost text-rose-600 text-xs"
                >
                  Eliminar
                </button>
              </div>
            </Card>
          );
        })}
        {goals.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState
              icon="🚩"
              title="Aún no tienes objetivos"
              description="Crea el primero para empezar a medir tu rumbo."
              action={
                <button className="btn-primary" onClick={() => setOpen(true)}>
                  + Nuevo objetivo
                </button>
              }
            />
          </div>
        )}
      </div>

      {open && <GoalForm onClose={() => setOpen(false)} onSave={addGoal} />}
    </div>
  );
}

function GoalForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: ReturnType<typeof useRumbo>["addGoal"];
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
              placeholder="Ej: Ganar 5.000 €/mes"
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
              <label className="label">Cantidad objetivo (€)</label>
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
              <label className="label">Cantidad actual (€)</label>
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
