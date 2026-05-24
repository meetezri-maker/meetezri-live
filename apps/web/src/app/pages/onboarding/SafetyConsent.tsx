/**
 * EZRI — CONVERSATION SAFETY FLOW
 * Safety & Support Notice onboarding step
 */

import { type ReactNode } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  ShieldCheck,
  AlertTriangle,
  Users,
  Phone,
  Heart,
  Check,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  MessageCircle,
  UserRound,
  MapPin,
  Info,
  Ambulance,
  Brain,
  Stethoscope,
  Flower2,
  Lock,
} from "lucide-react";
import { useSafetyConsent } from "@/app/contexts/SafetyContext";
import { useOnboarding } from "@/app/contexts/OnboardingContext";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/app/components/ui/form";
import { Checkbox } from "@/app/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { BRAND_LOGO_ON_DARK_BG } from "@/app/components/BrandLogo";

/** Environment plate only — calm mountains/lake, not a UI screenshot. */
const SAFETY_SUPPORT_BG = "/solace/safety-support-calm-mountains.jpg";
const SOLACE_LOGO_SRC = BRAND_LOGO_ON_DARK_BG;
const ONBOARDING_NAV_H = "4.5rem";
const CURRENT_STEP = 6;
const TOTAL_STEPS = 8;
const PROGRESS_PERCENT = (CURRENT_STEP / TOTAL_STEPS) * 100;

const safetyConsentSchema = z.object({
  agreed: z.boolean().refine((val) => val === true, {
    message: "You must agree to the safety guidelines to continue",
  }),
});

type SafetyConsentValues = z.infer<typeof safetyConsentSchema>;

const glassCardClass = cn(
  "relative w-full rounded-[26px] border border-[#FF4E91]/20 bg-[#0A0B1E]/48 backdrop-blur-2xl",
  "shadow-[0_0_0_1px_rgba(138,79,255,0.1),0_28px_72px_-32px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)]",
  "transition-[border-color,box-shadow] duration-300 hover:border-[#FF4E91]/32 hover:shadow-[0_0_40px_-16px_rgba(255,78,145,0.35)]",
);

const emotionalRiskItems = [
  {
    icon: MessageCircle,
    text: "Conversations may slow down or redirect to provide better support",
    iconClass: "text-amber-200/90",
    ring: "from-amber-300/50 to-amber-900/20",
  },
  {
    icon: UserRound,
    text: "Requests that could be unsafe will be respectfully declined",
    iconClass: "text-[#fda4cf]",
    ring: "from-[#FF4E91]/45 to-pink-900/20",
  },
  {
    icon: MapPin,
    text: "Support resources will be shown based on your location",
    iconClass: "text-violet-300",
    ring: "from-violet-400/50 to-purple-900/25",
  },
] as const;

const ezriCannotItems = [
  {
    icon: Ambulance,
    text: "Contact emergency services on your behalf",
    iconClass: "text-cyan-300",
    ring: "from-cyan-400/50 to-cyan-900/20",
  },
  {
    icon: Brain,
    text: "Replace professional mental health care or therapy",
    iconClass: "text-sky-300",
    ring: "from-sky-400/50 to-sky-900/20",
  },
  {
    icon: Stethoscope,
    text: "Provide medical advice or diagnoses",
    iconClass: "text-indigo-300",
    ring: "from-indigo-400/50 to-indigo-900/25",
  },
] as const;

const acknowledgementItems = [
  "Solace provides support and companionship, not medical treatment",
  "You are responsible for seeking immediate help when needed",
  "Solace may adjust conversations and show resources based on safety concerns",
] as const;

