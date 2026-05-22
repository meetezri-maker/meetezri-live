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

export const APPEARANCE_HERO_IMG = "/community/hero-lake.jpg";
export const APPEARANCE_LOTUS_IMG = "/community/scene-water.jpg";

export const appearancePageAtmosphere = solacePageAtmosphere;
export const appearancePageGlowTop = solacePageGlowTop;
export const appearancePageFogMid = solacePageFogMid;
export const appearancePageVignette = solacePageVignette;

export const appearanceGlassCard = solaceGlassPanel;

export const appearanceRailCard = cn(appearanceGlassCard, "rounded-[1.65rem] p-5 sm:p-6");

export const appearanceHeroCard = cn(
  appearanceGlassCard,
  "relative min-h-[220px] overflow-hidden rounded-[2rem] sm:min-h-[240px] lg:min-h-[250px]"
);

export const appearanceHeroImage = cn(
  "absolute inset-0 h-full w-full object-cover object-[72%_center]",
  "brightness-[0.5] contrast-[0.96] saturate-[1.14]",
  "[html[data-ezri-theme=light]_&]:brightness-[0.88]"
);

export const appearanceHeroOverlayLeft = cn(
  "absolute inset-0",
  "bg-gradient-to-r from-[#0a0b18] via-[#0a0b18]/82 to-[#0a0b18]/15 lg:from-[#0a0b18]/95 lg:via-[#0a0b18]/62 lg:to-transparent",
  "[html[data-ezri-theme=light]_&]:from-white/90 [html[data-ezri-theme=light]_&]:via-white/55 [html[data-ezri-theme=light]_&]:to-transparent"
);

export const appearanceHeroOverlayPurple = cn(
  "absolute inset-0",
  "bg-[radial-gradient(ellipse_75%_85%_at_78%_42%,rgba(192,132,252,0.24)_0%,transparent_58%)]",
  "[html[data-ezri-theme=light]_&]:bg-[radial-gradient(ellipse_75%_85%_at_78%_42%,rgba(167,139,250,0.14)_0%,transparent_58%)]"
);

export const appearanceHeroOverlayWarmth = cn(
  "absolute inset-0",
  "bg-[radial-gradient(ellipse_38%_32%_at_78%_68%,rgba(251,146,60,0.18)_0%,transparent_55%)]",
  "[html[data-ezri-theme=light]_&]:opacity-70"
);

export const appearanceSectionLabel = solaceSectionTitle;
export const appearanceSectionHeading = solaceSectionHeading;
export const appearanceSectionSubtitle = solaceSectionSubtitle;
export const appearanceBackLink = solaceBackLink;

export const appearanceHeroTitle = cn(
  "font-serif text-[clamp(2rem,4vw,2.75rem)] font-light leading-[1.06] tracking-tight text-[var(--solace-text)]"
);

export const appearanceHeroAccent = cn(
  "bg-gradient-to-r from-rose-200 via-fuchsia-200 to-violet-200 bg-clip-text text-transparent",
  "drop-shadow-[0_0_28px_rgba(236,72,153,0.4)]",
  "[html[data-ezri-theme=light]_&]:from-violet-600 [html[data-ezri-theme=light]_&]:via-fuchsia-600 [html[data-ezri-theme=light]_&]:to-violet-700"
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
    heroLead: "mt-2 text-sm text-[var(--solace-muted)] sm:text-[15px]",
    heroBody: "mt-3 max-w-lg text-xs leading-relaxed text-[var(--solace-muted)] sm:text-sm",
    btnGhost: appearanceBtnGhost,
    miniPreviewCard: appearanceMiniPreviewCard,
    bgStyleCard: cn(
      "relative flex flex-col items-stretch rounded-[1.25rem] border border-[color:var(--solace-border)] p-3 text-left transition-all duration-300",
      "bg-[var(--solace-ds-surface)] hover:border-[color:var(--solace-ds-border-glow)]"
    ),
    bgStyleLabel: "text-center text-sm font-semibold text-[var(--solace-text)]",
  };
}
