import { cn } from "@/lib/utils";
import {
  solaceCard,
  solaceHeroContent,
  solaceHeroImage,
  solaceHeroLightScrim,
  solaceHeroMediaShell,
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

export const achievementsPageRoot = cn(achievementsPageAtmosphere, "achievements-page");

export const achievementsCard = cn(
  solaceCard,
  "rounded-2xl border-white/[0.07]",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-theme=light]_&]:border-[color:var(--border)]"
);

export const achievementsStatIconChip = (tone: "amber" | "violet" | "emerald" | "blue") =>
  cn("solace-icon-chip", `solace-icon-chip--${tone}`, "!h-9 !w-9 [&_svg]:!h-4 [&_svg]:!w-4");

export const achievementsCategoryPill = (active: boolean) =>
  cn(
    "inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors sm:px-3 sm:py-1.5",
    active
      ? cn(
          "border-fuchsia-400/30 bg-fuchsia-950/40 text-white shadow-[0_0_20px_-8px_rgba(168,85,247,0.35)]",
          "[html[data-ezri-theme=light]_&:border-violet-300/50 [html[data-ezri-theme=light]_&:bg-violet-100 [html[data-ezri-theme=light]_&:text-violet-900 [html[data-ezri-theme=light]_&:shadow-[var(--solace-card-shadow)]",
          "[html[data-theme=light]_&:border-violet-300/50 [html[data-theme=light]_&:bg-violet-100 [html[data-theme=light]_&:text-violet-900 [html[data-theme=light]_&:shadow-[var(--solace-card-shadow)]"
        )
      : cn(
          "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:border-white/15 hover:bg-white/[0.05] hover:text-zinc-200",
          "[html[data-ezri-theme=light]_&:border-[color:var(--border)] [html[data-ezri-theme=light]_&:bg-[var(--card-soft)] [html[data-ezri-theme=light]_&:text-[var(--text-secondary)]",
          "[html[data-ezri-theme=light]_&:hover:border-violet-300/40 [html[data-ezri-theme=light]_&:hover:bg-violet-50/80 [html[data-ezri-theme=light]_&:hover:text-violet-900",
          "[html[data-theme=light]_&:border-[color:var(--border)] [html[data-theme=light]_&:bg-[var(--card-soft)] [html[data-theme=light]_&:text-[var(--text-secondary)]",
          "[html[data-theme=light]_&:hover:border-violet-300/40 [html[data-theme=light]_&:hover:bg-violet-50/80 [html[data-theme=light]_&:hover:text-violet-900"
        )
  );

