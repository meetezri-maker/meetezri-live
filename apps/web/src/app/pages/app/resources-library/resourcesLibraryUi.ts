import { cn } from "@/lib/utils";
import { solaceInputSurface } from "@/app/solace/solacePageChrome";
import {
  settingsPageAtmosphere,
  settingsPageFogMid,
  settingsPageGlowTop,
  settingsPageVignette,
} from "@/app/pages/app/settings-hub/settingsUi";
import {
  SETTINGS_SUBPAGE_HERO_IMG,
  settingsSubpageHeroBackLink,
  settingsSubpageHeroImage,
  settingsSubpageHeroLightScrim,
  settingsSubpageHeroOverlayAccent,
  settingsSubpageHeroOverlayBottom,
  settingsSubpageHeroOverlayReadability,
  settingsSubpageHeroShell,
  settingsSubpageHeroTitleSerif,
} from "@/app/pages/app/settings-hub/settingsSubpageHero";

const light = "[html[data-ezri-theme=light]_&]";
const lightAlt = "[html[data-theme=light]_&]";

export const RESOURCES_HERO_IMG = SETTINGS_SUBPAGE_HERO_IMG;

export const resourcesPageAtmosphere = cn(settingsPageAtmosphere, "resources-library-page");

export const resourcesPageGlowTop = settingsPageGlowTop;
export const resourcesPageFogMid = settingsPageFogMid;
export const resourcesPageVignette = settingsPageVignette;

export const resourcesHeroCard = cn(
  settingsSubpageHeroShell,
  "resources-hero-card min-h-[220px] sm:min-h-[260px] lg:min-h-[300px]"
);

export const resourcesHeroImage = cn(settingsSubpageHeroImage, "object-[center_42%]");
export const resourcesHeroLightScrim = settingsSubpageHeroLightScrim;
export const resourcesHeroOverlay = settingsSubpageHeroOverlayReadability;
export const resourcesHeroGlowPurple = settingsSubpageHeroOverlayAccent;
export const resourcesHeroGlowWarmth = settingsSubpageHeroOverlayBottom;

export const resourcesBackLink = cn(settingsSubpageHeroBackLink, "resources-hero-eyebrow");

export const resourcesHeroTitle = cn(
  settingsSubpageHeroTitleSerif,
  "resources-hero-title text-[clamp(2rem,4.2vw,3.15rem)]"
);

export const resourcesHeroSubtitle = cn(
  "resources-hero-subtitle mt-2 max-w-2xl text-sm leading-relaxed sm:text-[0.95rem]",
  "text-[rgba(255,255,255,0.62)]",
  `${light}:text-[var(--text-secondary)]`,
  `${lightAlt}:text-[var(--text-secondary)]`
);

export const resourcesSearchInput = cn(
  solaceInputSurface,
  "w-full min-h-[44px] pl-11 pr-4 text-sm shadow-[var(--solace-card-shadow)]"
);

export const resourcesSearchIcon = "resources-search-icon";

export const resourcesSelect = cn(
  solaceInputSurface,
  "min-h-[44px] w-full px-4 py-2.5 pr-9 text-sm font-medium sm:w-52 shadow-[var(--solace-card-shadow)]"
);

export const resourcesCardShell = cn(
  "group flex h-full flex-col overflow-hidden rounded-[1.4rem] border",
  "border-white/[0.07] bg-[linear-gradient(180deg,rgba(16,16,36,0.98)_0%,rgba(9,9,22,0.99)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_40px_-16px_rgba(139,92,246,0.12),0_20px_56px_-32px_rgba(0,0,0,0.75)]",
  "transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-400/22",
  `${light}:border-[color:var(--border)] ${light}:bg-white ${light}:shadow-[var(--solace-card-shadow)]`,
  `${lightAlt}:border-[color:var(--border)] ${lightAlt}:bg-white`
);

export const resourcesCardBody = "resource-card-body flex flex-1 flex-col p-4 sm:p-[1.125rem]";

export const resourcesCardTitle =
  "resource-card-title line-clamp-2 text-[0.95rem] font-bold leading-snug text-white";

export const resourcesCardDesc =
  "resource-card-desc line-clamp-3 flex-1 text-sm leading-relaxed text-[rgba(255,255,255,0.48)]";

export const resourcesCardMeta =
  "resource-card-meta mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[rgba(255,255,255,0.42)]";

export const resourcesCardTag = cn(
  "resource-card-tag w-fit rounded-lg border border-white/10 bg-black/30 px-2 py-0.5",
  "text-[9px] font-semibold uppercase tracking-[0.12em] text-white/70"
);

