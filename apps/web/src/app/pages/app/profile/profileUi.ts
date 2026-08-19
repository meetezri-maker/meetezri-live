import { cn } from "@/lib/utils";
import {
  MEMBERSHIP_COPY,
  MEMBERSHIP_LABELS,
  membershipKeyForPlan,
} from "@/app/utils/membershipCopy";
import {
  solaceCard,
  solacePageAtmosphere,
  solacePageFogMid,
  solacePageGlowTop,
  solacePageVignette,
} from "@/app/solace/solacePageChrome";

export const PROFILE_HERO_IMG = "/profile/profile.jpg";
export const PROFILE_EMERGENCY_BG = "/community/scene-water.jpg";
export const PROFILE_SIDEBAR_INSPIRATION_IMG = "/community/scene-forest.jpg";

const light = "[html[data-ezri-theme=light]_&]";
const lightAlt = "[html[data-theme=light]_&]";

/** Page shell */
export const profilePageAtmosphere = cn(
  solacePageAtmosphere,
  "profile-page relative min-h-full overflow-x-clip overflow-y-visible pb-10 pt-4 sm:pt-6 lg:pt-8",
  "[overflow-anchor:none]"
);

export const profilePageGlowTop = cn(
  solacePageGlowTop,
  `${light}:opacity-80`,
  `${lightAlt}:opacity-80`
);

export const profilePageFogMid = cn(
  solacePageFogMid,
  `${light}:opacity-65`,
  `${lightAlt}:opacity-65`
);

export const profilePageGlowBottom = cn(
  "pointer-events-none absolute bottom-[-8rem] left-[15%] h-80 w-80 rounded-full",
  "bg-[radial-gradient(circle,rgba(192,132,252,0.1)_0%,transparent_70%)] blur-3xl",
  `${light}:bg-[radial-gradient(circle,rgba(167,139,250,0.18)_0%,transparent_70%)]`,
  `${lightAlt}:bg-[radial-gradient(circle,rgba(167,139,250,0.18)_0%,transparent_70%)]`
);

export const profilePageVignette = cn(
  solacePageVignette,
  `${light}:bg-[radial-gradient(ellipse_90%_70%_at_50%_50%,transparent_50%,rgba(243,236,255,0.35)_100%)]`,
  `${lightAlt}:bg-[radial-gradient(ellipse_90%_70%_at_50%_50%,transparent_50%,rgba(243,236,255,0.35)_100%)]`
);

export const profilePageNoise = cn(
  "pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-soft-light",
  "[background-image:url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")]",
  `${light}:opacity-[0.02]`,
  `${lightAlt}:opacity-[0.02]`
);

/** Cards & panels */
export const profileCard = cn(
  solaceCard,
  "light-theme-card light-theme-card-hover rounded-[1.25rem] backdrop-blur-xl",
  "border-white/[0.05] bg-[linear-gradient(180deg,rgba(18,18,40,0.95)_0%,rgba(10,10,24,0.98)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-24px_48px_-24px_rgba(0,0,0,0.35),0_0_40px_rgba(168,85,247,0.06),0_24px_64px_-36px_rgba(0,0,0,0.72)]",
  `${light}:border-[color:var(--border)]`,
  `${light}:bg-[var(--card-solid,#ffffff)]`,
  `${light}:text-[var(--text-primary)]`,
  `${light}:shadow-[var(--solace-card-shadow)]`,
  `${lightAlt}:border-[color:var(--border)]`,
  `${lightAlt}:bg-[var(--card-solid,#ffffff)]`,
  `${lightAlt}:text-[var(--text-primary)]`,
  `${lightAlt}:shadow-[var(--solace-card-shadow)]`
);

export const profileCardHeader = cn(
  "flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4 sm:px-6",
  "border-white/[0.05] bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,transparent_100%)]",
  `${light}:border-[color:var(--border)]`,
  `${light}:bg-[var(--surface-soft,#fbf8ff)]`,
  `${lightAlt}:border-[color:var(--border)]`,
  `${lightAlt}:bg-[var(--surface-soft,#fbf8ff)]`
);

export const profileCardTitle = cn(
  "text-base font-semibold text-[rgba(255,255,255,0.96)] [text-shadow:0_0_24px_rgba(167,139,250,0.12)]",
  `${light}:text-[var(--text-primary)] ${light}:[text-shadow:none]`,
  `${lightAlt}:text-[var(--text-primary)] ${lightAlt}:[text-shadow:none]`
);

