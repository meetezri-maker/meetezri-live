import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/app/components/ui/utils";

type GentleShiftPanelProps = {
  deepMode: boolean;
  onStay: () => void;
  onReturnLater: () => void;
  reducedMotion: boolean;
  returnLaterState?: boolean;
};

export function GentleShiftPanel({
  deepMode,
  onStay,
  onReturnLater,
  reducedMotion,
  returnLaterState = false,
}: GentleShiftPanelProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[28px] border border-primary/15 bg-gradient-to-br px-6 py-10 text-center md:px-12 md:py-12 lg:min-h-[220px]",
        "from-muted/40 via-background/80 to-primary/5 dark:from-slate-900/80 dark:via-slate-950/90 dark:to-primary/10",
        deepMode && "ring-1 ring-primary/20"
      )}
      aria-labelledby="gentle-shift-heading"
    >
      {!reducedMotion && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-[28px] bg-gradient-to-b from-primary/20 via-transparent to-transparent"
          animate={deepMode ? { opacity: [0.35, 0.55, 0.35] } : { opacity: 0.25 }}
          transition={{ duration: 10, repeat: deepMode ? Infinity : 0, ease: "easeInOut" }}
        />
      )}

      <h2
        id="gentle-shift-heading"
        className="relative z-10 text-[clamp(1.25rem,2.5vw,1.75rem)] font-semibold leading-tight tracking-tight text-foreground"
      >
        You do not need more pressure right now.
      </h2>
      <p className="relative z-10 mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground md:text-[16px]">
        A gentler rhythm can change how everything feels.
      </p>

      {deepMode && (
        <motion.p
          className="relative z-10 mt-6 text-[14px] font-medium italic text-primary/90"
          initial={reducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
        >
          Let the noise sit a little farther away.
        </motion.p>
      )}

      <div className="relative z-10 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <motion.button
          type="button"
          whileHover={reducedMotion ? undefined : { scale: 1.02 }}
          whileTap={reducedMotion ? undefined : { scale: 0.97 }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onStay}
          className="rounded-full bg-primary px-8 py-3 text-[15px] font-medium text-primary-foreground shadow-md transition-shadow duration-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-pressed={deepMode}
          aria-label="Stay in this space — deepen the atmosphere"
          data-brain-enter-deep=""
        >
          Stay in this space
        </motion.button>
        <motion.button
          type="button"
          whileHover={reducedMotion ? undefined : { scale: 1.02 }}
          whileTap={reducedMotion ? undefined : { scale: 0.97 }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onReturnLater}
          className="rounded-full border border-border/60 bg-background/60 px-8 py-3 text-[15px] font-medium text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Return later"
        >
          Return later
        </motion.button>
      </div>
      <AnimatePresence mode="wait">
        {returnLaterState ? (
          <motion.p
            key="return-later-soft-line"
            className="relative z-10 mt-5 text-[13px] text-muted-foreground/95 md:text-[14px]"
            initial={reducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            This space will be here when you need it.
          </motion.p>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
