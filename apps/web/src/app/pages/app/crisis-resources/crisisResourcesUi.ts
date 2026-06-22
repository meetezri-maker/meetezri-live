import { cn } from "@/lib/utils";
import { MOOD_CHECKIN_IMAGES } from "@/lib/solace/moodCheckInImages";
import {
  EMERGENCY_HERO_IMG,
  EMERGENCY_RAIL_IMG,
  emergencyActionBtn,
  emergencyBackLink,
  emergencyBtnPrimary,
  emergencyContactAvatar,
  emergencyGlassCard,
  emergencyHeroAccent,
  emergencyHeroCard,
  emergencyHeroImage,
  emergencyHeroLightScrim,
  emergencyHeroOverlayAccent,
  emergencyHeroOverlayBottom,
  emergencyHeroOverlayReadability,
  emergencyHeroTitle,
  emergencyIconChip,
  emergencyPageAtmosphere,
  emergencyPageFogMid,
  emergencyPageGlowTop,
  emergencyPageVignette,
  emergencyRailCard,
  emergencyResourcesCta,
  emergencySafetyRow,
  emergencyHeroSubtitle,
} from "@/app/pages/app/emergency-contacts/emergencyContactsUi";

export {
  EMERGENCY_HERO_IMG,
  EMERGENCY_RAIL_IMG,
  emergencyBackLink,
  emergencyHeroAccent,
  emergencyHeroCard,
  emergencyHeroImage,
  emergencyHeroLightScrim,
  emergencyHeroOverlayAccent,
  emergencyHeroOverlayBottom,
  emergencyHeroOverlayReadability,
  emergencyHeroTitle,
  emergencyIconChip,
  emergencyPageAtmosphere,
  emergencyPageFogMid,
  emergencyPageGlowTop,
  emergencyPageVignette,
  emergencyRailCard,
  emergencyResourcesCta,
  emergencySafetyRow,
  emergencyActionBtn,
  emergencyContactAvatar,
  emergencyBtnPrimary,
  emergencyHeroSubtitle,
};

export const crisisPageAtmosphere = cn(emergencyPageAtmosphere, "crisis-resources-page");

export const crisisGlassCard = emergencyGlassCard;

export const crisisSectionTitle = cn(
  "crisis-section-title font-serif text-lg font-light text-white sm:text-xl",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary,#101828)]",
  "[html[data-theme=light]_&]:text-[var(--text-primary,#101828)]"
);

export const crisisSectionEyebrow = cn(
  "crisis-section-eyebrow text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/50",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-muted,#667085)]",
  "[html[data-theme=light]_&]:text-[var(--text-muted,#667085)]"
);

export const crisisBodyText = cn(
  "crisis-body-text text-sm leading-relaxed text-[rgba(255,255,255,0.58)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-secondary,#475467)]",
  "[html[data-theme=light]_&]:text-[var(--text-secondary,#475467)]"
);

export const crisisMutedText = cn(
  "crisis-muted-text text-sm text-[rgba(255,255,255,0.48)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-muted,#667085)]",
  "[html[data-theme=light]_&]:text-[var(--text-muted,#667085)]"
);

export const crisisLabelText = cn(
  "crisis-label-text text-sm font-medium text-white",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary,#101828)]",
  "[html[data-theme=light]_&]:text-[var(--text-primary,#101828)]"
);

export const crisisSubLabelText = cn(
  "crisis-sub-label-text text-xs text-[rgba(255,255,255,0.42)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-muted,#667085)]",
  "[html[data-theme=light]_&]:text-[var(--text-muted,#667085)]"
);