export const profileCardSubtitle = cn(
  "mt-0.5 text-xs text-[rgba(255,255,255,0.68)]",
  `${light}:text-[var(--text-secondary)]`,
  `${lightAlt}:text-[var(--text-secondary)]`
);

export const profileBodyMuted = cn(
  "text-[rgba(255,255,255,0.45)]",
  `${light}:text-[var(--text-muted)]`,
  `${lightAlt}:text-[var(--text-muted)]`
);

export const profileRow = cn(
  "group flex min-h-[44px] items-center gap-3 rounded-2xl border px-3.5 py-3 transition-all duration-300",
  "border-white/[0.05] bg-[linear-gradient(135deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.015)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  "hover:border-violet-400/20 hover:bg-violet-500/[0.07] hover:shadow-[0_0_28px_-8px_rgba(139,92,246,0.2)]",
  `${light}:border-[color:var(--border)]`,
  `${light}:bg-[var(--card-soft,#fbf8ff)]`,
  `${light}:hover:border-violet-300/45`,
  `${light}:hover:bg-violet-50/90`,
  `${light}:hover:shadow-[0_8px_24px_-12px_rgba(88,28,135,0.12)]`,
  `${lightAlt}:border-[color:var(--border)]`,
  `${lightAlt}:bg-[var(--card-soft,#fbf8ff)]`,
  `${lightAlt}:hover:border-violet-300/45`,
  `${lightAlt}:hover:bg-violet-50/90`
);

export const profileRowTitle = cn(
  "text-sm font-medium text-zinc-100",
  `${light}:text-[var(--text-primary)]`,
  `${lightAlt}:text-[var(--text-primary)]`
);

export const profileRowValue = cn(
  "truncate text-xs text-zinc-500",
  `${light}:text-[var(--text-muted)]`,
  `${lightAlt}:text-[var(--text-muted)]`
);

export const profileRowChevron = cn(
  "h-4 w-4 shrink-0 text-zinc-600 group-hover:text-violet-300",
  `${light}:text-[var(--text-muted)] ${light}:group-hover:text-violet-600`,
  `${lightAlt}:text-[var(--text-muted)] ${lightAlt}:group-hover:text-violet-600`
);

const profileIconChipTone = {
  violet: "violet",
  pink: "pink",
  cyan: "cyan",
  amber: "amber",
  rose: "rose",
  emerald: "emerald",
} as const;

export const profileIconCircle = (tone: keyof typeof profileIconChipTone = "violet") =>
  cn(
    "solace-icon-chip",
    `solace-icon-chip--${profileIconChipTone[tone]}`,
    "!h-9 !w-9 [&_svg]:!h-4 [&_svg]:!w-4 [&_svg]:shrink-0 [&_svg]:!text-current"
  );

export const profilePill = "profile-ui-pill";

export const profilePillViolet = cn(profilePill, "profile-ui-pill--violet");

export const profilePillEmerald = cn(profilePill, "profile-ui-pill--emerald");

export const profilePillAmber = cn(profilePill, "profile-ui-pill--amber");

export const profilePillRose = cn(profilePill, "profile-ui-pill--rose");

/** Plan badge on hero image (readable on photo scrim in light theme) */
export const profilePillHeroOnMedia = cn(profilePill, "profile-ui-pill--hero-on-media");

export const profileAchievementsLink = cn("profile-ui-btn profile-ui-btn--achievements");

export const profileBtnDanger = cn("profile-ui-btn profile-ui-btn--danger", "disabled:opacity-60");

export const profileBtnRoseGhost = cn("profile-ui-btn profile-ui-btn--rose-ghost");

export const profileBannerBtnAmber = cn(
  "profile-ui-btn profile-ui-btn--banner profile-ui-btn--banner-amber",
  "disabled:opacity-60"
);

export const profileBannerBtnViolet = cn(
  "profile-ui-btn profile-ui-btn--banner profile-ui-btn--banner-violet"
);

export const profileMemberTag = cn("profile-ui-tag profile-ui-tag--member");

export const profileWhyWeAskBtn = cn(profilePill, "profile-ui-pill--rose");

export const profileTrophyIcon = cn("profile-ui-icon profile-ui-icon--amber h-5 w-5");

export const profileMilestoneUnlockedIcon = cn("profile-ui-icon profile-ui-icon--emerald-md h-4 w-4");

