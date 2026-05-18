import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SolaceAmbientBackgroundProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * Page-level ambient layers: deep navy bases, violet depth, soft haze — not flat black.
 */
export function SolaceAmbientBackground({ children, className, ...rest }: SolaceAmbientBackgroundProps) {
  return (
    <div className={cn("relative min-h-0 text-[var(--solace-ds-text)]", className)} {...rest}>
      <div
        className="pointer-events-none absolute inset-0 bg-[var(--solace-ds-bg-deep)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,rgba(88,28,135,0.45)_0%,transparent_52%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_100%_0%,rgba(236,72,153,0.12)_0%,transparent_42%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_100%,rgba(34,211,238,0.1)_0%,transparent_40%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(15,23,42,0.55)_0%,transparent_48%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,10,20,0.5)_0%,transparent_40%,rgba(5,8,22,0.92)_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-soft-light bg-[url('data:image/svg+xml,%3Csvg viewBox=%220%200%20256%20256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.75%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.05%22/%3E%3C/svg%3E')]"
        aria-hidden
      />
      <div className="relative z-10 min-h-0">{children}</div>
    </div>
  );
}
