import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Sparkles, Heart, Clock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND_LOGO_ON_DARK_BG } from "@/app/components/BrandLogo";
import { ONBOARDING_WELCOME_BG } from "@/lib/solace/referenceImagery";

const SOLACE_LOGO_SRC = BRAND_LOGO_ON_DARK_BG;
const ONBOARDING_NAV_H = "5rem";
const CURRENT_STEP = 1;
const TOTAL_STEPS = 8;
const PROGRESS_PERCENT = (CURRENT_STEP / TOTAL_STEPS) * 100;

const features = [
  {
    icon: Heart,
    title: "Personalized Support",
    description: "AI-powered sessions tailored to your needs",
    glowClass:
      "shadow-[0_0_36px_-4px_rgba(255,78,145,0.55)] ring-[#FF4E91]/35 text-[#fda4cf]",
    ringClass: "from-[#FF4E91]/55 to-purple-900/20",
  },
  {
    icon: Clock,
    title: "Available 24/7",
    description: "Connect with Solace whenever you need",
    glowClass:
      "shadow-[0_0_36px_-4px_rgba(138,79,255,0.5)] ring-[#8A4FFF]/35 text-[#d8b4fe]",
    ringClass: "from-[#8A4FFF]/55 to-indigo-900/25",
  },
  {
    icon: Shield,
    title: "Private & Secure",
    description: "Your conversations are always protected",
    glowClass:
      "shadow-[0_0_36px_-4px_rgba(233,30,99,0.45)] ring-[#E91E63]/30 text-[#fda4cf]",
    ringClass: "from-[#E91E63]/50 to-violet-900/20",
  },
] as const;

function WelcomeSceneBackdrop() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
    >
      <img
        src={ONBOARDING_WELCOME_BG}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[center_42%]"
        width={2400}
        height={1350}
        fetchPriority="high"
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_55%,rgba(138,79,255,0.22)_0%,transparent_58%)]"
        animate={{ opacity: [0.65, 0.9, 0.65] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_55%_40%_at_50%_72%,rgba(255,78,145,0.18)_0%,transparent_62%)]"
        animate={{ opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_120%_90%_at_50%_100%,rgba(5,6,18,0.88)_0%,transparent_55%)]"
        animate={{ opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_50%_0%,rgba(10,11,30,0.72)_0%,transparent_50%)]"
        animate={{ opacity: [0.7, 0.95, 0.7] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />
      <div className="absolute inset-0 bg-[#0A0B1E]/45" />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_48%,rgba(10,11,30,0.35)_0%,rgba(10,11,30,0.82)_100%)]"
        animate={{ opacity: [0.75, 0.92, 0.75] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_50%,transparent_35%,rgba(0,0,0,0.55)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,18,0.35)_0%,rgba(5,6,18,0.15)_38%,rgba(5,6,18,0.55)_100%)]" />

      {[
        { left: "12%", top: "68%", delay: 0 },
        { left: "28%", top: "74%", delay: 0.8 },
        { left: "44%", top: "70%", delay: 1.6 },
        { left: "58%", top: "76%", delay: 0.4 },
        { left: "72%", top: "71%", delay: 1.2 },
        { left: "86%", top: "75%", delay: 2 },
        { left: "18%", top: "58%", delay: 1.4 },
        { left: "52%", top: "62%", delay: 0.6 },
        { left: "78%", top: "60%", delay: 1.8 },
      ].map((particle, index) => (
        <motion.span
          key={index}
          className="absolute h-1 w-1 rounded-full bg-[#ffb86b]/80 shadow-[0_0_8px_rgba(255,184,107,0.65)]"
          style={{ left: particle.left, top: particle.top }}
          animate={{ opacity: [0.25, 0.85, 0.25], y: [0, -6, 0] }}
          transition={{
            duration: 4.5 + (index % 3),
            repeat: Infinity,
            ease: "easeInOut",
            delay: particle.delay,
          }}
        />
      ))}
    </motion.div>
  );
}

interface WelcomeTopBarProps {
  progressPercent: number;
}

