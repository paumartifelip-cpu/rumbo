import { cn } from "@/lib/utils";
import { ReactNode } from "react";

export function Card({
  children,
  className,
  as: As = "div",
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  as?: any;
  interactive?: boolean;
}) {
  return (
    <As
      className={cn("card p-5", interactive && "card-hover", className)}
    >
      {children}
    </As>
  );
}

export function SectionTitle({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-rumbo-ink">
          {title}
        </h2>
        {hint && <p className="text-sm text-rumbo-muted mt-0.5">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-rumbo-ink">
          {title}
        </h1>
        {subtitle && (
          <p className="text-rumbo-muted mt-1 max-w-2xl">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "good" | "warn" | "danger";
}) {
  const toneClass = {
    default: "text-rumbo-ink",
    good: "text-green-900 font-bold",
    warn: "text-amber-600",
    danger: "text-red-600 font-black",
  }[tone];
  return (
    <div className="card card-hover p-4">
      <div className="text-[11px] uppercase tracking-wider text-rumbo-muted">
        {label}
      </div>
      <div className={cn("text-2xl font-semibold mt-1.5 tabular-nums", toneClass)}>
        {value}
      </div>
      {hint && <div className="text-xs text-rumbo-muted mt-1">{hint}</div>}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "green",
}: {
  value: number;
  tone?: "green" | "blue" | "yellow" | "violet";
}) {
  const v = Math.max(0, Math.min(100, value));
  const color = {
    green: "bg-rumbo-green",
    blue: "bg-rumbo-blue",
    yellow: "bg-rumbo-yellow",
    violet: "bg-rumbo-violet",
  }[tone];
  return (
    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon = "✨",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card p-10 text-center">
      <div className="text-3xl mb-3">{icon}</div>
      <div className="text-lg font-semibold">{title}</div>
      {description && (
        <p className="text-rumbo-muted mt-1 max-w-md mx-auto">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
