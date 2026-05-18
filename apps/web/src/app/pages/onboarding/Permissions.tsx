import { type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowLeft,
  Video,
  Bell,
  Mic,
  Shield,
  Sparkles,
  Lock,
  AlertTriangle,
  Sun,
  Calendar,
  Leaf,
  BarChart3,
} from "lucide-react";
import { useOnboarding } from "@/app/contexts/OnboardingContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "../../components/ui/form";
import { cn } from "@/lib/utils";

/** Pure twilight lake / mountain environment plate — not a UI screenshot. */
const PERMISSIONS_BG = "/solace/permissions-notifications-twilight-lake.jpg";
const SOLACE_LOGO_SRC = "/logos/logo white.png";
const ONBOARDING_NAV_H = "4.5rem";
const CURRENT_STEP = 8;
const TOTAL_STEPS = 8;
const PROGRESS_PERCENT = (CURRENT_STEP / TOTAL_STEPS) * 100;

const permissionsSchema = z.object({
  permissions: z.object({
    camera: z.boolean(),
    microphone: z.boolean(),
    notifications: z.boolean(),
  }),
  notificationPreferences: z.object({
    dailyCheckIn: z.boolean(),
    sessionReminders: z.boolean(),
    wellnessTips: z.boolean(),
    weeklyProgress: z.boolean(),
  }),
});

type PermissionsValues = z.infer<typeof permissionsSchema>;

const privacyCardClass = cn(
  "relative w-full rounded-[26px] border border-cyan-400/28 bg-[#0A0B1E]/50 backdrop-blur-2xl",
  "shadow-[0_0_0_1px_rgba(56,189,248,0.1),0_28px_72px_-32px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)]",
  "transition-[border-color,box-shadow] duration-300 hover:border-cyan-400/40 hover:shadow-[0_0_40px_-16px_rgba(56,189,248,0.28)]",
);

const permissionCardClass = cn(
  "relative w-full rounded-[26px] border border-violet-400/22 bg-[#0A0B1E]/48 backdrop-blur-2xl",
  "shadow-[0_0_0_1px_rgba(138,79,255,0.1),0_28px_72px_-32px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)]",
  "transition-[border-color,box-shadow] duration-300 hover:border-[#FF4E91]/28 hover:shadow-[0_0_36px_-16px_rgba(255,78,145,0.3)]",
);

const pushCardClass = cn(
  "relative w-full rounded-[26px] border border-emerald-400/22 bg-[#0A0B1E]/48 backdrop-blur-2xl",
  "shadow-[0_0_0_1px_rgba(52,211,153,0.08),0_28px_72px_-32px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)]",
  "transition-[border-color,box-shadow] duration-300 hover:border-emerald-400/35 hover:shadow-[0_0_36px_-16px_rgba(52,211,153,0.22)]",
);

const preferencesCardClass = cn(
  "relative w-full rounded-[28px] border border-[#FF4E91]/22 bg-[#0A0B1E]/48 backdrop-blur-2xl",
  "shadow-[0_0_0_1px_rgba(138,79,255,0.1),0_28px_72px_-32px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)]",
  "transition-[border-color,box-shadow] duration-300 hover:border-[#FF4E91]/32 hover:shadow-[0_0_40px_-16px_rgba(255,78,145,0.35)]",
);

const warningCardClass = cn(
  "relative w-full rounded-[22px] border border-amber-400/28 bg-[#0A0B1E]/52 backdrop-blur-2xl",
  "shadow-[0_0_0_1px_rgba(251,191,36,0.1),0_24px_64px_-32px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]",
);

