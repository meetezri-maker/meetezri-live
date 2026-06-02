import { cn } from "@/lib/utils";
import { solaceInputSurface } from "@/app/solace/solacePageChrome";
import {
  solaceCinematicBanner,
  solaceCinematicBannerBody,
  solaceCinematicBannerContent,
  solaceCinematicBannerLink,
  solaceCinematicBannerOverlay,
  solaceCinematicBannerTitle,
  solaceHeroImage,
} from "@/app/solace/solacePageChrome";
import {
  settingsCard,
  settingsIconChip,
  settingsPageAtmosphere,
  settingsPageFogMid,
  settingsPageGlowTop,
  settingsPageVignette,
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
  settingsSubpageHeroOrb,
  settingsSubpageHeroOrbGlow,
  settingsSubpageHeroOrbWrap,
} from "@/app/pages/app/settings-hub/settingsSubpageHero";

export const PRIVACY_HERO_IMG = SETTINGS_SUBPAGE_HERO_IMG;
export const PRIVACY_BANNER_IMG = SETTINGS_SUBPAGE_HERO_IMG;
export const PRIVACY_ENCRYPTION_IMG = "/community/scene-forest.jpg";

export const privacyPageAtmosphere = settingsPageAtmosphere;

export const privacyPageGlowTop = settingsPageGlowTop;
export const privacyPageFogMid = settingsPageFogMid;
export const privacyPageVignette = settingsPageVignette;

export const privacyGlassCard = cn(settingsCard, "rounded-[1.75rem]");

export const privacyRailCard = cn(
  privacyGlassCard,
  "rounded-3xl p-5 sm:p-6",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_40px_-14px_rgba(139,92,246,0.18),0_24px_64px_-36px_rgba(0,0,0,0.72)]"
);

/** Rail card without outer violet glow (e.g. bottom sidebar card). */
export const privacyRailCardFlat = cn(settingsCard, "rounded-3xl p-5 sm:p-6");

export const privacyHeroCard = settingsSubpageHeroShell;
export const privacyHeroImage = settingsSubpageHeroImage;
export const privacyHeroLightScrim = settingsSubpageHeroLightScrim;
export const privacyHeroOverlayReadability = settingsSubpageHeroOverlayReadability;
export const privacyHeroOverlayBottom = settingsSubpageHeroOverlayBottom;
export const privacyHeroOverlayAccent = settingsSubpageHeroOverlayAccent;
export const privacyHeroInner = settingsSubpageHeroInner;
export const privacyHeroCopy = settingsSubpageHeroCopy;
export const privacyHeroLead = settingsSubpageHeroLead;
export const privacyHeroBody = settingsSubpageHeroBody;
export const privacyHeroOverlayLeft = privacyHeroOverlayReadability;
export const privacyHeroOverlayPurple = privacyHeroOverlayAccent;
export const privacyHeroOverlayWarmth = privacyHeroOverlayBottom;

export const privacyIconChip = settingsIconChip;

export const privacySectionTitle = cn(
  "font-serif text-[1.35rem] font-light tracking-tight text-[var(--solace-text)] sm:text-[1.5rem]",
  "bg-gradient-to-r from-[var(--solace-text)] to-[color:var(--accent-secondary,#a78bfa)]/85 bg-clip-text text-transparent"
);

export const privacySectionSubtitle = "mt-1 text-sm text-[var(--solace-muted)]";

export const privacyBackLink = settingsSubpageHeroBackLink;
export const privacyHeroTitle = settingsSubpageHeroTitleSerif;
export const privacyHeroAccent = settingsSubpageHeroAccent;
export const privacyHeroOrbWrap = settingsSubpageHeroOrbWrap;
export const privacyHeroOrbGlow = settingsSubpageHeroOrbGlow;
export const privacyHeroOrb = settingsSubpageHeroOrb;

export const privacyBtnGhost = cn(
  "inline-flex min-h-[36px] items-center justify-center rounded-full border border-white/[0.1] px-4 py-1.5",
  "bg-[linear-gradient(180deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.02)_100%)]",
  "text-xs font-semibold text-[rgba(255,255,255,0.9)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  "transition-all duration-300 hover:border-violet-300/28 hover:bg-violet-500/[0.1] hover:shadow-[0_0_24px_-8px_rgba(139,92,246,0.35)]"
);

export const privacyBtnPrimary = cn(
  "inline-flex min-h-[40px] items-center justify-center rounded-full px-5 py-2 text-xs font-semibold text-white",
  "bg-[linear-gradient(135deg,#7C3AED_0%,#C026D3_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_32px_-6px_rgba(168,85,247,0.5)]",
  "transition-all duration-300 hover:brightness-110"
);

export const privacyBtnRose = cn(
  "inline-flex min-h-[40px] items-center justify-center rounded-full px-5 py-2 text-xs font-semibold text-rose-50/95",
  "border border-rose-400/28 bg-[linear-gradient(135deg,rgba(136,19,55,0.55)_0%,rgba(76,5,25,0.75)_100%)]",
  "shadow-[0_0_28px_-10px_rgba(244,63,94,0.35)]",
  "transition-all duration-300 hover:border-rose-300/40"
);

export const privacyCompactCard = cn(
  "flex min-h-[148px] flex-col justify-between rounded-[1.25rem] border border-white/[0.07] p-4",
  "bg-[linear-gradient(160deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.015)_55%,rgba(139,92,246,0.04)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  "transition-all duration-300 hover:border-violet-400/22 hover:shadow-[0_0_32px_-12px_rgba(139,92,246,0.22)]"
);

export const privacyRow = cn(
  "flex flex-col gap-4 border-b border-[color:var(--solace-border)] px-4 py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5"
);

export const privacySelect = cn(
  solaceInputSurface,
  "min-h-[40px] px-4 py-2 pr-9 text-sm font-medium shadow-[var(--solace-card-shadow)]"
);

export const privacySessionRow = cn(
  "flex items-center gap-4 border-b border-[color:var(--solace-border)] px-4 py-4 last:border-b-0 sm:px-6",
  "transition-colors hover:bg-[color-mix(in_srgb,var(--accent-secondary,#a78bfa)_6%,transparent)]"
);

export const privacyDataCard = cn(
  settingsCard,
  "flex flex-col gap-4 rounded-[1.35rem] p-5 sm:p-6"
);

export const privacyCommitmentBanner = cn(
  solaceCinematicBanner,
  "rounded-[1.75rem] border-violet-400/10"
);

export { solaceCinematicBannerContent as privacyCommitmentBannerContent };
export { solaceCinematicBannerOverlay as privacyCommitmentBannerOverlay };
export { solaceHeroImage as privacyCommitmentBannerImage };
export { solaceCinematicBannerTitle as privacyCommitmentBannerTitle };
export { solaceCinematicBannerBody as privacyCommitmentBannerBody };
export { solaceCinematicBannerLink as privacyCommitmentBannerLink };

export const privacyLinkMuted = cn(
  "inline-flex items-center gap-1 text-xs font-semibold text-violet-300/80 transition hover:text-violet-200"
);
