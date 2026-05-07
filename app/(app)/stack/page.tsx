"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { cn } from "@/lib/utils";
import { useRumbo } from "@/lib/store";
import { UserTool } from "@/lib/types";

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES = ["IA", "Imagen", "Vídeo", "Audio", "No-code", "Google"] as const;
type Category = (typeof CATEGORIES)[number];

const CAT_ACCENT: Record<string, string> = {
  IA:        "text-violet-700  bg-violet-50",
  Imagen:    "text-pink-700    bg-pink-50",
  "Vídeo":   "text-orange-700  bg-orange-50",
  Audio:     "text-amber-700   bg-amber-50",
  "No-code": "text-emerald-700 bg-emerald-50",
  Google:    "text-blue-700    bg-blue-50",
};

const ICON_OPTIONS: { group: string; icons: string[] }[] = [
  { group: "Trabajo",       icons: ["🔧", "🛠️", "⚙️", "📊", "📈", "📉", "📋", "📌", "📎", "🗂️", "🗃️", "📁"] },
  { group: "Productividad", icons: ["📓", "📔", "📒", "📕", "📗", "📘", "📙", "📚", "✏️", "🖊️", "📝", "🗒️", "🗓️", "📅", "☑️", "✅"] },
  { group: "Tech / IA",     icons: ["🤖", "🧠", "✨", "🚀", "⚡", "💡", "🔮", "🛸", "👾", "🎛️", "🖥️", "⌨️", "💾"] },
  { group: "Comunicación",  icons: ["💬", "💭", "🗣️", "📞", "📱", "📨", "📧", "📡"] },
  { group: "Diseño",        icons: ["🎨", "🖌️", "🎬", "🎞️", "📹", "📷", "🎥", "🎙️", "🎧", "🎵", "🖼️"] },
  { group: "Otros",         icons: ["⭐", "🌟", "🌈", "🔥", "🎯", "🏆", "🌱", "🍌", "🦊", "🦄", "🍀"] },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StackPage() {
  const { userTools, addUserTool, removeUserTool, updateUserTool, reorderUserTools } = useRumbo();

  const [activeCat, setActiveCat] = useState<Category | "Todas">("Todas");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<UserTool | null>(null);
  const [creating, setCreating] = useState(false);

  // Sort tools by order_index, fallback to original array order.
  const sorted = useMemo(() => {
    const arr = [...(userTools || [])];
    arr.sort((a, b) => {
      const ai = a.order_index ?? 9999;
      const bi = b.order_index ?? 9999;
      return ai - bi;
    });
    return arr;
  }, [userTools]);

  const visible = useMemo(() => {
    return sorted.filter((t) => {
      if (activeCat !== "Todas" && t.category !== activeCat) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.name.toLowerCase().includes(q) && !(t.description || "").toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [sorted, activeCat, search]);

  // Reorder uses the full sorted list (drag-and-drop only enabled when no
  // filters are active so the user is always reordering the canonical list).
  const canReorder = activeCat === "Todas" && !search;

  function handleReorder(newOrder: UserTool[]) {
    reorderUserTools(newOrder.map((t) => t.id));
  }

  return (
    <div className="pb-16 max-w-7xl mx-auto">
      {/* YouTube banner */}
      <a
        href="https://www.youtube.com/@paumartifelip"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white p-4 mb-8 shadow-md overflow-hidden relative cursor-pointer border border-red-500/20"
      >
        <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl shrink-0">▶️</div>
        <div className="flex-1 min-w-0">
          <div className="font-black text-base leading-tight">@paumartifelip</div>
          <div className="text-white/80 text-xs mt-0.5 truncate">YouTube · Productividad, IA y negocios online</div>
        </div>
        <span className="hidden sm:inline text-xs font-black uppercase tracking-widest bg-white/20 px-3 py-1.5 rounded-full">Suscríbete</span>
      </a>

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Stack de herramientas</h1>
          <p className="text-rumbo-muted text-sm mt-1">
            Click en una herramienta para abrirla. Arrástralas para reordenar. La X las elimina.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rumbo-ink text-white text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm self-start md:self-auto"
        >
          + Añadir herramienta
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
            placeholder="Buscar herramienta…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 mb-8">
        {(["Todas", ...CATEGORIES] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCat(cat as Category | "Todas")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
              activeCat === cat
                ? "bg-rumbo-ink text-white border-rumbo-ink"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="text-center py-20 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <div className="text-4xl mb-3">🔎</div>
          <p className="font-bold text-slate-700">Sin resultados</p>
          <p className="text-sm mt-1">Cambia los filtros o añade una herramienta.</p>
        </div>
      ) : canReorder ? (
        <Reorder.Group
          axis="y"
          values={visible}
          onReorder={handleReorder}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {visible.map((tool) => (
            <Reorder.Item
              key={tool.id}
              value={tool}
              className="cursor-grab active:cursor-grabbing"
              whileDrag={{ scale: 1.04, zIndex: 10, boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}
            >
              <ToolCard
                tool={tool}
                onEdit={() => setEditing(tool)}
                onRemove={() => removeUserTool(tool.id)}
              />
            </Reorder.Item>
          ))}
        </Reorder.Group>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              onEdit={() => setEditing(tool)}
              onRemove={() => removeUserTool(tool.id)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      <AnimatePresence>
        {(creating || editing) && (
          <ToolModal
            initial={editing}
            onClose={() => { setCreating(false); setEditing(null); }}
            onSave={(payload) => {
              if (editing) updateUserTool(editing.id, payload);
              else addUserTool({ ...payload, rating: 5 });
              setCreating(false);
              setEditing(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Tool Card ────────────────────────────────────────────────────────────────

function ToolCard({
  tool, onEdit, onRemove,
}: {
  tool: UserTool;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const accent = CAT_ACCENT[tool.category] || "text-slate-700 bg-slate-100";

  function open() {
    if (!tool.url) return;
    window.open(tool.url, "_blank", "noopener,noreferrer");
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    if (confirm(`¿Quitar "${tool.name}" de tu stack?`)) onRemove();
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation();
    onEdit();
  }

  return (
    <motion.div
      onClick={open}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className={cn(
        "relative group rounded-2xl bg-white border border-slate-200 p-5 select-none",
        "shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]",
        "transition-shadow",
        tool.url ? "cursor-pointer" : "cursor-default"
      )}
    >
      {/* Remove button (top-right) */}
      <button
        onClick={handleRemove}
        title="Quitar"
        className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm shadow-sm"
        aria-label="Quitar herramienta"
      >
        ✕
      </button>
      {/* Edit button (top-right, just left of remove) */}
      <button
        onClick={handleEdit}
        title="Editar"
        className="absolute -top-2 right-7 w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs shadow-sm"
        aria-label="Editar herramienta"
      >
        ✎
      </button>

      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl shrink-0">
          {tool.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900 text-base leading-tight truncate">
            {tool.name}
          </div>
          <span
            className={cn(
              "inline-block text-[10px] font-bold uppercase tracking-wider mt-1.5 px-2 py-0.5 rounded-full",
              accent
            )}
          >
            {tool.category}
          </span>
        </div>
      </div>

      {tool.description && (
        <p className="text-xs text-slate-500 leading-relaxed mt-3 line-clamp-2">
          {tool.description}
        </p>
      )}
    </motion.div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function ToolModal({
  initial,
  onClose,
  onSave,
}: {
  initial: UserTool | null;
  onClose: () => void;
  onSave: (data: {
    name: string;
    icon: string;
    category: string;
    description?: string;
    url?: string;
    free: boolean;
    cost?: number;
    billing_period?: "monthly" | "yearly";
    highlight?: boolean;
  }) => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [icon, setIcon] = useState(initial?.icon || "🔧");
  const [category, setCategory] = useState<string>(initial?.category || "IA");
  const [description, setDescription] = useState(initial?.description || "");
  const [url, setUrl] = useState(initial?.url || "");
  const [free, setFree] = useState(initial?.free ?? true);
  const [cost, setCost] = useState<number>(initial?.cost ?? 0);
  const [billing, setBilling] = useState<"monthly" | "yearly">(initial?.billing_period || "monthly");
  const [error, setError] = useState<string | null>(null);

  // Lock body scroll while modal open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Pon un nombre."); return; }
    onSave({
      name: name.trim(),
      icon,
      category,
      description: description.trim() || undefined,
      url: url.trim() || undefined,
      free,
      cost: free ? 0 : Number(cost) || 0,
      billing_period: free ? "monthly" : billing,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="relative bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto z-10"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="font-semibold text-slate-900">
            {initial ? "Editar herramienta" : "Nueva herramienta"}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-2xl shrink-0">
              {icon}
            </div>
            <input
              autoFocus
              className="input flex-1"
              placeholder="Nombre"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1.5">Icono</label>
            <div className="border border-slate-200 rounded-xl bg-slate-50/50 p-3 max-h-44 overflow-y-auto">
              {ICON_OPTIONS.map((g) => (
                <div key={g.group} className="mb-3 last:mb-0">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">{g.group}</div>
                  <div className="grid grid-cols-9 sm:grid-cols-12 gap-1">
                    {g.icons.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setIcon(ic)}
                        className={cn(
                          "aspect-square rounded-lg text-lg flex items-center justify-center transition-all",
                          icon === ic
                            ? "bg-rumbo-ink ring-2 ring-rumbo-ink scale-105"
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="Otras">Otras</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">Tipo</label>
              <select
                value={free ? "free" : "paid"}
                onChange={(e) => setFree(e.target.value === "free")}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="free">Gratis</option>
                <option value="paid">De pago</option>
              </select>
            </div>
          </div>

          {!free && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">Coste</label>
                <input
                  type="number" min="0" step="0.01"
                  value={cost}
                  onChange={(e) => setCost(Number(e.target.value) || 0)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">Frecuencia</label>
                <select
                  value={billing}
                  onChange={(e) => setBilling(e.target.value as "monthly" | "yearly")}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  <option value="monthly">Al mes</option>
                  <option value="yearly">Al año</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">URL</label>
            <input
              type="url" placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="input w-full"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">Descripción</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 resize-none"
              placeholder="Para qué sirve…"
            />
          </div>

          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
            <button type="submit" className="btn-primary flex-1">Guardar</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
