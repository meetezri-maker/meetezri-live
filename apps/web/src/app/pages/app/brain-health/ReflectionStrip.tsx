import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/app/components/ui/utils";
import { REFLECTION_PLACEHOLDERS } from "./constants";

type ReflectionStripProps = {
  activeIndex: number;
  onSelect: (index: number) => void;
  reducedMotion: boolean;
  /** Future: swap for AI-driven lines */
  lines?: readonly string[];
};

export function ReflectionStrip({
  activeIndex,
  onSelect,
  reducedMotion,
  lines = REFLECTION_PLACEHOLDERS,
}: ReflectionStripProps) {
  const current = lines[activeIndex] ?? lines[0];

  return (
    <section
      className="flex min-h-[120px] flex-col items-center justify-center md:min-h-[140px] lg:min-h-[160px]"
      aria-label="Gentle reflections"
    >
      <div className="relative w-full max-w-3xl rounded-[22px] border border-primary/10 bg-background/50 px-5 py-6 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-md dark:bg-slate-900/40">
        <AnimatePresence mode="wait">
          <motion.p
            key={current}
            role="status"
            aria-live="polite"
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: reducedMotion ? 0 : 0.45 }}
            className="text-[15px] font-medium leading-relaxed text-foreground md:text-[16px]"
          >
            {current}
          </motion.p>
        </AnimatePresence>

        <div
          className="mt-5 flex justify-center gap-2"
          role="tablist"
          aria-label="Choose a reflection"
        >
          {lines.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`Reflection ${i + 1}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onSelect(i)}
              className={cn(
                "h-2.5 min-w-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === activeIndex
                  ? "w-8 bg-primary"
                  : "bg-muted-foreground/35 hover:bg-muted-foreground/55"
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
