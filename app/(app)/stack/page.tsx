"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/Card";
import { useRumbo } from "@/lib/store";
import { UserTool } from "@/lib/types";

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES = ["IA", "Imagen", "Vídeo", "Audio", "No-code", "Google"] as const;
type Category = (typeof CATEGORIES)[number];

// Soft, distinct color theme per section. Used for the section header AND the
// card background tint so each category feels visually distinct.
const SECTION_THEME: Record<string, { bg: string; border: string; chip: string; chipText: string; text: string }> = {
  IA:        { bg: "bg-violet-50/70",  border: "border-violet-100",  chip: "bg-violet-100",  chipText: "text-violet-700",  text: "text-violet-700"  },
  Imagen:    { bg: "bg-pink-50/70",    border: "border-pink-100",    chip: "bg-pink-100",    chipText: "text-pink-700",    text: "text-pink-700"    },
  "Vídeo":   { bg: "bg-orange-50/70",  border: "border-orange-100",  chip: "bg-orange-100",  chipText: "text-orange-700",  text: "text-orange-700"  },
  Audio:     { bg: "bg-amber-50/70",   border: "border-amber-100",   chip: "bg-amber-100",   chipText: "text-amber-700",   text: "text-amber-700"   },
  "No-code": { bg: "bg-emerald-50/70", border: "border-emerald-100", chip: "bg-emerald-100", chipText: "text-emerald-700", text: "text-emerald-700" },
  Google:    { bg: "bg-sky-50/70",     border: "border-sky-100",     chip: "bg-sky-100",     chipText: "text-sky-700",     text: "text-sky-700"     },
  Otras:     { bg: "bg-slate-50",      border: "border-slate-100",   chip: "bg-slate-100",   chipText: "text-slate-700",   text: "text-slate-700"   },
};

