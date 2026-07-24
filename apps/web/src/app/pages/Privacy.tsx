import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  Shield,
  Heart,
  MessageCircle,
  Lightbulb,
  CloudMoon,
  CheckCircle2,
  ArrowRight,
  Zap,
  HelpCircle,
  AlertTriangle,
  UserCheck,
  Volume2,
  RotateCcw,
  HandHeart,
  Scale,
  Phone,
} from "lucide-react";
import { PublicNav } from "../components/PublicNav";
import { PublicFooter } from "../components/PublicFooter";
import { LandingBackground } from "../landing/LandingBackground";
import { LandingHeroScene } from "../landing/LandingHeroScene";
import { LandingGlowCard } from "../landing/LandingGlowCard";
import { LANDING_CTA_CARD_BG } from "../landing/landingImagery";
import { cn } from "@/lib/utils";

const HERO_TRUST = [
  "Private by Design",
  "Safety First",
  "User Control",
  "No Credit Card Required",
] as const;

const FIRST_RESPONSIBILITY_MOMENTS = [
  { text: "A conversation they keep replaying.", icon: MessageCircle, glow: "pink" as const, iconClass: "from-pink-500/90 to-fuchsia-600/90" },
  { text: "A decision they can't stop thinking about.", icon: Lightbulb, glow: "amber" as const, iconClass: "from-amber-400/90 to-orange-500/90" },
  { text: "A worry they haven't shared.", icon: CloudMoon, glow: "purple" as const, iconClass: "from-violet-500/90 to-fuchsia-600/90" },
  { text: "A feeling they don't know how to explain.", icon: Heart, glow: "green" as const, iconClass: "from-emerald-400/90 to-green-600/90" },
] as const;

const TRUST_EARNED_PILLARS = [
  "Through transparency.",
  "Through safety.",
  "Through clear boundaries.",
  "Through user control.",
  "And through creating an experience that always puts people before technology.",
] as const;

const UNDERSTANDING_SAFETY = [
  {
    question: "What does safety mean at Solace?",
    answer:
      "Safety means creating an experience that feels respectful, supportive, private, and designed around user wellbeing. It means helping people express what they're carrying without judgment, pressure, or expectations.",
    icon: Shield,
    glow: "green" as const,
    iconClass: "from-emerald-400/90 to-green-600/90",
  },
  {
    question: "Is Solace therapy?",
    answer:
      "No. Solace is a conversation experience designed to support reflection, expression, and emotional processing. It is not therapy and is not a replacement for professional mental health care.",
    icon: AlertTriangle,
    glow: "amber" as const,
    iconClass: "from-amber-400/90 to-orange-500/90",
  },
  {
    question: "How does Solace support user safety?",
    answer:
      "Solace includes user controls, built-in safeguards, and access to crisis resources when appropriate. The goal is to create a space that feels emotionally safe while maintaining clear boundaries around what Solace is designed to do.",
    icon: UserCheck,
    glow: "cyan" as const,
    iconClass: "from-cyan-400/90 to-teal-500/90",
  },
] as const;

const BUILT_AROUND_SAFETY = [
  {
    title: "Calm",
    description: "A space where conversations can happen at your own pace.",
    icon: Volume2,
    glow: "purple" as const,
    iconClass: "from-violet-500/90 to-fuchsia-600/90",
  },
  {
    title: "Respectful",
    description: "Your thoughts are met with curiosity, not criticism.",
    icon: HandHeart,
    glow: "pink" as const,
    iconClass: "from-pink-500/90 to-fuchsia-600/90",
  },
  {
    title: "Supportive",
    description: "The experience is designed to encourage reflection rather than judgment.",
    icon: Heart,
    glow: "green" as const,
    iconClass: "from-emerald-400/90 to-green-600/90",
  },
  {
    title: "Consistent",
    description: "You can return whenever you need a place to talk things through.",
    icon: RotateCcw,
    glow: "cyan" as const,
    iconClass: "from-cyan-400/90 to-teal-500/90",
  },
] as const;

const PRIVACY_CHOICES = [
  "You decide what you choose to share.",
  "You decide what stays private.",
  "You decide when conversations begin.",
  "You decide when conversations end.",
  "You remain in control of your experience.",
] as const;

