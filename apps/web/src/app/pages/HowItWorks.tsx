import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  MessageCircle,
  Heart,
  Lightbulb,
  Brain,
  Bot,
  Activity,
  Layers,
  UserPlus,
  Users,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
  Zap,
  Mic,
  Volume2,
  HelpCircle,
  CloudMoon,
  Package,
  DoorOpen,
} from "lucide-react";
import { PublicNav } from "../components/PublicNav";
import { PublicFooter } from "../components/PublicFooter";
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
  "User Control",
  "No Credit Card Required",
] as const;

const TALK_IT_OUT_MOMENTS = [
  { text: "A conversation.", icon: MessageCircle, glow: "pink" as const, iconClass: "from-pink-500/90 to-fuchsia-600/90" },
  { text: "A decision.", icon: Lightbulb, glow: "amber" as const, iconClass: "from-amber-400/90 to-orange-500/90" },
  { text: "A worry.", icon: CloudMoon, glow: "purple" as const, iconClass: "from-violet-500/90 to-fuchsia-600/90" },
  { text: "A responsibility.", icon: Package, glow: "blue" as const, iconClass: "from-blue-400/90 to-indigo-600/90" },
  {
    text: "A feeling they haven't been able to put into words.",
    icon: Heart,
    glow: "green" as const,
    iconClass: "from-emerald-400/90 to-green-600/90",
  },
] as const;

const TALK_IT_OUT_CLOSING = [
  "Not to fix them.",
  "Not to diagnose them.",
  "Not to tell you what to do.",
  "But to give you somewhere to begin.",
] as const;

const UNDERSTANDING_TALK_IT_OUT = [
  {
    question: "What is Talk It Out?",
    answer:
      "Talk It Out is a private AI conversation experience that helps people express thoughts, process emotions, and gain clarity through conversation.",
    icon: MessageCircle,
    glow: "pink" as const,
    iconClass: "from-pink-500/90 to-fuchsia-600/90",
  },
  {
    question: "Who is it for?",
    answer:
      "People who are overthinking, carrying something difficult, feeling emotionally overloaded, or simply need someone to talk to when nobody else is available.",
    icon: Users,
    glow: "purple" as const,
    iconClass: "from-violet-500/90 to-fuchsia-600/90",
  },
  {
    question: "What makes it different?",
    answer:
      "Talk It Out focuses on expression and reflection rather than answers, advice, or judgment.",
    icon: Sparkles,
    glow: "cyan" as const,
    iconClass: "from-cyan-400/90 to-teal-500/90",
  },
] as const;

const CONVERSATION_STEPS = [
  {
    step: 1,
    title: "Start where you are.",
    lines: [
      "You don't need a plan.",
      "You don't need the right words.",
      "You don't need to know exactly what's bothering you.",
      "Just start with what's on your mind.",
    ],
    icon: DoorOpen,
    glow: "pink" as const,
    iconGlow: "text-pink-300 drop-shadow-[0_0_12px_rgba(236,72,153,0.6)]",
  },
  {
    step: 2,
    title: "Talk naturally.",
    lines: [
      "Speak the way you normally would.",
      "Share as much or as little as you want.",
      "There's no script.",
      "No expectation.",
      "No pressure to explain everything perfectly.",
    ],
    icon: Mic,
    glow: "purple" as const,
    iconGlow: "text-violet-300 drop-shadow-[0_0_12px_rgba(168,85,247,0.6)]",
  },
  {
    step: 3,
    title: "Reflect and process.",
    lines: [
      "As thoughts move from your head into conversation, they often become easier to understand.",
      "Patterns become clearer.",
      "Feelings become easier to name.",
      "The things you've been carrying can start to feel more manageable.",
    ],
    icon: Volume2,
    glow: "green" as const,
    iconGlow: "text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.6)]",
  },
] as const;

