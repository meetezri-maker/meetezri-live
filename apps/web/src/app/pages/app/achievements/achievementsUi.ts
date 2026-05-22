import { cn } from "@/lib/utils";
import {
  solaceBtnPrimary,
  solaceCard,
  solaceGlassPanel,
  solaceHeroImage,
  solaceHeroOverlayBottom,
  solaceHeroOverlayReadability,
  solaceHeroSection,
  solacePageAtmosphere,
  solacePageFogMid,
  solacePageGlowTop,
  solacePageVignette,
  solaceSectionTitle,
} from "@/app/solace/solacePageChrome";

export const achievementsPageAtmosphere = solacePageAtmosphere;

export const achievementsPageGlowTop = cn(
  solacePageGlowTop,
  "bg-[radial-gradient(circle,rgba(167,139,250,0.18)_0%,rgba(236,72,153,0.06)_42%,transparent_68%)]"
);

export const achievementsPageFogMid = solacePageFogMid;
export const achievementsPageVignette = solacePageVignette;

export const achievementsCard = solaceCard;
export const achievementsPanel = cn(solaceGlassPanel, "rounded-3xl");
export const achievementsStatStrip = cn(solaceCard, "rounded-2xl p-1 shadow-[var(--solace-card-shadow)]");

export const achievementsHeroSection = cn(
  solaceHeroSection,
  "rounded-3xl shadow-[var(--solace-ds-shadow-cinematic)]"
);

export const achievementsHeroImage = solaceHeroImage;
export const achievementsHeroOverlayReadability = solaceHeroOverlayReadability;
export const achievementsHeroOverlayBottom = solaceHeroOverlayBottom;

export const achievementsLabel = solaceSectionTitle;

export const achievementsTitle = "font-serif font-semibold text-[var(--solace-text)]";
export const achievementsBody = "text-sm text-[var(--solace-muted)]";
export const achievementsValue = "font-serif text-lg text-[var(--solace-text)] sm:text-xl";

export const achievementsGhostButton = cn(
  "inline-flex min-h-[44px] items-center justify-center rounded-full border border-[color:var(--solace-border)]",
  "bg-[color-mix(in_srgb,var(--solace-text)_6%,transparent)] px-5 text-sm font-semibold text-[var(--solace-text)]",
  "transition hover:border-[color:var(--solace-ds-border-glow)] hover:bg-[color-mix(in_srgb,var(--solace-text)_9%,transparent)]"
);

export const achievementsBackLink = cn(
  "inline-flex min-h-[44px] min-w-0 items-center gap-2 text-sm font-medium text-[var(--solace-muted)]",
  "transition-colors hover:text-[var(--solace-text)]"
);

export const achievementsFilterActive = cn(
  "border-[color:var(--solace-ds-border-glow)] bg-[color-mix(in_srgb,var(--accent-secondary,#a78bfa)_14%,var(--solace-ds-surface))]",
  "text-[var(--solace-text)] shadow-[0_0_20px_-8px_rgba(167,139,250,0.35)]"
);

export const achievementsFilterInactive = cn(
  "border-[color:var(--solace-border)] bg-[var(--solace-ds-surface)] text-[var(--solace-muted)]",
  "hover:border-[color:var(--solace-ds-border-glow)] hover:bg-[color-mix(in_srgb,var(--accent-secondary,#a78bfa)_6%,var(--solace-ds-surface))] hover:text-[var(--solace-text)]"
);

export const achievementsFeaturedBanner = cn(
  achievementsCard,
  "bg-[linear-gradient(120deg,color-mix(in_srgb,var(--accent-warm,#fbbf24)_10%,var(--solace-ds-surface)),color-mix(in_srgb,var(--accent-secondary,#a78bfa)_12%,var(--solace-ds-surface)),var(--solace-ds-surface))]"
);

export const achievementsJourneySection = cn(
  achievementsCard,
  "rounded-3xl p-6 sm:p-8"
);

export const achievementsTrophyCard = cn(
  achievementsCard,
  "flex min-h-[280px] flex-col overflow-hidden text-center transition"
);

export const achievementsTrophyCardLocked = "border-[color:var(--solace-border)] opacity-75 saturate-[0.85]";

export const achievementsTrophyCardUnlocked = cn(
  "border-[color:var(--solace-ds-border-glow)]",
  "bg-[color-mix(in_srgb,var(--accent-secondary,#a78bfa)_8%,var(--solace-ds-surface))]"
);

export const achievementsEmblemUnlocked = cn(
  "border-[color:var(--solace-border)] bg-[color-mix(in_srgb,var(--solace-text)_8%,var(--solace-ds-surface))]",
  "shadow-[var(--solace-card-shadow)]"
);

export const achievementsEmblemLocked = cn(
  "border-[color:var(--solace-border)] bg-[color-mix(in_srgb,var(--solace-text)_4%,transparent)] opacity-75"
);

export const achievementsInputSurface = cn(
  "w-full rounded-2xl border border-[color:var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--solace-text)]",
  "placeholder:text-[var(--solace-muted)]"
);

export const achievementsPrimaryGradientBtn = solaceBtnPrimary;
