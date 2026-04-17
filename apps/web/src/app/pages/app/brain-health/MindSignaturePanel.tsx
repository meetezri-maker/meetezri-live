import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/app/components/ui/utils";
import type { TuneStateId } from "./constants";

type SignatureVariant = 1 | 2 | 3;

type MindSignaturePanelProps = {
  variant: SignatureVariant;
  onVariantChange: (v: SignatureVariant) => void;
  tuneState: TuneStateId;
  reducedMotion: boolean;
};

const SIGNATURE_VARIANT_CONFIG: Record<
  SignatureVariant,
  {
    id: "soft" | "balanced" | "clear";
    label: string;
    insights: readonly string[];
    duration: number;
    glowClass: string;
  }
> = {
  1: {
    id: "soft",
    label: "Soft",
    insights: [
      "Settles best when things feel unhurried",
      "Finds ease in softer transitions",
      "Opens up with less internal pressure",
    ],
    duration: 9.2,
    glowClass: "shadow-[0_0_60px_-22px_rgba(236,72,153,0.35)]",
  },
  2: {
    id: "balanced",
    label: "Balanced",
    insights: [
      "Clearer in slower moments",
      "Responds well to softer pacing",
      "Feels lighter with less visual noise",
    ],
    duration: 8.2,
    glowClass: "shadow-[0_0_60px_-22px_rgba(79,70,229,0.28)]",
  },
  3: {
    id: "clear",
    label: "Clear",
    insights: [
      "Finds rhythm when the noise pulls back",
      "Responds well to calm structure",
      "Feels steadier with less mental clutter",
    ],
    duration: 7.1,
    glowClass: "shadow-[0_0_60px_-22px_rgba(56,189,248,0.35)]",
  },
};

function SignatureGraphic({
  variant,
  className,
  reducedMotion,
  motionPaused,
  isHovered,
}: {
  variant: SignatureVariant;
  className?: string;
  reducedMotion: boolean;
  motionPaused: boolean;
  isHovered: boolean;
}) {
  const common = "text-primary/80 dark:text-primary/70";
  const motionEnabled = !reducedMotion && !motionPaused;
  const cfg = SIGNATURE_VARIANT_CONFIG[variant];

  if (variant === 1) {
    return (
      <motion.svg
        viewBox="0 0 320 200"
        className={cn("h-full w-full", common, className)}
        aria-hidden
        animate={motionEnabled ? { scale: [1, 1.012, 1], opacity: [0.9, isHovered ? 1 : 0.97, 0.9] } : undefined}
        transition={motionEnabled ? { duration: cfg.duration, repeat: Infinity, ease: "easeInOut" } : undefined}
      >
        <motion.path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
          d="M20 120 Q80 40 160 100 T300 80"
          opacity="0.85"
          animate={motionEnabled ? { d: ["M20 120 Q80 40 160 100 T300 80", "M20 118 Q78 45 160 102 T300 84", "M20 120 Q80 40 160 100 T300 80"] } : undefined}
          transition={motionEnabled ? { duration: cfg.duration + 0.8, repeat: Infinity, ease: "easeInOut" } : undefined}
        />
        <motion.path
          fill="none"
          stroke="currentColor"
          strokeWidth="0.95"
          strokeLinecap="round"
          d="M40 150 Q120 100 200 130 T280 110"
          opacity="0.45"
          animate={motionEnabled ? { d: ["M40 150 Q120 100 200 130 T280 110", "M40 146 Q120 102 200 128 T280 112", "M40 150 Q120 100 200 130 T280 110"] } : undefined}
          transition={motionEnabled ? { duration: cfg.duration + 1.2, repeat: Infinity, ease: "easeInOut" } : undefined}
        />
      </motion.svg>
    );
  }
  if (variant === 2) {
    return (
      <motion.svg
        viewBox="0 0 320 200"
        className={cn("h-full w-full", common, className)}
        aria-hidden
        animate={motionEnabled ? { opacity: [0.88, isHovered ? 1 : 0.96, 0.88] } : undefined}
        transition={motionEnabled ? { duration: cfg.duration, repeat: Infinity, ease: "easeInOut" } : undefined}
      >
        <motion.circle
          cx="160"
          cy="100"
          r="72"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          opacity="0.35"
          animate={motionEnabled ? { r: [71, 73, 71] } : undefined}
          transition={motionEnabled ? { duration: cfg.duration + 0.5, repeat: Infinity, ease: "easeInOut" } : undefined}
        />
        <motion.path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          d="M60 100 C100 40 220 40 260 100 S220 170 160 155 S60 140 60 100"
          opacity="0.9"
          animate={motionEnabled ? { d: ["M60 100 C100 40 220 40 260 100 S220 170 160 155 S60 140 60 100", "M60 100 C104 44 216 44 260 100 S220 168 160 153 S64 140 60 100", "M60 100 C100 40 220 40 260 100 S220 170 160 155 S60 140 60 100"] } : undefined}
          transition={motionEnabled ? { duration: cfg.duration + 0.9, repeat: Infinity, ease: "easeInOut" } : undefined}
        />
      </motion.svg>
    );
  }
  return (
    <motion.svg
      viewBox="0 0 320 200"
      className={cn("h-full w-full", common, className)}
      aria-hidden
      animate={motionEnabled ? { opacity: [0.85, isHovered ? 1 : 0.94, 0.85] } : undefined}
      transition={motionEnabled ? { duration: cfg.duration, repeat: Infinity, ease: "easeInOut" } : undefined}
    >
      <motion.path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        d="M30 100 L90 60 L150 110 L210 50 L270 95 L300 70"
        opacity="0.75"
        animate={motionEnabled ? { d: ["M30 100 L90 60 L150 110 L210 50 L270 95 L300 70", "M30 100 L90 62 L150 108 L210 54 L270 92 L300 72", "M30 100 L90 60 L150 110 L210 50 L270 95 L300 70"] } : undefined}
        transition={motionEnabled ? { duration: cfg.duration + 0.6, repeat: Infinity, ease: "easeInOut" } : undefined}
      />
      <motion.path
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
        d="M50 140 L270 140"
        opacity="0.25"
        animate={motionEnabled ? { opacity: [0.22, isHovered ? 0.36 : 0.28, 0.22] } : undefined}
        transition={motionEnabled ? { duration: cfg.duration + 1.1, repeat: Infinity, ease: "easeInOut" } : undefined}
      />
    </motion.svg>
  );
}