const TRAPPED_THOUGHTS = [
  "The conversation we keep replaying.",
  "The thing we wish we'd said.",
  "The decision we still haven't made.",
  "The worry we haven't shared.",
] as const;

const WHY_DIFFERENT_COMPARISONS = [
  {
    text: "Many AI tools are designed to answer questions.",
    icon: Bot,
    glow: "pink" as const,
    iconClass: "from-pink-500/90 to-fuchsia-600/90",
  },
  {
    text: "Many wellness tools are designed to track behaviors.",
    icon: Activity,
    glow: "cyan" as const,
    iconClass: "from-cyan-400/90 to-teal-500/90",
  },
  {
    text: "Many platforms are designed to solve problems.",
    icon: Layers,
    glow: "amber" as const,
    iconClass: "from-amber-400/90 to-orange-500/90",
  },
] as const;

const AFTER_CONVERSATION_OUTCOMES = [
  {
    title: "More clarity",
    description: "A better understanding of what's really bothering them.",
    icon: Lightbulb,
    glow: "amber" as const,
    iconClass: "from-amber-400/90 to-orange-500/90",
  },
  {
    title: "Less mental noise",
    description: "Fewer thoughts competing for attention.",
    icon: Brain,
    glow: "purple" as const,
    iconClass: "from-violet-500/90 to-fuchsia-600/90",
  },
  {
    title: "Greater perspective",
    description: "A different way of looking at what they're carrying.",
    icon: RotateCcw,
    glow: "cyan" as const,
    iconClass: "from-cyan-400/90 to-teal-500/90",
  },
  {
    title: "A lighter mental load",
    description: "Relief that comes from finally expressing something that's been sitting inside.",
    icon: Heart,
    glow: "pink" as const,
    iconClass: "from-pink-500/90 to-fuchsia-600/90",
  },
] as const;

const WHAT_HAPPENS_NEXT_STEPS = [
  {
    step: 1,
    title: "Create your account.",
    description: "Set up your profile and start your free experience.",
    icon: UserPlus,
    glow: "pink" as const,
    iconClass: "from-pink-500/90 to-fuchsia-600/90",
  },
  {
    step: 2,
    title: "Begin your first conversation.",
    description: "Choose a companion and start talking whenever you're ready.",
    icon: MessageCircle,
    glow: "purple" as const,
    iconClass: "from-violet-500/90 to-fuchsia-600/90",
  },
  {
    step: 3,
    title: "Use your 30 free minutes.",
    description: "Explore the experience and decide if it feels helpful for you.",
    icon: Sparkles,
    glow: "green" as const,
    iconClass: "from-emerald-400/90 to-green-600/90",
  },
] as const;

const WHAT_HAPPENS_NEXT_REASSURANCE = [
  "No long onboarding.",
  "No complicated setup.",
  "Just a place to start.",
] as const;

