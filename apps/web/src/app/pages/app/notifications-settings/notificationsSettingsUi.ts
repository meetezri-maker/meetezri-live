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
  settingsSubpageHeroOrb,
  settingsSubpageHeroOrbGlow,
  settingsSubpageHeroOrbIcon,
  settingsSubpageHeroOrbLabel,
  settingsSubpageHeroOrbQuote,
  settingsSubpageHeroOrbValue,
  settingsSubpageHeroOrbWrap,
  settingsSubpageHeroOverlayAccent,
  settingsSubpageHeroOverlayBottom,
  settingsSubpageHeroOverlayReadability,
  settingsSubpageHeroShell,
  settingsSubpageHeroTitleSerif,
} from "@/app/pages/app/settings-hub/settingsSubpageHero";

export const NOTIFICATIONS_HERO_IMG = SETTINGS_SUBPAGE_HERO_IMG;
export const NOTIFICATIONS_FOREST_IMG = "/community/scene-forest.jpg";
export const NOTIFICATIONS_WATER_IMG = "/community/scene-water.jpg";

export const notificationsHeroCard = settingsSubpageHeroShell;
export const notificationsHeroImage = settingsSubpageHeroImage;
export const notificationsHeroLightScrim = settingsSubpageHeroLightScrim;
export const notificationsHeroOverlayReadability = settingsSubpageHeroOverlayReadability;
export const notificationsHeroOverlayBottom = settingsSubpageHeroOverlayBottom;
export const notificationsHeroOverlayAccent = settingsSubpageHeroOverlayAccent;
export const notificationsHeroInner = settingsSubpageHeroInner;
export const notificationsHeroCopy = settingsSubpageHeroCopy;
export const notificationsBackLink = settingsSubpageHeroBackLink;
export const notificationsHeroTitle = settingsSubpageHeroTitleSerif;
export const notificationsHeroAccent = settingsSubpageHeroAccent;
export const notificationsHeroLead = settingsSubpageHeroLead;
export const notificationsHeroBody = settingsSubpageHeroBody;
export const notificationsHeroOrbWrap = settingsSubpageHeroOrbWrap;
export const notificationsHeroOrbGlow = settingsSubpageHeroOrbGlow;
export const notificationsHeroOrb = settingsSubpageHeroOrb;
export const notificationsHeroOrbIcon = settingsSubpageHeroOrbIcon;
export const notificationsHeroOrbValue = settingsSubpageHeroOrbValue;
export const notificationsHeroOrbLabel = settingsSubpageHeroOrbLabel;
export const notificationsHeroOrbQuote = settingsSubpageHeroOrbQuote;

export const notificationsPageAtmosphere = cn(
  settingsPageAtmosphere
);

export const notificationsPageGlowTop = settingsPageGlowTop;
export const notificationsPageFogMid = settingsPageFogMid;
export const notificationsPageVignette = settingsPageVignette;

export const notificationsGlassCard = cn(
  settingsCard,
  "rounded-[1.75rem] border-white/[0.06]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_48px_-16px_rgba(139,92,246,0.14),0_28px_72px_-40px_rgba(0,0,0,0.75)]"
);

export const notificationsRailCard = cn(
  notificationsGlassCard,
  "rounded-3xl p-5 sm:p-6",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_40px_-14px_rgba(139,92,246,0.18),0_24px_64px_-36px_rgba(0,0,0,0.72)]"
);

export const notificationsIconChip = settingsIconChip;

/** @deprecated Use notificationsHeroOverlayReadability — kept for gradual migration */
export const notificationsHeroOverlayLeft = notificationsHeroOverlayReadability;
export const notificationsHeroOverlayPurple = notificationsHeroOverlayAccent;
export const notificationsHeroOverlayWarmth = notificationsHeroOverlayBottom;

export const notificationsGroupLabel = cn(
  "text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300/45"
);

export const notificationsTimelinePanel = cn(
  notificationsGlassCard,
  "overflow-hidden rounded-3xl p-0"
);

export const notificationsTimelineRow = cn(
  "group flex min-h-[84px] items-center gap-4 border-b border-white/[0.05] px-4 py-4 last:border-b-0 sm:px-5",
  "transition-colors hover:bg-violet-500/[0.04]"
);

export const notificationsFilterPill = (active: boolean) =>
  cn(
    "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition-all duration-300",
    active
      ? "border-violet-400/35 bg-violet-500/20 text-violet-100 shadow-[0_0_24px_-8px_rgba(139,92,246,0.45)]"
      : "border-white/[0.08] bg-white/[0.03] text-[rgba(255,255,255,0.55)] hover:border-violet-400/20 hover:bg-violet-500/[0.08] hover:text-white/80"
  );

export const notificationsSearchInput = cn(
  "min-h-[44px] w-full rounded-2xl border border-white/[0.08] bg-[rgba(10,12,28,0.72)]",
  "pl-10 pr-4 text-sm text-white placeholder:text-[rgba(255,255,255,0.35)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35"
);

export const notificationsBtnGhost = cn(
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-white/[0.1] px-4 py-2",
  "bg-[linear-gradient(180deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.02)_100%)]",
  "text-sm font-semibold text-[rgba(255,255,255,0.9)]",
  "transition-all duration-300 hover:border-violet-300/28 hover:bg-violet-500/[0.1]"
);

export const notificationsBtnPrimary = cn(
  "inline-flex min-h-[40px] items-center justify-center rounded-full px-5 py-2 text-xs font-semibold text-white",
  "bg-[linear-gradient(135deg,#7C3AED_0%,#C026D3_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_32px_-6px_rgba(168,85,247,0.5)]",
  "transition-all duration-300 hover:brightness-110"
);

export const notificationsPriorityCard = (tone: "pink" | "amber" | "violet") =>
  cn(
    "relative flex min-h-[178px] flex-col justify-between overflow-hidden rounded-3xl border p-5",
    "bg-[linear-gradient(160deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.01)_55%,rgba(139,92,246,0.04)_100%)]",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] transition-all duration-300 hover:-translate-y-0.5",
    {
      pink: "border-fuchsia-400/22 hover:shadow-[0_0_36px_-12px_rgba(236,72,153,0.35)]",
      amber: "border-amber-400/22 hover:shadow-[0_0_36px_-12px_rgba(251,191,36,0.32)]",
      violet: "border-violet-400/22 hover:shadow-[0_0_36px_-12px_rgba(139,92,246,0.32)]",
    }[tone]
  );

export const notificationsActionPill = (tone: "cyan" | "green" | "amber" | "blue" | "teal") =>
  cn(
    "inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
    {
      cyan: "border-cyan-400/25 bg-cyan-500/10 text-cyan-200/90",
      green: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200/90",
      amber: "border-amber-400/25 bg-amber-500/10 text-amber-200/90",
      blue: "border-blue-400/25 bg-blue-500/10 text-blue-200/90",
      teal: "border-teal-400/25 bg-teal-500/10 text-teal-200/90",
    }[tone]
  );
