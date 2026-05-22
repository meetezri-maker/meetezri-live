import { cn } from "@/lib/utils";

import {

  settingsCard,

  settingsIconChip,

  settingsPageAtmosphere,

  settingsPageFogMid,

  settingsPageGlowTop,

  settingsPageVignette,
  settingsSectionTitle,
  settingsBtnPrimary,
} from "@/app/pages/app/settings-hub/settingsUi";



export const ACCESSIBILITY_HERO_IMG = "/community/hero-lake.jpg";

export const ACCESSIBILITY_HEART_IMG = "/community/scene-stars.jpg";



export const accessibilityPageAtmosphere = settingsPageAtmosphere;



export const accessibilityPageGlowTop = cn(

  settingsPageGlowTop,

  "bg-[radial-gradient(circle,rgba(139,92,246,0.12)_0%,rgba(52,211,153,0.06)_42%,transparent_68%)]"

);



export const accessibilityPageFogMid = cn(

  settingsPageFogMid,

  "bg-[radial-gradient(ellipse_85%_60%_at_50%_35%,rgba(76,29,149,0.14)_0%,rgba(52,211,153,0.04)_40%,transparent_72%)]"

);



export const accessibilityPageVignette = cn(

  settingsPageVignette,

  "bg-[radial-gradient(ellipse_95%_75%_at_50%_48%,transparent_32%,rgba(4,5,14,0.62)_100%)]"

);



export const accessibilityPageLanternGlow = cn(

  "pointer-events-none absolute -right-[6%] bottom-[6%] h-[26rem] w-[26rem] rounded-full",

  "bg-[radial-gradient(circle,rgba(251,146,60,0.11)_0%,rgba(236,72,153,0.04)_38%,transparent_68%)] blur-3xl"

);



export const accessibilityGlassCard = cn(

  settingsCard,

  "rounded-[1.75rem] border border-white/[0.06]",

  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_48px_-16px_rgba(52,211,153,0.1),0_28px_72px_-40px_rgba(0,0,0,0.75)]"

);



export const accessibilityRailCard = cn(

  accessibilityGlassCard,

  "rounded-[1.65rem] p-5 sm:p-6",

  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_40px_-14px_rgba(139,92,246,0.1),0_0_36px_-14px_rgba(52,211,153,0.12),0_24px_64px_-36px_rgba(0,0,0,0.72)]"

);



export const accessibilityHeroCard = cn(

  accessibilityGlassCard,

  "relative min-h-[232px] overflow-hidden rounded-[1.85rem] sm:min-h-[248px] lg:min-h-[256px]",

  "border border-emerald-400/22 border-violet-400/12",

  "shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_80px_-20px_rgba(52,211,153,0.32),0_0_64px_-24px_rgba(139,92,246,0.22),0_32px_80px_-40px_rgba(0,0,0,0.85)]"

);



export const accessibilityHeroImage = cn(

  "absolute inset-0 h-full w-full scale-[1.06] object-cover object-[86%_42%]",

  "brightness-[0.62] contrast-[1.04] saturate-[1.28]"

);



export const accessibilityHeroOverlayLeft = cn(

  "absolute inset-0",

  "bg-gradient-to-r from-[#070812]/97 via-[#0a0b18]/78 via-[42%] to-transparent",

  "lg:from-[#070812]/94 lg:via-[#0a0b18]/58 lg:via-[48%] lg:to-transparent"

);



export const accessibilityHeroOverlayPurpleSky = cn(

  "absolute inset-0",

  "bg-gradient-to-b from-[rgba(46,26,88,0.55)] via-[rgba(30,20,60,0.18)] via-[38%] to-transparent"

);



export const accessibilityHeroOverlayPurpleNight = cn(

  "absolute inset-0",

  "bg-[radial-gradient(ellipse_80%_90%_at_82%_38%,rgba(168,85,247,0.32)_0%,rgba(139,92,246,0.12)_42%,transparent_62%)]"

);



export const accessibilityHeroOverlayEmerald = cn(

  "absolute inset-0",

  "bg-[radial-gradient(ellipse_55%_70%_at_14%_58%,rgba(52,211,153,0.28)_0%,rgba(16,185,129,0.08)_38%,transparent_62%)]"

);



export const accessibilityHeroOverlayTitleHaze = cn(

  "absolute inset-0",

  "bg-[radial-gradient(ellipse_50%_55%_at_28%_52%,rgba(139,92,246,0.16)_0%,transparent_58%)]"

);



export const accessibilityHeroOverlayWarmth = cn(

  "absolute inset-0",

  "bg-[radial-gradient(ellipse_42%_38%_at_86%_56%,rgba(251,191,36,0.38)_0%,rgba(249,115,22,0.14)_38%,transparent_62%)]"

);



export const accessibilityHeroOverlayReflection = cn(

  "absolute inset-0",

  "bg-[radial-gradient(ellipse_60%_28%_at_72%_88%,rgba(56,189,248,0.08)_0%,transparent_55%)]"

);



export const accessibilityHeroOverlayVignette = cn(

  "absolute inset-0",

  "bg-[radial-gradient(ellipse_120%_90%_at_50%_50%,transparent_45%,rgba(4,5,14,0.35)_100%)]"

);



