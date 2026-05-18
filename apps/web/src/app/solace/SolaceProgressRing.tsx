import type { ReactNode } from "react";
import { useId, useMemo } from "react";
import { cn } from "@/lib/utils";

export interface SolaceProgressRingProps {
  /** 0–100 */
  value: number;
  /** Total SVG size in px */
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** Centered label / icon */
  children?: ReactNode;
}

/**
 * SVG progress ring with glowing violet→pink stroke and optional center content.
 */
export function SolaceProgressRing({
  value,
  size = 120,
  strokeWidth = 10,
  className,
  children,
}: SolaceProgressRingProps) {
  const gradId = `solace-ring-grad-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const safe = Math.min(100, Math.max(0, value));
  const r = useMemo(() => (size - strokeWidth) / 2, [size, strokeWidth]);
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="55%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
          style={{
            filter: "drop-shadow(0 0 10px rgba(168, 85, 247, 0.55)) drop-shadow(0 0 6px rgba(236, 72, 153, 0.35))",
          }}
        />
      </svg>
      {children ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-[var(--solace-ds-text)]">
          {children}
        </div>
      ) : null}
    </div>
  );
}