export const profileIconVioletSm = cn("profile-ui-icon profile-ui-icon--violet-sm h-3.5 w-3.5");

export const profileIconRoseSm = cn("profile-ui-icon profile-ui-icon--rose-sm h-3.5 w-3.5");

export const profileIconVioletMd = cn("profile-ui-icon profile-ui-icon--violet-md h-4 w-4");

export const profileIconEmeraldMd = cn("profile-ui-icon profile-ui-icon--emerald-md h-4 w-4");

export const profileIconAmberMd = cn("profile-ui-icon profile-ui-icon--amber-md h-4 w-4");

export const profileBtnPrimary = cn(
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white",
  "bg-[linear-gradient(135deg,#7C3AED_0%,#C026D3_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_36px_-6px_rgba(168,85,247,0.55),0_12px_32px_-16px_rgba(0,0,0,0.65)]",
  "transition-all duration-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_44px_-4px_rgba(192,132,252,0.5),0_14px_36px_-14px_rgba(0,0,0,0.7)]",
  "disabled:opacity-60"
);

export const profileBtnGhost = cn(
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold transition-all duration-300",
  "border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)]",
  "text-[rgba(255,255,255,0.88)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  "hover:border-violet-400/25 hover:bg-violet-500/[0.08] hover:shadow-[0_0_24px_-8px_rgba(139,92,246,0.25)]",
  "disabled:opacity-60",
  `${light}:border-[color:var(--button-secondary-border,#d8c7f7)]`,
  `${light}:bg-[var(--button-secondary-bg,#f6f0ff)]`,
  `${light}:text-[color:var(--button-secondary-text,#5b21b6)]`,
  `${light}:hover:border-violet-300/55 ${light}:hover:bg-violet-50`,
  `${lightAlt}:border-[color:var(--button-secondary-border,#d8c7f7)]`,
  `${lightAlt}:bg-[var(--button-secondary-bg,#f6f0ff)]`,
  `${lightAlt}:text-[color:var(--button-secondary-text,#5b21b6)]`
);

/** Hero */
export const profileHeroShell = cn(
  "min-h-[300px] sm:min-h-[340px]",
  "border border-white/[0.05]",
  "shadow-[0_0_48px_rgba(168,85,247,0.08),0_32px_80px_-40px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.09)]",
  "[&>img]:z-0 [&>img]:object-[center_32%] [&>img]:brightness-[0.94] [&>img]:contrast-[1.05] [&>img]:saturate-[1.08]",
  `${light}:border-[color:var(--border)] ${light}:shadow-[var(--solace-card-shadow)]`,
  `${lightAlt}:border-[color:var(--border)] ${lightAlt}:shadow-[var(--solace-card-shadow)]`
);

export const profileHeroName = cn(
  "text-2xl font-semibold tracking-tight text-[rgba(255,255,255,0.96)] [text-shadow:0_0_32px_rgba(167,139,250,0.2)] sm:text-3xl",
  `${light}:text-[var(--text-primary)] ${light}:[text-shadow:none]`,
  `${lightAlt}:text-[var(--text-primary)] ${lightAlt}:[text-shadow:none]`
);

export const profileHeroMeta = cn(
  "text-sm text-[rgba(255,255,255,0.68)]",
  `${light}:text-[var(--text-secondary)]`,
  `${lightAlt}:text-[var(--text-secondary)]`
);

export const profileHeroMetaStrong = cn(
  "font-medium text-[rgba(255,255,255,0.92)]",
  `${light}:text-[var(--text-primary)]`,
  `${lightAlt}:text-[var(--text-primary)]`
);

export const profileHeroBio = cn(
  "max-w-xl text-sm leading-relaxed text-[rgba(255,255,255,0.72)]",
  `${light}:text-[var(--text-secondary)]`,
  `${lightAlt}:text-[var(--text-secondary)]`
);

export const profileHeroToggleLabel = cn(
  "cursor-pointer text-[11px] font-medium text-zinc-300",
  `${light}:text-[var(--text-secondary)]`,
  `${lightAlt}:text-[var(--text-secondary)]`
);

export const profileHeroStatStrip = cn(
  "profile-ui-hero-stat-strip solace-surface-light border-t backdrop-blur-md",
  "border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  `${light}:border-[color:var(--border)]`,
  `${lightAlt}:border-[color:var(--border)]`
);

