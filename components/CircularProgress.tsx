"use client";

import { motion } from "framer-motion";
import { clamp } from "@/lib/utils";

export function CircularProgress({
  value,
  size = 160,
  stroke = 12,
  tone = "green",
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "green" | "violet" | "blue" | "yellow" | "rose";
  label?: string;
}) {
  const v = clamp(value, 0, 100);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - v / 100);

  const colors: Record<string, string> = {
    green: "#16A34A",
    violet: "#7C3AED",
    blue: "#2563EB",
    yellow: "#D97706",
    rose: "#E11D48",
  };
  const color = colors[tone];

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#EEF0F4"
          strokeWidth={stroke}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-semibold tracking-tight">
          {Math.round(v)}%
        </div>
        {label && (
          <div className="text-[11px] text-rumbo-muted mt-0.5">{label}</div>
        )}
      </div>
    </div>
  );
}