/** Urgent but premium — deep crimson matte in dark; soft rose alert in light */
export const crisisDangerCard = cn(
  "crisis-danger-card relative overflow-hidden rounded-[1.5rem] border border-rose-500/20 p-5 sm:p-6",
  "bg-[linear-gradient(135deg,rgba(76,5,25,0.72)_0%,rgba(45,8,18,0.88)_42%,rgba(18,8,16,0.95)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_48px_-14px_rgba(244,63,94,0.32),0_28px_72px_-36px_rgba(0,0,0,0.75)]",
  "[html[data-ezri-theme=light]_&]:border-rose-200/80",
  "[html[data-ezri-theme=light]_&]:bg-gradient-to-br [html[data-ezri-theme=light]_&]:from-rose-50 [html[data-ezri-theme=light]_&]:via-orange-50/90 [html[data-ezri-theme=light]_&]:to-white",
  "[html[data-ezri-theme=light]_&]:shadow-[var(--solace-card-shadow,0_18px_45px_rgba(88,28,135,0.08))]",
  "[html[data-theme=light]_&]:border-rose-200/80",
  "[html[data-theme=light]_&]:bg-gradient-to-br [html[data-theme=light]_&]:from-rose-50 [html[data-theme=light]_&]:via-orange-50/90 [html[data-theme=light]_&]:to-white",
  "[html[data-theme=light]_&]:shadow-[var(--solace-card-shadow,0_18px_45px_rgba(88,28,135,0.08))]"
);

export const crisisDangerTitle = cn(
  "crisis-danger-title text-lg font-semibold text-rose-50/95 sm:text-xl",
  "[html[data-ezri-theme=light]_&]:text-rose-900",
  "[html[data-theme=light]_&]:text-rose-900"
);

export const crisisDangerBody = cn(
  "crisis-danger-body mt-2 text-sm leading-relaxed text-rose-100/75",
  "[html[data-ezri-theme=light]_&]:text-rose-800/85",
  "[html[data-theme=light]_&]:text-rose-800/85"
);

export const crisisDangerCta = cn(
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold",
  "bg-white text-rose-700 shadow-[0_0_28px_-8px_rgba(255,255,255,0.35)]",
  "transition-all duration-300 hover:bg-rose-50 hover:shadow-[0_0_36px_-6px_rgba(255,255,255,0.45)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/50"
);

export const crisisHotlineCard = (
  variant: "lifeline" | "text" | "emergency" | "samhsa"
) =>
  cn(
    "crisis-hotline-card group relative overflow-hidden rounded-[1.35rem] border p-5 sm:p-6",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_24px_64px_-32px_rgba(0,0,0,0.78)]",
    "transition-all duration-300 hover:brightness-[1.04]",
    `crisis-hotline-card--${variant}`,
    {
      lifeline:
        "border-orange-400/18 bg-[linear-gradient(145deg,rgba(127,29,29,0.55)_0%,rgba(69,10,10,0.82)_38%,rgba(24,10,14,0.94)_100%)] shadow-[0_0_40px_-16px_rgba(249,115,22,0.28)]",
      text:
        "border-cyan-400/18 bg-[linear-gradient(145deg,rgba(8,47,73,0.55)_0%,rgba(12,74,110,0.65)_38%,rgba(8,18,32,0.94)_100%)] shadow-[0_0_40px_-16px_rgba(34,211,238,0.22)]",
      emergency:
        "border-rose-500/20 bg-[linear-gradient(145deg,rgba(88,7,7,0.62)_0%,rgba(55,8,12,0.85)_42%,rgba(16,8,12,0.96)_100%)] shadow-[0_0_40px_-16px_rgba(239,68,68,0.28)]",
      samhsa:
        "border-fuchsia-400/18 bg-[linear-gradient(145deg,rgba(76,29,149,0.52)_0%,rgba(109,40,217,0.42)_38%,rgba(24,12,40,0.94)_100%)] shadow-[0_0_40px_-16px_rgba(168,85,247,0.28)]",
    }[variant]
  );

