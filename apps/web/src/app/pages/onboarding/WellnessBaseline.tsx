import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowLeft,
  Smile,
  Frown,
  Meh,
  Laugh,
  Angry,
  Loader2,
  Sparkles,
  Shield,
  Heart,
  Flower2,
  Brain,
  Zap,
  Moon,
  ShieldCheck,
  Compass,
  Briefcase,
  Sprout,
  Clock,
  CircleDollarSign,
  Activity,
} from "lucide-react";
import { useOnboarding } from "@/app/contexts/OnboardingContext";
import { useAuth } from "@/app/contexts/AuthContext";
import { useOnboardingResume } from "@/app/hooks/useOnboardingResume";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useEffect, type ReactNode } from "react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "../../components/ui/form";
import { cn } from "@/lib/utils";
import { BRAND_LOGO_ON_DARK_BG } from "@/app/components/BrandLogo";
import { WELLNESS_GOALS, type WellnessGoalValue } from "@/lib/wellnessGoals";
import type { LucideIcon } from "lucide-react";

const WELLNESS_BASELINE_BG = "/solace/emotional-focus-twilight-sanctuary.jpg";
const SOLACE_LOGO_SRC = BRAND_LOGO_ON_DARK_BG;
const ONBOARDING_NAV_H = "4.5rem";
const CURRENT_STEP = 3;
const TOTAL_STEPS = 8;
const PROGRESS_PERCENT = (CURRENT_STEP / TOTAL_STEPS) * 100;

const sanctuaryCardClass = cn(
  "relative w-full rounded-[28px] border border-[#FF4E91]/22 bg-[#0A0B1E]/48 px-5 pb-6 pt-10 backdrop-blur-2xl sm:px-8 sm:pb-8 sm:pt-11",
  "shadow-[0_0_0_1px_rgba(138,79,255,0.1),0_28px_72px_-32px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)]",
);

const wellnessBaselineSchema = z.object({
  currentMood: z.string().optional(),
  selectedGoals: z.array(z.string()).min(1, "Please select at least one goal"),
});

type WellnessBaselineValues = z.infer<typeof wellnessBaselineSchema>;

const moods = [
  {
    value: "great",
    label: "Great",
    micro: "Feeling amazing",
    icon: Laugh,
    glow: "shadow-[0_0_28px_-6px_rgba(74,222,128,0.55)]",
    ring: "from-emerald-400/55 to-emerald-900/20",
    iconClass: "text-emerald-300",
    borderActive: "border-emerald-400/45",
    bgActive: "bg-emerald-500/[0.12]",
  },
  {
    value: "good",
    label: "Good",
    micro: "Pretty good",
    icon: Smile,
    glow: "shadow-[0_0_28px_-6px_rgba(96,165,250,0.55)]",
    ring: "from-sky-400/55 to-sky-900/20",
    iconClass: "text-sky-300",
    borderActive: "border-sky-400/45",
    bgActive: "bg-sky-500/[0.12]",
  },
  {
    value: "okay",
    label: "Okay",
    micro: "So-so",
    icon: Meh,
    glow: "shadow-[0_0_28px_-6px_rgba(250,204,21,0.5)]",
    ring: "from-amber-300/55 to-amber-900/20",
    iconClass: "text-amber-200",
    borderActive: "border-amber-300/45",
    bgActive: "bg-amber-400/[0.1]",
  },
  {
    value: "down",
    label: "Down",
    micro: "Feeling low",
    icon: Frown,
    glow: "shadow-[0_0_28px_-6px_rgba(251,146,60,0.5)]",
    ring: "from-orange-400/55 to-orange-900/20",
    iconClass: "text-orange-300",
    borderActive: "border-orange-400/45",
    bgActive: "bg-orange-500/[0.1]",
  },
  {
    value: "struggling",
    label: "Struggling",
    micro: "Very tough",
    icon: Angry,
    glow: "shadow-[0_0_28px_-6px_rgba(248,113,113,0.55)]",
    ring: "from-rose-400/55 to-rose-900/20",
    iconClass: "text-rose-300",
    borderActive: "border-rose-400/45",
    bgActive: "bg-rose-500/[0.12]",
  },
] as const;

const focusAreaStyles: Record<
  WellnessGoalValue,
  {
    icon: LucideIcon;
    glow: string;
    iconClass: string;
    ring: string;
  }
