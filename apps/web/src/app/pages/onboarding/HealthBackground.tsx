import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowLeft,
  Shield,
  Loader2,
  Sparkles,
  Heart,
  User,
  Leaf,
  Flower2,
  Users,
  Hourglass,
  Brain,
  BatteryLow,
  Target,
  Mountain,
  Moon,
  Clock,
  MessageCircle,
  HelpCircle,
  Briefcase,
  GitBranch,
  Bell,
  ShieldCheck,
  Stethoscope,
  UsersRound,
  Check,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";
import { useOnboarding } from "@/app/contexts/OnboardingContext";
import { useOnboardingResume } from "@/app/hooks/useOnboardingResume";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useEffect } from "react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "../../components/ui/form";
import { cn } from "@/lib/utils";
import { BRAND_LOGO_ON_DARK_BG } from "@/app/components/BrandLogo";

/** Pure calm alpine mountain / lake environment — not a UI screenshot. */
const HEALTH_BACKGROUND_BG = "/solace/health-background-calm-mountains.jpg";
const SOLACE_LOGO_SRC = BRAND_LOGO_ON_DARK_BG;
const ONBOARDING_NAV_H = "4.5rem";
const CURRENT_STEP = 4;
const TOTAL_STEPS = 8;
const PROGRESS_PERCENT = (CURRENT_STEP / TOTAL_STEPS) * 100;

const healthBackgroundSchema = z.object({
  inTherapy: z.string().optional(),
  onMedication: z.string().optional(),
  selectedTriggers: z.array(z.string()).default([]),
});

type HealthBackgroundValues = z.infer<typeof healthBackgroundSchema>;

const glassCardClass = cn(
  "relative w-full rounded-[28px] border border-[#FF4E91]/22 bg-[#0A0B1E]/48 backdrop-blur-2xl",
  "shadow-[0_0_0_1px_rgba(138,79,255,0.1),0_28px_72px_-32px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)]",
);

const therapyOptions = [
  { value: "yes", label: "Yes", subtext: "I am", icon: Heart },
  { value: "no", label: "No", subtext: "I am not", icon: User },
  {
    value: "prefer-not-to-say",
    label: "Prefer Not To Say",
    subtext: "I'd rather not share",
    icon: Leaf,
  },
] as const;

const medicationOptions = [
  { value: "yes", label: "Yes", subtext: "I am", icon: Stethoscope },
  { value: "no", label: "No", subtext: "I am not", icon: ShieldCheck },
  {
    value: "prefer-not-to-say",
    label: "Prefer Not To Say",
    subtext: "I'd rather not share",
    icon: Leaf,
  },
] as const;

const triggers: {
  value: string;
  label: string;
  description: string;
  icon: LucideIcon;
  iconClass: string;
  ring: string;
}[] = [
  {
    value: "crowds",
    label: "Crowds",
    description: "Overwhelming places",
    icon: Users,
    iconClass: "text-sky-300",
    ring: "from-sky-400/50 to-indigo-900/25",
  },
  {
    value: "procrastination",
    label: "Procrastination",
    description: "Putting things off",
    icon: Hourglass,
    iconClass: "text-amber-200",
    ring: "from-amber-300/50 to-amber-900/20",
  },
  {
    value: "overthinking",
    label: "Overthinking",
    description: "Racing thoughts",
    icon: Brain,
    iconClass: "text-violet-300",
    ring: "from-violet-400/50 to-purple-900/25",
  },
  {
    value: "low-energy-days",
    label: "Low-energy days",
    description: "Feeling drained",
    icon: BatteryLow,
    iconClass: "text-orange-300",
    ring: "from-orange-400/50 to-orange-900/20",
  },
  {
    value: "focus-issues",
    label: "Focus issues",
    description: "Trouble concentrating",
    icon: Target,
    iconClass: "text-rose-300",
    ring: "from-rose-400/50 to-rose-900/20",
  },
  {
    value: "motivation-dips",
    label: "Motivation dips",
    description: "Losing drive",
    icon: Mountain,
    iconClass: "text-emerald-300",
    ring: "from-emerald-400/50 to-emerald-900/20",
  },
  {
    value: "sleep-routine",
    label: "Sleep routine",
    description: "Irregular sleep",
    icon: Moon,
    iconClass: "text-indigo-300",
    ring: "from-indigo-400/50 to-indigo-900/25",
  },
  {
    value: "time-management",
    label: "Time management",
    description: "Struggling to keep up",
    icon: Clock,
    iconClass: "text-cyan-300",
    ring: "from-cyan-400/45 to-cyan-900/20",
  },
  {
    value: "difficult-conversations",
    label: "Difficult conversations",
    description: "Hard talks",
    icon: MessageCircle,
    iconClass: "text-[#fda4cf]",
    ring: "from-[#FF4E91]/50 to-pink-900/25",
  },
  {
    value: "uncertainty",
    label: "Uncertainty",
    description: "Feeling unsure",
    icon: HelpCircle,
    iconClass: "text-violet-200",
    ring: "from-violet-300/45 to-violet-900/20",
  },
  {
    value: "workload-pressure",
    label: "Workload pressure",
    description: "Too much to handle",
    icon: Briefcase,
    iconClass: "text-slate-300",
    ring: "from-slate-400/40 to-slate-900/20",
  },
  {
    value: "decision-making",
    label: "Decision-making",
    description: "Hard to choose",
    icon: GitBranch,
    iconClass: "text-teal-300",
    ring: "from-teal-400/45 to-teal-900/20",
  },
  {
    value: "distractions",
    label: "Distractions",
    description: "Easily pulled away",
    icon: Bell,
    iconClass: "text-yellow-200",
    ring: "from-yellow-300/45 to-yellow-900/20",
  },
  {
    value: "confidence-dips",
    label: "Confidence dips",
    description: "Self-doubt",
    icon: ShieldCheck,
    iconClass: "text-fuchsia-300",
    ring: "from-fuchsia-400/45 to-fuchsia-900/20",
  },
  {
    value: "social-situations",
    label: "Social situations",
    description: "Connecting feels hard",
    icon: UsersRound,
    iconClass: "text-pink-300",
    ring: "from-pink-400/50 to-pink-900/25",
  },
];

