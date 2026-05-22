import { cn } from "@/lib/utils";
import {
  settingsIconChip,
  settingsPageAtmosphere,
  settingsPageFogMid,
  settingsPageGlowTop,
  settingsPageVignette,
  settingsCard,
} from "@/app/pages/app/settings-hub/settingsUi";

export const WELLNESS_PLAN_HERO_IMG = "/community/hero-lake.jpg";
export const WELLNESS_PLAN_BANNER_IMG = "/community/scene-water.jpg";

export const wellnessPlanPageAtmosphere = cn(
  settingsPageAtmosphere
);

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
  wellnessPlanGlassCard,
  "relative min-h-[280px] overflow-hidden rounded-[2rem] border-rose-400/14 sm:min-h-[300px] lg:min-h-[320px]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_0_72px_-18px_rgba(244,63,94,0.22),0_0_56px_-20px_rgba(139,92,246,0.28),0_32px_80px_-40px_rgba(0,0,0,0.82)]"
);

export const wellnessPlanHeroImage = cn(
  "absolute inset-0 h-full w-full object-cover object-[72%_38%]",
  "brightness-[0.42] contrast-[0.98] saturate-[1.15]"
);

export const wellnessPlanHeroOverlayLeft = cn(
  "absolute inset-0",
  "bg-gradient-to-r from-[#0a0b18] via-[#0a0b18]/82 to-[#0a0b18]/12 lg:from-[#0a0b18]/97 lg:via-[#0a0b18]/58 lg:to-transparent"
);

export const wellnessPlanHeroOverlayPurple = cn(
  "absolute inset-0",
  "bg-[radial-gradient(ellipse_75%_85%_at_88%_42%,rgba(192,132,252,0.28)_0%,transparent_58%)]"
);

export const wellnessPlanHeroOverlayWarmth = cn(
  "absolute inset-0",
  "bg-[radial-gradient(ellipse_38%_34%_at_78%_68%,rgba(251,146,60,0.22)_0%,transparent_55%)]"
);

export const wellnessPlanIconChip = settingsIconChip;

export const wellnessPlanBackLink = cn(
  "inline-flex min-h-[40px] items-center gap-2 text-xs font-medium tracking-[0.1em] text-rose-300/55",
  "transition-colors hover:text-rose-200/95"
);

export const wellnessPlanHeroTitle = cn(
  "font-serif text-[clamp(2rem,4.2vw,3rem)] font-light leading-[1.06] tracking-tight text-white"
);

export const wellnessPlanHandwritten = cn(
  "font-serif text-lg italic text-rose-300/85",
  "drop-shadow-[0_0_20px_rgba(244,63,94,0.25)]"
);

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

export const wellnessPlanBottomBanner = cn(
  "relative min-h-[140px] overflow-hidden rounded-3xl border border-rose-400/12",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_48px_-16px_rgba(139,92,246,0.18)]"
);

export const wellnessPlanRailActionRow = cn(
  "flex min-h-[48px] w-full items-center gap-3 rounded-2xl border border-white/[0.06]",
  "bg-[linear-gradient(160deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.01)_100%)] px-4 py-3",
  "text-left text-sm font-medium text-[rgba(255,255,255,0.82)]",
  "transition-all duration-300 hover:border-violet-400/22 hover:bg-violet-500/[0.07]"
);
