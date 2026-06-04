import { cn } from "@/lib/utils";
import {
  solaceBtnPrimary,
  solaceBtnSecondary,
  solaceCard,
  solaceHeroContent,
  solaceHeroImage,
  solaceHeroMediaShell,
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
  "billing-hero-section",
  solaceHeroMediaShell,
  solaceHeroSection,
  "min-h-[220px] rounded-3xl border-white/[0.09] sm:min-h-[240px]",
  "shadow-[0_40px_100px_-48px_rgba(76,29,149,0.55)]",
  "[html[data-ezri-theme=light]_&]:shadow-[var(--solace-card-shadow)]",
  "[html[data-theme=light]_&]:shadow-[var(--solace-card-shadow)]"
);

export const billingHeroImage = solaceHeroImage;
export const billingHeroContent = solaceHeroContent;
export const billingHeroOverlay = solaceHeroOverlayReadability;
export const billingHeroOverlayBottom = solaceHeroOverlayBottom;

export const billingHeroTitle = cn(
  "font-serif text-2xl font-light sm:text-3xl lg:text-[1.85rem]",
  "text-white [text-shadow:0_2px_20px_rgba(0,0,0,0.5)]",
  "[html[data-ezri-theme=light]_&]:[text-shadow:0_1px_14px_rgba(0,0,0,0.5)]",
  "[html[data-theme=light]_&]:[text-shadow:0_1px_14px_rgba(0,0,0,0.5)]"
);

export const billingHeroEyebrow = cn(
  "text-[10px] font-semibold uppercase tracking-[0.32em] text-violet-200/80",
  "[html[data-ezri-theme=light]_&]:text-violet-200/90",
  "[html[data-theme=light]_&]:text-violet-200/90"
);

export const billingHeroLead = cn(
  "text-sm leading-relaxed text-zinc-300 [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]",
  "[html[data-ezri-theme=light]_&]:text-zinc-200/95",
  "[html[data-theme=light]_&]:text-zinc-200/95"
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

/** Hero CTAs — beat image-card scrim + global .text-white remap in light theme */
export const billingHeroBtnPrimary = cn(
  "billing-hero-btn-primary solace-cta-gradient",
  "h-11 min-h-[44px] rounded-full border-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-7 text-white shadow-[0_0_28px_rgba(139,92,246,0.35)]"
);

export const billingHeroBtnSecondary = cn(
  "billing-hero-btn-secondary",
  "h-11 min-h-[44px] rounded-full border-white/20 bg-black/35 text-zinc-100 backdrop-blur-sm hover:bg-black/50"
);

export const billingHeroStatChip = cn(
  "billing-hero-stat",
  "rounded-2xl border border-white/10 bg-black/45 px-3 py-3 backdrop-blur-md sm:py-3.5"
);

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

export const billingSectionHeading = cn(
  "font-serif text-xl font-light text-zinc-50 sm:text-2xl",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary)]",
  "[html[data-theme=light]_&]:text-[var(--text-primary)]"
);

export const billingPlanCard = cn(
  billingCard,
  "light-theme-card relative flex flex-col overflow-hidden rounded-3xl p-6 sm:p-7",
  "border-white/[0.07]",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-theme=light]_&]:border-[color:var(--border)]"
);

export const billingPlanCardCurrent = cn(
  "border-fuchsia-400/45 shadow-[0_0_40px_rgba(192,132,252,0.15)]",
  "[html[data-ezri-theme=light]_&]:border-fuchsia-300/70",
  "[html[data-ezri-theme=light]_&]:shadow-[var(--solace-card-shadow)]",
  "[html[data-theme=light]_&]:border-fuchsia-300/70",
  "[html[data-theme=light]_&]:shadow-[var(--solace-card-shadow)]"
);

export const billingCurrentBadge = cn(
  "absolute right-4 top-4 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em]",
  "border-fuchsia-400/35 bg-fuchsia-500/15 text-fuchsia-100/95",
  "[html[data-ezri-theme=light]_&]:border-fuchsia-300/70",
  "[html[data-ezri-theme=light]_&]:bg-fuchsia-50",
  "[html[data-ezri-theme=light]_&]:text-fuchsia-700",
  "[html[data-theme=light]_&]:border-fuchsia-300/70",
  "[html[data-theme=light]_&]:bg-fuchsia-50",
  "[html[data-theme=light]_&]:text-fuchsia-700"
);