const permissionItems = [
  {
    key: "camera" as const,
    icon: Video,
    title: "Camera Access",
    description: "Required for video sessions with Ezri",
    required: true,
    cardClass: permissionCardClass,
    iconClass: "text-[#fda4cf]",
    ring: "from-[#FF4E91]/50 to-pink-900/20",
    glowClass: "shadow-[0_0_32px_-6px_rgba(255,78,145,0.5)] ring-1 ring-[#FF4E91]/30",
  },
  {
    key: "microphone" as const,
    icon: Mic,
    title: "Microphone Access",
    description: "Required for talking during sessions",
    required: true,
    cardClass: permissionCardClass,
    iconClass: "text-violet-300",
    ring: "from-violet-400/50 to-purple-900/25",
    glowClass: "shadow-[0_0_32px_-6px_rgba(138,79,255,0.45)] ring-1 ring-violet-400/28",
  },
  {
    key: "notifications" as const,
    icon: Bell,
    title: "Push Notifications",
    description: "Get reminders for check-ins and session schedules",
    required: false,
    cardClass: pushCardClass,
    iconClass: "text-emerald-300",
    ring: "from-emerald-400/50 to-emerald-900/20",
    glowClass: "shadow-[0_0_32px_-6px_rgba(52,211,153,0.4)] ring-1 ring-emerald-400/28",
  },
] as const;

const notificationPrefItems = [
  {
    key: "dailyCheckIn" as const,
    label: "Daily mood check-in reminders",
    icon: Sun,
    iconClass: "text-amber-200/90",
    ring: "from-amber-300/50 to-amber-900/20",
    glowClass: "shadow-[0_0_20px_-6px_rgba(251,191,36,0.45)] ring-1 ring-amber-400/25",
  },
  {
    key: "sessionReminders" as const,
    label: "Scheduled session reminders",
    icon: Calendar,
    iconClass: "text-yellow-200/90",
    ring: "from-yellow-300/50 to-yellow-900/20",
    glowClass: "shadow-[0_0_20px_-6px_rgba(234,179,8,0.4)] ring-1 ring-yellow-400/25",
  },
  {
    key: "wellnessTips" as const,
    label: "Wellness tips and insights",
    icon: Leaf,
    iconClass: "text-emerald-300",
    ring: "from-emerald-400/50 to-emerald-900/20",
    glowClass: "shadow-[0_0_20px_-6px_rgba(52,211,153,0.4)] ring-1 ring-emerald-400/25",
  },
  {
    key: "weeklyProgress" as const,
    label: "Weekly progress summaries",
    icon: BarChart3,
    iconClass: "text-sky-300",
    ring: "from-sky-400/50 to-sky-900/20",
    glowClass: "shadow-[0_0_20px_-6px_rgba(56,189,248,0.4)] ring-1 ring-sky-400/25",
  },
] as const;

