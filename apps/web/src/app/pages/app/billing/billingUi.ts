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

export const billingPageAtmosphere = solacePageAtmosphere;

export const billingPageGlowTop = cn(
  solacePageGlowTop,
  "bg-[radial-gradient(circle,rgba(167,139,250,0.2)_0%,rgba(78,205,196,0.08)_42%,transparent_68%)]"
);

export const billingPageFogMid = solacePageFogMid;
export const billingPageVignette = solacePageVignette;

export const billingPanel = cn(solaceGlassPanel, "rounded-3xl");
export const billingCard = solaceCard;

export const billingHeroSection = cn(
  solaceHeroSection,
  "rounded-3xl shadow-[var(--solace-ds-shadow-cinematic)]"
);

export const billingHeroImage = solaceHeroImage;
export const billingHeroOverlayReadability = solaceHeroOverlayReadability;
export const billingHeroOverlayBottom = solaceHeroOverlayBottom;

export const billingHeroScrimDark =
  "bg-gradient-to-r from-[color-mix(in_srgb,var(--solace-bg)_97%,transparent)] via-[color-mix(in_srgb,var(--solace-bg)_88%,transparent)] to-[color-mix(in_srgb,var(--solace-bg)_45%,transparent)] lg:via-[color-mix(in_srgb,var(--solace-bg)_65%,transparent)] lg:to-[color-mix(in_srgb,var(--solace-bg)_25%,transparent)]";

export const billingHeroScrimBottom =
  "bg-gradient-to-t from-[color-mix(in_srgb,var(--solace-bg)_92%,transparent)] via-transparent to-violet-950/15 [html[data-ezri-theme=light]_&]:to-violet-200/20";

export const billingLabel = solaceSectionTitle;

export const billingTitle = "font-serif font-light tracking-tight text-[var(--solace-text)]";
export const billingBody = "text-sm text-[var(--solace-muted)]";
export const billingValue = "font-medium text-[var(--solace-text)]";

export const billingGhostButton = cn(
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-[color:var(--solace-border)]",
  "bg-[color-mix(in_srgb,var(--solace-text)_6%,transparent)] px-5 text-sm text-[var(--solace-text)]",
  "transition hover:border-[color:var(--solace-ds-border-glow)] hover:bg-[color-mix(in_srgb,var(--solace-text)_9%,transparent)]"
);

export const billingChip = cn(
  billingCard,
  "rounded-2xl px-3 py-3 backdrop-blur-md sm:py-3.5"
);

export const billingPlanCard = cn(
  billingCard,
  "relative flex flex-col overflow-hidden rounded-3xl p-6 sm:p-7"
);

export const billingPlanCardCurrent = cn(
  "border-[color:var(--solace-ds-border-glow)] shadow-[0_0_40px_rgba(167,139,250,0.16)]"
);

export const billingPlanCardDefault = "border-[color:var(--solace-border)]";

export const billingPaygCapsule = cn(
  billingCard,
  "min-h-[44px] rounded-2xl px-4 py-3 text-left transition",
  "hover:border-[color:var(--solace-ds-border-glow)] hover:bg-[color-mix(in_srgb,var(--accent-secondary,#a78bfa)_6%,var(--solace-ds-surface))]"
);

export const billingModalPanel = cn(billingCard, "w-full max-w-md overflow-hidden rounded-3xl p-7 shadow-2xl");

export const billingDialogContent = cn(
  billingCard,
  "text-[var(--solace-text)] sm:max-w-md"
);

export const billingLoadingShell = cn(billingPageAtmosphere, "min-h-[50vh] px-4 py-12");
