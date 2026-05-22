import { cn } from "@/lib/utils";
import {
  solaceBtnPrimary,
  solaceBtnSecondary,
  solaceCard,
  solaceHeroOverlayBottom,
  solaceHeroOverlayReadability,
  solaceHeroSection,
  solacePageAtmosphere,
  solacePageFogMid,
  solacePageGlowTop,
  solaceRailCard,
} from "@/app/solace/solacePageChrome";

export const billingPageAtmosphere = cn(
  solacePageAtmosphere,
  "pb-20 pt-6 sm:px-6 lg:px-8"
);

export const billingPageGlowTop = solacePageGlowTop;
export const billingPageFogMid = solacePageFogMid;

export const billingCard = cn(
  solaceCard,
  "light-theme-card-hover rounded-2xl backdrop-blur-md",
  "border-white/[0.09]",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-theme=light]_&]:border-[color:var(--border)]"
);

export const billingRailCard = cn(solaceRailCard, "rounded-3xl p-5 sm:p-6");

export const billingHeroSection = cn(
  solaceHeroSection,
  "rounded-3xl border-white/[0.09]",
  "shadow-[0_40px_100px_-48px_rgba(76,29,149,0.55)]",
  "[html[data-ezri-theme=light]_&]:shadow-[var(--solace-card-shadow)]",
  "[html[data-theme=light]_&]:shadow-[var(--solace-card-shadow)]"
);

export const billingHeroOverlay = solaceHeroOverlayReadability;
export const billingHeroOverlayBottom = solaceHeroOverlayBottom;

export const billingHeroTitle = cn(
  "font-serif text-2xl font-light sm:text-3xl lg:text-[1.85rem]",
  "text-white",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary)]",
  "[html[data-theme=light]_&]:text-[var(--text-primary)]"
);

export const billingPageTitle = cn(
  "font-serif text-3xl font-light tracking-tight text-zinc-50 sm:text-4xl",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary)]",
  "[html[data-theme=light]_&]:text-[var(--text-primary)]"
);

export const billingPageSubtitle = cn(
  "max-w-lg text-sm leading-relaxed text-zinc-500",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-muted)]",
  "[html[data-theme=light]_&]:text-[var(--text-muted)]"
);

export const billingBtnPrimary = solaceBtnPrimary;
export const billingBtnSecondary = solaceBtnSecondary;

export const billingGhostBtn = cn(
  "inline-flex h-11 min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-full border px-5 text-sm transition",
  "border-white/12 bg-white/[0.04] text-zinc-200 hover:border-violet-400/35 hover:bg-white/[0.07]",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--button-secondary-border)]",
  "[html[data-ezri-theme=light]_&]:bg-[var(--button-secondary-bg)]",
  "[html[data-ezri-theme=light]_&]:text-[color:var(--button-secondary-text)]",
  "[html[data-theme=light]_&]:border-[color:var(--button-secondary-border)]",
  "[html[data-theme=light]_&]:bg-[var(--button-secondary-bg)]",
  "[html[data-theme=light]_&]:text-[color:var(--button-secondary-text)]"
);
