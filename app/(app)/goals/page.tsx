"use client";

import { useState } from "react";
import { MoneyMetrics } from "@/components/MoneyMetrics";
import { useFormatMoney, useRumbo } from "@/lib/store";
import { Goal, GoalCategory } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { CURRENCIES } from "@/lib/currency";
import { cn } from "@/lib/utils";

const CATEGORIES: GoalCategory[] = [
  "dinero",
  "negocio",
  "salud",
  "aprendizaje",
  "contenido",
  "vida personal",
  "productividad",
];

const CAT_ICON: Record<string, string> = {
  dinero: "💰",
  negocio: "💼",
  salud: "🏥",
  aprendizaje: "📚",
  contenido: "📹",
  "vida personal": "🧘",
  productividad: "⚡",
};

const TIMEFRAMES = [
  { value: "" as const, label: "🎯 Sin plazo", color: "bg-slate-100 text-slate-600" },
  { value: "diario" as const, label: "☀️ Del día", color: "bg-amber-50 text-amber-700" },
  { value: "semanal" as const, label: "📅 De la semana", color: "bg-blue-50 text-blue-700" },
  { value: "mensual" as const, label: "🗓️ Del mes", color: "bg-violet-50 text-violet-700" },
  { value: "anual" as const, label: "🚀 Del año", color: "bg-emerald-50 text-emerald-700" },
];

const TIMEFRAME_META: Record<string, { label: string; icon: string; gradient: string; border: string; header: string }> = {
  diario:  { label: "HOY",    icon: "☀️",  gradient: "from-amber-50 to-orange-50",  border: "border-amber-200",  header: "text-amber-700" },
  semanal: { label: "SEMANA", icon: "📅",  gradient: "from-blue-50 to-indigo-50",   border: "border-blue-200",   header: "text-blue-700" },
  mensual: { label: "MES",    icon: "🗓️", gradient: "from-violet-50 to-purple-50",  border: "border-violet-200", header: "text-violet-700" },
  anual:   { label: "AÑO",    icon: "🚀",  gradient: "from-emerald-50 to-teal-50",  border: "border-emerald-200",header: "text-emerald-700" },
  "":      { label: "GENERAL", icon: "🎯", gradient: "from-slate-50 to-gray-50",    border: "border-slate-200",  header: "text-slate-600" },
};