export const profileHeroStatValue = cn(
  "profile-ui-hero-stat-value text-xl font-bold tabular-nums sm:text-2xl"
);

export const profileHeroStatLabel = cn(
  "profile-ui-hero-stat-label text-[10px] font-semibold uppercase tracking-wider"
);

export const profileHeroStatDivide = cn(
  "grid grid-cols-3 divide-x divide-white/[0.06]",
  `${light}:divide-[color:var(--border)]`,
  `${lightAlt}:divide-[color:var(--border)]`
);

export const profileCameraButton = cn(
  "absolute -bottom-0.5 -right-0.5 flex h-9 w-9 items-center justify-center rounded-full border shadow-lg transition-transform hover:scale-105",
  "border-white/20 bg-zinc-900/90 text-white",
  `${light}:border-[color:var(--border)] ${light}:bg-white ${light}:text-violet-700 ${light}:shadow-[var(--solace-card-shadow)]`,
  `${lightAlt}:border-[color:var(--border)] ${lightAlt}:bg-white ${lightAlt}:text-violet-700`
);

/** Banners */
export const profileVerifyBanner = cn(
  profileCard,
  "border-amber-500/25 bg-amber-950/35",
  `${light}:border-amber-300/55 ${light}:bg-amber-50`,
  `${lightAlt}:border-amber-300/55 ${lightAlt}:bg-amber-50`
);

export const profileTrialBanner = cn(
  profileCard,
  "border-violet-500/25 bg-violet-950/30",
  `${light}:border-violet-300/50 ${light}:bg-violet-50`,
  `${lightAlt}:border-violet-300/50 ${lightAlt}:bg-violet-50`
);

export const profileRightRailGlow = cn(
  "relative shrink-0 overflow-visible xl:self-start",
  "before:pointer-events-none before:absolute before:-inset-px before:rounded-[1.35rem] before:bg-[linear-gradient(180deg,rgba(139,92,246,0.08),transparent_40%,rgba(236,72,153,0.05))] before:opacity-80 before:content-['']",
  `${light}:before:opacity-40`
);

export const profileMilestoneChip = (unlocked: boolean) =>
  cn(
    "profile-ui-milestone",
    unlocked ? "profile-ui-milestone--unlocked" : "profile-ui-milestone--locked"
  );

export const profileSupportTile = cn(
  "group flex min-h-[88px] flex-col justify-between rounded-2xl border p-4 transition-all duration-300",
  "border-white/[0.05] bg-[linear-gradient(160deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.01)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  "hover:border-fuchsia-400/22 hover:bg-fuchsia-500/[0.07] hover:shadow-[0_0_32px_-10px_rgba(236,72,153,0.28)]",
  `${light}:border-[color:var(--border)] ${light}:bg-[var(--card-soft)]`,
  `${light}:hover:border-fuchsia-300/40 ${light}:hover:bg-fuchsia-50/80`,
  `${lightAlt}:border-[color:var(--border)] ${lightAlt}:bg-[var(--card-soft)]`
);

export const profileSupportTitle = cn(
  "text-sm font-semibold text-zinc-100",
  `${light}:text-[var(--text-primary)]`,
  `${lightAlt}:text-[var(--text-primary)]`
);

export const profileEmergencyCard = cn(
  profileCard,
  "relative overflow-hidden border-rose-400/15",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_48px_-12px_rgba(244,63,94,0.15),0_0_40px_rgba(168,85,247,0.05)]",
  `${light}:border-rose-200/60 ${light}:bg-[linear-gradient(135deg,#fff1f2_0%,#fdf4ff_55%,#ffffff_100%)]`,
  `${lightAlt}:border-rose-200/60`
);

export const profileEmergencyBg = cn(
  "pointer-events-none absolute inset-0 h-full w-full object-cover",
  "opacity-[0.18] mix-blend-soft-light saturate-[1.15]",
  `${light}:opacity-[0.08] ${light}:mix-blend-normal`,
  `${lightAlt}:opacity-[0.08]`
);

export const profileEmergencyWarmthAmber = cn(
  "pointer-events-none absolute inset-0",
  "bg-[radial-gradient(ellipse_80%_60%_at_80%_90%,rgba(251,191,36,0.16),transparent_55%)]",
  `${light}:opacity-50`,
  `${lightAlt}:opacity-50`
);

