import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronDown, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { HERO, PRIMARY_CTA_LABEL, SECTION_IDS } from "../prelaunch.content";
import { PRELAUNCH_HERO_BG } from "../prelaunch.imagery";
import { SectionBadge } from "../PrelaunchPrimitives";
import { useFoundingMemberSignup } from "../FoundingMemberSignupContext";
import { FounderVideoModal } from "../FounderVideoModal";
import { trackPrelaunchEvent } from "../prelaunch.analytics";

/**
 * Section 1 — Hero.
 *
 * Full-screen cinematic landscape, no product screenshots. The background sits
 * behind a layered scrim so the locked headline keeps AA contrast, and its slow
 * drift is disabled entirely under `prefers-reduced-motion`.
 */
export function HeroSection() {
  const { openSignup } = useFoundingMemberSignup();
  const [videoOpen, setVideoOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const fade = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <section
      id={SECTION_IDS.hero}
      aria-labelledby="prelaunch-hero-heading"
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden pb-24 pt-28 sm:pt-32"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <motion.img
          src={PRELAUNCH_HERO_BG}
          alt=""
          // The hero plate is the one above-the-fold asset worth loading eagerly.
          loading="eager"
          decoding="async"
          width={2400}
          height={1350}
          className="h-full w-full object-cover object-[center_55%]"
          animate={reduceMotion ? undefined : { scale: [1, 1.045, 1] }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 48, repeat: Infinity, ease: "easeInOut" }
          }
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,22,0.55)_0%,rgba(5,8,22,0.68)_50%,rgba(5,8,22,0.92)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_30%,rgba(88,28,135,0.24)_0%,transparent_58%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_90%,rgba(251,191,36,0.1)_0%,transparent_40%)]" />
      </div>

      <div className="landing-section relative z-10 flex flex-col items-center gap-6 text-center sm:gap-7">
        <motion.div {...fade(0.1)}>
          <SectionBadge>{HERO.badge}</SectionBadge>
        </motion.div>

        <motion.h1
          id="prelaunch-hero-heading"
          {...fade(0.2)}
          className="landing-serif mx-auto max-w-[18ch] text-[34px] font-semibold leading-[1.08] tracking-[-0.02em] text-white sm:text-5xl md:text-6xl lg:text-[68px]"
        >
          Every conversation{" "}
          <span className="bg-gradient-to-r from-pink-200 via-fuchsia-200 to-violet-100 bg-clip-text text-transparent">
            brings you closer to yourself.
          </span>
        </motion.h1>

        <motion.div
          {...fade(0.35)}
          className="mx-auto flex max-w-2xl flex-col gap-2.5 text-[15px] leading-[1.75] text-white/85 sm:text-lg"
        >
          {HERO.supportingCopy.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </motion.div>

        <motion.div
          {...fade(0.5)}
          className="flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center"
        >
          <button
            type="button"
            onClick={() => openSignup("hero")}
            className="landing-cta-glow inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#E91E63] to-[#9C27B0] px-8 py-4 text-base font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050816] sm:w-auto"
          >
            {PRIMARY_CTA_LABEL}
          </button>

          <button
            type="button"
            onClick={() => {
              trackPrelaunchEvent("founder_video_opened", { origin: "hero" });
              setVideoOpen(true);
            }}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20",
              "bg-black/25 px-8 py-4 text-base font-semibold text-white/90 backdrop-blur-sm",
              "transition-[box-shadow,border-color] hover:border-white/35 hover:shadow-[0_0_28px_-8px_rgba(168,85,247,0.45)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:w-auto",
            )}
          >
            <Play className="h-4 w-4" aria-hidden />
            {HERO.secondaryCta}
          </button>
        </motion.div>

        <motion.p {...fade(0.6)} className="max-w-md text-sm text-white/60">
          {HERO.trustLine}
        </motion.p>
      </div>

      <motion.div
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-white/45"
        aria-hidden
        animate={reduceMotion ? undefined : { y: [0, 8, 0], opacity: [0.45, 0.8, 0.45] }}
        transition={reduceMotion ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <ChevronDown className="h-6 w-6" />
      </motion.div>

      <FounderVideoModal open={videoOpen} onOpenChange={setVideoOpen} />
    </section>
  );
}