function HealthBackgroundSceneBackdrop() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.1, ease: "easeOut" }}
    >
      <img
        src={HEALTH_BACKGROUND_BG}
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
        animate={{ opacity: [0.7, 0.92, 0.7] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      />
      <div className="absolute inset-0 bg-[#070815]/50" />
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
        { left: "8%", top: "58%", delay: 0 },
        { left: "22%", top: "66%", delay: 0.9 },
        { left: "36%", top: "62%", delay: 1.6 },
        { left: "50%", top: "68%", delay: 0.5 },
        { left: "64%", top: "64%", delay: 1.2 },
        { left: "78%", top: "70%", delay: 2 },
        { left: "14%", top: "44%", delay: 1.4 },
        { left: "70%", top: "48%", delay: 0.7 },
        { left: "86%", top: "54%", delay: 2.3 },
        { left: "42%", top: "52%", delay: 1.8 },
        { left: "58%", top: "46%", delay: 0.3 },
      ].map((particle, index) => (
        <motion.span
          key={index}
          className="absolute h-1 w-1 rounded-full bg-[#ffb4a8]/85 shadow-[0_0_10px_rgba(255,140,100,0.55)]"
          style={{ left: particle.left, top: particle.top }}
          animate={{ opacity: [0.15, 0.75, 0.15], y: [0, -8, 0] }}
          transition={{
            duration: 5 + (index % 3),
            repeat: Infinity,
            ease: "easeInOut",
            delay: particle.delay,
          }}
        />
      ))}
    </motion.div>
  );
}

interface HealthBackgroundTopBarProps {
  progressPercent: number;
  onBack: () => void;
}

function HealthBackgroundTopBar({ progressPercent, onBack }: HealthBackgroundTopBarProps) {
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
        <div className="flex items-center justify-between gap-3">
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
        </div>
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

interface TherapyOptionButtonProps {
  option: (typeof therapyOptions)[number] | (typeof medicationOptions)[number];
  isSelected: boolean;
  onSelect: () => void;
}

function TherapyOptionButton({ option, isSelected, onSelect }: TherapyOptionButtonProps) {
  const Icon = option.icon;
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "flex min-h-[108px] flex-1 flex-col items-center justify-center gap-2 rounded-[18px] border px-3 py-4 backdrop-blur-md transition-[border-color,box-shadow,background-color] duration-300",
        isSelected
          ? "border-[#FF4E91]/55 bg-gradient-to-b from-[#FF4E91]/14 via-[#d946ef]/8 to-[#8A4FFF]/10 shadow-[0_0_28px_-8px_rgba(255,78,145,0.5)]"
          : "border-white/[0.08] bg-[#0b0c20]/45 hover:border-[#8A4FFF]/28 hover:bg-[#12132e]/55",
      )}
    >
      <div className="relative">
        {isSelected && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-[#FF4E91] to-[#8A4FFF] shadow-[0_0_10px_rgba(255,78,145,0.5)]">
            <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} aria-hidden />
          </span>
        )}
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full bg-black/35 ring-1 ring-white/[0.08]",
            isSelected && "shadow-[0_0_16px_-4px_rgba(255,78,145,0.45)]",
          )}
        >
          <Icon
            className={cn("h-[18px] w-[18px]", isSelected ? "text-[#fda4cf]" : "text-violet-200/70")}
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
      </div>
      <div className="text-center">
        <p className="text-[14px] font-semibold text-white/92">{option.label}</p>
        <p className="mt-0.5 text-[11px] text-violet-200/55">{option.subtext}</p>
      </div>
    </motion.button>
  );
}