> = {
  "feel-calm-in-control": {
    icon: Brain,
    glow: "shadow-[0_0_20px_-4px_rgba(255,78,145,0.5)]",
    iconClass: "text-[#fda4cf]",
    ring: "from-[#FF4E91]/50 to-purple-900/25",
  },
  "boost-mood-daily-energy": {
    icon: Zap,
    glow: "shadow-[0_0_20px_-4px_rgba(251,146,60,0.45)]",
    iconClass: "text-orange-300",
    ring: "from-orange-400/50 to-amber-900/20",
  },
  "sleep-recovery": {
    icon: Moon,
    glow: "shadow-[0_0_20px_-4px_rgba(167,139,250,0.5)]",
    iconClass: "text-violet-300",
    ring: "from-violet-400/50 to-indigo-900/25",
  },
  "build-confidence-self-trust": {
    icon: ShieldCheck,
    glow: "shadow-[0_0_20px_-4px_rgba(96,165,250,0.45)]",
    iconClass: "text-sky-300",
    ring: "from-sky-400/50 to-blue-900/20",
  },
  "strengthen-relationships": {
    icon: Heart,
    glow: "shadow-[0_0_20px_-4px_rgba(255,78,145,0.45)]",
    iconClass: "text-[#fda4cf]",
    ring: "from-[#FF4E91]/45 to-rose-900/20",
  },
  "navigate-life-changes": {
    icon: Compass,
    glow: "shadow-[0_0_20px_-4px_rgba(45,212,191,0.45)]",
    iconClass: "text-teal-300",
    ring: "from-teal-400/50 to-teal-900/20",
  },
  "work-life-balance": {
    icon: Briefcase,
    glow: "shadow-[0_0_20px_-4px_rgba(251,146,60,0.4)]",
    iconClass: "text-amber-200",
    ring: "from-amber-400/45 to-orange-900/20",
  },
  "personal-goal-life-direction": {
    icon: Sprout,
    glow: "shadow-[0_0_20px_-4px_rgba(74,222,128,0.4)]",
    iconClass: "text-emerald-300",
    ring: "from-emerald-400/45 to-emerald-900/20",
  },
  "time-management-productivity": {
    icon: Clock,
    glow: "shadow-[0_0_20px_-4px_rgba(167,139,250,0.45)]",
    iconClass: "text-violet-300",
    ring: "from-violet-400/45 to-purple-900/20",
  },
  "financial-wellness": {
    icon: CircleDollarSign,
    glow: "shadow-[0_0_20px_-4px_rgba(250,204,21,0.4)]",
    iconClass: "text-amber-200",
    ring: "from-amber-300/45 to-yellow-900/20",
  },
  "health-fitness-body-goals": {
    icon: Activity,
    glow: "shadow-[0_0_20px_-4px_rgba(255,78,145,0.4)]",
    iconClass: "text-[#fda4cf]",
    ring: "from-[#FF4E91]/40 to-pink-900/20",
  },
  "faith-purpose-inner-grounding": {
    icon: Flower2,
    glow: "shadow-[0_0_20px_-4px_rgba(192,132,252,0.45)]",
    iconClass: "text-purple-300",
    ring: "from-purple-400/45 to-violet-900/20",
  },
};

const focusAreas = WELLNESS_GOALS.map((goal) => ({
  ...goal,
  ...focusAreaStyles[goal.value],
}));

