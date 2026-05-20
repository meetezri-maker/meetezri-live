import { Link } from "react-router";
import { motion } from "motion/react";
import {
  Video,
  Heart,
  BookOpen,
  Sparkles,
  Clock,
  Shield,
  Zap,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PublicNav } from "../components/PublicNav";
import { PublicFooter } from "../components/PublicFooter";
import { LandingBackground } from "../landing/LandingBackground";
import { LandingGlowCard } from "../landing/LandingGlowCard";
import type { LandingGlowVariant } from "../landing/LandingGlowCard";
import {
  HOW_IT_WORKS_STEP_IMAGES,
  LANDING_CTA_CARD_BG,
  LANDING_HERO_BG,
} from "../landing/landingImagery";
import { cn } from "@/lib/utils";

type JourneyVisual = "lantern" | "orb" | "mood" | "journal";

interface JourneyStep {
  step: number;
  title: string;
  description: string;
  bullets: string[];
  icon: LucideIcon;
  glow: LandingGlowVariant;
  iconClass: string;
  visual: JourneyVisual;
  imageSrc?: string;
}

interface FeatureItem {
  title: string;
  description: string;
  icon: LucideIcon;
  glow: LandingGlowVariant;
  iconClass: string;
}

const JOURNEY_STEPS: JourneyStep[] = [
  {
    step: 1,
    title: "Quick & Easy Onboarding",
    description:
      "Get started in minutes. We'll ask a few questions about your wellness goals, baseline health information, and preferences. This helps Solace understand how to best support you.",
    bullets: [
      "Basic profile setup",
      "Wellness baseline assessment",
      "Emergency contact information",
    ],
    icon: Sparkles,
    glow: "pink",
    iconClass:
      "from-pink-500/90 to-fuchsia-600/90 shadow-[0_0_24px_rgba(236,72,153,0.55)]",
    visual: "lantern",
    imageSrc: HOW_IT_WORKS_STEP_IMAGES[1],
  },
  {
    step: 2,
    title: "FaceTime With Solace",
    description:
      "Connect with Solace through natural, FaceTime-style video sessions. Share how you're feeling, talk through challenges, or simply have someone to listen. Solace is always available, day or night.",
    bullets: [
      "Real-time video conversations",
      "Natural language understanding",
      "Empathetic and supportive responses",
    ],
    icon: Video,
    glow: "cyan",
    iconClass:
      "from-cyan-400/90 to-teal-500/90 shadow-[0_0_24px_rgba(34,211,238,0.5)]",
    visual: "orb",
    imageSrc: HOW_IT_WORKS_STEP_IMAGES[2],
  },
  {
    step: 3,
    title: "Track Your Wellness",
    description:
      "Monitor your emotional well-being with mood tracking, journaling, and personalized insights. See patterns emerge and celebrate your progress over time.",
    bullets: ["Daily mood check-ins", "Private journaling", "Trend analysis and insights"],
    icon: Heart,
    glow: "purple",
    iconClass:
      "from-violet-500/90 to-fuchsia-600/90 shadow-[0_0_24px_rgba(168,85,247,0.5)]",
    visual: "mood",
  },
  {
    step: 4,
    title: "Access Wellness Tools",
    description:
      "Use guided meditation, breathing exercises, and other evidence-based wellness tools. Solace can guide you through these activities during your sessions or you can access them anytime.",
    bullets: ["Guided meditations", "Breathing exercises", "Coping strategies"],
    icon: BookOpen,
    glow: "amber",
    iconClass:
      "from-amber-400/90 to-orange-500/90 shadow-[0_0_24px_rgba(251,191,36,0.45)]",
    visual: "journal",
    imageSrc: HOW_IT_WORKS_STEP_IMAGES[4],
  },
];

const KEY_FEATURES: FeatureItem[] = [
  {
    title: "24/7 Availability",
    description:
      "Connect with Solace whenever you need support, no appointments necessary",
    icon: Clock,
    glow: "pink",
    iconClass:
      "from-pink-500/90 to-fuchsia-600/90 shadow-[0_0_20px_rgba(236,72,153,0.5)]",
  },
  {
    title: "Private & Secure",
    description:
      "Your conversations are encrypted and your privacy is our top priority",
    icon: Shield,
    glow: "cyan",
    iconClass:
      "from-cyan-400/90 to-teal-500/90 shadow-[0_0_20px_rgba(34,211,238,0.45)]",
  },
  {
    title: "Instant Response",
    description:
      "Get immediate support without waiting in queues or scheduling appointments",
    icon: Zap,
    glow: "pink",
    iconClass:
      "from-fuchsia-500/90 to-violet-600/90 shadow-[0_0_20px_rgba(217,70,239,0.5)]",
  },
  {
    title: "Progress Tracking",
    description: "See your wellness journey unfold with insights and trends over time",
    icon: TrendingUp,
    glow: "amber",
    iconClass:
      "from-amber-400/90 to-orange-500/90 shadow-[0_0_20px_rgba(251,191,36,0.45)]",
  },
];

