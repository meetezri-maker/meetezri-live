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

export const CHANGE_AVATAR_HERO_IMG = "/community/hero-lake.jpg";

export const changeAvatarPageAtmosphere = cn(
  settingsPageAtmosphere
);

export const changeAvatarPageGlowTop = settingsPageGlowTop;
export const changeAvatarPageFogMid = settingsPageFogMid;
export const changeAvatarPageVignette = settingsPageVignette;

export const changeAvatarGlassCard = cn(
  settingsCard,
  "rounded-[1.5rem] border-white/[0.06]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_48px_-16px_rgba(139,92,246,0.14),0_28px_72px_-40px_rgba(0,0,0,0.75)]"
);

export const changeAvatarRailCard = cn(
  changeAvatarGlassCard,
  "rounded-[1.5rem] p-5 sm:p-6",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_40px_-14px_rgba(139,92,246,0.18),0_24px_64px_-36px_rgba(0,0,0,0.72)]"
);

export const changeAvatarHeroCard = cn(
  changeAvatarGlassCard,
  "relative min-h-[220px] overflow-hidden rounded-[1.75rem] border-violet-400/14 sm:min-h-[235px] lg:min-h-[250px]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_0_72px_-18px_rgba(139,92,246,0.32),0_32px_80px_-40px_rgba(0,0,0,0.82)]"
);

export const changeAvatarHeroImage = cn(
  "absolute inset-0 h-full w-full object-cover object-[72%_center]",
  "brightness-[0.48] contrast-[0.96] saturate-[1.12]"
);

export const changeAvatarHeroOverlayLeft = cn(
  "absolute inset-0",
  "bg-gradient-to-r from-[#0a0b18] via-[#0a0b18]/78 to-[#0a0b18]/12 lg:from-[#0a0b18]/92 lg:via-[#0a0b18]/55 lg:to-transparent"
);

export const changeAvatarHeroOverlayPurple = cn(
  "absolute inset-0",
  "bg-[radial-gradient(ellipse_75%_85%_at_78%_42%,rgba(192,132,252,0.22)_0%,transparent_58%)]"
);

export const changeAvatarHeroOverlayWarmth = cn(
  "absolute inset-0",
  "bg-[radial-gradient(ellipse_38%_32%_at_78%_68%,rgba(251,146,60,0.16)_0%,transparent_55%)]"
);

export const changeAvatarBackLink = cn(
  "inline-flex min-h-[40px] items-center gap-2 text-xs font-medium tracking-[0.08em] text-violet-300/60",
  "transition-colors hover:text-violet-200/95"
);

export const changeAvatarPageTitle = cn(
  "font-serif text-[clamp(1.85rem,3.5vw,2.5rem)] font-light leading-[1.08] tracking-tight text-white"
);

export const changeAvatarPageSubtitle = "mt-2 text-sm text-[rgba(255,255,255,0.48)] sm:text-[15px]";

export const changeAvatarSectionLabel = settingsSectionTitle;

export const changeAvatarSectionHeading = cn(
  "font-serif text-[1.35rem] font-light tracking-tight text-white sm:text-[1.45rem]"
);

export const changeAvatarSectionSubtitle = "mt-1 text-sm text-[rgba(255,255,255,0.48)]";

export const changeAvatarCompanionCard = cn(
  "relative w-full overflow-hidden rounded-[1.625rem] border text-left transition-all duration-300",
  "bg-[linear-gradient(160deg,rgba(18,18,42,0.92)_0%,rgba(10,10,26,0.96)_55%,rgba(139,92,246,0.04)_100%)]",
  "border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  "hover:border-violet-400/22 hover:shadow-[0_0_32px_-12px_rgba(139,92,246,0.22)]"
);

export const changeAvatarCompanionCardSelected = cn(
  "border-fuchsia-400/42 bg-[linear-gradient(160deg,rgba(139,92,246,0.16)_0%,rgba(236,72,153,0.07)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_36px_-10px_rgba(192,132,252,0.32)]"
);

export const changeAvatarCompanionCardCurrent = cn(
  "border-emerald-400/28 bg-[linear-gradient(160deg,rgba(16,185,129,0.08)_0%,rgba(10,10,26,0.96)_100%)]",
  "cursor-not-allowed opacity-90 hover:border-emerald-400/32"
);

export const changeAvatarTagPill = cn(
  "inline-flex rounded-full border border-violet-400/18 bg-violet-500/[0.12] px-2.5 py-0.5",
  "text-[11px] font-medium text-violet-100/90"
);

export const changeAvatarPreviewBtn = cn(
  "inline-flex min-h-[38px] shrink-0 items-center justify-center gap-2 rounded-full border border-violet-400/28 px-4 py-2",
  "bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_100%)]",
  "text-xs font-semibold text-[rgba(255,255,255,0.9)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_24px_-8px_rgba(139,92,246,0.35)]",
  "transition-all duration-300 hover:border-fuchsia-300/40 hover:shadow-[0_0_28px_-6px_rgba(192,132,252,0.45)]"
);

export const changeAvatarSwitchCta = cn(
  "mx-auto inline-flex min-h-[52px] w-full max-w-md items-center justify-center gap-2 rounded-full px-8 py-3.5",
  "text-sm font-semibold text-white",
  "bg-[linear-gradient(135deg,#7C3AED_0%,#C026D3_55%,#DB2777_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_40px_-8px_rgba(168,85,247,0.5),0_16px_40px_-18px_rgba(0,0,0,0.7)]",
  "transition-all duration-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_0_48px_-6px_rgba(192,132,252,0.55),0_18px_44px_-16px_rgba(0,0,0,0.75)]"
);

export const changeAvatarHistoryCard = cn(
  changeAvatarGlassCard,
  "rounded-[1.25rem] px-4 py-3.5 sm:px-5"
);

export const changeAvatarManageBtn = cn(
  "mt-4 inline-flex min-h-[40px] w-full items-center justify-center rounded-full border border-violet-400/22 px-4 py-2",
  "bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)]",
  "text-xs font-semibold text-[rgba(255,255,255,0.88)]",
  "transition-all duration-300 hover:border-violet-300/35 hover:bg-violet-500/[0.1]"
);

export const changeAvatarIconChip = settingsIconChip;

export const changeAvatarRailRow = cn(
  "flex gap-3.5 rounded-[1.125rem] border border-white/[0.05] px-3.5 py-3.5",
  "bg-[linear-gradient(160deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.01)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
);
