import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SolaceGlowButton } from "./SolaceGlowButton";

export interface SolacePlanCardProps {
  title: string;
  description?: string;
  /** Short feature lines */
  features: string[];
  ctaLabel: string;
  onCtaClick?: () => void;
  /** Highlights current subscription tier */
  isCurrent?: boolean;
  className?: string;
  /** Extra actions (e.g. “Manage”) rendered beside CTA */
  footerExtra?: ReactNode;
}

/**
 * Premium dark plan card with optional current-plan glow, soft feature list, pill CTA.
 */
export function SolacePlanCard({
  title,
  description,
  features,
  ctaLabel,
  onCtaClick,
  isCurrent,
  className,
  footerExtra,
}: SolacePlanCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-[28px] border bg-[var(--solace-ds-surface)] p-6 text-[var(--solace-ds-text)] shadow-[var(--solace-ds-shadow-cinematic)] backdrop-blur-xl sm:p-7",
        isCurrent
          ? "border-[color:var(--solace-ds-border-glow)] shadow-[0_0_0_1px_rgba(168,85,247,0.35),0_0_56px_-12px_var(--solace-ds-glow-purple),0_40px_100px_-48px_rgba(0,0,0,0.85)]"
          : "border-white/[0.08]",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-[radial-gradient(ellipse_at_50%_0%,rgba(168,85,247,0.1),transparent_55%)]",
        className
      )}
    >
      <div className="relative z-[1] flex flex-1 flex-col">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          {isCurrent ? (
            <span className="rounded-full border border-violet-400/35 bg-violet-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-100/95">
              Current
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="mb-5 text-sm leading-relaxed text-[var(--solace-ds-text-muted)]">{description}</p>
        ) : null}

        <ul className="mb-6 flex flex-1 flex-col gap-2.5 text-sm text-[var(--solace-ds-text-muted)]">
          {features.map((line) => (
            <li key={line} className="flex gap-2.5">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400/90 shadow-[0_0_10px_rgba(168,85,247,0.55)]"
                aria-hidden
              />
              <span className="leading-relaxed text-[var(--solace-ds-text)]/90">{line}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-wrap items-center gap-3">
          <SolaceGlowButton type="button" onClick={onCtaClick}>
            {ctaLabel}
          </SolaceGlowButton>
          {footerExtra}
        </div>
      </div>
    </div>
  );
}
