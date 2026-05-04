"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";

export function SettingsAccordion({
  id,
  title,
  icon,
  hint,
  activeId,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  icon: string;
  hint?: string;
  activeId: string | null;
  onToggle: (id: string) => void;
  children: ReactNode;
}) {
  const isOpen = activeId === id;

  return (
    <div className={`border border-rumbo-line rounded-2xl overflow-hidden transition-all bg-white ${isOpen ? "shadow-md" : "hover:shadow-sm"}`}>
      <button
        onClick={() => onToggle(id)}
        className="w-full px-5 py-4 flex items-center justify-between bg-white focus:outline-none transition-colors hover:bg-slate-50"
      >
        <div className="flex items-center gap-4 text-left">
          <div className="text-2xl bg-slate-100 w-10 h-10 rounded-full flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-rumbo-ink text-base">{title}</h3>
            {hint && !isOpen && (
              <p className="text-sm text-rumbo-muted line-clamp-1 mt-0.5">{hint}</p>
            )}
          </div>
        </div>
        <div className="text-rumbo-muted shrink-0 ml-4">
          <motion.svg
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.3, ease: "anticipate" }}
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </motion.svg>
        </div>
      </button>
      
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "anticipate" }}
            className="overflow-hidden"
          >
            <div className="p-5 border-t border-rumbo-line bg-slate-50/50">
              {hint && (
                <p className="text-sm text-rumbo-muted mb-4">{hint}</p>
              )}
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
