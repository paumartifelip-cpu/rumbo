"use client";

import { ReactNode, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Apple-style modal bottom sheet:
// - Slides from bottom on mobile, centered card on desktop.
// - Backdrop blur + dim. Tap outside or Esc to dismiss.
// - Drag handle for affordance. Locks body scroll while open.
export function Sheet({
  open,
  onClose,
  title,
  children,
  ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel ?? title ?? "Diálogo"}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col"
            style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div
                className="w-10 h-1 rounded-full bg-slate-200"
                aria-hidden="true"
              />
            </div>
            {title && (
              <div className="px-5 pt-2 pb-3 flex items-center justify-between border-b border-rumbo-line shrink-0">
                <h2 className="text-lg font-semibold tracking-tight">
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-rumbo-muted hover:bg-slate-100 active:scale-95 transition"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
