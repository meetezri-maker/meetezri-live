import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SolaceHeroEnvironmentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Optional background image (e.g. lake, interior). Omit for gradient-only atmosphere. */
  imageSrc?: string;
  imageAlt?: string;
  imageClassName?: string;
  /** Extra cinematic overlay stack (profile sanctuary hero) */
  cinematicDepth?: boolean;
  /** Main content (title, copy, etc.) */
  contentClassName?: string;
  /** Optional footer row for CTAs */
  ctaSlot?: ReactNode;
  ctaClassName?: string;
}

/**
 * Layered hero shell: optional photo, vignette, violet/pink/amber glow, content + optional CTA row.
 */
export function SolaceHeroEnvironment({
  children,
  className,
  contentClassName,
  ctaSlot,
  ctaClassName,
  imageSrc,
  imageAlt = "",
  imageClassName,
  cinematicDepth = false,
  ...rest
}: SolaceHeroEnvironmentProps) {
  return (
    <div
      className={cn(
        "solace-hero-media solace-hero-environment relative isolate overflow-hidden rounded-[28px] border border-[color:var(--solace-ds-border-glow)] bg-[var(--solace-ds-bg-raised)] text-[var(--solace-ds-text)] shadow-[var(--solace-ds-shadow-cinematic)]",
        className
      )}
      {...rest}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={imageAlt}
          className={cn("absolute inset-0 z-0 h-full w-full object-cover", imageClassName)}
          width={1600}
          height={900}
        />
      ) : (
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_50%_100%,#0b1020_0%,#050816_55%,#070a14_100%)]"
          aria-hidden
        />
      )}

      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-[1]",
          cinematicDepth
            ? "bg-[radial-gradient(ellipse_90%_70%_at_70%_90%,rgba(251,191,36,0.12),transparent_55%)]"
            : "bg-[radial-gradient(ellipse_90%_70%_at_70%_90%,rgba(251,191,36,0.18),transparent_55%)]"
        )}
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-[1]",
          cinematicDepth
            ? "bg-[radial-gradient(ellipse_at_20%_0%,rgba(168,85,247,0.14),transparent_50%)]"
            : "bg-[radial-gradient(ellipse_at_20%_0%,rgba(168,85,247,0.22),transparent_50%)]"
        )}
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-[1]",
          cinematicDepth
            ? "bg-[radial-gradient(ellipse_at_100%_30%,rgba(236,72,153,0.08),transparent_45%)]"
            : "bg-[radial-gradient(ellipse_at_100%_30%,rgba(236,72,153,0.14),transparent_45%)]"
        )}
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-[1]",
          cinematicDepth
            ? "bg-[linear-gradient(180deg,rgba(5,8,22,0.12)_0%,rgba(5,8,22,0.42)_50%,rgba(5,8,22,0.72)_100%)]"
            : "bg-[linear-gradient(180deg,rgba(5,8,22,0.35)_0%,rgba(5,8,22,0.75)_45%,rgba(5,8,22,0.92)_100%)]"
        )}
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-[1]",
          cinematicDepth
            ? "shadow-[inset_0_0_80px_rgba(0,0,0,0.32)]"
            : "shadow-[inset_0_0_120px_rgba(0,0,0,0.55)]"
        )}
        aria-hidden
      />
      {cinematicDepth ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_50%_42%_at_78%_18%,rgba(196,181,253,0.14),transparent_58%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_45%_38%_at_12%_88%,rgba(251,191,36,0.1),transparent_52%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(49,46,129,0.14)_0%,rgba(15,10,35,0.32)_45%,rgba(5,6,16,0.62)_100%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-20 bg-[linear-gradient(180deg,rgba(139,92,246,0.08),transparent)]"
            aria-hidden
          />
        </>
      ) : null}

      <div className={cn("solace-hero-content relative z-10 flex min-h-0 flex-col", contentClassName)}>
        {children}
        {ctaSlot ? (
          <div
            className={cn(
              "mt-auto border-t border-white/[0.08] bg-black/20 px-6 py-4 backdrop-blur-md sm:px-8",
              ctaClassName
            )}
          >
            {ctaSlot}
          </div>
        ) : null}
      </div>
    </div>
  );
}
