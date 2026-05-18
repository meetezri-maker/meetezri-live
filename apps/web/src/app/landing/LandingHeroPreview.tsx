import type { ReactNode } from "react";
import { motion } from "motion/react";
import {
  Mic,
  MicOff,
  Video,
  PhoneOff,
  Smile,
  Wind,
  Sprout,
  Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SolaceProgressRing } from "@/app/solace/SolaceProgressRing";

interface MiniCardProps {
  className?: string;
  children: ReactNode;
  delayClass?: string;
}

function MiniCard({ className, children, delayClass }: MiniCardProps) {
  return (
    <motion.div
      className={cn(
        "landing-glass landing-glow-purple w-[148px] p-3 sm:w-[156px]",
        delayClass,
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

export function LandingHeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[520px] lg:max-w-none">
      {/* Main companion connection card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.25 }}
        className="landing-glass landing-glow-pink relative z-10 mx-auto w-full max-w-[300px] overflow-hidden sm:max-w-[320px]"
      >
        <div className="relative aspect-[3/4] min-h-[360px] w-full overflow-hidden">
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_30%,rgba(168,85,247,0.35)_0%,transparent_55%),radial-gradient(ellipse_at_70%_80%,rgba(236,72,153,0.2)_0%,transparent_50%),linear-gradient(180deg,#12101f_0%,#070a14_55%,#050816_100%)]"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_35%,rgba(244,114,182,0.18)_0%,transparent_60%)]"
            aria-hidden
          />
          {/* Abstract companion presence — cinematic portrait lighting, no stock photo */}
          <div
            className="absolute left-1/2 top-[18%] h-[52%] w-[58%] -translate-x-1/2 rounded-[40%] bg-[radial-gradient(ellipse_at_50%_30%,rgba(255,255,255,0.12)_0%,rgba(168,85,247,0.08)_40%,transparent_70%)] shadow-[inset_0_-20px_60px_rgba(0,0,0,0.5)]"
            aria-hidden
          />
          <div
            className="absolute left-1/2 top-[22%] h-[44%] w-[46%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_50%_35%,rgba(236,72,153,0.15),transparent_65%)] blur-sm"
            aria-hidden
          />

          <div className="absolute left-4 top-4 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
            </span>
            <span className="text-xs font-medium tracking-wide text-white/90">Live</span>
          </div>

          <div className="absolute inset-x-4 bottom-[72px]">
            <p className="rounded-2xl border border-white/[0.08] bg-black/35 px-4 py-3 text-sm leading-relaxed text-white/85 backdrop-blur-md">
              I&apos;m here with you. Let&apos;s take it one moment at a time…
            </p>
          </div>

          <motion.div
            className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 border-t border-white/[0.06] bg-black/40 px-4 py-4 backdrop-blur-md"
            aria-label="Session controls"
          >
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/80 transition-colors hover:border-white/20 hover:bg-white/10"
              aria-label="Mute microphone"
            >
              <MicOff className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/80 transition-colors hover:border-white/20 hover:bg-white/10"
              aria-label="Toggle video"
            >
              <Video className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500/90 text-white shadow-[0_0_24px_rgba(239,68,68,0.45)] transition-transform hover:scale-[1.03]"
              aria-label="End session"
            >
              <PhoneOff className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/80 transition-colors hover:border-white/20 hover:bg-white/10"
              aria-label="Microphone"
            >
              <Mic className="h-4 w-4" />
            </button>
          </motion.div>
        </div>
      </motion.div>

      {/* Mobile: stacked wellness cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:hidden">
        <MiniCard className="landing-glow-cyan relative w-full" delayClass="">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-cyan-200/70">
              Mood
            </span>
            <Smile className="h-4 w-4 text-cyan-300/90" />
          </div>
          <p className="text-base font-semibold text-white">Calm</p>
        </MiniCard>
        <MiniCard className="landing-glow-purple relative w-full" delayClass="">
          <div className="mb-1 flex items-center gap-1.5">
            <Wind className="h-3.5 w-3.5 text-violet-300/90" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-violet-200/70">
              Breathing
            </span>
          </div>
          <p className="text-sm font-semibold text-white">4:30</p>
        </MiniCard>
        <MiniCard className="landing-glow-pink relative w-full" delayClass="">
          <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-200/70">
            Weekly Progress
          </p>
          <p className="text-sm font-semibold text-white">Growing</p>
        </MiniCard>
        <MiniCard className="landing-glow-amber relative w-full" delayClass="">
          <p className="text-[11px] text-white/80">Daily Reflection</p>
          <p className="mt-1 text-[10px] italic text-[var(--solace-ds-text-muted)]">
            &ldquo;One breath at a time.&rdquo;
          </p>
        </MiniCard>
      </div>

      {/* Floating wellness mini-cards — desktop */}
      <MiniCard
        className="landing-glow-cyan absolute -right-1 top-8 z-20 hidden sm:block lg:right-0"
        delayClass="landing-float"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wider text-cyan-200/70">
            Mood
          </span>
          <Smile className="h-4 w-4 text-cyan-300/90" />
        </div>
        <p className="text-lg font-semibold text-white">Calm</p>
        <div className="mt-2 flex h-8 items-end gap-0.5">
          {[40, 55, 48, 62, 58, 70].map((h, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full bg-gradient-to-t from-cyan-500/30 to-cyan-300/90"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </MiniCard>

      <MiniCard
        className="landing-glow-purple absolute -right-2 top-[42%] z-20 hidden sm:block"
        delayClass="landing-float landing-float-delay-1"
      >
        <div className="mb-1 flex items-center gap-1.5">
          <Wind className="h-3.5 w-3.5 text-violet-300/90" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-violet-200/70">
            Breathing
          </span>
        </div>
        <div className="flex items-center justify-center py-1">
          <SolaceProgressRing value={72} size={64} strokeWidth={6}>
            <span className="text-xs font-semibold text-white">4:30</span>
          </SolaceProgressRing>
        </div>
      </MiniCard>

      <MiniCard
        className="landing-glow-pink absolute -left-2 bottom-[28%] z-20 hidden md:block"
        delayClass="landing-float landing-float-delay-2"
      >
        <div className="mb-1 flex items-center gap-1.5">
          <Sprout className="h-3.5 w-3.5 text-emerald-300/90" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-200/70">
            Weekly
          </span>
        </div>
        <p className="text-sm font-semibold text-white">Growing</p>
        <p className="mt-0.5 text-[10px] text-[var(--solace-ds-text-muted)]">Progress</p>
      </MiniCard>

      <MiniCard
        className="landing-glow-amber absolute -right-1 bottom-4 z-20 hidden sm:block lg:right-2"
        delayClass="landing-float landing-float-delay-3"
      >
        <Quote className="mb-1.5 h-4 w-4 text-amber-300/80" />
        <p className="text-[11px] leading-snug text-white/80">
          Daily Reflection
        </p>
        <p className="mt-1 text-[10px] italic leading-relaxed text-[var(--solace-ds-text-muted)]">
          &ldquo;One breath at a time.&rdquo;
        </p>
      </MiniCard>
    </div>
  );
}
