"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";
import { useRumbo } from "@/lib/store";

const items = [
  { href: "/today", label: "Hoy", icon: "🎯" },
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/goals", label: "Objetivos", icon: "🚩" },
  { href: "/tasks", label: "Tareas", icon: "✅" },
  { href: "/money", label: "Dinero", icon: "💸" },
  { href: "/gastos", label: "Gastos", icon: "🧾" },
  { href: "/settings", label: "Ajustes", icon: "⚙️" },
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
                "nav-item group relative",
                active && "nav-item-active"
              )}
            >
              <span className="text-base leading-none transition-transform duration-200 group-hover:scale-110">
                {it.icon}
              </span>
              <span className="font-medium">{it.label}</span>
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
      title={cfg.title}
      className={`inline-block w-2 h-2 rounded-full ${cfg.color}`}
    />
  );
}

// Mobile bottom nav shows only the most-used 5 to avoid cramping.
const MOBILE_ITEMS = ["/dashboard", "/today", "/tasks", "/money", "/settings"];

export function MobileNav() {
  const pathname = usePathname();
  const mobileItems = items.filter((it) => MOBILE_ITEMS.includes(it.href));
  return (
    <nav
      className="md:hidden fixed left-2 right-2 bg-white border border-rumbo-line rounded-2xl shadow-card p-1 flex justify-between z-50"
      style={{ bottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      {mobileItems.map((it) => {
        const active = pathname?.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl text-[10px] transition-all duration-200 min-w-0 active:scale-95",
              active
                ? "bg-rumbo-ink text-white shadow-soft scale-105"
                : "text-rumbo-muted hover:text-rumbo-ink"
            )}
          >
            <span className="text-lg leading-none">{it.icon}</span>
            <span className="mt-0.5">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
