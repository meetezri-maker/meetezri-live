import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/app/components/ui/utils";
import { TUNE_STATES, type TuneStateId } from "./constants";

type TuneMindPanelProps = {
  selected: TuneStateId;
  onSelect: (id: TuneStateId) => void;
  reducedMotion: boolean;
  /** Slows orb breathing when Tune My Mind / deep mode soften motion. */
  animationSlowFactor?: number;
};

const TUNE_ORDER: TuneStateId[] = ["clear", "gentle", "focused", "light"];

const TUNE_STATE_CONFIG: Record<
  TuneStateId,
  {
    helperText: string;
    ambientClass: string;
    localGlowClass: string;
    haloClass: string;
    orbClass: string;
    orbScale: number;
    pulse: [number, number, number];
    driftY: [number, number, number];
    duration: number;
  }
> = {
  clear: {
    helperText: "Make space for clearer thought.",
    ambientClass: "from-sky-100/40 via-background/80 to-cyan-100/25 dark:from-sky-950/25 dark:via-slate-900/80 dark:to-cyan-950/20",
    localGlowClass: "from-sky-400/10 to-cyan-300/8",
    haloClass: "bg-sky-400/30",
    orbClass: "from-sky-200/90 to-cyan-300/80 dark:from-sky-600/50 dark:to-cyan-700/40",
    orbScale: 0.98,
    pulse: [0.98, 1, 0.98],
    driftY: [0, -2, 0],
    duration: 6.6,
  },
  gentle: {
    helperText: "Ease the pace without forcing anything.",
    ambientClass: "from-background/90 via-background/70 to-muted/30 dark:from-slate-950/90 dark:via-slate-900/80 dark:to-slate-950/70",
    localGlowClass: "from-primary/10 to-fuchsia-300/8",
    haloClass: "bg-primary/25",
    orbClass: "from-primary/40 to-fuchsia-400/30",
    orbScale: 1,
    pulse: [1, 1.03, 1],
    driftY: [0, -4, 0],
    duration: 8,
  },
  focused: {
    helperText: "Bring your attention back, softly.",
    ambientClass: "from-violet-100/30 via-background/80 to-slate-100/25 dark:from-violet-950/20 dark:via-slate-900/85 dark:to-slate-950/75",
    localGlowClass: "from-violet-500/10 to-slate-400/10",
    haloClass: "bg-violet-500/25",
    orbClass: "from-violet-400/50 to-primary/35",
    orbScale: 0.96,
    pulse: [0.96, 0.985, 0.96],
    driftY: [0, -1.5, 0],
    duration: 5.2,
  },
  light: {
    helperText: "Let the heaviness loosen a little.",
    ambientClass: "from-amber-50/45 via-background/80 to-rose-50/30 dark:from-amber-950/20 dark:via-slate-900/80 dark:to-rose-950/20",
    localGlowClass: "from-amber-300/15 to-rose-300/12",
    haloClass: "bg-amber-200/40 dark:bg-amber-500/15",
    orbClass: "from-amber-100/90 to-rose-100/70 dark:from-amber-900/40 dark:to-rose-900/30",
    orbScale: 1.03,
    pulse: [1.03, 1.055, 1.03],
    driftY: [0, -6, 0],
    duration: 8.6,
  },
};