function LanternLakeVisual() {
  return (
    <motion.div
      className="relative h-full min-h-[140px] w-full overflow-hidden rounded-2xl"
      aria-hidden
      animate={{ opacity: [0.85, 1, 0.85] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_100%,rgba(34,211,238,0.12)_0%,transparent_60%),radial-gradient(ellipse_at_30%_20%,rgba(251,191,36,0.18)_0%,transparent_45%)]"
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute bottom-0 left-0 right-0 h-[42%] bg-gradient-to-t from-cyan-950/50 via-violet-950/20 to-transparent" />
      <motion.div
        className="absolute left-[28%] top-[22%] h-10 w-10 rounded-full bg-gradient-to-br from-amber-200/90 to-orange-400/80 shadow-[0_0_32px_rgba(251,191,36,0.65),0_0_60px_rgba(251,146,60,0.35)]"
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute left-[28%] top-[52%] h-8 w-16 -translate-x-1/4 rounded-[100%] bg-amber-300/20 blur-md" />
      <div className="absolute bottom-[18%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />
    </motion.div>
  );
}

function BreathingOrbVisual() {
  return (
    <div className="relative flex h-full min-h-[140px] w-full items-center justify-center" aria-hidden>
      <motion.div
        className="absolute h-28 w-28 rounded-full bg-[radial-gradient(circle_at_40%_35%,rgba(34,211,238,0.35)_0%,rgba(88,28,135,0.2)_45%,transparent_70%)]"
        animate={{ scale: [0.92, 1.08, 0.92], opacity: [0.65, 1, 0.65] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute h-20 w-20 rounded-full border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_40px_rgba(34,211,238,0.35),inset_0_0_24px_rgba(34,211,238,0.15)]"
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      />
      <motion.div
        className="absolute h-32 w-32 rounded-full border border-violet-400/15"
        animate={{ scale: [1, 1.18, 1], opacity: [0.35, 0.7, 0.35] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-cyan-200/80 to-violet-300/60 shadow-[0_0_28px_rgba(34,211,238,0.55)]" />
    </div>
  );
}

function MoodGlowLineVisual() {
  return (
    <motion.div
      className="relative flex h-full min-h-[140px] w-full items-center justify-center px-4"
      aria-hidden
    >
      <svg viewBox="0 0 240 120" className="h-full w-full max-h-[120px] max-w-[260px]" fill="none">
        <defs>
          <linearGradient id="mood-line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(236,72,153,0.2)" />
            <stop offset="35%" stopColor="rgba(168,85,247,0.85)" />
            <stop offset="70%" stopColor="rgba(34,211,238,0.75)" />
            <stop offset="100%" stopColor="rgba(236,72,153,0.35)" />
          </linearGradient>
          <filter id="mood-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <motion.path
          d="M 8 88 C 48 24, 92 104, 132 52 S 208 28, 232 64"
          stroke="url(#mood-line-grad)"
          strokeWidth="3"
          strokeLinecap="round"
          filter="url(#mood-glow)"
          initial={{ pathLength: 0, opacity: 0.4 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2.2, ease: "easeOut" }}
        />
        {[
          { cx: 48, cy: 52, fill: "rgba(236,72,153,0.9)" },
          { cx: 132, cy: 52, fill: "rgba(168,85,247,0.95)" },
          { cx: 208, cy: 40, fill: "rgba(34,211,238,0.9)" },
        ].map((dot, i) => (
          <motion.circle
            key={dot.cx}
            cx={dot.cx}
            cy={dot.cy}
            r="5"
            fill={dot.fill}
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{
              delay: 0.4 + i * 0.2,
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </svg>
      <motion.div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(168,85,247,0.15)_0%,transparent_65%)]"
        animate={{ opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
}

function WellnessJournalVisual() {
  return (
    <div
      className="relative flex h-full min-h-[140px] w-full items-center justify-center"
      aria-hidden
    >
      <motion.div
        className="absolute h-24 w-20 -rotate-6 rounded-lg border border-amber-300/20 bg-gradient-to-br from-violet-950/80 to-[#0b1020]/90 shadow-[0_0_32px_rgba(168,85,247,0.25)]"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.div
          className="absolute left-3 right-3 top-5 h-0.5 rounded-full bg-amber-300/30"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute left-3 right-6 top-9 h-0.5 rounded-full bg-violet-300/20" />
        <motion.div
          className="absolute left-3 right-8 top-[3.25rem] h-0.5 rounded-full bg-pink-300/25"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />
      </motion.div>
      <motion.div
        className="absolute h-20 w-16 rotate-6 rounded-lg border border-pink-400/15 bg-gradient-to-br from-amber-950/40 to-violet-950/60 shadow-[0_0_28px_rgba(236,72,153,0.2)]"
        animate={{ y: [0, 4, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      />
      <motion.div
        className="absolute h-8 w-8 rounded-full bg-gradient-to-br from-amber-300/70 to-orange-400/50 shadow-[0_0_20px_rgba(251,191,36,0.45)]"
        animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{ top: "18%", right: "22%" }}
      />
    </div>
  );
}

const VISUALS: Record<JourneyVisual, () => JSX.Element> = {
  lantern: LanternLakeVisual,
  orb: BreathingOrbVisual,
  mood: MoodGlowLineVisual,
  journal: WellnessJournalVisual,
};

interface JourneyStepPhotoProps {
  src: string;
}

function JourneyStepPhoto({ src }: JourneyStepPhotoProps) {
  return (
    <div className="relative h-full min-h-[200px] w-full" aria-hidden>
      <img
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        width={560}
        height={360}
        loading="lazy"
        decoding="async"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,10,20,0.25)_0%,rgba(7,10,20,0.55)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,transparent_35%,rgba(7,10,20,0.4)_100%)]" />
    </div>
  );
}

interface JourneyCardProps {
  step: JourneyStep;
  index: number;
}

function JourneyCard({ step, index }: JourneyCardProps) {
  const Visual = VISUALS[step.visual];
  const Icon = step.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: index * 0.06, duration: 0.5 }}
    >
      <LandingGlowCard
        glow={step.glow}
        className="rounded-[26px] p-6 sm:p-8 md:p-9"
      >
        <motion.div
          className="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-10"
          whileHover="hover"
          initial="rest"
          animate="rest"
        >
          <motion.div
            variants={{
              rest: { scale: 1 },
              hover: { scale: 1.02 },
            }}
            transition={{ duration: 0.35 }}
            className={cn(
              "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br sm:h-[4.5rem] sm:w-[4.5rem]",
              step.iconClass,
            )}
          >
            <Icon className="h-7 w-7 text-white sm:h-8 sm:w-8" />
          </motion.div>

          <motion.div
            variants={{
              rest: { scale: 1 },
              hover: { scale: 1.01 },
            }}
            transition={{ duration: 0.35 }}
            className="min-w-0 flex-1"
          >
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.2em] text-violet-300/70">
              Step {step.step}
            </p>
            <h2 className="mb-3 text-xl font-semibold text-white sm:text-2xl">
              {step.step}. {step.title}
            </h2>
            <p className="mb-5 text-sm leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-base">
              {step.description}
            </p>
            <ul className="space-y-2.5 text-sm text-violet-100/75 sm:text-[15px]">
              {step.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
                      step.glow === "pink" && "bg-pink-400 shadow-[0_0_8px_rgba(236,72,153,0.8)]",
                      step.glow === "cyan" && "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]",
                      step.glow === "purple" &&
                        "bg-violet-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]",
                      step.glow === "amber" &&
                        "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]",
                    )}
                  />
                  {bullet}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            variants={{
              rest: { scale: 1, opacity: 0.92 },
              hover: { scale: 1.03, opacity: 1 },
            }}
            transition={{ duration: 0.4 }}
            className={cn(
              "relative w-full shrink-0 self-stretch overflow-hidden rounded-2xl border border-white/[0.06] lg:w-[min(38%,280px)]",
              step.imageSrc ? "min-h-[200px] bg-[#070a14]" : "bg-[#070a14]/60",
            )}
          >
            {step.imageSrc ? (
              <JourneyStepPhoto src={step.imageSrc} />
            ) : (
              <>
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(88,28,135,0.12)_0%,transparent_70%)]" />
                <div className="relative p-4 sm:p-5">
                  <Visual />
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      </LandingGlowCard>
    </motion.div>
  );
}

interface FeatureCardProps {
  feature: FeatureItem;
  index: number;
}

function FeatureCard({ feature, index }: FeatureCardProps) {
  const Icon = feature.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.06 }}
      className="flex"
    >
      <LandingGlowCard glow={feature.glow} className="flex h-full w-full flex-col rounded-[22px] p-6">
        <div
          className={cn(
            "mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br",
            feature.iconClass,
          )}
        >
          <Icon className="h-6 w-6 text-white" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-white">{feature.title}</h3>
        <p className="text-sm leading-relaxed text-[var(--solace-ds-text-muted)]">
          {feature.description}
        </p>
      </LandingGlowCard>
    </motion.div>
  );
}

