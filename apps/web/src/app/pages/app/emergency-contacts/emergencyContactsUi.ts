import { cn } from "@/lib/utils";
import {
  settingsCard,
  settingsIconChip,
  settingsPageAtmosphere,
  settingsPageFogMid,
  settingsPageGlowTop,
  settingsPageVignette,
} from "@/app/pages/app/settings-hub/settingsUi";

export const EMERGENCY_HERO_IMG = "/community/hero-lake.jpg";
export const EMERGENCY_RAIL_IMG = "/community/hero-lake.jpg";

export const emergencyPageAtmosphere = cn(
  settingsPageAtmosphere,
  "bg-[linear-gradient(165deg,#0a0b18_0%,#090a16_42%,#0c0a18_100%)]"
);

export const emergencyPageGlowTop = settingsPageGlowTop;
export const emergencyPageFogMid = settingsPageFogMid;
export const emergencyPageVignette = settingsPageVignette;

export const emergencyGlassCard = cn(
  settingsCard,
  "rounded-[1.75rem] border-white/[0.06]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_48px_-16px_rgba(139,92,246,0.14),0_28px_72px_-40px_rgba(0,0,0,0.75)]"
);

export const emergencyRailCard = cn(
  emergencyGlassCard,
  "rounded-3xl p-5 sm:p-6",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_40px_-14px_rgba(139,92,246,0.18),0_24px_64px_-36px_rgba(0,0,0,0.72)]"
);

export const emergencyHeroCard = cn(
  emergencyGlassCard,
  "relative min-h-[240px] overflow-hidden rounded-[2rem] border-violet-400/12 sm:min-h-[260px] lg:min-h-[280px]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_0_72px_-18px_rgba(139,92,246,0.32),0_32px_80px_-40px_rgba(0,0,0,0.82)]"
);

export const emergencyHeroImage = cn(
  "absolute inset-0 h-full w-full object-cover object-[center_38%]",
  "brightness-[0.52] contrast-[0.94] saturate-[1.14]"
);

export const emergencyHeroOverlayLeft = cn(
  "absolute inset-0",
  "bg-gradient-to-r from-[#0a0b18] via-[#0a0b18]/78 to-[#0a0b18]/20 lg:from-[#0a0b18]/96 lg:via-[#0a0b18]/55 lg:to-transparent"
);

export const emergencyHeroOverlayPurple = cn(
  "absolute inset-0",
  "bg-[radial-gradient(ellipse_80%_90%_at_82%_48%,rgba(192,132,252,0.22)_0%,transparent_58%)]"
);

export const emergencyHeroOverlayWarmth = cn(
  "absolute inset-0",
  "bg-[radial-gradient(ellipse_42%_36%_at_72%_72%,rgba(251,146,60,0.14)_0%,transparent_55%)]"
);

export const emergencyIconChip = settingsIconChip;

export const emergencyBackLink = cn(
  "inline-flex min-h-[40px] items-center gap-2 text-xs font-medium tracking-[0.1em] text-violet-300/55",
  "transition-colors hover:text-violet-200/95"
);

export const emergencyHeroTitle = cn(
  "font-serif text-[clamp(1.85rem,4vw,2.75rem)] font-light leading-[1.06] tracking-tight text-white"
);

export const emergencyHeroAccent = cn(
  "bg-gradient-to-r from-fuchsia-200 via-rose-200 to-violet-200 bg-clip-text text-transparent",
  "drop-shadow-[0_0_28px_rgba(236,72,153,0.4)]"
);

export const emergencyBtnPrimary = cn(
  "inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white",
  "bg-[linear-gradient(135deg,#7C3AED_0%,#C026D3_55%,#EC4899_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_36px_-6px_rgba(168,85,247,0.55),0_12px_32px_-16px_rgba(0,0,0,0.65)]",
  "transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/45"
);

export const emergencyAboutCard = cn(
  emergencyGlassCard,
  "relative overflow-hidden rounded-[1.5rem] border-violet-400/14 p-5 sm:p-6",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_40px_-12px_rgba(139,92,246,0.22)]"
);

export const emergencyContactCard = cn(
  emergencyGlassCard,
  "group relative overflow-hidden rounded-[1.5rem] border-white/[0.07] p-4 sm:p-5",
  "transition-all duration-300 hover:border-violet-400/22 hover:shadow-[0_0_36px_-12px_rgba(139,92,246,0.28)]"
);

export const emergencyContactAvatar = cn(
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white",
  "bg-gradient-to-br from-violet-500/35 via-fuchsia-500/28 to-cyan-500/20 ring-1 ring-white/12",
  "shadow-[0_0_24px_-8px_rgba(139,92,246,0.45)]"
);

