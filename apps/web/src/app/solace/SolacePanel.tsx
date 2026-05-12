import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SolaceGlow = "violet" | "cyan" | "amber" | "rose" | "none";

interface SolacePanelProps {
  children: ReactNode;
  className?: string;
  glow?: SolaceGlow;
  /** Softer inner tint */
  soft?: boolean;
}

/** Directional, asymmetric edge light — avoids uniform "halo box" look */
const glowClass: Record<SolaceGlow, string> = {
  violet:
    "shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,-8px_0_40px_-12px_rgba(109,40,217,0.22),8px_8px_48px_-18px_rgba(0,0,0,0.55)]",
  cyan: "shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,4px_-6px_36px_-10px_rgba(34,211,238,0.14),-4px_8px_40px_-20px_rgba(0,0,0,0.5)]",
  amber:
    "shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,6px_4px_40px_-14px_rgba(251,191,36,0.12),-6px_-4px_44px_-18px_rgba(0,0,0,0.48)]",
  rose:
    "shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,-6px_6px_38px_-12px_rgba(244,114,182,0.12),4px_-4px_42px_-16px_rgba(0,0,0,0.5)]",
  none:
    "shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_24px_56px_-32px_rgba(0,0,0,0.65),0_0_0_1px_var(--solace-border)]",
};

export function SolacePanel({ children, className, glow = "none", soft }: SolacePanelProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--solace-border)]",
        soft ? "bg-[var(--solace-panel-soft)]" : "bg-[var(--solace-panel)]",
        "backdrop-blur-[14px]",
        glowClass[glow],
        /* Top highlight — luxury matte surface */
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(175deg,rgba(255,255,255,0.05)_0%,transparent_42%,rgba(0,0,0,0.18)_100%)]",
        /* Soft left rim light */
        "after:pointer-events-none after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-gradient-to-b after:from-cyan-400/15 after:via-transparent after:to-violet-500/10",
        className
      )}
    >
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
