import { cn } from "@/lib/utils";

/** Shared settings / sanctuary page chrome — colors via CSS variables only. */
export const solacePageAtmosphere = cn(
  "solace-page-backdrop relative min-h-full overflow-x-hidden pb-10 text-[var(--solace-text)]"
);

export const solacePageGlowTop = cn(
  "pointer-events-none absolute -top-40 right-[-10%] h-[28rem] w-[28rem] rounded-full",
  "bg-[radial-gradient(circle,rgba(139,92,246,0.14)_0%,transparent_68%)] blur-3xl",
  "opacity-100",
  "[html[data-ezri-theme=light]_&]:bg-[radial-gradient(circle,rgba(167,139,250,0.22)_0%,rgba(236,72,153,0.08)_42%,transparent_68%)]",
  "[html[data-ezri-theme=light]_&]:opacity-80"
);

export const solacePageFogMid = cn(
  "pointer-events-none absolute left-1/2 top-[18%] h-[32rem] w-[min(100%,56rem)] -translate-x-1/2 rounded-full",
  "bg-[radial-gradient(ellipse_80%_55%_at_50%_40%,rgba(76,29,149,0.1)_0%,transparent_70%)] blur-3xl",
  "opacity-100",
  "[html[data-ezri-theme=light]_&]:bg-[radial-gradient(ellipse_80%_55%_at_50%_40%,rgba(167,139,250,0.16)_0%,rgba(78,205,196,0.08)_48%,transparent_70%)]",
  "[html[data-ezri-theme=light]_&]:opacity-65"
);

export const solacePageVignette = cn(
  "pointer-events-none absolute inset-0",
  "bg-[radial-gradient(ellipse_90%_70%_at_50%_50%,transparent_40%,rgba(4,5,14,0.55)_100%)]",
  "[html[data-ezri-theme=light]_&]:bg-[radial-gradient(ellipse_90%_70%_at_50%_50%,transparent_50%,rgba(243,236,255,0.35)_100%)]"
);

export const solaceCard = cn(
  "light-theme-card light-theme-card-hover rounded-[1.25rem] border border-[color:var(--solace-card-border)] backdrop-blur-xl",
  "bg-[var(--solace-card-bg)] shadow-[var(--solace-card-shadow)] text-[var(--solace-text)]"
);

/** Right rail / insight panels — pastel gradient surface */
export const solaceRailCard = cn(
  "solace-rail-card light-theme-card light-theme-card-hover rounded-[1.25rem] border backdrop-blur-xl",
  "border-[color:var(--rail-card-border,var(--solace-card-border))] bg-[var(--rail-card-bg)]",
  "text-[var(--solace-text)] shadow-[var(--solace-card-shadow)]"
);

export const solaceHeroSection = cn(
  "relative isolate overflow-hidden rounded-[1.25rem] border border-[color:var(--solace-ds-border-glow)]",
  "shadow-[var(--solace-ds-shadow-cinematic),inset_0_1px_0_rgba(255,255,255,0.07)]"
);

export const solaceHeroImage = cn(
  "absolute inset-0 z-0 h-full w-full object-cover object-[center_32%]",
  "brightness-[0.94] contrast-[1.05] saturate-[1.08]"
);

/** Image + text overlay — light theme: 40% scrim, moonlit copy */
export const solaceImageCard = "solace-image-card solace-on-dark";

/** Light strip/card on top of heroes — dark readable copy in light theme */
export const solaceSurfaceLight =
  "solace-surface-light border-[color:var(--border)] bg-[rgba(255,255,255,0.92)] text-[var(--text-primary)] backdrop-blur-xl";

/** Dark nested region (charts on image cards) — moonlit copy in light theme */
export const solaceSurfaceDark = "solace-on-dark solace-surface-dark";

/** Cinematic rail / insight panels — moonlit copy in light theme */
export const solaceDarkPanel = cn(
  "solace-on-dark solace-dark-panel",
  "rounded-[26px] border border-white/10 bg-[rgba(15,18,32,0.82)] backdrop-blur-xl"
);

/** Community page shell — light theme uses white page + cards */
export const communityPageRoot =
  "community-page relative min-h-screen overflow-hidden bg-[var(--solace-page-bg,var(--solace-bg))] text-[var(--solace-text)] transition-colors duration-500";

export const communityPageAtmosphere =
  "community-page-atmosphere pointer-events-none absolute inset-0";

