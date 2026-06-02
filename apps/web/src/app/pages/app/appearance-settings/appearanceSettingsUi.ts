import { cn } from "@/lib/utils";
import {
  solaceBackLink,
  solaceGlassPanel,
  solaceOptionCard,
  solaceOptionCardSelected,
  solacePageAtmosphere,
  solacePageFogMid,
  solacePageGlowTop,
  solacePageVignette,
  solaceSectionHeading,
  solaceSectionSubtitle,
  solaceSectionTitle,
} from "@/app/solace/solacePageChrome";
import { settingsIconChip } from "@/app/pages/app/settings-hub/settingsIconChip";
import {
  SETTINGS_SUBPAGE_HERO_IMG,
  settingsSubpageHeroAccent,
  settingsSubpageHeroBody,
  settingsSubpageHeroCopy,
  settingsSubpageHeroImage,
  settingsSubpageHeroInnerCompact,
  settingsSubpageHeroLead,
  settingsSubpageHeroLightScrim,
  settingsSubpageHeroOverlayAccent,
  settingsSubpageHeroOverlayBottom,
  settingsSubpageHeroOverlayReadability,
  settingsSubpageHeroShellCompact,
  settingsSubpageHeroTitleSerif,
} from "@/app/pages/app/settings-hub/settingsSubpageHero";
export const APPEARANCE_HERO_IMG = SETTINGS_SUBPAGE_HERO_IMG;
export const APPEARANCE_LOTUS_IMG = "/community/scene-water.jpg";

export const appearancePageAtmosphere = solacePageAtmosphere;
export const appearancePageGlowTop = solacePageGlowTop;
export const appearancePageFogMid = solacePageFogMid;
export const appearancePageVignette = solacePageVignette;

export const appearanceGlassCard = solaceGlassPanel;

export const appearanceRailCard = cn(appearanceGlassCard, "rounded-[1.65rem] p-5 sm:p-6");

export const appearanceHeroCard = settingsSubpageHeroShellCompact;
export const appearanceHeroImage = cn(settingsSubpageHeroImage, "object-[72%_center]");
export const appearanceHeroLightScrim = settingsSubpageHeroLightScrim;
export const appearanceHeroOverlayReadability = settingsSubpageHeroOverlayReadability;
export const appearanceHeroOverlayBottom = settingsSubpageHeroOverlayBottom;
export const appearanceHeroOverlayAccent = settingsSubpageHeroOverlayAccent;
export const appearanceHeroInner = settingsSubpageHeroInnerCompact;
export const appearanceHeroCopy = settingsSubpageHeroCopy;
export const appearanceHeroLead = settingsSubpageHeroLead;
export const appearanceHeroBody = settingsSubpageHeroBody;
export const appearanceHeroOverlayLeft = appearanceHeroOverlayReadability;
export const appearanceHeroOverlayPurple = appearanceHeroOverlayAccent;
export const appearanceHeroOverlayWarmth = appearanceHeroOverlayBottom;

export const appearanceSectionLabel = solaceSectionTitle;
export const appearanceSectionHeading = solaceSectionHeading;
export const appearanceSectionSubtitle = solaceSectionSubtitle;
export const appearanceBackLink = solaceBackLink;

export const appearanceHeroTitle = cn(
  settingsSubpageHeroTitleSerif,
  "text-[clamp(2rem,4vw,2.75rem)]"
);

export const appearanceHeroAccent = cn(
  settingsSubpageHeroAccent,
  "from-rose-200 via-fuchsia-200 to-violet-200",
  "[html[data-ezri-theme=light]_&]:text-fuchsia-700",
  "[html[data-theme=light]_&]:text-fuchsia-700"
);

export const appearancePanel = cn(appearanceGlassCard, "p-5 sm:p-7");
export const appearanceOptionCard = solaceOptionCard;
export const appearanceOptionCardSelected = solaceOptionCardSelected;
export const appearanceIconChip = settingsIconChip;

export const appearancePrefRow = cn(
  "flex flex-col gap-4 rounded-[1.125rem] border border-[color:var(--solace-border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5",
  "bg-[var(--solace-ds-surface)] shadow-[var(--solace-card-shadow)]",
  "transition-all duration-300 hover:border-[color:var(--solace-ds-border-glow)]"
);

export const appearanceBtnGhost = cn(
  "inline-flex min-h-[34px] items-center justify-center rounded-full border border-[color:var(--solace-border)] px-4 py-1.5",
  "bg-[var(--solace-ds-surface)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--solace-text)]",
  "transition-all duration-300 hover:border-[color:var(--solace-ds-border-glow)] hover:bg-[color-mix(in_srgb,var(--accent-secondary,#a78bfa)_8%,var(--solace-ds-surface))]"
);

export const appearanceValuePill = cn(
  "inline-flex rounded-full border border-[color:var(--solace-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--solace-text)]",
  "bg-[var(--solace-ds-surface)]"
);

export const appearanceMiniPreviewCard = cn(
  "flex min-h-[108px] flex-col overflow-hidden rounded-2xl border border-[color:var(--solace-border)]",
  "bg-[var(--solace-ds-surface)] shadow-[var(--solace-card-shadow)]"
);

export const appearanceSettingsPageRoot = "appearance-settings-page";

/** Token-driven appearance chrome (theme via data-ezri-theme on html). */
export function appearanceThemeClasses() {
  return {
    page: cn(appearanceSettingsPageRoot, appearancePageAtmosphere),
    sectionLabel: appearanceSectionLabel,
    sectionHeading: cn(appearanceSectionHeading, "mt-2"),
    sectionSubtitle: appearanceSectionSubtitle,
    panel: appearancePanel,
    optionCard: appearanceOptionCard,
    optionCardSelected: appearanceOptionCardSelected,
    optionTitle: "font-semibold text-[var(--solace-text)]",
    optionDesc: "mt-1 text-xs leading-relaxed text-[var(--solace-muted)]",
    accentLabel: (selected: boolean) =>
      cn(
        "text-[11px] font-medium",
        selected ? "text-[color:var(--accent-secondary,#a78bfa)]" : "text-[var(--solace-muted)]"
      ),
    accentRingOffset: "ring-offset-[var(--solace-bg)]",
    backLink: appearanceBackLink,
    heroTitle: appearanceHeroTitle,
    heroAccent: appearanceHeroAccent,
    heroLead: cn(appearanceHeroLead, "mt-2"),
    heroBody: appearanceHeroBody,
    btnGhost: appearanceBtnGhost,
    miniPreviewCard: appearanceMiniPreviewCard,
    bgStyleCard: cn(
      "relative flex flex-col items-stretch rounded-[1.25rem] border border-[color:var(--solace-border)] p-3 text-left transition-all duration-300",
      "bg-[var(--solace-ds-surface)] hover:border-[color:var(--solace-ds-border-glow)]"
    ),
    bgStyleLabel: "text-center text-sm font-semibold text-[var(--solace-text)]",
  };
}
