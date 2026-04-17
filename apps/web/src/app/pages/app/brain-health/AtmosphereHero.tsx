import { motion } from "motion/react";
import { cn } from "@/app/components/ui/utils";
import type { TuneStateId } from "./constants";

type AtmosphereHeroProps = {
  tuneState: TuneStateId;
  deepMode: boolean;
  reducedMotion: boolean;
  /** >1 slows ambient drift (e.g. after Tune My Mind or deep mode). */
  animationSlowFactor?: number;
  tuneMindHelperLine?: string | null;
  onTuneClick: () => void;
  onRhythmClick: () => void;
};

const tuneAura: Record<TuneStateId, string> = {
  clear:
    "from-sky-400/25 via-cyan-300/15 to-indigo-400/20 dark:from-sky-500/20 dark:via-cyan-500/10 dark:to-indigo-500/15",
  gentle:
    "from-primary/25 via-fuchsia-400/10 to-teal-400/15 dark:from-primary/15 dark:via-fuchsia-500/10 dark:to-teal-500/10",
  focused:
    "from-violet-400/20 via-primary/15 to-slate-400/15 dark:from-violet-500/15 dark:via-primary/12 dark:to-slate-500/10",
  light:
    "from-amber-200/25 via-rose-200/15 to-sky-200/20 dark:from-amber-500/12 dark:via-rose-500/8 dark:to-sky-500/12",
};

export function AtmosphereHero({
  tuneState,
  deepMode,
  reducedMotion,
  animationSlowFactor = 1,
  tuneMindHelperLine = null,
  onTuneClick,
  onRhythmClick,
}: AtmosphereHeroProps) {
  const slow = animationSlowFactor * (deepMode ? 1.35 : 1);
  const driftL = 12 * slow;
  const driftR = 14 * slow;

  return (
    <section
      className={cn(
        "relative isolate min-h-[360px] overflow-hidden rounded-[28px] border border-primary/10 bg-gradient-to-br shadow-[0_0_80px_-24px] shadow-primary/25 md:min-h-[420px] lg:min-h-[min(480px,52vh)]",
        "from-slate-50 via-white to-slate-100/90 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950",
        deepMode && "shadow-[0_0_100px_-28px] shadow-indigo-500/20 ring-1 ring-indigo-400/25 dark:shadow-indigo-400/15"
      )}
      aria-labelledby="brain-hero-heading"
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90 transition-all duration-[1000ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
          tuneAura[tuneState]
        )}
      />

      {!reducedMotion && (
        <>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -left-1/4 top-0 h-[120%] w-1/2 rounded-full bg-gradient-to-r from-primary/15 to-transparent blur-3xl"
            animate={{ x: [0, 24, 0], opacity: [0.35, 0.5, 0.35] }}
            transition={{ duration: driftL, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-1/4 bottom-0 h-[110%] w-1/2 rounded-full bg-gradient-to-l from-primary/10 to-transparent blur-3xl"
            animate={{ x: [0, -20, 0], opacity: [0.25, 0.42, 0.25] }}
            transition={{ duration: driftR, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-white/60 shadow-[0_0_8px_rgba(255,255,255,0.8)] dark:bg-white/30"
            style={{
              left: `${8 + (i * 7) % 84}%`,
              top: `${12 + (i * 11) % 76}%`,
              opacity: 0.35 + (i % 5) * 0.08,
              animation: reducedMotion
                ? undefined
                : `bh-float ${(10 + (i % 5)) * slow}s ease-in-out ${i * 0.4}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex min-h-[360px] flex-col justify-center px-6 py-10 md:min-h-[420px] md:px-10 md:py-12 lg:min-h-[480px]">
        <p className="mb-3 text-center text-[12px] font-medium uppercase tracking-[0.16em] text-muted-foreground md:text-left md:text-[13px]">
          brain health
        </p>
        <h1
          id="brain-hero-heading"
          className="text-center text-[clamp(1.875rem,5vw,3.75rem)] font-semibold leading-[1.08] tracking-tight text-foreground md:text-left"
        >
          A softer space for your mind.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-[15px] leading-relaxed text-muted-foreground md:mx-0 md:text-left md:text-[17px] md:leading-[1.55]">
          A calm environment that helps your mind settle, reset, and find a better rhythm.
        </p>

        <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:justify-start">
          <motion.button
            type="button"
            whileHover={reducedMotion ? undefined : { scale: 1.02 }}
            whileTap={reducedMotion ? undefined : { scale: 0.97 }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onTuneClick}
            className={cn(
              "rounded-full bg-primary px-8 py-3.5 text-[15px] font-medium text-primary-foreground shadow-lg shadow-primary/35 transition-[box-shadow,transform] duration-300 ease-out hover:shadow-xl hover:shadow-primary/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
            aria-label="Tune my mind"
          >
            Tune My Mind
          </motion.button>
          <motion.button
            type="button"
            whileHover={reducedMotion ? undefined : { scale: 1.02 }}
            whileTap={reducedMotion ? undefined : { scale: 0.97 }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRhythmClick}
            className={cn(
              "rounded-full border border-primary/25 bg-background/60 px-8 py-3.5 text-[15px] font-medium text-foreground backdrop-blur-md transition-[background,box-shadow] duration-300 ease-out hover:bg-background/80 hover:shadow-md",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
            aria-label="See my rhythm"
          >
            See My Rhythm
          </motion.button>
        </div>

        {tuneMindHelperLine ? (
          <motion.p
            role="status"
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="mt-8 text-center text-[14px] font-medium leading-relaxed text-primary/90 md:text-left"
          >
            {tuneMindHelperLine}
          </motion.p>
        ) : null}
      </div>

      <style>{`
        @keyframes bh-float {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(6px, -10px); }
        }
      `}</style>
    </section>
  );
}
