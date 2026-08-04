import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { PublicNav } from "../components/PublicNav";
import { PublicFooter } from "../components/PublicFooter";
import { Button } from "../components/ui/button";
import { motion } from "motion/react";
import {
  Heart,
  Video,
  Shield,
  Clock,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Zap,
  Check,
  Crown,
  Loader2,
  MessageCircle,
  Lightbulb,
  Users,
  Brain,
  Fingerprint,
  RotateCcw,
  UserCheck,
  AlertCircle,
  BatteryLow,
  Package,
  DoorOpen,
  Moon,
  CloudMoon,
  Bot,
  Activity,
  Layers,
  UserPlus,
  Lock,
  AlertTriangle,
  Quote,
} from "lucide-react";
import { SUBSCRIPTION_PLANS } from "../utils/subscriptionPlans";
import type { PlanTier } from "../utils/subscriptionPlans";
import { LandingBackground } from "../landing/LandingBackground";
import { LandingHeroScene } from "../landing/LandingHeroScene";
import { LandingGlowCard } from "../landing/LandingGlowCard";
import { LANDING_CTA_CARD_BG, LANDING_STEP_BACKGROUNDS } from "../landing/landingImagery";
import { cn } from "@/lib/utils";

const HERO_OFFERS = [
  {
    text: "No credit card required.",
    className:
      "border-emerald-400/35 bg-emerald-500/10 text-emerald-100/95 shadow-[0_0_20px_-6px_rgba(52,211,153,0.45)]",
    iconClass: "text-emerald-400",
  },
  {
    text: "Start talking in minutes.",
    className:
      "border-violet-400/35 bg-violet-500/10 text-violet-100/95 shadow-[0_0_20px_-6px_rgba(139,92,246,0.4)]",
    iconClass: "text-violet-300",
  },
  {
    text: "Continue only if it helps.",
    className:
      "border-pink-400/35 bg-pink-500/10 text-pink-100/95 shadow-[0_0_20px_-6px_rgba(236,72,153,0.4)]",
    iconClass: "text-pink-300",
  },
] as const;

const HERO_TRUST = [
  "Private by Design",
  "Safety First",
  "No Credit Card Required",
  "User Control",
] as const;

const WHAT_IS_SOLACE_LEAD =
  "Sometimes the hardest thoughts are the ones we carry when we don't have anyone to talk to.";

const WHAT_IS_SOLACE_MOMENTS = [
  {
    text: "A conversation we keep replaying.",
    icon: MessageCircle,
    glow: "pink" as const,
    iconClass: "from-pink-500/90 to-fuchsia-600/90",
  },
  {
    text: "A decision we can't stop thinking about.",
    icon: Lightbulb,
    glow: "amber" as const,
    iconClass: "from-amber-400/90 to-orange-500/90",
  },
  {
    text: "A responsibility we never seem to put down.",
    icon: Shield,
    glow: "blue" as const,
    iconClass: "from-blue-400/90 to-indigo-600/90",
  },
  {
    text: "A feeling we haven't fully understood yet.",
    icon: Heart,
    glow: "green" as const,
    iconClass: "from-emerald-400/90 to-green-600/90",
  },
] as const;

const WHAT_IS_SOLACE_PROMISE = [
  { text: "Not advice.", muted: true },
  { text: "Not judgment.", muted: true },
  { text: "Just space to process.", muted: false },
] as const;

const UNDERSTANDING_SOLACE = [
  {
    question: "What is Solace?",
    answer:
      "Solace is a private AI conversation space where people can talk through their thoughts, reflect on what they're experiencing, and gain clarity through conversation.",
    glow: "purple" as const,
    icon: MessageCircle,
    iconClass: "from-violet-500/90 to-fuchsia-600/90 shadow-[0_0_20px_rgba(168,85,247,0.5)]",
  },
  {
    question: "Who is Solace for?",
    answer:
      "Solace is designed for people who are carrying something they haven't been able to fully process, don't feel comfortable sharing, or simply don't have someone available to talk to when they need it most.",
    glow: "pink" as const,
    icon: Users,
    iconClass: "from-pink-500/90 to-fuchsia-600/90 shadow-[0_0_20px_rgba(236,72,153,0.45)]",
  },
  {
    question: "How is Solace different?",
    answer:
      "Unlike most AI tools designed to provide answers, Solace is designed to support reflection, emotional processing, and clearer thinking through conversation.",
    glow: "blue" as const,
    icon: Fingerprint,
    iconClass: "from-blue-400/90 to-indigo-600/90 shadow-[0_0_20px_rgba(96,165,250,0.45)]",
  },
] as const;

