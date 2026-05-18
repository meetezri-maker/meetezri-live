import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/app/components/ui/utils";
import { THOUGHT_BUBBLE_PLACEHOLDERS } from "./constants";

type ThoughtBubbleCanvasProps = {
  items: readonly string[];
  dismissed: Set<string>;
  onDismiss: (text: string) => void;
  reducedMotion: boolean;
  animationSlowFactor?: number;
};

export function ThoughtBubbleCanvas({
  items,
  dismissed,
  onDismiss,
  reducedMotion,
  animationSlowFactor = 1,
}: ThoughtBubbleCanvasProps) {
  const sf = animationSlowFactor;
  const visible = items.filter((t) => !dismissed.has(t));

  return (
    <section
      className="relative min-h-[280px] overflow-hidden rounded-[28px] border border-primary/10 bg-gradient-to-b from-muted/20 to-transparent py-10 md:min-h-[320px] lg:min-h-[360px]"
      aria-label="Floating thoughts — tap to let one drift away"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[15%] top-[8%] h-44 w-44 rounded-full bg-primary/15 blur-3xl md:h-56 md:w-56" />
        <div className="absolute bottom-[10%] right-[12%] h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative mx-auto min-h-[260px] max-w-4xl px-4 md:min-h-[300px]">
        <AnimatePresence>
          {visible.map((text, i) => (
            <motion.button
              key={text}
              type="button"
              layout
              initial={reducedMotion ? false : { opacity: 0, scale: 0.92 }}
              animate={
                reducedMotion
                  ? { opacity: 1 }
                  : {
                      opacity: 1,
                      scale: 1,
                      y: [0, -6, 0],
                    }
              }
              transition={{
                opacity: { duration: 0.4 },
                y: { duration: (8 + (i % 3) * 1.2) * sf, repeat: Infinity, ease: "easeInOut" },
              }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85, filter: "blur(8px)" }}
              whileHover={reducedMotion ? undefined : { scale: 1.05 }}
              whileTap={reducedMotion ? undefined : { scale: 0.97 }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onDismiss(text)}
              className={cn(
                "absolute max-w-[min(100%,280px)] rounded-[18px] border border-white/40 bg-background/70 px-4 py-3 text-left text-[14px] leading-snug text-foreground shadow-lg backdrop-blur-md transition-shadow hover:shadow-xl dark:border-white/10 dark:bg-slate-900/65",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              style={{
                left: `${(i * 17 + 8) % 72}%`,
                top: `${(i * 23 + 5) % 55}%`,
              }}
              aria-label={`Thought: ${text}. Tap to let it drift away.`}
            >
              {text}
            </motion.button>
          ))}
        </AnimatePresence>

        {visible.length === 0 && (
          <p className="relative z-10 py-16 text-center text-[15px] text-muted-foreground">
            A little more room to breathe.
          </p>
        )}
      </div>
    </section>
  );
}