export function TuneMindPanel({ selected, onSelect, reducedMotion, animationSlowFactor = 1 }: TuneMindPanelProps) {
  const sf = animationSlowFactor;
  const [autoCyclePaused, setAutoCyclePaused] = useState(false);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [demoState, setDemoState] = useState<TuneStateId | null>(null);
  const [hoverPreview, setHoverPreview] = useState<TuneStateId | null>(null);
  const [canHoverPreview, setCanHoverPreview] = useState(false);

  const visualVariant = hoverPreview ?? demoState ?? selected;
  const visualConfig = TUNE_STATE_CONFIG[visualVariant];
  const helperText = TUNE_STATE_CONFIG[visualVariant].helperText;
  const meta = TUNE_STATES.find((t) => t.id === visualVariant) ?? TUNE_STATES[1];

  // TODO(ai): allow recommendation engine to seed initial preferred state.
  // TODO(ai): allow dynamic helper copy based on user emotional context.
  // TODO(ai): allow model-driven visual personalization intensity.

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setCanHoverPreview(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (autoCyclePaused || userHasInteracted || TUNE_ORDER.length < 2) return;
    const id = window.setInterval(() => {
      setDemoState((current) => {
        const base = current ?? selected;
        const idx = TUNE_ORDER.indexOf(base);
        return TUNE_ORDER[(idx + 1) % TUNE_ORDER.length] ?? "gentle";
      });
    }, 6200);
    return () => window.clearInterval(id);
  }, [autoCyclePaused, selected, userHasInteracted]);

  useEffect(() => {
    if (userHasInteracted) {
      setDemoState(null);
    }
  }, [selected, userHasInteracted]);

  const handleSelect = (id: TuneStateId) => {
    setUserHasInteracted(true);
    setAutoCyclePaused(true);
    setDemoState(null);
    setHoverPreview(null);
    onSelect(id);
  };

  const handleHoverStart = (id: TuneStateId) => {
    if (!canHoverPreview || userHasInteracted || reducedMotion) return;
    setHoverPreview(id);
  };

  const handleHoverEnd = () => {
    if (!canHoverPreview || userHasInteracted || reducedMotion) return;
    setHoverPreview(null);
  };

  const ambientClass = useMemo(
    () =>
      cn(
        "scroll-mt-24 rounded-[28px] border border-primary/10 bg-gradient-to-br p-6 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.25)] backdrop-blur-xl transition-[background,box-shadow] duration-[900ms] ease-[cubic-bezier(0.4,0,0.2,1)] md:p-8 lg:p-10",
        visualConfig.ambientClass
      ),
    [visualConfig.ambientClass]
  );

  return (
    <section
      id="brain-tune"
      className={ambientClass}
      aria-labelledby="tune-heading"
    >
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
        {/* Visual tuner — left ~7 cols */}
        <div className="relative flex min-h-[280px] items-center justify-center lg:col-span-7">
          <div
            className={cn(
              "pointer-events-none absolute inset-0 rounded-[22px] bg-gradient-to-br transition-all duration-[1000ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
              visualConfig.localGlowClass
            )}
          />
          <motion.div
            className="relative flex h-56 w-56 items-center justify-center md:h-64 md:w-64"
            animate={
              reducedMotion
                ? { scale: visualConfig.orbScale, y: 0 }
                : {
                    scale: visualConfig.pulse,
                    y: visualConfig.driftY,
                  }
            }
            transition={
              reducedMotion
                ? { duration: 0.55 }
                : {
                    duration: visualConfig.duration * sf,
                    repeat: Infinity,
                    ease: [0.4, 0, 0.2, 1],
                  }
            }
          >
            {/* Outer halo */}
            <div
              className={cn(
                "absolute inset-0 rounded-full opacity-60 blur-2xl transition-all duration-[850ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
                visualConfig.haloClass
              )}
            />
            {/* Orb */}
            <div
              className={cn(
                "relative h-40 w-40 rounded-full bg-gradient-to-br shadow-[0_0_60px_-10px_rgba(0,0,0,0.2)] transition-all duration-[850ms] ease-[cubic-bezier(0.4,0,0.2,1)] md:h-44 md:w-44",
                visualConfig.orbClass
              )}
            >
              <div className="absolute inset-6 rounded-full bg-white/25 blur-xl dark:bg-white/10" />
              <span className="relative z-10 text-center text-[13px] font-medium text-foreground/90">
                {meta.label}
              </span>
            </div>
          </motion.div>

          {/* Draggable-feel slider alternative: simple arc of dots */}
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-3 opacity-60" aria-hidden>
            {TUNE_STATES.map((t) => (
              <span
                key={t.id}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-all",
                  t.id === visualVariant ? "scale-125 bg-primary" : "bg-muted-foreground/40"
                )}
              />
            ))}
          </div>
        </div>

        {/* Copy + presets */}
        <div className="flex flex-col justify-center lg:col-span-5">
          <h2 id="tune-heading" className="text-[clamp(1.375rem,3vw,2.25rem)] font-semibold leading-[1.15] tracking-tight text-foreground">
            Shift the atmosphere, not the pressure.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground md:text-[16px] md:leading-[1.6]">
            A small change in pace, tone, and rhythm can help everything feel easier.
          </p>

          <div
            className="mt-8 flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="Atmosphere preset"
          >
            {TUNE_STATES.map((t) => {
              const isOn = t.id === selected;
              return (
                <motion.button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={isOn}
                  aria-pressed={isOn}
                  whileHover={reducedMotion ? undefined : { scale: 1.02 }}
                  whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                  onMouseEnter={() => handleHoverStart(t.id)}
                  onMouseLeave={handleHoverEnd}
                  onFocus={() => handleHoverStart(t.id)}
                  onBlur={handleHoverEnd}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => handleSelect(t.id)}
                  className={cn(
                    "rounded-full border px-5 py-2.5 text-[14px] font-medium transition-[box-shadow,background-color,color,border-color] duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isOn
                      ? "border-primary bg-primary/15 text-foreground ring-1 ring-primary/25 shadow-md shadow-primary/15"
                      : "border-border/60 bg-background/50 text-muted-foreground hover:border-primary/30 hover:text-foreground hover:shadow-sm"
                  )}
                >
                  {t.label}
                </motion.button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={helperText}
              className="mt-6 text-[13px] leading-relaxed text-muted-foreground/90 italic md:text-[14px]"
              initial={reducedMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: reducedMotion ? 0.2 : 0.34, ease: [0.4, 0, 0.2, 1] }}
            >
              {helperText || meta.copyHint}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