function SafetySupportSceneBackdrop() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.1, ease: "easeOut" }}
    >
      <img
        src={SAFETY_SUPPORT_BG}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[center_42%]"
        width={2400}
        height={1350}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_12%_55%,rgba(255,78,145,0.18)_0%,transparent_55%)]"
        animate={{ opacity: [0.5, 0.78, 0.5] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_72%,rgba(255,78,145,0.14)_0%,transparent_60%)]"
        animate={{ opacity: [0.4, 0.68, 0.4] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_38%,rgba(138,79,255,0.16)_0%,transparent_58%)]"
        animate={{ opacity: [0.45, 0.72, 0.45] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_120%_85%_at_50%_100%,rgba(5,6,18,0.94)_0%,transparent_52%)]"
        animate={{ opacity: [0.88, 1, 0.88] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_0%,rgba(7,8,21,0.78)_0%,transparent_48%)]"
        animate={{ opacity: [0.72, 0.92, 0.72] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      />
      <motion.div className="absolute inset-0 bg-[#070815]/50" />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_42%,rgba(10,11,30,0.2)_0%,rgba(7,8,21,0.75)_100%)]"
        animate={{ opacity: [0.75, 0.9, 0.75] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_50%,transparent_22%,rgba(0,0,0,0.62)_100%)]"
        animate={{ opacity: [0.9, 1, 0.9] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      {[
        { left: "6%", top: "56%", delay: 0 },
        { left: "18%", top: "64%", delay: 0.8 },
        { left: "32%", top: "60%", delay: 1.5 },
        { left: "48%", top: "66%", delay: 0.4 },
        { left: "62%", top: "62%", delay: 1.1 },
        { left: "76%", top: "68%", delay: 1.9 },
        { left: "90%", top: "58%", delay: 2.2 },
        { left: "12%", top: "42%", delay: 1.3 },
        { left: "84%", top: "46%", delay: 0.6 },
        { left: "44%", top: "38%", delay: 1.7 },
        { left: "58%", top: "34%", delay: 0.9 },
      ].map((particle, index) => (
        <motion.span
          key={index}
          className="absolute h-1 w-1 rounded-full bg-[#ffb4a8]/85 shadow-[0_0_10px_rgba(255,140,100,0.55)]"
          style={{ left: particle.left, top: particle.top }}
          animate={{ opacity: [0.15, 0.75, 0.15], y: [0, -7, 0] }}
          transition={{
            duration: 4.8 + (index % 3),
            repeat: Infinity,
            ease: "easeInOut",
            delay: particle.delay,
          }}
        />
      ))}
    </motion.div>
  );
}

interface SafetySupportTopBarProps {
  progressPercent: number;
  onBack: () => void;
}

