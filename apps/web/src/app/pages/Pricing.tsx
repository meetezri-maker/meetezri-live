import { Link, useNavigate } from "react-router-dom";
import { PublicNav } from "../components/PublicNav";
import { PublicFooter } from "../components/PublicFooter";
import { Button } from "../components/ui/button";
import { motion } from "motion/react";
import {
  Check,
  Zap,
  ArrowRight,
  Sparkles,
  Crown,
  CheckCircle2,
  HelpCircle,
  MessageCircle,
  Lightbulb,
  CloudMoon,
  Heart,
  Package,
} from "lucide-react";
import { SUBSCRIPTION_PLANS } from "../utils/subscriptionPlans";
import { useState } from "react";
import type { PlanTier } from "../utils/subscriptionPlans";
import { LandingBackground } from "../landing/LandingBackground";
import { LandingHeroScene } from "../landing/LandingHeroScene";
import { LandingGlowCard } from "../landing/LandingGlowCard";
import { LANDING_CTA_CARD_BG } from "../landing/landingImagery";
import { cn } from "@/lib/utils";

const HERO_TRUST = [
  "No Credit Card Required",
  "Cancel Anytime",
  "Private by Design",
  "Start In Minutes",
] as const;

const WHY_TRIAL_LINES = [
  "You can read about conversation.",
  "You can read about reflection.",
  "You can read about clarity.",
] as const;

const WHY_30_MINUTES = [
  "Enough time to move beyond introductions.",
  "Enough time to talk through what's really on your mind.",
  "Enough time to experience what it feels like to have somewhere to put the thoughts you've been carrying.",
  "Enough time to decide whether Solace feels right for you.",
] as const;

const TRIAL_USES = [
  "Talk about something important.",
  "Talk about something ordinary.",
  "Talk through a difficult decision.",
  "Process something that's been sitting on your mind.",
  "Or simply see what the experience feels like.",
] as const;

const TRIAL_INCLUDES = [
  "Full Talk It Out Experience",
  "Safety Features",
  "AI Companion Conversations",
  "Guided Reflection Experience",
  "No Credit Card Required",
] as const;

const WHEN_CONTINUE_MOMENTS = [
  { text: "A conversation.", icon: MessageCircle, glow: "pink" as const, iconClass: "from-pink-500/90 to-fuchsia-600/90" },
  { text: "A decision.", icon: Lightbulb, glow: "amber" as const, iconClass: "from-amber-400/90 to-orange-500/90" },
  { text: "A worry.", icon: CloudMoon, glow: "purple" as const, iconClass: "from-violet-500/90 to-fuchsia-600/90" },
  { text: "A responsibility.", icon: Package, glow: "blue" as const, iconClass: "from-blue-400/90 to-indigo-600/90" },
  {
    text: "A feeling they haven't been able to put down.",
    icon: Heart,
    glow: "green" as const,
    iconClass: "from-emerald-400/90 to-green-600/90",
  },
] as const;

const VALUE_PLACES = [
  "A place to think out loud.",
  "A place to process.",
  "A place to reflect.",
  "A place to start.",
] as const;

const CORE_INCLUDES = [
  "200 Monthly Conversation Minutes",
  "Mood History & Trends",
  "Journaling",
  "Curated Wellness Tools",
  "Usage History",
  "Pay-As-You-Go Top Ups",
] as const;

const PRO_INCLUDES = [
  "400 Monthly Conversation Minutes",
  "Extended Mood History",
  "Journal Export",
  "Full Wellness Library",
  "Detailed Usage Insights",
  "Priority Handling",
  "Pay-As-You-Go Top Ups",
] as const;

const UNDERSTANDING_PLANS = [
  {
    question: "What happens after the free trial?",
    answer:
      "Once your free minutes are used, you can decide whether you'd like to continue with a Core or Pro subscription. There is no obligation to subscribe.",
  },
  {
    question: "Can I use Solace without subscribing?",
    answer:
      "Yes. Trying Solace does not require a subscription or a credit card. You can experience the platform first and decide later.",
  },
  {
    question: "What's the difference between Core and Pro?",
    answer:
      "Core is designed for regular use and ongoing access. Pro is designed for people who want deeper continuity and more frequent conversations throughout the month.",
  },
] as const;

