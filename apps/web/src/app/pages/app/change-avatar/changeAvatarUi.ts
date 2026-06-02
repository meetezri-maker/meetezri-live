import { cn } from "@/lib/utils";
import {
  settingsCard,
  settingsIconChip,
  settingsPageAtmosphere,
  settingsPageFogMid,
  settingsPageGlowTop,
  settingsPageVignette,
  settingsSectionTitle,
} from "@/app/pages/app/settings-hub/settingsUi";
import {
  SETTINGS_SUBPAGE_HERO_IMG,
  settingsSubpageHeroBackLink,
  settingsSubpageHeroImage,
  settingsSubpageHeroLightScrim,
  settingsSubpageHeroOverlayAccent,
  settingsSubpageHeroOverlayBottom,
  settingsSubpageHeroOverlayReadability,
  settingsSubpageHeroShell,
  settingsSubpageHeroTitleSerif,
} from "@/app/pages/app/settings-hub/settingsSubpageHero";

const light = "[html[data-ezri-theme=light]_&]";
const lightAlt = "[html[data-theme=light]_&]";

export const CHANGE_AVATAR_HERO_IMG = SETTINGS_SUBPAGE_HERO_IMG;

export const changeAvatarPageAtmosphere = cn(settingsPageAtmosphere, "change-avatar-page");

export const changeAvatarPageGlowTop = settingsPageGlowTop;
export const changeAvatarPageFogMid = settingsPageFogMid;
export const changeAvatarPageVignette = settingsPageVignette;

export const changeAvatarGlassCard = cn(
  settingsCard,
  "rounded-[1.5rem]",
  `${light}:shadow-[var(--solace-card-shadow)]`,
  `${lightAlt}:shadow-[var(--solace-card-shadow)]`
);

export const changeAvatarRailCard = cn(changeAvatarGlassCard, "rounded-[1.5rem] p-5 sm:p-6");

export const changeAvatarHeroCard = cn(
  settingsSubpageHeroShell,
  "change-avatar-hero-card min-h-[220px] sm:min-h-[235px] lg:min-h-[250px]"
);

export const changeAvatarHeroImage = cn(settingsSubpageHeroImage, "object-[72%_center]");
export const changeAvatarHeroLightScrim = settingsSubpageHeroLightScrim;
export const changeAvatarHeroOverlayReadability = settingsSubpageHeroOverlayReadability;
export const changeAvatarHeroOverlayBottom = settingsSubpageHeroOverlayBottom;
export const changeAvatarHeroOverlayAccent = settingsSubpageHeroOverlayAccent;
export const changeAvatarHeroOverlayLeft = changeAvatarHeroOverlayReadability;
export const changeAvatarHeroOverlayPurple = changeAvatarHeroOverlayAccent;
export const changeAvatarHeroOverlayWarmth = changeAvatarHeroOverlayBottom;

export const changeAvatarBackLink = settingsSubpageHeroBackLink;

export const changeAvatarPageTitle = cn(
  settingsSubpageHeroTitleSerif,
  "text-[clamp(1.85rem,3.5vw,2.5rem)]"
);

export const changeAvatarPageSubtitle = "change-avatar-page-subtitle mt-2 text-sm sm:text-[15px]";

export const changeAvatarSectionLabel = settingsSectionTitle;

export const changeAvatarSectionHeading = cn(
  "font-serif text-[1.35rem] font-light tracking-tight sm:text-[1.45rem]",
  "text-white",
  `${light}:text-[var(--text-primary)]`,
  `${lightAlt}:text-[var(--text-primary)]`
);

export const changeAvatarSectionSubtitle =
  "change-avatar-section-subtitle mt-1 text-sm";

export const changeAvatarHeroEyebrow = "change-avatar-hero-eyebrow text-xs font-semibold uppercase tracking-[0.18em]";

export const changeAvatarHeroName = "change-avatar-hero-name text-xl font-semibold sm:text-2xl";

export const changeAvatarHeroMeta = "change-avatar-hero-meta mt-1 text-sm";

export const changeAvatarHeroDesc = "change-avatar-hero-desc mt-2 max-w-lg text-sm leading-relaxed";

export const changeAvatarHeroStats = "change-avatar-hero-stats mt-3 flex flex-wrap items-center gap-4 text-xs";

