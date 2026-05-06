"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── Data ─────────────────────────────────────────────────────────────────────

type ToolCategory =
  | "Productividad"
  | "Finanzas"
  | "IA"
  | "Contenido"
  | "Código"
  | "Marketing"
  | "Comunicación";

interface Tool {
  name: string;
  description: string;
  url: string;
  category: ToolCategory;
  tags: string[];
  free: boolean;
  rating: number; // 1-5
  icon: string;
  highlight?: boolean;
}

const TOOLS: Tool[] = [
  // Productividad
  {
    name: "Notion",
    icon: "📓",
    category: "Productividad",
    description: "Tu segundo cerebro. Notas, wikis, bases de datos y proyectos en un solo lugar.",
    url: "https://notion.so",
    tags: ["notas", "wikis", "proyectos"],
    free: true,
    rating: 5,
    highlight: true,
  },
  {
    name: "Obsidian",
    icon: "🪨",
    category: "Productividad",
    description: "Notas en Markdown con grafos de conexión. Perfecto para pensar en red.",
    url: "https://obsidian.md",
    tags: ["notas", "PKM", "offline"],
    free: true,
    rating: 5,
  },
  {
    name: "Todoist",
    icon: "☑️",
    category: "Productividad",
    description: "Gestor de tareas minimalista con prioridades y vistas de proyecto.",
    url: "https://todoist.com",
    tags: ["tareas", "GTD"],
    free: true,
    rating: 4,
  },
  {
    name: "Calendly",
    icon: "📅",
    category: "Productividad",
    description: "Elimina el ping-pong de emails para quedar. Tu cliente elige el hueco directamente.",
    url: "https://calendly.com",
    tags: ["agenda", "reuniones"],
    free: true,
    rating: 4,
  },
  // Finanzas
  {
    name: "Revolut",
    icon: "💳",
    category: "Finanzas",
    description: "Banco digital con cambio de divisas sin comisiones y análisis de gastos automático.",
    url: "https://revolut.com",
    tags: ["banco", "divisas", "crypto"],
    free: true,
    rating: 5,
    highlight: true,
  },
  {
    name: "YNAB",
    icon: "💰",
    category: "Finanzas",
    description: "You Need A Budget. El método de presupuesto por sobres que más resultados da.",
    url: "https://youneedabudget.com",
    tags: ["presupuesto", "ahorro"],
    free: false,
    rating: 5,
  },
  {
    name: "Wise",
    icon: "🌍",
    category: "Finanzas",
    description: "Transferencias internacionales con el tipo de cambio real. Sin comisiones ocultas.",
    url: "https://wise.com",
    tags: ["transferencias", "divisas"],
    free: true,
    rating: 5,
  },
  {
    name: "Stripe",
    icon: "⚡",
    category: "Finanzas",
    description: "Cobrar online de forma profesional. Acepta tarjetas, SEPA y más en minutos.",
    url: "https://stripe.com",
    tags: ["pagos", "facturación"],
    free: true,
    rating: 5,
  },
  // IA
  {
    name: "ChatGPT",
    icon: "🤖",
    category: "IA",
    description: "El asistente más conocido. Ideal para redactar, resumir, generar ideas y código.",
    url: "https://chat.openai.com",
    tags: ["chat", "texto", "código"],
    free: true,
    rating: 5,
    highlight: true,
  },
  {
    name: "Claude",
    icon: "🧠",
    category: "IA",
    description: "El rival de ChatGPT con ventana de contexto enorme. Mejor para documentos largos.",
    url: "https://claude.ai",
    tags: ["chat", "análisis", "documentos"],
    free: true,
    rating: 5,
  },
  {
    name: "Perplexity",
    icon: "🔍",
    category: "IA",
    description: "Buscador con IA que cita fuentes. Sustituye a Google para investigación rápida.",
    url: "https://perplexity.ai",
    tags: ["búsqueda", "investigación"],
    free: true,
    rating: 4,
  },
  {
    name: "Midjourney",
    icon: "🎨",
    category: "IA",
    description: "El mejor generador de imágenes IA para crear contenido visual de alta calidad.",
    url: "https://midjourney.com",
    tags: ["imágenes", "diseño", "arte"],
    free: false,
    rating: 5,
  },
  {
    name: "ElevenLabs",
    icon: "🎙️",
    category: "IA",
    description: "Texto a voz ultra-realista. Clona tu voz o elige entre cientos de voces.",
    url: "https://elevenlabs.io",
    tags: ["voz", "audio", "podcast"],
    free: true,
    rating: 5,
  },
  // Contenido
  {
    name: "Canva",
    icon: "✏️",
    category: "Contenido",
    description: "Diseño gráfico para no diseñadores. Plantillas profesionales para redes, vídeos y más.",
    url: "https://canva.com",
    tags: ["diseño", "redes sociales", "plantillas"],
    free: true,
    rating: 5,
    highlight: true,
  },
  {
    name: "CapCut",
    icon: "🎬",
    category: "Contenido",
    description: "Editor de vídeo para móvil y web optimizado para formato vertical. Imprescindible para Reels y TikTok.",
    url: "https://capcut.com",
    tags: ["vídeo", "reels", "tiktok"],
    free: true,
    rating: 5,
  },
  {
    name: "Descript",
    icon: "🎞️",
    category: "Contenido",
    description: "Edita vídeo editando el texto de la transcripción. Perfecto para podcasters y YouTubers.",
    url: "https://descript.com",
    tags: ["podcast", "vídeo", "transcripción"],
    free: true,
    rating: 4,
  },
  {
    name: "Figma",
    icon: "🖌️",
    category: "Contenido",
    description: "Diseño de interfaces colaborativo en tiempo real. El estándar de la industria.",
    url: "https://figma.com",
    tags: ["UI/UX", "diseño", "colaborativo"],
    free: true,
    rating: 5,
  },
  // Código
  {
    name: "Cursor",
    icon: "⌨️",
    category: "Código",
    description: "El editor de código con IA más potente. Basado en VS Code con autocompletado inteligente.",
    url: "https://cursor.sh",
    tags: ["IDE", "IA", "programación"],
    free: true,
    rating: 5,
    highlight: true,
  },
  {
    name: "Vercel",
    icon: "▲",
    category: "Código",
    description: "Deploy de apps Next.js en segundos. La infraestructura preferida de startups.",
    url: "https://vercel.com",
    tags: ["deploy", "hosting", "Next.js"],
    free: true,
    rating: 5,
  },
  {
    name: "Supabase",
    icon: "🟢",
    category: "Código",
    description: "Firebase open-source. Base de datos PostgreSQL + Auth + Storage sin backend propio.",
    url: "https://supabase.com",
    tags: ["base de datos", "auth", "backend"],
    free: true,
    rating: 5,
  },
  // Marketing
  {
    name: "Kit (ConvertKit)",
    icon: "📧",
    category: "Marketing",
    description: "Email marketing para creadores. Automatizaciones sencillas y páginas de suscripción.",
    url: "https://kit.com",
    tags: ["email", "newsletter", "automatización"],
    free: true,
    rating: 4,
  },
  {
    name: "Beehiiv",
    icon: "🐝",
    category: "Marketing",
    description: "La plataforma de newsletters que usan los mejores creadores. Crece y monetiza.",
    url: "https://beehiiv.com",
    tags: ["newsletter", "monetización"],
    free: true,
    rating: 5,
    highlight: true,
  },
  {
    name: "Buffer",
    icon: "📲",
    category: "Marketing",
    description: "Programa publicaciones en todas tus redes sociales desde un solo lugar.",
    url: "https://buffer.com",
    tags: ["redes sociales", "programación"],
    free: true,
    rating: 4,
  },
  // Comunicación
  {
    name: "Loom",
    icon: "🎥",
    category: "Comunicación",
    description: "Graba tu pantalla + cámara y comparte en segundos. Sustituye miles de reuniones.",
    url: "https://loom.com",
    tags: ["vídeo", "asincrónico", "reuniones"],
    free: true,
    rating: 5,
    highlight: true,
  },
  {
    name: "Slack",
    icon: "💬",
    category: "Comunicación",
    description: "Chat de equipos con canales temáticos e integraciones con todo tu stack.",
    url: "https://slack.com",
    tags: ["chat", "equipos", "integraciones"],
    free: true,
    rating: 4,
  },
];

