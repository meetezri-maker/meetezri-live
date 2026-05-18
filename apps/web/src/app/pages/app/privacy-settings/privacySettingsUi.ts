import { cn } from "@/lib/utils";
import {
  settingsCard,
  settingsIconChip,
  settingsPageAtmosphere,
  settingsPageFogMid,
  settingsPageGlowTop,
  settingsPageVignette,
} from "@/app/pages/app/settings-hub/settingsUi";

export const PRIVACY_HERO_IMG = "/community/hero-lake.jpg";
export const PRIVACY_BANNER_IMG = "/community/hero-lake.jpg";
export const PRIVACY_ENCRYPTION_IMG = "/community/scene-forest.jpg";

export const privacyPageAtmosphere = cn(
  settingsPageAtmosphere,
  "bg-[linear-gradient(165deg,#0a0b18_0%,#090a16_42%,#0c0a18_100%)]"
);

export const privacyPageGlowTop = settingsPageGlowTop;
export const privacyPageFogMid = settingsPageFogMid;
export const privacyPageVignette = settingsPageVignette;

export const privacyGlassCard = cn(
  settingsCard,
  "rounded-[1.75rem] border-white/[0.06]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_48px_-16px_rgba(139,92,246,0.14),0_28px_72px_-40px_rgba(0,0,0,0.75)]"
);

export const privacyRailCard = cn(
  privacyGlassCard,
  "rounded-3xl p-5 sm:p-6",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_40px_-14px_rgba(139,92,246,0.18),0_24px_64px_-36px_rgba(0,0,0,0.72)]"
);

export const privacyHeroCard = cn(
  privacyGlassCard,
  "relative min-h-[280px] overflow-hidden rounded-[2rem] border-violet-400/12 sm:min-h-[300px] lg:min-h-[320px]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_0_72px_-18px_rgba(139,92,246,0.32),0_32px_80px_-40px_rgba(0,0,0,0.82)]"
);

export const privacyHeroImage = cn(
  "absolute inset-0 h-full w-full object-cover object-[center_38%]",
  "brightness-[0.52] contrast-[0.94] saturate-[1.14]"
);

export const privacyHeroOverlayLeft = cn(
  "absolute inset-0",
  "bg-gradient-to-r from-[#0a0b18] via-[#0a0b18]/78 to-[#0a0b18]/20 lg:from-[#0a0b18]/96 lg:via-[#0a0b18]/55 lg:to-transparent"
);

export const privacyHeroOverlayPurple = cn(
  "absolute inset-0",
  "bg-[radial-gradient(ellipse_80%_90%_at_82%_48%,rgba(192,132,252,0.22)_0%,transparent_58%)]"
);

export const privacyHeroOverlayWarmth = cn(
  "absolute inset-0",
  "bg-[radial-gradient(ellipse_42%_36%_at_72%_72%,rgba(251,146,60,0.14)_0%,transparent_55%)]"
);

export const privacyIconChip = settingsIconChip;

export const privacySectionTitle = cn(
  "font-serif text-[1.35rem] font-light tracking-tight text-white sm:text-[1.5rem]",
  "bg-gradient-to-r from-white to-violet-100/85 bg-clip-text text-transparent"
);

export const privacySectionSubtitle = "mt-1 text-sm text-[rgba(255,255,255,0.48)]";

export const privacyBackLink = cn(
  "inline-flex min-h-[40px] items-center gap-2 text-xs font-medium tracking-[0.1em] text-violet-300/55",
  "transition-colors hover:text-violet-200/95"
);

export const privacyHeroTitle = cn(
  "font-serif text-[clamp(2rem,4.2vw,3rem)] font-light leading-[1.06] tracking-tight text-white"
);

export const privacyHeroAccent = cn(
  "bg-gradient-to-r from-violet-200 via-fuchsia-200 to-violet-300 bg-clip-text text-transparent",
  "drop-shadow-[0_0_28px_rgba(167,139,250,0.45)]"
);

export const privacyBtnGhost = cn(
  "inline-flex min-h-[36px] items-center justify-center rounded-full border border-white/[0.1] px-4 py-1.5",
  "bg-[linear-gradient(180deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.02)_100%)]",
  "text-xs font-semibold text-[rgba(255,255,255,0.9)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  "transition-all duration-300 hover:border-violet-300/28 hover:bg-violet-500/[0.1] hover:shadow-[0_0_24px_-8px_rgba(139,92,246,0.35)]"
);

export const privacyBtnPrimary = cn(
  "inline-flex min-h-[40px] items-center justify-center rounded-full px-5 py-2 text-xs font-semibold text-white",
  "bg-[linear-gradient(135deg,#7C3AED_0%,#C026D3_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_32px_-6px_rgba(168,85,247,0.5)]",
  "transition-all duration-300 hover:brightness-110"
);

export const privacyBtnRose = cn(
  "inline-flex min-h-[40px] items-center justify-center rounded-full px-5 py-2 text-xs font-semibold text-rose-50/95",
  "border border-rose-400/28 bg-[linear-gradient(135deg,rgba(136,19,55,0.55)_0%,rgba(76,5,25,0.75)_100%)]",
  "shadow-[0_0_28px_-10px_rgba(244,63,94,0.35)]",
  "transition-all duration-300 hover:border-rose-300/40"
);

export const privacyCompactCard = cn(
  "flex min-h-[148px] flex-col justify-between rounded-[1.25rem] border border-white/[0.07] p-4",
  "bg-[linear-gradient(160deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.015)_55%,rgba(139,92,246,0.04)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  "transition-all duration-300 hover:border-violet-400/22 hover:shadow-[0_0_32px_-12px_rgba(139,92,246,0.22)]"
);

export const privacyRow = cn(
  "flex flex-col gap-4 border-b border-white/[0.05] px-4 py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5"
);

export const privacySelect = cn(
  "min-h-[40px] appearance-none rounded-full border border-white/[0.1] bg-[rgba(12,14,30,0.92)]",
  "px-4 py-2 pr-9 text-sm font-medium text-[rgba(255,255,255,0.9)]",
  "shadow-[inset_0_2px_10px_rgba(0,0,0,0.35)]",
  "focus:border-violet-400/35 focus:outline-none focus:ring-2 focus:ring-violet-500/25"
);

export const privacySessionRow = cn(
  "flex items-center gap-4 border-b border-white/[0.05] px-4 py-4 last:border-b-0 sm:px-6",
  "transition-colors hover:bg-violet-500/[0.04]"
);

export const privacyDataCard = cn(
  "flex flex-col gap-4 rounded-[1.35rem] border border-white/[0.07] p-5 sm:p-6",
  "bg-[linear-gradient(165deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.01)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
);

export const privacyCommitmentBanner = cn(
  privacyGlassCard,
  "relative overflow-hidden rounded-[1.75rem] border-violet-400/10 p-6 sm:p-8"
);

export const privacyLinkMuted = cn(
  "inline-flex items-center gap-1 text-xs font-semibold text-violet-300/80 transition hover:text-violet-200"
);