/** Feed post shell — light theme uses plain white cards (no solace-on-dark). */
export const communityFeedPostCard = cn(
  "community-feed-post relative overflow-hidden rounded-2xl border transition-colors duration-300",
  "[html:not([data-theme=light]):not([data-ezri-theme=light])]:border-white/[0.08]",
  "[html:not([data-theme=light]):not([data-ezri-theme=light])]:shadow-[0_20px_55px_-38px_rgba(0,0,0,0.8)]",
  "[html:not([data-theme=light]):not([data-ezri-theme=light])]:hover:border-violet-400/25",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--solace-card-border)] [html[data-ezri-theme=light]_&]:bg-white [html[data-ezri-theme=light]_&]:shadow-[var(--solace-card-shadow)] [html[data-ezri-theme=light]_&]:hover:border-violet-300/40",
  "[html[data-theme=light]_&]:border-[color:var(--solace-card-border)] [html[data-theme=light]_&]:bg-white [html[data-theme=light]_&]:shadow-[var(--solace-card-shadow)] [html[data-theme=light]_&]:hover:border-violet-300/40",
);

/** Dark-theme cinematic feed posts only — keeps moonlit copy on scrims. */
export const communityFeedPostCinematic = cn(
  "[html:not([data-theme=light]):not([data-ezri-theme=light])]:solace-image-card",
  "[html:not([data-theme=light]):not([data-ezri-theme=light])]:solace-on-dark",
);

export const communityRailPanel = cn(
  "community-rail-panel",
  solaceDarkPanel,
  "[html[data-ezri-theme=light]_&]:solace-rail-card [html[data-ezri-theme=light]_&]:!border-[color:var(--rail-card-border,var(--solace-card-border))] [html[data-ezri-theme=light]_&]:!bg-[var(--rail-card-bg)] [html[data-ezri-theme=light]_&]:!text-[var(--solace-text)] [html[data-ezri-theme=light]_&]:!shadow-[var(--solace-card-shadow)]",
  "[html[data-theme=light]_&]:solace-rail-card [html[data-theme=light]_&]:!border-[color:var(--rail-card-border,var(--solace-card-border))] [html[data-theme=light]_&]:!bg-[var(--rail-card-bg)] [html[data-theme=light]_&]:!text-[var(--solace-text)] [html[data-theme=light]_&]:!shadow-[var(--solace-card-shadow)]"
);

/** Wrap full-bleed hero sections — enables light-theme image + overlay fixes */
export const solaceHeroMediaShell = cn(
  "solace-hero-media",
  solaceImageCard,
  "relative isolate overflow-hidden"
);

/** Text block over hero imagery in light theme (dark readable copy) */
export const solaceHeroContent = "solace-hero-content relative z-10";

/** Full-bleed scenic footer / privacy strip — moonlit copy in light theme */
export const solaceCinematicBanner = cn(
  "solace-cinematic-banner",
  solaceHeroMediaShell,
  "relative overflow-hidden rounded-3xl border border-white/[0.08]",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-theme=light]_&]:border-[color:var(--border)]"
);

export const solaceCinematicBannerOverlay = cn(
  "pointer-events-none absolute inset-0 z-[1]",
  "bg-gradient-to-r from-[#07080f]/97 via-[#07080f]/88 to-[#07080f]/55"
);

export const solaceCinematicBannerContent = cn(
  solaceHeroContent,
  "solace-cinematic-banner-content relative z-10 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-8"
);

export const solaceCinematicBannerTitle =
  "font-medium text-zinc-100 [text-shadow:0_1px_12px_rgba(0,0,0,0.5)]";

export const solaceCinematicBannerBody = cn(
  "mt-1 text-sm leading-relaxed text-zinc-400 [text-shadow:0_1px_10px_rgba(0,0,0,0.45)]"
);

export const solaceCinematicBannerLink = cn(
  "text-violet-300/90 underline-offset-2 hover:text-violet-200 hover:underline [text-shadow:0_1px_8px_rgba(0,0,0,0.4)]"
);

/** Icon well on scenic banners — dark glass so the glyph stays visible in light theme */
export const solaceCinematicBannerIcon = cn(
  "solace-cinematic-banner-icon flex size-12 shrink-0 items-center justify-center rounded-2xl",
  "border border-violet-400/25 bg-[rgba(15,18,32,0.72)] text-violet-200",
  "shadow-[0_0_24px_-8px_rgba(139,92,246,0.45)] backdrop-blur-md",
  "[&_svg]:size-6 [&_svg]:text-violet-200"
);

/** Optional extra pastel scrim (light theme CSS) */
export const solaceHeroLightScrim = cn(
  "solace-hero-light-scrim pointer-events-none absolute inset-0 z-[1]",
  "hidden [html[data-ezri-theme=light]_&]:block [html[data-theme=light]_&]:block"
);

export const solaceHeroOverlayReadability = cn(
  "pointer-events-none absolute inset-0 z-[1]",
  "bg-[linear-gradient(90deg,rgba(10,11,24,0.62)_0%,rgba(10,11,24,0.28)_40%,transparent_62%)]",
  "[html[data-ezri-theme=light]_&]:bg-[var(--hero-overlay-readability)]",
  "[html[data-theme=light]_&]:bg-[var(--hero-overlay-readability)]"
);