export const emergencyActionBtn = cn(
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.08]",
  "bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)]",
  "text-violet-200/90 transition-all duration-300",
  "hover:border-violet-400/28 hover:bg-violet-500/[0.12] hover:text-fuchsia-100 hover:shadow-[0_0_20px_-6px_rgba(139,92,246,0.45)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
);

export const emergencyResourcesCard = cn(
  "relative overflow-hidden rounded-[1.75rem] border border-fuchsia-400/18 p-6 sm:p-7",
  "bg-[linear-gradient(135deg,rgba(76,29,149,0.55)_0%,rgba(136,19,55,0.42)_45%,rgba(30,16,48,0.88)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_48px_-12px_rgba(236,72,153,0.35),0_28px_72px_-36px_rgba(0,0,0,0.75)]"
);

export const emergencyResourcesCta = cn(
  "group mt-5 flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-white/20",
  "bg-[rgba(8,10,24,0.55)] px-4 py-3.5 text-sm font-semibold text-white backdrop-blur-md",
  "transition-all duration-300 hover:border-fuchsia-300/35 hover:bg-[rgba(12,10,28,0.72)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/40"
);

export const emergencyBtnRose = cn(
  "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-rose-50/95",
  "border border-rose-400/28 bg-[linear-gradient(135deg,rgba(136,19,55,0.55)_0%,rgba(76,5,25,0.75)_100%)]",
  "shadow-[0_0_28px_-10px_rgba(244,63,94,0.35)]",
  "transition-all duration-300 hover:border-rose-300/40 hover:brightness-110",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/35"
);

export const emergencySafetyRow = cn(
  "flex gap-3.5 border-b border-white/[0.05] py-4 last:border-b-0 first:pt-0 last:pb-0"
);

/** Cinematic modal backdrop — blurred, purple ambient, not flat gray */
export const emergencyModalOverlay = cn(
  "fixed inset-0 bg-[rgba(6,8,22,0.68)] backdrop-blur-md",
  "before:pointer-events-none before:absolute before:inset-0 before:content-['']",
  "before:bg-[radial-gradient(ellipse_70%_55%_at_50%_40%,rgba(139,92,246,0.14)_0%,transparent_62%)]"
);

export const emergencyModalOverlayMotion = cn(
  emergencyModalOverlay,
  "z-40 data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
);

export const emergencyModalOverlayDialog = cn(
  emergencyModalOverlay,
  "z-[200] data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
);

/** Dark matte sanctuary shell — 28px, purple edge glow */
export const emergencyModalShell = cn(
  "w-full max-w-[min(600px,calc(100%-2rem))] max-h-[min(90vh,calc(100%-2rem))] overflow-y-auto",
  "rounded-[28px] border border-violet-500/[0.22] p-7 sm:p-8",
  "bg-[linear-gradient(180deg,rgba(18,18,38,0.98)_0%,rgba(8,9,22,0.98)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_60px_-12px_rgba(139,92,246,0.32),0_32px_80px_-24px_rgba(0,0,0,0.78)]",
  "text-[rgba(255,255,255,0.94)]"
);

export const emergencyModalPanel = emergencyModalShell;

export const emergencyModalHeaderIcon = cn(
  emergencyIconChip("pink"),
  "h-12 w-12 shrink-0 [&_svg]:h-5 [&_svg]:w-5"
);

export const emergencyModalEyebrow = cn(
  "text-[10px] font-semibold uppercase tracking-[0.2em] text-fuchsia-300/55"
);

export const emergencyModalTitle = cn(
  "font-serif text-xl font-light leading-snug text-white sm:text-[1.35rem]"
);

export const emergencyModalSubtitle = cn(
  "mt-1 text-sm leading-relaxed text-[rgba(255,255,255,0.52)]"
);

export const emergencyModalSectionHeading = cn(
  "text-sm font-semibold text-[rgba(255,255,255,0.9)]"
);

export const emergencyModalBody = cn(
  "text-sm leading-relaxed text-[rgba(255,255,255,0.52)]"
);

/** Serious warm amber notice — not yellow/white alert */
export const emergencyModalAmberNotice = cn(
  "space-y-2 rounded-2xl border border-amber-400/22 p-4",
  "bg-[linear-gradient(165deg,rgba(69,45,12,0.35)_0%,rgba(24,18,12,0.55)_100%)]",
  "shadow-[inset_0_1px_0_rgba(251,191,36,0.08),0_0_28px_-14px_rgba(251,191,36,0.12)]"
);