const WHAT_SOLACE_IS = [
  "A place to talk through thoughts.",
  "A space for reflection.",
  "A conversation experience designed to help people express what's on their mind.",
  "A tool that supports emotional processing and personal reflection.",
] as const;

const WHAT_SOLACE_IS_NOT = [
  "Solace is not therapy.",
  "Solace is not a replacement for professional mental health care.",
  "Solace is not emergency support.",
  "Solace is not crisis intervention.",
  "Solace is not designed to diagnose, treat, or provide medical advice.",
] as const;

const CRISIS_RESPONSE =
  "If conversations suggest someone may need additional support, Solace may surface crisis resources and encourage connection with trusted people, professional care providers, local support services, or emergency resources when appropriate." as const;

const YOUR_CONTROL = [
  "When to start a conversation.",
  "What to talk about.",
  "What to share.",
  "When to pause.",
  "When to stop.",
  "When to return.",
] as const;

const FAQ_ITEMS = [
  {
    question: "Is Solace therapy?",
    answer:
      "No. Solace is a conversation experience designed to support reflection and emotional processing. It is not therapy and is not a replacement for professional mental health care.",
  },
  {
    question: "Is Solace available during a crisis?",
    answer:
      "Solace is not a crisis intervention service. If someone may need immediate support, Solace can encourage access to crisis resources and appropriate emergency services.",
  },
  {
    question: "Can I use Solace without talking about deeply personal things?",
    answer:
      "Absolutely. People use Solace for everyday stress, life decisions, overthinking, relationship concerns, work challenges, and many other topics.",
  },
  {
    question: "Do I have control over my experience?",
    answer: "Yes. You decide when to talk, what to share, and when to return.",
  },
  {
    question: "What if I don't trust AI yet?",
    answer:
      "That's okay. Many people begin cautiously. You don't need to share anything you're uncomfortable sharing. Trust develops over time, and you remain in control of your experience every step of the way.",
  },
  {
    question: "Why does Solace focus so much on trust?",
    answer:
      "Because meaningful conversations only happen when people feel safe enough to have them.",
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

export function Privacy() {
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
              The things that matter most
              <span className="landing-hero-title-accent bg-gradient-to-r from-pink-200 via-fuchsia-200 to-violet-100 bg-clip-text text-transparent">
                deserve a safe place to be said.
              </span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex w-full max-w-3xl flex-col gap-4"
            >
              <p className="text-[15px] leading-relaxed text-white/88 sm:text-lg">
                When people talk about what&apos;s really on their mind, trust matters.
              </p>
              <LandingGlowCard glow="purple" className="px-5 py-4 sm:px-8 sm:py-5">
                <p className="text-sm leading-relaxed text-white/85 sm:text-base">
                  That&apos;s why safety, privacy, and user control are not features inside Solace.
                </p>
                <p className="landing-serif mt-2 text-base font-medium text-white sm:text-lg">
                  They&apos;re part of the foundation everything else is built on.
                </p>
              </LandingGlowCard>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
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

        {/* Our First Responsibility */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading title="Our First Responsibility" />

          <div className="mx-auto flex max-w-4xl flex-col gap-8 md:gap-10">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="landing-serif mx-auto max-w-2xl text-center text-lg leading-relaxed text-white/88 sm:text-xl md:text-2xl md:leading-snug"
            >
              Before someone can feel heard, they need to feel safe.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mx-auto max-w-2xl text-center text-sm leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-base"
            >
              Many people come to Solace carrying thoughts they&apos;ve never fully expressed.
            </motion.p>

            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              {FIRST_RESPONSIBILITY_MOMENTS.map((moment, index) => (
                <motion.div
                  key={moment.text}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
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

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <LandingGlowCard glow="purple" className="p-6 sm:p-8">
                <p className="mb-4 text-center text-sm font-medium text-white/88 sm:text-base">
                  We believe those moments deserve care.
                </p>
                <p className="mb-4 text-center text-sm leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-base">
                  That&apos;s why every part of Solace is designed around creating an experience
                  that feels calm, welcoming, respectful, and judgment-free.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <span className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold text-white/75 sm:text-sm">
                    Trust isn&apos;t something we add later.
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold text-white/75 sm:text-sm">
                    Trust comes first.
                  </span>
                </div>
              </LandingGlowCard>
            </motion.div>
          </div>
        </section>

        {/* Trust Has to Be Earned */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading title="Trust Has to Be Earned" />

          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <LandingGlowCard glow="pink" className="space-y-4 p-6 sm:p-8">
                <p className="text-center text-sm leading-relaxed text-white/85 sm:text-base">
                  We understand why people are cautious. Sharing personal thoughts can feel
                  vulnerable. Sharing them with technology can feel even more vulnerable.
                </p>
                <p className="text-center text-base font-medium text-white sm:text-lg">
                  That&apos;s a reasonable concern.
                </p>
                <p className="text-center text-sm leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-base">
                  Trust isn&apos;t something Solace expects from people. It&apos;s something we work
                  to earn.
                </p>
              </LandingGlowCard>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <LandingGlowCard glow="green" className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {TRUST_EARNED_PILLARS.map((line) => (
                    <span
                      key={line}
                      className="rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-white/80 sm:text-sm"
                    >
                      {line}
                    </span>
                  ))}
                </div>
              </LandingGlowCard>
            </motion.div>
          </div>
        </section>

        {/* Understanding Safety at Solace — `#safety` is deep-linked from the pre-launch FAQ. */}
        <section id="safety" className="landing-section scroll-mt-24 py-12 md:py-16">
          <SectionHeading title="Understanding Safety at Solace" />

          <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-3 lg:gap-6">
            {UNDERSTANDING_SAFETY.map((item, index) => (
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
                  className="flex h-full w-full flex-row items-start gap-3 p-4 sm:gap-4 sm:p-5"
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br",
                      item.iconClass,
                    )}
                  >
                    <item.icon className="h-5 w-5 text-white" />
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

        {/* Built Around Safety */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading
            title="Built Around Safety"
            subtitle="Safety is part of the experience, not an afterthought."
          />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto mb-8 max-w-2xl"
          >
            <LandingGlowCard glow="purple" className="p-6 sm:p-8">
              <p className="text-center text-sm leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-base">
                The goal of Solace is simple.
              </p>
              <p className="mt-3 text-center text-sm leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-base">
                To provide a place where people can talk through what&apos;s on their mind without
                feeling judged, pressured, or rushed.
              </p>
              <p className="mt-4 text-center text-sm font-medium text-white/88 sm:text-base">
                That means creating an environment that feels:
              </p>
            </LandingGlowCard>
          </motion.div>

          <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 sm:auto-rows-[128px] sm:gap-4 [&>*]:min-w-0">
            {BUILT_AROUND_SAFETY.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
                className="flex h-[128px] w-full min-w-0 sm:h-full"
              >
                <LandingGlowCard
                  glow={item.glow}
                  className="box-border flex h-full w-full flex-row items-center gap-2.5 p-3 sm:gap-3 sm:p-3.5"
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br",
                      item.iconClass,
                    )}
                  >
                    <item.icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center">
                    <h3 className="mb-0.5 text-sm font-semibold leading-tight text-white sm:text-[15px]">
                      {item.title}
                    </h3>
                    <p className="text-xs leading-snug text-[var(--solace-ds-text-muted)] sm:text-sm">
                      {item.description}
                    </p>
                  </div>
                </LandingGlowCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Your Privacy */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading
            title="Your Privacy"
            subtitle="Your thoughts belong to you."
          />

          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center text-sm leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-base"
            >
              When people open up, privacy matters. We believe personal conversations should be
              treated with care and respect.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <LandingGlowCard glow="blue" className="p-6 sm:p-8">
                <p className="mb-5 text-center text-sm font-semibold text-white sm:text-base">
                  What this means
                </p>
                <ul className="space-y-3">
                  {PRIVACY_CHOICES.map((choice) => (
                    <li key={choice} className="flex items-start gap-2.5">
                      <CheckCircle2 className="landing-check-glow mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span className="text-sm text-[var(--solace-ds-text-muted)] sm:text-[15px]">
                        {choice}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-center text-sm leading-relaxed text-white/82 sm:text-base">
                  Because meaningful conversations require trust.
                </p>
                <p className="mt-2 text-center text-sm leading-relaxed text-white/82 sm:text-base">
                  And trust requires choice.
                </p>
              </LandingGlowCard>
            </motion.div>
          </div>
        </section>

        {/* What Solace Is and Is Not */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading
            title="What Solace Is and Is Not"
            subtitle="Clear boundaries create better trust."
          />

          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2 md:gap-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <LandingGlowCard glow="green" className="h-full p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400/90 to-green-600/90">
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">What Solace Is</h3>
                </div>
                <ul className="space-y-2.5">
                  {WHAT_SOLACE_IS.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-sm text-[var(--solace-ds-text-muted)] sm:text-[15px]">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/80" />
                      {line}
                    </li>
                  ))}
                </ul>
              </LandingGlowCard>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.06 }}
            >
              <LandingGlowCard glow="amber" className="h-full p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/90 to-orange-500/90">
                    <Scale className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">What Solace Is Not</h3>
                </div>
                <ul className="space-y-2.5">
                  {WHAT_SOLACE_IS_NOT.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-sm text-[var(--solace-ds-text-muted)] sm:text-[15px]">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/80" />
                      {line}
                    </li>
                  ))}
                </ul>
              </LandingGlowCard>
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto mt-6 max-w-2xl text-center text-sm text-[var(--solace-ds-text-muted)] sm:text-base"
          >
            Being clear about these boundaries helps people use Solace in the way it was intended.
          </motion.p>
        </section>

        {/* When Someone Needs More Than Solace */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading title="When Someone Needs More Than Solace" />

          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <LandingGlowCard glow="pink" className="space-y-4 p-6 sm:p-8">
                <p className="text-center text-sm leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-base">
                  Some situations require additional support. There are moments when talking things
                  through is not enough. Moments when someone may need immediate help, professional
                  care, or crisis support.
                </p>
                <p className="text-center text-sm leading-relaxed text-white/85 sm:text-base">
                  In those moments, Solace is designed to encourage connection with appropriate
                  support resources.
                </p>
              </LandingGlowCard>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <LandingGlowCard glow="purple" className="p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/90 to-fuchsia-600/90">
                    <Phone className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-base font-semibold text-white sm:text-lg">How Solace Responds</h3>
                </div>
                <p className="text-sm leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-[15px]">
                  {CRISIS_RESPONSE}
                </p>
                <p className="mt-5 text-sm leading-relaxed text-white/82 sm:text-[15px]">
                  Because some situations deserve more than a conversation.
                </p>
              </LandingGlowCard>
            </motion.div>
          </div>
        </section>

        {/* Your Control */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading
            title="Your Control"
            subtitle="You decide what happens next."
          />

          <div className="mx-auto max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <LandingGlowCard glow="cyan" className="p-6 sm:p-8">
                <p className="mb-5 text-center text-sm leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-base">
                  One of the most important principles behind Solace is user choice.
                </p>
                <p className="mb-4 text-center text-sm font-semibold text-white sm:text-base">
                  You decide:
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {YOUR_CONTROL.map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5"
                    >
                      <UserCheck className="h-4 w-4 shrink-0 text-cyan-300" />
                      <span className="text-sm text-white/82 sm:text-[15px]">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  {["There is no pressure.", "No obligation.", "No expectation."].map((line) => (
                    <span
                      key={line}
                      className="rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-white/80 sm:text-sm"
                    >
                      {line}
                    </span>
                  ))}
                </div>
                <p className="mt-5 text-center text-sm text-[var(--solace-ds-text-muted)] sm:text-base">
                  Just a place to talk when you need it.
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
                  The things that matter most deserve a safe place to be said.
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-sm text-[var(--solace-ds-text-muted)] md:text-base">
                  If you&apos;ve been carrying something that feels difficult to put down, you
                  don&apos;t have to carry it alone.
                </p>
                <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--solace-ds-text-muted)] md:text-base">
                  Start with 30 free minutes.
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
                      Start With 30 Free Minutes
                    </motion.span>
                  </Link>
                </div>
                <p className="mt-3 text-sm text-[var(--solace-ds-text-muted)]">
                  No credit card required • No pressure to continue • Just a safe place to start.
                </p>
              </div>
            </LandingGlowCard>
          </motion.div>
        </section>

        <PublicFooter />
      </div>
    </div>
  );
}