const RECOGNIZE_FEELING_LINES = [
  {
    text: "The conversation ended hours ago.",
    icon: Clock,
    glow: "purple" as const,
    iconClass: "from-violet-500/90 to-purple-600/90",
  },
  {
    text: "You're still replaying it.",
    icon: RotateCcw,
    glow: "pink" as const,
    iconClass: "from-pink-500/90 to-fuchsia-600/90",
  },
  {
    text: "Everyone thinks you're doing fine.",
    icon: UserCheck,
    glow: "blue" as const,
    iconClass: "from-blue-400/90 to-indigo-600/90",
  },
  {
    text: "That's part of the problem.",
    icon: AlertCircle,
    glow: "amber" as const,
    iconClass: "from-amber-400/90 to-orange-500/90",
  },
  {
    text: "You're tired physically.",
    icon: BatteryLow,
    glow: "green" as const,
    iconClass: "from-emerald-400/90 to-green-600/90",
  },
  {
    text: "But even more tired mentally.",
    icon: Brain,
    glow: "cyan" as const,
    iconClass: "from-cyan-400/90 to-teal-600/90",
  },
  {
    text: "You keep carrying things because you don't know where else to put them.",
    icon: Package,
    glow: "purple" as const,
    iconClass: "from-violet-500/90 to-fuchsia-600/90",
  },
  {
    text: "You don't need someone to fix it.",
    icon: Shield,
    glow: "blue" as const,
    iconClass: "from-blue-400/90 to-indigo-600/90",
  },
  {
    text: "You need somewhere to process it.",
    icon: DoorOpen,
    glow: "pink" as const,
    iconClass: "from-pink-500/90 to-rose-600/90",
  },
  {
    text: "The day ends.",
    icon: Moon,
    glow: "amber" as const,
    iconClass: "from-amber-400/90 to-orange-500/90",
  },
  {
    text: "Your thoughts don't.",
    icon: CloudMoon,
    glow: "green" as const,
    iconClass: "from-emerald-400/90 to-teal-600/90",
  },
] as const;

const BUILT_FOR_PERSONAS = [
  {
    title: "The Quiet Overthinker",
    traits: [
      "You replay conversations.",
      "Revisit decisions.",
      "Analyze things long after everyone else has moved on.",
    ],
    callouts: [
      "You aren't looking for answers.",
      "You're trying to make sense of what's already in your head.",
    ],
    glow: "purple" as const,
    icon: Brain,
    iconClass: "from-violet-500/90 to-fuchsia-600/90 shadow-[0_0_20px_rgba(168,85,247,0.5)]",
    accentClass: "border-violet-400/25 bg-violet-500/[0.08]",
  },
  {
    title: "The High-Functioning Holder",
    traits: [
      "You're the person people rely on.",
      "The one who handles problems.",
      "Makes decisions.",
      "Keeps things moving.",
      "You listen to everyone else.",
      "You solve things for everyone else.",
    ],
    callouts: [
      "You carry responsibilities that don't disappear when the day ends.",
      "But rarely have a place to put your own thoughts first.",
      "Sometimes the strongest people need space too.",
    ],
    glow: "blue" as const,
    icon: Shield,
    iconClass: "from-blue-400/90 to-indigo-600/90 shadow-[0_0_20px_rgba(96,165,250,0.45)]",
    accentClass: "border-blue-400/25 bg-blue-500/[0.08]",
  },
] as const;

const WHY_FEATURES = [
  {
    icon: MessageCircle,
    title: "Talk",
    description: "Say what's on your mind naturally.",
    glow: "purple" as const,
    iconClass: "from-violet-500/90 to-fuchsia-600/90 shadow-[0_0_20px_rgba(168,85,247,0.5)]",
  },
  {
    icon: Heart,
    title: "Reflect",
    description:
      "Notice patterns, feelings, and perspectives that are difficult to see alone.",
    glow: "green" as const,
    iconClass: "from-emerald-400/90 to-green-600/90 shadow-[0_0_20px_rgba(52,211,153,0.45)]",
  },
  {
    icon: Lightbulb,
    title: "Gain Clarity",
    description:
      "Leave with a better understanding of what you're carrying and what matters most.",
    glow: "amber" as const,
    iconClass: "from-amber-400/90 to-orange-500/90 shadow-[0_0_20px_rgba(251,191,36,0.45)]",
  },
] as const;

const HOW_SOLACE_HELPS_INTRO = [
  "Clarity often begins when something is finally said out loud.",
  "Many thoughts stay tangled when they remain in our heads.",
  "Conversation creates space.",
  "Space creates perspective.",
  "Perspective creates clarity.",
] as const;

const WHAT_PEOPLE_GAIN = [
  "Less mental noise",
  "More clarity",
  "Better understanding",
  "A lighter mental load",
] as const;

const STEPS = [
  {
    step: 1,
    title: "Start a private conversation.",
    icon: CheckCircle2,
    glow: "green" as const,
    iconGlow: "text-emerald-300 drop-shadow-[0_0_28px_rgba(52,211,153,0.65)]",
  },
  {
    step: 2,
    title: "Talk naturally about what's on your mind.",
    icon: Video,
    glow: "pink" as const,
    iconGlow: "text-pink-300 drop-shadow-[0_0_28px_rgba(236,72,153,0.65)]",
  },
  {
    step: 3,
    title: "Reflect, process, and better understand what you're experiencing.",
    icon: Heart,
    glow: "purple" as const,
    iconGlow: "text-violet-300 drop-shadow-[0_0_28px_rgba(168,85,247,0.65)]",
  },
] as const;

const WHY_DIFFERENT_COMPARISONS = [
  {
    text: "Many AI tools are designed to answer questions.",
    icon: Bot,
    glow: "blue" as const,
    iconClass: "from-blue-400/90 to-indigo-600/90",
  },
  {
    text: "Many wellness tools are designed to track progress.",
    icon: Activity,
    glow: "green" as const,
    iconClass: "from-emerald-400/90 to-green-600/90",
  },
  {
    text: "Many platforms are designed to solve problems.",
    icon: Layers,
    glow: "amber" as const,
    iconClass: "from-amber-400/90 to-orange-500/90",
  },
] as const;