export const profileEmergencyWarmthViolet = cn(
  "pointer-events-none absolute inset-0",
  "bg-[radial-gradient(ellipse_60%_50%_at_20%_20%,rgba(192,132,252,0.12),transparent_50%)]",
  `${light}:opacity-50`,
  `${lightAlt}:opacity-50`
);

/** Form controls */
export const profileFieldRow = (editing: boolean) =>
  cn(
    "flex items-start gap-3 rounded-2xl border px-3.5 py-3 transition-all",
    editing
      ? cn(
          "border-violet-400/30 bg-violet-500/[0.08]",
          `${light}:border-violet-300/50 ${light}:bg-violet-50`,
          `${lightAlt}:border-violet-300/50 ${lightAlt}:bg-violet-50`
        )
      : cn(
          "border-white/[0.06] bg-white/[0.03] hover:border-violet-400/20 hover:bg-violet-500/[0.04]",
          `${light}:border-[color:var(--border)] ${light}:bg-[var(--card-soft)]`,
          `${light}:hover:border-violet-300/40 ${light}:hover:bg-violet-50/80`,
          `${lightAlt}:border-[color:var(--border)] ${lightAlt}:bg-[var(--card-soft)]`
        )
  );

export const profileFieldRowLabel = cn(
  "mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500",
  `${light}:text-[var(--text-muted)]`,
  `${lightAlt}:text-[var(--text-muted)]`
);

export const profileInlineInput = cn(
  "w-full bg-transparent text-sm font-medium text-zinc-100 outline-none placeholder:text-zinc-600",
  `${light}:text-[var(--text-primary)] ${light}:placeholder:text-[var(--input-placeholder)]`,
  `${lightAlt}:text-[var(--text-primary)] ${lightAlt}:placeholder:text-[var(--input-placeholder)]`
);

export const profileInlineButton = cn(
  "flex w-full items-center justify-between bg-transparent text-sm font-medium text-zinc-100 outline-none disabled:opacity-60",
  `${light}:text-[var(--text-primary)]`,
  `${lightAlt}:text-[var(--text-primary)]`
);

export const profileFieldLabel = cn(
  "mb-1 text-[10px] font-semibold uppercase tracking-widest text-[rgba(255,255,255,0.45)]",
  `${light}:text-[var(--text-muted)]`,
  `${lightAlt}:text-[var(--text-muted)]`
);

export const profileInput = cn(
  "w-full rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-300",
  "border-white/[0.08] bg-[rgba(15,18,38,0.92)] text-[rgba(255,255,255,0.95)]",
  "shadow-[inset_0_2px_10px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.04)]",
  "placeholder:text-[rgba(255,255,255,0.28)]",
  "hover:border-violet-400/22 focus:border-violet-400/35 focus:outline-none focus:ring-2 focus:ring-violet-500/22",
  "disabled:opacity-60",
  `${light}:border-[color:var(--input-border)]`,
  `${light}:bg-[var(--input-bg)]`,
  `${light}:text-[var(--input-text)]`,
  `${light}:placeholder:text-[var(--input-placeholder)]`,
  `${light}:shadow-none`,
  `${lightAlt}:border-[color:var(--input-border)]`,
  `${lightAlt}:bg-[var(--input-bg)]`,
  `${lightAlt}:text-[var(--input-text)]`
);

export const profilePhoneButton = cn(
  "h-10 shrink-0 justify-between rounded-xl border-white/[0.08] px-3 sm:w-[120px]",
  "bg-[rgba(15,18,38,0.92)] text-[rgba(255,255,255,0.92)]",
  "shadow-[inset_0_2px_10px_rgba(0,0,0,0.35)]",
  "hover:border-violet-400/25 hover:bg-[rgba(22,18,48,0.95)] hover:text-white",
  `${light}:border-[color:var(--input-border)] ${light}:bg-[var(--input-bg)] ${light}:text-[var(--input-text)]`,
  `${lightAlt}:border-[color:var(--input-border)] ${lightAlt}:bg-[var(--input-bg)]`
);

export const profilePhoneInput = cn(
  "h-10 min-h-[40px] flex-1 rounded-xl border-white/[0.08]",
  "bg-[rgba(15,18,38,0.92)] text-[rgba(255,255,255,0.95)]",
  "shadow-[inset_0_2px_10px_rgba(0,0,0,0.35)]",
  "placeholder:text-[rgba(255,255,255,0.28)]",
  "focus-visible:border-violet-400/35 focus-visible:ring-violet-500/22",
  "!bg-[rgba(15,18,38,0.92)]",
  `${light}:border-[color:var(--input-border)] ${light}:!bg-[var(--input-bg)] ${light}:text-[var(--input-text)]`,
  `${lightAlt}:border-[color:var(--input-border)] ${lightAlt}:!bg-[var(--input-bg)]`
);

