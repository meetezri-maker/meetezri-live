import { type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Flower2,
  Heart,
  LayoutGrid,
  Loader2,
  MessageSquare,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  Video,
} from "lucide-react";
import { useOnboarding } from "@/app/contexts/OnboardingContext";
import { useAuth } from "@/app/contexts/AuthContext";
import { useEffect, useRef } from "react";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
import { cn } from "@/lib/utils";
import { BRAND_LOGO_ON_DARK_BG } from "@/app/components/BrandLogo";

const COMPLETION_BG = "/solace/onboarding-complete-twilight-lake.jpg";
const SOLACE_LOGO_SRC = BRAND_LOGO_ON_DARK_BG;
const ONBOARDING_NAV_H = "5rem";
const CURRENT_STEP = 8;
const TOTAL_STEPS = 8;
const PROGRESS_PERCENT = 100;

const glassCardClass = cn(
  "relative w-full rounded-[28px] border border-[#FF4E91]/22 bg-[#0A0B1E]/48 backdrop-blur-2xl",
  "shadow-[0_0_0_1px_rgba(138,79,255,0.1),0_28px_72px_-32px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)]",
  "transition-[border-color,box-shadow,transform] duration-300",
  "hover:border-[#FF4E91]/32 hover:shadow-[0_0_40px_-16px_rgba(255,78,145,0.35)]",
);

const quickTipCardClass = cn(
  "flex h-full flex-col items-center rounded-[24px] border border-violet-400/18 bg-[#0A0B1E]/45 px-6 py-7 text-center backdrop-blur-xl",
  "shadow-[0_0_0_1px_rgba(138,79,255,0.08),0_20px_56px_-28px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.04)]",
  "transition-[transform,box-shadow,border-color] duration-300",
  "hover:-translate-y-1 hover:border-[#FF4E91]/22 hover:shadow-[0_0_44px_-16px_rgba(255,78,145,0.32)]",
);

const quickTips = [
  {
    icon: Video,
    title: "Start a Session",
    description: "Connect with Solace anytime you need support",
    linkPath: "/app/session-lobby",
    glowClass: "shadow-[0_0_36px_-6px_rgba(56,189,248,0.55)] ring-1 ring-cyan-400/30",
    ringClass: "from-cyan-400/55 to-sky-900/25",
    iconClass: "text-cyan-200",
  },
  {
    icon: MessageSquare,
    title: "Daily Check-ins",
    description: "Track your mood and emotional patterns",
    linkPath: "/app/mood-checkin",
    glowClass: "shadow-[0_0_36px_-6px_rgba(138,79,255,0.5)] ring-1 ring-violet-400/30",
    ringClass: "from-violet-400/55 to-purple-900/25",
    iconClass: "text-violet-200",
  },
  {
    icon: TrendingUp,
    title: "View Progress",
    description: "See your wellness journey over time",
    linkPath: "/app/progress",
    glowClass: "shadow-[0_0_36px_-6px_rgba(52,211,153,0.5)] ring-1 ring-emerald-400/28",
    ringClass: "from-emerald-400/55 to-emerald-900/20",
    iconClass: "text-emerald-200",
  },
] as const;

const whatsNextItems = [
  "Your profile is complete and saved",
  "Solace is ready for your first session",
  "You can customize settings anytime",
  "Emergency resources are available 24/7",
] as const;

