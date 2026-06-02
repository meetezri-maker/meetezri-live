import { cn } from "@/lib/utils";
import { MOOD_CHECKIN_IMAGES } from "@/lib/solace/moodCheckInImages";
import { SOLACE_SUPPORT_CARD_IMG } from "@/lib/solace/referenceImagery";
import { accountBtnPrimary } from "@/app/pages/app/account-settings/accountSettingsUi";
import {
  solaceCard,
  solaceCompactToolCard,
  solaceHeroContent,
  solaceHeroImage,
  solaceHeroLightScrim,
  solaceHeroMediaShell,
  solaceHeroOverlayAccent,
  solaceHeroOverlayBottom,
  solaceHeroOverlayReadability,
  solaceHeroSection,
  solacePageAtmosphere,
  solacePageFogMid,
  solacePageGlowTop,
  solacePageVignette,
  solaceQuickCard,
  solaceRowLink,
  solaceSectionTitle,
} from "@/app/solace/solacePageChrome";

export { settingsIconChip } from "./settingsIconChip";

/** Hero — shared mood-check-in banner (community/hero-lake.jpg is not in public assets) */
export const SETTINGS_HERO_IMG = MOOD_CHECKIN_IMAGES.heroBanner;
export const SETTINGS_HELP_IMG = SOLACE_SUPPORT_CARD_IMG;

export const settingsPageAtmosphere = cn(solacePageAtmosphere, "settings-hub-page");
export const settingsPageGlowTop = solacePageGlowTop;
export const settingsPageFogMid = solacePageFogMid;
export const settingsPageVignette = solacePageVignette;
export const settingsCard = solaceCard;
export const settingsHeroSection = cn(
  solaceHeroSection,
  "min-h-[320px]",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-theme=light]_&]:border-[color:var(--border)]"
);

export const settingsHeroShell = cn(solaceHeroMediaShell, settingsHeroSection);
export const settingsHeroImage = solaceHeroImage;
export const settingsHeroLightScrim = solaceHeroLightScrim;
export const settingsHeroContent = solaceHeroContent;
export const settingsHeroOverlayReadability = solaceHeroOverlayReadability;
export const settingsHeroOverlayBottom = solaceHeroOverlayBottom;
export const settingsHeroOverlayAccent = solaceHeroOverlayAccent;

export const settingsHeroBackLink = cn(
  "inline-flex min-h-[44px] items-center gap-2 text-sm transition-colors",
  "text-[rgba(255,255,255,0.62)] hover:text-white",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-secondary)] [html[data-ezri-theme=light]_&]:hover:text-[var(--text-primary)]",
  "[html[data-theme=light]_&]:text-[var(--text-secondary)] [html[data-theme=light]_&]:hover:text-[var(--text-primary)]"
);

export const settingsHeroTitle = cn(
  "text-3xl font-bold tracking-tight text-white sm:text-4xl",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary)] [html[data-ezri-theme=light]_&]:[text-shadow:none]",
  "[html[data-theme=light]_&]:text-[var(--text-primary)] [html[data-theme=light]_&]:[text-shadow:none]"
);

export const settingsHeroSubtitle = cn(
  "mt-2 text-sm sm:text-base",
  "text-[rgba(255,255,255,0.65)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-secondary)]",
  "[html[data-theme=light]_&]:text-[var(--text-secondary)]"
);

export const settingsHeroQuickLabel = cn(
  "mb-3 text-xs font-semibold uppercase tracking-[0.2em]",
  "text-[rgba(255,255,255,0.5)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-muted)]",
  "[html[data-theme=light]_&]:text-[var(--text-muted)]"
);
export const settingsSectionTitle = solaceSectionTitle;
export const settingsRowLink = solaceRowLink;
export const settingsBtnPrimary = accountBtnPrimary;
export const settingsQuickCard = cn(solaceQuickCard, "settings-quick-card");

export const settingsQuickCardLabel = cn(
  "settings-quick-card-label text-xs font-medium",
  "text-[rgba(255,255,255,0.88)]",
  "[html[data-ezri-theme=light]_&]:!text-[var(--text-primary,#101828)]",
  "[html[data-theme=light]_&]:!text-[var(--text-primary,#101828)]"
);

export const settingsQuickCardStatus = (enabled: boolean) =>
  cn(
    "settings-quick-card-status text-[11px] font-semibold",
    enabled
      ? cn(
          "text-violet-200",
          "[html[data-ezri-theme=light]_&]:!text-[#5b21b6]",
          "[html[data-theme=light]_&]:!text-[#5b21b6]"
        )
      : cn(
          "text-[rgba(255,255,255,0.4)]",
          "[html[data-ezri-theme=light]_&]:!text-[var(--text-muted,#667085)]",
          "[html[data-theme=light]_&]:!text-[var(--text-muted,#667085)]"
        )
  );

export const settingsCompactToolCard = solaceCompactToolCard;
