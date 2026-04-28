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
  const { profile, signOut } = useRumbo();

  function handleSignOut() {
    signOut();
    router.push("/login");
  }

  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-rumbo-line bg-white px-4 py-5 sticky top-0 h-screen">
      <div className="px-2 mb-6">
        <Logo size="md" />
      </div>
      <nav className="flex flex-col gap-0.5">
        {items.map((it) => {
          const active = pathname?.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn("nav-item", active && "nav-item-active")}
            >
              <span className="text-base leading-none">{it.icon}</span>
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
              <div className="text-sm font-medium truncate">
                {profile.name}
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

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-3 left-3 right-3 bg-white border border-rumbo-line rounded-2xl shadow-card p-1.5 flex justify-between z-50">
      {items.map((it) => {
        const active = pathname?.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl text-[10px] transition-colors",
              active ? "bg-rumbo-ink text-white" : "text-rumbo-muted"
            )}
          >
            <span className="text-base leading-none">{it.icon}</span>
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