function CompleteSceneBackdrop() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
    >
      <img
        src={COMPLETION_BG}
        alt=""
        className="absolute inset-0 h-full w-full scale-105 object-cover object-[center_40%]"
        width={2400}
        height={1350}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_90%_65%_at_50%_42%,rgba(177,77,255,0.26)_0%,transparent_58%)]"
        animate={{ opacity: [0.55, 0.82, 0.55] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_65%_50%_at_50%_68%,rgba(255,78,145,0.2)_0%,transparent_62%)]"
        animate={{ opacity: [0.45, 0.72, 0.45] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_120%_88%_at_50%_100%,rgba(5,6,18,0.92)_0%,transparent_52%)]"
        animate={{ opacity: [0.88, 1, 0.88] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_100%_72%_at_50%_0%,rgba(7,8,21,0.78)_0%,transparent_48%)]"
        animate={{ opacity: [0.72, 0.94, 0.72] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_48%,rgba(255,78,145,0.12)_0%,transparent_70%)]"
        animate={{ opacity: [0.4, 0.65, 0.4] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_55%_40%_at_50%_72%,rgba(255,78,145,0.16)_0%,transparent_62%)]"
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
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_48%,rgba(10,11,30,0.35)_0%,rgba(10,11,30,0.82)_100%)]"
        animate={{ opacity: [0.75, 0.92, 0.75] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 bg-[#0A0B1E]/42" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_50%,transparent_32%,rgba(0,0,0,0.62)_100%)]" />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_50%,transparent_22%,rgba(0,0,0,0.7)_100%)]"
        animate={{ opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,18,0.35)_0%,rgba(5,6,18,0.12)_38%,rgba(5,6,18,0.55)_100%)]"
        animate={{ opacity: [0.75, 0.95, 0.75] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />

      {[
        { left: "10%", top: "66%", delay: 0 },
        { left: "24%", top: "72%", delay: 0.8 },
        { left: "38%", top: "68%", delay: 1.6 },
        { left: "52%", top: "74%", delay: 0.4 },
        { left: "66%", top: "70%", delay: 1.2 },
        { left: "80%", top: "76%", delay: 2 },
        { left: "16%", top: "56%", delay: 1.4 },
        { left: "48%", top: "60%", delay: 0.6 },
        { left: "74%", top: "58%", delay: 1.8 },
        { left: "90%", top: "64%", delay: 0.9 },
        { left: "32%", top: "44%", delay: 2.2 },
        { left: "62%", top: "40%", delay: 1.1 },
      ].map((particle, index) => (
        <motion.span
          key={index}
          className="absolute h-1 w-1 rounded-full bg-[#ffb86b]/80 shadow-[0_0_8px_rgba(255,184,107,0.65)]"
          style={{ left: particle.left, top: particle.top }}
          animate={{ opacity: [0.2, 0.85, 0.2], y: [0, -6, 0] }}
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

interface CompleteTopBarProps {
  onBack: () => void;
}

function CompleteTopBar({ onBack }: CompleteTopBarProps) {
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
        <motion.div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4E91]/50"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <img src={SOLACE_LOGO_SRC} alt="Solace" className="h-8 w-auto object-contain" />
            <span className="h-5 w-px shrink-0 bg-white/15" aria-hidden />
            <span className="text-sm font-medium tracking-wide text-white/90">Solace</span>
          </div>
          <p className="shrink-0 text-xs text-violet-200/65">
            Step {CURRENT_STEP} of {TOTAL_STEPS}
          </p>
        </motion.div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/[0.04] backdrop-blur-sm">
          <motion.div
            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[#FF4E91] via-[#d946ef] to-[#34d399] shadow-[0_0_16px_-2px_rgba(255,78,145,0.55)]"
            initial={{ width: 0 }}
            animate={{ width: `${PROGRESS_PERCENT}%` }}
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

      <div className="mx-auto hidden h-full max-w-[1200px] items-center gap-4 px-6 lg:px-8 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto]">
        <motion.div
          className="flex items-center gap-2.5"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4E91]/50"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <img src={SOLACE_LOGO_SRC} alt="Solace" className="h-9 w-auto object-contain" />
          <span className="h-6 w-px bg-white/15" aria-hidden />
          <span className="text-[15px] font-medium tracking-wide text-white/92">Solace</span>
        </motion.div>

        <div className="px-2">
          <motion.div
            className="h-1.5 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/[0.04] backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <motion.div
              className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[#FF4E91] via-[#d946ef] to-[#34d399] shadow-[0_0_16px_-2px_rgba(255,78,145,0.55)]"
              initial={{ width: 0 }}
              animate={{ width: `${PROGRESS_PERCENT}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          </motion.div>
        </div>

        <p className="shrink-0 text-sm text-violet-200/65">
          Step {CURRENT_STEP} of {TOTAL_STEPS}
        </p>
      </div>
    </header>
  );
}

interface GlowingOrbProps {
  children: ReactNode;
  glowClass?: string;
  size?: "sm" | "md" | "lg";
}

function GlowingOrb({ children, glowClass, size = "md" }: GlowingOrbProps) {
  const sizeClass =
    size === "sm" ? "h-11 w-11" : size === "lg" ? "h-[88px] w-[88px]" : "h-14 w-14";
  return (
    <motion.div
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#0A0B1E]/70 backdrop-blur-md",
        sizeClass,
        glowClass,
      )}
      animate={{
        boxShadow: [
          "0 0 32px -8px rgba(255,78,145,0.35)",
          "0 0 48px -4px rgba(138,79,255,0.45)",
          "0 0 32px -8px rgba(255,78,145,0.35)",
        ],
      }}
      transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.div
        className="pointer-events-none absolute inset-1 rounded-full bg-gradient-to-br from-[#FF4E91]/25 via-[#8A4FFF]/20 to-transparent opacity-80"
        animate={{ opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div className="relative z-[1]">{children}</motion.div>
    </motion.div>
  );
}

function LotusWelcomeOrb() {
  return (
    <GlowingOrb
      size="lg"
      glowClass="shadow-[0_0_52px_-8px_rgba(255,78,145,0.5)] ring-1 ring-[#FF4E91]/25"
    >
      <Flower2
        className="h-9 w-9 text-[#fda4cf] drop-shadow-[0_0_16px_rgba(255,78,145,0.55)]"
        strokeWidth={1.25}
        aria-hidden
      />
    </GlowingOrb>
  );
}

function ShieldHeartOrb() {
  return (
    <GlowingOrb
      size="lg"
      glowClass="shadow-[0_0_52px_-8px_rgba(255,78,145,0.48)] ring-1 ring-[#FF4E91]/22"
    >
      <div className="relative flex items-center justify-center">
        <Shield
          className="h-9 w-9 text-[#fda4cf] drop-shadow-[0_0_14px_rgba(255,78,145,0.5)]"
          strokeWidth={1.25}
          aria-hidden
        />
        <Heart
          className="absolute h-4 w-4 fill-[#FF4E91]/90 text-[#FF4E91]"
          aria-hidden
        />
      </div>
    </GlowingOrb>
  );
}

interface QuickTipIconCapsuleProps {
  icon: typeof Video;
  glowClass: string;
  ringClass: string;
  iconClass: string;
}

function QuickTipIconCapsule({
  icon: Icon,
  glowClass,
  ringClass,
  iconClass,
}: QuickTipIconCapsuleProps) {
  return (
    <motion.div
      className={cn(
        "relative mx-auto mb-4 flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full bg-black/35 ring-1 backdrop-blur-md",
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
      <Icon className={cn("relative z-[1] h-6 w-6", iconClass)} strokeWidth={1.75} aria-hidden />
    </motion.div>
  );
}

export function OnboardingComplete() {
  const navigate = useNavigate();
  const { completeOnboarding, isLoading } = useOnboarding();
  const { profile } = useAuth();
  const hasAutoRedirectedRef = useRef(false);

  // Plan buyer regression fix:
  // When we land on `/onboarding/complete`, persist completion and redirect to dashboard.
  useEffect(() => {
    if (hasAutoRedirectedRef.current) return;
    if (!profile) return;
    const signupTypeEffective =
      profile.signup_type ??
      (profile.subscription_plan === "trial" ? "trial" : "plan");
    if (signupTypeEffective !== "plan") return;

    if (profile.onboarding_completed === true) {
      hasAutoRedirectedRef.current = true;
      window.location.href = "/app/dashboard";
      return;
    }

    if (!isLoading) {
      hasAutoRedirectedRef.current = true;
      completeOnboarding("/app/dashboard");
    }
  }, [profile, isLoading, completeOnboarding]);

  const handleBack = () => navigate("/onboarding/permissions");

  return (
    <motion.div
      className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#0A0B1E] text-[#FDFDFD]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <CompleteSceneBackdrop />
      <CompleteTopBar onBack={handleBack} />

      <main className="relative z-10 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <motion.div
          className="mx-auto flex w-full max-w-[960px] flex-col items-center gap-6 px-4 py-6 pb-16 sm:gap-7 sm:px-6 sm:py-8 sm:pb-20 md:px-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          {/* 1. Celebration title section */}
          <motion.header
            className="text-center"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <motion.div className="mb-2 flex justify-center">
              <FluentEmoji emoji="🎉" size={36} />
            </motion.div>
            <h1 className="solace-login-serif relative inline-flex flex-wrap items-center justify-center gap-2 text-[clamp(3rem,6vw,4.5rem)] font-medium leading-[1.08] text-[#FDFDFD] drop-shadow-[0_2px_28px_rgba(0,0,0,0.45)]">
              <span>You&apos;re</span>
              <span className="bg-gradient-to-r from-[#fda4cf] via-[#f9a8d4] to-[#FF4E91] bg-clip-text text-transparent drop-shadow-[0_0_32px_rgba(255,78,145,0.35)]">
                All Set!
              </span>
              <motion.span
                className="text-[#FF4E91] drop-shadow-[0_0_14px_rgba(255,78,145,0.65)]"
                animate={{ opacity: [0.7, 1, 0.7], y: [0, -3, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden
              >
                <Sparkles className="h-6 w-6 sm:h-7 sm:w-7" />
              </motion.span>
            </h1>
            <p className="mt-3 text-[clamp(1.05rem,2.2vw,1.35rem)] leading-relaxed text-violet-200/72">
              Your personalized wellness journey starts now
            </p>
          </motion.header>

          {/* 2. Large Solace logo */}
          <motion.div
            className="relative flex justify-center"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.08, duration: 0.55, ease: "easeOut" }}
          >
            <motion.div
              className="pointer-events-none absolute inset-0 -z-10 scale-110 rounded-full bg-[radial-gradient(circle,rgba(255,78,145,0.22)_0%,transparent_68%)] blur-2xl"
              animate={{ opacity: [0.6, 0.9, 0.6] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
            />
            <img
              src={SOLACE_LOGO_SRC}
              alt="Solace"
              className="w-[clamp(180px,32vw,340px)] object-contain drop-shadow-[0_8px_48px_rgba(138,79,255,0.32)]"
            />
            <motion.div
              className="absolute -left-2 top-1/4 text-violet-300/70 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]"
              animate={{ opacity: [0.5, 1, 0.5], rotate: [0, 15, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
            >
              <Sparkles className="h-5 w-5" />
            </motion.div>
            <motion.div
              className="absolute -right-1 top-1/3 text-[#FF4E91] drop-shadow-[0_0_14px_rgba(255,78,145,0.65)]"
              animate={{ opacity: [0.7, 1, 0.7], y: [0, -3, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
            >
              <Sparkles className="h-6 w-6" />
            </motion.div>
          </motion.div>

          {/* 3. Welcome glass card */}
          <motion.article
            className={cn(glassCardClass, "flex w-full flex-col gap-6 p-8 sm:p-10 md:flex-row md:items-center md:gap-10")}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.55, ease: "easeOut" }}
          >
            <motion.div
              className="mx-auto shrink-0 md:mx-0"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            >
              <LotusWelcomeOrb />
            </motion.div>
            <motion.div className="min-w-0 flex-1 text-center md:text-left">
              <h2 className="solace-login-serif text-[clamp(1.35rem,2.8vw,1.65rem)] font-medium text-[#fda4cf] drop-shadow-[0_0_18px_rgba(255,78,145,0.2)]">
                Welcome to Your Wellness Journey!
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-violet-100/78 sm:text-base">
                We&apos;ve personalized Solace based on your preferences. You&apos;re ready to start
                your first session!
              </p>
            </motion.div>
          </motion.article>

          {/* 4. Quick Start Guide */}
          <motion.section
            className="w-full"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.55, ease: "easeOut" }}
          >
            <motion.div
              className="mb-5 flex flex-col items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.24 }}
            >
              <motion.div
                className="flex w-full max-w-md items-center gap-4"
                aria-hidden
              >
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/15 to-transparent" />
              </motion.div>
              <h2 className="solace-login-serif text-[clamp(1.25rem,2.5vw,1.5rem)] font-medium text-[#FDFDFD]">
                Quick Start Guide
              </h2>
              <Sparkles
                className="h-4 w-4 text-[#FF4E91]/80 drop-shadow-[0_0_10px_rgba(255,78,145,0.45)]"
                aria-hidden
              />
            </motion.div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {quickTips.map((tip, index) => {
                const Icon = tip.icon;
                return (
                  <Link key={tip.title} to={tip.linkPath} className="block h-full">
                    <motion.article
                      className={quickTipCardClass}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.28 + index * 0.06, duration: 0.5 }}
                      whileHover={{ y: -4 }}
                    >
                      <QuickTipIconCapsule
                        icon={Icon}
                        glowClass={tip.glowClass}
                        ringClass={tip.ringClass}
                        iconClass={tip.iconClass}
                      />
                      <h3 className="text-[15px] font-semibold tracking-wide text-[#FDFDFD]">
                        {tip.title}
                      </h3>
                      <p className="mt-2 text-[13px] leading-relaxed text-violet-200/62">
                        {tip.description}
                      </p>
                    </motion.article>
                  </Link>
                );
              })}
            </div>
          </motion.section>

          {/* 5. What's Next card */}
          <motion.article
            className={cn(glassCardClass, "flex w-full flex-col gap-6 p-8 sm:p-10 md:flex-row md:items-center md:gap-10")}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.36, duration: 0.55, ease: "easeOut" }}
          >
            <motion.div
              className="mx-auto shrink-0 md:mx-0"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            >
              <ShieldHeartOrb />
            </motion.div>
            <div className="min-w-0 flex-1">
              <h2 className="solace-login-serif text-center text-[clamp(1.35rem,2.8vw,1.65rem)] font-medium text-[#fda4cf] md:text-left">
                What&apos;s Next?
              </h2>
              <ul className="mt-4 space-y-3">
                {whatsNextItems.map((item, index) => (
                  <motion.li
                    key={item}
                    className="flex items-start gap-3 text-[14px] leading-snug text-violet-100/82 sm:text-[15px]"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.42 + index * 0.05 }}
                  >
                    <CheckCircle2
                      className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.55)]"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span>{item}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.article>

          {/* 6. Setting Up Your Space loading bar / CTA */}
          <motion.div
            className="w-full pt-1"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.48, duration: 0.55, ease: "easeOut" }}
          >
            <motion.button
              type="button"
              onClick={() => completeOnboarding("/app/dashboard")}
              disabled={isLoading}
              whileHover={!isLoading ? { y: -2 } : undefined}
              whileTap={!isLoading ? { scale: 0.99 } : undefined}
              className={cn(
                "flex min-h-[4rem] w-full items-center justify-center gap-3 rounded-[1.125rem] px-6",
                "bg-gradient-to-r from-[#FF4E91] via-[#d946ef] to-[#8A4FFF] text-base font-semibold text-white sm:text-[17px]",
                "shadow-[0_0_40px_-8px_rgba(255,78,145,0.65)]",
                "transition-[box-shadow,opacity] duration-300",
                "hover:shadow-[0_0_52px_-6px_rgba(138,79,255,0.55)]",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4E91]/50",
                "disabled:cursor-wait disabled:opacity-95",
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  Setting Up Your Space...
                </>
              ) : (
                <>
                  Start Your First Session
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </>
              )}
            </motion.button>
          </motion.div>

          {/* 7. Secondary actions row */}
          <motion.div
            className="flex flex-wrap items-center justify-center gap-3 text-sm text-violet-200/70 sm:gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.54 }}
          >
            <Link
              to="/app/settings"
              className="inline-flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:text-white hover:drop-shadow-[0_0_12px_rgba(255,78,145,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4E91]/40"
            >
              <Settings className="h-4 w-4" aria-hidden />
              Adjust Settings
            </Link>
            <span className="text-white/20" aria-hidden>
              |
            </span>
            <Link
              to="/app/dashboard"
              className="inline-flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:text-white hover:drop-shadow-[0_0_12px_rgba(255,78,145,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4E91]/40"
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
              Explore Dashboard
            </Link>
          </motion.div>

          {/* 8. Emotional quote footer */}
          <motion.footer
            className={cn(
              "flex w-full flex-col items-center gap-4 rounded-[24px] border border-[#FF4E91]/18 bg-[#0A0B1E]/45 px-6 py-6 backdrop-blur-xl sm:flex-row sm:gap-5 sm:px-8 sm:py-7",
              "shadow-[0_0_0_1px_rgba(138,79,255,0.08),0_20px_56px_-28px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.04)]",
            )}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.55 }}
          >
            <motion.div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#FF4E91]/30 bg-[#0A0B1E]/60 shadow-[0_0_24px_-4px_rgba(255,78,145,0.45)]"
              animate={{
                boxShadow: [
                  "0 0 24px -4px rgba(255,78,145,0.45)",
                  "0 0 32px -2px rgba(255,78,145,0.6)",
                  "0 0 24px -4px rgba(255,78,145,0.45)",
                ],
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Heart
                className="h-5 w-5 text-[#FF4E91] drop-shadow-[0_0_10px_rgba(255,78,145,0.5)]"
                strokeWidth={1.75}
                aria-hidden
              />
            </motion.div>
            <p className="text-center text-[14px] italic leading-relaxed text-violet-100/75 sm:text-left sm:text-[15px]">
              &quot;Every journey begins with a single step. We&apos;re proud of you for taking this
              one.&quot;{" "}
              <FluentEmoji emoji="💙" size={18} className="inline align-middle" />
            </p>
          </motion.footer>
        </motion.div>
      </main>
    </motion.div>
  );
}