export const accessibilityHeroIconCapsule = cn(

  "relative z-10 flex h-[3.75rem] w-[3.75rem] shrink-0 items-center justify-center rounded-2xl sm:h-16 sm:w-16",

  "bg-[linear-gradient(145deg,rgba(52,211,153,0.22)_0%,rgba(16,185,129,0.1)_100%)]",

  "text-emerald-100 ring-1 ring-emerald-300/40",

  "shadow-[0_0_48px_-4px_rgba(52,211,153,0.72),inset_0_1px_0_rgba(255,255,255,0.14)]",

  "before:pointer-events-none before:absolute before:-inset-3 before:rounded-3xl before:bg-emerald-400/30 before:blur-2xl before:content-['']"

);



export const accessibilitySectionLabel = settingsSectionTitle;

export const accessibilitySectionHeading = cn(

  "font-serif text-[1.35rem] font-light tracking-tight text-white sm:text-[1.45rem]"

);



export const accessibilitySectionSubtitle = "mt-1 text-sm text-[rgba(255,255,255,0.48)]";



export const accessibilityBackLink = cn(

  "relative z-10 inline-flex min-h-[40px] items-center gap-2 text-xs font-medium tracking-[0.08em]",

  "text-violet-300/55 transition-colors hover:text-emerald-200/90"

);



export const accessibilityHeroTitle = cn(

  "font-serif text-[clamp(2.05rem,4.2vw,2.85rem)] font-light leading-[1.05] tracking-tight text-white",

  "drop-shadow-[0_2px_24px_rgba(139,92,246,0.18)]"

);



export const accessibilityHeroAccent = cn(

  "mt-1.5 text-sm font-medium text-emerald-300 sm:text-[15px]",

  "drop-shadow-[0_0_20px_rgba(52,211,153,0.35)]"

);



export const accessibilityHeroBody =

  "mt-3 max-w-md text-xs leading-relaxed text-[rgba(210,205,230,0.62)] sm:text-sm sm:leading-relaxed";



export const accessibilityPanel = cn(

  accessibilityGlassCard,

  "rounded-[1.65rem] border-violet-400/[0.07] p-5 ring-1 ring-emerald-400/[0.05] sm:p-7",

  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_52px_-18px_rgba(139,92,246,0.1),0_0_40px_-16px_rgba(52,211,153,0.08),0_24px_64px_-38px_rgba(0,0,0,0.72)]"

);



export const accessibilityPrefRow = cn(

  "flex flex-col gap-4 rounded-[1.125rem] border border-white/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5",

  "bg-[linear-gradient(160deg,rgba(255,255,255,0.045)_0%,rgba(255,255,255,0.012)_55%,rgba(52,211,153,0.02)_100%)]",

  "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",

  "transition-all duration-300 hover:border-emerald-400/18 hover:shadow-[0_0_28px_-14px_rgba(52,211,153,0.2)]"

);



export const accessibilityCompactCard = cn(

  "flex min-h-[128px] flex-col justify-between rounded-[1.15rem] border border-white/[0.06] p-4",

  "bg-[linear-gradient(160deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.01)_100%)]",

  "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",

  "transition-all duration-300 hover:border-emerald-400/16 hover:shadow-[0_0_28px_-12px_rgba(52,211,153,0.2)]"

);



export const accessibilityCompactCardTight = cn(

  accessibilityCompactCard,

  "min-h-[116px] p-3.5"

);



export const accessibilityIconChip = settingsIconChip;



export const accessibilityBtnPrimary = settingsBtnPrimary;



export const accessibilityBtnGhost = cn(

  "inline-flex min-h-[34px] items-center justify-center rounded-full border border-white/[0.1] px-4 py-1.5",

  "bg-[linear-gradient(180deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.02)_100%)]",

  "text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(255,255,255,0.88)]",

  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",

  "transition-all duration-300 hover:border-emerald-300/28 hover:bg-emerald-500/[0.1] hover:shadow-[0_0_24px_-8px_rgba(52,211,153,0.35)]"

);



export const accessibilitySegmentTrack = cn(

  "inline-flex flex-wrap gap-1 rounded-full border border-white/[0.08] bg-black/25 p-1"

);



export const accessibilitySegmentOption = (selected: boolean) =>

  cn(

    "relative inline-flex min-h-[36px] min-w-[72px] items-center justify-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all duration-300",

    selected

      ? "border border-emerald-400/45 bg-emerald-500/15 text-emerald-100 shadow-[0_0_20px_-6px_rgba(52,211,153,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]"

      : "border border-transparent text-[rgba(255,255,255,0.5)] hover:bg-white/[0.04] hover:text-white/75"

  );



export const accessibilityWcagBanner = cn(

  accessibilityGlassCard,

  "flex flex-col gap-4 rounded-[1.5rem] border-emerald-500/14 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6",

  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_40px_-12px_rgba(52,211,153,0.18)]"

);



export const accessibilityMiniPreviewCard = cn(

  "flex min-h-[108px] flex-col overflow-hidden rounded-2xl border border-white/[0.07]",

  "bg-[linear-gradient(165deg,rgba(255,255,255,0.05)_0%,rgba(10,11,24,0.95)_100%)]",

  "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_24px_-12px_rgba(52,211,153,0.12)]"

);


