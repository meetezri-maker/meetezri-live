import { cn } from "@/lib/utils";
import {
  settingsIconChip,
  settingsPageAtmosphere,
  settingsPageFogMid,
  settingsPageGlowTop,
  settingsPageVignette,
  settingsCard,
} from "@/app/pages/app/settings-hub/settingsUi";
import {
  SETTINGS_SUBPAGE_HERO_IMG,
  settingsSubpageHeroAccent,
  settingsSubpageHeroBackLink,
  settingsSubpageHeroBody,
  settingsSubpageHeroCopy,
  settingsSubpageHeroImage,
  settingsSubpageHeroInner,
  settingsSubpageHeroLead,
  settingsSubpageHeroLightScrim,
  settingsSubpageHeroOverlayAccent,
  settingsSubpageHeroOverlayBottom,
  settingsSubpageHeroOverlayReadability,
  settingsSubpageHeroShell,
  settingsSubpageHeroTitleSerif,
} from "@/app/pages/app/settings-hub/settingsSubpageHero";

export const WELLNESS_PLAN_HERO_IMG = SETTINGS_SUBPAGE_HERO_IMG;
export const WELLNESS_PLAN_BANNER_IMG = SETTINGS_SUBPAGE_HERO_IMG;

export const wellnessPlanPageAtmosphere = cn(settingsPageAtmosphere, "wellness-plan-page");

export const wellnessPlanPageGlowTop = settingsPageGlowTop;
export const wellnessPlanPageFogMid = settingsPageFogMid;
export const wellnessPlanPageVignette = settingsPageVignette;

export const wellnessPlanGlassCard = cn(
  settingsCard,
  "rounded-3xl border-white/[0.06]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_48px_-16px_rgba(139,92,246,0.12),0_28px_72px_-40px_rgba(0,0,0,0.75)]"
);

export const wellnessPlanRailCard = cn(
  wellnessPlanGlassCard,
  "rounded-[1.75rem] p-5 sm:p-6",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_40px_-14px_rgba(139,92,246,0.16),0_24px_64px_-36px_rgba(0,0,0,0.72)]"
);

export const wellnessPlanHeroCard = cn(
  settingsSubpageHeroShell,
  "wellness-plan-hero-card border-rose-400/20"
);
export const wellnessPlanHeroImage = cn(settingsSubpageHeroImage, "object-[72%_38%]");
export const wellnessPlanHeroLightScrim = settingsSubpageHeroLightScrim;
export const wellnessPlanHeroOverlayReadability = settingsSubpageHeroOverlayReadability;
export const wellnessPlanHeroOverlayBottom = settingsSubpageHeroOverlayBottom;
export const wellnessPlanHeroOverlayAccent = settingsSubpageHeroOverlayAccent;
export const wellnessPlanHeroInner = settingsSubpageHeroInner;
export const wellnessPlanHeroCopy = settingsSubpageHeroCopy;
export const wellnessPlanHeroBody = settingsSubpageHeroBody;
export const wellnessPlanHeroOverlayLeft = wellnessPlanHeroOverlayReadability;
export const wellnessPlanHeroOverlayPurple = wellnessPlanHeroOverlayAccent;
export const wellnessPlanHeroOverlayWarmth = wellnessPlanHeroOverlayBottom;

export const wellnessPlanIconChip = settingsIconChip;

export const wellnessPlanBackLink = cn(
  settingsSubpageHeroBackLink,
  "text-rose-300/55 hover:text-rose-200/95",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-secondary)]",
  "[html[data-theme=light]_&]:text-[var(--text-secondary)]"
);

export const wellnessPlanHeroTitle = settingsSubpageHeroTitleSerif;
export const wellnessPlanHeroAccent = settingsSubpageHeroAccent;

export const wellnessPlanHeroLead = cn(
  settingsSubpageHeroLead,
  "text-rose-200/80",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-secondary)]",
  "[html[data-theme=light]_&]:text-[var(--text-secondary)]"
);

export const wellnessPlanHandwritten = cn(
  "wellness-plan-handwritten font-serif text-lg italic",
  "drop-shadow-[0_0_20px_rgba(244,63,94,0.25)]"
);

export const wellnessPlanBottomBanner = cn(
  "wellness-plan-bottom-banner relative min-h-[140px] overflow-hidden rounded-3xl border border-rose-400/12",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_48px_-16px_rgba(139,92,246,0.18)]"
);

export const wellnessPlanBottomBannerImg = cn(
  "wellness-plan-bottom-banner-img pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-[20%_50%] brightness-[0.38]"
);

export const wellnessPlanBottomBannerOverlayDark = cn(
  "wellness-plan-bottom-overlays-dark pointer-events-none absolute inset-0 z-[1]",
  "bg-gradient-to-r from-[#0a0b18]/95 via-[#0a0b18]/72 to-[#0a0b18]/45"
);

export const wellnessPlanBottomBannerOverlayWarm = cn(
  "wellness-plan-bottom-overlays-dark pointer-events-none absolute inset-0 z-[1]",
  "bg-[radial-gradient(ellipse_50%_80%_at_12%_50%,rgba(251,146,60,0.18)_0%,transparent_55%)]"
);

export const wellnessPlanBottomBannerContent = cn(
  "wellness-plan-bottom-banner-content relative z-10 flex min-h-[140px] flex-col items-start justify-center gap-3 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
);

export const wellnessPlanBottomBannerTitle =
  "wellness-plan-bottom-banner-title font-serif text-xl font-light sm:text-2xl";

export const wellnessPlanBottomBannerBody = "wellness-plan-bottom-banner-body mt-2 max-w-lg text-sm";

