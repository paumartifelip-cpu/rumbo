"use client";

import { useMemo } from "react";
import { Card, SectionTitle } from "@/components/Card";
import { DashboardHero } from "@/components/DashboardHero";
import { Reveal } from "@/components/Reveal";
import { SpendingTrend } from "@/components/SpendingTrend";
import { SpendingDonut } from "@/components/SpendingDonut";
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
  const { user } = useRumbo();
  const greeting = useGreeting();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          {greeting}{user.name ? `, ${user.name}` : ""} 👋
        </h1>
        <p className="text-rumbo-muted mt-1">Tu centro de control. Sin distracciones.</p>
      </div>

      <div className="mt-12 space-y-10">
        <Reveal>
          <DashboardHero />
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Reveal delay={0.1}>
            <Card className="card-hover h-full">
              <SectionTitle
                title="Tendencia de gastos"
                hint="Tus gastos de los últimos 6 meses."
              />
              <SpendingTrend />
            </Card>
          </Reveal>

          <Reveal delay={0.2}>
            <Card className="card-hover h-full">
              <SectionTitle title="Reparto de este mes" />
              <SpendingDonut />
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
