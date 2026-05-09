"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sheet } from "./Sheet";
import { useRumbo } from "@/lib/store";

const ITEMS = [
  { href: "/goals",    label: "Objetivos", icon: "🚩", chip: "bg-rose-100",   desc: "Metas y plazos" },
  { href: "/stack",    label: "Stack",     icon: "🧰", chip: "bg-violet-100", desc: "Cómo organizas tu dinero" },
  { href: "/settings", label: "Ajustes",   icon: "⚙️", chip: "bg-slate-100",  desc: "Cuenta, divisa y datos" },
];

export function MoreSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { profile, signOut } = useRumbo();

  function handleSignOut() {
    onClose();
    signOut();
    router.push("/login");
  }

  return (
    <Sheet open={open} onClose={onClose} title="Más" ariaLabel="Más opciones">
      <nav className="px-3 pt-2 pb-3" aria-label="Secciones adicionales">
        {ITEMS.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-slate-50 active:scale-[0.99] transition min-h-[60px]"
          >
            <span
              className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg ${it.chip}`}
              aria-hidden="true"
            >
              {it.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-rumbo-ink">{it.label}</div>
              <div className="text-xs text-rumbo-muted">{it.desc}</div>
            </div>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-rumbo-muted"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        ))}
      </nav>

      {profile && (
        <div className="px-5 py-4 border-t border-rumbo-line flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-xl bg-gradient-to-br ${profile.color} flex items-center justify-center text-sm font-semibold text-white`}
            aria-hidden="true"
          >
            {profile.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{profile.name}</div>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs text-rumbo-muted hover:text-rose-600 min-h-[36px]"
            >
              Cambiar de usuario
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
