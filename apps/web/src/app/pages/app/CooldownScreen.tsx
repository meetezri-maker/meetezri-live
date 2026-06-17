/**
 * EZRI — COOLDOWN SCREEN
 * Post-session recovery for users after HIGH_RISK or SAFETY_MODE
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { GroundingExercises } from "@/app/components/safety/GroundingExercises";
import { BreathingExercises } from "@/app/components/safety/BreathingExercises";
import { useSafety } from "@/app/contexts/SafetyContext";
import { trackResourceInteraction } from "@/app/utils/resourceTracking";
import {
  getCrisisHotlineDisplayResources,
} from "@/app/utils/safetyResources";
import { cn } from "@/lib/utils";
import {
  Heart,
  Wind,
  Eye,
  Shield,
  Coffee,
  CheckCircle,
  ChevronRight,
  Clock,
  AlertCircle,
  Home,
  ArrowLeft,
  Play,
  Phone,
  MessageCircle,
  Sparkles,
  Brain,
  Scale,
} from "lucide-react";
import {
  COOLDOWN_HERO_IMG,
  cooldownActivityCard,
  cooldownBackLink,
  cooldownBenefitChip,
  cooldownContinueBtn,
  cooldownHeroOverlay,
  cooldownHeroShell,
  cooldownHeroWarmth,
  cooldownHomeBtn,
  cooldownMatteCard,
  cooldownPageAtmosphere,
  cooldownPill,
  cooldownResourceCard,
} from "@/app/pages/app/cooldownScreenUi";

type Activity = "breathing" | "grounding" | "rest" | null;

const BENEFIT_CHIPS = [
  { label: "Reduces stress", icon: Sparkles, tone: "text-cyan-300/90" },
  { label: "Calms your mind", icon: Brain, tone: "text-violet-300/90" },
  { label: "Regulates emotions", icon: Heart, tone: "text-fuchsia-300/90" },
  { label: "Restores balance", icon: Scale, tone: "text-amber-300/90" },
] as const;

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function BreathingOrb() {
  return (
    <motion.div
      className="relative mx-auto flex h-[200px] w-[200px] shrink-0 items-center justify-center sm:h-[220px] sm:w-[220px]"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="absolute inset-[-18%] rounded-full bg-fuchsia-500/20 blur-3xl"
        animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
      <motion.div
        className="absolute inset-[0%] rounded-full border border-violet-300/25"
        animate={{ scale: [1, 1.1, 1], opacity: [0.35, 0.65, 0.35] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
      <motion.div
        className="absolute inset-[10%] rounded-full border border-fuchsia-400/20"
        animate={{ scale: [1.04, 1, 1.04] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
      <motion.div
        className="absolute inset-[20%] rounded-full border border-violet-200/15"
        animate={{ scale: [1, 1.06, 1], opacity: [0.25, 0.5, 0.25] }}
        transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
      <motion.div
        className="relative flex h-[72%] w-[72%] items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-violet-500/55 via-fuchsia-600/40 to-violet-900/60 text-center shadow-[0_0_72px_rgba(168,85,247,0.55),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-md"
        animate={{
          scale: [1, 1.04, 1],
          boxShadow: [
            "0 0 64px rgba(139,92,246,0.45), inset 0 1px 0 rgba(255,255,255,0.12)",
            "0 0 88px rgba(168,85,247,0.65), inset 0 1px 0 rgba(255,255,255,0.18)",
            "0 0 64px rgba(139,92,246,0.45), inset 0 1px 0 rgba(255,255,255,0.12)",
          ],
        }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="text-2xl font-semibold tracking-wide text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.35)]">
          Breathe
        </span>
      </motion.div>
    </motion.div>
  );
}

interface CooldownRequirementNoticeProps {
  canProceed: boolean;
  hasActivity: boolean;
  hasMinTime: boolean;
  timeRemaining: number;
}

function CooldownRequirementNotice({
  canProceed,
  hasActivity,
  hasMinTime,
  timeRemaining,
}: CooldownRequirementNoticeProps) {
  if (canProceed) return null;

  let message: string;
  if (!hasActivity && !hasMinTime) {
    message = `Complete at least one activity and wait ${formatTime(timeRemaining)} more before continuing.`;
  } else if (!hasActivity && hasMinTime) {
    message = "Please complete at least one recovery activity before continuing.";
  } else {
    message = `Good job! Please wait ${formatTime(timeRemaining)} more to ensure you're feeling stable.`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className={cn(
        cooldownMatteCard,
        "flex items-center gap-3 border-amber-500/25 px-4 py-3.5",
        "shadow-[0_0_32px_-12px_rgba(251,191,36,0.35),inset_0_1px_0_rgba(251,191,36,0.08)]",
      )}
      role="status"
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 ring-1 ring-amber-400/30"
        aria-hidden
      >
        <Clock className="size-4 text-amber-300" />
      </div>
      <p className="text-sm leading-relaxed text-amber-100/90">{message}</p>
    </motion.div>
  );
}

interface HelpfulResourcesCardProps {
  safetyLevel: string;
}

function HelpfulResourcesCard({ safetyLevel }: HelpfulResourcesCardProps) {
  const { userRegion } = useSafety();
  const hotlines = getCrisisHotlineDisplayResources(userRegion);
  const textLine = hotlines.find((r) => r.variant === "text");
  const supportLine = hotlines.find((r) => r.variant === "lifeline" || r.variant === "samhsa");

  const trackDial = (
    resourceId: string,
    resourceLabel: string,
    resourceType: "crisis_line" | "text_line" | "emergency",
    interaction: "call" | "text" | "visit",
  ) => {
    trackResourceInteraction(
      resourceId,
      resourceLabel,
      resourceType,
      interaction,
      undefined,
      safetyLevel,
    );
  };

  return (
    <section
      aria-labelledby="cooldown-resources-heading"
      className={cn(
        "relative overflow-hidden rounded-[28px] border border-white/[0.1] p-6 sm:p-7",
        "shadow-[0_40px_100px_-48px_rgba(0,0,0,0.9),0_0_56px_-20px_rgba(168,85,247,0.35)]",
      )}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-violet-700/80 via-fuchsia-700/70 to-rose-800/75"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(160deg,rgba(8,6,16,0.55)_0%,rgba(20,8,28,0.72)_100%)]"
        aria-hidden
      />
      <motion.div
        className="absolute -right-16 top-0 h-48 w-48 rounded-full bg-fuchsia-500/25 blur-3xl"
        animate={{ opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="relative"
      >
        <motion.div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <motion.div
              className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/20"
              aria-hidden
            >
              <Phone className="size-5 text-white" strokeWidth={1.75} />
            </motion.div>
            <div>
              <h2
                id="cooldown-resources-heading"
                className="text-lg font-semibold tracking-tight text-white sm:text-xl"
              >
                Helpful Resources Available 24/7
              </h2>
              <p className="mt-1 text-sm text-white/70">Support is always here when you need it.</p>
            </div>
          </div>
          <Link
            to="/app/emergency-resources"
            onClick={() =>
              trackDial("cooldown_view_all", "Emergency Resources", "emergency", "visit")
            }
            className={cn(
              "inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-white/25",
              "bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm",
              "transition hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
            )}
          >
            View All Resources
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            to="/app/emergency-resources"
            onClick={() => trackDial("us_emergency", "Emergency Resources", "emergency", "visit")}
            className={cooldownResourceCard}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 ring-1 ring-rose-400/30">
              <Shield className="size-5 text-rose-200" aria-hidden />
            </div>
            <motion.div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Emergency Resources</p>
              <p className="text-xs text-white/65">Get immediate help</p>
            </motion.div>
            <ChevronRight className="size-5 shrink-0 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white/70" aria-hidden />
          </Link>

          <a
            href={textLine?.telHref ?? "/app/emergency-resources"}
            onClick={() =>
              textLine
                ? trackDial(
                    textLine.resourceId,
                    textLine.resourceLabel,
                    "text_line",
                    "text",
                  )
                : trackDial("cooldown_view_all", "Emergency Resources", "emergency", "visit")
            }
            className={cooldownResourceCard}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 ring-1 ring-cyan-400/30">
              <MessageCircle className="size-5 text-cyan-200" aria-hidden />
            </div>
            <motion.div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">{textLine?.name ?? "Crisis Text Line"}</p>
              <p className="text-xs text-white/65">{textLine?.phone ?? "View regional options"}</p>
            </motion.div>
            <ChevronRight className="size-5 shrink-0 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white/70" aria-hidden />
          </a>

          <a
            href={supportLine?.telHref ?? "/app/emergency-resources"}
            onClick={() =>
              supportLine
                ? trackDial(
                    supportLine.resourceId,
                    supportLine.resourceLabel,
                    "crisis_line",
                    "call",
                  )
                : trackDial("cooldown_view_all", "Emergency Resources", "emergency", "visit")
            }
            className={cooldownResourceCard}
          >
            <motion.div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 ring-1 ring-violet-400/30">
              <Phone className="size-5 text-violet-200" aria-hidden />
            </motion.div>
            <motion.div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">{supportLine?.name ?? "Support Helpline"}</p>
              <p className="text-xs text-white/65">{supportLine?.phone ?? "View regional options"}</p>
            </motion.div>
            <ChevronRight className="size-5 shrink-0 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white/70" aria-hidden />
          </a>
        </div>
      </motion.div>
    </section>
  );
}

function CooldownFooter() {
  return (
    <footer className="space-y-3 pb-2 pt-4 text-center">
      <p className="flex items-center justify-center gap-2 text-sm text-[rgba(255,255,255,0.48)]">
        <Heart className="size-4 text-fuchsia-400/70" aria-hidden />
        <span>You are not alone. You matter. Take it one moment at a time.</span>
      </p>
      <div className="flex items-center justify-center gap-2 text-sm text-[rgba(255,255,255,0.42)]">
        <Heart className="size-4 text-fuchsia-400/70" aria-hidden />
        <span>Made with care for your wellbeing</span>
      </div>
      <p className="text-xs text-[rgba(255,255,255,0.32)]">
        Solace v1.0.0 • © 2026 •{" "}
        <Link to="/privacy" className="underline-offset-2 hover:text-violet-300/80 hover:underline">
          Privacy
        </Link>{" "}
        •{" "}
        <Link to="/terms" className="underline-offset-2 hover:text-violet-300/80 hover:underline">
          Terms
        </Link>
      </p>
    </footer>
  );
}

export function CooldownScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentState, resetToNormal } = useSafety();

  const sessionId = (location.state as { sessionId?: string })?.sessionId || "unknown";
  const safetyLevel = (location.state as { safetyLevel?: string })?.safetyLevel || currentState;

  const [currentActivity, setCurrentActivity] = useState<Activity>(null);
  const [completedActivities, setCompletedActivities] = useState<Activity[]>([]);
  const [cooldownStartTime] = useState(Date.now());
  const [timeInCooldown, setTimeInCooldown] = useState(0);
  const [canProceed, setCanProceed] = useState(false);

  const minCooldownTime = safetyLevel === "SAFETY_MODE" ? 180 : 120;

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - cooldownStartTime) / 1000);
      setTimeInCooldown(elapsed);

      if (elapsed >= minCooldownTime && completedActivities.length > 0) {
        setCanProceed(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownStartTime, minCooldownTime, completedActivities.length]);

  useEffect(() => {
    console.log("🧘 Cooldown session started", {
      sessionId,
      safetyLevel,
      timestamp: new Date().toISOString(),
    });

    const cooldownData = {
      sessionId,
      safetyLevel,
      startTime: new Date().toISOString(),
      activities: [],
    };
    localStorage.setItem("ezri_current_cooldown", JSON.stringify(cooldownData));
  }, [sessionId, safetyLevel]);

  const handleActivityComplete = () => {
    if (currentActivity && !completedActivities.includes(currentActivity)) {
      setCompletedActivities([...completedActivities, currentActivity]);

      const stored = localStorage.getItem("ezri_current_cooldown");
      if (stored) {
        const data = JSON.parse(stored);
        data.activities.push({
          type: currentActivity,
          completedAt: new Date().toISOString(),
        });
        localStorage.setItem("ezri_current_cooldown", JSON.stringify(data));
      }
    }
    setCurrentActivity(null);
  };

  const handleSkipActivity = () => {
    setCurrentActivity(null);
  };

  const handleProceed = () => {
    const stored = localStorage.getItem("ezri_current_cooldown");
    if (stored) {
      const data = JSON.parse(stored);
      data.endTime = new Date().toISOString();
      data.duration = timeInCooldown;

      const history = JSON.parse(localStorage.getItem("ezri_cooldown_history") || "[]");
      history.unshift(data);
      localStorage.setItem("ezri_cooldown_history", JSON.stringify(history.slice(0, 50)));

      localStorage.removeItem("ezri_current_cooldown");
    }

    resetToNormal();

    navigate("/app/session-lobby", {
      state: {
        showReEntryCheckin: true,
        previousSessionId: sessionId,
        cooldownDuration: timeInCooldown,
      },
    });
  };

  if (currentActivity) {
    return (
      <motion.div className="relative w-full max-w-none px-4 py-6 sm:px-6 lg:px-8">
        <div className={cooldownPageAtmosphere} aria-hidden />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10">
          <button
            type="button"
            onClick={handleSkipActivity}
            className={cn(cooldownBackLink, "mb-6 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4")}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to Activities
          </button>

          <AnimatePresence mode="wait">
            {currentActivity === "breathing" && (
              <motion.div
                key="breathing"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <BreathingExercises onComplete={handleActivityComplete} />
              </motion.div>
            )}

            {currentActivity === "grounding" && (
              <motion.div
                key="grounding"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <GroundingExercises onComplete={handleActivityComplete} />
              </motion.div>
            )}

            {currentActivity === "rest" && (
              <motion.div
                key="rest"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className={cn(cooldownMatteCard, "border-pink-500/20 p-8 text-center shadow-[0_0_48px_-16px_rgba(236,72,153,0.35)]")}>
                  <div className="mx-auto mb-6 inline-flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-pink-500/40 to-fuchsia-600/30 ring-1 ring-pink-400/30 shadow-[0_0_32px_rgba(236,72,153,0.35)]">
                    <Coffee className="size-8 text-pink-100" aria-hidden />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Quiet Rest</h3>
                  <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/75">
                    Take the next few minutes to simply sit quietly. You don&apos;t need to do anything.
                    Just breathe naturally and let yourself be.
                  </p>
                  <p className="mt-6 text-sm text-white/55">
                    Take your time. When you&apos;re ready, click the button below.
                  </p>
                  <button
                    type="button"
                    onClick={handleActivityComplete}
                    className={cn(
                      "mt-8 inline-flex min-h-[48px] items-center justify-center rounded-2xl px-8 text-sm font-semibold",
                      "border border-pink-400/30 bg-gradient-to-r from-pink-600/80 to-fuchsia-600/80 text-white",
                      "shadow-[0_0_32px_-8px_rgba(236,72,153,0.5)] transition hover:brightness-110",
                    )}
                  >
                    I Feel More Settled
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8">
            <HelpfulResourcesCard safetyLevel={String(safetyLevel)} />
          </div>
        </motion.div>
      </motion.div>
    );
  }

  const timeRemaining = Math.max(0, minCooldownTime - timeInCooldown);
  const hasMinTime = timeInCooldown >= minCooldownTime;
  const hasActivity = completedActivities.length > 0;
  const riskTitle =
    safetyLevel === "SAFETY_MODE" ? "Safety Mode Activated" : "High Risk Detected";

  return (
    <div className="relative w-full max-w-none px-4 py-6 sm:px-6 lg:px-8">
      <div className={cooldownPageAtmosphere} aria-hidden />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative z-10 mx-auto w-full max-w-[1200px] space-y-6"
      >
        {/* 1. Cinematic header / hero */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/app/settings" className={cooldownBackLink}>
            <ArrowLeft className="size-4" aria-hidden />
            Back to Settings
          </Link>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={cooldownHeroShell}
          aria-labelledby="cooldown-hero-title"
        >
          <img
            src={COOLDOWN_HERO_IMG}
            alt=""
            className={cn(
              "absolute inset-0 h-full w-full object-cover object-center",
              "min-h-[220px] sm:min-h-[260px]",
            )}
          />
          <motion.div className={cooldownHeroOverlay} aria-hidden />
          <div className={cooldownHeroWarmth} aria-hidden />
          <div className="relative z-10 px-6 py-10 sm:px-10 sm:py-12">
            <div className="flex items-start gap-4">
              <div
                className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-violet-400/35 bg-violet-500/15 shadow-[0_0_32px_rgba(139,92,246,0.45)]"
                aria-hidden
              >
                <Shield className="size-7 text-violet-200" />
              </div>
              <div className="min-w-0">
                <h1
                  id="cooldown-hero-title"
                  className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl"
                >
                  Take a Moment to Reset
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
                  Your session involved some intense moments.
                  <br className="hidden sm:inline" /> Let&apos;s help you feel grounded before continuing.
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* 2. High Risk Detected card */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={cn(
            cooldownMatteCard,
            "border-amber-500/20 p-6 sm:p-7",
            "shadow-[0_0_48px_-16px_rgba(251,191,36,0.35),inset_0_1px_0_rgba(251,191,36,0.06)]",
          )}
          aria-labelledby="cooldown-risk-title"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 gap-4">
              <div
                className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-500/15 ring-1 ring-amber-400/35 shadow-[0_0_28px_rgba(251,191,36,0.35)]"
                aria-hidden
              >
                <AlertCircle className="size-6 text-amber-300" />
              </div>
              <div className="min-w-0">
                <h2 id="cooldown-risk-title" className="text-lg font-bold text-amber-200">
                  {riskTitle}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/72">
                  Our safety system detected concerning patterns during your session. This cooldown
                  period helps ensure you&apos;re feeling stable before you continue.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={cooldownPill}>
                    <Clock className="size-3.5 text-amber-300/90" aria-hidden />
                    Time in cooldown: {formatTime(timeInCooldown)}
                  </span>
                  <span className={cooldownPill}>
                    <CheckCircle className="size-3.5 text-emerald-300/90" aria-hidden />
                    {completedActivities.length} activities completed
                  </span>
                </div>
              </div>
            </div>
            <div
              className="pointer-events-none relative mx-auto flex h-24 w-24 shrink-0 items-center justify-center opacity-40 sm:mx-0 sm:h-28 sm:w-28"
              aria-hidden
            >
              <Shield className="absolute size-24 text-amber-400/30 sm:size-28" strokeWidth={1} />
              <Heart className="relative size-10 text-amber-300/50 sm:size-12" fill="currentColor" />
            </div>
          </div>
        </motion.section>

        {/* 3. Breathing guide section */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={cn(
            cooldownMatteCard,
            "overflow-hidden border-violet-500/15 p-6 sm:p-8",
            "shadow-[0_0_56px_-18px_rgba(139,92,246,0.4)]",
          )}
          aria-labelledby="cooldown-breathing-title"
        >
          <svg
            className="pointer-events-none absolute bottom-8 left-0 right-0 h-16 w-full opacity-[0.12]"
            viewBox="0 0 800 64"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path
              d="M0,32 Q100,8 200,32 T400,32 T600,32 T800,32"
              fill="none"
              stroke="url(#cooldown-wave)"
              strokeWidth="2"
            />
            <defs>
              <linearGradient id="cooldown-wave" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity="0" />
                <stop offset="50%" stopColor="#c084fc" stopOpacity="1" />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <motion.div className="min-w-0 flex-1 lg:max-w-[52%]">
              <h2 id="cooldown-breathing-title" className="text-xl font-bold text-white sm:text-2xl">
                Take a deep breath. You&apos;re safe right now.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/65 sm:text-base">
                Follow the breathing guide below to slow down and center yourself.
              </p>
              <button
                type="button"
                onClick={() => setCurrentActivity("breathing")}
                className={cn(
                  "mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-2xl px-5 text-sm font-semibold",
                  "border border-violet-400/30 bg-gradient-to-r from-violet-600/90 via-fuchsia-600/85 to-violet-700/90 text-white",
                  "shadow-[0_0_36px_-8px_rgba(168,85,247,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]",
                  "transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50",
                )}
              >
                <Play className="size-4 fill-current" aria-hidden />
                Start Breathing Guide
              </button>
            </motion.div>

            <div className="flex flex-col items-center lg:shrink-0">
              <BreathingOrb />
              <p className="mt-3 text-xs tracking-wide text-violet-200/70">Inhale • Hold • Exhale</p>
            </div>
          </div>

          <div className="relative mt-8 flex flex-wrap justify-center gap-2 sm:justify-start">
            {BENEFIT_CHIPS.map((chip) => (
              <span key={chip.label} className={cooldownBenefitChip}>
                <chip.icon className={cn("size-3.5", chip.tone)} aria-hidden />
                {chip.label}
              </span>
            ))}
          </div>
        </motion.section>

        {/* 4. Recovery Activities */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          aria-labelledby="cooldown-activities-title"
        >
          <h2 id="cooldown-activities-title" className="text-xl font-bold text-white">
            Recovery Activities
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Choose at least one activity to help you feel centered and calm.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Breathing */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCurrentActivity("breathing")}
              className={cooldownActivityCard(
                "[--glow:rgba(34,211,238,0.45)] border-cyan-500/20 shadow-[0_0_40px_-16px_rgba(34,211,238,0.35)]",
              )}
            >
              <div className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-full bg-cyan-500/15 ring-1 ring-cyan-400/30 shadow-[0_0_28px_rgba(34,211,238,0.35)]">
                <Wind className="size-7 text-cyan-200" aria-hidden />
              </div>
              <h3 className="font-bold text-white">Breathing Exercise</h3>
              <p className="mt-2 text-sm text-white/60">
                Calm your nervous system with guided breathing
              </p>
              {completedActivities.includes("breathing") ? (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-emerald-300">
                  <CheckCircle className="size-4" aria-hidden />
                  Completed
                </div>
              ) : (
                <span className="mt-4 inline-flex items-center justify-center gap-1 text-sm font-medium text-cyan-300">
                  Start Exercise
                  <ChevronRight className="size-4" aria-hidden />
                </span>
              )}
            </motion.button>

            {/* Grounding */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCurrentActivity("grounding")}
              className={cooldownActivityCard(
                "[--glow:rgba(168,85,247,0.45)] border-violet-500/20 shadow-[0_0_40px_-16px_rgba(139,92,246,0.35)]",
              )}
            >
              <div className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-full bg-violet-500/15 ring-1 ring-violet-400/30 shadow-[0_0_28px_rgba(139,92,246,0.35)]">
                <Eye className="size-7 text-violet-200" aria-hidden />
              </div>
              <h3 className="font-bold text-white">Grounding Exercise</h3>
              <p className="mt-2 text-sm text-white/60">Reconnect with the present moment</p>
              {completedActivities.includes("grounding") ? (
                <motion.div className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-emerald-300">
                  <CheckCircle className="size-4" aria-hidden />
                  Completed
                </motion.div>
              ) : (
                <span className="mt-4 inline-flex items-center justify-center gap-1 text-sm font-medium text-violet-300">
                  Start Exercise
                  <ChevronRight className="size-4" aria-hidden />
                </span>
              )}
            </motion.button>

            {/* Rest */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCurrentActivity("rest")}
              className={cn(
                cooldownActivityCard(
                  "[--glow:rgba(236,72,153,0.45)] border-pink-500/20 shadow-[0_0_40px_-16px_rgba(236,72,153,0.35)]",
                ),
                "sm:col-span-2 lg:col-span-1",
              )}
            >
              <div className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-full bg-pink-500/15 ring-1 ring-pink-400/30 shadow-[0_0_28px_rgba(236,72,153,0.35)]">
                <Coffee className="size-7 text-pink-200" aria-hidden />
              </div>
              <h3 className="font-bold text-white">Quiet Rest</h3>
              <p className="mt-2 text-sm text-white/60">Take a few minutes to simply be still</p>
              {completedActivities.includes("rest") ? (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-emerald-300">
                  <CheckCircle className="size-4" aria-hidden />
                  Completed
                </div>
              ) : (
                <span className="mt-4 inline-flex items-center justify-center gap-1 text-sm font-medium text-pink-300">
                  Start Rest
                  <ChevronRight className="size-4" aria-hidden />
                </span>
              )}
            </motion.button>
          </div>
        </motion.section>

        {/* 5. Cooldown requirement notice */}
        <CooldownRequirementNotice
          canProceed={canProceed}
          hasActivity={hasActivity}
          hasMinTime={hasMinTime}
          timeRemaining={timeRemaining}
        />

        {/* 6. Action row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-stretch"
        >
          <button
            type="button"
            onClick={handleProceed}
            disabled={!canProceed}
            className={cooldownContinueBtn(canProceed)}
          >
            <Heart className="size-5" aria-hidden />
            I&apos;m Feeling Better - Continue
          </button>
          <button type="button" onClick={() => navigate("/app/dashboard")} className={cooldownHomeBtn}>
            <Home className="size-5" aria-hidden />
            Go Home
          </button>
        </motion.div>

        {/* 7. Helpful Resources */}
        <HelpfulResourcesCard safetyLevel={String(safetyLevel)} />

        {/* 8. Footer */}
        <CooldownFooter />
      </motion.div>
    </div>
  );
}