export const resourcesReadBtn = cn(
  "flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white",
  "bg-[linear-gradient(135deg,#7C3AED_0%,#C026D3_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_0_32px_-8px_rgba(168,85,247,0.5)]",
  "transition-all duration-300 hover:brightness-110"
);

export const resourcesExternalBtn = cn(
  "resource-external-btn flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/[0.1]",
  "bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.75)]",
  "transition-all duration-300 hover:border-violet-400/25 hover:bg-violet-500/[0.1] hover:text-white"
);

export const resourcesFavoriteBtn = (active: boolean) =>
  cn(
    "resource-favorite-btn flex h-9 w-9 items-center justify-center rounded-xl border backdrop-blur-md transition-all duration-300",
    active && "resource-favorite-btn--active",
    active
      ? "border-rose-400/30 bg-rose-500/20 text-rose-300 shadow-[0_0_20px_-6px_rgba(244,63,94,0.45)]"
      : "border-white/[0.08] bg-black/30 text-white/80 hover:border-violet-400/25 hover:bg-violet-500/15 hover:text-white"
  );

export interface ResourceCardAtmosphere {
  visualBg: string;
  radialGlow: string;
  iconClass: string;
  pillClass: string;
}

/** Category visual header — stays dark/cinematic; body uses light surface in light theme */
export function getResourceCardAtmosphere(category: string): ResourceCardAtmosphere {
  const key = category.toLowerCase();

  if (key.includes("self") || key.includes("love") || key === "self-care") {
    return {
      visualBg: "bg-gradient-to-b from-rose-950/90 via-[#1a0a14] to-[#0c0812]",
      radialGlow: "bg-[radial-gradient(ellipse_70%_60%_at_50%_35%,rgba(244,63,94,0.28)_0%,transparent_62%)]",
      iconClass: "text-rose-200/90 drop-shadow-[0_0_28px_rgba(244,114,182,0.55)]",
      pillClass: "border-rose-400/25 bg-rose-500/12 text-rose-200/90",
    };
  }
  if (key.includes("anxious") || key.includes("anxiety") || key.includes("stress")) {
    return {
      visualBg: "bg-gradient-to-b from-amber-950/85 via-[#1a1208] to-[#0e0a08]",
      radialGlow: "bg-[radial-gradient(ellipse_70%_60%_at_50%_35%,rgba(251,146,60,0.26)_0%,transparent_62%)]",
      iconClass: "text-amber-200/90 drop-shadow-[0_0_28px_rgba(251,191,36,0.5)]",
      pillClass: "border-amber-400/25 bg-amber-500/12 text-amber-200/90",
    };
  }
  if (key.includes("sleep")) {
    return {
      visualBg: "bg-gradient-to-b from-indigo-950/90 via-[#0f0a24] to-[#080818]",
      radialGlow: "bg-[radial-gradient(ellipse_70%_60%_at_50%_35%,rgba(129,140,248,0.3)_0%,transparent_62%)]",
      iconClass: "text-indigo-200/90 drop-shadow-[0_0_28px_rgba(129,140,248,0.55)]",
      pillClass: "border-indigo-400/25 bg-indigo-500/12 text-indigo-200/90",
    };
  }
  if (key.includes("exercise") || key.includes("movement")) {
    return {
      visualBg: "bg-gradient-to-b from-emerald-950/88 via-[#081612] to-[#060e0c]",
      radialGlow: "bg-[radial-gradient(ellipse_70%_60%_at_50%_35%,rgba(52,211,153,0.26)_0%,transparent_62%)]",
      iconClass: "text-emerald-200/90 drop-shadow-[0_0_28px_rgba(52,211,153,0.5)]",
      pillClass: "border-emerald-400/25 bg-emerald-500/12 text-emerald-200/90",
    };
  }
  if (key.includes("relax") || key.includes("music") || key.includes("sound")) {
    return {
      visualBg: "bg-gradient-to-b from-cyan-950/88 via-[#061418] to-[#050c10]",
      radialGlow: "bg-[radial-gradient(ellipse_70%_60%_at_50%_35%,rgba(34,211,238,0.24)_0%,transparent_62%)]",
      iconClass: "text-cyan-200/90 drop-shadow-[0_0_28px_rgba(34,211,238,0.45)]",
      pillClass: "border-cyan-400/25 bg-cyan-500/12 text-cyan-200/90",
    };
  }
  if (key.includes("meditation") || key.includes("mindful") || key.includes("brain")) {
    return {
      visualBg: "bg-gradient-to-b from-violet-950/90 via-[#140a22] to-[#0a0614]",
      radialGlow: "bg-[radial-gradient(ellipse_70%_60%_at_50%_35%,rgba(167,139,250,0.3)_0%,transparent_62%)]",
      iconClass: "text-violet-200/90 drop-shadow-[0_0_28px_rgba(167,139,250,0.55)]",
      pillClass: "border-violet-400/25 bg-violet-500/12 text-violet-200/90",
    };
  }
  if (key.includes("morale") || key.includes("healing") || key.includes("gratitude")) {
    return {
      visualBg: "bg-gradient-to-b from-teal-950/88 via-[#081614] to-[#060e0c]",
      radialGlow: "bg-[radial-gradient(ellipse_70%_60%_at_50%_35%,rgba(45,212,191,0.24)_0%,transparent_62%)]",
      iconClass: "text-teal-200/90 drop-shadow-[0_0_28px_rgba(45,212,191,0.45)]",
      pillClass: "border-teal-400/25 bg-teal-500/12 text-teal-200/90",
    };
  }

  return {
    visualBg: "bg-gradient-to-b from-slate-900/90 via-[#101018] to-[#08080f]",
    radialGlow: "bg-[radial-gradient(ellipse_70%_60%_at_50%_35%,rgba(139,92,246,0.22)_0%,transparent_62%)]",
    iconClass: "text-violet-200/85 drop-shadow-[0_0_24px_rgba(167,139,250,0.4)]",
    pillClass: "border-violet-400/22 bg-violet-500/10 text-violet-200/85",
  };
}