function PermissionsSceneBackdrop() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.1, ease: "easeOut" }}
    >
      <img
        src={PERMISSIONS_BG}
        alt=""
        className="absolute inset-0 h-full w-full scale-105 object-cover object-center"
        width={2400}
        height={1350}
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
        animate={{ opacity: [0.88, 1, 0.88] }}
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
      <motion.div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_50%,transparent_35%,rgba(0,0,0,0.55)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,18,0.35)_0%,rgba(5,6,18,0.15)_38%,rgba(5,6,18,0.55)_100%)]" />

      {[
        { left: "8%", top: "62%", delay: 0 },
        { left: "22%", top: "68%", delay: 0.8 },
        { left: "36%", top: "64%", delay: 1.5 },
        { left: "50%", top: "70%", delay: 0.4 },
        { left: "64%", top: "66%", delay: 1.1 },
        { left: "78%", top: "72%", delay: 1.9 },
        { left: "92%", top: "60%", delay: 2.2 },
        { left: "14%", top: "48%", delay: 1.3 },
        { left: "86%", top: "44%", delay: 0.6 },
        { left: "42%", top: "36%", delay: 1.7 },
        { left: "58%", top: "32%", delay: 0.9 },
        { left: "28%", top: "54%", delay: 2.4 },
      ].map((particle, index) => (
        <motion.span
          key={index}
          className="absolute h-1 w-1 rounded-full bg-[#ffb86b]/85 shadow-[0_0_10px_rgba(255,184,107,0.65)]"
          style={{ left: particle.left, top: particle.top }}
          animate={{ opacity: [0.15, 0.8, 0.15], y: [0, -7, 0] }}
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

interface PermissionsTopBarProps {
  progressPercent: number;
  onBack: () => void;
}

function PermissionsTopBar({ progressPercent, onBack }: PermissionsTopBarProps) {
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
            <span className="text-sm font-medium tracking-wide text-white/90">Ezri</span>
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
          <span className="text-[15px] font-medium tracking-wide text-white/92">Ezri</span>
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

interface CinematicToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  "aria-label"?: string;
}

function CinematicToggle({ checked, onChange, id, "aria-label": ariaLabel }: CinematicToggleProps) {
  return (
    <FormControl>
      <motion.button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-8 w-14 shrink-0 rounded-full transition-[background-color,box-shadow] duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4E91]/45",
          checked
            ? "bg-gradient-to-r from-[#FF4E91] via-[#d946ef] to-[#8A4FFF] shadow-[0_0_20px_-4px_rgba(255,78,145,0.65)]"
            : "bg-[#1a1535]/90 ring-1 ring-violet-500/20",
        )}
      >
        <motion.div
          animate={{ x: checked ? 26 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={cn(
            "absolute top-1 h-6 w-6 rounded-full",
            checked
              ? "bg-white shadow-[0_0_12px_rgba(255,255,255,0.85)]"
              : "bg-violet-300/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
          )}
        />
      </motion.button>
    </FormControl>
  );
}

export function OnboardingPermissions() {
  const navigate = useNavigate();
  const { data, updateData } = useOnboarding();

  const form = useForm<PermissionsValues>({
    resolver: zodResolver(permissionsSchema),
    defaultValues: {
      permissions: {
        camera: data.permissions?.camera || false,
        microphone: data.permissions?.microphone || false,
        notifications: data.permissions?.notifications || false,
      },
      notificationPreferences: {
        dailyCheckIn: data.notificationPreferences?.dailyCheckIn ?? true,
        sessionReminders: data.notificationPreferences?.sessionReminders ?? true,
        wellnessTips: data.notificationPreferences?.wellnessTips ?? true,
        weeklyProgress: data.notificationPreferences?.weeklyProgress ?? false,
      },
    },
  });

  const onSubmit = (values: PermissionsValues) => {
    updateData({
      permissions: values.permissions,
      notificationPreferences: values.notificationPreferences,
    });
    navigate("/onboarding/complete");
  };

  const permissions = form.watch("permissions");

  const handleTopBack = () => navigate("/onboarding/emergency-contact");

  return (
    <motion.div
      className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#070815] text-[#FDFDFD]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <PermissionsSceneBackdrop />
      <PermissionsTopBar progressPercent={PROGRESS_PERCENT} onBack={handleTopBack} />

      <main className="relative z-10 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <motion.div
          className="mx-auto flex w-full max-w-[1160px] flex-col items-center px-4 py-6 pb-12 sm:px-6 sm:py-8 sm:pb-14 md:px-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* 1. Title section */}
          <header className="mb-6 text-center sm:mb-8">
            <h1 className="solace-login-serif inline-flex flex-wrap items-center justify-center gap-2 text-[clamp(2.625rem,5vw,3.625rem)] font-medium leading-[1.08] text-[#FDFDFD] drop-shadow-[0_0_32px_rgba(255,78,145,0.2),0_2px_28px_rgba(0,0,0,0.45)]">
              Permissions &amp; Notifications
              <Sparkles
                className="h-5 w-5 text-[#FF4E91] drop-shadow-[0_0_12px_rgba(255,78,145,0.55)] sm:h-6 sm:w-6"
                aria-hidden
              />
            </h1>
            <p className="mt-2 text-[clamp(1rem,1.9vw,1.25rem)] leading-relaxed text-violet-200/72">
              Enable features to get the most out of Ezri
            </p>
          </header>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex w-full flex-col gap-5 sm:gap-6"
            >
              {/* 2. Two-column primary content */}
              <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6 xl:gap-7">
                {/* LEFT: Privacy + permission cards */}
                <div className="flex flex-col gap-4 sm:gap-5">
                  {/* Privacy protection card */}
                  <motion.section
                    className={cn(privacyCardClass, "p-7 sm:p-8")}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06, duration: 0.5 }}
                  >
                    <motion.div
                      className="absolute inset-0 rounded-[26px] bg-[radial-gradient(ellipse_70%_50%_at_12%_50%,rgba(56,189,248,0.1)_0%,transparent_55%)]"
                      aria-hidden
                    />
                    <motion.div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-6">
                      <GlowingOrb
                        size="md"
                        glowClass="shadow-[0_0_40px_-8px_rgba(56,189,248,0.5)] ring-1 ring-cyan-400/30"
                      >
                        <Shield
                          className="h-6 w-6 text-cyan-300 drop-shadow-[0_0_12px_rgba(56,189,248,0.55)]"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                      </GlowingOrb>
                      <div className="min-w-0 text-center sm:text-left">
                        <h2 className="text-[17px] font-semibold text-white/94 sm:text-lg">
                          Your Privacy is Protected
                        </h2>
                        <p className="mt-2 text-[14px] leading-relaxed text-violet-100/72 sm:text-[15px]">
                          We only access your camera and microphone during active sessions. You can
                          change these permissions anytime in settings.
                        </p>
                      </div>
                    </motion.div>
                  </motion.section>

                  {/* Permission access cards */}
                  {permissionItems.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <FormField
                        key={item.key}
                        control={form.control}
                        name={`permissions.${item.key}`}
                        render={({ field }) => (
                          <motion.section
                            className={cn(item.cardClass, "p-7 sm:p-8")}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 + index * 0.06, duration: 0.45 }}
                          >
                            <div className="relative flex items-center gap-4 sm:gap-5">
                              <GlowingOrb size="sm" glowClass={item.glowClass}>
                                <Icon
                                  className={cn("h-5 w-5", item.iconClass)}
                                  strokeWidth={1.75}
                                  aria-hidden
                                />
                              </GlowingOrb>

                              <motion.div className="min-w-0 flex-1">
                                <motion.div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-[15px] font-semibold text-white/94 sm:text-[16px]">
                                    {item.title}
                                  </h3>
                                  {item.required && (
                                    <span className="rounded-full bg-[#FF4E91]/18 px-2 py-0.5 text-[11px] font-medium text-[#fda4cf] ring-1 ring-[#FF4E91]/28">
                                      Required
                                    </span>
                                  )}
                                </motion.div>
                                <p className="mt-1 text-[13px] leading-relaxed text-violet-100/65 sm:text-[14px]">
                                  {item.description}
                                </p>
                              </motion.div>

                              <CinematicToggle
                                checked={field.value}
                                onChange={field.onChange}
                                aria-label={`Toggle ${item.title}`}
                              />
                            </div>
                          </motion.section>
                        )}
                      />
                    );
                  })}
                </div>

                {/* RIGHT: Notification preferences card */}
                <motion.section
                  className={cn(preferencesCardClass, "flex flex-col p-8 sm:p-9 md:p-10 lg:h-full")}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12, duration: 0.5 }}
                >
                  <motion.div
                    className="absolute inset-0 rounded-[28px] bg-[radial-gradient(ellipse_70%_50%_at_18%_18%,rgba(255,78,145,0.1)_0%,transparent_55%)]"
                    aria-hidden
                  />
                  <div className="relative mb-6 flex items-start gap-4">
                    <GlowingOrb
                      size="sm"
                      glowClass="shadow-[0_0_32px_-6px_rgba(255,78,145,0.5)] ring-1 ring-[#FF4E91]/28"
                    >
                      <Bell
                        className="h-5 w-5 text-[#fda4cf]"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    </GlowingOrb>
                    <div className="min-w-0">
                      <h2 className="text-[17px] font-semibold text-white/94 sm:text-lg">
                        Notification Preferences
                      </h2>
                      <p className="mt-1 text-[13px] text-violet-100/65 sm:text-[14px]">
                        Choose what you&apos;d like to be notified about
                      </p>
                    </div>
                  </div>

                  <motion.div className="relative flex flex-1 flex-col gap-0">
                    {notificationPrefItems.map((pref, index) => {
                      const Icon = pref.icon;
                      return (
                        <FormField
                          key={pref.key}
                          control={form.control}
                          name={`notificationPreferences.${pref.key}`}
                          render={({ field }) => (
                            <motion.div
                              className={cn(
                                "flex items-center gap-3 rounded-[14px] px-2 py-3.5 transition-colors sm:gap-4 sm:px-3 sm:py-4",
                                "hover:bg-white/[0.03]",
                                index < notificationPrefItems.length - 1 &&
                                  "border-b border-white/[0.06]",
                              )}
                            >
                              <motion.div
                                className={cn(
                                  "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#0A0B1E]/70 backdrop-blur-md",
                                  pref.glowClass,
                                )}
                              >
                                <motion.div
                                  className={cn(
                                    "pointer-events-none absolute inset-0.5 rounded-full bg-gradient-to-br opacity-50 blur-[1px]",
                                    pref.ring,
                                  )}
                                />
                                <Icon
                                  className={cn("relative z-[1] h-4 w-4", pref.iconClass)}
                                  strokeWidth={1.75}
                                  aria-hidden
                                />
                              </motion.div>

                              <span className="min-w-0 flex-1 text-[13px] font-medium text-white/88 sm:text-[14px]">
                                {pref.label}
                              </span>

                              <CinematicToggle
                                checked={field.value}
                                onChange={field.onChange}
                                aria-label={`Toggle ${pref.label}`}
                              />
                            </motion.div>
                          )}
                        />
                      );
                    })}
                  </motion.div>
                </motion.section>
              </div>

              {/* 3. Required access warning card */}
              {(!permissions.camera || !permissions.microphone) && (
                <motion.section
                  className={cn(
                    warningCardClass,
                    "mx-auto w-full max-w-[min(100%,820px)] p-6 sm:p-7",
                  )}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.45 }}
                >
                  <motion.div
                    className="absolute inset-0 rounded-[22px] bg-[radial-gradient(ellipse_70%_50%_at_12%_50%,rgba(251,191,36,0.08)_0%,transparent_55%)]"
                    aria-hidden
                  />
                  <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-5">
                    <GlowingOrb
                      size="sm"
                      glowClass="shadow-[0_0_28px_-6px_rgba(251,191,36,0.45)] ring-1 ring-amber-400/28"
                    >
                      <AlertTriangle
                        className="h-5 w-5 text-amber-200/90"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    </GlowingOrb>
                    <div className="min-w-0 text-center sm:text-left">
                      <p className="text-[14px] font-medium leading-relaxed text-white/90 sm:text-[15px]">
                        Camera and microphone access are required for video sessions.
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-violet-100/62 sm:text-[14px]">
                        You can enable them now or when you start your first session.
                      </p>
                    </div>
                  </div>
                </motion.section>
              )}

              {/* 4. Back / Finish Setup button row */}
              <motion.div
                className="mx-auto grid w-full max-w-[min(100%,820px)] grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.45 }}
              >
                <Link to="/onboarding/emergency-contact" className="w-full">
                  <motion.button
                    type="button"
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
                </Link>

                <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }}>
                  <motion.button
                    type="submit"
                    className={cn(
                      "flex h-[58px] w-full items-center justify-center gap-2 rounded-[18px] px-6",
                      "bg-gradient-to-r from-[#FF4E91] via-[#d946ef] to-[#8A4FFF] text-[15px] font-semibold text-white",
                      "shadow-[0_0_40px_-8px_rgba(255,78,145,0.65)]",
                      "transition-[box-shadow,opacity] duration-300",
                      "hover:shadow-[0_0_52px_-6px_rgba(138,79,255,0.55)]",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4E91]/50",
                    )}
                  >
                    Finish Setup
                    <ArrowRight className="h-4 w-4" />
                  </motion.button>
                </motion.div>
              </motion.div>
            </form>
          </Form>

          {/* 5. Control reassurance footer */}
          <motion.footer
            className="mt-4 flex flex-col items-center gap-2 text-center sm:mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.28, duration: 0.5 }}
          >
            <motion.div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#FF4E91]/30 bg-[#FF4E91]/10 shadow-[0_0_16px_-4px_rgba(255,78,145,0.45)]">
                <Lock
                  className="h-3.5 w-3.5 text-[#FF4E91]/85"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </span>
              <p className="text-[13px] text-violet-200/58">
                You&apos;re in control. You can update everything in settings anytime.
              </p>
            </motion.div>
          </motion.footer>
        </motion.div>
      </main>
    </motion.div>
  );
}