const ICON_OPTIONS: { group: string; icons: string[] }[] = [
  { group: "Trabajo",      icons: ["🔧", "🛠️", "⚙️", "📊", "📈", "📋", "📌", "📁"] },
  { group: "Tech / IA",    icons: ["🤖", "🧠", "✨", "🚀", "⚡", "💡", "🔮", "🛸"] },
  { group: "Comunicación", icons: ["💬", "📞", "📱", "📨", "📧", "📡"] },
  { group: "Diseño",       icons: ["🎨", "🖌️", "🎬", "📹", "📷", "🎙️", "🎧", "🎵", "🖼️"] },
  { group: "Otros",        icons: ["⭐", "🌟", "🌈", "🔥", "🎯", "🏆", "🌱", "🍌", "🦊"] },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "Todas" | "Favoritos" | Category;
const TABS: Tab[] = ["Todas", "Favoritos", ...CATEGORIES];

export default function StackPage() {
  const { userTools, addUserTool, removeUserTool, updateUserTool, toggleToolFavorite } = useRumbo();

  const [activeTab, setActiveTab] = useState<Tab>("Todas");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<UserTool | null>(null);
  const [creating, setCreating] = useState(false);

  // Apply search filter across the full list.
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return userTools || [];
    return (userTools || []).filter((t) => t.name.toLowerCase().includes(q));
  }, [userTools, search]);

  const favCount = (userTools || []).filter((t) => t.is_favorite).length;

  return (
    <div className="pb-16 max-w-6xl mx-auto">
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

      {/* Título unificado con el resto de páginas (PageHeader) */}
      <PageHeader
        title="Stack de herramientas"
        subtitle="Click en una tarjeta para abrirla. El corazón la marca como favorita."
        action={
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rumbo-ink text-white text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm self-start md:self-auto"
          >
            + Añadir herramienta
          </button>
        }
      />

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

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {TABS.map((tab) => {
          const active = activeTab === tab;
          const isFav = tab === "Favoritos";
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border inline-flex items-center gap-1.5",
                active
                  ? "bg-rumbo-ink text-white border-rumbo-ink"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              )}
            >
              {isFav && <span className={active ? "text-rose-300" : "text-rose-500"}>♥</span>}
              {tab}
              {isFav && favCount > 0 && (
                <span className={cn("text-[10px] px-1.5 py-px rounded-full", active ? "bg-white/20" : "bg-rose-100 text-rose-700")}>{favCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Body */}
      {activeTab === "Todas" ? (
        <SectionedView
          tools={searched}
          onEdit={setEditing}
          onRemove={removeUserTool}
          onToggleFav={toggleToolFavorite}
        />
      ) : activeTab === "Favoritos" ? (
        <FavoritesView
          tools={searched.filter((t) => t.is_favorite)}
          onEdit={setEditing}
          onRemove={removeUserTool}
          onToggleFav={toggleToolFavorite}
        />
      ) : (
        <CategoryView
          category={activeTab}
          tools={searched.filter((t) => t.category === activeTab)}
          onEdit={setEditing}
          onRemove={removeUserTool}
          onToggleFav={toggleToolFavorite}
        />
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

// ─── Views ────────────────────────────────────────────────────────────────────

function SectionedView({
  tools, onEdit, onRemove, onToggleFav,
}: {
  tools: UserTool[];
  onEdit: (t: UserTool) => void;
  onRemove: (id: string) => void;
  onToggleFav: (id: string) => void;
}) {
  // Group by category, preserving CATEGORIES order. Other categories (e.g.
  // user-added "Otras") appear at the end.
  const groups: { name: string; tools: UserTool[] }[] = [];
  for (const cat of CATEGORIES) {
    const list = tools.filter((t) => t.category === cat);
    if (list.length) groups.push({ name: cat, tools: list });
  }
  const knownCats = new Set<string>(CATEGORIES);
  const extras = tools.filter((t) => !knownCats.has(t.category));
  if (extras.length) {
    const extraCats = Array.from(new Set(extras.map((t) => t.category)));
    for (const cat of extraCats) {
      groups.push({ name: cat, tools: extras.filter((t) => t.category === cat) });
    }
  }

  if (groups.length === 0) {
    return <Empty />;
  }

  return (
    <div className="space-y-10">
      {groups.map((g) => (
        <SectionBlock
          key={g.name}
          title={g.name}
          tools={g.tools}
          onEdit={onEdit}
          onRemove={onRemove}
          onToggleFav={onToggleFav}
        />
      ))}
    </div>
  );
}

function CategoryView({
  category, tools, onEdit, onRemove, onToggleFav,
}: {
  category: string;
  tools: UserTool[];
  onEdit: (t: UserTool) => void;
  onRemove: (id: string) => void;
  onToggleFav: (id: string) => void;
}) {
  if (tools.length === 0) return <Empty />;
  return (
    <SectionBlock
      title={category}
      tools={tools}
      onEdit={onEdit}
      onRemove={onRemove}
      onToggleFav={onToggleFav}
    />
  );
}

function FavoritesView({
  tools, onEdit, onRemove, onToggleFav,
}: {
  tools: UserTool[];
  onEdit: (t: UserTool) => void;
  onRemove: (id: string) => void;
  onToggleFav: (id: string) => void;
}) {
  if (tools.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400 bg-rose-50/40 rounded-2xl border border-dashed border-rose-200">
        <div className="text-4xl mb-3">♥</div>
        <p className="font-semibold text-rose-700">Aún no tienes favoritas</p>
        <p className="text-sm mt-1 text-rose-700/70">Pulsa el corazón en cualquier herramienta para añadirla aquí.</p>
      </div>
    );
  }
  return (
    <CardGrid tools={tools} onEdit={onEdit} onRemove={onRemove} onToggleFav={onToggleFav} />
  );
}

function SectionBlock({
  title, tools, onEdit, onRemove, onToggleFav,
}: {
  title: string;
  tools: UserTool[];
  onEdit: (t: UserTool) => void;
  onRemove: (id: string) => void;
  onToggleFav: (id: string) => void;
}) {
  const theme = SECTION_THEME[title] || SECTION_THEME.Otras;
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className={cn("text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full", theme.chip, theme.chipText)}>
          {title}
        </span>
        <div className="flex-1 h-px bg-slate-100" />
        <span className="text-xs text-slate-400">{tools.length}</span>
      </div>
      <CardGrid tools={tools} onEdit={onEdit} onRemove={onRemove} onToggleFav={onToggleFav} />
    </div>
  );
}

function CardGrid({
  tools, onEdit, onRemove, onToggleFav,
}: {
  tools: UserTool[];
  onEdit: (t: UserTool) => void;
  onRemove: (id: string) => void;
  onToggleFav: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {tools.map((t) => (
        <ToolCard
          key={t.id}
          tool={t}
          onEdit={() => onEdit(t)}
          onRemove={() => {
            if (confirm(`¿Quitar "${t.name}"?`)) onRemove(t.id);
          }}
          onToggleFav={() => onToggleFav(t.id)}
        />
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="text-center py-20 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
      <div className="text-4xl mb-3">🔎</div>
      <p className="font-bold text-slate-700">Sin resultados</p>
      <p className="text-sm mt-1">Prueba con otra búsqueda o categoría.</p>
    </div>
  );
}

// ─── Tool Card (compact tile) ─────────────────────────────────────────────────

function ToolCard({
  tool, onEdit, onRemove, onToggleFav,
}: {
  tool: UserTool;
  onEdit: () => void;
  onRemove: () => void;
  onToggleFav: () => void;
}) {
  const theme = SECTION_THEME[tool.category] || SECTION_THEME.Otras;
  const fav = !!tool.is_favorite;

  function open(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    if (!tool.url) return;
    window.open(tool.url, "_blank", "noopener,noreferrer");
  }

  return (
    <motion.div
      onClick={open}
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={cn(
        "group relative rounded-2xl border p-3.5 cursor-pointer select-none",
        theme.bg, theme.border,
        "hover:border-slate-300 hover:shadow-[0_8px_22px_rgba(0,0,0,0.08)] transition-all"
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-xl shrink-0">
          {tool.icon}
        </div>
        <h3 className="font-semibold text-slate-900 text-sm leading-tight truncate flex-1 min-w-0">
          {tool.name}
        </h3>
      </div>

      {/* Heart — always visible. Filled red when favorited; outlined and
          slightly faded when not. Click anywhere on the button toggles. */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
        title={fav ? "Quitar de favoritos" : "Marcar como favorita"}
        aria-pressed={fav}
        className={cn(
          "absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all",
          fav
            ? "text-rose-500"
            : "text-slate-400 hover:text-rose-500 opacity-70 group-hover:opacity-100"
        )}
      >
        <motion.span
          key={String(fav)}
          initial={{ scale: 1 }}
          animate={{ scale: fav ? [1, 1.4, 1] : [1, 0.85, 1] }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="text-lg leading-none"
        >
          {fav ? "♥" : "♡"}
        </motion.span>
      </button>

      {/* Edit + Remove (hidden until hover, bottom-right) */}
      <div className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          title="Editar"
          className="w-6 h-6 rounded-full bg-white/90 backdrop-blur border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center text-[10px]"
        >✎</button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Quitar"
          className="w-6 h-6 rounded-full bg-white/90 backdrop-blur border border-slate-200 text-slate-400 hover:text-rose-600 flex items-center justify-center text-[11px]"
        >✕</button>
      </div>
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
  const [url, setUrl] = useState(initial?.url || "");
  const [error, setError] = useState<string | null>(null);

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
      url: url.trim() || undefined,
      free: true,
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
          >✕</button>
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
            <label className="text-xs font-semibold uppercase tracking-wider text-rumbo-muted block mb-1">URL</label>
            <input
              type="url" placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="input w-full"
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
