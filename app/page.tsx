"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";

// Floating feature icons. Each one represents something Rumbo lets you do.
// Positions are in % so they stay roughly anchored across viewport sizes.
type FloatItem = {
  emoji: string;
  label: string;
  bg: string;       // tailwind background
  ring?: string;    // tailwind ring color
  pos: { top: string; left: string };
  size?: "sm" | "md" | "lg";
  delay?: number;
  amp?: number;     // float amplitude px
  rotate?: number;  // base rotation deg
  hideOnMobile?: boolean;
};

const FLOATERS: FloatItem[] = [
  { emoji: "🎯", label: "Objetivos",       bg: "bg-amber-300",   pos: { top: "10%", left: "8%"  }, size: "lg", delay: 0.0, amp: 10, rotate: -6 },
  { emoji: "🤖", label: "IA priorizadora", bg: "bg-violet-300",  pos: { top: "6%",  left: "32%" }, size: "md", delay: 0.4, amp: 8,  rotate: 8, hideOnMobile: true },
  { emoji: "🏆", label: "Logros",          bg: "bg-rose-300",    pos: { top: "12%", left: "58%" }, size: "sm", delay: 0.8, amp: 7,  rotate: -10, hideOnMobile: true },
  { emoji: "✅", label: "Tareas",          bg: "bg-emerald-300", pos: { top: "8%",  left: "82%" }, size: "lg", delay: 0.2, amp: 9,  rotate: 6 },
  { emoji: "🛠️", label: "Stack",           bg: "bg-sky-300",     pos: { top: "30%", left: "3%"  }, size: "md", delay: 0.6, amp: 8,  rotate: 4, hideOnMobile: true },
  { emoji: "💡", label: "Ideas",           bg: "bg-pink-300",    pos: { top: "32%", left: "90%" }, size: "md", delay: 1.0, amp: 9,  rotate: -8, hideOnMobile: true },
  { emoji: "💰", label: "Dinero",          bg: "bg-lime-300",    pos: { top: "55%", left: "5%"  }, size: "lg", delay: 0.3, amp: 10, rotate: 5 },
  { emoji: "📊", label: "Gastos",          bg: "bg-cyan-300",    pos: { top: "58%", left: "88%" }, size: "lg", delay: 0.7, amp: 8,  rotate: -7 },
  { emoji: "🚀", label: "Progreso",        bg: "bg-orange-300",  pos: { top: "78%", left: "12%" }, size: "md", delay: 0.5, amp: 9,  rotate: -10 },
  { emoji: "🌱", label: "Crecimiento",     bg: "bg-green-300",   pos: { top: "82%", left: "38%" }, size: "sm", delay: 1.2, amp: 7,  rotate: 6, hideOnMobile: true },
  { emoji: "⚡", label: "Foco",            bg: "bg-yellow-300",  pos: { top: "82%", left: "62%" }, size: "md", delay: 0.9, amp: 8,  rotate: -4, hideOnMobile: true },
  { emoji: "📈", label: "Resultados",      bg: "bg-fuchsia-300", pos: { top: "80%", left: "84%" }, size: "lg", delay: 0.1, amp: 9,  rotate: 7 },
];

const SIZE_CLASS: Record<NonNullable<FloatItem["size"]>, string> = {
  sm: "w-14 h-14 text-2xl rounded-2xl",
  md: "w-16 h-16 text-3xl rounded-2xl",
  lg: "w-20 h-20 text-4xl rounded-3xl",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] overflow-hidden">
      <header className="px-6 md:px-12 py-5 flex items-center justify-between relative z-20">
        <Logo size="md" />
        <Link
          href="/login"
          className="px-4 py-2 rounded-full bg-rumbo-ink text-white text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Entrar →
        </Link>
      </header>

      <section className="relative flex-1 flex items-center justify-center px-6 pt-6 pb-20">
        {/* ── Floating icons ────────────────────────────────────────────── */}
        {FLOATERS.map((f) => (
          <Floater key={f.label} item={f} />
        ))}

        {/* ── Central content ───────────────────────────────────────────── */}
        <div className="relative z-10 text-center max-w-3xl">
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-[80px] sm:text-[120px] md:text-[160px] leading-[0.9] font-black tracking-tight text-rumbo-ink"
          >
            rumbo
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mt-3 text-base sm:text-lg md:text-xl font-bold tracking-[0.18em] uppercase text-rumbo-muted"
          >
            Menos ruido, <span className="text-emerald-600">más rumbo</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mt-8 flex flex-wrap gap-3 justify-center"
          >
            <Link
              href="/login"
              className="px-6 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm tracking-wide shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.03]"
            >
              Empezar gratis →
            </Link>
            <Link
              href="/login"
              className="px-6 py-3.5 rounded-full bg-white border border-slate-200 text-rumbo-ink font-bold text-sm hover:border-slate-400 transition-colors"
            >
              Ya tengo cuenta
            </Link>
          </motion.div>
        </div>
      </section>

      <footer className="px-6 md:px-12 py-5 text-xs text-rumbo-muted border-t border-rumbo-line/60 flex justify-between relative z-20">
        <span>© Rumbo</span>
        <span>Hecho para gente con prisa por avanzar.</span>
      </footer>
    </div>
  );
}

// ─── Floater ──────────────────────────────────────────────────────────────────

function Floater({ item }: { item: FloatItem }) {
  const size = item.size ?? "md";
  const amp = item.amp ?? 8;
  const delay = item.delay ?? 0;
  const rotate = item.rotate ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 + delay * 0.1, duration: 0.5, type: "spring", stiffness: 180, damping: 16 }}
      style={{ top: item.pos.top, left: item.pos.left, position: "absolute" }}
      className={item.hideOnMobile ? "hidden sm:block" : ""}
    >
      <motion.div
        animate={{ y: [0, -amp, 0, amp * 0.6, 0], rotate: [rotate, rotate + 4, rotate, rotate - 3, rotate] }}
        transition={{ duration: 5 + (delay % 2), repeat: Infinity, ease: "easeInOut", delay }}
        className="group relative"
      >
        <motion.div
          whileHover={{ scale: 1.18, rotate: rotate + 12, y: -6 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 14 }}
          className={`${SIZE_CLASS[size]} ${item.bg} flex items-center justify-center shadow-[0_8px_20px_rgba(0,0,0,0.10)] cursor-pointer select-none ring-4 ring-white`}
        >
          <span className="drop-shadow-sm">{item.emoji}</span>
        </motion.div>

        {/* Hover label */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          whileHover={{ opacity: 1, y: 0 }}
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-1 bg-rumbo-ink text-white text-[10px] font-bold uppercase tracking-wider rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md"
        >
          {item.label}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
