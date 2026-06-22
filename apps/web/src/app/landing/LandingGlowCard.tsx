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
  style,
  ...rest
}: LandingGlowCardProps) {
  const isCtaImage = Boolean(className?.includes("landing-cta-card-image"));

  return (
    <div
      className={cn(
        "landing-glass h-full w-full min-w-0",
        glowClass[glow],
        isCtaImage && "landing-cta-card-image",
      )}
      style={style}
      {...rest}
    >
      <div className={cn("relative z-[1] h-full w-full min-h-0 min-w-0", className)}>{children}</div>
    </div>
  );
}
