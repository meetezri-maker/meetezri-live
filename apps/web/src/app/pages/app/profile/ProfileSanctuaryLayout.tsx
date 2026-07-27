import { getWellnessGoalLabel } from "@/lib/wellnessGoals";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { joinFullName, type ProfileFormDefaults } from "./profileFormMapping";
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
  CheckCircle2,
  Circle,
  Star,
  MessageCircle,
  FileText,
} from "lucide-react";
import { SolaceHeroEnvironment } from "@/app/solace";
import { profileAgeDisplayLabel } from "@/lib/profileAge";
import { cn } from "@/lib/utils";
import { Switch } from "@/app/components/ui/switch";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
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
import type { PaidOnboardingChecklistResult, PaidOnboardingStepAction } from "@/lib/onboarding/paidOnboardingSteps";
import { PaidOnboardingChecklist } from "./PaidOnboardingChecklist";
import {
  PROFILE_HERO_IMG,
  PROFILE_EMERGENCY_BG,
  formatSubscriptionPlanLabel,
  profileBodyMuted,
  profileBtnGhost,
  profileBtnPrimary,
  profileCameraButton,
  profileCard,
  profileCardHeader,
  profileCardSubtitle,
  profileCardTitle,
  profileDialogContent,
  profileDialogDescription,
  profileDialogTitle,
  profileEmergencyBg,
  profileEmergencyCard,
  profileEmergencyWarmthAmber,
  profileEmergencyWarmthViolet,
  profileEmergencyLabel,
  profileFieldValue,
  profileFieldValueEmpty,
  profileFormLabel,
  profileHeroBio,
  profileHeroMeta,
  profileHeroMetaStrong,
  profileHeroName,
  profileHeroShell,
  profileHeroStatDivide,
  profileHeroStatLabel,
  profileHeroStatStrip,
  profileHeroStatValue,
  profileHeroToggleLabel,
  profileDropdownPopover,
  profileAchievementsLink,
  profileBannerBtnAmber,
  profileBannerBtnViolet,
  profileBtnDanger,
  profileIconCircle,
  profileIconAmberMd,
  profileIconEmeraldMd,
  profileIconRoseSm,
  profileIconVioletMd,
  profileMilestoneChip,
  profileMilestoneUnlockedIcon,
  profilePageAtmosphere,
  profilePageGlowBottom,
  profilePageFogMid,
  profilePageGlowTop,
  profilePageNoise,
  profilePageVignette,
  profilePillAmber,
  profilePillEmerald,
  profilePillHeroOnMedia,
  profilePillViolet,
  profileRightRailGlow,
  profileTrophyIcon,
  profileWhyWeAskBtn,
  profileRow,
  profileRowChevron,
  profileRowTitle,
  profileRowValue,
  profileSectionDivider,
  profileSupportTile,
  profileSupportTitle,
  profileTrialBanner,
  profileVerifyBanner,
} from "./profileUi";

type CropArea = { x: number; y: number; width: number; height: number };

interface MilestoneItem {
  id: string;
  label: string;
  unlocked: boolean;
}

interface ProfileSanctuaryLayoutProps {
  /** Read-only display values, mapped once by the container. */
  profileView: ProfileFormDefaults;
  effectiveNeedsVerification: boolean;
  showTrialIncompleteBanner: boolean;
  paidOnboardingChecklist: PaidOnboardingChecklistResult | null;
  onPaidOnboardingStepAction: (action: PaidOnboardingStepAction) => void;
  profileCompletion: { percent: number; missingFields: { label: string; key: string }[]; isComplete: boolean };
  resending: boolean;
  handleResendVerification: () => void;
  /** The single edit entry point for the whole page. */
  onEditProfile: (focusField?: string) => void;
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
  formatTimezoneOptionLabel: (tz: string) => string;
  goalsOptions: { value: string; label: string; emoji: string }[];
  triggersOptions: { value: string; label: string }[];
  emergencyInfoOpen: boolean;
  setEmergencyInfoOpen: (v: boolean) => void;
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
  profileAgeStorage: string | null;
}