export const crisisHotlineDial = cn(
  "crisis-hotline-dial mt-4 flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-white/10",
  "bg-[rgba(6,8,22,0.45)] px-4 py-3 backdrop-blur-sm",
  "transition-colors group-hover:border-white/18 group-hover:bg-[rgba(8,10,28,0.62)]",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border,#e7ddfb)]",
  "[html[data-ezri-theme=light]_&]:bg-white/90",
  "[html[data-ezri-theme=light]_&]:group-hover:border-violet-300/50",
  "[html[data-ezri-theme=light]_&]:group-hover:bg-white",
  "[html[data-theme=light]_&]:border-[color:var(--border,#e7ddfb)]",
  "[html[data-theme=light]_&]:bg-white/90",
  "[html[data-theme=light]_&]:group-hover:border-violet-300/50",
  "[html[data-theme=light]_&]:group-hover:bg-white"
);

export const crisisPanelCard = cn(
  crisisGlassCard,
  "rounded-[1.5rem] p-5 sm:p-6",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_40px_-14px_rgba(139,92,246,0.14),0_24px_64px_-36px_rgba(0,0,0,0.72)]"
);

export const crisisContactRow = cn(
  "crisis-contact-row flex items-center gap-3 border-b border-white/[0.05] py-3.5 last:border-b-0",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border,#e7ddfb)]",
  "[html[data-theme=light]_&]:border-[color:var(--border,#e7ddfb)]"
);

export const crisisSafetyStep = cn(
  "crisis-safety-step flex items-start gap-3 border-b border-white/[0.05] py-3 last:border-b-0 first:pt-0",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border,#e7ddfb)]",
  "[html[data-theme=light]_&]:border-[color:var(--border,#e7ddfb)]"
);

export const crisisStepBadge = cn(
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
  "bg-[linear-gradient(135deg,#C026D3_0%,#EC4899_100%)]",
  "shadow-[0_0_20px_-6px_rgba(236,72,153,0.55)] ring-1 ring-white/12"
);

export const crisisArticleRow = cn(
  "crisis-article-row group flex gap-3 rounded-2xl border border-white/[0.06] p-3.5 sm:p-4",
  "bg-[linear-gradient(160deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.01)_100%)]",
  "transition-all duration-300 hover:border-violet-400/22 hover:bg-violet-500/[0.06]",
  "hover:shadow-[0_0_32px_-12px_rgba(139,92,246,0.28)]",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border,#e7ddfb)]",
  "[html[data-ezri-theme=light]_&]:bg-[var(--card-muted,#f8f3ff)]",
  "[html[data-ezri-theme=light]_&]:hover:border-violet-300/55",
  "[html[data-ezri-theme=light]_&]:hover:bg-[var(--surface-lavender,#f5eeff)]",
  "[html[data-ezri-theme=light]_&]:hover:shadow-[var(--solace-card-shadow)]",
  "[html[data-theme=light]_&]:border-[color:var(--border,#e7ddfb)]",
  "[html[data-theme=light]_&]:bg-[var(--card-muted,#f8f3ff)]",
  "[html[data-theme=light]_&]:hover:border-violet-300/55",
  "[html[data-theme=light]_&]:hover:bg-[var(--surface-lavender,#f5eeff)]",
  "[html[data-theme=light]_&]:hover:shadow-[var(--solace-card-shadow)]"
);

/** Lotus-on-lake mood check-in hero — "You Are Not Alone" banner plate */
export const CRISIS_ALONE_BANNER_IMG = MOOD_CHECKIN_IMAGES.heroBanner;

export const crisisAloneBanner = cn(
  "crisis-alone-banner relative overflow-hidden rounded-[1.5rem] border border-fuchsia-400/20",
  "bg-[linear-gradient(135deg,rgba(76,29,149,0.55)_0%,rgba(136,19,55,0.45)_48%,rgba(30,16,48,0.88)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_48px_-12px_rgba(236,72,153,0.35),0_28px_72px_-36px_rgba(0,0,0,0.75)]",
  "[html[data-ezri-theme=light]_&]:border-fuchsia-200/70",
  "[html[data-ezri-theme=light]_&]:bg-gradient-to-br [html[data-ezri-theme=light]_&]:from-fuchsia-50 [html[data-ezri-theme=light]_&]:via-rose-50 [html[data-ezri-theme=light]_&]:to-white",
  "[html[data-ezri-theme=light]_&]:shadow-[var(--solace-card-shadow)]",
  "[html[data-theme=light]_&]:border-fuchsia-200/70",
  "[html[data-theme=light]_&]:bg-gradient-to-br [html[data-theme=light]_&]:from-fuchsia-50 [html[data-theme=light]_&]:via-rose-50 [html[data-theme=light]_&]:to-white",
  "[html[data-theme=light]_&]:shadow-[var(--solace-card-shadow)]"
);