const COMPARE_ROWS = [
  { feature: "Talk It Out", trial: true, core: true, pro: true },
  { feature: "Emergency Detection", trial: true, core: true, pro: true },
  { feature: "Mood History", trial: "—", core: "7/30 Days", pro: "90 Days" },
  { feature: "Journaling", trial: "—", core: true, pro: "✓ + Export" },
  { feature: "Wellness Tools", trial: "—", core: "Curated", pro: "Full Library" },
  { feature: "Usage History", trial: "—", core: true, pro: "Detailed" },
  { feature: "Pay-As-You-Go", trial: "—", core: true, pro: true },
  { feature: "Priority Handling", trial: "—", core: "—", pro: true },
] as const;

const WHY_STAY_LINES = [
  "Somewhere to talk through their thoughts.",
  "Somewhere to process emotions.",
  "Somewhere to find perspective.",
  "Somewhere to start when they don't know where else to begin.",
] as const;

const FAQ_ITEMS = [
  {
    question: "Do I need a credit card to start?",
    answer: "No. Every new user receives 30 free minutes with no credit card required.",
  },
  {
    question: "What happens when my free minutes end?",
    answer:
      "You can decide whether you'd like to continue with a paid plan. There is no obligation to subscribe.",
  },
  {
    question: "What if I'm not ready to subscribe?",
    answer:
      "That's okay. The free trial is designed to help you decide whether Solace feels useful before making any commitment.",
  },
  {
    question: "Can I cancel my subscription?",
    answer: "Yes. You can cancel at any time.",
  },
  {
    question: "Can I upgrade later?",
    answer: "Yes. You can move between plans as your needs change.",
  },
  {
    question: "What happens if I run out of minutes?",
    answer: "Core and Pro users can purchase additional minutes through pay-as-you-go top-ups.",
  },
  {
    question: "Which plan should I choose?",
    answer:
      "Most people begin with Core. People who expect to use Solace more frequently often choose Pro.",
  },
] as const;

interface SectionHeadingProps {
  title: string;
  highlight?: string;
  subtitle?: string;
}

function SectionHeading({ title, highlight, subtitle }: SectionHeadingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="mb-10 text-center"
    >
      <h2 className="landing-serif text-3xl font-semibold tracking-tight text-white md:text-4xl">
        {title}
        {highlight ? (
          <>
            {" "}
            <span className="bg-gradient-to-r from-pink-200 via-fuchsia-200 to-violet-100 bg-clip-text text-transparent">
              {highlight}
            </span>
          </>
        ) : null}
      </h2>
      {subtitle ? (
        <p className="mt-3 text-base text-[var(--solace-ds-text-muted)] md:text-lg">{subtitle}</p>
      ) : null}
    </motion.div>
  );
}

interface FaqCardProps {
  question: string;
  answer: string;
  index: number;
}

function FaqCard({ question, answer, index }: FaqCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
    >
      <LandingGlowCard glow="purple" className="p-5 sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/90 to-fuchsia-600/90">
            <HelpCircle className="h-4 w-4 text-white" />
          </div>
          <h3 className="pt-1 text-left text-base font-semibold leading-snug text-white sm:text-lg">
            {question}
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-[15px]">
          {answer}
        </p>
      </LandingGlowCard>
    </motion.div>
  );
}

function CompareCell({ value }: { value: boolean | string }) {
  if (value === true) {
    return <Check className="mx-auto h-4 w-4 text-emerald-400" aria-label="Included" />;
  }
  if (value === "—") {
    return <span className="text-white/35">—</span>;
  }
  return <span className="text-xs text-white/75 sm:text-sm">{value}</span>;
}

interface PaidPlanCardProps {
  planId: "core" | "pro";
  description: string;
  bestFor: string;
  includes: readonly string[];
  includesLabel: string;
  loadingPlan: string | null;
  onSelect: (planId: PlanTier) => void;
  index: number;
}

