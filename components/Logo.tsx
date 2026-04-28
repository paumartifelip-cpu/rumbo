import { cn } from "@/lib/utils";

export function Logo({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const cls = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-3xl md:text-4xl",
  }[size];
  return (
    <span
      className={cn(
        "font-semibold tracking-tight text-rumbo-ink select-none",
        cls,
        className
      )}
    >
      Rumbo
    </span>
  );
}
