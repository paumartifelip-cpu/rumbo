"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";

const features = [
  {
    icon: "🤖",
    title: "Priorización inteligente",
    desc: "La IA ordena tu día según lo que más te acerca a tu meta — dinero, negocio o vida.",
  },
  {
    icon: "💸",
    title: "Dinero claro",
    desc: "Cuánto tienes, cuánto te falta, cuánto necesitas generar al día. Sin excusas.",
  },
  {
    icon: "🚩",
    title: "Objetivos reales",
    desc: "Conecta cada tarea a un objetivo. Ve el progreso real, no la ilusión de estar ocupado.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF8]">
      <header className="px-6 md:px-12 py-5 flex items-center justify-between">
        <Logo size="md" />
        <Link href="/login" className="btn-primary text-sm px-4 py-2">
          Entrar →
        </Link>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-10 pb-24">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="chip bg-rumbo-greenSoft text-emerald-700 mb-6"
        >
          🎯 Foco real, no sólo tareas
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.08] max-w-3xl"
        >
          Deja de estar ocupado.{" "}
          <span className="text-rumbo-green">Empieza a avanzar.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="text-lg md:text-xl text-rumbo-muted mt-5 max-w-xl"
        >
          Rumbo conecta tus tareas con tus metas y usa IA para decirte qué
          hacer primero, qué tiene más impacto y qué ignorar hoy.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mt-9 flex flex-wrap gap-3 justify-center"
        >
          <Link href="/login" className="btn-primary text-base px-6 py-3">
            Empezar ahora →
          </Link>
          <Link href="/login" className="btn-ghost text-base px-6 py-3">
            Ver perfiles
          </Link>
        </motion.div>

        <div className="mt-20 grid md:grid-cols-3 gap-4 w-full max-w-4xl">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 + i * 0.06 }}
              className="bg-white rounded-2xl border border-rumbo-line p-6 text-left shadow-sm"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <div className="font-semibold text-rumbo-ink">{f.title}</div>
              <p className="text-rumbo-muted mt-1.5 text-sm leading-relaxed">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="px-6 md:px-12 py-5 text-xs text-rumbo-muted border-t border-rumbo-line flex justify-between">
        <span>© Rumbo</span>
        <span>Hecho para gente con prisa por avanzar.</span>
      </footer>
    </div>
  );
}