export const crisisAloneBannerImage = cn(
  "crisis-alone-banner-img absolute inset-0 h-full w-full object-cover object-[center_38%] opacity-45",
  "[html[data-ezri-theme=light]_&]:opacity-20",
  "[html[data-theme=light]_&]:opacity-20"
);

export const crisisAloneBannerOverlay = cn(
  "crisis-alone-banner-overlay absolute inset-0",
  "bg-[linear-gradient(135deg,rgba(76,29,149,0.55)_0%,rgba(136,19,55,0.45)_48%,rgba(30,16,48,0.88)_100%)]",
  "[html[data-ezri-theme=light]_&]:bg-gradient-to-br [html[data-ezri-theme=light]_&]:from-fuchsia-100/90 [html[data-ezri-theme=light]_&]:via-rose-50/85 [html[data-ezri-theme=light]_&]:to-white/95",
  "[html[data-theme=light]_&]:bg-gradient-to-br [html[data-theme=light]_&]:from-fuchsia-100/90 [html[data-theme=light]_&]:via-rose-50/85 [html[data-theme=light]_&]:to-white/95"
);

export const crisisAloneBannerContent = cn("relative p-5 sm:p-6");

export const crisisRailHeartWrap = cn(
  "crisis-rail-heart-wrap mx-auto flex h-16 w-16 items-center justify-center rounded-full",
  "bg-[linear-gradient(135deg,rgba(192,132,252,0.22)_0%,rgba(236,72,153,0.18)_100%)]",
  "shadow-[0_0_40px_-8px_rgba(236,72,153,0.45)] ring-1 ring-fuchsia-300/25",
  "[html[data-ezri-theme=light]_&]:bg-[linear-gradient(135deg,rgba(192,132,252,0.16)_0%,rgba(236,72,153,0.12)_100%)]",
  "[html[data-ezri-theme=light]_&]:shadow-[0_0_24px_-8px_rgba(167,139,250,0.35)]",
  "[html[data-ezri-theme=light]_&]:ring-fuchsia-200/70",
  "[html[data-theme=light]_&]:bg-[linear-gradient(135deg,rgba(192,132,252,0.16)_0%,rgba(236,72,153,0.12)_100%)]",
  "[html[data-theme=light]_&]:shadow-[0_0_24px_-8px_rgba(167,139,250,0.35)]",
  "[html[data-theme=light]_&]:ring-fuchsia-200/70"
);

export const crisisRailHeartIcon = cn(
  "crisis-rail-heart-icon h-7 w-7 text-fuchsia-100/95",
  "[html[data-ezri-theme=light]_&]:text-rose-600",
  "[html[data-theme=light]_&]:text-rose-600"
);

export const crisisViewAllLink = cn(
  "crisis-view-all-link inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-fuchsia-300/80",
  "transition-colors hover:text-fuchsia-200",
  "[html[data-ezri-theme=light]_&]:text-violet-700 [html[data-ezri-theme=light]_&]:hover:text-violet-900",
  "[html[data-theme=light]_&]:text-violet-700 [html[data-theme=light]_&]:hover:text-violet-900"
);

