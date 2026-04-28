"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/Logo";
import { useRumbo } from "@/lib/store";
import { PROFILES } from "@/lib/profiles";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, profile } = useRumbo();

  useEffect(() => {
    if (profile) router.replace("/today");
  }, [profile, router]);

  function pick(id: string) {
    signIn(id);
    router.push("/today");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 md:px-10 py-6 flex items-center justify-between">
        <Logo size="md" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            ¿Quién eres?
          </h1>
          <p className="text-rumbo-muted mt-2">
            Elige tu sesión para continuar.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
          {PROFILES.map((p, i) => (
            <motion.button
              key={p.id}
              onClick={() => pick(p.id)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              className="card p-6 text-left hover:shadow-soft transition-shadow"
            >
              <div
                className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${p.color} flex items-center justify-center text-2xl font-semibold text-white shadow-soft`}
              >
                {p.initials}
              </div>
              <div className="mt-4 text-xl font-semibold">{p.name}</div>
              <div className="text-sm text-rumbo-muted">{p.email}</div>
              <div className="mt-4 text-sm text-rumbo-ink/70">
                Entrar como {p.name} →
              </div>
            </motion.button>
          ))}
        </div>

        <p className="text-xs text-rumbo-muted mt-10 max-w-md text-center">
          Cada sesión guarda sus propios objetivos, tareas e ingresos. Cambia de
          usuario cuando quieras desde la barra lateral.
        </p>
      </main>
    </div>
  );
}
