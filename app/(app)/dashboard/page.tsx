"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, SectionTitle } from "@/components/Card";
import { DashboardHero } from "@/components/DashboardHero";
import { Reveal } from "@/components/Reveal";
import { SavingsChart } from "@/components/SavingsChart";
import { useRumbo } from "@/lib/store";

function useGreeting() {
  return useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 20) return "Buenas tardes";
    return "Buenas noches";
  }, []);
}

export default function DashboardPage() {
  const { user, onboarding } = useRumbo();
  const greeting = useGreeting();

  // Show the big welcome CTA when there's no onboarding data — this happens on
  // a brand-new profile OR right after "Borrar todos mis datos".
  // It is also shown if the core financial objectives/targets are missing or 0.
  const isFresh =
    !onboarding ||
    !onboarding.total_target ||
    onboarding.total_target === 0 ||
    !onboarding.monthly_target ||
    onboarding.monthly_target === 0;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          {greeting}{user.name ? `, ${user.name}` : ""} 👋
        </h1>
        <p className="text-rumbo-muted mt-1">Tu centro de control. Sin distracciones.</p>
      </div>

      {isFresh ? (
        <WelcomeCTA name={user.name} />
      ) : (
        <div className="mt-12 space-y-10">
          <Reveal>
            <DashboardHero />
          </Reveal>

          <Reveal delay={0.1}>
            <Card className="card-hover">
              <SectionTitle
                title="Ahorro mensual"
                hint="Ingresos menos gastos de los últimos 6 meses."
              />
              <SavingsChart />
            </Card>
          </Reveal>
        </div>
      )}
    </div>
  );
}

function WelcomeCTA({ name }: { name?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="mt-8 rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-amber-50 border border-emerald-100 p-8 md:p-12 relative overflow-hidden"
    >
      {/* Decorative floating emoji icons */}
      <FloatBadge emoji="🎯" bg="bg-amber-200"   pos={{ top: "12%", left: "8%"  }} delay={0} />
      <FloatBadge emoji="🚀" bg="bg-orange-200"  pos={{ top: "70%", left: "5%"  }} delay={0.6} />
      <FloatBadge emoji="💰" bg="bg-lime-200"    pos={{ top: "20%", left: "88%" }} delay={0.3} />
      <FloatBadge emoji="🌱" bg="bg-green-200"   pos={{ top: "75%", left: "90%" }} delay={0.9} />

      <div className="relative z-10 text-center max-w-md mx-auto">
        <div className="text-5xl mb-4">👋</div>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
          {name ? `¡Hola, ${name}!` : "¡Bienvenido!"}
        </h2>
        <p className="text-rumbo-muted mt-3 text-base leading-relaxed">
          Cuéntanos cuánto tienes, cuánto quieres y para cuándo.
          <br />
          En 1 minuto Rumbo arranca a trabajar contigo.
        </p>
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-2 mt-7 px-8 py-4 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base shadow-[0_10px_24px_-6px_rgba(16,185,129,0.55)] hover:shadow-[0_14px_28px_-6px_rgba(16,185,129,0.65)] active:scale-[0.97] transition-all"
        >
          Empieza aquí →
        </Link>
        <p className="text-xs text-rumbo-muted mt-4">
          Tarda menos de un minuto. Puedes saltarte cualquier paso.
        </p>
      </div>
    </motion.div>
  );
}

function FloatBadge({
  emoji, bg, pos, delay,
}: {
  emoji: string;
  bg: string;
  pos: { top: string; left: string };
  delay: number;
}) {
  return (
    <motion.div
      style={{ position: "absolute", top: pos.top, left: pos.left }}
      animate={{ y: [0, -8, 0, 6, 0], rotate: [0, 4, 0, -3, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay }}
      className="hidden md:block pointer-events-none"
    >
      <div className={`w-12 h-12 rounded-2xl ${bg} ring-4 ring-white shadow-[0_6px_16px_rgba(0,0,0,0.08)] flex items-center justify-center text-2xl`}>
        {emoji}
      </div>
    </motion.div>
  );
}
