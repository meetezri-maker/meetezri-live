import { Link, useNavigate } from "react-router-dom";
import { useMemo, type ReactNode } from "react";
import { motion } from "motion/react";
import { DEFAULT_AI_COMPANIONS } from "@meetezri/shared";
import {
  ArrowRight,
  ArrowLeft,
  Volume2,
  Heart,
  Check,
  Lightbulb,
  Mic,
  Users,
  Flower2,
  Mountain,
  Circle,
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
  FormMessage,
} from "../../components/ui/form";
import {
  companionCardImageUrl,
  companionRoundPortraitImgClass,
} from "@/lib/avatar/companionModelUrl";
import { ONBOARDING_COMPANION_SELECTION_BG } from "@/lib/solace/referenceImagery";
import { TALK_IT_OUT_ENVIRONMENT_THUMBS } from "@/lib/solace/talkItOutImages";
import {
  DEFAULT_SELECTABLE_COMPANION_NAME,
  isCompanionComingSoon,
  isSessionEnvironmentComingSoon,
  resolveCompanionForProfileSave,
} from "@/lib/avatar/companionAvailability";
import { ComingSoonOverlay } from "@/components/ui/ComingSoonOverlay";
import { cn } from "@/lib/utils";
import { BRAND_LOGO_ON_DARK_BG } from "@/app/components/BrandLogo";

const SOLACE_LOGO_SRC = BRAND_LOGO_ON_DARK_BG;
const ONBOARDING_NAV_H = "4.75rem";
const CURRENT_STEP = 5;
const TOTAL_STEPS = 8;
const PROGRESS_PERCENT = (CURRENT_STEP / TOTAL_STEPS) * 100;

const glassSectionClass = cn(
  "relative w-full rounded-[28px] border border-[#FF4E91]/20 bg-[#0A0B1E]/48 backdrop-blur-2xl",
  "shadow-[0_0_0_1px_rgba(138,79,255,0.1),0_28px_72px_-32px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)]",
);

/** Older onboarding stored short ids (e.g. `maya`); profile uses canonical display names. */
function normalizeOnboardingAvatarName(raw: string | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  const legacy: Record<string, string> = {
    maya: "Maya Chen",
    alex: "Alex",
    jordan: "Jordan Taylor",
    sarah: "Sara Mitchell",
  };
  return legacy[t.toLowerCase()] ?? t;
}

interface AIAvatar {
  id: string;
  name: string;
  gender: string;
  ageRange: string;
  personality: string;
  specialty: string[];
  description: string;
  imageUrl?: string;
  voiceType: string;
  accentType: string;
}

const avatarPreferencesSchema = z.object({
  selectedAvatar: z.string().min(1, "Please select an AI companion"),
  selectedEnvironment: z.string().optional(),
});

type AvatarPreferencesValues = z.infer<typeof avatarPreferencesSchema>;

