import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type LandingGlowVariant =
  | "pink"
  | "cyan"
  | "purple"
  | "amber"
  | "green"
  | "blue"
  | "popular";

export interface LandingGlowCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  glow?: LandingGlowVariant;
}

const glowClass: Record<LandingGlowVariant, string> = {
  pink: "landing-glow-pink",
  cyan: "landing-glow-cyan",
  purple: "landing-glow-purple",
  amber: "landing-glow-amber",
  green: "landing-glow-green",
  blue: "landing-glow-blue",
  popular: "landing-glow-popular",
};

export function LandingGlowCard({
  children,
  className,
  glow = "purple",
  ...rest
}: LandingGlowCardProps) {
  return (
    <div className={cn("landing-glass", glowClass[glow], className)} {...rest}>
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