function PaidPlanCard({
  planId,
  description,
  bestFor,
  includes,
  includesLabel,
  loadingPlan,
  onSelect,
  index,
}: PaidPlanCardProps) {
  const plan = SUBSCRIPTION_PLANS[planId];
  const isPopular = plan.popular;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08 }}
      className={cn("relative flex", isPopular && "md:z-[1]")}
    >
      {isPopular ? (
        <div className="absolute -top-3.5 left-0 right-0 z-10 flex justify-center">
          <span className="rounded-full border border-violet-400/40 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Recommended
          </span>
        </div>
      ) : null}

      <LandingGlowCard
        glow={isPopular ? "popular" : "purple"}
        className={cn("flex h-full w-full flex-col p-5 sm:p-6", isPopular && "md:scale-[1.01]")}
      >
        <div className="mb-4 flex items-center gap-3">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br",
              plan.gradient,
            )}
          >
            {planId === "core" ? (
              <Zap className="h-5 w-5 text-white" />
            ) : (
              <Crown className="h-5 w-5 text-white" />
            )}
          </div>
          <div className="text-left">
            <h3 className="text-xl font-bold text-white">{plan.name}</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white sm:text-3xl">${plan.price}</span>
              <span className="text-sm text-[var(--solace-ds-text-muted)]">/ Month</span>
            </div>
          </div>
        </div>

        <p className="mb-1 text-sm font-semibold text-violet-200/90">
          {plan.credits} Minutes Per Month
        </p>
        <p className="mb-5 text-sm leading-relaxed text-[var(--solace-ds-text-muted)]">
          {description}
        </p>

        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/60">
          {includesLabel}
        </p>
        <ul className="mb-5 flex-grow space-y-2">
          {includes.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check className="landing-check-glow mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <span className="text-sm text-[var(--solace-ds-text-muted)]">{feature}</span>
            </li>
          ))}
        </ul>

        <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/55">Best For</p>
          <p className="text-sm leading-relaxed text-white/82">{bestFor}</p>
        </div>

        <Button
          onClick={() => onSelect(planId)}
          className={cn(
            "w-full rounded-xl border-0 py-5 text-sm font-semibold",
            isPopular
              ? "landing-cta-glow bg-gradient-to-r from-[#E91E63] to-[#9C27B0] text-white"
              : "bg-white/10 text-white hover:bg-white/15",
          )}
          size="lg"
          isLoading={loadingPlan === planId}
        >
          {planId === "core" ? "Choose Core" : "Choose Pro"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </LandingGlowCard>
    </motion.div>
  );
}