export default function GoalsPage() {
  const { goals, addGoal, updateGoal, removeGoal, primaryCurrency } = useRumbo();
  const formatMoney = useFormatMoney();
  const symbol = CURRENCIES[primaryCurrency].symbol;
  const [open, setOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);

  // Group by timeframe (order: diario, semanal, mensual, anual, general)
  const order = ["diario", "semanal", "mensual", "anual", ""];
  const grouped: Record<string, Goal[]> = {};
  for (const tf of order) {
    grouped[tf] = goals.filter((g) => (g.timeframe ?? "") === tf);
  }

  const activeGroups = order.filter((tf) => grouped[tf].length > 0);

  return (
    <div className="pb-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Objetivos</h1>
          <p className="text-slate-500 text-sm mt-0.5">Define lo que importa. Organiza tu rumbo por tiempo.</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white font-bold text-sm px-5 py-2.5 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
        >
          <span className="text-lg leading-none">+</span> Nuevo objetivo
        </button>
      </div>

      <div className="mb-6">
        <MoneyMetrics />
      </div>

      {/* Empty state */}
      {goals.length === 0 && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-center py-20 px-6 border border-slate-800 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full blur-[100px] opacity-20 -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 max-w-md mx-auto">
            <div className="w-20 h-20 bg-white/10 rounded-3xl backdrop-blur-xl border border-white/20 flex items-center justify-center text-4xl shadow-xl mx-auto mb-6">🏔️</div>
            <h2 className="text-2xl md:text-3xl font-black text-white mb-3 tracking-tight">Un barco sin rumbo no llega a ningún puerto</h2>
            <p className="text-slate-400 text-sm md:text-base mb-8">Define tu primer gran objetivo. Ya sea financiero, de salud o de negocio, darle un norte a tus tareas multiplicará tu enfoque.</p>
            <button
              className="bg-white text-slate-900 hover:bg-slate-100 hover:scale-105 transition-all font-bold px-8 py-3.5 rounded-full shadow-lg"
              onClick={() => setOpen(true)}
            >
              + Trazar mi primer rumbo
            </button>
          </div>
        </div>
      )}

      {/* Calendar-style sections */}
      <div className="space-y-10">
        {activeGroups.map((tf) => {
          const meta = TIMEFRAME_META[tf];
          return (
            <section key={tf}>
              {/* Section header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{meta.icon}</span>
                  <span className={cn("text-xs font-black uppercase tracking-[0.15em]", meta.header)}>{meta.label}</span>
                </div>
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-xs text-slate-400 font-bold">{grouped[tf].length} objetivo{grouped[tf].length !== 1 ? "s" : ""}</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {grouped[tf].map((g) => {
                  const isIncremental = !!g.unit && !!g.target_amount;
                  const computed = isIncremental
                    ? Math.min(100, Math.round(((g.current_amount ?? 0) / g.target_amount!) * 100))
                    : g.target_amount
                    ? Math.min(100, Math.round(((g.current_amount ?? 0) / g.target_amount) * 100))
                    : g.progress;

                  const isComplete = computed >= 100 || g.status === "completado";

                  return (
                    <div
                      key={g.id}
                      className={cn(
                        "relative overflow-hidden bg-gradient-to-br border shadow-sm hover:shadow-md transition-all rounded-2xl p-5 flex flex-col group",
                        isComplete
                          ? "from-emerald-50 to-green-50 border-emerald-200"
                          : `${meta.gradient} ${meta.border}`
                      )}
                    >
                      {/* Completion ribbon */}
                      {isComplete && (
                        <div className="absolute top-3 right-3">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest shadow-sm">✓ Logrado</span>
                        </div>
                      )}
                      {g.status === "pausado" && !isComplete && (
                        <div className="absolute top-3 right-3">
                          <span className="px-2 py-0.5 rounded-full bg-amber-400 text-white text-[10px] font-black uppercase tracking-widest shadow-sm">⏸ Pausado</span>
                        </div>
                      )}

                      {/* Card top */}
                      <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-white/80 border border-white shadow-sm flex items-center justify-center text-xl shrink-0">
                          {CAT_ICON[g.category] || "🎯"}
                        </div>
                        <div className="flex-1 min-w-0 pr-14">
                          <h3 className="text-sm font-black text-slate-900 leading-snug">{g.title}</h3>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{g.category}</div>
                        </div>
                      </div>

                      {g.description && (
                        <p className="text-xs text-slate-500 mb-4 line-clamp-2">{g.description}</p>
                      )}

                      {/* Progress section */}
                      <div className="mt-auto">
                        {/* Incremental mode: dots or bar + +1 button */}
                        {isIncremental ? (
                          <div className="space-y-2">
                            <div className="flex justify-between items-end">
                              <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                {g.unit}
                              </div>
                              <div className="text-2xl font-black text-slate-900 tabular-nums">
                                {Math.round(g.current_amount ?? 0)}
                                <span className="text-sm font-bold text-slate-400">/{g.target_amount}</span>
                              </div>
                            </div>

                            {/* Dot tracker (for small goals ≤20) or bar */}
                            {g.target_amount! <= 20 ? (
                              <div className="flex flex-wrap gap-1.5 my-2">
                                {Array.from({ length: g.target_amount! }).map((_, i) => (
                                  <div
                                    key={i}
                                    className={cn(
                                      "w-5 h-5 rounded-full border-2 transition-colors",
                                      i < Math.round(g.current_amount ?? 0)
                                        ? "bg-emerald-500 border-emerald-500 shadow-sm"
                                        : "bg-white border-slate-300"
                                    )}
                                  />
                                ))}
                              </div>
                            ) : (
                              <div className="w-full h-3 bg-white/70 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                                  style={{ width: `${computed}%` }}
                                />
                              </div>
                            )}

                            {/* +1 big button */}
                            {!isComplete && (
                              <button
                                onClick={() =>
                                  updateGoal(g.id, {
                                    current_amount: Math.min(
                                      g.target_amount!,
                                      (g.current_amount ?? 0) + 1
                                    ),
                                  })
                                }
                                className="w-full mt-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-black text-sm shadow-md transition-all flex items-center justify-center gap-2"
                              >
                                <span className="text-lg">+1</span>
                                <span>{g.unit}</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          // Standard progress bar
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-end">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Progreso</div>
                              <div className="text-base font-black text-slate-800">{computed}%</div>
                            </div>
                            <div className="w-full h-2.5 bg-white/70 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-1000",
                                  computed === 100 ? "bg-emerald-500" : g.category === "dinero" ? "bg-emerald-400" : "bg-violet-500"
                                )}
                                style={{ width: `${Math.min(100, computed)}%` }}
                              />
                            </div>
                            {g.target_amount ? (
                              <div className="text-xs font-bold text-slate-600 pt-0.5">
                                {formatMoney(g.current_amount ?? 0)}
                                <span className="text-slate-400 font-medium"> / {formatMoney(g.target_amount)}</span>
                              </div>
                            ) : null}
                          </div>
                        )}

                        {/* Footer: deadline + actions */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/60">
                          {g.deadline ? (
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                              🗓️ {formatDate(g.deadline)}
                            </div>
                          ) : <div />}

                          <div className="flex gap-1 mt-2">
                            <button
                              onClick={() => setEditGoal(g)}
                              className="flex-1 text-[11px] px-2 py-1.5 rounded-md font-bold transition-colors bg-slate-100 text-slate-600 hover:bg-slate-200"
                            >
                              ✏️ Editar
                            </button>
                            <button
                              onClick={() => updateGoal(g.id, {
                                status: g.status === "completado" ? "activo" : "completado",
                                progress: g.status === "completado" ? g.progress : 100,
                              })}
                              className={cn(
                                "flex-1 text-[11px] px-2 py-1.5 rounded-md font-bold transition-colors",
                                g.status === "completado"
                                  ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                  : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              )}
                            >
                              {g.status === "completado" ? "↩ Reabrir" : "✓ Completar"}
                            </button>
                            <button
                              onClick={() => removeGoal(g.id)}
                              className="text-[11px] px-2 py-1.5 rounded-md font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {open && (
        <GoalForm
          onClose={() => setOpen(false)}
          onSave={addGoal}
          currencySymbol={symbol}
        />
      )}
      {editGoal && (
        <GoalForm
          initial={editGoal}
          onClose={() => setEditGoal(null)}
          onSave={(patch) => { updateGoal(editGoal.id, patch); setEditGoal(null); }}
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
  initial,
}: {
  onClose: () => void;
  onSave: (g: any) => void;
  currencySymbol: string;
  initial?: Goal;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    category: (initial?.category ?? "dinero") as GoalCategory,
    timeframe: (initial?.timeframe ?? "") as "" | "diario" | "semanal" | "mensual" | "anual",
    unit: initial?.unit ?? "",
    target_amount: initial?.target_amount ?? 0,
    current_amount: initial?.current_amount ?? 0,
    deadline: initial?.deadline ? initial.deadline.slice(0, 10) : "",
    importance: initial?.importance ?? 8,
    status: (initial?.status ?? "activo") as "activo" | "pausado" | "completado",
  });

  const isIncremental = !!form.unit.trim() && form.target_amount > 0;

  const handleSave = () => {
    if (!form.title.trim()) return;
    onSave({
      ...form,
      timeframe: form.timeframe || undefined,
      unit: form.unit.trim() || undefined,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Modal header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-900">{isEdit ? "Editar objetivo" : "Nuevo objetivo"}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{isEdit ? "Modifica los detalles de tu objetivo" : "Define tu meta, elige el periodo y el tipo de seguimiento"}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors text-sm font-bold">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Título del objetivo</label>
            <input
              autoFocus
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              placeholder={`Ej: Subir 10 vídeos de YouTube`}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          {/* Timeframe pills */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">¿Para cuándo?</label>
            <div className="flex flex-wrap gap-2">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => setForm({ ...form, timeframe: tf.value as any })}
                  className={cn(
                    "text-sm font-bold px-3 py-1.5 rounded-full border-2 transition-all",
                    form.timeframe === tf.value
                      ? "border-slate-900 bg-slate-900 text-white shadow-md"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                  )}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Categoría</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, category: c })}
                  className={cn(
                    "text-sm font-bold px-3 py-1.5 rounded-full border-2 transition-all flex items-center gap-1",
                    form.category === c
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                  )}
                >
                  {CAT_ICON[c]} {c}
                </button>
              ))}
            </div>
          </div>

          {/* Incremental tracking */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-slate-700">🔢 Seguimiento por clics</span>
              <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold rounded-full uppercase tracking-widest">Opcional</span>
            </div>
            <p className="text-xs text-slate-400">Si defines una unidad y un número, podrás pulsar <strong className="text-slate-600">+1</strong> cada vez que completes una acción (ej: "vídeos", "sesiones", "km").</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Unidad (ej: vídeos)</label>
                <input
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="vídeos, sesiones..."
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Meta (cantidad)</label>
                <input
                  type="number"
                  min={1}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="10"
                  value={form.target_amount || ""}
                  onChange={(e) => setForm({ ...form, target_amount: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            {isIncremental && (
              <div className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-3 py-2 font-bold">
                ✓ Podrás hacer clic +1 para registrar cada {form.unit.trim()} hasta llegar a {form.target_amount}.
              </div>
            )}
          </div>

          {/* Money tracking (optional) */}
          {!isIncremental && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Meta ({currencySymbol})</label>
                <input
                  type="number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  value={form.target_amount || ""}
                  placeholder="0"
                  onChange={(e) => setForm({ ...form, target_amount: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Actual ({currencySymbol})</label>
                <input
                  type="number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  value={form.current_amount || ""}
                  placeholder="0"
                  onChange={(e) => setForm({ ...form, current_amount: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
          )}

          {/* Deadline */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Fecha límite (opcional)</label>
            <input
              type="date"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Descripción (opcional)</label>
            <textarea
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
              rows={2}
              placeholder="¿Por qué es importante este objetivo?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-100 space-y-3">
          {isEdit && (
            <div className="flex gap-2">
              {(["activo", "pausado", "completado"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setForm({ ...form, status: s })}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors",
                    form.status === s
                      ? s === "completado" ? "bg-emerald-500 text-white" : s === "pausado" ? "bg-amber-400 text-white" : "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  )}
                >
                  {s === "activo" ? "Activo" : s === "pausado" ? "⏸ Pausado" : "✓ Completado"}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!form.title.trim()}
              className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm transition-all shadow-lg"
            >
              {isEdit ? "Guardar cambios" : "Crear objetivo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
