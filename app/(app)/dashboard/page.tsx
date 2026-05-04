"use client";

import { PageHeader } from "@/components/Card";
import { DashboardHero } from "@/components/DashboardHero";
import { Reveal } from "@/components/Reveal";

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Inicio"
        subtitle="Tu centro de control. Sin distracciones."
      />

      <div className="mt-12">
        <Reveal>
          <DashboardHero />
        </Reveal>
      </div>
    </div>
  );
}
