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

const glowClass: Record<SolaceGlow, string> = {
  violet:
    "shadow-[var(--solace-glow-purple),0_0_0_1px_rgba(139,92,246,0.14)]",
  cyan: "shadow-[var(--solace-glow-cyan),0_0_0_1px_rgba(34,211,238,0.12)]",
  amber:
    "shadow-[0_0_36px_rgba(251,191,36,0.12),0_0_0_1px_rgba(251,191,36,0.1)]",
  rose: "shadow-[0_0_32px_rgba(251,113,133,0.14),0_0_0_1px_rgba(251,113,133,0.1)]",
  none: "shadow-[0_0_0_1px_var(--solace-border),0_22px_64px_-36px_rgba(0,0,0,0.65)]",
};

export function SolacePanel({ children, className, glow = "none", soft }: SolacePanelProps) {
  return (
    <div
      className={cn(
        "solace-panel light-theme-card light-theme-card-hover relative overflow-hidden rounded-2xl border border-[var(--solace-border)]",
        soft ? "bg-[var(--solace-panel-soft)]" : "bg-[var(--solace-panel)]",
        "text-[var(--solace-text)] backdrop-blur-md",
        glowClass[glow],
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.07),transparent_55%)]",
        "[html[data-ezri-theme=light]_&]:before:bg-[radial-gradient(ellipse_at_top,rgba(167,139,250,0.1),transparent_55%)]",
        className
      )}
    >
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