const WHAT_HAPPENS_NEXT_STEPS = [
  {
    step: 1,
    title: "Create your account.",
    icon: UserPlus,
    glow: "green" as const,
    iconClass: "from-emerald-400/90 to-green-600/90",
  },
  {
    step: 2,
    title: "Start your first conversation.",
    icon: MessageCircle,
    glow: "pink" as const,
    iconClass: "from-pink-500/90 to-fuchsia-600/90",
  },
  {
    step: 3,
    title: "Use your 30 free minutes and decide if Solace is right for you.",
    icon: Sparkles,
    glow: "purple" as const,
    iconClass: "from-violet-500/90 to-fuchsia-600/90",
  },
] as const;

const WHAT_HAPPENS_NEXT_REASSURANCE = [
  "No long setup.",
  "No complicated process.",
  "Just space when you need it.",
] as const;

const SAFETY_TRUST_PILLARS = [
  {
    title: "Private By Design",
    description: "Your conversations belong to you.",
    icon: Lock,
    glow: "blue" as const,
    iconClass: "from-blue-400/90 to-indigo-600/90",
  },
  {
    title: "Safety First",
    description:
      "Built-in safeguards and crisis support resources help support responsible use.",
    icon: Shield,
    glow: "green" as const,
    iconClass: "from-emerald-400/90 to-green-600/90",
  },
  {
    title: "Clear Boundaries",
    description:
      "Solace is not a replacement for professional medical or mental health care.",
    icon: AlertTriangle,
    glow: "amber" as const,
    iconClass: "from-amber-400/90 to-orange-500/90",
  },
  {
    title: "Your Choice",
    description: "You decide when to talk, what to share, and when to return.",
    icon: UserCheck,
    glow: "purple" as const,
    iconClass: "from-violet-500/90 to-fuchsia-600/90",
  },
] as const;

const TESTIMONIALS = [
  "I didn't realize how much I was carrying until I finally said it out loud.",
  "I left with more clarity than I expected.",
  "It felt like creating space in a room that had become too crowded.",
  "The biggest surprise wasn't getting answers. It was understanding my own thoughts better.",
] as const;

