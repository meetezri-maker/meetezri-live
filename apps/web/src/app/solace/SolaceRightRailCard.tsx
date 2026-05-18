import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SolaceRightRailCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * Fixed rail width feel (~360px max): matte dark card, ambient shadow, subtle border.
 */
export function SolaceRightRailCard({ children, className, ...rest }: SolaceRightRailCardProps) {
  return (
    <div
      className={cn(
        "w-full max-w-[360px] rounded-[var(--solace-ds-radius-rail)] border border-white/[0.07] bg-[var(--solace-ds-surface)] text-[var(--solace-ds-text)] shadow-[0_24px_70px_-36px_rgba(0,0,0,0.75),0_0_40px_-20px_rgba(88,28,135,0.25),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.06),transparent_50%)]",
        "relative overflow-hidden",
        className
      )}
      {...rest}
    >
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
