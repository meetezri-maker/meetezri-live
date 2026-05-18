import { cn } from "@/lib/utils";
import {
  settingsCard,
  settingsIconChip,
  settingsPageAtmosphere,
  settingsPageFogMid,
  settingsPageGlowTop,
  settingsPageVignette,
  settingsSectionTitle,
} from "@/app/pages/app/settings-hub/settingsUi";

export const APPEARANCE_HERO_IMG = "/community/hero-lake.jpg";
export const APPEARANCE_LOTUS_IMG = "/community/scene-water.jpg";

export const appearancePageAtmosphere = cn(
  settingsPageAtmosphere,
  "bg-[linear-gradient(165deg,#0a0b18_0%,#090a16_42%,#0c0a18_100%)]"
);

export const appearancePageGlowTop = settingsPageGlowTop;
export const appearancePageFogMid = settingsPageFogMid;
export const appearancePageVignette = settingsPageVignette;

export const appearanceGlassCard = cn(
  settingsCard,
  "rounded-[1.75rem] border-white/[0.06]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_48px_-16px_rgba(139,92,246,0.14),0_28px_72px_-40px_rgba(0,0,0,0.75)]"
);

export const appearanceRailCard = cn(
  appearanceGlassCard,
  "rounded-[1.65rem] p-5 sm:p-6",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_40px_-14px_rgba(139,92,246,0.18),0_24px_64px_-36px_rgba(0,0,0,0.72)]"
);

export const appearanceHeroCard = cn(
  appearanceGlassCard,
  "relative min-h-[220px] overflow-hidden rounded-[2rem] border-violet-400/14 sm:min-h-[240px] lg:min-h-[250px]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_0_72px_-18px_rgba(139,92,246,0.32),0_32px_80px_-40px_rgba(0,0,0,0.82)]"
);

export const appearanceHeroImage = cn(
  "absolute inset-0 h-full w-full object-cover object-[72%_center]",
  "brightness-[0.5] contrast-[0.96] saturate-[1.14]"
);

export const appearanceHeroOverlayLeft = cn(
  "absolute inset-0",
  "bg-gradient-to-r from-[#0a0b18] via-[#0a0b18]/82 to-[#0a0b18]/15 lg:from-[#0a0b18]/95 lg:via-[#0a0b18]/62 lg:to-transparent"
);

export const appearanceHeroOverlayPurple = cn(
  "absolute inset-0",
  "bg-[radial-gradient(ellipse_75%_85%_at_78%_42%,rgba(192,132,252,0.24)_0%,transparent_58%)]"
);

export const appearanceHeroOverlayWarmth = cn(
  "absolute inset-0",
  "bg-[radial-gradient(ellipse_38%_32%_at_78%_68%,rgba(251,146,60,0.18)_0%,transparent_55%)]"
);

export const appearanceSectionLabel = settingsSectionTitle;

export const appearanceSectionHeading = cn(
  "font-serif text-[1.35rem] font-light tracking-tight text-white sm:text-[1.45rem]"
);

export const appearanceSectionSubtitle = "mt-1 text-sm text-[rgba(255,255,255,0.48)]";

export const appearanceBackLink = cn(
  "inline-flex min-h-[40px] items-center gap-2 text-xs font-medium tracking-[0.08em] text-violet-300/60",
  "transition-colors hover:text-violet-200/95"
);

export const appearanceHeroTitle = cn(
  "font-serif text-[clamp(2rem,4vw,2.75rem)] font-light leading-[1.06] tracking-tight text-white"
);

export const appearanceHeroAccent = cn(
  "bg-gradient-to-r from-rose-200 via-fuchsia-200 to-violet-200 bg-clip-text text-transparent",
  "drop-shadow-[0_0_28px_rgba(236,72,153,0.4)]"
);

export const appearancePanel = cn(appearanceGlassCard, "p-5 sm:p-7");

export const appearanceOptionCard = cn(
  "relative flex w-full items-start gap-4 rounded-[1.25rem] border border-white/[0.07] p-4 text-left",
  "bg-[linear-gradient(160deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.015)_55%,rgba(139,92,246,0.03)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  "transition-all duration-300 hover:border-violet-400/22 hover:shadow-[0_0_32px_-12px_rgba(139,92,246,0.22)]"
);

export const appearanceOptionCardSelected = cn(
  "border-fuchsia-400/45 bg-[linear-gradient(160deg,rgba(139,92,246,0.14)_0%,rgba(236,72,153,0.08)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_36px_-10px_rgba(192,132,252,0.35)]"
);

export const appearancePrefRow = cn(
  "flex flex-col gap-4 rounded-[1.125rem] border border-white/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5",
  "bg-[linear-gradient(160deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.01)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  "transition-all duration-300 hover:border-violet-400/18 hover:shadow-[0_0_28px_-14px_rgba(139,92,246,0.2)]"
);

export const appearanceBtnGhost = cn(
  "inline-flex min-h-[34px] items-center justify-center rounded-full border border-white/[0.1] px-4 py-1.5",
  "bg-[linear-gradient(180deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.02)_100%)]",
  "text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(255,255,255,0.88)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  "transition-all duration-300 hover:border-violet-300/28 hover:bg-violet-500/[0.1] hover:shadow-[0_0_24px_-8px_rgba(139,92,246,0.35)]"
);

export const appearanceIconChip = settingsIconChip;

export const appearanceValuePill = cn(
  "inline-flex rounded-full border border-white/[0.1] px-2.5 py-1 text-[11px] font-semibold text-[rgba(255,255,255,0.82)]",
  "bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_100%)]"
);

export const appearanceMiniPreviewCard = cn(
  "flex min-h-[108px] flex-col overflow-hidden rounded-2xl border border-white/[0.07]",
  "bg-[linear-gradient(165deg,rgba(255,255,255,0.05)_0%,rgba(10,11,24,0.95)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_24px_-12px_rgba(139,92,246,0.15)]"
);