const CATEGORIES: ToolCategory[] = [
  "Productividad",
  "Finanzas",
  "IA",
  "Contenido",
  "Código",
  "Marketing",
  "Comunicación",
];

const CAT_COLORS: Record<ToolCategory, { bg: string; text: string; dot: string }> = {
  Productividad: { bg: "bg-violet-50",  text: "text-violet-700",  dot: "bg-violet-400" },
  Finanzas:      { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400" },
  IA:            { bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-400" },
  Contenido:     { bg: "bg-orange-50",  text: "text-orange-700",  dot: "bg-orange-400" },
  Código:        { bg: "bg-slate-50",   text: "text-slate-700",   dot: "bg-slate-400" },
  Marketing:     { bg: "bg-pink-50",    text: "text-pink-700",    dot: "bg-pink-400" },
  Comunicación:  { bg: "bg-cyan-50",    text: "text-cyan-700",    dot: "bg-cyan-400" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StackPage() {
  const [activeCategory, setActiveCategory] = useState<ToolCategory | "Todas">("Todas");
  const [onlyFree, setOnlyFree] = useState(false);
  const [search, setSearch] = useState("");

  const displayed = useMemo(() => {
    return TOOLS.filter((t) => {
      if (activeCategory !== "Todas" && t.category !== activeCategory) return false;
      if (onlyFree && !t.free) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase()) &&
          !t.description.toLowerCase().includes(search.toLowerCase()) &&
          !t.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    });
  }, [activeCategory, onlyFree, search]);

  const highlights = displayed.filter((t) => t.highlight);
  const rest       = displayed.filter((t) => !t.highlight);

  return (
    <div className="pb-16">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Stack de Herramientas</h1>
        <p className="text-slate-500 text-sm mt-1">
          Las mejores apps y servicios para productividad, finanzas y contenido. Curadas para que pierdas menos tiempo buscando.
        </p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
            placeholder="Buscar herramienta o tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setOnlyFree((v) => !v)}
          className={cn(
            "px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors",
            onlyFree
              ? "bg-emerald-500 text-white border-emerald-500"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
          )}
        >
          {onlyFree ? "✓ Solo gratuitas" : "Solo gratuitas"}
        </button>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 mb-8">
        {(["Todas", ...CATEGORIES] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat as any)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border transition-all",
              activeCategory === cat
                ? "bg-slate-900 text-white border-slate-900 shadow-md"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Highlights row */}
      {highlights.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-black uppercase tracking-widest text-amber-600">⭐ Destacadas</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.map((tool, i) => (
              <ToolCard key={tool.name} tool={tool} index={i} featured />
            ))}
          </div>
        </div>
      )}

      {/* Rest */}
      {rest.length > 0 && (
        <div>
          {highlights.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Todas</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((tool, i) => (
              <ToolCard key={tool.name} tool={tool} index={i} />
            ))}
          </div>
        </div>
      )}

      {displayed.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          <div className="text-4xl mb-3">🔎</div>
          <p className="font-bold">Sin resultados para &ldquo;{search}&rdquo;</p>
          <p className="text-sm mt-1">Prueba con otro término o categoría.</p>
        </div>
      )}
    </div>
  );
}