export const wellnessPlanBottomBannerTagline = cn(
  "wellness-plan-bottom-banner-tagline font-serif text-lg italic shrink-0 sm:text-right"
);

/** Safety insights — “Helpful Resources” strip (reuses bottom-banner light theme CSS) */
export const safetyInsightsResourcesBanner = cn(
  wellnessPlanBottomBanner,
  "safety-insights-resources-banner rounded-[1.75rem] border-fuchsia-400/20"
);

export const safetyInsightsResourcesBannerOverlayDark = cn(
  "wellness-plan-bottom-overlays-dark pointer-events-none absolute inset-0 z-[1]",
  "bg-gradient-to-r from-[#3b0a28]/95 via-[#2a0a24]/80 to-[#1a0a20]/70"
);

export const safetyInsightsResourcesBannerOverlayAccent = cn(
  "wellness-plan-bottom-overlays-dark pointer-events-none absolute inset-0 z-[1]",
  "bg-[radial-gradient(ellipse_60%_80%_at_0%_50%,rgba(255,79,163,0.25)_0%,transparent_60%)]"
);

export const safetyInsightsEmergencyCta = cn(
  "safety-insights-emergency-cta inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-full px-6 py-3",
  "bg-white text-sm font-semibold text-fuchsia-900",
  "shadow-[0_0_32px_-6px_rgba(255,255,255,0.35)] transition hover:bg-white/95",
  "[html[data-ezri-theme=light]_&]:border [html[data-ezri-theme=light]_&]:border-fuchsia-200/60",
  "[html[data-ezri-theme=light]_&]:shadow-[0_8px_24px_-8px_rgba(236,72,153,0.2)]",
  "[html[data-theme=light]_&]:border [html[data-theme=light]_&]:border-fuchsia-200/60"
);

export const safetyInsightsPageAtmosphere = cn(wellnessPlanPageAtmosphere, "safety-insights-page");

export const wellnessPlanSectionCard = (accent: "rose" | "pink" | "magenta" | "violet" | "amber") =>
  cn(
    wellnessPlanGlassCard,
    "overflow-hidden rounded-3xl p-0",
    {
      rose: "border-rose-400/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_40px_-18px_rgba(244,63,94,0.18)]",
      pink: "border-fuchsia-400/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_40px_-18px_rgba(236,72,153,0.16)]",
      magenta:
        "border-fuchsia-500/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_40px_-18px_rgba(217,70,239,0.16)]",
      violet:
        "border-violet-400/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_40px_-18px_rgba(139,92,246,0.16)]",
      amber:
        "border-amber-400/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_40px_-18px_rgba(251,191,36,0.14)]",
    }[accent]
  );

export const wellnessPlanSectionChip = (accent: "rose" | "pink" | "magenta" | "violet" | "amber") => {
  const toneMap = {
    rose: "rose" as const,
    pink: "pink" as const,
    magenta: "pink" as const,
    violet: "violet" as const,
    amber: "amber" as const,
  };
  return wellnessPlanIconChip(toneMap[accent]);
};

export const wellnessPlanAddZone = cn(
  "mx-5 mb-5 flex min-h-[52px] w-[calc(100%-2.5rem)] items-center justify-center gap-2 rounded-2xl",
  "border border-dashed border-white/[0.12] bg-white/[0.02]",
  "text-sm font-medium text-[rgba(255,255,255,0.45)]",
  "transition-all duration-300",
  "hover:border-rose-400/30 hover:bg-rose-500/[0.06] hover:text-rose-200/80 hover:shadow-[0_0_28px_-12px_rgba(244,63,94,0.28)]"
);

export const wellnessPlanItemRow = cn(
  "group flex items-start justify-between gap-3 rounded-2xl border border-white/[0.06]",
  "bg-[linear-gradient(160deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.01)_100%)] px-4 py-3",
  "transition-colors hover:border-white/[0.1] hover:bg-white/[0.04]"
);

export const wellnessPlanResourcesCard = cn(
  wellnessPlanGlassCard,
  "rounded-[1.625rem] border-rose-500/16 p-5 sm:p-6",
  "bg-[linear-gradient(165deg,rgba(40,12,32,0.72)_0%,rgba(18,10,28,0.92)_55%,rgba(12,10,24,0.98)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_48px_-14px_rgba(190,24,93,0.22)]"
);

export const wellnessPlanResourceTile = cn(
  "flex min-h-[72px] items-center gap-3 rounded-[1.125rem] border border-rose-400/14",
  "bg-[linear-gradient(160deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] px-4 py-3",
  "transition-all duration-300 hover:border-rose-300/28 hover:bg-rose-500/[0.08]",
  "hover:shadow-[0_0_28px_-12px_rgba(244,63,94,0.28)]"
);

export const wellnessPlanBtnGhost = cn(
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/[0.1] px-5 py-2.5",
  "bg-[linear-gradient(180deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.02)_100%)]",
  "text-sm font-semibold text-[rgba(255,255,255,0.9)]",
  "transition-all duration-300 hover:border-violet-300/28 hover:bg-violet-500/[0.1]"
);

export const wellnessPlanBtnRose = cn(
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white",
  "bg-[linear-gradient(135deg,#e11d48_0%,#db2777_55%,#c026d3_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_36px_-6px_rgba(244,63,94,0.55)]",
  "transition-all duration-300 hover:brightness-110"
);

export const wellnessPlanRailActionRow = cn(
  "flex min-h-[48px] w-full items-center gap-3 rounded-2xl border border-white/[0.06]",
  "bg-[linear-gradient(160deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.01)_100%)] px-4 py-3",
  "text-left text-sm font-medium text-[rgba(255,255,255,0.82)]",
  "transition-all duration-300 hover:border-violet-400/22 hover:bg-violet-500/[0.07]"
);