function SafetySupportTopBar({ progressPercent, onBack }: SafetySupportTopBarProps) {
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
          <motion.div className="flex min-w-0 items-center gap-2">
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
          </motion.div>
          <p className="shrink-0 text-xs text-violet-200/65">
            Step {CURRENT_STEP} of {TOTAL_STEPS}
          </p>
        </motion.div>
        <motion.div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/[0.04] backdrop-blur-sm">
          <motion.div
            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[#FF4E91] via-[#d946ef] to-[#34d399] shadow-[0_0_16px_-2px_rgba(255,78,145,0.55)]"
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
        </motion.div>
      </motion.div>

      <motion.div
        className="mx-auto hidden h-full max-w-[1200px] items-center gap-4 px-6 lg:px-8 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto]"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <motion.div className="flex items-center gap-2.5">
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

        <motion.div className="px-2">
          <motion.div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/[0.04] backdrop-blur-sm">
            <motion.div
              className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[#FF4E91] via-[#d946ef] to-[#34d399] shadow-[0_0_16px_-2px_rgba(255,78,145,0.55)]"
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
          </motion.div>
        </motion.div>

        <p className="shrink-0 text-sm text-violet-200/65">
          Step {CURRENT_STEP} of {TOTAL_STEPS}
        </p>
      </motion.div>
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

export function OnboardingSafetyConsent() {
  const navigate = useNavigate();
  const { updateConsent } = useSafetyConsent();
  const { updateData } = useOnboarding();

  const form = useForm<SafetyConsentValues>({
    resolver: zodResolver(safetyConsentSchema),
    defaultValues: {
      agreed: false,
    },
  });

  const agreed = form.watch("agreed");

  const onSubmit = (values: SafetyConsentValues) => {
    updateConsent({
      agreedToSafetyNotice: true,
      agreedAt: Date.now(),
      trustedContactEnabled: false,
    });

    updateData({ agreedToSafety: true });

    navigate("/onboarding/emergency-contact");
  };

  const handleTopBack = () => navigate("/onboarding/avatar-preferences");

  return (
    <motion.div
      className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#070815] text-[#FDFDFD]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <SafetySupportSceneBackdrop />
      <SafetySupportTopBar progressPercent={PROGRESS_PERCENT} onBack={handleTopBack} />

      <main className="relative z-10 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <motion.div
          className="mx-auto flex w-full max-w-[960px] flex-col items-center px-4 py-6 pb-12 sm:px-6 sm:py-8 sm:pb-14 md:px-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Title section */}
          <header className="mb-6 text-center sm:mb-8">
            <h1 className="solace-login-serif inline-flex flex-wrap items-center justify-center gap-2 text-[clamp(2.625rem,5vw,3.625rem)] font-medium leading-[1.08] text-[#FDFDFD] drop-shadow-[0_0_32px_rgba(255,78,145,0.2),0_2px_28px_rgba(0,0,0,0.45)]">
              Safety & Support
              <Sparkles
                className="h-5 w-5 text-[#FF4E91] drop-shadow-[0_0_12px_rgba(255,78,145,0.55)] sm:h-6 sm:w-6"
                aria-hidden
              />
            </h1>
            <p className="mt-2 text-[clamp(1rem,1.9vw,1.2rem)] leading-relaxed text-violet-200/72">
              Understanding how Solace keeps you safe
            </p>
          </header>

          <motion.div
            className="flex w-full flex-col gap-5 sm:gap-6"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.5 }}
          >
            {/* Main Safety & Support Notice card */}
            <motion.section
              className={cn(
                glassCardClass,
                "rounded-[28px] border-[#FF4E91]/28 p-6 sm:p-9 md:p-10",
              )}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.5 }}
            >
              <motion.div
                className="absolute inset-0 rounded-[28px] bg-[radial-gradient(ellipse_70%_50%_at_18%_50%,rgba(255,78,145,0.08)_0%,transparent_55%)]"
                aria-hidden
              />
              <motion.div
                className="absolute inset-0 rounded-[28px] bg-[radial-gradient(ellipse_60%_45%_at_82%_50%,rgba(138,79,255,0.06)_0%,transparent_50%)]"
                aria-hidden
              />
              <motion.div className="relative grid grid-cols-1 items-center gap-6 md:grid-cols-[minmax(140px,200px)_1fr] md:gap-8 lg:gap-10">
                <div className="mx-auto flex justify-center md:mx-0">
                  <GlowingOrb
                    size="lg"
                    glowClass="shadow-[0_0_48px_-8px_rgba(255,78,145,0.55)] ring-1 ring-[#FF4E91]/30"
                  >
                    <div className="relative flex items-center justify-center">
                      <ShieldCheck
                        className="h-9 w-9 text-[#fda4cf] drop-shadow-[0_0_14px_rgba(255,78,145,0.55)]"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                      <Heart
                        className="absolute h-4 w-4 text-[#FF4E91] drop-shadow-[0_0_8px_rgba(255,78,145,0.6)]"
                        fill="currentColor"
                        strokeWidth={0}
                        aria-hidden
                      />
                    </div>
                  </GlowingOrb>
                </div>
                <div className="min-w-0 text-center md:text-left">
                  <div className="mb-3 flex items-center justify-center gap-2 md:justify-start">
                    <ShieldCheck
                      className="h-4 w-4 text-[#c4b5fd] drop-shadow-[0_0_8px_rgba(138,79,255,0.45)]"
                      aria-hidden
                    />
                    <h2 className="text-[17px] font-semibold text-white/94 sm:text-lg">
                      Safety & Support Notice
                    </h2>
                  </div>
                  <p className="text-[14px] leading-relaxed text-violet-100/72 sm:text-[15px]">
                    Solace is a conversational support system designed to provide companionship and
                    wellness support.{" "}
                    <strong className="font-semibold text-[#FF4E91]">It is not a medical service</strong>{" "}
                    and does not replace professional or emergency care.
                  </p>
                </div>
              </motion.div>
            </motion.section>

            {/* Two-column safety row */}
            <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-2">
              {/* High Emotional Risk */}
              <motion.section
                className={cn(glassCardClass, "p-5 sm:p-6")}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.5 }}
              >
                <div className="mb-5 flex items-start gap-3">
                  <GlowingOrb
                    size="sm"
                    glowClass="shadow-[0_0_28px_-6px_rgba(251,191,36,0.45)] ring-1 ring-amber-400/25"
                  >
                    <AlertTriangle
                      className="h-5 w-5 text-amber-300"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </GlowingOrb>
                  <h3 className="pt-1.5 text-[15px] font-semibold leading-snug text-white/92 sm:text-base">
                    If Solace Detects High Emotional Risk:
                  </h3>
                </div>
                <ul className="space-y-3">
                  {emotionalRiskItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.text} className="flex items-start gap-3">
                        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/35 ring-1 ring-white/[0.06]">
                          <div
                            className={cn(
                              "pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br opacity-45 blur-[1px]",
                              item.ring,
                            )}
                          />
                          <Icon
                            className={cn("relative z-[1] h-4 w-4", item.iconClass)}
                            strokeWidth={1.75}
                            aria-hidden
                          />
                        </div>
                        <p className="pt-1 text-[13px] leading-relaxed text-violet-100/68 sm:text-[14px]">
                          {item.text}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </motion.section>

              {/* Trusted Contact */}
              <motion.section
                className={cn(glassCardClass, "p-5 sm:p-6")}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14, duration: 0.5 }}
              >
                <motion.div className="mb-5 flex items-start gap-3">
                  <GlowingOrb
                    size="sm"
                    glowClass="shadow-[0_0_28px_-6px_rgba(138,79,255,0.5)] ring-1 ring-violet-400/25"
                  >
                    <Users className="h-5 w-5 text-violet-300" strokeWidth={1.75} aria-hidden />
                  </GlowingOrb>
                  <h3 className="pt-1.5 text-[15px] font-semibold leading-snug text-white/92 sm:text-base">
                    Trusted Contact (Optional)
                  </h3>
                </motion.div>
                <p className="text-[13px] leading-relaxed text-violet-100/68 sm:text-[14px]">
                  You may add a trusted contact in your settings. If enabled, Solace may send them an
                  informational notification during high-risk situations.
                </p>
                <div className="mt-4 flex items-start gap-2.5 rounded-[18px] border border-violet-500/15 bg-[#120f28]/65 px-4 py-3 backdrop-blur-md">
                  <Info
                    className="mt-0.5 h-4 w-4 shrink-0 text-violet-300/70"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <p className="text-[12px] italic leading-relaxed text-violet-200/55 sm:text-[13px]">
                    Notifications are informational only and do not include conversation details.
                  </p>
                </div>
              </motion.section>
            </div>

            {/* Solace Cannot card */}
            <motion.section
              className={cn(glassCardClass, "p-5 sm:p-6 md:p-7")}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16, duration: 0.5 }}
            >
              <div className="mb-5 flex items-center gap-3">
                <GlowingOrb
                  size="sm"
                  glowClass="shadow-[0_0_28px_-6px_rgba(56,189,248,0.45)] ring-1 ring-cyan-400/25"
                >
                  <Phone className="h-5 w-5 text-cyan-300" strokeWidth={1.75} aria-hidden />
                </GlowingOrb>
                <h3 className="text-[15px] font-semibold text-white/92 sm:text-base">Solace Cannot:</h3>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-4">
                {ezriCannotItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.text}
                      className={cn(
                        "flex flex-col items-center gap-3 text-center sm:px-2",
                        index > 0 &&
                          "sm:border-l sm:border-white/[0.08] sm:pl-4",
                      )}
                    >
                      <motion.div
                        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#0b0c20]/55 shadow-[0_0_24px_-8px_rgba(56,189,248,0.35)]"
                        whileHover={{ scale: 1.04 }}
                      >
                        <motion.div
                          className={cn(
                            "pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br opacity-50",
                            item.ring,
                          )}
                        />
                        <Icon
                          className={cn("relative z-[1] h-5 w-5", item.iconClass)}
                          strokeWidth={1.75}
                          aria-hidden
                        />
                      </motion.div>
                      <p className="text-[13px] leading-relaxed text-violet-100/68 sm:text-[14px]">
                        {item.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </motion.section>

            {/* Acknowledgement card + buttons */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5 sm:gap-6">
                <motion.section
                  className={cn(
                    glassCardClass,
                    "overflow-hidden rounded-[28px] p-5 sm:p-7 md:p-8",
                  )}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18, duration: 0.5 }}
                >
                  <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[1fr_minmax(140px,200px)] lg:gap-8">
                    <motion.div className="min-w-0">
                      <div className="mb-4 flex items-center gap-2.5">
                        <GlowingOrb
                          size="sm"
                          glowClass="shadow-[0_0_24px_-6px_rgba(52,211,153,0.45)] ring-1 ring-emerald-400/25"
                        >
                          <ShieldCheck
                            className="h-5 w-5 text-emerald-300"
                            strokeWidth={1.75}
                            aria-hidden
                          />
                        </GlowingOrb>
                        <h3 className="text-[15px] font-semibold text-white/92 sm:text-base">
                          By Continuing, You Acknowledge:
                        </h3>
                      </div>

                      <ul className="mb-5 space-y-3">
                        {acknowledgementItems.map((item) => (
                          <li key={item} className="flex items-start gap-3">
                            <span
                              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 shadow-[0_0_12px_-2px_rgba(52,211,153,0.45)] ring-1 ring-emerald-400/30"
                              aria-hidden
                            >
                              <Check className="h-3 w-3 text-emerald-300" strokeWidth={3} />
                            </span>
                            <span className="text-[13px] leading-relaxed text-violet-100/72 sm:text-[14px]">
                              {item}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <FormField
                        control={form.control}
                        name="agreed"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start gap-3 space-y-0 border-t border-white/[0.08] pt-5">
                            <FormControl>
                              <Checkbox
                                id="safety-consent"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className="mt-0.5 size-5 rounded-[6px] border-white/20 bg-[#0b0c20]/60 data-[state=checked]:border-[#FF4E91] data-[state=checked]:bg-[#FF4E91] data-[state=checked]:text-white focus-visible:ring-[#FF4E91]/40"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel
                                htmlFor="safety-consent"
                                className="cursor-pointer select-none text-[13px] font-medium text-white/88 sm:text-[14px]"
                              >
                                I understand and agree to these safety guidelines
                              </FormLabel>
                              <FormMessage className="text-[12px] text-[#ff8ab8]" />
                            </div>
                          </FormItem>
                        )}
                      />
                    </motion.div>

                    <div className="mx-auto flex justify-center lg:mx-0 lg:justify-end">
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
                    </div>
                  </div>
                </motion.section>

                {/* Back / Continue buttons */}
                <motion.div
                  className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22, duration: 0.45 }}
                >
                  <motion.button
                    type="button"
                    onClick={handleTopBack}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    className={cn(
                      "flex h-[58px] w-full items-center justify-center gap-2 rounded-[18px] border border-white/10",
                      "bg-[#0b0c20]/55 px-6 text-[15px] font-medium text-white/88 backdrop-blur-md",
                      "transition-[border-color,box-shadow] duration-200",
                      "hover:border-violet-400/30 hover:bg-[#12132e]/65",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4E91]/40",
                    )}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </motion.button>

                  <motion.button
                    type="submit"
                    disabled={!agreed}
                    whileHover={agreed ? { y: -1 } : undefined}
                    whileTap={agreed ? { scale: 0.99 } : undefined}
                    className={cn(
                      "flex h-[58px] w-full items-center justify-center gap-2 rounded-[18px] px-6",
                      "bg-gradient-to-r from-[#FF4E91] via-[#d946ef] to-[#8A4FFF] text-[15px] font-semibold text-white",
                      "shadow-[0_0_40px_-8px_rgba(255,78,145,0.65)]",
                      "transition-[box-shadow,opacity] duration-300",
                      "hover:shadow-[0_0_52px_-6px_rgba(138,79,255,0.55)]",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4E91]/50",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </motion.button>
                </motion.div>
              </form>
            </Form>

            {/* Safety reassurance footer */}
            <motion.footer
              className="mt-2 flex flex-col items-center gap-2 text-center sm:mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.28, duration: 0.5 }}
            >
              <div className="flex flex-col items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#FF4E91]/30 bg-[#FF4E91]/10 shadow-[0_0_16px_-4px_rgba(255,78,145,0.45)]">
                  <Lock
                    className="h-3.5 w-3.5 text-[#FF4E91]/85"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </span>
                <p className="text-[13px] font-medium text-violet-100/62">
                  Your safety matters to us.
                </p>
                <p className="max-w-[min(420px,92vw)] text-[12px] leading-relaxed text-violet-200/48">
                  Solace is here to support you with care and compassion.
                </p>
              </div>
            </motion.footer>
          </motion.div>
        </motion.div>
      </main>
    </motion.div>
  );
}