const FAQ_ITEMS = [
  {
    question: "Do I need to know what I want to talk about?",
    answer:
      "No. Many people start with a feeling rather than a clear topic. The goal isn't to have everything figured out before you begin.",
  },
  {
    question: "Do I have to talk about something serious?",
    answer:
      "Not at all. People use Solace for everything from everyday stress to major life decisions.",
  },
  {
    question: "Is Solace therapy?",
    answer:
      "No. Solace is not therapy and is not a replacement for professional mental health care. It is a conversation experience designed to support reflection and emotional processing.",
  },
  {
    question: "What if I don't know how to explain what I'm feeling?",
    answer:
      "That's completely okay. You don't need the perfect words. You just need somewhere to start.",
  },
  {
    question: "What if talking doesn't come naturally to me?",
    answer:
      "That's okay. You don't need to know exactly what to say. Many people begin with a single thought, feeling, or question. The conversation can start wherever you are. There is no right way to begin.",
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

export function HowItWorks() {
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
              You don&apos;t need the perfect words.
              <span className="landing-hero-title-accent bg-gradient-to-r from-pink-200 via-fuchsia-200 to-violet-100 bg-clip-text text-transparent">
                You just need somewhere to start.
              </span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex w-full max-w-4xl flex-col gap-4"
            >
              <p className="text-[15px] leading-relaxed text-white/88 sm:text-lg">
                Solace is built around a simple idea.
              </p>
              <LandingGlowCard glow="purple" className="px-5 py-4 sm:px-8 sm:py-5">
                <p className="text-sm leading-relaxed text-white/85 sm:text-base">
                  Sometimes the hardest part isn&apos;t understanding what you&apos;re feeling.
                </p>
                <p className="landing-serif mt-2 text-base font-medium text-white sm:text-lg">
                  It&apos;s having nowhere to put it.
                </p>
              </LandingGlowCard>
              <p className="mx-auto max-w-3xl text-sm leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-base">
                Talk It Out gives you a private space to start wherever you are, in your own words,
                at your own pace.
              </p>
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

        {/* What is Talk It Out? */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading
            title="What is"
            highlight="Talk It Out?"
            subtitle="The experience Solace was built around."
          />

          <div className="mx-auto flex max-w-4xl flex-col gap-8 md:gap-10">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="landing-serif mx-auto max-w-2xl text-center text-lg leading-relaxed text-white/88 sm:text-xl md:text-2xl md:leading-snug"
            >
              When people join Solace, they&apos;re usually carrying something they haven&apos;t been
              able to fully process.
            </motion.p>

            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {TALK_IT_OUT_MOMENTS.map((moment, index) => (
                <motion.div
                  key={moment.text}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(index === 4 && "sm:col-span-2 lg:col-span-1")}
                >
                  <LandingGlowCard
                    glow={moment.glow}
                    className="flex h-full items-center gap-4 p-4 sm:p-5"
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br",
                        moment.iconClass,
                      )}
                    >
                      <moment.icon className="h-[18px] w-[18px] text-white" />
                    </div>
                    <p className="text-left text-sm leading-relaxed text-white/85 sm:text-[15px]">
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
              <LandingGlowCard glow="pink" className="p-6 sm:p-8">
                <p className="mb-5 text-center text-sm text-[var(--solace-ds-text-muted)] sm:text-base">
                  Talk It Out was created for those moments.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  {TALK_IT_OUT_CLOSING.map((line) => (
                    <span
                      key={line}
                      className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold text-white/75 sm:text-sm"
                    >
                      {line}
                    </span>
                  ))}
                </div>
              </LandingGlowCard>
            </motion.div>
          </div>
        </section>

        {/* Understanding Talk It Out */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading title="Understanding Talk It Out" />

          <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-3 lg:gap-6">
            {UNDERSTANDING_TALK_IT_OUT.map((item, index) => (
              <motion.div
                key={item.question}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="flex"
              >
                <LandingGlowCard glow={item.glow} className="flex h-full w-full flex-col p-5 sm:p-6">
                  <div
                    className={cn(
                      "mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br",
                      item.iconClass,
                    )}
                  >
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="mb-3 text-lg font-semibold leading-snug text-white sm:text-xl">
                    {item.question}
                  </h3>
                  <p className="text-sm leading-[1.7] text-[var(--solace-ds-text-muted)] sm:text-[15px]">
                    {item.answer}
                  </p>
                </LandingGlowCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* How a Conversation Works */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading title="How a Conversation Works" />

          <div className="mx-auto flex max-w-5xl flex-col gap-5">
            {CONVERSATION_STEPS.map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
              >
                <LandingGlowCard glow={step.glow} className="overflow-hidden p-0">
                  <div className="flex flex-col lg:flex-row">
                    <div
                      className="relative flex min-h-[120px] items-center justify-center bg-cover bg-center lg:min-h-0 lg:w-[220px] lg:shrink-0"
                      style={{
                        backgroundImage: `linear-gradient(180deg, rgba(7,8,21,0.45) 0%, rgba(7,8,21,0.65) 100%), url("${LANDING_STEP_BACKGROUNDS[index]}")`,
                      }}
                    >
                      <step.icon className={cn("relative z-[1] h-10 w-10", step.iconGlow)} />
                    </div>
                    <div className="flex flex-1 flex-col p-5 sm:p-6 lg:p-7">
                      <span className="mb-2 inline-flex w-fit rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
                        Step {step.step}
                      </span>
                      <h3 className="mb-4 text-xl font-semibold text-white sm:text-2xl">
                        {step.title}
                      </h3>
                      <ul className="space-y-2">
                        {step.lines.map((line) => (
                          <li
                            key={line}
                            className="flex items-start gap-2.5 text-sm leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-[15px]"
                          >
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-pink-400/80 shadow-[0_0_8px_rgba(236,72,153,0.6)]" />
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </LandingGlowCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Why Talking Helps */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading title="Why Talking Helps" />

          <div className="mx-auto flex max-w-4xl flex-col gap-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <LandingGlowCard glow="purple" className="p-6 sm:p-8">
                <p className="landing-serif text-center text-lg leading-relaxed text-white/90 sm:text-xl">
                  Sometimes the hardest part isn&apos;t solving what&apos;s bothering you.
                </p>
                <p className="mt-3 text-center text-base font-medium text-white sm:text-lg">
                  It&apos;s having nowhere to put it.
                </p>
                <p className="mt-5 text-center text-sm leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-base">
                  Many thoughts stay heavy because they never leave our heads.
                </p>
              </LandingGlowCard>
            </motion.div>

            <div className="grid gap-3 sm:grid-cols-2">
              {TRAPPED_THOUGHTS.map((thought, index) => (
                <motion.div
                  key={thought}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                >
                  <LandingGlowCard glow="pink" className="flex items-center gap-3 p-4 sm:p-5">
                    <MessageCircle className="h-4 w-4 shrink-0 text-pink-300/80" />
                    <p className="text-sm text-white/82 sm:text-[15px]">{thought}</p>
                  </LandingGlowCard>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <LandingGlowCard glow="green" className="p-6 sm:p-8">
                <p className="mb-4 text-center text-sm text-[var(--solace-ds-text-muted)] sm:text-base">
                  When thoughts stay trapped internally, they often become louder.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {["Conversation creates space.", "Space creates perspective.", "Perspective creates understanding."].map(
                    (line) => (
                      <span
                        key={line}
                        className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold text-white/80 sm:text-sm"
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

        {/* Why Solace Feels Different */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading title="Why Solace" highlight="Feels Different" />

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
              <p className="mb-2 text-lg font-semibold leading-snug text-white md:text-xl">
                Most platforms focus on answers.
              </p>
              <p className="landing-serif text-xl leading-snug text-white/92 md:text-2xl">
                Solace focuses on expression.
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
                <LandingGlowCard glow={item.glow} className="flex h-full flex-col p-4 sm:p-5">
                  <div
                    className={cn(
                      "mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br",
                      item.iconClass,
                    )}
                  >
                    <item.icon className="h-4 w-4 text-white" />
                  </div>
                  <p className="text-left text-sm leading-relaxed text-white/82 sm:text-[15px]">
                    {item.text}
                  </p>
                </LandingGlowCard>
              </motion.div>
            ))}
          </div>

          <div className="mx-auto mb-6 max-w-2xl text-center">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="landing-serif text-lg text-white/88 sm:text-xl"
            >
              Solace begins earlier than that.
            </motion.p>
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
              <div className="mb-5 flex flex-wrap justify-center gap-2">
                {["Before solutions.", "Before advice.", "Before answers."].map((line) => (
                  <span
                    key={line}
                    className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/75"
                  >
                    {line}
                  </span>
                ))}
              </div>
              <p className="mb-5 text-center text-sm leading-relaxed text-[var(--solace-ds-text-muted)] md:text-base">
                Solace exists for the moment when you simply need somewhere to say it out loud.
              </p>
              <div className="border-l-2 border-pink-400/40 pl-4 sm:pl-5">
                <p className="landing-serif text-base italic leading-relaxed text-white/88 md:text-lg">
                  Because sometimes thoughts become lighter when they are finally expressed.
                </p>
              </div>
            </LandingGlowCard>
          </motion.div>
        </section>

        {/* What Happens After a Conversation? */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading
            title="What Happens After a"
            highlight="Conversation?"
            subtitle="Everyone leaves with something different."
          />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto mb-8 max-w-2xl"
          >
            <LandingGlowCard glow="purple" className="p-5 sm:p-6">
              <div className="flex flex-wrap justify-center gap-2">
                {["No perfect outcome.", "No checklist.", "No score.", "No pressure."].map((line) => (
                  <span
                    key={line}
                    className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-xs font-medium text-white/70 sm:text-sm"
                  >
                    {line}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-center text-sm text-[var(--solace-ds-text-muted)] sm:text-base">
                But many people describe leaving with:
              </p>
            </LandingGlowCard>
          </motion.div>

          <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 sm:auto-rows-[128px] sm:gap-4 [&>*]:min-w-0">
            {AFTER_CONVERSATION_OUTCOMES.map((outcome, index) => (
              <motion.div
                key={outcome.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
                className="flex h-[128px] w-full min-w-0 sm:h-full"
              >
                <LandingGlowCard
                  glow={outcome.glow}
                  className="box-border flex h-full w-full flex-row items-center gap-2.5 p-3 sm:gap-3 sm:p-3.5"
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br",
                      outcome.iconClass,
                    )}
                  >
                    <outcome.icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center">
                    <h3 className="mb-0.5 text-sm font-semibold leading-tight text-white sm:text-[15px]">
                      {outcome.title}
                    </h3>
                    <p className="text-xs leading-snug text-[var(--solace-ds-text-muted)] sm:text-sm">
                      {outcome.description}
                    </p>
                  </div>
                </LandingGlowCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* What Happens Next? */}
        <section className="landing-section py-12 md:py-16">
          <SectionHeading
            title="What Happens"
            highlight="Next?"
            subtitle="Getting started takes only a few minutes."
          />

          <div className="relative mx-auto mb-8 grid max-w-5xl gap-4 md:grid-cols-3 md:gap-5">
            <div
              className="pointer-events-none absolute left-[16.67%] right-[16.67%] top-[2.25rem] hidden h-px bg-gradient-to-r from-pink-400/20 via-violet-400/35 to-emerald-400/20 md:block"
              aria-hidden
            />
            {WHAT_HAPPENS_NEXT_STEPS.map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="relative flex"
              >
                <LandingGlowCard glow={step.glow} className="flex h-full w-full flex-col p-5 sm:p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br",
                        step.iconClass,
                      )}
                    >
                      <step.icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
                      Step {step.step}
                    </span>
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-white sm:text-lg">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-[var(--solace-ds-text-muted)]">
                    {step.description}
                  </p>
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
            <LandingGlowCard glow="green" className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {WHAT_HAPPENS_NEXT_REASSURANCE.map((line) => (
                  <span
                    key={line}
                    className="rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-1.5 text-xs font-medium text-white/75 sm:text-sm"
                  >
                    {line}
                  </span>
                ))}
              </div>
            </LandingGlowCard>
          </motion.div>
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
                  You don&apos;t have to carry everything alone.
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-sm text-[var(--solace-ds-text-muted)] md:text-base">
                  Start with 30 free minutes and see what changes when you finally have somewhere to
                  put the thoughts you&apos;ve been carrying.
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
                  No credit card required • No pressure to continue • Just a place to start when
                  you&apos;re ready
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