// ─── ToolCard ─────────────────────────────────────────────────────────────────

function ToolCard({ tool, index, featured }: { tool: Tool; index: number; featured?: boolean }) {
  const colors = CAT_COLORS[tool.category];

  return (
    <motion.a
      href={tool.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 300, damping: 25 }}
      whileHover={{ y: -4, boxShadow: "0 12px 30px rgba(0,0,0,0.10)" }}
      className={cn(
        "group relative flex flex-col rounded-2xl border p-5 bg-white transition-colors cursor-pointer overflow-hidden",
        featured ? "border-amber-200 ring-1 ring-amber-100" : "border-slate-200 hover:border-slate-300"
      )}
    >
      {/* Featured badge */}
      {featured && (
        <span className="absolute top-3 right-3 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
          ⭐ Top pick
        </span>
      )}

      {/* Icon + name */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl shrink-0">
          {tool.icon}
        </div>
        <div>
          <div className="font-black text-slate-900 text-sm leading-tight">{tool.name}</div>
          <div className={cn("text-[10px] font-bold uppercase tracking-widest mt-0.5", colors.text)}>
            {tool.category}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-500 leading-relaxed mb-4 flex-1">{tool.description}</p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {tool.tags.map((tag) => (
          <span key={tag} className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", colors.bg, colors.text)}>
            {tag}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={cn("text-xs", i < tool.rating ? "text-amber-400" : "text-slate-200")}>
              ★
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
            tool.free ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
          )}>
            {tool.free ? "Gratis" : "Pago"}
          </span>
          <span className="text-slate-400 text-xs group-hover:text-slate-700 transition-colors font-bold">
            Visitar →
          </span>
        </div>
      </div>
    </motion.a>
  );
}
