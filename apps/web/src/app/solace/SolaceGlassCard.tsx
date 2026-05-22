import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SolaceGlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * Matte navy/charcoal glass surface with purple border glow, backdrop blur, and inner lift.
 */
export function SolaceGlassCard({ children, className, ...rest }: SolaceGlassCardProps) {
  return (
    <div
      className={cn(
        "solace-glass-card solace-rail-card light-theme-card light-theme-card-hover relative overflow-hidden rounded-[28px] border border-[color:var(--solace-ds-border-glow)] bg-[var(--solace-ds-surface)] text-[var(--solace-ds-text)] backdrop-blur-xl",
        "shadow-[0_0_0_1px_rgba(168,85,247,0.12),0_0_48px_-20px_var(--solace-ds-glow-purple),var(--solace-ds-shadow-cinematic),inset_0_1px_0_rgba(255,255,255,0.06)]",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(168,85,247,0.08),transparent_55%)]",
        className
      )}
      {...rest}
    >
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