function WelcomeTopBar({ progressPercent }: WelcomeTopBarProps) {
  return (
    <header
      className={cn(
        "relative z-50 shrink-0 border-b border-white/[0.08] bg-[#070815]/72 backdrop-blur-2xl",
        "shadow-[inset_0_-1px_0_rgba(255,78,145,0.12)] supports-[backdrop-filter]:bg-[#070815]/50",
      )}
      style={{ height: ONBOARDING_NAV_H }}
    >
      <motion.div
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#FF4E91]/25 to-transparent"
        animate={{ opacity: [0.4, 0.75, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      <motion.div
        className="mx-auto flex h-full max-w-[1200px] flex-col justify-center gap-3 px-4 py-3 sm:px-6 lg:px-8 md:hidden"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <motion.div
          className="flex items-center justify-between gap-3"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src={SOLACE_LOGO_SRC}
              alt="Solace"
              className="h-8 w-auto object-contain"
            />
            <span className="h-5 w-px shrink-0 bg-white/15" aria-hidden />
            <span className="text-sm font-medium tracking-wide text-white/90">Solace</span>
          </div>
          <p className="shrink-0 text-xs text-violet-200/65">
            Step {CURRENT_STEP} of {TOTAL_STEPS}
          </p>
        </motion.div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/[0.04] backdrop-blur-sm">
          <motion.div
            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[#FF4E91] via-[#d946ef] to-[#8A4FFF] shadow-[0_0_16px_-2px_rgba(255,78,145,0.55)]"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        </div>
      </motion.div>

      <div className="mx-auto hidden h-full max-w-[1200px] items-center gap-6 px-6 lg:px-8 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto]">
        <div className="flex items-center gap-3">
          <img
            src={SOLACE_LOGO_SRC}
            alt="Solace"
            className="h-9 w-auto object-contain"
          />
          <span className="h-6 w-px bg-white/15" aria-hidden />
          <span className="text-[15px] font-medium tracking-wide text-white/92">Solace</span>
        </div>

        <div className="px-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/[0.04] backdrop-blur-sm">
            <motion.div
              className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[#FF4E91] via-[#d946ef] to-[#8A4FFF] shadow-[0_0_16px_-2px_rgba(255,78,145,0.55)]"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          </div>
        </div>

        <p className="shrink-0 text-sm text-violet-200/65">
          Step {CURRENT_STEP} of {TOTAL_STEPS}
        </p>
      </div>
    </header>
  );
}

interface FeatureIconCapsuleProps {
  icon: typeof Heart;
  glowClass: string;
  ringClass: string;
}

function FeatureIconCapsule({ icon: Icon, glowClass, ringClass }: FeatureIconCapsuleProps) {
  return (
    <motion.div
      className={cn(
        "relative mx-auto mb-3 flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-black/35 ring-1 backdrop-blur-md sm:mb-4 sm:h-[58px] sm:w-[58px]",
        glowClass,
      )}
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br opacity-55 blur-[2px]",
          ringClass,
        )}
        animate={{ opacity: [0.45, 0.7, 0.45] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <Icon className="relative z-[1] h-6 w-6" strokeWidth={1.75} aria-hidden />
    </motion.div>
  );
}

interface WelcomeFeatureCardProps {
  icon: typeof Heart;
  title: string;
  description: string;
  glowClass: string;
  ringClass: string;
  delay?: number;
}

function WelcomeFeatureCard({
  icon,
  title,
  description,
  glowClass,
  ringClass,
  delay = 0,
}: WelcomeFeatureCardProps) {
  return (
    <motion.article
      className={cn(
        "flex flex-col rounded-[1.75rem] border border-white/[0.1] bg-white/[0.04] px-5 py-5 text-center backdrop-blur-xl sm:px-6 sm:py-6",
        "shadow-[0_0_0_1px_rgba(138,79,255,0.08),0_24px_60px_-32px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.05)]",
        "transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1",
        "hover:border-[#FF4E91]/25 hover:shadow-[0_0_48px_-16px_rgba(255,78,145,0.35),0_28px_64px_-28px_rgba(0,0,0,0.9)]",
      )}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
    >
      <FeatureIconCapsule icon={icon} glowClass={glowClass} ringClass={ringClass} />
      <h3 className="text-[15px] font-semibold tracking-wide text-[#FDFDFD]">{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-violet-200/62">{description}</p>
    </motion.article>
  );
}

export function OnboardingWelcome() {
  return (
    <motion.div
      className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#0A0B1E] text-[#FDFDFD]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <WelcomeSceneBackdrop />
      <WelcomeTopBar progressPercent={PROGRESS_PERCENT} />

      <main className="relative z-10 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col items-center gap-[clamp(0.65rem,1.5vh,1.1rem)] px-4 py-5 pb-12 sm:gap-4 sm:px-6 sm:py-6 sm:pb-14 md:px-8 lg:px-10 lg:py-8">
          <motion.header
            className="text-center"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <h1 className="solace-login-serif text-[clamp(2rem,4.8vw,3.35rem)] font-medium leading-[1.12] text-[#FDFDFD] drop-shadow-[0_2px_28px_rgba(0,0,0,0.45)]">
              Welcome to Solace! 👋
            </h1>
            <p className="mt-2 text-[clamp(1rem,2vw,1.25rem)] leading-relaxed text-violet-200/72">
              Let&apos;s set up your personalized wellness experience
            </p>
          </motion.header>

          <motion.div
            className="relative flex justify-center"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.08, duration: 0.55, ease: "easeOut" }}
          >
            <div
              className="pointer-events-none absolute inset-0 -z-10 scale-110 rounded-full bg-[radial-gradient(circle,rgba(255,78,145,0.22)_0%,transparent_68%)] blur-2xl"
              aria-hidden
            />
            <img
              src={SOLACE_LOGO_SRC}
              alt="Solace"
              className="w-[clamp(140px,22vw,260px)] object-contain drop-shadow-[0_8px_40px_rgba(138,79,255,0.28)]"
            />
            <motion.div
              className="absolute -right-1 -top-1 text-[#FF4E91] drop-shadow-[0_0_14px_rgba(255,78,145,0.65)]"
              animate={{ opacity: [0.7, 1, 0.7], y: [0, -3, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
            >
              <Sparkles className="h-7 w-7" />
            </motion.div>
          </motion.div>

          <motion.div
            className="relative w-full max-w-[min(760px,92vw)]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.55, ease: "easeOut" }}
          >
            <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#FF4E91]/35 bg-[#0A0B1E]/80 shadow-[0_0_28px_-4px_rgba(255,78,145,0.55)] backdrop-blur-md">
                <Heart
                  className="h-5 w-5 text-[#FF4E91] drop-shadow-[0_0_10px_rgba(255,78,145,0.45)]"
                  aria-hidden
                />
              </div>
            </div>
            <motion.div
              className={cn(
                "rounded-[1.75rem] border border-[#8A4FFF]/25 bg-white/[0.045] px-5 pb-6 pt-9 text-center backdrop-blur-xl sm:px-8 sm:pb-8 sm:pt-10",
                "shadow-[0_0_0_1px_rgba(255,78,145,0.08),0_24px_64px_-28px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.05)]",
              )}
              whileHover={{
                boxShadow:
                  "0 0 0 1px rgba(255,78,145,0.12), 0 28px 72px -24px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-[clamp(1rem,2.1vw,1.2rem)] leading-[1.65] text-[#FDFDFD]/92">
                We&apos;ll ask you a few questions to personalize your experience.
                <br className="hidden sm:inline" /> This will only take{" "}
                <span className="font-semibold text-[#FF4E91]">3–5 minutes</span>.
              </p>
            </motion.div>
          </motion.div>

          <div className="grid w-full max-w-[min(920px,100%)] grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
            {features.map((feature, index) => (
              <WelcomeFeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                glowClass={feature.glowClass}
                ringClass={feature.ringClass}
                delay={0.2 + index * 0.06}
              />
            ))}
          </div>

          <motion.div
            className="mt-1 flex w-full max-w-[min(760px,100%)] shrink-0 flex-col items-center gap-3 sm:mt-2"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.55, ease: "easeOut" }}
          >
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }} className="w-full">
              <Link
                to="/onboarding/profile-setup"
                className={cn(
                  "flex min-h-[3.25rem] w-full items-center justify-center rounded-[1.125rem] px-4 py-3.5 sm:min-h-[4rem] sm:py-4",
                  "bg-gradient-to-r from-[#FF4E91] via-[#d946ef] to-[#8A4FFF] text-base font-semibold text-white sm:text-[17px]",
                  "shadow-[0_0_40px_-8px_rgba(255,78,145,0.65)]",
                  "transition-[box-shadow,transform] duration-300",
                  "hover:shadow-[0_0_52px_-6px_rgba(138,79,255,0.55)]",
                )}
              >
                Let&apos;s Get Started →
              </Link>
            </motion.div>

            <p className="max-w-[min(640px,92vw)] pb-1 text-center text-[13px] leading-relaxed text-violet-200/55">
              You can <span className="font-medium text-[#FF4E91]">skip</span> optional questions
              and fill it later in the profile setup
            </p>
          </motion.div>
        </div>
      </main>
    </motion.div>
  );
}