interface ChallengeChipProps {
  trigger: (typeof triggers)[number];
  isSelected: boolean;
  onToggle: () => void;
}

function ChallengeChip({ trigger, isSelected, onToggle }: ChallengeChipProps) {
  const Icon = trigger.icon;
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "relative flex w-full items-start gap-3 rounded-[18px] border px-4 py-3.5 text-left backdrop-blur-md transition-[border-color,box-shadow,background-color] duration-300 sm:py-4",
        isSelected
          ? cn(
              "border-[#FF4E91]/45 bg-gradient-to-r from-[#FF4E91]/14 via-[#d946ef]/10 to-[#8A4FFF]/12",
              "shadow-[0_0_24px_-8px_rgba(255,78,145,0.42)]",
            )
          : "border-white/[0.08] bg-[#0b0c20]/42 hover:border-[#8A4FFF]/28 hover:bg-[#12132e]/52",
      )}
    >
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/35 ring-1 ring-white/[0.06]">
        <div
          className={cn(
            "pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br opacity-45 blur-[1px]",
            trigger.ring,
          )}
        />
        <Icon className={cn("relative z-[1] h-5 w-5", trigger.iconClass)} strokeWidth={1.75} aria-hidden />
      </div>
      <div className="min-w-0 flex-1 pr-6">
        <p className="text-[14px] font-semibold leading-snug text-white/90">{trigger.label}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-violet-200/55">{trigger.description}</p>
      </div>
      {isSelected && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#FF4E91] to-[#8A4FFF] shadow-[0_0_12px_-2px_rgba(255,78,145,0.55)]"
          aria-hidden
        >
          <Check className="h-3 w-3 text-white" strokeWidth={3} />
        </motion.span>
      )}
    </motion.button>
  );
}