export function ProfileSanctuaryLayout(props: ProfileSanctuaryLayoutProps) {
  const {
    profileView,
    effectiveNeedsVerification,
    showTrialIncompleteBanner,
    paidOnboardingChecklist,
    onPaidOnboardingStepAction,
    profileCompletion,
    resending,
    handleResendVerification,
    onEditProfile,
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
    formatTimezoneOptionLabel,
    goalsOptions,
    triggersOptions,
    emergencyInfoOpen,
    setEmergencyInfoOpen,
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
    profileAgeStorage,
  } = props;

  const composedName = joinFullName(profileView.firstName, profileView.lastName || "");
  const displayName = composedName || "Your name";
  const profileInitial = (displayName.trim()[0] || "?").toUpperCase();
  const planPill = formatSubscriptionPlanLabel(planLabel);

  /** Read-only row value with the shared "Not set" sentinel. */
  const readOnlyValue = (value?: string | null) =>
    value && String(value).trim() ? (
      String(value)
    ) : (
      <span className={profileFieldValueEmpty}>Not set</span>
    );

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
            className={`flex items-center justify-between gap-4 px-5 py-4 ${profileVerifyBanner}`}
          >
            <motion.div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/20 [html[data-ezri-theme=light]_&]:bg-amber-100 [html[data-theme=light]_&]:bg-amber-100">
                <AlertTriangle className="h-4 w-4 text-amber-400 [html[data-ezri-theme=light]_&]:text-amber-700 [html[data-theme=light]_&]:text-amber-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-100 [html[data-ezri-theme=light]_&]:text-amber-900 [html[data-theme=light]_&]:text-amber-900">
                  Verify your email
                </p>
                <p className="text-xs text-amber-200/70 [html[data-ezri-theme=light]_&]:text-amber-800/90 [html[data-theme=light]_&]:text-amber-800/90">
                  Secure your account and unlock all features.
                </p>
              </div>
            </motion.div>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resending}
              className={profileBannerBtnAmber}
            >
              {resending ? "Sending…" : "Resend link"}
            </button>
          </motion.div>
        )}

        {paidOnboardingChecklist?.hasIncomplete && (
          <PaidOnboardingChecklist
            checklist={paidOnboardingChecklist}
            onStepAction={onPaidOnboardingStepAction}
          />
        )}

        {showTrialIncompleteBanner && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center justify-between gap-4 px-5 py-4 ${profileTrialBanner}`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <motion.div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/20 [html[data-ezri-theme=light]_&]:bg-violet-100 [html[data-theme=light]_&]:bg-violet-100">
                <AlertTriangle className="h-4 w-4 text-violet-300 [html[data-ezri-theme=light]_&]:text-violet-700 [html[data-theme=light]_&]:text-violet-700" />
              </motion.div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-violet-100 [html[data-ezri-theme=light]_&]:text-violet-900 [html[data-theme=light]_&]:text-violet-900">
                  Complete your trial profile
                </p>
                <p className="text-xs text-violet-200/70 [html[data-ezri-theme=light]_&]:text-violet-800/90 [html[data-theme=light]_&]:text-violet-800/90">
                  Your profile is {profileCompletion.percent}% complete. Add missing details to finish setup.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onEditProfile(profileCompletion.missingFields[0]?.key || "name")}
              className={profileBannerBtnViolet}
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
                          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500/30 to-cyan-500/15 text-3xl font-semibold text-white sm:text-4xl">
                            {profileInitial}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenExistingAvatarEditor}
                        className={profileCameraButton}
                        aria-label="Edit photo"
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1 space-y-2 pb-1">
                      <h1 className={profileHeroName}>{displayName}</h1>
                      <p className={profileHeroMeta}>
                        Member since <span className={profileHeroMetaStrong}>{joinedAt || "—"}</span>
                      </p>
                      <span className={profilePillHeroOnMedia}>{planPill}</span>
                      {personalBio?.trim() ? (
                        <p className={profileHeroBio}>{personalBio.trim()}</p>
                      ) : null}
                      {/* The one and only edit entry point on this page. */}
                      <div className="pt-1">
                        <button
                          type="button"
                          id="profile-edit-trigger"
                          onClick={() => onEditProfile()}
                          className={profileBtnPrimary}
                        >
                          <Edit className="h-4 w-4" /> Edit Profile
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <span className={`text-[11px] ${profileBodyMuted}`}>Photo in community</span>
                        <Switch
                          id="community-avatar-toggle-profile"
                          checked={communityAvatarPublic}
                          onCheckedChange={handleCommunityAvatarToggle}
                        />
                        <label
                          htmlFor="community-avatar-toggle-profile"
                          className={profileHeroToggleLabel}
                        >
                          {communityAvatarPublic ? "Public" : "Hidden"}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <motion.div className={profileHeroStatStrip}>
                  <div className={profileHeroStatDivide}>
                    {[
                      { icon: Activity, label: "Talks", value: userStats.sessions, tone: "violet" as const },
                      { icon: Heart, label: "Check-ins", value: userStats.checkins, tone: "pink" as const },
                      { icon: Star, label: "Profile progress", value: `${profileCompletion.percent}%`, tone: "amber" as const },
                    ].map((stat) => (
                      <div key={stat.label} className="flex flex-col items-center gap-1.5 px-3 py-4 sm:py-5">
                        <span className={profileIconCircle(stat.tone)}>
                          <stat.icon className="h-4 w-4" />
                        </span>
                        <span className={profileHeroStatValue}>{stat.value}</span>
                        <span className={profileHeroStatLabel}>{stat.label}</span>
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
                        <p className={profileRowTitle}>{row.title}</p>
                        <p className={profileRowValue}>{row.value}</p>
                      </div>
                      <ChevronRight className={profileRowChevron} />
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
                      <p className={cn("flex-1", profileRowTitle)}>{row.title}</p>
                      <ChevronRight className={profileRowChevron} />
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
                    <Trophy className={profileTrophyIcon} /> Milestones
                  </h2>
                  <p className={profileCardSubtitle}>Track your achievements on your Solace journey</p>
                </div>
                <Link to="/app/settings/achievements" className={profileAchievementsLink}>
                  View all achievements
                </Link>
              </div>
              <ul className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-2">
                {milestones.map((m) => (
                  <li key={m.id} className={profileMilestoneChip(m.unlocked)}>
                    {m.unlocked ? (
                      <CheckCircle2 className={profileMilestoneUnlockedIcon} />
                    ) : (
                      <Circle className={cn("h-4 w-4 shrink-0", profileBodyMuted)} />
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
                      <p className={profileSupportTitle}>{item.title}</p>
                      <p className={cn("text-[11px]", profileRowValue)}>{item.subtitle}</p>
                    </div>
                    <ChevronRight className={cn("mt-2 h-4 w-4", profileRowChevron, "group-hover:text-fuchsia-500 [html[data-ezri-theme=light]_&]:group-hover:text-fuchsia-600")} />
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
                  <h2 className={cn("text-sm font-semibold", profileRowTitle)}>Danger zone</h2>
                  <p className={cn("text-xs", profileRowValue)}>End your current session</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className={profileBtnDanger}
                >
                  {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  {isLoggingOut ? "Logging out…" : "Log Out"}
                </button>
              </div>
            </motion.div>
          </div>

          {/* ── Right rail ~30% — read-only. All editing lives in ProfileEditModal. ── */}
          <motion.div className={`${profileRightRailGlow} min-w-0 space-y-5 xl:basis-[32%] xl:max-w-[420px]`}>
            <div className="relative z-10 space-y-5 overflow-visible">
              {/* Personal information */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(profileCard, "overflow-visible")}
              >
                <div className={profileCardHeader}>
                  <div>
                    <h2 className={profileCardTitle}>Personal information</h2>
                    <p className={profileCardSubtitle}>Your details and preferences</p>
                  </div>
                </div>
                <div className="space-y-2.5 p-4 sm:p-5">
                  <div id="profile-field-name">
                    <FieldRow icon={<User className="h-3.5 w-3.5" />} label="Full name" editing={false}>
                      <p className={cn("truncate", profileFieldValue)}>{readOnlyValue(composedName)}</p>
                    </FieldRow>
                  </div>

                  <div id="profile-field-email">
                    <FieldRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" editing={false}>
                      <p className={cn("truncate", profileFieldValue)}>
                        {readOnlyValue(profileView.emailDisplay)}
                      </p>
                    </FieldRow>
                  </div>

                  <div id="profile-field-birthday">
                    <FieldRow icon={<Calendar className="h-3.5 w-3.5" />} label="Age" editing={false}>
                      <p className={cn("truncate", profileFieldValue)}>
                        {profileAgeDisplayLabel(profileAgeStorage ?? profileView.birthday) || (
                          <span className={profileFieldValueEmpty}>Not set</span>
                        )}
                      </p>
                    </FieldRow>
                  </div>

                  <div id="profile-field-pronouns">
                    <FieldRow icon={<User className="h-3.5 w-3.5" />} label="Pronouns" editing={false}>
                      <p className={cn("truncate", profileFieldValue)}>
                        {readOnlyValue(profileView.pronouns)}
                      </p>
                    </FieldRow>
                  </div>

                  <div id="profile-field-timezone">
                    <FieldRow icon={<MapPin className="h-3.5 w-3.5" />} label="Timezone" editing={false}>
                      <p className={cn("truncate", profileFieldValue)}>
                        {profileView.timezone ? (
                          formatTimezoneOptionLabel(String(profileView.timezone))
                        ) : (
                          <span className={profileFieldValueEmpty}>Not set</span>
                        )}
                      </p>
                    </FieldRow>
                  </div>

                  <div id="profile-field-phone">
                    <FieldRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" editing={false}>
                      <p className={profileFieldValue}>{readOnlyValue(profileView.phone)}</p>
                    </FieldRow>
                  </div>
                </div>
              </motion.div>

              {/* Wellness snapshot */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className={profileCard}
              >
                <div className={profileCardHeader}>
                  <div>
                    <h2 className={profileCardTitle}>Wellness snapshot</h2>
                    <p className={profileCardSubtitle}>Your current wellness overview</p>
                  </div>
                </div>
                <div className="space-y-5 p-4 sm:p-5">
                  <div id="profile-field-in_therapy">
                    <div className="mb-2 flex items-center gap-2">
                      <Users className={profileIconVioletMd} />
                      <p className={profileFormLabel}>Therapist</p>
                    </div>
                    <span className={profilePillViolet}>{profileView.in_therapy || "Not specified"}</span>
                  </div>

                  <div id="profile-field-selected_goals">
                    <div className={cn("mb-2 flex items-center gap-2", profileSectionDivider)}>
                      <Target className={profileIconEmeraldMd} />
                      <p className={profileFormLabel}>Wellness goals</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {profileView.selected_goals?.length ? (
                        profileView.selected_goals.map((v: string, i: number) => {
                          const opt = goalsOptions.find((o) => o.value === v);
                          return (
                            <span key={i} className={profilePillEmerald}>
                              {opt?.emoji ? <FluentEmoji emoji={opt.emoji} size={16} /> : null}{" "}
                              {opt?.label || getWellnessGoalLabel(v)}
                            </span>
                          );
                        })
                      ) : (
                        <p className={cn("text-sm italic", profileRowValue)}>Not specified</p>
                      )}
                    </div>
                  </div>

                  <div id="profile-field-selected_triggers">
                    <div className={cn("mb-2 flex items-center gap-2", profileSectionDivider)}>
                      <Zap className={profileIconAmberMd} />
                      <p className={profileFormLabel}>Challenges</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {profileView.selected_triggers?.length ? (
                        profileView.selected_triggers.map((v: string, i: number) => {
                          const opt = triggersOptions.find((o) => o.value === v);
                          return (
                            <span key={i} className={profilePillAmber}>
                              {opt?.label || v}
                            </span>
                          );
                        })
                      ) : (
                        <p className={cn("text-sm italic", profileRowValue)}>Not specified</p>
                      )}
                    </div>
                  </div>
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
                          className={profileWhyWeAskBtn}
                          aria-label="Learn why emergency contact is needed"
                        >
                          <Info className="h-3.5 w-3.5" /> Why we ask
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        className={cn(
                          "max-w-xs text-xs",
                          profileDropdownPopover,
                          "[html[data-ezri-theme=light]_&]:text-[var(--text-secondary)]",
                          "[html[data-theme=light]_&]:text-[var(--text-secondary)]"
                        )}
                      >
                        We only use this contact during serious safety concerns, such as when we cannot reach you in a
                        high-risk wellbeing event. It is never used for marketing or regular app notifications.
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-3 p-4 sm:p-5">
                    <div id="profile-field-emergency_contact_name">
                      <p className={profileEmergencyLabel}>Name</p>
                      <p className={profileFieldValue}>
                        {readOnlyValue(profileView.emergency_contact_name)}
                      </p>
                    </div>
                    <div id="profile-field-emergency_contact_relationship">
                      <p className={profileEmergencyLabel}>Relationship</p>
                      <p className={profileFieldValue}>
                        {readOnlyValue(profileView.emergency_contact_relationship)}
                      </p>
                    </div>
                    <div id="profile-field-emergency_contact_phone">
                      <p className={profileEmergencyLabel}>Phone</p>
                      <div className="flex items-center gap-2">
                        <Phone className={profileIconRoseSm} />
                        <p className={profileFieldValue}>
                          {readOnlyValue(profileView.emergency_contact_phone)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      <Dialog open={avatarEditorOpen} onOpenChange={setAvatarEditorOpen}>
        <DialogContent className={profileDialogContent}>
          <DialogHeader>
            <DialogTitle className={profileDialogTitle}>Adjust profile photo</DialogTitle>
            <DialogDescription className={profileDialogDescription}>
              Crop and zoom your image before saving.
            </DialogDescription>
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
              <p className={cn("text-xs", profileRowValue)}>
                Original image: {avatarSourceSize.width} x {avatarSourceSize.height}px
              </p>
            )}
            <label className={cn("block text-xs font-semibold", profileFormLabel)}>
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