export const crisisOutlineBtn = cn(
  "crisis-outline-btn inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/12 px-4 py-2 text-sm font-semibold",
  "bg-[rgba(255,255,255,0.04)] text-white transition-all hover:border-violet-400/28 hover:bg-violet-500/[0.1]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border,#e7ddfb)]",
  "[html[data-ezri-theme=light]_&]:bg-white",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary,#101828)]",
  "[html[data-ezri-theme=light]_&]:hover:border-violet-300/55",
  "[html[data-ezri-theme=light]_&]:hover:bg-[var(--surface-lavender,#f5eeff)]",
  "[html[data-theme=light]_&]:border-[color:var(--border,#e7ddfb)]",
  "[html[data-theme=light]_&]:bg-white",
  "[html[data-theme=light]_&]:text-[var(--text-primary,#101828)]",
  "[html[data-theme=light]_&]:hover:border-violet-300/55",
  "[html[data-theme=light]_&]:hover:bg-[var(--surface-lavender,#f5eeff)]"
);

export const crisisEmptyState = cn(
  "crisis-empty-state rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm leading-relaxed text-[rgba(255,255,255,0.48)]",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border,#e7ddfb)]",
  "[html[data-ezri-theme=light]_&]:bg-[var(--card-muted,#f8f3ff)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-muted,#667085)]",
  "[html[data-theme=light]_&]:border-[color:var(--border,#e7ddfb)]",
  "[html[data-theme=light]_&]:bg-[var(--card-muted,#f8f3ff)]",
  "[html[data-theme=light]_&]:text-[var(--text-muted,#667085)]"
);

export const crisisRailTitle = cn(
  "crisis-rail-title font-serif text-lg font-light text-white",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary,#101828)]",
  "[html[data-theme=light]_&]:text-[var(--text-primary,#101828)]"
);

export const crisisRailBody = cn(
  "crisis-rail-body mt-3 text-sm leading-relaxed text-[rgba(255,255,255,0.55)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-secondary,#475467)]",
  "[html[data-theme=light]_&]:text-[var(--text-secondary,#475467)]"
);

export const crisisRailItemTitle = cn(
  "crisis-rail-item-title text-sm font-medium text-[rgba(255,255,255,0.92)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary,#101828)]",
  "[html[data-theme=light]_&]:text-[var(--text-primary,#101828)]"
);

export const crisisRailItemBody = cn(
  "crisis-rail-item-body mt-1 text-xs leading-relaxed text-[rgba(255,255,255,0.45)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-muted,#667085)]",
  "[html[data-theme=light]_&]:text-[var(--text-muted,#667085)]"
);

export const crisisHotlineName = cn(
  "crisis-hotline-name font-semibold text-white",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary,#101828)]",
  "[html[data-theme=light]_&]:text-[var(--text-primary,#101828)]"
);

export const crisisHotlineDesc = cn(
  "crisis-hotline-desc mt-0.5 text-sm text-[rgba(255,255,255,0.58)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-secondary,#475467)]",
  "[html[data-theme=light]_&]:text-[var(--text-secondary,#475467)]"
);

export const crisisHotlinePhone = cn(
  "crisis-hotline-phone text-xl font-bold tracking-tight text-white sm:text-2xl",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary,#101828)]",
  "[html[data-theme=light]_&]:text-[var(--text-primary,#101828)]"
);

export const crisisAloneTitle = cn(
  "crisis-alone-title text-lg font-semibold text-white sm:text-xl",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary,#101828)]",
  "[html[data-theme=light]_&]:text-[var(--text-primary,#101828)]"
);

export const crisisAloneBody = cn(
  "crisis-alone-body mt-2 text-sm leading-relaxed text-[rgba(255,255,255,0.72)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-secondary,#475467)]",
  "[html[data-theme=light]_&]:text-[var(--text-secondary,#475467)]"
);

export const crisisArticleCategory = cn(
  "crisis-article-category flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[rgba(255,255,255,0.38)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-muted,#667085)]",
  "[html[data-theme=light]_&]:text-[var(--text-muted,#667085)]"
);

export const crisisArticleTitle = cn(
  "crisis-article-title mt-1 block font-semibold leading-snug text-white group-hover:text-fuchsia-100/95",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary,#101828)]",
  "[html[data-ezri-theme=light]_&]:group-hover:text-violet-900",
  "[html[data-theme=light]_&]:text-[var(--text-primary,#101828)]",
  "[html[data-theme=light]_&]:group-hover:text-violet-900"
);

