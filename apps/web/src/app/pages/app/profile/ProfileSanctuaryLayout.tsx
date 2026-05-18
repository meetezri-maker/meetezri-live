import { motion } from "motion/react";
import { Link } from "react-router-dom";
import type { UseFormReturn } from "react-hook-form";
import {
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Edit,
  Camera,
  Bell,
  Lock,
  Shield,
  Heart,
  Volume2,
  Palette,
  LogOut,
  ChevronRight,
  AlertTriangle,
  Info,
  Activity,
  Target,
  Zap,
  Users,
  Loader2,
  Trophy,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Circle,
  Star,
  MessageCircle,
  FileText,
} from "lucide-react";
import { SolaceHeroEnvironment } from "@/app/solace";
import { Switch } from "@/app/components/ui/switch";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/app/components/ui/form";
import { PhoneInput } from "@/app/components/ui/phone-input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/app/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import Cropper, { type Area } from "react-easy-crop";
import {
  PROFILE_HERO_IMG,
  PROFILE_EMERGENCY_BG,
  formatSubscriptionPlanLabel,
  profileBodyMuted,
  profileBtnGhost,
  profileBtnPrimary,
  profileCard,
  profileCardHeader,
  profileCardSubtitle,
  profileCardTitle,
  profileEmergencyBg,
  profileEmergencyCard,
  profileEmergencyWarmthAmber,
  profileEmergencyWarmthViolet,
  profileHeroShell,
  profileHeroStatStrip,
  profileIconCircle,
  profileMilestoneChip,
  profilePageAtmosphere,
  profilePageGlowBottom,
  profilePageFogMid,
  profilePageGlowTop,
  profilePageNoise,
  profilePageVignette,
  profilePill,
  profileRightRailGlow,
  profileRow,
  profileSupportTile,
} from "./profileUi";

type CropArea = { x: number; y: number; width: number; height: number };

interface MilestoneItem {
  id: string;
  label: string;
  unlocked: boolean;
}

interface ProfileSanctuaryLayoutProps {
  form: UseFormReturn<any>;
  effectiveNeedsVerification: boolean;
  showTrialIncompleteBanner: boolean;
  profileCompletion: { percent: number; missingFields: { label: string; key: string }[]; isComplete: boolean };
  resending: boolean;
  handleResendVerification: () => void;
  scrollToProfileField: (key: string) => void;
  setIsEditing: (v: boolean) => void;
  profileImage: string | null;
  isUploading: boolean;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleOpenExistingAvatarEditor: () => void;
  joinedAt: string;
  planLabel: string;
  personalBio: string | null | undefined;
  userStats: { sessions: number; checkins: number; daysActive: number };
  communityAvatarPublic: boolean;
  handleCommunityAvatarToggle: (next: boolean) => void;
  preferencesData: { selected_avatar: string; selected_voice: string; selected_environment: string };
  milestones: MilestoneItem[];
  isLoggingOut: boolean;
  handleLogout: () => void;
  isEditing: boolean;
  isSaving: boolean;
  onSubmit: (data: any) => void;
  loadProfile: () => void;
  pronounsOptions: string[];
  timezoneOpen: boolean;
  setTimezoneOpen: (v: boolean) => void;
  availableTimezones: string[];
  formatTimezoneOptionLabel: (tz: string) => string;
  goalsOptions: { value: string; label: string; emoji: string }[];
  triggersOptions: { value: string; label: string }[];
  emergencyInfoOpen: boolean;
  setEmergencyInfoOpen: (v: boolean) => void;
  emergencyConsentChecked: boolean;
  setEmergencyConsentChecked: (v: boolean) => void;
  avatarEditorOpen: boolean;
  setAvatarEditorOpen: (v: boolean) => void;
  avatarEditorImageUrl: string | null;
  avatarCrop: { x: number; y: number };
  setAvatarCrop: (v: { x: number; y: number }) => void;
  avatarZoom: number;
  setAvatarZoom: (v: number) => void;
  avatarInitialCropArea: CropArea | null;
  avatarCroppedAreaPercentages: CropArea | null;
  avatarCroppedAreaPixels: Area | null;
  setAvatarCroppedAreaPercentages: (v: CropArea) => void;
  setAvatarCroppedAreaPixels: (v: Area) => void;
  avatarSourceSize: { width: number; height: number } | null;
  handleAvatarSave: () => void;
  AVATAR_EXPORT_WIDTH: number;
  AVATAR_EXPORT_HEIGHT: number;
  FieldRow: React.ComponentType<{
    icon: React.ReactNode;
    label: string;
    editing: boolean;
    children: React.ReactNode;
    iconTone?: "violet" | "pink" | "cyan" | "amber" | "rose" | "emerald";
  }>;
  PILL: string;
}