export const changeAvatarCompanionCard = cn(
  "change-avatar-companion-card relative w-full overflow-hidden rounded-[1.625rem] border text-left transition-all duration-300",
  "bg-[linear-gradient(160deg,rgba(18,18,42,0.92)_0%,rgba(10,10,26,0.96)_55%,rgba(139,92,246,0.04)_100%)]",
  "border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  "hover:border-violet-400/22 hover:shadow-[0_0_32px_-12px_rgba(139,92,246,0.22)]"
);

export const changeAvatarCompanionCardSelected = cn(
  "change-avatar-companion-card--selected",
  "border-fuchsia-400/42 bg-[linear-gradient(160deg,rgba(139,92,246,0.16)_0%,rgba(236,72,153,0.07)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_36px_-10px_rgba(192,132,252,0.32)]"
);

export const changeAvatarCompanionCardCurrent = cn(
  "change-avatar-companion-card--current",
  "border-emerald-400/28 bg-[linear-gradient(160deg,rgba(16,185,129,0.08)_0%,rgba(10,10,26,0.96)_100%)]",
  "cursor-not-allowed opacity-90 hover:border-emerald-400/32"
);

export const changeAvatarCompanionName = "change-avatar-companion-name text-lg font-semibold";

export const changeAvatarCompanionMuted = "change-avatar-companion-muted mt-0.5 text-sm";

export const changeAvatarCompanionLabel =
  "change-avatar-companion-muted text-[11px] font-semibold uppercase tracking-[0.14em]";

export const changeAvatarCompanionBody = "change-avatar-companion-body mt-1 text-sm";

export const changeAvatarCompanionDivider = "change-avatar-companion-divider mt-4 border-t border-white/[0.06] pt-3";

export const changeAvatarTagPill = cn(
  "inline-flex rounded-full border border-violet-400/18 bg-violet-500/[0.12] px-2.5 py-0.5",
  "text-[11px] font-medium text-violet-100/90",
  `${light}:border-violet-300/50 ${light}:bg-violet-50 ${light}:text-violet-800`,
  `${lightAlt}:border-violet-300/50 ${lightAlt}:bg-violet-50 ${lightAlt}:text-violet-800`
);

export const changeAvatarPreviewBtn = cn(
  "change-avatar-preview-btn inline-flex min-h-[38px] shrink-0 items-center justify-center gap-2 rounded-full border border-violet-400/28 px-4 py-2",
  "bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_100%)]",
  "text-xs font-semibold text-[rgba(255,255,255,0.9)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_24px_-8px_rgba(139,92,246,0.35)]",
  "transition-all duration-300 hover:border-fuchsia-300/40 hover:shadow-[0_0_28px_-6px_rgba(192,132,252,0.45)]"
);

export const changeAvatarSwitchCta = cn(
  "mx-auto inline-flex min-h-[52px] w-full max-w-md items-center justify-center gap-2 rounded-full px-8 py-3.5",
  "text-sm font-semibold text-white",
  "bg-[linear-gradient(135deg,#7C3AED_0%,#C026D3_55%,#DB2777_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_40px_-8px_rgba(168,85,247,0.5),0_16px_40px_-18px_rgba(0,0,0,0.7)]",
  "transition-all duration-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_0_48px_-6px_rgba(192,132,252,0.55),0_18px_44px_-16px_rgba(0,0,0,0.75)]"
);

export const changeAvatarHistoryCard = cn(changeAvatarGlassCard, "rounded-[1.25rem] px-4 py-3.5 sm:px-5");

export const changeAvatarManageBtn = cn(
  "mt-4 inline-flex min-h-[40px] w-full items-center justify-center rounded-full border border-violet-400/22 px-4 py-2",
  "bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)]",
  "text-xs font-semibold text-[rgba(255,255,255,0.88)]",
  "transition-all duration-300 hover:border-violet-300/35 hover:bg-violet-500/[0.1]",
  `${light}:border-[color:var(--border)] ${light}:bg-white ${light}:text-[var(--text-primary)]`,
  `${lightAlt}:border-[color:var(--border)] ${lightAlt}:bg-white ${lightAlt}:text-[var(--text-primary)]`
);

export const changeAvatarIconChip = settingsIconChip;

export const changeAvatarRailRow = cn(
  "change-avatar-rail-row flex gap-3.5 rounded-[1.125rem] border border-white/[0.05] px-3.5 py-3.5",
  "bg-[linear-gradient(160deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.01)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
);