export const emergencyModalAmberTitle = cn(
  "flex items-center gap-2 text-sm font-semibold text-amber-100/95"
);

/** Pink safety consent checkbox card */
export const emergencyModalConsentBox = cn(
  "rounded-2xl border border-fuchsia-400/18 px-4 py-3.5",
  "bg-[linear-gradient(165deg,rgba(76,5,45,0.22)_0%,rgba(18,12,28,0.55)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
);

export const emergencyModalCheckbox = cn(
  "mt-0.5 border-violet-400/35 bg-[rgba(10,12,28,0.95)]",
  "data-[state=checked]:border-fuchsia-400/50 data-[state=checked]:bg-violet-500",
  "data-[state=checked]:text-white focus-visible:ring-fuchsia-400/35"
);

export const emergencyModalCheckboxLabel = cn(
  "cursor-pointer text-xs font-normal leading-snug text-[rgba(255,255,255,0.78)]"
);

export const emergencyModalCheckboxHelp = cn(
  "text-xs text-[rgba(255,255,255,0.42)]"
);

export const emergencyModalNoteList = "space-y-2.5";

export const emergencyModalNoteItem = cn(
  "flex gap-2.5 text-sm leading-relaxed text-[rgba(255,255,255,0.48)]"
);

export const emergencyModalField = cn(
  "flex min-h-[48px] items-center gap-2.5 rounded-2xl border border-white/[0.09] px-3.5",
  "bg-[rgba(12,14,30,0.92)] shadow-[inset_0_2px_12px_rgba(0,0,0,0.38)]",
  "transition-all duration-300",
  "focus-within:border-violet-400/40 focus-within:ring-2 focus-within:ring-violet-500/22",
  "focus-within:shadow-[inset_0_2px_12px_rgba(0,0,0,0.35),0_0_24px_-8px_rgba(139,92,246,0.28)]"
);

export const emergencyModalInput = cn(
  "flex-1 bg-transparent text-sm text-white outline-none",
  "placeholder:text-[rgba(255,255,255,0.32)]"
);

export const emergencyModalLabel = "mb-2 block text-sm font-medium text-[rgba(255,255,255,0.88)]";

export const emergencyModalFieldHint = "mb-2 text-xs text-[rgba(255,255,255,0.42)]";

export const emergencyModalPhoneButton = cn(
  "h-12 min-h-[48px] w-[120px] shrink-0 justify-between rounded-2xl border-white/[0.09] px-3 sm:w-[140px]",
  "bg-[rgba(12,14,30,0.92)] text-[rgba(255,255,255,0.9)] shadow-[inset_0_2px_12px_rgba(0,0,0,0.38)]",
  "hover:border-violet-400/28 hover:bg-violet-500/[0.08] hover:text-white"
);

export const emergencyModalPhoneInput = cn(
  "h-12 min-h-[48px] flex-1 rounded-2xl border-white/[0.09]",
  "bg-[rgba(12,14,30,0.92)] text-white shadow-[inset_0_2px_12px_rgba(0,0,0,0.38)]",
  "placeholder:text-[rgba(255,255,255,0.32)]",
  "focus-visible:border-violet-400/40 focus-visible:ring-violet-500/22"
);

export const emergencyModalFormStack = "space-y-[18px]";

export const emergencyModalBtnRow = cn(
  "flex flex-col-reverse gap-3.5 pt-1 sm:flex-row sm:gap-3.5"
);

export const emergencyModalBtnCancel = cn(
  "inline-flex min-h-[44px] flex-1 items-center justify-center rounded-2xl border border-white/[0.1] px-4 text-sm font-semibold",
  "bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)]",
  "text-[rgba(255,255,255,0.88)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  "transition-all duration-300 hover:border-violet-300/28 hover:bg-violet-500/[0.08]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

export const emergencyModalBtnPrimary = cn(
  "inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white",
  "bg-[linear-gradient(135deg,#7C3AED_0%,#C026D3_55%,#EC4899_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_32px_-6px_rgba(168,85,247,0.45)]",
  "transition-all duration-300 hover:enabled:brightness-110",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/40",
  "disabled:cursor-not-allowed disabled:border disabled:border-white/[0.06]",
  "disabled:bg-[linear-gradient(135deg,rgba(48,32,78,0.65)_0%,rgba(42,24,52,0.6)_100%)]",
  "disabled:text-[rgba(255,255,255,0.38)] disabled:shadow-none disabled:saturate-[0.7]"
);

export const emergencyModalBtnSave = emergencyModalBtnPrimary;