export function OnboardingHealthBackground() {
  const { profile, refreshProfile } = useAuth();
  const { data, updateData } = useOnboarding();
  const { resume, finishStep, goBack } = useOnboardingResume();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<HealthBackgroundValues>({
    resolver: zodResolver(healthBackgroundSchema),
    defaultValues: {
      inTherapy: data.inTherapy || "",
      onMedication: data.onMedication || "",
      selectedTriggers: data.selectedTriggers || [],
    },
  });

  useEffect(() => {
    if (!resume || !profile) return;
    const triggers = Array.isArray(profile.selected_triggers)
      ? profile.selected_triggers
      : typeof profile.selected_triggers === "string"
        ? profile.selected_triggers.split(",").map((s: string) => s.trim()).filter(Boolean)
        : data.selectedTriggers || [];
    form.reset({
      inTherapy: profile.in_therapy && profile.in_therapy !== "Not specified" ? profile.in_therapy : "",
      onMedication: profile.on_medication || "",
      selectedTriggers: triggers,
    });
  }, [resume, profile, data.selectedTriggers, form]);

  const onSubmit = async (values: HealthBackgroundValues) => {
    setIsLoading(true);
    try {
      await api.updateProfile({
        selected_triggers: values.selectedTriggers ?? [],
        ...(values.inTherapy?.trim() ? { in_therapy: values.inTherapy.trim() } : {}),
        ...(values.onMedication?.trim() ? { on_medication: values.onMedication.trim() } : {}),
      });
      await refreshProfile();
      updateData({
        inTherapy: values.inTherapy,
        onMedication: values.onMedication,
        selectedTriggers: values.selectedTriggers,
      });
      finishStep("/onboarding/avatar-preferences");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Couldn't save — try again";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTopBack = () => goBack("/onboarding/wellness-baseline");

  return (
    <motion.div
      className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#070815] text-[#FDFDFD]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <HealthBackgroundSceneBackdrop />
      <HealthBackgroundTopBar progressPercent={PROGRESS_PERCENT} onBack={handleTopBack} />

      <main className="relative z-10 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <motion.div
          className="mx-auto flex w-full max-w-[960px] flex-col items-center px-4 py-6 pb-12 sm:px-6 sm:py-8 sm:pb-14 md:px-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <header className="mb-6 text-center sm:mb-8">
            <h1 className="solace-login-serif inline-flex flex-wrap items-center justify-center gap-2 text-[clamp(1.9rem,4.5vw,3.25rem)] font-medium leading-[1.08] text-[#FDFDFD] drop-shadow-[0_0_32px_rgba(255,78,145,0.18),0_2px_28px_rgba(0,0,0,0.45)]">
              Health Background
              <Sparkles
                className="h-5 w-5 text-[#FF4E91] drop-shadow-[0_0_12px_rgba(255,78,145,0.55)] sm:h-6 sm:w-6"
                aria-hidden
              />
            </h1>
            <p className="mt-2 max-w-[min(640px,92vw)] text-[clamp(0.95rem,1.9vw,1.15rem)] leading-relaxed text-violet-200/72">
              This information helps us provide better support (all optional)
            </p>
          </header>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex w-full flex-col items-center gap-6 sm:gap-7"
            >
              <motion.section
                className="w-full max-w-[min(760px,100%)]"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06, duration: 0.5, ease: "easeOut" }}
              >
                <motion.div
                  className={cn(
                    "flex items-start gap-4 rounded-[24px] border border-[#FF4E91]/28 bg-[#0A0B1E]/55 px-5 py-6 backdrop-blur-2xl sm:gap-5 sm:px-7 sm:py-7",
                    "shadow-[0_0_32px_-12px_rgba(255,78,145,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]",
                  )}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#FF4E91]/35 bg-gradient-to-br from-[#FF4E91]/20 to-[#8A4FFF]/25 shadow-[0_0_24px_-4px_rgba(255,78,145,0.5)]">
                    <Shield className="h-5 w-5 text-[#fda4cf]" strokeWidth={1.75} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-white/92">Your Privacy Matters</p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-violet-200/62">
                      All health information is encrypted and never shared. You can update or remove
                      this anytime.
                    </p>
                  </div>
                </motion.div>
              </motion.section>

              <motion.section
                className="w-full"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.55, ease: "easeOut" }}
              >
                <div className={cn(glassCardClass, "px-5 py-7 sm:px-9 sm:py-9")}>
                  <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-10">
                    <motion.div
                      className="mx-auto flex shrink-0 items-center justify-center lg:mx-0"
                      animate={{
                        boxShadow: [
                          "0 0 40px -8px rgba(255,78,145,0.35)",
                          "0 0 56px -4px rgba(138,79,255,0.45)",
                          "0 0 40px -8px rgba(255,78,145,0.35)",
                        ],
                      }}
                      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <motion.div className="relative flex h-[120px] w-[120px] items-center justify-center rounded-full border border-[#FF4E91]/30 bg-gradient-to-br from-[#1a1030]/90 via-[#0f0a22]/95 to-[#0a0b1e]/90 backdrop-blur-md sm:h-[132px] sm:w-[132px]">
                        <div className="absolute inset-2 rounded-full bg-[radial-gradient(circle_at_50%_35%,rgba(255,78,145,0.35)_0%,transparent_65%)]" />
                        <Flower2
                          className="relative z-[1] h-12 w-12 text-[#fda4cf] drop-shadow-[0_0_18px_rgba(255,78,145,0.55)]"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                        <Moon
                          className="absolute right-5 top-4 h-4 w-4 text-violet-200/50"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                      </motion.div>
                    </motion.div>

                    <FormField
                      control={form.control}
                      name="inTherapy"
                      render={({ field }) => (
                        <FormItem className="min-w-0 flex-1 space-y-0">
                          <p className="mb-5 text-center text-[clamp(1rem,2vw,1.12rem)] font-medium text-white/90 lg:text-left">
                            Are you currently working with a therapist?
                          </p>
                          <FormControl>
                            <div className="flex flex-col gap-3 sm:flex-row sm:gap-3">
                              {therapyOptions.map((option) => (
                                <TherapyOptionButton
                                  key={option.value}
                                  option={option}
                                  isSelected={field.value === option.value}
                                  onSelect={() => field.onChange(option.value)}
                                />
                              ))}
                            </div>
                          </FormControl>
                          <FormMessage className="mt-3 text-center text-[13px] text-[#ff8ab8] lg:text-left" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </motion.section>

              <motion.section
                className="w-full"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.13, duration: 0.55, ease: "easeOut" }}
              >
                <div className={cn(glassCardClass, "px-5 py-7 sm:px-9 sm:py-9")}>
                  <FormField
                    control={form.control}
                    name="onMedication"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <p className="mb-5 text-center text-[clamp(1rem,2vw,1.12rem)] font-medium text-white/90 sm:text-left">
                          Are you currently taking any medication?
                        </p>
                        <FormControl>
                          <div className="flex flex-col gap-3 sm:flex-row sm:gap-3">
                            {medicationOptions.map((option) => (
                              <TherapyOptionButton
                                key={option.value}
                                option={option}
                                isSelected={field.value === option.value}
                                onSelect={() => field.onChange(option.value)}
                              />
                            ))}
                          </div>
                        </FormControl>
                        <FormMessage className="mt-3 text-center text-[13px] text-[#ff8ab8] sm:text-left" />
                      </FormItem>
                    )}
                  />
                </div>
              </motion.section>

              <motion.section
                className="w-full"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16, duration: 0.55, ease: "easeOut" }}
              >
                <motion.div className={cn(glassCardClass, "px-5 py-7 sm:px-9 sm:py-9")}>
                  <FormField
                    control={form.control}
                    name="selectedTriggers"
                    render={({ field }) => (
                      <FormItem>
                        <motion.div className="mb-6 flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:gap-4 sm:text-left">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#FF4E91]/35 bg-[#0A0B1E]/85 shadow-[0_0_28px_-4px_rgba(255,78,145,0.55)] backdrop-blur-md">
                            <Flower2
                              className="h-5 w-5 text-[#FF4E91] drop-shadow-[0_0_10px_rgba(255,78,145,0.45)]"
                              aria-hidden
                            />
                          </div>
                          <div>
                            <p className="text-[clamp(1rem,2vw,1.12rem)] font-medium text-white/90">
                              What tends to feel hard for you sometimes?
                            </p>
                            <p className="mt-1 text-[13px] text-violet-200/55">
                              Select what applies so we can tailor support for you (optional)
                            </p>
                          </div>
                        </motion.div>
                        <FormControl>
                          <motion.div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {triggers.map((trigger) => {
                              const selected = (field.value || []).includes(trigger.value);
                              return (
                                <ChallengeChip
                                  key={trigger.value}
                                  trigger={trigger}
                                  isSelected={selected}
                                  onToggle={() => {
                                    const current = field.value || [];
                                    field.onChange(
                                      selected
                                        ? current.filter((t: string) => t !== trigger.value)
                                        : [...current, trigger.value],
                                    );
                                  }}
                                />
                              );
                            })}
                          </motion.div>
                        </FormControl>
                        <FormMessage className="mt-3 text-center text-[13px] text-[#ff8ab8]" />
                      </FormItem>
                    )}
                  />
                </motion.div>
              </motion.section>

              <motion.div
                className="grid w-full max-w-[min(640px,100%)] grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.5 }}
              >
                <motion.button
                  type="button"
                  onClick={() => goBack("/onboarding/wellness-baseline")}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  className={cn(
                    "flex h-[58px] w-full items-center justify-center gap-2 rounded-[18px] border border-white/10",
                    "bg-[#0b0c20]/55 px-6 text-[15px] font-medium text-white/88 backdrop-blur-md",
                    "transition-[border-color,box-shadow] duration-200",
                    "hover:border-violet-400/30 hover:bg-[#12132e]/65",
                  )}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </motion.button>

                <motion.button
                  type="submit"
                  disabled={isLoading}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  className={cn(
                    "flex h-[58px] w-full items-center justify-center gap-2 rounded-[18px] px-6",
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
            className="mt-8 flex max-w-[min(520px,92vw)] flex-col items-center gap-2 text-center sm:mt-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.32, duration: 0.5 }}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#FF4E91]/30 bg-[#FF4E91]/10 shadow-[0_0_14px_-4px_rgba(255,78,145,0.45)]">
                <Shield className="h-3.5 w-3.5 text-[#FF4E91]/80" aria-hidden />
              </span>
              <p className="text-[13px] font-medium text-violet-100/58">
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