export function getDifficultyPillClass(difficulty: string): string {
  const base = "rounded-md border px-2 py-0.5 text-[10px] font-semibold capitalize";
  const colors: Record<string, string> = {
    beginner: cn(base, "resource-difficulty--beginner border-emerald-400/22 bg-emerald-500/12 text-emerald-200/90"),
    intermediate: cn(base, "resource-difficulty--intermediate border-amber-400/22 bg-amber-500/12 text-amber-200/90"),
    advanced: cn(base, "resource-difficulty--advanced border-rose-400/22 bg-rose-500/12 text-rose-200/90"),
  };
  return colors[difficulty] ?? colors.beginner;
}

export function formatCategoryLabel(category: string): string {
  return category.replace(/\s+/g, " ").toUpperCase();
}

export const resourcesEmptyState = cn(
  "resources-empty-state mt-8 rounded-[1.4rem] border border-dashed border-white/[0.12]",
  "bg-[linear-gradient(180deg,rgba(16,16,36,0.6)_0%,rgba(9,9,22,0.75)_100%)] px-6 py-16 text-center"
);

export const resourcesEmptyTitle = "resources-empty-title text-lg font-semibold text-white";

export const resourcesEmptyDesc = "resources-empty-desc mx-auto mt-2 max-w-md text-sm text-[rgba(255,255,255,0.48)]";

export const resourcesFooterMuted = "resources-footer-muted text-sm text-[rgba(255,255,255,0.42)]";

export const resourcesFooterFine = "resources-footer-muted mt-1 text-xs text-[rgba(255,255,255,0.32)]";

export const resourcesArticleShell = cn(
  "overflow-hidden rounded-[1.4rem] border border-white/[0.07]",
  "bg-[linear-gradient(180deg,rgba(16,16,36,0.98)_0%,rgba(9,9,22,0.99)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_40px_-16px_rgba(139,92,246,0.12),0_20px_56px_-32px_rgba(0,0,0,0.75)]",
  `${light}:border-[color:var(--border)] ${light}:bg-white ${light}:shadow-[var(--solace-card-shadow)]`
);

export const resourcesArticleTitle = cn(
  "font-serif text-[clamp(1.65rem,3.5vw,2.35rem)] font-light leading-[1.1] tracking-tight",
  "text-[var(--solace-text)]"
);

export const resourcesArticleBodyText =
  "text-[0.95rem] leading-relaxed text-[var(--solace-muted)] sm:text-base";

export const resourcesArticleStepShell = cn(
  "flex gap-4 rounded-xl border border-white/[0.08] p-4 sm:p-5",
  "bg-[rgba(255,255,255,0.03)]",
  `${light}:border-[color:var(--border)] ${light}:bg-[var(--card-soft)]`
);

export const resourcesArticleStepNumber = cn(
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
  "bg-[linear-gradient(135deg,#7C3AED_0%,#C026D3_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_0_24px_-8px_rgba(168,85,247,0.45)]"
);