export const solaceHeroOverlayBottom = cn(
  "pointer-events-none absolute inset-0 z-[1]",
  "bg-[linear-gradient(180deg,transparent_0%,rgba(5,8,22,0.28)_50%,rgba(5,8,22,0.62)_100%)]",
  "[html[data-ezri-theme=light]_&]:bg-[linear-gradient(180deg,transparent_0%,rgba(243,236,255,0.16)_50%,rgba(239,231,255,0.4)_100%)]",
  "[html[data-theme=light]_&]:bg-[linear-gradient(180deg,transparent_0%,rgba(243,236,255,0.16)_50%,rgba(239,231,255,0.4)_100%)]"
);

export const solaceHeroOverlayAccent = cn(
  "pointer-events-none absolute inset-0 z-[1]",
  "bg-[radial-gradient(ellipse_70%_80%_at_85%_40%,rgba(192,132,252,0.14),transparent_55%)]",
  "[html[data-ezri-theme=light]_&]:bg-[radial-gradient(ellipse_70%_80%_at_85%_40%,rgba(167,139,250,0.12),transparent_55%)]"
);

export const solaceSectionTitle =
  "text-sm font-semibold uppercase tracking-[0.22em] text-[var(--solace-muted)]";

export const solaceSectionHeading = cn(
  "font-serif text-[1.35rem] font-light tracking-tight text-[var(--solace-text)] sm:text-[1.45rem]"
);

export const solaceSectionSubtitle = "mt-1 text-sm text-[var(--solace-muted)]";

export const solaceRowLink = cn(
  "group flex min-h-[44px] items-center gap-3.5 px-4 py-3.5 sm:px-5 sm:py-4",
  "transition-all duration-300",
  "hover:bg-[color-mix(in_srgb,var(--accent-secondary,#a78bfa)_8%,transparent)]"
);

/** Accent-driven gradient CTA — fill via --button-primary in appearanceTheme.css */
export const solaceCtaGradient = cn(
  "solace-cta-gradient inline-flex items-center justify-center gap-2 font-semibold text-white",
  "transition-opacity hover:opacity-95"
);

export const solaceBtnPrimary = cn(
  "solace-btn-primary solace-cta-gradient inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-[var(--text-inverse,#ffffff)]",
  "transition-all duration-300"
);

export const solaceBtnSecondary = cn(
  "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold",
  "border-[color:var(--button-secondary-border,#d8c7f7)] bg-[var(--button-secondary-bg,#f6f0ff)] text-[color:var(--button-secondary-text,#5b21b6)]",
  "transition-all duration-300 hover:border-[color:var(--solace-ds-border-glow)] hover:shadow-[0_0_20px_-8px_rgba(167,139,250,0.18)]"
);

export const solaceQuickCard = cn(
  "light-theme-card light-theme-card-hover flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border border-[color:var(--solace-border)] p-3",
  "bg-[var(--solace-ds-surface)] text-[var(--solace-text)] shadow-[var(--solace-card-shadow)]",
  "active:scale-[0.98]"
);

export const solaceCompactToolCard = cn(
  "light-theme-card light-theme-card-hover group flex min-h-[100px] flex-col justify-between rounded-2xl border border-[color:var(--solace-border)] p-4",
  "bg-[var(--solace-ds-surface)] text-[var(--solace-text)] shadow-[var(--solace-card-shadow)]"
);

/** Opt-in: standard card/row text inherits theme tokens inside .solace-app */
export const solaceSurface = "solace-surface text-[var(--solace-text)]";

export const solaceInputSurface = cn(
  "min-h-[40px] w-full appearance-none rounded-full border border-[color:var(--input-border)]",
  "bg-[var(--input-bg)] px-4 text-[var(--solace-text)] placeholder:text-[var(--solace-muted)]",
  "focus-visible:border-[color:var(--accent-secondary,#a78bfa)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-secondary,#a78bfa)]/30"
);

export const solaceGlassPanel = cn(
  solaceCard,
  "rounded-[1.75rem] p-5 sm:p-7"
);

export const solaceOptionCard = cn(
  "relative flex w-full items-start gap-4 rounded-[1.25rem] border border-[color:var(--solace-border)] p-4 text-left",
  "bg-[var(--solace-ds-surface)] shadow-[var(--solace-card-shadow)]",
  "transition-all duration-300 hover:border-[color:var(--solace-ds-border-glow)]"
);

export const solaceOptionCardSelected = cn(
  "appearance-selection-active border border-[color:var(--appearance-selection-border,var(--solace-ds-border-glow))]"
);

export const solaceBackLink = cn(
  "inline-flex min-h-[40px] items-center gap-2 text-xs font-medium tracking-[0.08em] text-[color:var(--accent-secondary,#a78bfa)]/70",
  "transition-colors hover:text-[color:var(--accent-secondary,#a78bfa)]"
);
