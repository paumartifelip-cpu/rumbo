"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { useRumbo } from "@/lib/store";
import { OnboardingData } from "@/lib/types";
import { CURRENCIES, Currency } from "@/lib/currency";

export default function OnboardingPage() {
  const router = useRouter();
  const { saveOnboarding, primaryCurrency, setPrimaryCurrency } = useRumbo();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    name: "",
    current_money: 0,
    total_target: 50000,
    current_monthly_income: 0,
    monthly_target: 5000,
    target_date: inMonths(6),
  });

  const currencyMeta = CURRENCIES[primaryCurrency];

  const steps = [
    {
      title: "¿Cómo te llamas?",
      hint: "Para personalizar tu rumbo. Puedes saltarlo.",
      kind: "text" as const,
      get: () => data.name ?? "",
      set: (v: string) => setData({ ...data, name: v }),
      placeholder: "Tu nombre",
    },
    {
      title: "¿En qué moneda manejas tu dinero?",
      hint: "Todos tus totales se mostrarán en esta moneda. Podrás cambiarla luego.",
      kind: "currency" as const,
    },
    {
      title: "¿Cuánto tienes en total ahora?",
      hint: "Tu patrimonio actual: cuenta + ahorros + lo que ya tienes.",
      kind: "money" as const,
      get: () => data.current_money,
      set: (v: number) => setData({ ...data, current_money: v }),
    },
    {
      title: "¿Cuánto quieres tener en total?",
      hint: "Tu objetivo de patrimonio. La cifra que persigues.",
      kind: "money" as const,
      get: () => data.total_target,
      set: (v: number) => setData({ ...data, total_target: v }),
    },
    {
      title: "¿Cuánto cobras al mes ahora?",
      hint: "Tu sueldo fijo o lo que te genera tu negocio cada mes.",
      kind: "money" as const,
      get: () => data.current_monthly_income,
      set: (v: number) => setData({ ...data, current_monthly_income: v }),
    },
    {
      title: "¿Cuánto quieres ganar al mes?",
      hint: "Tu objetivo de ingresos mensuales.",
      kind: "money" as const,
      get: () => data.monthly_target,
      set: (v: number) => setData({ ...data, monthly_target: v }),
    },
    {
      title: "¿Para cuándo quieres lograrlo?",
      hint: "Una fecha objetivo para medir tu ritmo.",
      kind: "date" as const,
      get: () => data.target_date.slice(0, 10),
      set: (v: string) =>
        setData({ ...data, target_date: new Date(v).toISOString() }),
    },
  ];

  const total = steps.length;
  const current = steps[step];

  function next() {
    if (step < total - 1) setStep(step + 1);
    else finish();
  }
  function back() {
    if (step > 0) setStep(step - 1);
  }
  function finish() {
    saveOnboarding(data);
    router.push("/today");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 md:px-10 py-5 flex items-center justify-between">
        <Logo />
        <span className="text-sm text-rumbo-muted">
          {step + 1} / {total}
        </span>
      </header>

      <div className="px-6 md:px-10 max-w-lg w-full mx-auto pt-8 md:pt-16 flex-1">
        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden mb-12">
          <motion.div
            className="h-full bg-rumbo-ink"
            animate={{ width: `${((step + 1) / total) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              {current.title}
            </h1>
            <p className="text-rumbo-muted mt-3 text-base">{current.hint}</p>
            <div className="mt-8">
              {current.kind === "text" && (
                <input
                  className="input text-xl"
                  placeholder={current.placeholder}
                  value={current.get() as string}
                  onChange={(e) => current.set(e.target.value as never)}
                  autoFocus
                />
              )}
              {current.kind === "currency" && (
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(CURRENCIES) as Currency[]).map((c) => {
                    const meta = CURRENCIES[c];
                    const active = primaryCurrency === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setPrimaryCurrency(c)}
                        className={`flex items-center gap-3 px-4 py-4 rounded-xl border transition-all text-left ${
                          active
                            ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:-translate-y-0.5"
                        }`}
                      >
                        <span className="text-3xl">{meta.flag}</span>
                        <div>
                          <div className="font-semibold">{meta.code}</div>
                          <div className="text-xs text-rumbo-muted">
                            {meta.name}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {current.kind === "money" && (
                <Money
                  value={current.get() as number}
                  onChange={(v) => current.set(v as never)}
                  symbol={currencyMeta.symbol}
                />
              )}
              {current.kind === "date" && (
                <input
                  type="date"
                  className="input text-xl"
                  value={current.get() as string}
                  onChange={(e) => current.set(e.target.value as never)}
                />
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between items-center mt-12">
          <button
            className="btn-ghost"
            onClick={back}
            disabled={step === 0}
          >
            Atrás
          </button>
          <button className="btn-primary" onClick={next}>
            {step === total - 1 ? "Empezar" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Money({
  value,
  onChange,
  symbol,
}: {
  value: number;
  onChange: (v: number) => void;
  symbol: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="numeric"
        className="input text-3xl font-semibold pr-12 py-4"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        autoFocus
      />
      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-rumbo-muted text-2xl">
        {symbol}
      </span>
    </div>
  );
}

function inMonths(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString();
}
