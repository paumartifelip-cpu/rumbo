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

const CAT_COLORS: Record<ToolCategory, { text: string; bg: string; darkText: string; darkBg: string }> = {
  Productividad: { text: "text-violet-600", bg: "bg-violet-50", darkText: "text-violet-300", darkBg: "bg-violet-500/10" },
  Finanzas:      { text: "text-emerald-600", bg: "bg-emerald-50", darkText: "text-emerald-300", darkBg: "bg-emerald-500/10" },
  IA:            { text: "text-blue-600", bg: "bg-blue-50", darkText: "text-blue-300", darkBg: "bg-blue-500/10" },
  Contenido:     { text: "text-orange-600", bg: "bg-orange-50", darkText: "text-orange-300", darkBg: "bg-orange-500/10" },
  Automatización:{ text: "text-amber-600", bg: "bg-amber-50", darkText: "text-amber-300", darkBg: "bg-amber-500/10" },
  Código:        { text: "text-slate-600", bg: "bg-slate-100", darkText: "text-slate-300", darkBg: "bg-white/10" },
  Marketing:     { text: "text-pink-600", bg: "bg-pink-50", darkText: "text-pink-300", darkBg: "bg-pink-500/10" },
  Comunicación:  { text: "text-cyan-600", bg: "bg-cyan-50", darkText: "text-cyan-300", darkBg: "bg-cyan-500/10" },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StackPage() {
  const { userTools, addUserTool, removeUserTool, updateUserTool } = useRumbo();
  
  const [activeCategory, setActiveCategory] = useState<ToolCategory | "Todas">("Todas");
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<UserTool | null>(null);

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

  return (
    <div className="pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      {/* ── YouTube banner – always visible ─────────────────────────────────── */}
      <motion.a
        href="https://www.youtube.com/@paumartifelip"
        target="_blank"
        rel="noopener noreferrer"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white p-4 mb-8 shadow-md overflow-hidden relative cursor-pointer border border-red-500/20"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
        
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
      </motion.a>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Stack de Herramientas</h1>
          <p className="text-slate-500 text-sm mt-1">
            Personaliza tu directorio de herramientas. Las de pago cambian a un elegante negro profesional para destacarlas.
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
            {highlights.map((tool, i) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                index={i}
                featured
                onEdit={() => openEditModal(tool)}
                onDelete={() => removeUserTool(tool.id)}
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
            {rest.map((tool, i) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                index={i}
                onEdit={() => openEditModal(tool)}
                onDelete={() => removeUserTool(tool.id)}
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

      {/* ── Add/Edit Tool Modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden relative z-10 border border-slate-100"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
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

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-1">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                      Icono
                    </label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-center text-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
                      value={formState.icon}
                      onChange={(e) => setFormState({ ...formState, icon: e.target.value })}
                      placeholder="🔧"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
                      value={formState.name}
                      onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                      placeholder="Ej. Canva, Notion..."
                    />
                  </div>
                </div>

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
                      Tipo de Licencia
                    </label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all font-bold"
                      value={formState.free ? "free" : "paid"}
                      onChange={(e) => setFormState({ ...formState, free: e.target.value === "free" })}
                    >
                      <option value="free">Gratuita / Free</option>
                      <option value="paid">De Pago / Suscripción</option>
                    </select>
                  </div>
                </div>

                {/* Optional cost form fields */}
                <AnimatePresence>
                  {!formState.free && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="grid grid-cols-2 gap-4 pt-1 overflow-hidden"
                    >
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                          Coste / Tarifa
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
                          Frecuencia de Facturación
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
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                    URL de la Herramienta
                  </label>
                  <input
                    type="url"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
                    value={formState.url}
                    onChange={(e) => setFormState({ ...formState, url: e.target.value })}
                    placeholder="https://ejemplo.com"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                    Descripción Corta
                  </label>
                  <textarea
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all resize-none"
                    value={formState.description}
                    onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                    placeholder="Breve explicación de para qué sirve..."
                  />
                </div>

                <div className="flex items-center gap-4 py-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-4 h-4"
                      checked={formState.highlight}
                      onChange={(e) => setFormState({ ...formState, highlight: e.target.checked })}
                    />
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Destacar en la parte superior</span>
                  </label>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest text-center"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors text-xs font-black uppercase tracking-widest text-center"
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
  index: number;
  featured?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function ToolCard({ tool, index, featured, onEdit, onDelete }: ToolCardProps) {
  const formatMoney = useFormatMoney();
  const colors = CAT_COLORS[tool.category as ToolCategory] || { text: "text-slate-600", bg: "bg-slate-100", darkText: "text-slate-300", darkBg: "bg-white/10" };

  const isPaid = !tool.free;

  const handleCardClick = (e: React.MouseEvent) => {
    if (tool.url) {
      window.open(tool.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <motion.div
      onClick={handleCardClick}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, type: "spring", stiffness: 300, damping: 25 }}
      whileHover={{ y: -4, boxShadow: isPaid ? "0 12px 30px rgba(0,0,0,0.25)" : "0 10px 25px rgba(0,0,0,0.04)" }}
      className={cn(
        "group relative flex flex-col rounded-2xl border p-5 cursor-pointer select-none transition-all",
        // Paid/Subscription tool gets Pro Black style, Free tools get Google-Style clean white
        isPaid
          ? "bg-slate-900 hover:bg-slate-950 text-white border-slate-950 shadow-sm"
          : "bg-white border-slate-100 hover:border-slate-200 text-slate-900",
        featured && !isPaid ? "border-amber-200 bg-amber-50/5" : ""
      )}
    >
      {/* Absolute action buttons (Pencil + Trash) only visible clearly on hover */}
      <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit();
          }}
          title="Editar herramienta"
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center border shadow-sm transition-all text-xs font-bold",
            isPaid
              ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
              : "bg-slate-50 hover:bg-slate-100 border-slate-150 text-slate-500"
          )}
        >
          ✏️
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          title="Eliminar herramienta"
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center border shadow-sm transition-all text-xs font-bold",
            isPaid
              ? "bg-slate-800 hover:bg-red-950 border-slate-700 text-slate-300 hover:text-red-300"
              : "bg-slate-50 hover:bg-red-50 border-slate-150 text-slate-400 hover:text-red-500"
          )}
        >
          🗑️
        </button>
      </div>

      {/* Main Row */}
      <div className="flex items-center gap-3.5 mb-3.5">
        <div className={cn(
          "w-12 h-12 rounded-xl border flex items-center justify-center text-2xl shrink-0 shadow-sm transition-all",
          isPaid
            ? "bg-slate-800 border-slate-700"
            : "bg-slate-50 border-slate-100/80"
        )}>
          {tool.icon}
        </div>
        <div className="min-w-0 pr-16">
          <h3 className={cn(
            "font-black text-sm leading-tight truncate",
            isPaid ? "text-white" : "text-slate-900"
          )}>
            {tool.name}
          </h3>
          <span className={cn(
            "inline-block text-[10px] font-black uppercase tracking-wider mt-1 px-2 py-0.5 rounded-md",
            isPaid ? colors.darkText + " " + colors.darkBg : colors.text + " " + colors.bg
          )}>
            {tool.category}
          </span>
        </div>
      </div>

      {/* Simplified, elegant description */}
      {tool.description && (
        <p className={cn(
          "text-xs leading-relaxed mb-4 flex-1 line-clamp-2",
          isPaid ? "text-slate-300" : "text-slate-500"
        )}>
          {tool.description}
        </p>
      )}

      {/* Clean elegant bottom bar */}
      <div className={cn(
        "flex items-center justify-between pt-3.5 border-t",
        isPaid ? "border-slate-800/80" : "border-slate-100/50"
      )}>
        <span className={cn(
          "text-[11px] font-black uppercase tracking-wider transition-colors flex items-center gap-1",
          isPaid ? "text-slate-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-700"
        )}>
          Visitar <span>→</span>
        </span>

        {/* Cost / Rating Display */}
        <div className="flex items-center gap-2">
          {isPaid ? (
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {tool.cost && tool.cost > 0 ? `${formatMoney(tool.cost)} / ${tool.billing_period === "yearly" ? "año" : "mes"}` : "Pago"}
            </span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
              Gratis
            </span>
          )}
          {featured && (
            <span className={cn(
              "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded",
              isPaid ? "bg-amber-500/10 text-amber-400" : "bg-amber-100 text-amber-800"
            )}>
              TOP
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