export const crisisArticleDesc = cn(
  "crisis-article-desc mt-0.5 line-clamp-2 text-xs leading-relaxed text-[rgba(255,255,255,0.45)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-secondary,#475467)]",
  "[html[data-theme=light]_&]:text-[var(--text-secondary,#475467)]"
);

export const crisisArticleMeta = cn(
  "crisis-article-meta mt-2 inline-flex items-center gap-1 text-[11px] text-[rgba(255,255,255,0.38)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-muted,#667085)]",
  "[html[data-theme=light]_&]:text-[var(--text-muted,#667085)]"
);

export const crisisScenicBanner = cn(
  emergencyRailCard,
  "crisis-scenic-banner relative overflow-hidden"
);

export const crisisScenicBannerImage = cn(
  "crisis-scenic-banner-img absolute inset-0 z-0 h-full w-full object-cover object-[center_70%]",
  "brightness-[0.38] saturate-[1.1]"
);

export const crisisScenicOverlayDark = cn(
  "crisis-scenic-overlays-dark pointer-events-none absolute inset-0 z-[1]",
  "bg-gradient-to-t from-[#0a0b18]/95 via-[#0a0b18]/70 to-[#0a0b18]/35"
);

export const crisisScenicOverlayWarm = cn(
  "crisis-scenic-overlays-dark pointer-events-none absolute inset-0 z-[1]",
  "bg-[radial-gradient(ellipse_70%_50%_at_50%_100%,rgba(251,146,60,0.18)_0%,transparent_60%)]"
);

export const crisisScenicLightScrim = cn(
  "crisis-scenic-light-scrim",
  emergencyHeroLightScrim
);

export const crisisBannerTitle = cn(
  "crisis-banner-title font-serif text-lg font-light text-white",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary,#101828)]",
  "[html[data-theme=light]_&]:text-[var(--text-primary,#101828)]"
);

export const crisisBannerBody = cn(
  "crisis-banner-body mt-2 text-sm leading-relaxed text-[rgba(255,255,255,0.58)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-secondary,#475467)]",
  "[html[data-theme=light]_&]:text-[var(--text-secondary,#475467)]"
);

export const crisisBannerContent = "crisis-banner-content relative z-10";

export const crisisLoadingText = crisisMutedText;

export const crisisExternalLink = cn(
  "mt-1 inline-flex items-center gap-1 px-1 text-[11px] font-medium text-fuchsia-300/75 hover:text-fuchsia-200",
  "[html[data-ezri-theme=light]_&]:text-violet-700 [html[data-ezri-theme=light]_&]:hover:text-violet-900",
  "[html[data-theme=light]_&]:text-violet-700 [html[data-theme=light]_&]:hover:text-violet-900"
);

export const crisisArticleChevron = cn(
  "h-4 w-4 shrink-0 self-center text-violet-300/40 transition group-hover:text-fuchsia-300/80",
  "[html[data-ezri-theme=light]_&]:text-violet-400/60 [html[data-ezri-theme=light]_&]:group-hover:text-violet-700",
  "[html[data-theme=light]_&]:text-violet-400/60 [html[data-theme=light]_&]:group-hover:text-violet-700"
);

export const crisisDangerShield = cn(
  "crisis-danger-shield pointer-events-none absolute right-4 top-1/2 hidden h-28 w-28 -translate-y-1/2 text-rose-200/10 sm:block",
  "[html[data-ezri-theme=light]_&]:text-rose-300/25",
  "[html[data-theme=light]_&]:text-rose-300/25"
);

export const crisisHeroShield = cn(
  "h-8 w-8 shrink-0 text-fuchsia-300/90 drop-shadow-[0_0_16px_rgba(236,72,153,0.45)]",
  "[html[data-ezri-theme=light]_&]:text-violet-600 [html[data-ezri-theme=light]_&]:drop-shadow-none",
  "[html[data-theme=light]_&]:text-violet-600 [html[data-theme=light]_&]:drop-shadow-none"
);
