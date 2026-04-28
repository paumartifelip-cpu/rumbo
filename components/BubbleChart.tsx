"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { formatMoney } from "@/lib/utils";

export interface Bubble {
  name: string;
  value: number;
}

interface Placed extends Bubble {
  x: number;
  y: number;
  r: number;
  color: string;
}

const PALETTE = [
  "#E11D48",
  "#F97316",
  "#FBBF24",
  "#16A34A",
  "#2563EB",
  "#7C3AED",
  "#EC4899",
  "#0EA5E9",
  "#14B8A6",
  "#F43F5E",
];

/**
 * Pack circles in a 2D plane using a deterministic spiral search.
 * Returns positions with a viewBox sized to the bounding box.
 */
function packCircles(bubbles: Bubble[]): {
  placed: Placed[];
  width: number;
  height: number;
} {
  if (bubbles.length === 0) return { placed: [], width: 0, height: 0 };

  const sorted = [...bubbles].sort((a, b) => b.value - a.value);
  const max = sorted[0].value;
  const total = sorted.reduce((a, b) => a + b.value, 0);

  // Map value to radius. sqrt for area-proportional circles.
  const minR = 22;
  const maxR = 90;
  const toR = (v: number) =>
    Math.max(minR, Math.sqrt(v / max) * maxR);

  const placed: Placed[] = [];

  function overlaps(x: number, y: number, r: number) {
    for (const p of placed) {
      const dx = p.x - x;
      const dy = p.y - y;
      const minDist = p.r + r + 2; // 2px gap
      if (dx * dx + dy * dy < minDist * minDist) return true;
    }
    return false;
  }

  sorted.forEach((b, i) => {
    const r = toR(b.value);
    const color = PALETTE[i % PALETTE.length];
    if (placed.length === 0) {
      placed.push({ ...b, x: 0, y: 0, r, color });
      return;
    }
    // Spiral search.
    let placedFlag = false;
    for (let step = 1; step <= 200 && !placedFlag; step++) {
      const radius = step * 8;
      const samples = Math.min(64, 12 + step * 4);
      for (let s = 0; s < samples; s++) {
        const angle = (s / samples) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (!overlaps(x, y, r)) {
          placed.push({ ...b, x, y, r, color });
          placedFlag = true;
          break;
        }
      }
    }
    if (!placedFlag) {
      // Fallback: stick it on the right.
      placed.push({ ...b, x: 1000, y: 0, r, color });
    }
  });

  // Compute bounding box.
  const pad = 8;
  const minX = Math.min(...placed.map((p) => p.x - p.r)) - pad;
  const maxX = Math.max(...placed.map((p) => p.x + p.r)) + pad;
  const minY = Math.min(...placed.map((p) => p.y - p.r)) - pad;
  const maxY = Math.max(...placed.map((p) => p.y + p.r)) + pad;

  // Translate so minX/minY = 0
  const translated = placed.map((p) => ({
    ...p,
    x: p.x - minX,
    y: p.y - minY,
  }));

  return {
    placed: translated,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function BubbleChart({ data }: { data: Bubble[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const { placed, width, height } = useMemo(() => packCircles(data), [data]);
  const total = data.reduce((a, b) => a + b.value, 0);

  if (placed.length === 0) {
    return (
      <div className="text-sm text-rumbo-muted py-8 text-center">
        Aún sin gastos.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="relative w-full" style={{ aspectRatio: `${width} / ${Math.max(height, 1)}` }}>
        <svg
          viewBox={`0 0 ${width} ${Math.max(height, 1)}`}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
        >
          {placed.map((p, i) => {
            const pct = total ? (p.value / total) * 100 : 0;
            const showLabel = p.r > 30;
            const isHover = hover === p.name;
            return (
              <motion.g
                key={p.name}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04, type: "spring", stiffness: 180, damping: 16 }}
                onMouseEnter={() => setHover(p.name)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              >
                <defs>
                  <radialGradient id={`bg-${i}`} cx="35%" cy="35%" r="65%">
                    <stop offset="0%" stopColor={p.color} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={p.color} stopOpacity={0.7} />
                  </radialGradient>
                </defs>
                <motion.circle
                  cx={p.x}
                  cy={p.y}
                  r={p.r}
                  fill={`url(#bg-${i})`}
                  stroke={p.color}
                  strokeOpacity={isHover ? 0.9 : 0.2}
                  strokeWidth={isHover ? 3 : 1.5}
                  animate={{ scale: isHover ? 1.05 : 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 16 }}
                  style={{ transformOrigin: `${p.x}px ${p.y}px` }}
                />
                {showLabel && (
                  <>
                    <text
                      x={p.x}
                      y={p.y - 4}
                      textAnchor="middle"
                      fill="white"
                      fontSize={Math.max(10, p.r * 0.22)}
                      fontWeight={600}
                      style={{ pointerEvents: "none" }}
                    >
                      {p.name}
                    </text>
                    <text
                      x={p.x}
                      y={p.y + Math.max(12, p.r * 0.22)}
                      textAnchor="middle"
                      fill="white"
                      fontSize={Math.max(9, p.r * 0.18)}
                      fontWeight={500}
                      opacity={0.85}
                      style={{ pointerEvents: "none" }}
                    >
                      {formatMoney(p.value)}
                    </text>
                  </>
                )}
                {!showLabel && isHover && (
                  <text
                    x={p.x}
                    y={p.y - p.r - 6}
                    textAnchor="middle"
                    fill="#0B1220"
                    fontSize={11}
                    fontWeight={600}
                  >
                    {p.name} · {formatMoney(p.value)}
                  </text>
                )}
              </motion.g>
            );
          })}
        </svg>
      </div>

      {hover && (
        <div className="text-xs text-rumbo-muted mt-2 text-center">
          {hover} · {formatMoney(data.find((d) => d.name === hover)?.value ?? 0)}{" "}
          ·{" "}
          {Math.round(
            ((data.find((d) => d.name === hover)?.value ?? 0) / total) * 100
          )}
          % del mes
        </div>
      )}
    </div>
  );
}
