"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 md:px-10 py-5 flex items-center justify-between">
        <Logo size="md" />
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost">
            Entrar
          </Link>
          <Link href="/login" className="btn-primary">
            Empezar
          </Link>
        </nav>
      </header>

      <section className="flex-1 px-6 md:px-10 pt-10 md:pt-20 pb-20 max-w-6xl w-full mx-auto">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="chip bg-rumbo-greenSoft text-emerald-700"
        >
          🎯 Foco real, no sólo tareas
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="text-4xl md:text-6xl font-semibold tracking-tight mt-5 leading-[1.05]"
        >
          Deja de perder el tiempo.{" "}
          <span className="text-rumbo-green">Avanza hacia tus objetivos.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-lg md:text-xl text-rumbo-muted mt-5 max-w-2xl"
        >
          Rumbo conecta tus tareas con tus metas reales y usa IA para decirte qué
          hacer primero, qué tiene más impacto y qué deberías ignorar hoy.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-8 flex flex-wrap gap-3"
        >
          <Link href="/login" className="btn-primary text-base px-5 py-3">
            Iniciar sesión →
          </Link>
          <Link href="/login" className="btn-ghost text-base px-5 py-3">
            Ver perfiles
          </Link>
        </motion.div>

        <div className="mt-16 grid md:grid-cols-3 gap-4">
          {[
            {
              t: "🌱 Árbol de objetivos",
              d: "Cada tarea importante hace crecer tu árbol. Ves el avance real, no la ilusión.",
            },
            {
              t: "🤖 Priorización con Gemini",
              d: "La IA ordena tu día según lo que más te acerca a tu meta de dinero, negocio o vida.",
            },
            {
              t: "💸 Dinero claro",
              d: "Cuánto tienes, cuánto te falta, cuánto necesitas generar al día. Sin excusas.",
            },
          ].map((b, i) => (
            <motion.div
              key={b.t}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              className="card p-5"
            >
              <div className="text-lg font-semibold">{b.t}</div>
              <p className="text-rumbo-muted mt-1 text-sm">{b.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="px-6 md:px-10 py-6 text-sm text-rumbo-muted border-t border-rumbo-line flex justify-between">
        <span>© Rumbo</span>
        <span>Hecho para gente con prisa por avanzar.</span>
      </footer>
    </div>
  );
}