export function Landing() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    if (location.hash === "#pricing") {
      setTimeout(() => {
        const el = document.getElementById("pricing");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }

    const hash = location.hash;
    const search = location.search;

    if (
      hash &&
      hash.includes("type=invite") &&
      (hash.includes("access_token") || hash.includes("error="))
    ) {
      navigate(`/invite/create-password${search}${hash}`);
      return;
    }

    if (
      (hash &&
        (hash.includes("access_token") ||
          hash.includes("type=recovery") ||
          hash.includes("error="))) ||
      (search && (search.includes("code=") || search.includes("error=")))
    ) {
      navigate(`/auth/callback${search}${hash}`);
    }
  }, [user, isLoading, navigate, location]);

  const isAuthRedirect =
    (location.hash &&
      (location.hash.includes("access_token") ||
        location.hash.includes("type=recovery") ||
        location.hash.includes("type=invite"))) ||
    (location.search && location.search.includes("code="));

  if (isAuthRedirect) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg,#fbf8ff)]">
        <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="solace-landing relative min-h-screen overflow-x-hidden">
      <LandingBackground />

      <div className="relative z-10">
        <PublicNav variant="cinematic" />

        {/* Hero — centered, lake/lantern scene contained here only */}
        <LandingHeroScene>
          <div className="landing-section flex flex-col items-center justify-center gap-5 px-4 text-center sm:gap-6">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="landing-serif landing-hero-title text-white"
            >
              The place where thoughts go
              <span className="landing-hero-title-accent bg-gradient-to-r from-pink-200 via-fuchsia-200 to-violet-100 bg-clip-text text-transparent">
                when you have nobody to&nbsp;talk&nbsp;to.
              </span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex w-full max-w-6xl flex-col gap-4 px-2 sm:px-0"
            >
              <p className="mx-auto max-w-2xl text-[15px] leading-[1.7] text-white/88 sm:text-lg sm:leading-relaxed">
                Talk through what&apos;s on your mind with a private AI companion designed to help
                you express, reflect, and process what&apos;s weighing on you.
              </p>
              <p className="w-full rounded-2xl border border-white/10 bg-black/25 px-5 py-4 text-[13px] leading-snug text-white/62 backdrop-blur-md sm:px-8 sm:text-[15px] sm:leading-snug md:px-10 md:text-base md:leading-snug">
                Whether you&apos;re replaying a conversation, carrying too much responsibility,
                feeling overwhelmed, or simply trying to make sense of something that&apos;s been
                sitting with you, Solace gives you a place to talk it out without judgment,
                pressure, or expectations.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center"
            >
              <div onClick={() => localStorage.setItem("selectedPlan", "trial")} className="w-full sm:w-auto">
                <Link to="/signup" className="block w-full">
                  <motion.span
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="landing-cta-glow inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E91E63] to-[#9C27B0] px-8 py-3.5 text-base font-semibold text-white sm:w-auto"
                  >
                    Start With 30 Free Minutes
                    <ArrowRight className="h-4 w-4" />
                  </motion.span>
                </Link>
              </div>
              <Link to="/how-it-works" className="w-full sm:w-auto">
                <motion.span
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-white/20 bg-black/25 px-8 py-3.5 text-base font-semibold text-white/90 backdrop-blur-sm transition-[box-shadow,border-color] hover:border-white/30 hover:shadow-[0_0_28px_-8px_rgba(168,85,247,0.4)] sm:w-auto"
                >
                  See How Solace Works
                </motion.span>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex max-w-2xl flex-wrap items-center justify-center gap-2"
            >
              {HERO_OFFERS.map((offer) => (
                <span
                  key={offer.text}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium backdrop-blur-sm sm:px-3.5 sm:py-1.5 sm:text-xs",
                    offer.className,
                  )}
                >
                  <CheckCircle2 className={cn("h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5", offer.iconClass)} />
                  {offer.text}
                </span>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex max-w-3xl flex-wrap items-center justify-center gap-2"
            >
              {HERO_TRUST.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-[11px] font-medium text-white/70 backdrop-blur-sm sm:text-xs"
                >
                  <CheckCircle2 className="landing-check-glow h-3 w-3 shrink-0 text-emerald-400/90 sm:h-3.5 sm:w-3.5" />
                  {item}
                </span>
              ))}
            </motion.div>
          </div>
        </LandingHeroScene>

        {/* What is Solace */}
        <section className="landing-section py-12 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10 text-center"
          >
            <h2 className="mb-3 text-3xl font-bold text-white md:text-4xl">What is Solace?</h2>
            <p className="mx-auto max-w-xl text-base leading-relaxed text-[var(--solace-ds-text-muted)] md:text-lg">
              Not every thought needs an answer.{" "}
              <span className="text-white/90">Some thoughts need space.</span>
            </p>
          </motion.div>

          <div className="mx-auto flex max-w-4xl flex-col gap-8 md:gap-10">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="landing-serif mx-auto max-w-2xl text-center text-lg leading-relaxed text-white/88 sm:text-xl md:text-2xl md:leading-snug"
            >
              {WHAT_IS_SOLACE_LEAD}
            </motion.p>

            <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
              {WHAT_IS_SOLACE_MOMENTS.map((moment, index) => (
                <motion.div
                  key={moment.text}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                >
                  <LandingGlowCard
                    glow={moment.glow}
                    className="flex h-full w-full flex-row items-start gap-3 p-4 sm:gap-4 sm:p-5"
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br sm:h-10 sm:w-10",
                        moment.iconClass,
                      )}
                    >
                      <moment.icon className="h-[18px] w-[18px] text-white sm:h-5 sm:w-5" />
                    </div>
                    <p className="min-w-0 flex-1 text-left text-sm leading-relaxed text-white/85 sm:text-[15px]">
                      {moment.text}
                    </p>
                  </LandingGlowCard>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <LandingGlowCard glow="purple" className="p-6 sm:p-8">
                <p className="mx-auto max-w-2xl text-center text-sm leading-[1.75] text-[var(--solace-ds-text-muted)] sm:text-base md:text-lg">
                  Solace is a private conversation experience that helps you talk through what&apos;s
                  on your mind, reflect on what you&apos;re experiencing, and better understand
                  what&apos;s really bothering you.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                  {WHAT_IS_SOLACE_PROMISE.map((item) => (
                    <span
                      key={item.text}
                      className={cn(
                        "rounded-full border px-4 py-1.5 text-xs font-semibold sm:text-sm",
                        item.muted
                          ? "border-white/15 bg-white/[0.06] text-white/75"
                          : "border-pink-400/35 bg-gradient-to-r from-pink-500/15 to-violet-500/15",
                      )}
                    >
                      {item.muted ? (
                        item.text
                      ) : (
                        <span className="bg-gradient-to-r from-pink-200 via-fuchsia-200 to-violet-100 bg-clip-text text-transparent">
                          {item.text}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </LandingGlowCard>
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
              {WHY_FEATURES.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.06 }}
                  className="flex"
                >
                  <LandingGlowCard
                    glow={feature.glow}
                    className="flex h-full w-full items-start gap-3 p-4 sm:gap-4 sm:p-5"
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br sm:h-11 sm:w-11",
                        feature.iconClass,
                      )}
                    >
                      <feature.icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <h3 className="mb-1.5 text-base font-semibold text-white sm:text-lg">{feature.title}</h3>
                      <p className="text-sm leading-relaxed text-[var(--solace-ds-text-muted)]">
                        {feature.description}
                      </p>
                    </div>
                  </LandingGlowCard>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Understanding Solace */}
        <section className="landing-section py-12 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10 text-center"
          >
            <h2 className="mb-3 text-3xl font-bold text-white md:text-4xl">Understanding Solace</h2>
            <p className="mx-auto max-w-xl text-base text-[var(--solace-ds-text-muted)] md:text-lg">
              Three questions people often ask before their first conversation.
            </p>
          </motion.div>

          <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-3 lg:gap-6">
            {UNDERSTANDING_SOLACE.map((item, index) => (
              <motion.div
                key={item.question}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="flex"
              >
                <LandingGlowCard
                  glow={item.glow}
                  className="flex h-full w-full items-start gap-3 p-4 sm:gap-4 sm:p-5"
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br sm:h-11 sm:w-11",
                      item.iconClass,
                    )}
                  >
                    <item.icon className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <h3 className="mb-2 text-base font-semibold leading-snug text-white sm:text-lg">
                      {item.question}
                    </h3>
                    <p className="text-sm leading-[1.7] text-[var(--solace-ds-text-muted)] sm:text-[15px]">
                      {item.answer}
                    </p>
                  </div>
                </LandingGlowCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* You Might Recognize This Feeling */}
        <section className="landing-section py-12 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10 text-center"
          >
            <h2 className="mb-3 text-3xl font-bold text-white md:text-4xl">
              You Might Recognize This Feeling
            </h2>
            <p className="mx-auto max-w-lg text-base text-[var(--solace-ds-text-muted)] md:text-lg">
              If any of these feel familiar,{" "}
              <span className="text-white/90">you&apos;re not alone.</span>
            </p>
          </motion.div>

          <div className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {RECOGNIZE_FEELING_LINES.map((item, index) => (
              <motion.div
                key={item.text}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.04 }}
                className={cn(
                  "flex",
                  index === RECOGNIZE_FEELING_LINES.length - 1 && "sm:col-span-2 lg:col-span-1",
                )}
              >
                <LandingGlowCard
                  glow={item.glow}
                  className="flex h-full w-full flex-row items-center gap-3 p-3.5 sm:gap-3.5 sm:p-4"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br sm:h-9 sm:w-9",
                      item.iconClass,
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5 text-white sm:h-4 sm:w-4" />
                  </div>
                  <p className="min-w-0 flex-1 text-left text-sm leading-snug text-white/88 sm:text-[15px]">
                    {item.text}
                  </p>
                </LandingGlowCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Who Solace Was Built For */}
        <section className="landing-section py-12 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10 text-center"
          >
            <h2 className="mb-3 text-3xl font-bold text-white md:text-4xl">
              Who Solace Was Built For
            </h2>
            <p className="text-base text-[var(--solace-ds-text-muted)] md:text-lg">
              Different lives. <span className="text-white/90">Similar weight.</span>
            </p>
          </motion.div>

          <div className="mx-auto mb-8 grid max-w-5xl gap-6 lg:grid-cols-2 lg:gap-8">
            {BUILT_FOR_PERSONAS.map((persona, index) => (
              <motion.div
                key={persona.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="flex"
              >
                <LandingGlowCard glow={persona.glow} className="flex h-full w-full flex-col p-5 sm:p-6">
                  <div className="mb-6 flex items-center gap-4 border-b border-white/10 pb-5">
                    <div
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br sm:h-14 sm:w-14",
                        persona.iconClass,
                      )}
                    >
                      <persona.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-left text-lg font-semibold leading-snug text-white sm:text-xl">
                      {persona.title}
                    </h3>
                  </div>

                  <div className="mb-5 flex flex-wrap gap-2">
                    {persona.traits.map((trait) => (
                      <span
                        key={trait}
                        className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-left text-xs leading-snug text-white/80 sm:text-sm"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto space-y-3">
                    {persona.callouts.map((line, calloutIndex) => (
                      <div
                        key={line}
                        className={cn(
                          "rounded-xl border px-4 py-3.5",
                          persona.accentClass,
                          calloutIndex === persona.callouts.length - 1 && "border-white/15",
                        )}
                      >
                        <p
                          className={cn(
                            "text-sm leading-relaxed sm:text-[15px]",
                            calloutIndex === persona.callouts.length - 1
                              ? "landing-serif font-medium text-white/92"
                              : "text-[var(--solace-ds-text-muted)]",
                          )}
                        >
                          {line}
                        </p>
                      </div>
                    ))}
                  </div>
                </LandingGlowCard>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto mb-8 max-w-2xl"
          >
            <LandingGlowCard glow="popular" className="px-6 py-5 text-center sm:px-8 sm:py-6">
              <p className="text-base leading-relaxed text-white/85 md:text-lg">
                Many people see themselves in one.
              </p>
              <p className="mt-1 bg-gradient-to-r from-pink-200 via-fuchsia-200 to-violet-100 bg-clip-text text-base font-semibold text-transparent md:text-lg">
                Most see themselves in both.
              </p>
            </LandingGlowCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex justify-center"
          >
            <div onClick={() => localStorage.setItem("selectedPlan", "trial")}>
              <Link to="/signup">
                <motion.span
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="landing-cta-glow inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E91E63] to-[#9C27B0] px-8 py-3.5 text-base font-semibold text-white"
                >
                  Start With 30 Free Minutes
                  <ArrowRight className="h-4 w-4" />
                </motion.span>
              </Link>
            </div>
          </motion.div>
        </section>

        {/* How Solace Helps */}
        <section className="landing-section py-12 md:py-16">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-8 text-center text-3xl font-bold text-white md:text-4xl"
          >
            How Solace Helps
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto mb-10 max-w-2xl"
          >
            <LandingGlowCard glow="purple" className="p-6 sm:p-8">
              <div className="space-y-4">
                {HOW_SOLACE_HELPS_INTRO.map((line, index) => (
                  <p
                    key={line}
                    className={cn(
                      "text-center text-sm leading-relaxed sm:text-base",
                      index === 0 || index === HOW_SOLACE_HELPS_INTRO.length - 1
                        ? "font-medium text-white/92"
                        : "text-[var(--solace-ds-text-muted)]",
                    )}
                  >
                    {line}
                  </p>
                ))}
              </div>
            </LandingGlowCard>
          </motion.div>

          <div className="mx-auto mb-10 grid max-w-5xl gap-4 md:grid-cols-3 md:gap-5">
            {STEPS.map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
              >
                <LandingGlowCard glow={item.glow} className="flex w-full items-start gap-3 p-3.5 sm:gap-3.5 sm:p-4">
                  <div
                    className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cover bg-center sm:h-10 sm:w-10"
                    style={{
                      backgroundImage: `linear-gradient(180deg, rgba(7,8,21,0.38) 0%, rgba(7,8,21,0.52) 100%), url("${LANDING_STEP_BACKGROUNDS[index]}")`,
                    }}
                  >
                    <item.icon className={cn("relative z-[1] h-5 w-5 sm:h-6 sm:w-6", item.iconGlow)} />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <span className="mb-1.5 inline-flex rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
                      Step {item.step}
                    </span>
                    <h3 className="text-sm font-semibold leading-snug text-white sm:text-[15px]">
                      {item.title}
                    </h3>
                  </div>
                </LandingGlowCard>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto mb-8 max-w-xl"
          >
            <LandingGlowCard glow="green" className="p-6 sm:p-7">
              <h3 className="mb-5 text-center text-lg font-semibold text-white md:text-xl">
                What People Often Gain
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {WHAT_PEOPLE_GAIN.map((gain) => (
                  <li key={gain} className="flex items-center gap-2.5">
                    <CheckCircle2 className="landing-check-glow h-4 w-4 shrink-0 text-emerald-400" />
                    <span className="text-sm text-[var(--solace-ds-text-muted)] sm:text-[15px]">
                      {gain}
                    </span>
                  </li>
                ))}
              </ul>
            </LandingGlowCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex justify-center"
          >
            <div onClick={() => localStorage.setItem("selectedPlan", "trial")}>
              <Link to="/signup">
                <motion.span
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="landing-cta-glow inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E91E63] to-[#9C27B0] px-8 py-3.5 text-base font-semibold text-white"
                >
                  Try Your First Conversation
                  <ArrowRight className="h-4 w-4" />
                </motion.span>
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Why Solace Feels Different */}
        <section className="landing-section py-12 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10 text-center"
          >
            <h2 className="landing-serif text-3xl font-semibold tracking-tight text-white md:text-4xl lg:text-[2.75rem]">
              Why Solace{" "}
              <span className="bg-gradient-to-r from-pink-200 via-fuchsia-200 to-violet-100 bg-clip-text text-transparent">
                Feels Different
              </span>
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto mb-10 max-w-2xl"
          >
            <LandingGlowCard glow="pink" className="px-6 py-7 text-center sm:px-8 sm:py-8">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-pink-300/75">
                The usual approach
              </p>
              <p className="mb-5 text-lg font-semibold leading-snug text-white md:text-xl">
                Most platforms focus on answers, advice, or treatment.
              </p>
              <div
                className="mx-auto mb-5 h-px w-16 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                aria-hidden
              />
              <p className="mb-3 text-sm text-[var(--solace-ds-text-muted)] md:text-base">
                Solace starts somewhere simpler.
              </p>
              <p className="landing-serif text-xl leading-snug text-white/92 md:text-2xl md:leading-snug">
                Giving people a place to talk when they don&apos;t have someone to talk to.
              </p>
            </LandingGlowCard>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-5 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45"
          >
            What most tools are built for
          </motion.p>

          <div className="mx-auto mb-10 grid max-w-4xl gap-3 sm:grid-cols-3 sm:gap-4">
            {WHY_DIFFERENT_COMPARISONS.map((item, index) => (
              <motion.div
                key={item.text}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
              >
                <LandingGlowCard glow={item.glow} className="flex h-full items-start gap-3 p-3.5 sm:gap-3.5 sm:p-4">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br sm:h-9 sm:w-9",
                      item.iconClass,
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5 text-white sm:h-4 sm:w-4" />
                  </div>
                  <p className="min-w-0 flex-1 text-left text-sm leading-relaxed text-white/82 sm:text-[15px]">
                    {item.text}
                  </p>
                </LandingGlowCard>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-2xl"
          >
            <LandingGlowCard glow="purple" className="px-6 py-7 sm:px-8 sm:py-8">
              <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-300/80">
                Where Solace begins
              </p>
              <h3 className="landing-serif mb-4 text-center text-xl font-semibold leading-snug text-white md:text-2xl">
                Solace is designed for the moments before any of that.
              </h3>
              <p className="mb-6 text-center text-sm leading-relaxed text-[var(--solace-ds-text-muted)] md:text-base">
                The moments when you simply need somewhere to say it out loud.
              </p>
              <div className="border-l-2 border-pink-400/40 pl-4 sm:pl-5">
                <p className="landing-serif text-base italic leading-relaxed text-white/88 md:text-lg">
                  Because sometimes thoughts become lighter simply by expressing them.
                </p>
              </div>
            </LandingGlowCard>
          </motion.div>
        </section>

        {/* What Happens Next? */}
        <section className="landing-section py-12 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10 text-center"
          >
            <h2 className="landing-serif text-3xl font-semibold tracking-tight text-white md:text-4xl">
              What Happens{" "}
              <span className="bg-gradient-to-r from-pink-200 via-fuchsia-200 to-violet-100 bg-clip-text text-transparent">
                Next?
              </span>
            </h2>
            <p className="mt-3 text-base text-[var(--solace-ds-text-muted)] md:text-lg">
              Starting is simple.
            </p>
          </motion.div>

          <div className="relative mx-auto mb-8 grid max-w-4xl gap-4 md:grid-cols-3 md:gap-5">
            <div
              className="pointer-events-none absolute left-[16.67%] right-[16.67%] top-9 hidden h-px bg-gradient-to-r from-emerald-400/20 via-pink-400/30 to-violet-400/20 md:block"
              aria-hidden
            />
            {WHAT_HAPPENS_NEXT_STEPS.map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
              >
                <LandingGlowCard glow={item.glow} className="relative flex h-full items-start gap-3 p-3.5 sm:gap-3.5 sm:p-4">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br sm:h-10 sm:w-10",
                      item.iconClass,
                    )}
                  >
                    <item.icon className="h-4 w-4 text-white sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <span className="mb-1 inline-flex rounded-full border border-white/12 bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/60">
                      Step {item.step}
                    </span>
                    <p className="text-sm font-medium leading-relaxed text-white/88 sm:text-[15px]">
                      {item.title}
                    </p>
                  </div>
                </LandingGlowCard>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-2xl"
          >
            <LandingGlowCard glow="green" className="flex flex-wrap items-center justify-center gap-2.5 px-5 py-4 sm:gap-3 sm:px-6 sm:py-5">
              {WHAT_HAPPENS_NEXT_REASSURANCE.map((line) => (
                <span
                  key={line}
                  className="rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-1.5 text-xs font-medium text-white/75 sm:text-sm"
                >
                  {line}
                </span>
              ))}
            </LandingGlowCard>
          </motion.div>
        </section>

        {/* Safety & Trust */}
        <section className="landing-section py-12 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10 text-center"
          >
            <h2 className="landing-serif text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Safety &amp;{" "}
              <span className="bg-gradient-to-r from-pink-200 via-fuchsia-200 to-violet-100 bg-clip-text text-transparent">
                Trust
              </span>
            </h2>
            <p className="mt-3 text-base text-[var(--solace-ds-text-muted)] md:text-lg">
              Built with privacy, care, and safety in mind.
            </p>
          </motion.div>

          <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {SAFETY_TRUST_PILLARS.map((pillar, index) => (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
                className="flex"
              >
                <LandingGlowCard glow={pillar.glow} className="flex h-full w-full items-start gap-3 p-3.5 sm:gap-3.5 sm:p-4">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br sm:h-10 sm:w-10",
                      pillar.iconClass,
                    )}
                  >
                    <pillar.icon className="h-4 w-4 text-white sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <h3 className="mb-1 text-sm font-semibold text-white sm:text-base">{pillar.title}</h3>
                    <p className="text-xs leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-sm">
                      {pillar.description}
                    </p>
                  </div>
                </LandingGlowCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Real Experiences */}
        <section className="landing-section py-12 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10 text-center"
          >
            <h2 className="landing-serif text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Real{" "}
              <span className="bg-gradient-to-r from-pink-200 via-fuchsia-200 to-violet-100 bg-clip-text text-transparent">
                Experiences
              </span>
            </h2>
            <p className="mt-3 text-base text-[var(--solace-ds-text-muted)] md:text-lg">
              What people often tell us after their first conversation
            </p>
          </motion.div>

          <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:gap-5">
            {TESTIMONIALS.map((quote, index) => (
              <motion.div
                key={quote}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
              >
                <LandingGlowCard glow="pink" className="flex h-full items-start gap-3 p-4 sm:gap-4 sm:p-5">
                  <Quote className="mt-0.5 h-5 w-5 shrink-0 text-pink-300/80" aria-hidden />
                  <p className="landing-serif min-w-0 flex-1 text-left text-base italic leading-relaxed text-white/88 md:text-lg">
                    &ldquo;{quote}&rdquo;
                  </p>
                </LandingGlowCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="landing-section py-10 md:py-12">
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
                  Some thoughts don&apos;t need answers. They need space.
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-sm text-[var(--solace-ds-text-muted)] md:text-base">
                  Start with 30 free minutes. No credit card required. No pressure to continue. Just
                  a place to talk when you&apos;re ready.
                </p>
                <div className="mt-6" onClick={() => localStorage.setItem("selectedPlan", "trial")}>
                  <Link to="/signup">
                    <motion.span
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="landing-cta-glow inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#E91E63] to-[#9C27B0] px-10 py-3.5 text-base font-semibold text-white"
                    >
                      Start With 30 Free Minutes
                    </motion.span>
                  </Link>
                </div>
                <p className="mt-3 text-sm text-[var(--solace-ds-text-muted)]">
                  No credit card required • Continue only if it helps
                </p>
              </div>
            </LandingGlowCard>
          </motion.div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="landing-section py-12 md:py-16">
          <div className="mb-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-4 py-1.5 text-sm font-semibold text-violet-100/90">
                <Crown className="h-4 w-4 text-violet-300" />
                Start free. Continue only if it helps.
              </span>
              <h2 className="mb-3 text-3xl font-bold text-white md:text-4xl">
                Choose Your{" "}
                <span className="bg-gradient-to-r from-pink-300 to-fuchsia-400 bg-clip-text text-transparent">
                  Wellness Journey
                </span>
              </h2>
              <p className="mx-auto max-w-2xl text-base text-[var(--solace-ds-text-muted)]">
                Start with 30 free minutes. Upgrade anytime for more conversation time and better
                pay-as-you-go rates.
              </p>
            </motion.div>
          </div>

          <div className="grid items-stretch gap-6 md:grid-cols-3 lg:gap-8">
            {(Object.keys(SUBSCRIPTION_PLANS) as PlanTier[]).map((planId, index) => {
              const plan = SUBSCRIPTION_PLANS[planId];
              const isPopular = plan.popular;

              return (
                <motion.div
                  key={planId}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                  className="relative flex"
                >
                  {isPopular ? (
                    <div className="absolute -top-3.5 left-0 right-0 z-10 flex justify-center">
                      <span className="rounded-full border border-pink-400/40 bg-gradient-to-r from-violet-600 to-pink-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-[0_0_20px_rgba(236,72,153,0.4)]">
                        Most Popular
                      </span>
                    </div>
                  ) : null}

                  <LandingGlowCard
                    glow={isPopular ? "popular" : "purple"}
                    className="flex w-full flex-col p-6 sm:p-7"
                  >
                    <div className="relative z-[1] flex flex-1 flex-col">
                      <div className="mb-5">
                        <div
                          className={cn(
                            "mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br",
                            plan.gradient,
                          )}
                        >
                          {planId === "trial" && <Sparkles className="h-5 w-5 text-white" />}
                          {planId === "core" && <Zap className="h-5 w-5 text-white" />}
                          {planId === "pro" && <Crown className="h-5 w-5 text-white" />}
                        </div>
                        <h3 className="mb-1 text-lg font-bold text-white">
                          {planId === "trial" ? "Free Trial" : plan.displayName}
                        </h3>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-white">${plan.price}</span>
                          {plan.price > 0 ? (
                            <span className="text-sm text-[var(--solace-ds-text-muted)]">/month</span>
                          ) : null}
                        </div>
                        {planId === "trial" ? (
                          <p className="mt-0.5 text-sm text-[var(--solace-ds-text-muted)]">
                            {plan.credits} minutes • No credit card required
                          </p>
                        ) : (
                          <p className="mt-0.5 text-sm text-[var(--solace-ds-text-muted)]">
                            {plan.credits} minutes each month
                          </p>
                        )}
                      </div>

                      <div className="mb-5 rounded-xl border border-white/[0.08] bg-white/[0.04] p-3.5">
                        <div className="mb-0.5 flex items-center justify-between">
                          <span className="text-xs font-medium text-violet-100/85">
                            AI Companion Time
                          </span>
                          <Video className="h-3.5 w-3.5 text-violet-300" />
                        </div>
                        <p className="text-xl font-bold text-white">{plan.credits} minutes</p>
                        <p className="mt-0.5 text-[11px] text-violet-200/60">
                          {planId === "trial" ? "One-time Discover minutes" : "Refreshes monthly"}
                        </p>
                      </div>

                      {plan.payAsYouGoRate !== null ? (
                        <div className="mb-5 rounded-lg border border-emerald-400/15 bg-emerald-500/[0.06] p-2.5">
                          <div className="mb-0.5 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            <span className="text-xs font-semibold text-emerald-100/90">
                              Pay-As-You-Go Available
                            </span>
                          </div>
                          <p className="text-base font-bold text-emerald-200">
                            ${plan.payAsYouGoRate}/min
                          </p>
                          {planId === "pro" ? (
                            <p className="mt-0.5 text-[10px] text-emerald-300/65">
                              40% savings vs Grow
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mb-5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-[var(--solace-ds-text-muted)]" />
                            <span className="text-xs text-[var(--solace-ds-text-muted)]">
                              No pay-as-you-go option
                            </span>
                          </div>
                        </div>
                      )}

                      <ul className="mb-6 flex-grow space-y-2.5">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check
                              className={cn(
                                "landing-check-glow mt-0.5 h-4 w-4 shrink-0",
                                isPopular ? "text-pink-400" : "text-emerald-400",
                              )}
                            />
                            <span className="text-xs leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-sm">
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-auto">
                        {planId === "trial" ? (
                          <div
                            onClick={() => {
                              setLoadingPlan(planId);
                              localStorage.setItem("selectedPlan", planId);
                              setTimeout(() => navigate("/signup"), 500);
                            }}
                          >
                            <Button
                              className={cn(
                                "w-full rounded-xl border-0 py-5 text-sm font-semibold",
                                isPopular
                                  ? "landing-cta-glow bg-gradient-to-r from-violet-600 to-pink-500 text-white"
                                  : "bg-white/10 text-white hover:bg-white/15",
                              )}
                              size="lg"
                              isLoading={loadingPlan === planId}
                            >
                              Start With 30 Free Minutes
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            onClick={async () => {
                              try {
                                setLoadingPlan(planId);
                                localStorage.setItem("selectedPlan", planId);
                                const origin = window.location.origin;
                                const successUrl = `${origin}/signup?postCheckout=1&plan=${planId}&session_id={CHECKOUT_SESSION_ID}`;
                                const cancelUrl = `${origin}/#pricing`;
                                const { api } = await import("@/lib/api");
                                const result = await api.billing.createGuestSubscription({
                                  plan_type: planId,
                                  billing_cycle: "monthly",
                                  successUrl,
                                  cancelUrl,
                                });
                                if (result.checkoutUrl) {
                                  window.location.href = result.checkoutUrl;
                                }
                              } catch (e) {
                                console.error("Failed to start checkout:", e);
                                setLoadingPlan(null);
                              }
                            }}
                            className={cn(
                              "w-full rounded-xl border-0 py-5 text-sm font-semibold",
                              isPopular
                                ? "landing-cta-glow bg-gradient-to-r from-violet-600 to-pink-500 text-white"
                              : "bg-white/10 text-white hover:bg-white/15",
                            )}
                            size="lg"
                            isLoading={loadingPlan === planId}
                          >
                            Get Started
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {planId === "trial" ? (
                        <p className="mt-2 text-center text-[11px] text-[var(--solace-ds-text-muted)]">
                          No credit card required
                        </p>
                      ) : null}
                    </div>
                  </LandingGlowCard>
                </motion.div>
              );
            })}
          </div>
        </section>

        <PublicFooter />
      </div>
    </div>
  );
}