export const billingFeatureCheck = cn(
  "mt-0.5 size-3.5 shrink-0 text-violet-400/90",
  "[html[data-ezri-theme=light]_&]:text-violet-600",
  "[html[data-theme=light]_&]:text-violet-600"
);

export function billingPlanIconChipClass(planId: "trial" | "core" | "pro") {
  const tone = planId === "trial" ? "orange" : planId === "pro" ? "pink" : "blue";
  return cn("solace-icon-chip", `solace-icon-chip--${tone}`, "mb-4 !size-11 !rounded-2xl");
}

export function billingStatusBadgeClass(paid: boolean) {
  return cn(
    "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize",
    paid
      ? cn(
          "bg-emerald-500/15 text-emerald-200/95",
          "[html[data-ezri-theme=light]_&]:bg-emerald-50",
          "[html[data-ezri-theme=light]_&]:text-emerald-700",
          "[html[data-theme=light]_&]:bg-emerald-50",
          "[html[data-theme=light]_&]:text-emerald-700"
        )
      : cn(
          "bg-white/[0.06] text-zinc-400",
          "[html[data-ezri-theme=light]_&]:bg-[var(--card-soft)]",
          "[html[data-ezri-theme=light]_&]:text-[var(--text-muted)]",
          "[html[data-theme=light]_&]:bg-[var(--card-soft)]",
          "[html[data-theme=light]_&]:text-[var(--text-muted)]"
        )
  );
}

export const billingPaginationBar = cn(
  "border-t border-white/[0.06] bg-black/25 px-4 py-4 sm:px-6",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-ezri-theme=light]_&]:bg-[var(--card-soft)]",
  "[html[data-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-theme=light]_&]:bg-[var(--card-soft)]"
);

export const billingPaginationBtn = cn(
  "inline-flex size-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border transition",
  "border-white/10 bg-white/[0.04] text-zinc-200 hover:border-violet-400/25 hover:bg-white/[0.07]",
  "disabled:cursor-not-allowed disabled:opacity-30",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-ezri-theme=light]_&]:bg-white",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary)]",
  "[html[data-ezri-theme=light]_&]:hover:border-violet-300/60",
  "[html[data-ezri-theme=light]_&]:hover:bg-[var(--card-soft)]",
  "[html[data-ezri-theme=light]_&]:[&_svg]:text-violet-600",
  "[html[data-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-theme=light]_&]:bg-white",
  "[html[data-theme=light]_&]:text-[var(--text-primary)]",
  "[html[data-theme=light]_&]:hover:border-violet-300/60",
  "[html[data-theme=light]_&]:hover:bg-[var(--card-soft)]",
  "[html[data-theme=light]_&]:[&_svg]:text-violet-600"
);

export const billingSelectTrigger = cn(
  "min-h-[44px] rounded-full border border-white/[0.1] bg-black/40 text-sm text-zinc-100 shadow-none",
  "hover:border-violet-400/28 hover:bg-black/50",
  "focus-visible:border-violet-400/35 focus-visible:ring-2 focus-visible:ring-violet-400/25",
  "data-[state=open]:border-violet-400/40 data-[state=open]:bg-black/55",
  "[&>svg:last-child]:size-4 [&>svg:last-child]:text-violet-300/80",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--input-border)]",
  "[html[data-ezri-theme=light]_&]:bg-[var(--input-bg)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary)]",
  "[html[data-ezri-theme=light]_&]:hover:border-violet-300/50",
  "[html[data-ezri-theme=light]_&]:hover:bg-white",
  "[html[data-ezri-theme=light]_&]:[&>svg:last-child]:text-violet-600",
  "[html[data-theme=light]_&]:border-[color:var(--input-border)]",
  "[html[data-theme=light]_&]:bg-[var(--input-bg)]",
  "[html[data-theme=light]_&]:text-[var(--text-primary)]",
  "[html[data-theme=light]_&]:hover:border-violet-300/50",
  "[html[data-theme=light]_&]:hover:bg-white",
  "[html[data-theme=light]_&]:[&>svg:last-child]:text-violet-600"
);

export const billingIconChip = cn("solace-icon-chip solace-icon-chip--violet", "!size-12 !rounded-xl");

export const billingChevronMuted = cn(
  "size-4 text-zinc-600",
  "[html[data-ezri-theme=light]_&]:text-violet-500/70",
  "[html[data-theme=light]_&]:text-violet-500/70"
);