function WellnessBaselineSceneBackdrop() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.1, ease: "easeOut" }}
    >
      <img
        src={WELLNESS_BASELINE_BG}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[center_38%]"
        width={2400}
        height={1350}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_42%,rgba(138,79,255,0.2)_0%,transparent_58%)]"
        animate={{ opacity: [0.55, 0.82, 0.55] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_75%_50%_at_50%_68%,rgba(255,78,145,0.16)_0%,transparent_62%)]"
        animate={{ opacity: [0.45, 0.72, 0.45] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_120%_85%_at_50%_100%,rgba(5,6,18,0.94)_0%,transparent_52%)]"
        animate={{ opacity: [0.88, 1, 0.88] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_0%,rgba(7,8,21,0.78)_0%,transparent_48%)]"
        animate={{ opacity: [0.7, 0.92, 0.7] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      />
      <motion.div
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,8,21,0.5)_0%,rgba(7,8,21,0.18)_40%,rgba(7,8,21,0.78)_100%)]"
        animate={{ opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 bg-[#070815]/48" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_50%,transparent_28%,rgba(0,0,0,0.65)_100%)]" />

      {[
        { left: "10%", top: "62%", delay: 0 },
        { left: "24%", top: "70%", delay: 0.8 },
        { left: "38%", top: "66%", delay: 1.5 },
        { left: "52%", top: "72%", delay: 0.4 },
        { left: "66%", top: "68%", delay: 1.1 },
        { left: "80%", top: "74%", delay: 1.9 },
        { left: "16%", top: "48%", delay: 1.3 },
        { left: "72%", top: "52%", delay: 0.6 },
        { left: "88%", top: "58%", delay: 2.2 },
      ].map((particle, index) => (
        <motion.span
          key={index}
          className="absolute h-1 w-1 rounded-full bg-[#ffb4d9]/80 shadow-[0_0_10px_rgba(255,120,180,0.6)]"
          style={{ left: particle.left, top: particle.top }}
          animate={{ opacity: [0.2, 0.8, 0.2], y: [0, -7, 0] }}
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

interface WellnessBaselineTopBarProps {
  progressPercent: number;
  onBack: () => void;
}

function WellnessBaselineTopBar({ progressPercent, onBack }: WellnessBaselineTopBarProps) {
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
          <motion.div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/[0.06] hover:text-white"
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

      <motion.div
        className="mx-auto hidden h-full max-w-[1200px] items-center gap-4 px-6 lg:px-8 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto]"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <img src={SOLACE_LOGO_SRC} alt="Solace" className="h-9 w-auto object-contain" />
          <span className="h-6 w-px bg-white/15" aria-hidden />
          <span className="text-[15px] font-medium tracking-wide text-white/92">Solace</span>
        </div>

        <motion.div
          className="px-2"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <motion.div
            className="h-1.5 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/[0.04] backdrop-blur-sm"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
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
          </motion.div>
        </motion.div>

        <p className="shrink-0 text-sm text-violet-200/65">
          Step {CURRENT_STEP} of {TOTAL_STEPS}
        </p>
      </motion.div>
    </header>
  );
}

interface SanctuaryIconBadgeProps {
  children: ReactNode;
}

function SanctuaryIconBadge({ children }: SanctuaryIconBadgeProps) {
  return (
    <motion.div
      className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.15, duration: 0.45 }}
    >
      <motion.div
        className="flex h-11 w-11 items-center justify-center rounded-full border border-[#FF4E91]/35 bg-[#0A0B1E]/85 shadow-[0_0_28px_-4px_rgba(255,78,145,0.55)] backdrop-blur-md"
        animate={{ boxShadow: ["0 0 28px -4px rgba(255,78,145,0.45)", "0 0 36px -2px rgba(255,78,145,0.65)", "0 0 28px -4px rgba(255,78,145,0.45)"] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

interface MoodOptionCardProps {
  mood: (typeof moods)[number];
  isSelected: boolean;
  onSelect: () => void;
  delay?: number;
}

function MoodOptionCard({ mood, isSelected, onSelect, delay = 0 }: MoodOptionCardProps) {
  const Icon = mood.icon;
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-[20px] border px-2 py-4 backdrop-blur-md transition-[border-color,box-shadow,background-color] duration-300",
        isSelected
          ? cn(mood.borderActive, mood.bgActive, mood.glow)
          : "border-white/[0.08] bg-[#0b0c20]/45 hover:border-[#8A4FFF]/30 hover:bg-[#12132e]/55",
      )}
    >
      <div className="relative">
        <motion.div
          className={cn(
            "pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br opacity-50 blur-[2px]",
            mood.ring,
          )}
          animate={{ opacity: isSelected ? [0.55, 0.85, 0.55] : [0.35, 0.55, 0.35] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          className={cn(
            "relative flex h-11 w-11 items-center justify-center rounded-full bg-black/35 ring-1 ring-white/[0.08]",
            isSelected && mood.glow,
          )}
        >
          <Icon className={cn("h-6 w-6", mood.iconClass)} strokeWidth={1.75} aria-hidden />
        </div>
      </div>
      <div className="text-center">
        <p className="text-[14px] font-semibold tracking-wide text-white/92">{mood.label}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-violet-200/55">{mood.micro}</p>
      </div>
    </motion.button>
  );
}

interface FocusAreaCardProps {
  area: (typeof focusAreas)[number];
  isSelected: boolean;
  onToggle: () => void;
  delay?: number;
}

function FocusAreaCard({ area, isSelected, onToggle, delay = 0 }: FocusAreaCardProps) {
  const Icon = area.icon;
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.38, ease: "easeOut" }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "flex w-full items-start gap-3 rounded-[18px] border px-4 py-3.5 text-left backdrop-blur-md transition-[border-color,box-shadow,background-color] duration-300 sm:py-4",
        isSelected
          ? cn(
              "border-[#FF4E91]/40 bg-gradient-to-r from-[#FF4E91]/12 via-[#d946ef]/8 to-[#8A4FFF]/12",
              "shadow-[0_0_24px_-8px_rgba(255,78,145,0.4)]",
            )
          : "border-white/[0.08] bg-[#0b0c20]/42 hover:border-[#8A4FFF]/28 hover:bg-[#12132e]/52",
      )}
    >
      <motion.div
        className={cn(
          "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/35 ring-1 ring-white/[0.06]",
          isSelected && area.glow,
        )}
        animate={isSelected ? { scale: [1, 1.04, 1] } : undefined}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.div
          className={cn(
            "pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br opacity-45 blur-[1px]",
            area.ring,
          )}
          animate={{ opacity: [0.4, 0.65, 0.4] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <Icon className={cn("relative z-[1] h-5 w-5", area.iconClass)} strokeWidth={1.75} aria-hidden />
      </motion.div>
      <motion.div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-snug text-white/90">{area.title}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-violet-200/55">{area.description}</p>
      </motion.div>
      {isSelected && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF4E91] to-[#8A4FFF] text-[10px] text-white shadow-[0_0_12px_-2px_rgba(255,78,145,0.55)]"
          aria-hidden
        >
          ✓
        </motion.span>
      )}
    </motion.button>
  );
}

export function OnboardingWellnessBaseline() {
  const { data, updateData } = useOnboarding();
  const { profile } = useAuth();
  const { resume, finishStep, goBack } = useOnboardingResume();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<WellnessBaselineValues>({
    resolver: zodResolver(wellnessBaselineSchema),
    defaultValues: {
      currentMood: data.currentMood || "",
      selectedGoals: data.selectedGoals || [],
    },
  });

  useEffect(() => {
    if (!resume || !profile) return;
    const goals = Array.isArray(profile.selected_goals)
      ? profile.selected_goals
      : typeof profile.selected_goals === "string"
        ? profile.selected_goals.split(",").map((s: string) => s.trim()).filter(Boolean)
        : data.selectedGoals || [];
    form.reset({
      currentMood: profile.current_mood || data.currentMood || "",
      selectedGoals: goals,
    });
  }, [resume, profile, data.currentMood, data.selectedGoals, form]);

  const onSubmit = async (values: WellnessBaselineValues) => {
    setIsLoading(true);
    try {
      if (resume) {
        await api.updateProfile({
          selected_goals: values.selectedGoals,
          ...(values.currentMood?.trim() ? { current_mood: values.currentMood.trim() } : {}),
        });
      }
      updateData(values);
      finishStep("/onboarding/health-background");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't save — try again");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTopBack = () => goBack("/onboarding/subscription");

  return (
    <motion.div
      className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#070815] text-[#FDFDFD]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <WellnessBaselineSceneBackdrop />
      <WellnessBaselineTopBar progressPercent={PROGRESS_PERCENT} onBack={handleTopBack} />

      <main className="relative z-10 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <motion.div
          className="mx-auto flex w-full max-w-[920px] flex-col items-center px-4 py-6 pb-12 sm:px-6 sm:py-8 sm:pb-14 md:px-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <header className="mb-7 text-center sm:mb-9">
            <h1 className="solace-login-serif inline-flex flex-wrap items-center justify-center gap-2 text-[clamp(1.85rem,4.2vw,2.85rem)] font-medium leading-[1.1] text-[#FDFDFD] drop-shadow-[0_2px_28px_rgba(0,0,0,0.45)]">
              How Are You Feeling Today?
              <Sparkles
                className="h-5 w-5 text-[#FF4E91] drop-shadow-[0_0_12px_rgba(255,78,145,0.55)] sm:h-6 sm:w-6"
                aria-hidden
              />
            </h1>
            <p className="mt-2 max-w-[min(520px,92vw)] text-[clamp(0.95rem,1.8vw,1.1rem)] leading-relaxed text-violet-200/72">
              This helps us understand where to focus our support
            </p>
          </header>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex w-full flex-col gap-7 sm:gap-8"
            >
              <motion.section
                className="relative w-full"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.55, ease: "easeOut" }}
              >
                <SanctuaryIconBadge>
                  <Heart
                    className="h-5 w-5 text-[#FF4E91] drop-shadow-[0_0_10px_rgba(255,78,145,0.45)]"
                    aria-hidden
                  />
                </SanctuaryIconBadge>
                <div className={sanctuaryCardClass}>
                  <FormField
                    control={form.control}
                    name="currentMood"
                    render={({ field }) => (
                      <FormItem>
                        <p className="mb-5 text-center text-[clamp(1rem,2vw,1.12rem)] font-medium text-white/90">
                          How would you describe your mood right now?
                        </p>
                        <FormControl>
                          <motion.div
                            className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3.5 lg:grid-cols-5"
                            initial="hidden"
                            animate="visible"
                            variants={{
                              hidden: {},
                              visible: { transition: { staggerChildren: 0.04 } },
                            }}
                          >
                            {moods.map((mood, index) => (
                              <MoodOptionCard
                                key={mood.value}
                                mood={mood}
                                isSelected={field.value === mood.value}
                                onSelect={() => field.onChange(mood.value)}
                                delay={0.12 + index * 0.04}
                              />
                            ))}
                          </motion.div>
                        </FormControl>
                        <FormMessage className="mt-3 text-center text-[13px] text-[#ff8ab8]" />
                      </FormItem>
                    )}
                  />
                </div>
              </motion.section>

              <motion.section
                className="relative w-full"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16, duration: 0.55, ease: "easeOut" }}
              >
                <SanctuaryIconBadge>
                  <Flower2
                    className="h-5 w-5 text-[#c084fc] drop-shadow-[0_0_10px_rgba(192,132,252,0.45)]"
                    aria-hidden
                  />
                </SanctuaryIconBadge>
                <motion.div className={sanctuaryCardClass}>
                  <FormField
                    control={form.control}
                    name="selectedGoals"
                    render={({ field }) => (
                      <FormItem>
                        <div className="mb-5 text-center">
                          <p className="text-[clamp(1rem,2vw,1.12rem)] font-medium text-white/90">
                            What would you like to work on?
                          </p>
                          <p className="mt-1 text-[13px] text-violet-200/55">Select all that apply</p>
                        </div>
                        <FormControl>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {focusAreas.map((area, index) => {
                              const selected = (field.value || []).includes(area.value);
                              return (
                                <FocusAreaCard
                                  key={area.value}
                                  area={area}
                                  isSelected={selected}
                                  onToggle={() => {
                                    const current = field.value || [];
                                    const next = selected
                                      ? current.filter((g: string) => g !== area.value)
                                      : [...current, area.value];
                                    field.onChange(next);
                                  }}
                                  delay={0.2 + index * 0.03}
                                />
                              );
                            })}
                          </div>
                        </FormControl>
                        <FormMessage className="mt-3 text-center text-[13px] text-[#ff8ab8]" />
                      </FormItem>
                    )}
                  />
                </motion.div>
              </motion.section>

              <motion.div
                className="flex w-full max-w-[min(640px,100%)] flex-col gap-3 self-center sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28, duration: 0.5 }}
              >
                <Link to="/onboarding/profile-setup" className="w-full sm:w-auto sm:min-w-[140px]">
                  <motion.button
                    type="button"
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    className={cn(
                      "flex h-14 w-full items-center justify-center gap-2 rounded-[18px] border border-white/10",
                      "bg-[#0b0c20]/55 px-6 text-[15px] font-medium text-white/88 backdrop-blur-md",
                      "transition-[border-color,box-shadow] duration-200",
                      "hover:border-violet-400/30 hover:bg-[#12132e]/65",
                    )}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </motion.button>
                </Link>

                <motion.button
                  type="submit"
                  disabled={isLoading}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  className={cn(
                    "flex h-14 w-full items-center justify-center gap-2 rounded-[18px] px-6 sm:min-w-[200px] sm:flex-1",
                    "bg-gradient-to-r from-[#FF4E91] via-[#d946ef] to-[#8A4FFF] text-[15px] font-semibold text-white",
                    "shadow-[0_0_40px_-8px_rgba(255,78,145,0.65)]",
                    "transition-[box-shadow,opacity] duration-300 hover:shadow-[0_0_52px_-6px_rgba(138,79,255,0.55)]",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </motion.button>
              </motion.div>
            </form>
          </Form>

          <motion.footer
            className="mt-8 flex max-w-[min(520px,92vw)] flex-col items-center gap-1.5 text-center sm:mt-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.36, duration: 0.5 }}
          >
            <div className="flex items-center gap-2 text-violet-200/50">
              <Shield className="h-4 w-4 text-[#FF4E91]/70" aria-hidden />
              <p className="text-[13px] font-medium text-violet-100/55">
                Your privacy is important to us.
              </p>
            </div>
            <p className="text-[12px] leading-relaxed text-violet-200/42">
              Everything you share is encrypted and secure.
            </p>
          </motion.footer>
        </motion.div>
      </main>
    </motion.div>
  );
}