export const profileEmergencyLabel = cn(
  "mb-1 text-[10px] font-semibold uppercase tracking-widest text-[rgba(255,255,255,0.52)]",
  `${light}:text-[var(--text-muted)]`,
  `${lightAlt}:text-[var(--text-muted)]`
);

export const profileEmergencyInput = cn(
  "w-full rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-300",
  "border-rose-400/15 bg-[rgba(18,14,32,0.92)] text-[rgba(255,255,255,0.95)]",
  "shadow-[inset_0_2px_10px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.04)]",
  "placeholder:text-[rgba(255,255,255,0.28)]",
  "hover:border-rose-400/22 focus:border-rose-400/30 focus:outline-none focus:ring-2 focus:ring-rose-400/20",
  "disabled:opacity-60",
  `${light}:border-rose-200/70 ${light}:bg-white ${light}:text-[var(--input-text)] ${light}:shadow-none`,
  `${lightAlt}:border-rose-200/70 ${lightAlt}:bg-white`
);

export const profileEmergencyPhoneButton = cn(
  "h-10 shrink-0 justify-between rounded-xl border-rose-400/15 px-3 sm:w-[120px]",
  "bg-[rgba(18,14,32,0.92)] text-[rgba(255,255,255,0.9)]",
  "shadow-[inset_0_2px_10px_rgba(0,0,0,0.38)]",
  "hover:border-rose-400/28 hover:bg-rose-500/[0.08] hover:text-white",
  `${light}:border-rose-200/70 ${light}:bg-white ${light}:text-[var(--input-text)]`,
  `${lightAlt}:border-rose-200/70 ${lightAlt}:bg-white`
);

export const profileEmergencyPhoneInput = cn(
  "h-10 min-h-[40px] flex-1 rounded-xl border-rose-400/15",
  "bg-[rgba(18,14,32,0.92)] text-[rgba(255,255,255,0.95)]",
  "shadow-[inset_0_2px_10px_rgba(0,0,0,0.38)]",
  "placeholder:text-[rgba(255,255,255,0.28)]",
  "focus-visible:border-rose-400/30 focus-visible:ring-rose-400/20",
  "!bg-[rgba(18,14,32,0.92)]",
  `${light}:border-rose-200/70 ${light}:!bg-white ${light}:text-[var(--input-text)]`,
  `${lightAlt}:border-rose-200/70 ${lightAlt}:!bg-white`
);

export const profileFieldValue = cn(
  "text-sm font-medium text-[rgba(255,255,255,0.88)]",
  `${light}:text-[var(--text-primary)]`,
  `${lightAlt}:text-[var(--text-primary)]`
);

export const profileFieldValueEmpty = cn(
  "font-normal text-[rgba(255,255,255,0.45)]",
  `${light}:text-[var(--text-muted)]`,
  `${lightAlt}:text-[var(--text-muted)]`
);

export const profileFormLabel = cn(
  "text-sm font-semibold text-zinc-300",
  `${light}:text-[var(--text-primary)]`,
  `${lightAlt}:text-[var(--text-primary)]`
);

export const profileSectionDivider = cn(
  "border-t border-white/[0.06] pt-4",
  `${light}:border-[color:var(--border)]`,
  `${lightAlt}:border-[color:var(--border)]`
);

export const profileChipSelected = (tone: "emerald" | "amber") =>
  cn(
    "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-all",
    tone === "emerald" ? "profile-ui-chip--selected-emerald" : "profile-ui-chip--selected-amber"
  );

export const profileChipUnselected = cn(
  "rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs font-semibold text-zinc-400 transition-all",
  "hover:border-emerald-400/25",
  `${light}:border-[color:var(--border)] ${light}:bg-[var(--card-soft)] ${light}:text-[var(--text-secondary)]`,
  `${lightAlt}:border-[color:var(--border)] ${lightAlt}:bg-[var(--card-soft)]`
);