export function HowItWorks() {
  return (
    <motion.div
      className="solace-landing relative min-h-screen overflow-x-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <LandingBackground />

      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <img
          src={LANDING_HERO_BG}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[center_40%] opacity-[0.14]"
          width={2400}
          height={1350}
        />
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(ellipse_80%_45%_at_50%_0%,rgba(88,28,135,0.2)_0%,transparent_55%)]"
          animate={{ opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,22,0.35)_0%,rgba(5,8,22,0.75)_40%,rgba(5,8,22,0.92)_100%)]" />
      </div>

      <div className="relative z-10">
        <PublicNav variant="cinematic" />

        {/* Hero */}
        <section className="relative mx-auto max-w-[1180px] px-4 pb-10 pt-14 text-center sm:px-6 sm:pt-16 sm:pb-12 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="landing-serif mb-5 text-4xl font-semibold leading-[1.12] tracking-tight text-white sm:text-5xl md:text-[3.25rem]">
              How{" "}
              <span className="bg-gradient-to-r from-pink-200 via-fuchsia-200 to-violet-100 bg-clip-text text-transparent">
                Solace
              </span>{" "}
              Works
            </h1>
            <p className="mx-auto max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
              Your personal AI wellness companion, designed to support your mental health journey
            </p>
          </motion.div>
        </section>

        {/* Journey cards */}
        <section className="mx-auto max-w-[1180px] space-y-6 px-4 pb-14 sm:space-y-7 sm:px-6 sm:pb-16 lg:px-8">
          {JOURNEY_STEPS.map((step, index) => (
            <JourneyCard key={step.step} step={step} index={index} />
          ))}
        </section>

        {/* Key Features */}
        <section className="mx-auto max-w-[1180px] px-4 pb-14 sm:px-6 sm:pb-16 lg:px-8">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="landing-serif mb-8 text-center text-3xl font-semibold text-white md:mb-10 md:text-4xl"
          >
            Key{" "}
            <span className="bg-gradient-to-r from-pink-200 via-fuchsia-200 to-violet-100 bg-clip-text text-transparent">
              Features
            </span>
          </motion.h2>

          <motion.div
            className="grid gap-5 md:grid-cols-2"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.06 } },
            }}
          >
            {KEY_FEATURES.map((feature, index) => (
              <FeatureCard key={feature.title} feature={feature} index={index} />
            ))}
          </motion.div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-[1180px] px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <LandingGlowCard
              glow="pink"
              className="landing-cta-card-image relative mx-auto max-w-[720px] text-center"
              style={
                {
                  "--landing-cta-card-bg": `url("${LANDING_CTA_CARD_BG}")`,
                } as React.CSSProperties
              }
            >
              <div className="relative z-[2] px-6 py-10 sm:px-10 sm:py-12">
                <Zap className="mx-auto mb-3 h-6 w-6 text-pink-300" />
                <h2 className="text-2xl font-bold text-white md:text-3xl">
                  Ready to Start Your Wellness Journey?
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-sm text-[var(--solace-ds-text-muted)] md:text-base">
                  Join thousands who trust Solace for their mental health and wellbeing
                </p>
                <div
                  className="mt-6"
                  onClick={() => localStorage.setItem("selectedPlan", "trial")}
                >
                  <Link to="/signup" className="inline-block w-full sm:w-auto">
                    <motion.span
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="landing-cta-glow inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#E91E63] to-[#9C27B0] px-10 py-3.5 text-base font-semibold text-white sm:w-auto"
                    >
                      Start Trial
                    </motion.span>
                  </Link>
                </div>
                <p className="mt-3 text-sm text-[var(--solace-ds-text-muted)]">
                  7-day trial • No credit card required
                </p>
              </div>
            </LandingGlowCard>
          </motion.div>
        </section>

        <PublicFooter />
      </div>
    </motion.div>
  );
}
