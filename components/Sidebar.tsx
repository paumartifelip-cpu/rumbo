"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "./Logo";
import { MoreSheet } from "./MoreSheet";
import { cn } from "@/lib/utils";
import { useRumbo } from "@/lib/store";

// Each section gets its own pastel chip color for the icon — same palette as
// the Stack page so the language is consistent across the app.
const items = [
  { href: "/dashboard", label: "Inicio",    icon: "🏠", chip: "bg-amber-100"   },
  { href: "/money",     label: "Dinero",    icon: "💸", chip: "bg-lime-100"    },
  { href: "/gastos",    label: "Gastos",    icon: "🧾", chip: "bg-cyan-100"    },
  { href: "/goals",     label: "Objetivos", icon: "🚩", chip: "bg-rose-100"    },
  { href: "/stack",     label: "Stack",     icon: "🧰", chip: "bg-violet-100"  },
  { href: "/settings",  label: "Ajustes",   icon: "⚙️", chip: "bg-slate-100"   },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut, syncStatus } = useRumbo();

  function handleSignOut() {
    signOut();
    router.push("/login");
  }

  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-rumbo-line bg-white px-4 py-5 sticky top-0 h-screen">
      <div className="px-2 mb-6">
        <Link href="/dashboard">
          <Logo size="md" />
        </Link>
      </div>
      <nav className="flex flex-col gap-0.5">
        {items.map((it) => {
          const active = pathname?.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "nav-item group relative transition-colors duration-200",
                active ? "nav-item-active" : "hover:bg-slate-50"
              )}
            >
              {active && (
                <motion.div
                  layoutId="active-nav"
                  className="absolute inset-0 bg-rumbo-ink rounded-xl -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <motion.span
                whileHover={{ scale: 1.1, rotate: -3 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: "spring", stiffness: 320, damping: 18 }}
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center text-base leading-none shrink-0",
                  active ? "bg-white/15" : it.chip
                )}
              >
                {it.icon}
              </motion.span>
              <span className={cn(
                "font-medium transition-colors",
                active ? "text-white" : "text-rumbo-muted group-hover:text-rumbo-ink"
              )}>
                {it.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {profile && (
        <div className="mt-auto pt-6 px-1">
          <div className="rounded-2xl border border-rumbo-line p-3 flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl bg-gradient-to-br ${profile.color} flex items-center justify-center text-sm font-semibold text-white`}
            >
              {profile.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate flex items-center gap-1.5">
                {profile.name}
                <SyncDot status={syncStatus} />
              </div>
              <button
                onClick={handleSignOut}
                className="text-xs text-rumbo-muted hover:text-rose-600"
              >
                Cambiar de usuario
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function SyncDot({ status }: { status: string }) {
  const map: Record<string, { color: string; title: string }> = {
    idle: { color: "bg-slate-300", title: "Inactivo" },
    syncing: { color: "bg-amber-400 animate-pulse", title: "Sincronizando…" },
    synced: { color: "bg-emerald-500", title: "Guardado en la nube" },
    offline: { color: "bg-slate-300", title: "Sin Supabase (solo local)" },
    error: { color: "bg-rose-500", title: "Error de sincronización" },
  };
  const cfg = map[status] ?? map.idle;
  return (
    <span
      role="status"
      aria-label={cfg.title}
      title={cfg.title}
      className={`inline-block w-2 h-2 rounded-full ${cfg.color}`}
    />
  );
}

export function MobileHeader() {
  const { profile, syncStatus } = useRumbo();
  return (
    <header className="md:hidden flex items-center justify-between px-5 py-3 bg-white/85 backdrop-blur-md border-b border-rumbo-line sticky top-0 z-50">
      <Link href="/dashboard" aria-label="Inicio">
        <Logo size="sm" />
      </Link>

      {profile && (
        <div className="flex items-center gap-3">
          <SyncDot status={syncStatus} />
          <Link
            href="/settings"
            aria-label={`Ajustes — ${profile.name}`}
            className={`w-10 h-10 rounded-full bg-gradient-to-br ${profile.color} flex items-center justify-center text-xs font-bold text-white shadow-sm ring-2 ring-white active:scale-95 transition`}
          >
            {profile.initials}
          </Link>
        </div>
      )}
    </header>
  );
}

// Mobile tab bar — 5 items max, like Apple HIG. The "Más" tab opens a sheet
// with the secondary destinations instead of cramming them all in.
const MOBILE_TABS = [
  { href: "/dashboard", label: "Inicio",  icon: "🏠", chip: "bg-amber-100"   },
  { href: "/money",     label: "Dinero",  icon: "💸", chip: "bg-lime-100"    },
  { href: "/gastos",    label: "Gastos",  icon: "🧾", chip: "bg-cyan-100"    },
];

const MORE_PATHS = ["/goals", "/stack", "/settings"];

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_PATHS.some((p) => pathname?.startsWith(p));

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className="md:hidden fixed left-0 right-0 bg-white/90 backdrop-blur-md border-t border-rumbo-line flex justify-around z-50"
        style={{
          bottom: 0,
          paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))",
          paddingTop: "0.25rem",
        }}
      >
        {MOBILE_TABS.map((it) => {
          const active = pathname?.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-label={it.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center flex-1 min-h-[56px] py-1 rounded-xl text-[10px] font-medium transition-colors duration-200 active:scale-95",
                active ? "text-rumbo-ink" : "text-rumbo-muted"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center text-lg leading-none mb-0.5 transition-colors",
                  active ? it.chip : "bg-transparent"
                )}
              >
                {it.icon}
              </span>
              <span>{it.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="Más opciones"
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          className={cn(
            "flex flex-col items-center justify-center flex-1 min-h-[56px] py-1 rounded-xl text-[10px] font-medium transition-colors duration-200 active:scale-95",
            moreActive || moreOpen ? "text-rumbo-ink" : "text-rumbo-muted"
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center text-lg leading-none mb-0.5 transition-colors",
              moreActive || moreOpen ? "bg-slate-100" : "bg-transparent"
            )}
          >
            •••
          </span>
          <span>Más</span>
        </button>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