export const profileDropdownPopover = cn(
  "solace-profile-dropdown z-[200] overflow-visible rounded-xl border p-1 pb-0 backdrop-blur-xl",
  "border-white/[0.1] bg-[#090b12]/[0.98]",
  "shadow-[0_28px_60px_-12px_rgba(0,0,0,0.9),0_0_40px_rgba(139,92,246,0.12)]",
  `${light}:border-[color:var(--border)] ${light}:bg-[var(--card-solid,#ffffff)]`,
  `${light}:shadow-[0_20px_50px_-12px_rgba(88,28,135,0.14)]`,
  `${lightAlt}:border-[color:var(--border)] ${lightAlt}:bg-[var(--card-solid,#ffffff)]`
);

export const profileDropdownCommand = cn(
  "overflow-visible rounded-lg bg-transparent text-zinc-200",
  `${light}:text-[var(--text-primary)]`,
  `${lightAlt}:text-[var(--text-primary)]`
);

export const profileDropdownCommandInput = cn(
  "h-10 border-0 border-b border-white/10 bg-transparent text-sm text-zinc-100",
  "placeholder:text-zinc-500",
  "[&_[cmdk-input-wrapper]]:rounded-t-lg [&_[cmdk-input-wrapper]]:border-white/10",
  "[&_[cmdk-input-wrapper]_svg]:text-zinc-500",
  "focus-visible:outline-none",
  "[&_[cmdk-input-wrapper]:focus-within]:ring-2 [&_[cmdk-input-wrapper]:focus-within]:ring-violet-500/30",
  `${light}:border-[color:var(--border)] ${light}:text-[var(--text-primary)]`,
  `${light}:placeholder:text-[var(--input-placeholder)]`,
  `${lightAlt}:border-[color:var(--border)]`
);

export const profileDropdownCommandList = "max-h-[min(280px,50vh)]";

export const profileDropdownCommandItem = cn(
  "rounded-lg text-zinc-200",
  "data-[selected=true]:bg-violet-500/20 data-[selected=true]:text-violet-50",
  "aria-selected:bg-violet-500/20 aria-selected:text-violet-50",
  `${light}:text-[var(--text-primary)]`,
  `${light}:data-[selected=true]:bg-violet-100 ${light}:data-[selected=true]:text-violet-900`,
  `${lightAlt}:data-[selected=true]:bg-violet-100`
);

export const profileDropdownCommandEmpty = cn(
  "py-6 text-center text-sm text-zinc-500",
  `${light}:text-[var(--text-muted)]`,
  `${lightAlt}:text-[var(--text-muted)]`
);

export const profileDialogContent = cn(
  "border-white/10 bg-zinc-950 sm:max-w-xl",
  `${light}:border-[color:var(--border)] ${light}:bg-[var(--card-solid,#ffffff)]`,
  `${lightAlt}:border-[color:var(--border)] ${lightAlt}:bg-[var(--card-solid,#ffffff)]`
);

export const profileDialogTitle = cn(
  "text-zinc-50",
  `${light}:text-[var(--text-primary)]`,
  `${lightAlt}:text-[var(--text-primary)]`
);

export const profileDialogDescription = cn(
  "text-zinc-400",
  `${light}:text-[var(--text-secondary)]`,
  `${lightAlt}:text-[var(--text-secondary)]`
);

/**
 * Customer-facing membership label for an internal plan value.
 *
 * PHASE 4: this used to hold its own trial/core/pro -> "Trial plan"/"Core plan"/"Pro plan" table,
 * which is why "Core plan" and "Pro plan" survived the Phase 3 terminology sweep — the sweep
 * looked for phrasings like "Choose Core" and never matched this one. It now delegates to the
 * shared copy module, so there is a single mapping in the frontend.
 *
 * Signature is unchanged so `AccountSettings` and `ProfileSanctuaryLayout` need no edits.
 */
export function formatSubscriptionPlanLabel(plan: string | undefined | null): string {
  const raw = String(plan || "").trim().toLowerCase();
  if (!raw) return MEMBERSHIP_LABELS.membership;

  // Known internal plan values map through the shared copy.
  if (raw === "trial" || raw === "core" || raw === "pro") {
    return MEMBERSHIP_COPY[membershipKeyForPlan(raw)].fullName;
  }

  // Legacy/unknown values are shown as-is rather than guessed at, so a stray value stays visible
  // instead of silently masquerading as a real membership.
  return raw.charAt(0).toUpperCase() + raw.slice(1).replace(/_/g, " ");
}
