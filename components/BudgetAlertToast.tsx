"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useRumbo } from "@/lib/store";

// Aviso flotante al cruzar el 80 % / 100 % de un presupuesto. Vive en el layout
// de la app para verse también cuando el gasto se añade desde la hoja móvil.
export function BudgetAlertToast() {
  const { budgetAlert, dismissBudgetAlert } = useRumbo();

  useEffect(() => {
    if (!budgetAlert) return;
    const t = setTimeout(dismissBudgetAlert, 7000);
    return () => clearTimeout(t);
  }, [budgetAlert, dismissBudgetAlert]);

  return (
    <AnimatePresence>
      {budgetAlert && (
        <motion.div
          key={budgetAlert.id}
          role="status"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className={`fixed z-[60] left-4 right-4 md:left-auto md:right-6 md:w-96 bottom-24 md:bottom-6 rounded-2xl border px-4 py-3 shadow-lg flex items-start gap-3 ${
            budgetAlert.level === "over"
              ? "bg-rose-50 border-rose-200 text-rose-900"
              : "bg-amber-50 border-amber-200 text-amber-900"
          }`}
        >
          <span className="text-xl shrink-0">{budgetAlert.level === "over" ? "🚨" : "⚠️"}</span>
          <p className="text-sm font-medium leading-snug flex-1">{budgetAlert.message}</p>
          <button
            onClick={dismissBudgetAlert}
            aria-label="Cerrar aviso"
            className="shrink-0 w-6 h-6 rounded-lg opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
