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
  { emoji: "🏆", label: "Logros",          bg: "bg-rose-300",    pos: { top: "12%", left: "58%" }, size: "sm", delay: 0.8, amp: 7,  rotate: -10, hideOnMobile: true },
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

// What you can do in Rumbo.
const FEATURES = [
  { emoji: "💰", bg: "bg-lime-200",    title: "Cuánto tienes",        desc: "Mira de un vistazo todo el dinero que tienes y cuánto te falta para lo que quieres." },
  { emoji: "📥", bg: "bg-emerald-200", title: "El dinero que entra",  desc: "Apunta lo que cobras y lo verás sumado al momento. Sin cuentas raras." },
  { emoji: "📊", bg: "bg-cyan-200",    title: "El dinero que sale",   desc: "Apunta lo que gastas y mira en qué se te va: comida, casa, transporte…" },
  { emoji: "🔁", bg: "bg-fuchsia-200", title: "Lo que pagas siempre", desc: "El móvil, el gimnasio, las apps… mira todo lo que pagas cada mes y cuánto suma." },
  { emoji: "🎯", bg: "bg-amber-200",   title: "Tu meta",              desc: "Di cuánto quieres juntar y para cuándo. Te decimos si vas bien o te falta empujar." },
  { emoji: "✨", bg: "bg-violet-200",  title: "Tu resumen",           desc: "Mira en bonito cuánto ganaste, gastaste y ahorraste. Un repaso fácil de tu dinero." },
];

const STEPS = [
  { n: "1", emoji: "✍️", title: "Apunta", desc: "Escribe cuánto tienes, lo que ganas y lo que gastas." },
  { n: "2", emoji: "👀", title: "Mira",   desc: "Lo verás todo en dibujos fáciles, de un solo vistazo." },
  { n: "3", emoji: "🌱", title: "Mejora", desc: "Quita lo que sobra y guarda un poco más cada mes." },
];

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

      {/* ── HERO (estilo original intacto) ───────────────────────────────── */}
      <section className="relative min-h-[88vh] flex items-center justify-center px-6 pt-6 pb-20">
        {FLOATERS.map((f) => (
          <Floater key={f.label} item={f} />
        ))}

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

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.5 }}
            className="mt-5 text-base md:text-lg text-rumbo-muted max-w-xl mx-auto leading-relaxed"
          >
            Apunta lo que ganas y lo que gastas, y ve cuánto dinero tienes de verdad.
            Fácil, claro y solo para ti.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="mt-8 flex flex-wrap gap-3 justify-center"
          >
            <Link
              href="/login"
              className="px-6 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm tracking-wide shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.03]"
            >
              Empezar →
            </Link>
            <Link
              href="/login"
              className="px-6 py-3.5 rounded-full bg-white border border-slate-200 text-rumbo-ink font-bold text-sm hover:border-slate-400 transition-colors"
            >
              Ya tengo cuenta
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="mt-4 text-xs text-rumbo-muted"
          >
            Fácil · Rápido · Solo lo ves tú
          </motion.p>
        </div>
      </section>

      {/* ── QUÉ PUEDES HACER ─────────────────────────────────────────────── */}
      <Section>
        <SectionHeading
          kicker="Para qué sirve"
          title="Tu dinero, fácil de entender"
          subtitle="Tú lo apuntas y Rumbo te lo ordena. Sin líos ni números complicados."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
              whileHover={{ y: -4 }}
              className="rounded-3xl bg-white border border-rumbo-line/70 p-6 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.18)]"
            >
              <div className={`w-14 h-14 ${f.bg} rounded-2xl ring-4 ring-white shadow-[0_6px_16px_rgba(0,0,0,0.08)] flex items-center justify-center text-3xl mb-4`}>
                {f.emoji}
              </div>
              <h3 className="text-lg font-bold tracking-tight text-rumbo-ink">{f.title}</h3>
              <p className="text-sm text-rumbo-muted mt-2 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ── CÓMO FUNCIONA ────────────────────────────────────────────────── */}
      <Section className="bg-white border-y border-rumbo-line/60">
        <SectionHeading
          kicker="Cómo se usa"
          title="Así de fácil"
          subtitle="Empiezas en menos de un minuto."
        />
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="relative rounded-3xl bg-[#FAF7F2] border border-rumbo-line/70 p-7 text-center"
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-rumbo-ink text-white font-black text-sm flex items-center justify-center shadow-md">
                {s.n}
              </div>
              <div className="text-4xl mt-3 mb-3">{s.emoji}</div>
              <h3 className="text-lg font-bold tracking-tight text-rumbo-ink">{s.title}</h3>
              <p className="text-sm text-rumbo-muted mt-2 leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ── PRIVACIDAD / CONFIANZA ───────────────────────────────────────── */}
      <Section>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="rounded-[2rem] bg-gradient-to-br from-emerald-50 via-white to-amber-50 border border-emerald-100 p-8 md:p-12 text-center relative overflow-hidden"
        >
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-rumbo-ink">
            Solo lo ves tú
          </h2>
          <p className="text-rumbo-muted mt-3 max-w-xl mx-auto leading-relaxed">
            Lo que apuntas es privado. Entras con tu correo y tu contraseña, y nadie
            más puede ver tu dinero. Lo tienes guardado para mirarlo desde el móvil o
            el ordenador, cuando quieras.
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-6">
            {["🔒 Privado", "💶 En tu moneda", "📱 En tu móvil", "✅ Muy fácil"].map((chip) => (
              <span key={chip} className="px-3 py-1.5 rounded-full bg-white/70 border border-rumbo-line text-xs font-semibold text-rumbo-ink">
                {chip}
              </span>
            ))}
          </div>
        </motion.div>
      </Section>

      {/* ── CTA FINAL ────────────────────────────────────────────────────── */}
      <Section className="pb-24">
        <div className="text-center">
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-4xl md:text-6xl font-black tracking-tight text-rumbo-ink"
          >
            Pon tu dinero <span className="text-emerald-600">en orden</span>
          </motion.h2>
          <p className="text-rumbo-muted mt-4 text-lg">Se hace en un minuto.</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 mt-8 px-8 py-4 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base shadow-[0_12px_28px_-6px_rgba(16,185,129,0.6)] hover:scale-[1.03] active:scale-[0.97] transition-all"
          >
            Crear mi cuenta →
          </Link>
        </div>
      </Section>

      <footer className="px-6 md:px-12 py-6 text-xs text-rumbo-muted border-t border-rumbo-line/60 flex justify-between relative z-20">
        <span>© Rumbo</span>
        <span>Hecho para gente con prisa por avanzar.</span>
      </footer>
    </div>
  );
}

// ─── Section helpers ────────────────────────────────────────────────────────

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`relative z-10 px-6 md:px-12 py-16 md:py-24 ${className}`}>
      <div className="max-w-5xl mx-auto w-full">{children}</div>
    </section>
  );
}

function SectionHeading({ kicker, title, subtitle }: { kicker: string; title: string; subtitle?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45 }}
      className="text-center max-w-2xl mx-auto"
    >
      <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">{kicker}</div>
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-rumbo-ink mt-3">{title}</h2>
      {subtitle && <p className="text-rumbo-muted mt-3 leading-relaxed">{subtitle}</p>}
    </motion.div>
  );
}

// ─── Floater (idéntico al original) ───────────────────────────────────────────

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
