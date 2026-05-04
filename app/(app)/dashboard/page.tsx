"use client";

import { Card, PageHeader, SectionTitle } from "@/components/Card";
import { DashboardHero } from "@/components/DashboardHero";
import { Reveal } from "@/components/Reveal";
import { SpendingTrend } from "@/components/SpendingTrend";
import { SpendingDonut } from "@/components/SpendingDonut";

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Inicio"
        subtitle="Tu centro de control. Sin distracciones."
      />

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
