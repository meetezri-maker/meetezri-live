import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY_CTA_LABEL } from "./prelaunch.content";

/**
 * Shared building blocks for the pre-launch sections.
 *
 * Everything here reuses the existing `.solace-landing` token set
 * (`landing-tokens.css`) so the page reads as part of the current Solace site
 * rather than a separately designed campaign page.
 */

/** Small uppercase section badge with the soft glowing accent. */
export function SectionBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-violet-400/30 bg-violet-500/10",
        "px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-100/90",
        "shadow-[0_0_24px_-8px_rgba(168,85,247,0.6)] backdrop-blur-sm sm:text-xs",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Scroll-entrance wrapper.
 *
 * Under `prefers-reduced-motion` the content renders in its final state rather
 * than being hidden — motion is removed, never the content itself.
 */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const reduceMotion = useReducedMotion();
  const Component = motion[as];

  if (reduceMotion) {
    const Static = as;
    return <Static className={className}>{children}</Static>;
  }

  return (
    <Component
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </Component>
  );
}

/**
 * The single primary conversion control. Every instance carries the approved
 * label and routes to the same Founding Member signup flow.
 */
export function FoundingMemberCta({
  onClick,
  className,
  size = "lg",
}: {
  onClick: () => void;
  className?: string;
  size?: "lg" | "xl";
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={reduceMotion ? undefined : { scale: 1.02 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      className={cn(
        "landing-cta-glow inline-flex w-full items-center justify-center gap-2 rounded-xl",
        "bg-gradient-to-r from-[#E91E63] to-[#9C27B0] font-semibold text-white",
        "transition-shadow focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050816]",
        size === "xl"
          ? "px-8 py-4 text-base sm:w-auto sm:px-10 sm:text-lg"
          : "px-8 py-3.5 text-base sm:w-auto",
        className,
      )}
    >
      {PRIMARY_CTA_LABEL}
      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
    </motion.button>
  );
}

/** Section heading block: badge, H2, and supporting paragraphs. */
export function SectionHeader({
  badge,
  heading,
  supportingCopy,
  headingId,
  align = "center",
  className,
}: {
  badge: string;
  heading: string;
  supportingCopy?: readonly string[];
  headingId: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl text-left",
        className,
      )}
    >
      <Reveal>
        <SectionBadge>{badge}</SectionBadge>
      </Reveal>
      <Reveal delay={0.05}>
        <h2
          id={headingId}
          className="landing-serif mt-5 text-[26px] font-semibold leading-[1.15] text-white sm:text-4xl md:text-[42px]"
        >
          {heading}
        </h2>
      </Reveal>
      {supportingCopy?.length ? (
        <Reveal delay={0.1}>
          <div
            className={cn(
              "mt-5 space-y-2.5 text-[15px] leading-[1.75] text-[var(--solace-ds-text-muted)] sm:text-base",
              align === "center" && "mx-auto",
            )}
          >
            {supportingCopy.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </Reveal>
      ) : null}
    </div>
  );
}

/** Supporting text rendered beneath a primary CTA. */
export function CtaSupportingText({ children }: { children: ReactNode }) {
  return (
    <p className="mx-auto mt-4 max-w-md text-center text-sm leading-relaxed text-[var(--solace-ds-text-muted)]">
      {children}
    </p>
  );
}

/**
 * Cinematic section backdrop: a lazily-loaded plate under the shared gradient
 * scrim so text keeps AA contrast regardless of the underlying image.
 */
export function SectionBackdrop({
  src,
  className,
  overlayClassName,
  eager = false,
}: {
  src: string;
  className?: string;
  overlayClassName?: string;
  eager?: boolean;
}) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <img
        src={src}
        alt=""
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        width={2400}
        height={1350}
        className="h-full w-full object-cover object-center"
      />
      <div
        className={cn(
          "absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,22,0.82)_0%,rgba(5,8,22,0.9)_55%,rgba(5,8,22,0.96)_100%)]",
          overlayClassName,
        )}
      />
    </div>
  );
}
