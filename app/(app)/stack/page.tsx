"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useRumbo, useFormatMoney } from "@/lib/store";
import { UserTool } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

type ToolCategory =
  | "Productividad"
  | "Finanzas"
  | "IA"
  | "Contenido"
  | "Código"
  | "Automatización"
  | "Marketing"
  | "Comunicación";

const CATEGORIES: ToolCategory[] = [
  "Productividad",
  "Finanzas",
  "IA",
  "Contenido",
  "Automatización",
  "Código",
  "Marketing",
  "Comunicación",
];

const CAT_COLORS: Record<ToolCategory, { text: string; bg: string }> = {
  Productividad: { text: "text-violet-600", bg: "bg-violet-50" },
  Finanzas:      { text: "text-emerald-600", bg: "bg-emerald-50" },
  IA:            { text: "text-blue-600", bg: "bg-blue-50" },
  Contenido:     { text: "text-orange-600", bg: "bg-orange-50" },
  Automatización:{ text: "text-amber-600", bg: "bg-amber-50" },
  Código:        { text: "text-slate-600", bg: "bg-slate-100" },
  Marketing:     { text: "text-pink-600", bg: "bg-pink-50" },
  Comunicación:  { text: "text-cyan-600", bg: "bg-cyan-50" },
};

// Curated emoji options for the icon picker — grouped for browsing.
const ICON_OPTIONS: { group: string; icons: string[] }[] = [
  {
    group: "Trabajo",
    icons: ["🔧", "🛠️", "⚙️", "📊", "📈", "📉", "📋", "📌", "📎", "🗂️", "🗃️", "📁"],
  },
  {
    group: "Productividad",
    icons: ["📓", "📔", "📒", "📕", "📗", "📘", "📙", "📚", "✏️", "🖊️", "🖋️", "✒️", "📝", "🗒️", "🗓️", "📅", "☑️", "✅"],
  },
  {
    group: "Tech / IA",
    icons: ["🤖", "🧠", "✨", "🚀", "⚡", "💡", "🔮", "🛸", "👾", "🎛️", "🖥️", "⌨️", "🖱️", "💾", "💿", "🧬"],
  },
  {
    group: "Comunicación",
    icons: ["💬", "💭", "🗣️", "📞", "☎️", "📱", "📲", "📨", "📩", "📧", "📤", "📥", "📡"],
  },
  {
    group: "Diseño / Contenido",
    icons: ["🎨", "🖌️", "🖍️", "🎬", "🎞️", "📹", "📷", "📸", "🎥", "🎙️", "🎧", "🎵", "🎶", "🖼️"],
  },
  {
    group: "Finanzas",
    icons: ["💰", "💵", "💴", "💶", "💷", "💸", "💳", "💎", "🏦", "📊", "📈", "🪙", "🧾"],
  },
  {
    group: "Web / Plataformas",
    icons: ["🌍", "🌐", "🔗", "🔍", "🔎", "🛒", "🏷️", "📦", "🚚", "🛍️", "🐝", "🟢", "🔴", "🟡", "🔵", "🟣", "🟠", "▲", "▼"],
  },
  {
    group: "Otros",
    icons: ["⭐", "🌟", "🌈", "🔥", "❤️", "💯", "🎯", "🏆", "🪨", "🌱", "🍅", "🦊", "🐙", "🦄", "🍀"],
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StackPage() {
  const { userTools, addUserTool, removeUserTool, updateUserTool } = useRumbo();

  const [activeCategory, setActiveCategory] = useState<ToolCategory | "Todas">("Todas");
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<UserTool | null>(null);
  const [detailTool, setDetailTool] = useState<UserTool | null>(null);

  // Form State
  const [formState, setFormState] = useState({
    name: "",
    icon: "🔧",
    category: "Productividad" as ToolCategory,
    description: "",
    url: "",
    free: true,
    cost: 0,
    billing_period: "monthly" as "monthly" | "yearly",
    highlight: false,
  });

  const displayed = useMemo(() => {
    return (userTools || []).filter((t) => {
      if (activeCategory !== "Todas" && t.category !== activeCategory) return false;
      if (
        search &&
        !t.name.toLowerCase().includes(search.toLowerCase()) &&
        !(t.description || "").toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [userTools, activeCategory, search]);

  const highlights = displayed.filter((t) => t.highlight);
  const rest       = displayed.filter((t) => !t.highlight);

  const openAddModal = () => {
    setEditingTool(null);
    setFormState({
      name: "",
      icon: "🔧",
      category: "Productividad",
      description: "",
      url: "",
      free: true,
      cost: 0,
      billing_period: "monthly",
      highlight: false,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (tool: UserTool) => {
    setEditingTool(tool);
    setFormState({
      name: tool.name,
      icon: tool.icon || "🔧",
      category: (tool.category as ToolCategory) || "Productividad",
      description: tool.description || "",
      url: tool.url || "",
      free: tool.free,
      cost: tool.cost || 0,
      billing_period: tool.billing_period || "monthly",
      highlight: !!tool.highlight,
    });
    setDetailTool(null);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim()) return;

    const payload = {
      name: formState.name,
      icon: formState.icon || "🔧",
      category: formState.category,
      description: formState.description || undefined,
      url: formState.url || undefined,
      free: formState.free,
      cost: formState.free ? 0 : Number(formState.cost || 0),
      billing_period: formState.free ? "monthly" as const : formState.billing_period,
      highlight: formState.highlight,
      rating: editingTool ? editingTool.rating : 5,
    };

    if (editingTool) {
      updateUserTool(editingTool.id, payload);
    } else {
      addUserTool(payload);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (tool: UserTool) => {
    if (!confirm(`¿Eliminar ${tool.name}?`)) return;
    removeUserTool(tool.id);
    setDetailTool(null);
  };

  return (
    <div className="pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

      {/* ── YouTube banner ───────────────────────────────────────────────────── */}
      <a
        href="https://www.youtube.com/@paumartifelip"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white p-4 mb-8 shadow-md overflow-hidden relative cursor-pointer border border-red-500/20"
      >
        <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl shrink-0">
          ▶️
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-black text-base leading-tight">@paumartifelip</div>
          <div className="text-white/80 text-xs mt-0.5 truncate">
            YouTube · Productividad, IA y negocios online
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="hidden sm:inline text-xs font-black uppercase tracking-widest bg-white/20 px-3 py-1.5 rounded-full">
            Suscríbete
          </span>
          <span className="text-white/80 text-xl font-bold">›</span>
        </div>
      </a>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Stack de Herramientas</h1>
          <p className="text-slate-500 text-sm mt-1">
            Tu directorio personal. Solo herramientas gratuitas por defecto — añade las de pago si las necesitas.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-black uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-sm self-start md:self-auto"
        >
          <span>+ Añadir Herramienta</span>
        </button>
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
            placeholder="Buscar por nombre o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Category pills ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-8 border-b border-slate-100 pb-4">
        {(["Todas", ...CATEGORIES] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat as ToolCategory | "Todas")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest border transition-all",
              activeCategory === cat
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-800"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Destacadas ───────────────────────────────────────────────────────── */}
      {highlights.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-black uppercase tracking-widest text-amber-600">⭐ Destacadas</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                onMoreInfo={() => setDetailTool(tool)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Todas las demás ──────────────────────────────────────────────────── */}
      {rest.length > 0 && (
        <div>
          {highlights.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Herramientas</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                onMoreInfo={() => setDetailTool(tool)}
              />
            ))}
          </div>
        </div>
      )}

      {displayed.length === 0 && (
        <div className="text-center py-20 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <div className="text-4xl mb-3">🔎</div>
          <p className="font-bold text-slate-700">Sin resultados</p>
          <p className="text-sm mt-1">Prueba con otro término, categoría o añade tu propia herramienta.</p>
        </div>
      )}

      {/* ── Detail Modal ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {detailTool && (
          <DetailModal
            tool={detailTool}
            onClose={() => setDetailTool(null)}
            onEdit={() => openEditModal(detailTool)}
            onDelete={() => handleDelete(detailTool)}
          />
        )}
      </AnimatePresence>

      {/* ── Add/Edit Tool Modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden relative z-10 border border-slate-100 max-h-[90vh] overflow-y-auto"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <h3 className="font-black text-slate-900 text-lg tracking-tight uppercase">
                  {editingTool ? "Editar Herramienta" : "Nueva Herramienta"}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Name */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                    Nombre *
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-2xl shrink-0">
                      {formState.icon}
                    </div>
                    <input
                      type="text"
                      required
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
                      value={formState.name}
                      onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                      placeholder="Ej. Canva, Notion..."
                    />
                  </div>
                </div>

                {/* Icon picker */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                    Icono — elige uno
                  </label>
                  <div className="border border-slate-200 rounded-xl bg-slate-50/50 p-3 max-h-56 overflow-y-auto">
                    {ICON_OPTIONS.map((g) => (
                      <div key={g.group} className="mb-3 last:mb-0">
                        <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                          {g.group}
                        </div>
                        <div className="grid grid-cols-9 sm:grid-cols-12 gap-1">
                          {g.icons.map((ic) => (
                            <button
                              key={ic}
                              type="button"
                              onClick={() => setFormState({ ...formState, icon: ic })}
                              className={cn(
                                "aspect-square rounded-lg text-xl flex items-center justify-center transition-all",
                                formState.icon === ic
                                  ? "bg-slate-900 ring-2 ring-slate-900 scale-105"
                                  : "bg-white hover:bg-slate-100 border border-slate-100"
                              )}
                            >
                              {ic}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Category + Free/Paid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                      Categoría
                    </label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
                      value={formState.category}
                      onChange={(e) => setFormState({ ...formState, category: e.target.value as ToolCategory })}
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                      Tipo
                    </label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all font-bold"
                      value={formState.free ? "free" : "paid"}
                      onChange={(e) => setFormState({ ...formState, free: e.target.value === "free" })}
                    >
                      <option value="free">Gratuita</option>
                      <option value="paid">De pago</option>
                    </select>
                  </div>
                </div>

                {/* Cost (only when paid) */}
                {!formState.free && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                        Coste
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
                        value={formState.cost}
                        onChange={(e) => setFormState({ ...formState, cost: Number(e.target.value || 0) })}
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                        Frecuencia
                      </label>
                      <select
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
                        value={formState.billing_period}
                        onChange={(e) => setFormState({ ...formState, billing_period: e.target.value as "monthly" | "yearly" })}
                      >
                        <option value="monthly">Al mes</option>
                        <option value="yearly">Al año</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* URL */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                    URL
                  </label>
                  <input
                    type="url"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
                    value={formState.url}
                    onChange={(e) => setFormState({ ...formState, url: e.target.value })}
                    placeholder="https://ejemplo.com"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                    Descripción
                  </label>
                  <textarea
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all resize-none"
                    value={formState.description}
                    onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                    placeholder="Breve explicación de para qué sirve..."
                  />
                </div>

                {/* Highlight */}
                <div className="flex items-center gap-4 py-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-4 h-4"
                      checked={formState.highlight}
                      onChange={(e) => setFormState({ ...formState, highlight: e.target.checked })}
                    />
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Destacar arriba</span>
                  </label>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors text-xs font-black uppercase tracking-widest"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── ToolCard ─────────────────────────────────────────────────────────────────

interface ToolCardProps {
  tool: UserTool;
  onMoreInfo: () => void;
}

function ToolCard({ tool, onMoreInfo }: ToolCardProps) {
  const colors = CAT_COLORS[tool.category as ToolCategory] || { text: "text-slate-600", bg: "bg-slate-100" };
  const isPaid = !tool.free;

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border p-4 transition-colors",
        isPaid
          ? "bg-slate-900 text-white border-slate-950"
          : "bg-white border-slate-200 text-slate-900"
      )}
    >
      {/* Header: icon + name + category */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className={cn(
            "w-11 h-11 rounded-xl border flex items-center justify-center text-2xl shrink-0",
            isPaid ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-100"
          )}
        >
          {tool.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              "font-black text-sm leading-tight truncate",
              isPaid ? "text-white" : "text-slate-900"
            )}
          >
            {tool.name}
          </h3>
          <span
            className={cn(
              "inline-block text-[9px] font-black uppercase tracking-wider mt-0.5 px-1.5 py-0.5 rounded",
              isPaid ? "bg-white/10 text-slate-300" : `${colors.text} ${colors.bg}`
            )}
          >
            {tool.category}
          </span>
        </div>
      </div>

      {/* Buttons row */}
      <div className="flex gap-2 mt-auto">
        {tool.url ? (
          <a
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex-1 text-center px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors",
              isPaid
                ? "bg-white text-slate-900 hover:bg-slate-100"
                : "bg-slate-900 text-white hover:bg-slate-800"
            )}
          >
            Visitar →
          </a>
        ) : (
          <span
            className={cn(
              "flex-1 text-center px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest cursor-not-allowed",
              isPaid ? "bg-slate-800 text-slate-500" : "bg-slate-100 text-slate-400"
            )}
          >
            Sin URL
          </span>
        )}
        <button
          onClick={onMoreInfo}
          className={cn(
            "flex-1 text-center px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest border transition-colors",
            isPaid
              ? "border-slate-700 text-slate-200 hover:bg-slate-800"
              : "border-slate-200 text-slate-700 hover:bg-slate-50"
          )}
        >
          Más info
        </button>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

interface DetailModalProps {
  tool: UserTool;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function DetailModal({ tool, onClose, onEdit, onDelete }: DetailModalProps) {
  const formatMoney = useFormatMoney();
  const colors = CAT_COLORS[tool.category as ToolCategory] || { text: "text-slate-600", bg: "bg-slate-100" };
  const isPaid = !tool.free;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", duration: 0.4 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative z-10 border border-slate-100"
      >
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl shrink-0">
              {tool.icon}
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 text-base tracking-tight truncate">
                {tool.name}
              </h3>
              <span className={`inline-block text-[10px] font-black uppercase tracking-wider mt-0.5 px-2 py-0.5 rounded ${colors.text} ${colors.bg}`}>
                {tool.category}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all text-sm font-bold shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          {tool.description && (
            <p className="text-sm text-slate-600 leading-relaxed">
              {tool.description}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {isPaid ? (
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                {tool.cost && tool.cost > 0
                  ? `${formatMoney(tool.cost)} / ${tool.billing_period === "yearly" ? "año" : "mes"}`
                  : "De pago"}
              </span>
            ) : (
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                Gratis
              </span>
            )}
            {tool.highlight && (
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                ⭐ Destacada
              </span>
            )}
          </div>

          {tool.url && (
            <a
              href={tool.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center px-4 py-3 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors"
            >
              Visitar sitio web →
            </a>
          )}

          <div className="flex gap-2 pt-3 border-t border-slate-100">
            <button
              onClick={onEdit}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"
            >
              ✏️ Editar
            </button>
            <button
              onClick={onDelete}
              className="flex-1 px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors text-xs font-black uppercase tracking-widest"
            >
              🗑️ Eliminar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