export function ProfileSanctuaryLayout(props: ProfileSanctuaryLayoutProps) {
  const {
    form,
    effectiveNeedsVerification,
    showTrialIncompleteBanner,
    profileCompletion,
    resending,
    handleResendVerification,
    scrollToProfileField,
    setIsEditing,
    profileImage,
    isUploading,
    handleImageUpload,
    handleOpenExistingAvatarEditor,
    joinedAt,
    planLabel,
    personalBio,
    userStats,
    communityAvatarPublic,
    handleCommunityAvatarToggle,
    preferencesData,
    milestones,
    isLoggingOut,
    handleLogout,
    isEditing,
    isSaving,
    onSubmit,
    loadProfile,
    pronounsOptions,
    timezoneOpen,
    setTimezoneOpen,
    availableTimezones,
    formatTimezoneOptionLabel,
    goalsOptions,
    triggersOptions,
    emergencyInfoOpen,
    setEmergencyInfoOpen,
    emergencyConsentChecked,
    setEmergencyConsentChecked,
    avatarEditorOpen,
    setAvatarEditorOpen,
    avatarEditorImageUrl,
    avatarCrop,
    setAvatarCrop,
    avatarZoom,
    setAvatarZoom,
    avatarInitialCropArea,
    avatarCroppedAreaPercentages,
    avatarCroppedAreaPixels,
    setAvatarCroppedAreaPercentages,
    setAvatarCroppedAreaPixels,
    avatarSourceSize,
    handleAvatarSave,
    AVATAR_EXPORT_WIDTH,
    AVATAR_EXPORT_HEIGHT,
    FieldRow,
    PILL,
  } = props;

  const displayName = form.watch("name") || "Your name";
  const planPill = formatSubscriptionPlanLabel(planLabel);

  return (
    <motion.div
      className={profilePageAtmosphere}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className={profilePageGlowTop} aria-hidden />
      <div className={profilePageFogMid} aria-hidden />
      <div className={profilePageGlowBottom} aria-hidden />
      <div className={profilePageVignette} aria-hidden />
      <div className={profilePageNoise} aria-hidden />

      <div className="relative z-10 w-full max-w-[1600px] space-y-6 px-1 sm:px-2">
        {effectiveNeedsVerification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center justify-between gap-4 px-5 py-4 ${profileCard} border-amber-500/25 bg-amber-950/35`}
          >
            <motion.div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/20">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-100">Verify your email</p>
                <p className="text-xs text-amber-200/70">Secure your account and unlock all features.</p>
              </div>
            </motion.div>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resending}
              className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
            >
              {resending ? "Sending…" : "Resend link"}
            </button>
          </motion.div>
        )}

        {showTrialIncompleteBanner && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center justify-between gap-4 px-5 py-4 ${profileCard} border-violet-500/25 bg-violet-950/30`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <motion.div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/20">
                <AlertTriangle className="h-4 w-4 text-violet-300" />
              </motion.div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-violet-100">Complete your trial profile</p>
                <p className="text-xs text-violet-200/70">
                  Your profile is {profileCompletion.percent}% complete. Add missing details to finish setup.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsEditing(true);
                scrollToProfileField(profileCompletion.missingFields[0]?.key || "name");
              }}
              className="shrink-0 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500"
            >
              Complete now
            </button>
          </motion.div>
        )}

        <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
          {/* ── Main content ~70% ── */}
          <div className="min-w-0 flex-1 space-y-5 xl:basis-[68%]">
            {/* Hero sanctuary */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <SolaceHeroEnvironment
                imageSrc={PROFILE_HERO_IMG}
                imageAlt="Calm moonlit lake with a warm lantern glow"
                cinematicDepth
                className={profileHeroShell}
                contentClassName="flex min-h-[300px] flex-col p-0 sm:min-h-[340px]"
              >
                <div className="flex flex-1 flex-col justify-end p-5 sm:p-7">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                    <div className="relative shrink-0">
                      <input
                        type="file"
                        id="profile-image-upload"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => !isUploading && document.getElementById("profile-image-upload")?.click()}
                        className="relative h-24 w-24 overflow-hidden rounded-full border-[3px] border-violet-300/35 shadow-[0_0_48px_-6px_rgba(167,139,250,0.65),inset_0_0_0_1px_rgba(255,255,255,0.12)] sm:h-28 sm:w-28"
                        aria-label="Change profile photo"
                      >
                        {isUploading && (
                          <span className="absolute inset-0 z-10 flex items-center justify-center bg-black/55">
                            <Loader2 className="h-7 w-7 animate-spin text-white" />
                          </span>
                        )}
                        {profileImage ? (
                          <img src={profileImage} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center bg-zinc-800 text-4xl">👤</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenExistingAvatarEditor}
                        className="absolute -bottom-0.5 -right-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-zinc-900/90 text-white shadow-lg transition-transform hover:scale-105"
                        aria-label="Edit photo"
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1 space-y-2 pb-1">
                      <h1 className="text-2xl font-semibold tracking-tight text-[rgba(255,255,255,0.96)] [text-shadow:0_0_32px_rgba(167,139,250,0.2)] sm:text-3xl">
                        {displayName}
                      </h1>
                      <p className="text-sm text-[rgba(255,255,255,0.68)]">
                        Member since <span className="font-medium text-[rgba(255,255,255,0.92)]">{joinedAt || "—"}</span>
                      </p>
                      <span
                        className={`${profilePill} border-violet-400/25 bg-violet-500/18 text-violet-100 shadow-[0_0_28px_-8px_rgba(139,92,246,0.45),inset_0_1px_0_rgba(255,255,255,0.1)]`}
                      >
                        {planPill}
                      </span>
                      {personalBio?.trim() ? (
                        <p className="max-w-xl text-sm leading-relaxed text-[rgba(255,255,255,0.72)]">{personalBio.trim()}</p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <span className={`text-[11px] ${profileBodyMuted}`}>Photo in community</span>
                        <Switch
                          id="community-avatar-toggle-profile"
                          checked={communityAvatarPublic}
                          onCheckedChange={handleCommunityAvatarToggle}
                        />
                        <label
                          htmlFor="community-avatar-toggle-profile"
                          className="cursor-pointer text-[11px] font-medium text-zinc-300"
                        >
                          {communityAvatarPublic ? "Public" : "Hidden"}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <motion.div className={profileHeroStatStrip}>
                  <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
                    {[
                      { icon: Activity, label: "Talks", value: userStats.sessions, tone: "violet" as const },
                      { icon: Heart, label: "Check-ins", value: userStats.checkins, tone: "pink" as const },
                      { icon: Star, label: "Profile progress", value: `${profileCompletion.percent}%`, tone: "amber" as const },
                    ].map((stat) => (
                      <div key={stat.label} className="flex flex-col items-center gap-1.5 px-3 py-4 sm:py-5">
                        <span className={profileIconCircle(stat.tone)}>
                          <stat.icon className="h-4 w-4" />
                        </span>
                        <span className="text-xl font-bold tabular-nums text-[rgba(255,255,255,0.96)] sm:text-2xl">{stat.value}</span>
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${profileBodyMuted}`}>{stat.label}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </SolaceHeroEnvironment>
            </motion.div>

            {/* Session prefs + Account row */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className={profileCard}
              >
                <div className={profileCardHeader}>
                  <div>
                    <h2 className={profileCardTitle}>Session preferences</h2>
                    <p className={profileCardSubtitle}>Customize your Solace experience</p>
                  </div>
                </div>
                <div className="space-y-2 p-4 sm:p-5">
                  {[
                    { icon: Volume2, title: "Voice", value: preferencesData.selected_voice || "Not set", link: "/app/session-lobby?customize=voice", tone: "violet" as const },
                    { icon: User, title: "Avatar", value: preferencesData.selected_avatar || "Not set", link: "/app/settings/change-avatar", tone: "pink" as const },
                    { icon: Palette, title: "Environment", value: preferencesData.selected_environment || "Not set", link: "/app/session-lobby?customize=environment", tone: "cyan" as const },
                  ].map((row) => (
                    <Link key={row.title} to={row.link} className={profileRow}>
                      <span className={profileIconCircle(row.tone)}>
                        <row.icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-100">{row.title}</p>
                        <p className="truncate text-xs text-zinc-500">{row.value}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 group-hover:text-violet-300" />
                    </Link>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className={profileCard}
              >
                <div className={profileCardHeader}>
                  <div>
                    <h2 className={profileCardTitle}>Account &amp; privacy</h2>
                    <p className={profileCardSubtitle}>Manage your account settings</p>
                  </div>
                </div>
                <div className="space-y-2 p-4 sm:p-5">
                  {[
                    { icon: Bell, title: "Notifications", link: "/app/settings/notifications", tone: "violet" as const },
                    { icon: Lock, title: "Privacy & Security", link: "/app/settings/privacy", tone: "pink" as const },
                    { icon: Shield, title: "Data & Permissions", link: "/app/settings/privacy", tone: "cyan" as const },
                  ].map((row) => (
                    <Link key={row.title} to={row.link} className={profileRow}>
                      <span className={profileIconCircle(row.tone)}>
                        <row.icon className="h-4 w-4" />
                      </span>
                      <p className="flex-1 text-sm font-medium text-zinc-100">{row.title}</p>
                      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 group-hover:text-violet-300" />
                    </Link>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Milestones */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={profileCard}>
              <div className={profileCardHeader}>
                <div>
                  <h2 className={`flex items-center gap-2 ${profileCardTitle}`}>
                    <Trophy className="h-5 w-5 text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.45)]" /> Milestones
                  </h2>
                  <p className={profileCardSubtitle}>Track your achievements on your Solace journey</p>
                </div>
                <Link
                  to="/app/settings/achievements"
                  className="rounded-xl border border-violet-400/20 bg-violet-500/12 px-3 py-2 text-xs font-semibold text-violet-100 shadow-[0_0_24px_-10px_rgba(139,92,246,0.4)] transition-all hover:bg-violet-500/18 hover:shadow-[0_0_28px_-8px_rgba(139,92,246,0.45)]"
                >
                  View all achievements
                </Link>
              </div>
              <ul className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-2">
                {milestones.map((m) => (
                  <li key={m.id} className={profileMilestoneChip(m.unlocked)}>
                    {m.unlocked ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-zinc-600" />
                    )}
                    <span className={m.unlocked ? "font-medium" : ""}>{m.label}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Support & resources */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className={profileCard}>
              <motion.div className={profileCardHeader}>
                <div>
                  <h2 className={profileCardTitle}>Support &amp; resources</h2>
                  <p className={profileCardSubtitle}>We&apos;re here for you</p>
                </div>
              </motion.div>
              <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
                {[
                  { icon: Heart, title: "Emergency Contacts", subtitle: "People we can reach", link: "/app/settings/emergency-contacts", tone: "pink" as const },
                  { icon: MessageCircle, title: "Contact Support", subtitle: "Get help anytime", link: "/app/settings/help-support", tone: "violet" as const },
                  { icon: FileText, title: "Wellness Plan", subtitle: "Your care roadmap", link: "/app/settings/wellness-plan", tone: "cyan" as const },
                ].map((item) => (
                  <Link
                    key={item.title}
                    to={item.link}
                    className={profileSupportTile}
                  >
                    <span className={profileIconCircle(item.tone)}>
                      <item.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{item.title}</p>
                      <p className="text-[11px] text-zinc-500">{item.subtitle}</p>
                    </div>
                    <ChevronRight className="mt-2 h-4 w-4 text-zinc-600 group-hover:text-fuchsia-300" />
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* Danger zone */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
              className={`${profileCard} border-rose-500/15`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-200">Danger zone</h2>
                  <p className="text-xs text-zinc-500">End your current session</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-rose-400/25 bg-[linear-gradient(135deg,rgba(244,63,94,0.14)_0%,rgba(190,24,93,0.1)_100%)] px-4 py-2.5 text-sm font-semibold text-rose-100 shadow-[0_0_24px_-10px_rgba(244,63,94,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] transition-all hover:border-rose-400/35 hover:shadow-[0_0_32px_-8px_rgba(244,63,94,0.4)] disabled:opacity-60"
                >
                  {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  {isLoggingOut ? "Logging out…" : "Log Out"}
                </button>
              </div>
            </motion.div>
          </div>

          {/* ── Right rail ~30% ── */}
          <motion.div className={`${profileRightRailGlow} min-w-0 space-y-5 xl:basis-[32%] xl:max-w-[420px]`}>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="relative z-10 space-y-5">
                {/* Personal information */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`${profileCard} ${isEditing ? "ring-1 ring-violet-400/30" : ""}`}
                >
                  <div className={profileCardHeader}>
                    <div>
                      <h2 className={profileCardTitle}>Personal information</h2>
                      <p className={profileCardSubtitle}>Your details and preferences</p>
                    </div>
                    {isEditing && (
                      <span className="rounded-full bg-violet-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-200">
                        Editing
                      </span>
                    )}
                  </div>
                  <div className="space-y-2.5 p-4 sm:p-5">
                    {[
                      { name: "name" as const, label: "Full name", icon: <User className="h-3.5 w-3.5" />, placeholder: "Your name" },
                      { name: "email" as const, label: "Email", icon: <Mail className="h-3.5 w-3.5" />, placeholder: "you@email.com" },
                      { name: "birthday" as const, label: "Age", icon: <Calendar className="h-3.5 w-3.5" />, placeholder: "Age", numeric: true },
                      { name: "pronouns" as const, label: "Pronouns", icon: <User className="h-3.5 w-3.5" />, placeholder: "they/them" },
                      { name: "location" as const, label: "Location / Timezone", icon: <MapPin className="h-3.5 w-3.5" />, placeholder: "Timezone" },
                    ].map((f) => (
                      <FormField
                        key={f.name}
                        control={form.control}
                        name={f.name}
                        render={({ field }) => (
                          <FormItem id={`profile-field-${f.name}`} className="scroll-mt-24">
                            <FieldRow icon={f.icon} label={f.label} editing={isEditing}>
                              {isEditing ? (
                                f.name === "pronouns" ? (
                                  <motion.div className="space-y-2">
                                    <select
                                      value={pronounsOptions.includes((field.value || "").toLowerCase()) ? (field.value || "").toLowerCase() : "__custom__"}
                                      disabled={isSaving}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        if (v === "__custom__") {
                                          field.onChange("");
                                          return;
                                        }
                                        field.onChange(v);
                                      }}
                                      className="w-full bg-transparent text-sm font-medium text-zinc-100 outline-none disabled:opacity-60"
                                    >
                                      <option value="">Select pronouns</option>
                                      {pronounsOptions.map((option) => (
                                        <option key={option} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                      <option value="__custom__">Other (custom)</option>
                                    </select>
                                    {!pronounsOptions.includes((field.value || "").toLowerCase()) && (
                                      <input
                                        value={field.value || ""}
                                        disabled={isSaving}
                                        placeholder="Type custom pronouns"
                                        onChange={(e) => field.onChange(e.target.value)}
                                        className="w-full bg-transparent text-sm font-medium text-zinc-100 outline-none placeholder:text-zinc-600"
                                      />
                                    )}
                                  </motion.div>
                                ) : f.name === "location" ? (
                                  <Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
                                    <PopoverTrigger asChild>
                                      <button
                                        type="button"
                                        disabled={isSaving}
                                        className="flex w-full items-center justify-between bg-transparent text-sm font-medium text-zinc-100 outline-none disabled:opacity-60"
                                      >
                                        <span className="truncate text-left">
                                          {field.value ? formatTimezoneOptionLabel(field.value) : "Select timezone"}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] border-white/10 bg-zinc-900 p-0" align="start">
                                      <Command>
                                        <CommandInput placeholder="Search timezone…" />
                                        <CommandList>
                                          <CommandEmpty>No timezone found.</CommandEmpty>
                                          <CommandGroup>
                                            {availableTimezones.map((timezone) => (
                                              <CommandItem
                                                key={timezone}
                                                value={`${timezone} ${formatTimezoneOptionLabel(timezone)}`}
                                                onSelect={() => {
                                                  field.onChange(timezone);
                                                  setTimezoneOpen(false);
                                                }}
                                              >
                                                <Check className={`h-4 w-4 ${field.value === timezone ? "opacity-100" : "opacity-0"}`} />
                                                <span className="truncate">{formatTimezoneOptionLabel(timezone)}</span>
                                              </CommandItem>
                                            ))}
                                          </CommandGroup>
                                        </CommandList>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>
                                ) : (
                                  <input
                                    {...field}
                                    disabled={isSaving}
                                    placeholder={f.placeholder}
                                    inputMode={f.numeric ? "numeric" : undefined}
                                    onChange={f.numeric ? (e) => field.onChange(e.target.value.replace(/\D/g, "")) : field.onChange}
                                    className="w-full bg-transparent text-sm font-medium text-zinc-100 outline-none placeholder:text-zinc-600"
                                  />
                                )
                              ) : (
                                <p className="truncate text-sm font-medium text-zinc-200">
                                  {f.numeric && field.value
                                    ? `${String(field.value).replace(/\D/g, "")} years old`
                                    : f.name === "location" && field.value
                                      ? formatTimezoneOptionLabel(String(field.value))
                                      : field.value || <span className="font-normal text-zinc-600">Not set</span>}
                                </p>
                              )}
                            </FieldRow>
                            <FormMessage className="mt-0.5 px-1 text-xs" />
                          </FormItem>
                        )}
                      />
                    ))}

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem id="profile-field-phone" className="scroll-mt-24">
                          <FieldRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" editing={isEditing}>
                            {isEditing ? (
                              <PhoneInput value={field.value} onChange={field.onChange} disabled={isSaving} placeholder="Phone number" className="w-full min-w-0" />
                            ) : (
                              <p className="text-sm font-medium text-zinc-200">
                                {field.value || <span className="font-normal text-zinc-600">Not set</span>}
                              </p>
                            )}
                          </FieldRow>
                          <FormMessage className="mt-0.5 px-1 text-xs" />
                        </FormItem>
                      )}
                    />

                    <div className="pt-2">
                      {isEditing ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button type="submit" disabled={isSaving} className={`${profileBtnPrimary} flex-1`}>
                            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                            Save changes
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditing(false);
                              loadProfile();
                            }}
                            disabled={isSaving}
                            className={`${profileBtnGhost} flex-1`}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setIsEditing(true)} className={`${profileBtnPrimary} w-full`}>
                          <Edit className="h-4 w-4" /> Edit profile
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Wellness snapshot */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={profileCard}>
                  <div className={profileCardHeader}>
                    <div>
                      <h2 className={profileCardTitle}>Wellness snapshot</h2>
                      <p className={profileCardSubtitle}>Your current wellness overview</p>
                    </div>
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin text-violet-400" />}
                  </div>
                  <div className="space-y-5 p-4 sm:p-5">
                    <FormField
                      control={form.control}
                      name="in_therapy"
                      render={({ field }) => (
                        <FormItem id="profile-field-in_therapy" className="scroll-mt-24">
                          <div className="mb-2 flex items-center gap-2">
                            <Users className="h-4 w-4 text-violet-400" />
                            <FormLabel className="text-sm font-semibold text-zinc-300">Therapist</FormLabel>
                          </div>
                          <FormControl>
                            {isEditing ? (
                              <select
                                {...field}
                                disabled={isSaving}
                                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-zinc-100 outline-none focus:ring-2 focus:ring-violet-400/30"
                              >
                                <option value="">Select…</option>
                                <option>Yes</option>
                                <option>No</option>
                                <option>Prefer not to say</option>
                              </select>
                            ) : (
                              <span className={`${PILL} border-violet-400/25 bg-violet-500/15 text-violet-200`}>
                                {field.value || "Not specified"}
                              </span>
                            )}
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="selected_goals"
                      render={({ field }) => (
                        <FormItem id="profile-field-selected_goals" className="scroll-mt-24">
                          <motion.div className="mb-2 flex items-center gap-2 border-t border-white/[0.06] pt-4">
                            <Target className="h-4 w-4 text-emerald-400" />
                            <FormLabel className="text-sm font-semibold text-zinc-300">Wellness goals</FormLabel>
                          </motion.div>
                          <FormControl>
                            {isEditing ? (
                              <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                                {goalsOptions.map((g) => {
                                  const selected = (field.value || []).includes(g.value);
                                  return (
                                    <button
                                      key={g.value}
                                      type="button"
                                      disabled={isSaving}
                                      onClick={() =>
                                        field.onChange(selected ? field.value!.filter((v: string) => v !== g.value) : [...(field.value || []), g.value])
                                      }
                                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-all ${
                                        selected
                                          ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                                          : "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:border-emerald-400/25"
                                      }`}
                                    >
                                      <FluentEmoji emoji={g.emoji} size={16} className="shrink-0" /> {g.label}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {field.value?.length ? (
                                  field.value.map((v: string, i: number) => {
                                    const opt = goalsOptions.find((o) => o.value === v);
                                    return (
                                      <span key={i} className={`${PILL} border-emerald-400/25 bg-emerald-500/12 text-emerald-200`}>
                                        {opt?.emoji ? <FluentEmoji emoji={opt.emoji} size={16} /> : null} {opt?.label || v}
                                      </span>
                                    );
                                  })
                                ) : (
                                  <p className="text-sm italic text-zinc-500">Not specified</p>
                                )}
                              </div>
                            )}
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="selected_triggers"
                      render={({ field }) => (
                        <FormItem id="profile-field-selected_triggers" className="scroll-mt-24">
                          <div className="mb-2 flex items-center gap-2 border-t border-white/[0.06] pt-4">
                            <Zap className="h-4 w-4 text-amber-400" />
                            <FormLabel className="text-sm font-semibold text-zinc-300">Challenges</FormLabel>
                          </div>
                          <FormControl>
                            {isEditing ? (
                              <motion.div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto">
                                {triggersOptions.map((t) => {
                                  const selected = (field.value || []).includes(t.value);
                                  return (
                                    <button
                                      key={t.value}
                                      type="button"
                                      disabled={isSaving}
                                      onClick={() =>
                                        field.onChange(selected ? field.value!.filter((v: string) => v !== t.value) : [...(field.value || []), t.value])
                                      }
                                      className={`rounded-xl border px-2.5 py-2 text-left text-xs font-semibold transition-all ${
                                        selected
                                          ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
                                          : "border-white/[0.08] bg-white/[0.03] text-zinc-400"
                                      }`}
                                    >
                                      {t.label}
                                    </button>
                                  );
                                })}
                              </motion.div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {field.value?.length ? (
                                  field.value.map((v: string, i: number) => {
                                    const opt = triggersOptions.find((o) => o.value === v);
                                    return (
                                      <span key={i} className={`${PILL} border-amber-400/25 bg-amber-500/12 text-amber-200`}>
                                        {opt?.label || v}
                                      </span>
                                    );
                                  })
                                ) : (
                                  <p className="text-sm italic text-zinc-500">Not specified</p>
                                )}
                              </div>
                            )}
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </motion.div>

                {/* Emergency contact */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 }}
                  className={profileEmergencyCard}
                >
                  <img src={PROFILE_EMERGENCY_BG} alt="" className={profileEmergencyBg} aria-hidden />
                  <div className={profileEmergencyWarmthAmber} aria-hidden />
                  <div className={profileEmergencyWarmthViolet} aria-hidden />
                  <div className="relative">
                    <div className={profileCardHeader}>
                      <div>
                        <h2 className={profileCardTitle}>Emergency contact</h2>
                        <p className={profileCardSubtitle}>Trusted person we can reach if needed</p>
                      </div>
                      <Popover open={emergencyInfoOpen} onOpenChange={setEmergencyInfoOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            onMouseEnter={() => setEmergencyInfoOpen(true)}
                            onMouseLeave={() => setEmergencyInfoOpen(false)}
                            onFocus={() => setEmergencyInfoOpen(true)}
                            onBlur={() => setEmergencyInfoOpen(false)}
                            className="inline-flex items-center gap-1 rounded-full border border-rose-400/25 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/15"
                            aria-label="Learn why emergency contact is needed"
                          >
                            <Info className="h-3.5 w-3.5" /> Why we ask
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="max-w-xs border-white/10 bg-zinc-900 text-xs text-zinc-300">
                          We only use this contact during serious safety concerns, such as when we cannot reach you in a
                          high-risk wellbeing event. It is never used for marketing or regular app notifications.
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-3 p-4 sm:p-5">
                      {[
                        { name: "emergency_contact_name" as const, label: "Name", placeholder: "Contact name" },
                        { name: "emergency_contact_relationship" as const, label: "Relationship", placeholder: "e.g. Parent" },
                      ].map((f) => (
                        <FormField
                          key={f.name}
                          control={form.control}
                          name={f.name}
                          render={({ field }) => (
                            <FormItem id={`profile-field-${f.name}`} className="scroll-mt-24">
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{f.label}</p>
                              {isEditing ? (
                                <input
                                  {...field}
                                  disabled={isSaving}
                                  placeholder={f.placeholder}
                                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-medium text-zinc-100 outline-none focus:ring-2 focus:ring-rose-400/25"
                                />
                              ) : (
                                <p className="text-sm font-medium text-zinc-200">
                                  {field.value || <span className="font-normal text-zinc-600">Not set</span>}
                                </p>
                              )}
                              <FormMessage className="mt-0.5 text-xs" />
                            </FormItem>
                          )}
                        />
                      ))}
                      <FormField
                        control={form.control}
                        name="emergency_contact_phone"
                        render={({ field }) => (
                          <FormItem id="profile-field-emergency_contact_phone" className="scroll-mt-24">
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Phone</p>
                            {isEditing ? (
                              <PhoneInput
                                value={field.value}
                                onChange={field.onChange}
                                disabled={isSaving}
                                placeholder="Contact phone"
                                className="w-full min-w-0"
                                buttonClassName="h-10 w-[110px] rounded-xl text-sm"
                                inputClassName="h-10 rounded-xl text-sm"
                              />
                            ) : (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-zinc-500" />
                                <p className="text-sm font-medium text-zinc-200">
                                  {field.value || <span className="font-normal text-zinc-600">Not set</span>}
                                </p>
                              </div>
                            )}
                            <FormMessage className="mt-0.5 text-xs" />
                          </FormItem>
                        )}
                      />
                      {isEditing && (
                        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5">
                          <label className="flex cursor-pointer items-start gap-2 text-xs text-zinc-300">
                            <input
                              type="checkbox"
                              checked={emergencyConsentChecked}
                              onChange={(e) => setEmergencyConsentChecked(e.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded border-zinc-600 text-rose-500 focus:ring-rose-400"
                            />
                            <span>
                              I confirm this person knows they may be contacted only during urgent wellbeing or safety situations.
                            </span>
                          </label>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(true);
                          scrollToProfileField("emergency_contact_name");
                        }}
                        className={`${profileBtnGhost} w-full border-rose-500/20 text-rose-100 hover:bg-rose-500/10`}
                      >
                        Update contact
                      </button>
                    </div>
                  </div>
                </motion.div>
              </form>
            </Form>
          </motion.div>
        </div>
      </div>

      <Dialog open={avatarEditorOpen} onOpenChange={setAvatarEditorOpen}>
        <DialogContent className="border-white/10 bg-zinc-950 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-zinc-50">Adjust profile photo</DialogTitle>
            <DialogDescription className="text-zinc-400">Crop and zoom your image before saving.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative mx-auto w-full max-w-[22rem] rounded-2xl border border-white/10 p-2">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-zinc-900">
                {avatarEditorImageUrl && (
                  <Cropper
                    key={`${avatarEditorImageUrl}-${avatarInitialCropArea ? JSON.stringify(avatarInitialCropArea) : "no-initial"}`}
                    image={avatarEditorImageUrl}
                    crop={avatarCrop}
                    zoom={avatarZoom}
                    aspect={4 / 3}
                    initialCroppedAreaPercentages={avatarInitialCropArea || undefined}
                    onCropChange={setAvatarCrop}
                    onZoomChange={setAvatarZoom}
                    onCropComplete={(croppedAreaPercentages, croppedAreaPixels) => {
                      setAvatarCroppedAreaPercentages(croppedAreaPercentages as CropArea);
                      setAvatarCroppedAreaPixels(croppedAreaPixels);
                    }}
                    showGrid
                  />
                )}
              </div>
              <span className="absolute bottom-4 right-4 rounded-lg bg-black/65 px-2 py-1 text-[10px] font-semibold text-white">
                {AVATAR_EXPORT_WIDTH} x {AVATAR_EXPORT_HEIGHT}px
              </span>
            </div>
            {avatarSourceSize && (
              <p className="text-xs text-zinc-500">
                Original image: {avatarSourceSize.width} x {avatarSourceSize.height}px
              </p>
            )}
            <label className="block text-xs font-semibold text-zinc-400">
              Zoom ({avatarZoom.toFixed(1)}x)
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={avatarZoom}
                onChange={(e) => setAvatarZoom(Number(e.target.value))}
                className="mt-1 w-full"
              />
            </label>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setAvatarEditorOpen(false)} disabled={isUploading} className={profileBtnGhost}>
              Cancel
            </button>
            <button type="button" onClick={handleAvatarSave} disabled={isUploading} className={profileBtnPrimary}>
              {isUploading ? "Saving..." : "Save photo"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
