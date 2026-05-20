import { useId } from "react";
import { cn } from "@/lib/utils";

interface ClarityCircularRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  centerSublabel?: string;
}

export function ClarityCircularRing({
  value,
  size = 140,
  strokeWidth = 10,
  className,
  centerSublabel = "Clarity",
}: ClarityCircularRingProps) {
  const gradientId = useId().replace(/:/g, "");
  const safe = Math.min(100, Math.max(0, Math.round(value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div className={cn("relative inline-flex shrink-0 items-center justify-center", className)}>
      <div
        className="pointer-events-none absolute rounded-full opacity-40 blur-xl"
        aria-hidden
        style={{
          width: size * 0.9,
          height: size * 0.9,
          background: `conic-gradient(from 0deg, #a855f7 0%, #ec4899 ${safe}%, transparent ${safe}%)`,
        }}
      />
      <svg width={size} height={size} className="relative -rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(139, 92, 246, 0.18)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
          style={{ filter: "drop-shadow(0 0 8px rgba(168, 85, 247, 0.55))" }}
        />
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        <span className="text-[1.75rem] font-bold leading-none tracking-tight text-white">{safe}%</span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-violet-200/80">
          {centerSublabel}
        </span>
      </div>
    </div>
  );
}