export function Pricing() {
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handlePaidPlan = async (planId: PlanTier) => {
    if (planId === "trial") return;
    try {
      setLoadingPlan(planId);
      localStorage.setItem("selectedPlan", planId);
      const origin = window.location.origin;
      const successUrl = `${origin}/signup?postCheckout=1&plan=${planId}&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${origin}/pricing`;
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
  };

  const startTrial = () => {
    localStorage.setItem("selectedPlan", "trial");
    navigate("/signup");
  };

  return (
    <div className="solace-landing relative min-h-screen overflow-x-hidden">
      <LandingBackground />

      <div className="relative z-10">
        <PublicNav variant="cinematic" />

        {/* Hero */}
        <LandingHeroScene>
          <div className="landing-section flex flex-col items-center justify-center gap-5 px-4 text-center sm:gap-6">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="landing-serif landing-hero-title text-white"
            >
              Start free. Continue only if it helps.
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex w-full max-w-3xl flex-col gap-4"
            >
              <p className="text-[15px] leading-relaxed text-white/88 sm:text-lg">
                The best way to understand Solace isn&apos;t by reading about it. It&apos;s by
                experiencing it.
              </p>
              <LandingGlowCard glow="purple" className="px-5 py-4 sm:px-8 sm:py-5">
                <p className="text-sm leading-relaxed text-white/85 sm:text-base">
                  That&apos;s why every new user starts with 30 free minutes.
                </p>
                <p className="mt-3 text-sm text-[var(--solace-ds-text-muted)] sm:text-base">
                  No credit card required. No pressure to continue. Just a chance to see if having
                  somewhere to talk things through makes a difference.
                </p>
              </LandingGlowCard>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex justify-center"
            >
              <div onClick={startTrial}>
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

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
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

        {/* Why We Offer a Free Trial */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading title="Why We Offer a Free Trial" />

          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="landing-serif text-center text-lg text-white/88 sm:text-xl"
            >
              Some experiences need to be felt, not explained.
            </motion.p>

            <div className="grid gap-3 sm:grid-cols-3">
              {WHY_TRIAL_LINES.map((line, index) => (
                <motion.div
                  key={line}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                >
                  <LandingGlowCard glow="pink" className="flex h-full items-center p-4">
                    <p className="text-sm leading-snug text-white/82 sm:text-[15px]">{line}</p>
                  </LandingGlowCard>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <LandingGlowCard glow="purple" className="space-y-4 p-6 sm:p-8">
                <p className="text-center text-sm leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-base">
                  But none of those things matter unless the experience feels meaningful to you.
                  That&apos;s why we don&apos;t ask people to commit before they&apos;ve had a
                  chance to try Solace for themselves.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {["Start with a conversation.", "See how it feels.", "Decide from there."].map(
                    (line) => (
                      <span
                        key={line}
                        className="rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-white/80 sm:text-sm"
                      >
                        {line}
                      </span>
                    ),
                  )}
                </div>
              </LandingGlowCard>
            </motion.div>
          </div>
        </section>

        {/* Why 30 Minutes? */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading
            title="Why 30 Minutes?"
            subtitle="Meaningful conversations take time."
          />

          <div className="mx-auto max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <LandingGlowCard glow="green" className="p-6 sm:p-8">
                <p className="mb-5 text-center text-sm text-[var(--solace-ds-text-muted)] sm:text-base">
                  We chose 30 free minutes for a reason.
                </p>
                <ul className="mb-5 space-y-3">
                  {WHY_30_MINUTES.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-sm text-white/82 sm:text-[15px]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      {line}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {["Not a rushed demo.", "Not a limited preview.", "A real opportunity to experience the conversation."].map(
                    (line) => (
                      <span
                        key={line}
                        className="rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-white/80 sm:text-sm"
                      >
                        {line}
                      </span>
                    ),
                  )}
                </div>
              </LandingGlowCard>
            </motion.div>
          </div>
        </section>

        {/* Start With 30 Free Minutes */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading
            title="Start With 30 Free Minutes"
            subtitle="A simple place to begin."
          />

          <div className="mx-auto max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <LandingGlowCard glow="pink" className="p-6 sm:p-8">
                <p className="mb-4 text-center text-sm text-[var(--solace-ds-text-muted)] sm:text-base">
                  Every new Solace account includes:
                </p>
                <p className="landing-serif mb-5 text-center text-2xl font-semibold text-white sm:text-3xl">
                  30 Free Minutes
                </p>
                <p className="mb-4 text-center text-sm text-white/82 sm:text-base">
                  Use them however you&apos;d like.
                </p>
                <ul className="mb-6 space-y-2">
                  {TRIAL_USES.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-sm text-[var(--solace-ds-text-muted)] sm:text-[15px]">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-pink-400/80" />
                      {line}
                    </li>
                  ))}
                </ul>
                <p className="mb-4 text-center text-sm font-semibold text-white sm:text-base">
                  Included During Your Trial
                </p>
                <ul className="mb-6 grid gap-2 sm:grid-cols-2">
                  {TRIAL_INCLUDES.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-white/82">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="flex justify-center">
                  <div onClick={startTrial}>
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
                </div>
              </LandingGlowCard>
            </motion.div>
          </div>
        </section>

        {/* When People Decide to Continue */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading title="When People Decide to Continue" />

          <div className="mx-auto flex max-w-4xl flex-col gap-8">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center text-sm leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-base"
            >
              Most people don&apos;t join because they&apos;re looking for another app. They join
              because they&apos;re carrying something.
            </motion.p>

            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              {WHEN_CONTINUE_MOMENTS.map((moment, index) => (
                <motion.div
                  key={moment.text}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(index === 4 && "sm:col-span-2")}
                >
                  <LandingGlowCard
                    glow={moment.glow}
                    className="flex h-full w-full flex-row items-center gap-2.5 p-3 sm:gap-3 sm:p-3.5"
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br",
                        moment.iconClass,
                      )}
                    >
                      <moment.icon className="h-4 w-4 text-white" />
                    </div>
                    <p className="min-w-0 flex-1 text-left text-sm leading-snug text-white/85 sm:text-[15px]">
                      {moment.text}
                    </p>
                  </LandingGlowCard>
                </motion.div>
              ))}
            </div>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center text-sm leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-base"
            >
              When people discover the value of having somewhere to talk things through, many
              choose to continue so they can return whenever they need it. That&apos;s where Core
              and Pro come in.
            </motion.p>
          </div>
        </section>

        {/* You're Not Paying for Minutes */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading title="You're Not Paying for Minutes" />

          <div className="mx-auto max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <LandingGlowCard glow="purple" className="space-y-5 p-6 sm:p-8">
                <p className="text-center text-base font-medium text-white sm:text-lg">
                  You&apos;re paying for somewhere to return when life feels heavy.
                </p>
                <p className="text-center text-sm leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-base">
                  The value of Solace isn&apos;t measured in minutes. It&apos;s measured in having
                  a place available when you need it.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {VALUE_PLACES.map((line) => (
                    <div
                      key={line}
                      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5"
                    >
                      <Sparkles className="h-4 w-4 shrink-0 text-violet-300" />
                      <span className="text-sm text-white/82">{line}</span>
                    </div>
                  ))}
                </div>
                <p className="text-center text-sm text-[var(--solace-ds-text-muted)] sm:text-base">
                  The plans simply determine how much access you want to that experience.
                </p>
              </LandingGlowCard>
            </motion.div>
          </div>
        </section>

        {/* Core & Pro Plans */}
        <section id="plans" className="landing-section py-12 md:py-16">
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 md:gap-8">
            <PaidPlanCard
              planId="core"
              description="For people who want a place they can return to whenever something is weighing on their mind. Whether it's a difficult week, a challenging decision, or everyday mental noise, Core provides ongoing access to the conversations that help people process what they're carrying."
              bestFor="People who want regular access to Solace as part of their personal reflection routine."
              includes={CORE_INCLUDES}
              includesLabel="Includes"
              loadingPlan={loadingPlan}
              onSelect={handlePaidPlan}
              index={0}
            />
            <PaidPlanCard
              planId="pro"
              description="For people who want Solace to be a consistent part of their ongoing reflection and wellness routine. Designed for users who value deeper continuity, more frequent conversations, and expanded access to the full Solace experience."
              bestFor="People who expect to use Solace regularly and want greater flexibility and continuity throughout the month."
              includes={PRO_INCLUDES}
              includesLabel="Includes Everything In Core Plus"
              loadingPlan={loadingPlan}
              onSelect={handlePaidPlan}
              index={1}
            />
          </div>
        </section>

        {/* Understanding Solace Plans */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading title="Understanding Solace Plans" />

          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {UNDERSTANDING_PLANS.map((item, index) => (
              <FaqCard key={item.question} question={item.question} answer={item.answer} index={index} />
            ))}
          </div>
        </section>

        {/* Compare Plans */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading title="Compare Plans" />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-4xl overflow-x-auto"
          >
            <LandingGlowCard glow="cyan" className="min-w-[640px] p-4 sm:p-6">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="pb-3 pr-4 font-semibold text-white">Feature</th>
                    <th className="pb-3 px-3 text-center font-semibold text-white">Trial</th>
                    <th className="pb-3 px-3 text-center font-semibold text-white">Core</th>
                    <th className="pb-3 pl-3 text-center font-semibold text-white">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row) => (
                    <tr key={row.feature} className="border-b border-white/[0.06] last:border-0">
                      <td className="py-3 pr-4 text-[var(--solace-ds-text-muted)]">{row.feature}</td>
                      <td className="px-3 py-3 text-center">
                        <CompareCell value={row.trial} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <CompareCell value={row.core} />
                      </td>
                      <td className="pl-3 py-3 text-center">
                        <CompareCell value={row.pro} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </LandingGlowCard>
          </motion.div>
        </section>

        {/* Why People Stay */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading title="Why People Stay" />

          <div className="mx-auto max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <LandingGlowCard glow="pink" className="space-y-5 p-6 sm:p-8">
                <p className="text-center text-sm leading-relaxed text-white/85 sm:text-base">
                  Solace isn&apos;t something people use because they have to. People return because
                  they know they have somewhere to go when life feels heavy.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {WHY_STAY_LINES.map((line) => (
                    <div
                      key={line}
                      className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3"
                    >
                      <Heart className="mt-0.5 h-4 w-4 shrink-0 text-pink-300" />
                      <span className="text-sm text-white/82">{line}</span>
                    </div>
                  ))}
                </div>
                <p className="text-center text-sm leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-base">
                  That&apos;s the value of Solace. Not more features. Not more complexity. Just a
                  place to talk when you need it.
                </p>
              </LandingGlowCard>
            </motion.div>
          </div>
        </section>

        {/* Frequent Questions */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading title="Frequent Questions" />

          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {FAQ_ITEMS.map((item, index) => (
              <FaqCard key={item.question} question={item.question} answer={item.answer} index={index} />
            ))}
          </div>
        </section>

        {/* Final CTA */}
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
                  Start with a conversation.
                </h2>
                <p className="mx-auto mt-2 max-w-lg text-base font-medium text-white/88 md:text-lg">
                  Everything else can come later.
                </p>
                <p className="mx-auto mt-3 max-w-lg text-sm text-[var(--solace-ds-text-muted)] md:text-base">
                  Try Solace with 30 free minutes. No credit card required. No pressure to continue.
                  Just a chance to experience what it&apos;s like to have somewhere to put the
                  thoughts you&apos;ve been carrying.
                </p>
                <div className="mt-6" onClick={startTrial}>
                  <Link to="/signup" className="inline-block w-full sm:w-auto">
                    <motion.span
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="landing-cta-glow inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#E91E63] to-[#9C27B0] px-10 py-3.5 text-base font-semibold text-white sm:w-auto"
                    >
                      Start With 30 Free Minutes
                    </motion.span>
                  </Link>
                </div>
              </div>
            </LandingGlowCard>
          </motion.div>
        </section>

        <PublicFooter />
      </div>
    </div>
  );
}
