import { cn } from "@/lib/utils";
import {
  solaceCard,
  solaceHeroOverlayBottom,
  solaceHeroOverlayReadability,
  solaceHeroSection,
  solacePageAtmosphere,
  solacePageFogMid,
  solacePageGlowTop,
  solacePageVignette,
  solaceRailCard,
} from "@/app/solace/solacePageChrome";

export const achievementsPageAtmosphere = solacePageAtmosphere;
export const achievementsPageGlowTop = solacePageGlowTop;
export const achievementsPageFogMid = solacePageFogMid;
export const achievementsPageVignette = solacePageVignette;

export const achievementsCard = cn(
  solaceCard,
  "rounded-2xl border-white/[0.07]",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-theme=light]_&]:border-[color:var(--border)]"
);

export const achievementsRailCard = cn(solaceRailCard, "rounded-3xl p-5 sm:p-6");

export const achievementsHeroSection = cn(
  solaceHeroSection,
  "rounded-3xl border-white/[0.07]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_80px_-48px_rgba(0,0,0,0.85)]",
  "[html[data-ezri-theme=light]_&]:shadow-[var(--solace-card-shadow)]",
  "[html[data-theme=light]_&]:shadow-[var(--solace-card-shadow)]"
);

export const achievementsHeroOverlay = solaceHeroOverlayReadability;
export const achievementsHeroOverlayBottom = solaceHeroOverlayBottom;

export const achievementsHeroTitle = cn(
  "max-w-xl font-serif text-4xl font-semibold tracking-tight sm:text-[2.75rem] sm:leading-tight",
  "text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.55)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary)] [html[data-ezri-theme=light]_&]:[text-shadow:none]",
  "[html[data-theme=light]_&]:text-[var(--text-primary)] [html[data-theme=light]_&]:[text-shadow:none]"
);

export const achievementsHeroSubtitle = cn(
  "mt-4 max-w-md text-[15px] leading-relaxed text-zinc-200/95 [text-shadow:0_1px_16px_rgba(0,0,0,0.45)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-secondary)] [html[data-ezri-theme=light]_&]:[text-shadow:none]",
  "[html[data-theme=light]_&]:text-[var(--text-secondary)] [html[data-theme=light]_&]:[text-shadow:none]"
);

export const achievementsStatStrip = cn(
  achievementsCard,
  "p-1 sm:p-0"
);

export const achievementsMilestoneCard = cn(
  achievementsCard,
  "light-theme-card-hover group relative flex min-h-[280px] flex-col overflow-hidden text-center backdrop-blur-md transition"
);

export const achievementsEmptyState = cn(
  achievementsCard,
  "rounded-3xl border-dashed py-16 text-center backdrop-blur-xl"
);

export const achievementsSectionPanel = cn(
  achievementsCard,
  "space-y-6 rounded-3xl p-5 backdrop-blur-xl sm:p-6"
);