function CompanionSelectionSceneBackdrop() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.1, ease: "easeOut" }}
    >
      <img
        src={ONBOARDING_COMPANION_SELECTION_BG}
        alt=""
        className="absolute inset-0 h-full w-full scale-105 object-cover object-center"
        width={2400}
        height={1350}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_12%_55%,rgba(255,78,145,0.14)_0%,transparent_55%)]"
        animate={{ opacity: [0.45, 0.7, 0.45] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_38%,rgba(138,79,255,0.14)_0%,transparent_58%)]"
        animate={{ opacity: [0.4, 0.65, 0.4] }}
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
      <motion.div className="absolute inset-0 bg-[#070815]/50" />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_42%,rgba(10,11,30,0.2)_0%,rgba(7,8,21,0.78)_100%)]"
        animate={{ opacity: [0.75, 0.9, 0.75] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_50%,transparent_22%,rgba(0,0,0,0.62)_100%)]"
        animate={{ opacity: [0.9, 1, 0.9] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
}

interface CompanionSelectionTopBarProps {
  progressPercent: number;
  onBack: () => void;
}

function CompanionSelectionTopBar({ progressPercent, onBack }: CompanionSelectionTopBarProps) {
  return (
    <header
      className={cn(
        "relative z-50 shrink-0 border-b border-white/[0.08] bg-[#070815]/72 backdrop-blur-2xl",
        "shadow-[inset_0_-1px_0_rgba(255,79,216,0.12)] supports-[backdrop-filter]:bg-[#070815]/50",
      )}
      style={{ height: ONBOARDING_NAV_H }}
    >
      <motion.div
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#FF4FD8]/30 to-transparent"
        animate={{ opacity: [0.4, 0.75, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      <motion.div
        className="mx-auto flex h-full max-w-[1180px] flex-col justify-center gap-3 px-4 py-3 sm:px-6 lg:px-8 md:hidden"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <motion.div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
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
          </div>
          <p className="shrink-0 text-xs text-violet-200/65">
            Step {CURRENT_STEP} of {TOTAL_STEPS}
          </p>
        </motion.div>
        <motion.div className="h-[6px] overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/[0.04] backdrop-blur-sm">
          <motion.div
            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[#FF4FD8] via-[#B14DFF] to-[#69E7FF] shadow-[0_0_16px_-2px_rgba(255,79,216,0.55)]"
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
        className="mx-auto hidden h-full max-w-[1180px] items-center gap-4 px-6 lg:px-8 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto]"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <motion.div className="flex items-center gap-2.5">
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
        </motion.div>

        <motion.div className="px-2">
          <motion.div className="h-[6px] overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/[0.04] backdrop-blur-sm">
            <motion.div
              className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[#FF4FD8] via-[#B14DFF] to-[#69E7FF] shadow-[0_0_16px_-2px_rgba(255,79,216,0.55)]"
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

interface CompanionCardProps {
  avatar: AIAvatar;
  isSelected: boolean;
  onSelect: () => void;
  delay?: number;
}

function CompanionCard({ avatar, isSelected, onSelect, delay = 0 }: CompanionCardProps) {
  const comingSoon = isCompanionComingSoon(avatar.name);
  return (
    <motion.button
      type="button"
      disabled={comingSoon}
      onClick={() => {
        if (!comingSoon) onSelect();
      }}
      aria-pressed={isSelected}
      aria-disabled={comingSoon}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: "easeOut" }}
      whileHover={comingSoon ? undefined : { y: -3 }}
      whileTap={comingSoon ? undefined : { scale: 0.995 }}
      className={cn(
        "group relative w-full overflow-hidden rounded-[24px] border p-6 text-left backdrop-blur-xl",
        "transition-[border-color,box-shadow,background-color,transform] duration-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4FD8]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070816]",
        comingSoon
          ? "cursor-not-allowed border-white/[0.08] bg-[#0A0B1E]/55 opacity-90"
          : isSelected
          ? "border-[#FF4FD8]/55 bg-[linear-gradient(155deg,rgba(177,77,255,0.16)_0%,rgba(255,79,216,0.1)_42%,rgba(10,11,30,0.78)_100%)] shadow-[0_0_56px_-10px_rgba(255,79,216,0.55),0_0_0_1px_rgba(255,79,216,0.2),inset_0_1px_0_rgba(255,255,255,0.08)]"
          : "border-[#8A4FFF]/22 bg-[linear-gradient(160deg,rgba(138,79,255,0.06)_0%,rgba(10,11,30,0.62)_100%)] hover:border-[#B14DFF]/38 hover:bg-[#12132e]/68 hover:shadow-[0_0_40px_-14px_rgba(177,77,255,0.4)]",
      )}
    >
      {comingSoon ? <ComingSoonOverlay className="rounded-[24px]" /> : null}
      {isSelected ? (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#FF4FD8] to-[#B14DFF] text-white shadow-[0_0_18px_-2px_rgba(255,79,216,0.65)]"
          aria-hidden
        >
          <Check className="h-4 w-4" strokeWidth={2.5} />
        </motion.span>
      ) : (
        <span
          className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/25"
          aria-hidden
        >
          <Circle className="h-4 w-4" strokeWidth={1.5} />
        </span>
      )}

      <motion.div
        className="pointer-events-none absolute inset-0 rounded-[24px]"
        animate={isSelected ? { opacity: [0.3, 0.5, 0.3] } : { opacity: 0 }}
        style={{
          background:
            "radial-gradient(ellipse 85% 65% at 18% 12%, rgba(255,79,216,0.14) 0%, transparent 62%)",
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      <motion.div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
        <motion.div
          className="relative mx-auto shrink-0 sm:mx-0"
          animate={isSelected ? { scale: [1, 1.02, 1] } : undefined}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <div
            className={cn(
              "absolute -inset-2 rounded-full blur-lg transition-opacity duration-300",
              isSelected ? "bg-[#FF4FD8]/40 opacity-100" : "bg-[#B14DFF]/25 opacity-70",
            )}
            aria-hidden
          />
          {avatar.imageUrl ? (
            <img
              src={avatar.imageUrl}
              alt=""
              className={cn(
                "relative h-[clamp(110px,28vw,128px)] w-[clamp(110px,28vw,128px)] rounded-full ring-2 ring-white/[0.12]",
                companionRoundPortraitImgClass,
              )}
              width={128}
              height={128}
            />
          ) : (
            <motion.div className="relative flex h-[clamp(110px,28vw,128px)] w-[clamp(110px,28vw,128px)] items-center justify-center rounded-full bg-[#12132e]/80 ring-2 ring-white/[0.12]">
              <Users className="h-12 w-12 text-violet-200/45" aria-hidden />
            </motion.div>
          )}
        </motion.div>

        <motion.div className="min-w-0 flex-1 text-center sm:text-left sm:pt-1">
          <h3 className="text-[18px] font-semibold tracking-tight text-white/96">{avatar.name}</h3>
          <p className="mt-0.5 text-[13px] text-violet-200/58">
            {avatar.gender} • {avatar.ageRange} years
          </p>
        </motion.div>
      </motion.div>

      <motion.div className="relative mt-5 space-y-4">
        <motion.div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-200/55">
            <Heart className="h-3 w-3 text-[#FF4FD8]/80" aria-hidden />
            Personality
          </p>
          <p className="text-[14px] leading-relaxed text-violet-100/80">{avatar.personality}</p>
        </motion.div>

        <motion.div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-200/55">
            Specializes In
          </p>
          <motion.div className="flex flex-wrap gap-2">
          {avatar.specialty.map((spec) => (
            <span
              key={spec}
              className="inline-flex rounded-full border border-[#8A4FFF]/35 bg-[#8A4FFF]/14 px-3 py-1 text-[11px] font-medium text-violet-100/90 shadow-[0_0_14px_-8px_rgba(138,79,255,0.5)]"
            >
              {spec}
            </span>
          ))}
          </motion.div>
        </motion.div>

        <p className="text-[13px] leading-relaxed text-violet-200/65">{avatar.description}</p>

        <motion.div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/[0.06] pt-4 text-[12px] text-violet-200/55">
          <span className="inline-flex items-center gap-1.5">
            <Volume2 className="h-3.5 w-3.5 text-[#FF4FD8]/75" aria-hidden />
            {avatar.voiceType}
          </span>
          <span className="text-violet-400/40" aria-hidden>
            •
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Mic className="h-3.5 w-3.5 text-[#69E7FF]/70" aria-hidden />
            {avatar.accentType}
          </span>
        </motion.div>
      </motion.div>
    </motion.button>
  );
}

interface SessionBackgroundThumbProps {
  value: string;
  label: string;
  image: string;
  isSelected: boolean;
  onSelect: () => void;
}

function SessionBackgroundThumb({
  value,
  label,
  image,
  isSelected,
  onSelect,
}: SessionBackgroundThumbProps) {
  const comingSoon = isSessionEnvironmentComingSoon(value);
  return (
    <motion.button
      type="button"
      disabled={comingSoon}
      onClick={() => {
        if (!comingSoon) onSelect();
      }}
      aria-disabled={comingSoon}
      whileHover={comingSoon ? undefined : { y: -2 }}
      whileTap={comingSoon ? undefined : { scale: 0.99 }}
      className={cn(
        "group relative shrink-0 overflow-hidden rounded-xl border text-left transition-[border-color,box-shadow] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4FD8]/40",
        "w-[min(148px,42vw)] rounded-2xl sm:w-[min(168px,18vw)]",
        comingSoon
          ? "cursor-not-allowed border-white/[0.06] opacity-90"
          : isSelected
          ? "border-[#FF4FD8]/55 shadow-[0_0_28px_-6px_rgba(255,79,216,0.55)]"
          : "border-white/[0.08] hover:border-[#B14DFF]/35 hover:shadow-[0_0_20px_-8px_rgba(177,77,255,0.4)]",
      )}
    >
      {comingSoon ? <ComingSoonOverlay className="rounded-2xl" /> : null}
      <span className="relative block aspect-[4/3] overflow-hidden">
        <img
          src={image}
          alt=""
          className="h-full w-full object-cover brightness-[0.92] saturate-[1.08] transition-[transform,filter] duration-500 group-hover:scale-[1.03] group-hover:brightness-100"
        />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070816]/85 via-[#070816]/20 to-transparent" />
        {isSelected && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#FF4FD8] to-[#B14DFF] text-white shadow-[0_0_14px_-2px_rgba(255,79,216,0.65)]"
            aria-hidden
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          </motion.span>
        )}
      </span>
      <span className="block px-2.5 py-2 text-center text-[11px] font-medium text-violet-100/82">
        {label}
      </span>
    </motion.button>
  );
}

interface SectionHeadingProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
}

function SectionHeading({ icon, title, subtitle }: SectionHeadingProps) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#FF4FD8]/25 bg-[#FF4FD8]/10 shadow-[0_0_18px_-6px_rgba(255,79,216,0.4)]">
        {icon}
      </span>
      <div>
        <h2 className="text-[17px] font-semibold tracking-tight text-white/92">{title}</h2>
        <p className="mt-0.5 text-[13px] leading-relaxed text-violet-200/58">{subtitle}</p>
      </div>
    </div>
  );
}

export function OnboardingAvatarPreferences() {
  const navigate = useNavigate();
  const { data, updateData } = useOnboarding();

  const form = useForm<AvatarPreferencesValues>({
    resolver: zodResolver(avatarPreferencesSchema),
    defaultValues: {
      selectedAvatar: normalizeOnboardingAvatarName(data.selectedAvatar),
      selectedEnvironment: data.selectedEnvironment || "",
    },
  });

  const aiAvatars: AIAvatar[] = useMemo(
    () =>
      DEFAULT_AI_COMPANIONS.map((c) => ({
        id: c.id,
        name: c.name,
        gender: c.gender,
        ageRange: c.age_range,
        personality: c.personality,
        specialty: [...c.specialties],
        description: c.description,
        imageUrl: companionCardImageUrl(c.portraitPng),
        voiceType: c.voice_type,
        accentType: c.accent_type,
      })),
    [],
  );

  const selectedAvatar = form.watch("selectedAvatar");

  const onSubmit = (values: AvatarPreferencesValues) => {
    const selectedAvatar = resolveCompanionForProfileSave(
      values.selectedAvatar,
      normalizeOnboardingAvatarName(data.selectedAvatar) ||
        DEFAULT_SELECTABLE_COMPANION_NAME,
    );
    updateData({
      ...values,
      selectedAvatar,
      selectedEnvironment: values.selectedEnvironment || "",
    });
    navigate("/onboarding/safety-consent");
  };

  const handleTopBack = () => navigate("/onboarding/health-background");

  return (
    <motion.div
      className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#070816] text-[#FDFDFD]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <CompanionSelectionSceneBackdrop />
      <CompanionSelectionTopBar progressPercent={PROGRESS_PERCENT} onBack={handleTopBack} />

      <main className="relative z-10 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <motion.div
          className="mx-auto flex w-full max-w-[1180px] flex-col px-4 py-6 pb-28 sm:px-8 sm:py-8 md:pb-12"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <header className="mb-7 text-center sm:mb-8">
            <h1 className="solace-login-serif text-[clamp(2.625rem,5vw,3.875rem)] font-medium leading-[1.06] drop-shadow-[0_0_32px_rgba(255,79,216,0.15),0_2px_28px_rgba(0,0,0,0.45)]">
              <span className="block text-[#FDFDFD]">Choose Your</span>
              <span className="mt-1 block bg-gradient-to-r from-[#FF4FD8] via-[#E879F9] to-[#B14DFF] bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(255,79,216,0.35)]">
                Solace Companion
              </span>
            </h1>
            <p className="mx-auto mt-3 max-w-[min(640px,92vw)] text-[clamp(1rem,1.9vw,1.25rem)] leading-relaxed text-violet-200/68">
              Select the Solace companion who will support your wellness journey
            </p>
          </header>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6 sm:gap-7">
              <motion.section
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06, duration: 0.5 }}
              >
                <SectionHeading
                  icon={<Flower2 className="h-4 w-4 text-[#FF4FD8]" aria-hidden />}
                  title="Your Solace Avatar"
                  subtitle="Choose the avatar that feels right for you. You can change this later in settings."
                />

                <FormField
                  control={form.control}
                  name="selectedAvatar"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2">
                          {aiAvatars.map((avatar, index) => (
                            <CompanionCard
                              key={avatar.name}
                              avatar={avatar}
                              isSelected={field.value === avatar.name}
                              onSelect={() => field.onChange(avatar.name)}
                              delay={0.12 + index * 0.05}
                            />
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage className="mt-3 text-center text-[13px] text-[#ff8ab8]" />
                    </FormItem>
                  )}
                />
              </motion.section>

              <motion.section
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16, duration: 0.5 }}
                className={cn(glassSectionClass, "rounded-[26px] px-5 py-6 sm:px-8 sm:py-8")}
              >
                <SectionHeading
                  icon={<Mountain className="h-4 w-4 text-[#FF4FD8]" aria-hidden />}
                  title="Talking Environment"
                  subtitle="Choose a calming background for your talk sessions"
                />

                <FormField
                  control={form.control}
                  name="selectedEnvironment"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <motion.div
                          className="-mx-1 flex gap-3 overflow-x-auto pb-1 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:grid-cols-4 md:gap-3 md:overflow-visible"
                          initial="hidden"
                          animate="visible"
                          variants={{
                            hidden: {},
                            visible: { transition: { staggerChildren: 0.04 } },
                          }}
                        >
                          {TALK_IT_OUT_ENVIRONMENT_THUMBS.map((env) => (
                            <SessionBackgroundThumb
                              key={env.value}
                              value={env.value}
                              label={env.label}
                              image={env.image}
                              isSelected={
                                !isSessionEnvironmentComingSoon(env.value) &&
                                field.value === env.value
                              }
                              onSelect={() => field.onChange(env.value)}
                            />
                          ))}
                        </motion.div>
                      </FormControl>
                      <FormMessage className="mt-3 text-center text-[13px] text-[#ff8ab8]" />
                    </FormItem>
                  )}
                />
              </motion.section>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.45 }}
                className="flex items-center gap-3 rounded-2xl border border-amber-200/12 bg-[#0A0B1E]/45 px-4 py-3.5 backdrop-blur-xl shadow-[0_0_24px_-12px_rgba(251,191,36,0.25),inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-200/20 bg-amber-200/10 shadow-[0_0_14px_-4px_rgba(251,191,36,0.35)]">
                  <Lightbulb className="h-4 w-4 text-amber-200/90" aria-hidden />
                </span>
                <p className="text-[13px] leading-relaxed text-violet-100/72">
                  <span className="font-medium text-violet-100/88">Tip:</span> You can change your
                  Solace avatar and talk preferences anytime in your settings.
                </p>
              </motion.div>

              <motion.div
                className="sticky bottom-0 z-20 -mx-4 border-t border-white/[0.06] bg-[#070816]/88 px-4 py-4 backdrop-blur-xl sm:-mx-8 sm:px-8 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.5 }}
              >
                <div className="mx-auto grid w-full max-w-[min(640px,100%)] grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:max-w-none">
                  <Link to="/onboarding/health-background" className="w-full">
                    <motion.button
                      type="button"
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
                  </Link>

                  <motion.button
                    type="submit"
                    disabled={!selectedAvatar || isCompanionComingSoon(selectedAvatar)}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    className={cn(
                      "flex h-[58px] w-full items-center justify-center gap-2 rounded-[18px] px-6",
                      "bg-gradient-to-r from-[#FF4FD8] via-[#B14DFF] to-[#8A4FFF] text-[15px] font-semibold text-white",
                      "shadow-[0_0_40px_-8px_rgba(255,79,216,0.65)]",
                      "transition-[box-shadow,opacity] duration-300 hover:shadow-[0_0_52px_-6px_rgba(177,77,255,0.55)]",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </motion.button>
                </div>
              </motion.div>
            </form>
          </Form>
        </motion.div>
      </main>
    </motion.div>
  );
}