export const achievementsRecentSection = cn(
  achievementsCard,
  "relative overflow-hidden p-6 backdrop-blur-md sm:p-7",
  "bg-[linear-gradient(120deg,rgba(251,191,36,0.06),rgba(88,28,135,0.08),#0a0f1a)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  "[html[data-ezri-theme=light]_&:border-[color:var(--border)] [html[data-ezri-theme=light]_&:bg-[linear-gradient(135deg,#fff8eb_0%,#f6f0ff_52%,#ecfdfb_100%)] [html[data-ezri-theme=light]_&:shadow-[var(--solace-card-shadow)]",
  "[html[data-theme=light]_&:border-[color:var(--border)] [html[data-theme=light]_&:bg-[linear-gradient(135deg,#fff8eb_0%,#f6f0ff_52%,#ecfdfb_100%)] [html[data-theme=light]_&:shadow-[var(--solace-card-shadow)]"
);

export const achievementsRecentBadgeIcon = cn(
  "relative z-10 h-12 w-12 text-amber-100/95",
  "[html[data-ezri-theme=light]_&:text-amber-700 [html[data-theme=light]_&:text-amber-700"
);

export const achievementsRecentLabel = cn(
  "text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/85",
  "[html[data-ezri-theme=light]_&:text-amber-800 [html[data-theme=light]_&:text-amber-800"
);

export const achievementsBadgeCard = cn(
  achievementsCard,
  "light-theme-card-hover group relative flex min-h-[280px] flex-col overflow-hidden text-center backdrop-blur-md transition",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  "[html[data-ezri-theme=light]_&:shadow-[var(--solace-card-shadow)]",
  "[html[data-theme=light]_&:shadow-[var(--solace-card-shadow)]"
);

export const achievementsBadgeIconUnlocked = cn(
  "h-9 w-9 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]",
  "[html[data-ezri-theme=light]_&:text-violet-700 [html[data-ezri-theme=light]_&:drop-shadow-none",
  "[html[data-theme=light]_&:text-violet-700 [html[data-theme=light]_&:drop-shadow-none"
);

export const achievementsBadgeEmblemUnlocked = cn(
  "border-white/10 bg-gradient-to-br from-white/[0.07] to-black/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  "[html[data-ezri-theme=light]_&:border-amber-200/70 [html[data-ezri-theme=light]_&:from-amber-50 [html[data-ezri-theme=light]_&:to-violet-100/90 [html[data-ezri-theme=light]_&:shadow-[var(--solace-card-shadow)]",
  "[html[data-theme=light]_&:border-amber-200/70 [html[data-theme=light]_&:from-amber-50 [html[data-theme=light]_&:to-violet-100/90 [html[data-theme=light]_&:shadow-[var(--solace-card-shadow)]"
);

export const achievementsBadgeEmblemLocked = cn(
  "border-white/[0.06] bg-black/50 opacity-75 saturate-[0.7]",
  "[html[data-ezri-theme=light]_&:border-[color:var(--border)] [html[data-ezri-theme=light]_&:bg-violet-50/80 [html[data-ezri-theme=light]_&:opacity-100 [html[data-ezri-theme=light]_&:saturate-100",
  "[html[data-theme=light]_&:border-[color:var(--border)] [html[data-theme=light]_&:bg-violet-50/80 [html[data-theme=light]_&:opacity-100 [html[data-theme=light]_&:saturate-100"
);

export const achievementsRailIconChip = (tone: "violet" | "amber" | "cyan") =>
  cn("solace-icon-chip", `solace-icon-chip--${tone}`, "!h-11 !w-11 !rounded-2xl [&_svg]:!h-5 [&_svg]:!w-5");

export const achievementsRailCard = cn(solaceRailCard, "rounded-3xl p-5 sm:p-6");

export const achievementsHeroSection = cn(
  solaceHeroSection,
  "rounded-3xl border-white/[0.07]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_80px_-48px_rgba(0,0,0,0.85)]",
  "[html[data-ezri-theme=light]_&]:shadow-[var(--solace-card-shadow)]",
  "[html[data-theme=light]_&]:shadow-[var(--solace-card-shadow)]"
);

export const achievementsHeroShell = cn(solaceHeroMediaShell, achievementsHeroSection);
export const achievementsHeroImage = solaceHeroImage;
export const achievementsHeroLightScrim = solaceHeroLightScrim;
export const achievementsHeroContent = solaceHeroContent;

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

export const achievementsJourneySection = cn(
  achievementsCard,
  "relative overflow-hidden p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_20px_60px_-40px_rgba(0,0,0,0.75)] backdrop-blur-xl sm:p-8",
  "bg-[linear-gradient(125deg,rgba(10,14,24,0.96),rgba(24,12,40,0.45))]",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-ezri-theme=light]_&]:bg-[linear-gradient(135deg,#ffffff_0%,#f6f0ff_58%,#ecfdfb_100%)]",
  "[html[data-ezri-theme=light]_&]:shadow-[var(--solace-card-shadow)]",
  "[html[data-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-theme=light]_&]:bg-[linear-gradient(135deg,#ffffff_0%,#f6f0ff_58%,#ecfdfb_100%)]",
  "[html[data-theme=light]_&]:shadow-[var(--solace-card-shadow)]"
);

export const achievementsJourneyTitle = cn(
  "relative font-serif text-xl font-semibold text-white sm:text-2xl",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary)]",
  "[html[data-theme=light]_&]:text-[var(--text-primary)]"
);

export const achievementsJourneySubtitle = cn(
  "relative mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-secondary)]",
  "[html[data-theme=light]_&]:text-[var(--text-secondary)]"
);

export const achievementsJourneyFocusCard = cn(
  "relative mt-5 rounded-2xl border border-white/[0.08] bg-black/35 px-4 py-3 backdrop-blur-sm",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-ezri-theme=light]_&]:bg-[var(--card-muted,#f8f3ff)]",
  "[html[data-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-theme=light]_&]:bg-[var(--card-muted,#f8f3ff)]"
);

export type AchievementsJourneyNodeState = "active" | "passed" | "upcoming";

export const achievementsJourneyNodeCircle = (state: AchievementsJourneyNodeState) =>
  cn(
    "relative flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur-md transition [&_svg]:h-5 [&_svg]:w-5",
    state === "active" &&
      cn(
        "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-100 shadow-[0_0_22px_-6px_rgba(168,85,247,0.45)]",
        "[html[data-ezri-theme=light]_&]:border-violet-400/55 [html[data-ezri-theme=light]_&]:bg-violet-100",
        "[html[data-ezri-theme=light]_&]:text-violet-700 [html[data-ezri-theme=light]_&]:shadow-[0_0_20px_rgba(167,139,250,0.22)]",
        "[html[data-theme=light]_&]:border-violet-400/55 [html[data-theme=light]_&]:bg-violet-100",
        "[html[data-theme=light]_&]:text-violet-700 [html[data-theme=light]_&]:shadow-[0_0_20px_rgba(167,139,250,0.22)]"
      ),
    state === "passed" &&
      cn(
        "border-cyan-400/28 bg-cyan-500/8 text-cyan-100/90 shadow-[0_0_14px_-8px_rgba(34,211,238,0.25)]",
        "[html[data-ezri-theme=light]_&]:border-teal-300/70 [html[data-ezri-theme=light]_&]:bg-teal-50",
        "[html[data-ezri-theme=light]_&]:text-teal-700 [html[data-ezri-theme=light]_&]:shadow-[0_4px_14px_-6px_rgba(78,205,196,0.35)]",
        "[html[data-theme=light]_&]:border-teal-300/70 [html[data-theme=light]_&]:bg-teal-50",
        "[html[data-theme=light]_&]:text-teal-700 [html[data-theme=light]_&]:shadow-[0_4px_14px_-6px_rgba(78,205,196,0.35)]"
      ),
    state === "upcoming" &&
      cn(
        "border-white/[0.09] bg-white/[0.03] text-zinc-500",
        "[html[data-ezri-theme=light]_&]:border-[color:var(--border)] [html[data-ezri-theme=light]_&]:bg-violet-50/70",
        "[html[data-ezri-theme=light]_&]:text-violet-600/90",
        "[html[data-theme=light]_&]:border-[color:var(--border)] [html[data-theme=light]_&]:bg-violet-50/70",
        "[html[data-theme=light]_&]:text-violet-600/90"
      )
  );

export const achievementsJourneyNodeLabel = (active: boolean) =>
  cn(
    "text-[11px] font-semibold uppercase tracking-wide",
    active
      ? cn(
          "text-fuchsia-200/95",
          "[html[data-ezri-theme=light]_&]:text-violet-800 [html[data-theme=light]_&]:text-violet-800"
        )
      : cn(
          "text-zinc-500",
          "[html[data-ezri-theme=light]_&]:text-[var(--text-muted)] [html[data-theme=light]_&]:text-[var(--text-muted)]"
        )
  );

export const achievementsJourneyNodeSub = cn(
  "mt-1 text-[10px] leading-snug text-zinc-600",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-secondary)]",
  "[html[data-theme=light]_&]:text-[var(--text-secondary)]"
);