export function MindSignaturePanel({ variant, onVariantChange, tuneState, reducedMotion }: MindSignaturePanelProps) {
  const [signatureAutoRotatePaused, setSignatureAutoRotatePaused] = useState(false);
  const [userHasInteractedWithSignature, setUserHasInteractedWithSignature] = useState(false);
  const [visualHovering, setVisualHovering] = useState(false);
  const [signatureMotionPaused, setSignatureMotionPaused] = useState(false);
  const activeConfig = SIGNATURE_VARIANT_CONFIG[variant];

  // TODO(ai): use model-selected signature variant and confidence-aware transition pacing.
  // TODO(ai): replace static insight copy with personalized AI-generated rhythm insights.

  useEffect(() => {
    if (signatureAutoRotatePaused || userHasInteractedWithSignature || reducedMotion) return;
    const rotate = window.setInterval(() => {
      onVariantChange((variant % 3) + 1 as SignatureVariant);
    }, 7000);
    return () => window.clearInterval(rotate);
  }, [onVariantChange, reducedMotion, signatureAutoRotatePaused, userHasInteractedWithSignature, variant]);

  const handleVariantSelect = (v: SignatureVariant) => {
    setSignatureAutoRotatePaused(true);
    setUserHasInteractedWithSignature(true);
    onVariantChange(v);
  };

  const signatureVisualClass = useMemo(
    () =>
      cn(
        "relative flex min-h-[220px] items-center justify-center rounded-[22px] border border-primary/10 bg-gradient-to-br p-6 transition-[box-shadow,background] duration-[950ms] ease-[cubic-bezier(0.4,0,0.2,1)] md:min-h-[260px] lg:min-h-[300px]",
        tuneState === "light" && "from-amber-50/50 to-transparent dark:from-amber-950/20",
        tuneState === "gentle" && "from-primary/5 to-transparent",
        tuneState === "clear" && "from-sky-50/60 to-transparent dark:from-sky-950/20",
        tuneState === "focused" && "from-violet-50/50 to-transparent dark:from-violet-950/25",
        activeConfig.glowClass,
        visualHovering && "shadow-[0_0_80px_-26px_rgba(99,102,241,0.45)]"
      ),
    [activeConfig.glowClass, tuneState, visualHovering]
  );

  return (
    <section
      id="brain-signature"
      className="scroll-mt-24 grid grid-cols-1 gap-10 rounded-[28px] border border-primary/10 bg-background/60 p-6 backdrop-blur-md dark:bg-slate-950/50 md:p-8 lg:grid-cols-2 lg:gap-12 lg:p-10"
      aria-labelledby="signature-heading"
    >
      <div
        className={signatureVisualClass}
        onMouseEnter={() => setVisualHovering(true)}
        onMouseLeave={() => setVisualHovering(false)}
        onClick={() => {
          setSignatureAutoRotatePaused(true);
          setUserHasInteractedWithSignature(true);
          setSignatureMotionPaused((v) => !v);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSignatureAutoRotatePaused(true);
            setUserHasInteractedWithSignature(true);
            setSignatureMotionPaused((v) => !v);
          }
        }}
        aria-label="Rhythm signature visual area"
        aria-pressed={signatureMotionPaused}
      >
        <div className="h-40 w-full max-w-sm md:h-48">
          <SignatureGraphic
            variant={variant}
            reducedMotion={reducedMotion}
            motionPaused={signatureMotionPaused}
            isHovered={visualHovering}
          />
        </div>
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {([1, 2, 3] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-label={`Preview rhythm shape ${v}`}
              aria-pressed={variant === v}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => handleVariantSelect(v)}
              className={cn(
                "h-2 w-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                variant === v ? "w-6 bg-primary" : "bg-muted-foreground/35 hover:bg-muted-foreground/50"
              )}
            />
          ))}
        </div>
        {/* TODO(ai): replace static SVG with personalized signature graphic from mindSignatureData */}
      </div>

      <div className="flex flex-col justify-center">
        <h2 id="signature-heading" className="text-[clamp(1.375rem,2.8vw,2.25rem)] font-semibold leading-[1.15] tracking-tight text-foreground">
          Your rhythm has a shape.
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground md:text-[16px] md:leading-[1.6]">
          Over time, this space can learn how your mind moves, settles, and regains clarity.
        </p>
        <p className="mt-4 text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
          {activeConfig.label} rhythm signature
        </p>
        <AnimatePresence mode="wait">
          <motion.ul
            key={`${variant}-${activeConfig.id}`}
            className="mt-8 space-y-3"
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: reducedMotion ? 0.2 : 0.42, ease: [0.4, 0, 0.2, 1] }}
          >
            {activeConfig.insights.map((line) => (
              <li
                key={line}
                className="flex items-start gap-3 text-[14px] leading-relaxed text-foreground/90 md:text-[15px]"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
                {line}
              </li>
            ))}
          </motion.ul>
        </AnimatePresence>
      </div>
    </section>
  );
}
