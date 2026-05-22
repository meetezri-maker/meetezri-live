import { cn } from "@/lib/utils";
import { MOOD_CHECKIN_IMAGES } from "@/lib/solace/moodCheckInImages";
import {
  EMERGENCY_HERO_IMG,
  EMERGENCY_RAIL_IMG,
  emergencyActionBtn,
  emergencyBackLink,
  emergencyBtnPrimary,
  emergencyContactAvatar,
  emergencyGlassCard,
  emergencyHeroAccent,
  emergencyHeroCard,
  emergencyHeroImage,
  emergencyHeroOverlayLeft,
  emergencyHeroOverlayPurple,
  emergencyHeroOverlayWarmth,
  emergencyHeroTitle,
  emergencyIconChip,
  emergencyPageAtmosphere,
  emergencyPageFogMid,
  emergencyPageGlowTop,
  emergencyPageVignette,
  emergencyRailCard,
  emergencyResourcesCta,
  emergencySafetyRow,
} from "@/app/pages/app/emergency-contacts/emergencyContactsUi";

export {
  EMERGENCY_HERO_IMG,
  EMERGENCY_RAIL_IMG,
  emergencyBackLink,
  emergencyHeroAccent,
  emergencyHeroCard,
  emergencyHeroImage,
  emergencyHeroOverlayLeft,
  emergencyHeroOverlayPurple,
  emergencyHeroOverlayWarmth,
  emergencyHeroTitle,
  emergencyIconChip,
  emergencyPageAtmosphere,
  emergencyPageFogMid,
  emergencyPageGlowTop,
  emergencyPageVignette,
  emergencyRailCard,
  emergencyResourcesCta,
  emergencySafetyRow,
  emergencyActionBtn,
  emergencyContactAvatar,
  emergencyBtnPrimary,
};

export const crisisGlassCard = emergencyGlassCard;

export const crisisSectionTitle = cn(
  "font-serif text-lg font-light text-white sm:text-xl"
);

export const crisisSectionEyebrow = cn(
  "text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/50"
);

/** Urgent but premium — deep crimson matte, not flat alarm red */
export const crisisDangerCard = cn(
  "relative overflow-hidden rounded-[1.5rem] border border-rose-500/20 p-5 sm:p-6",
  "bg-[linear-gradient(135deg,rgba(76,5,25,0.72)_0%,rgba(45,8,18,0.88)_42%,rgba(18,8,16,0.95)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_48px_-14px_rgba(244,63,94,0.32),0_28px_72px_-36px_rgba(0,0,0,0.75)]"
);

export const crisisDangerCta = cn(
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold",
  "bg-white text-rose-700 shadow-[0_0_28px_-8px_rgba(255,255,255,0.35)]",
  "transition-all duration-300 hover:bg-rose-50 hover:shadow-[0_0_36px_-6px_rgba(255,255,255,0.45)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/50"
);

export const crisisHotlineCard = (
  variant: "lifeline" | "text" | "emergency" | "samhsa"
) =>
  cn(
    "group relative overflow-hidden rounded-[1.35rem] border p-5 sm:p-6",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_24px_64px_-32px_rgba(0,0,0,0.78)]",
    "transition-all duration-300 hover:brightness-[1.04]",
    {
      lifeline:
        "border-orange-400/18 bg-[linear-gradient(145deg,rgba(127,29,29,0.55)_0%,rgba(69,10,10,0.82)_38%,rgba(24,10,14,0.94)_100%)] shadow-[0_0_40px_-16px_rgba(249,115,22,0.28)]",
      text:
        "border-cyan-400/18 bg-[linear-gradient(145deg,rgba(8,47,73,0.55)_0%,rgba(12,74,110,0.65)_38%,rgba(8,18,32,0.94)_100%)] shadow-[0_0_40px_-16px_rgba(34,211,238,0.22)]",
      emergency:
        "border-rose-500/20 bg-[linear-gradient(145deg,rgba(88,7,7,0.62)_0%,rgba(55,8,12,0.85)_42%,rgba(16,8,12,0.96)_100%)] shadow-[0_0_40px_-16px_rgba(239,68,68,0.28)]",
      samhsa:
        "border-fuchsia-400/18 bg-[linear-gradient(145deg,rgba(76,29,149,0.52)_0%,rgba(109,40,217,0.42)_38%,rgba(24,12,40,0.94)_100%)] shadow-[0_0_40px_-16px_rgba(168,85,247,0.28)]",
    }[variant]
  );

export const crisisHotlineDial = cn(
  "mt-4 flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-white/10",
  "bg-[rgba(6,8,22,0.45)] px-4 py-3 backdrop-blur-sm",
  "transition-colors group-hover:border-white/18 group-hover:bg-[rgba(8,10,28,0.62)]"
);

export const crisisPanelCard = cn(
  crisisGlassCard,
  "rounded-[1.5rem] p-5 sm:p-6",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_40px_-14px_rgba(139,92,246,0.14),0_24px_64px_-36px_rgba(0,0,0,0.72)]"
);

export const crisisContactRow = cn(
  "flex items-center gap-3 border-b border-white/[0.05] py-3.5 last:border-b-0"
);

export const crisisSafetyStep = cn(
  "flex items-start gap-3 border-b border-white/[0.05] py-3 last:border-b-0 first:pt-0"
);

export const crisisStepBadge = cn(
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
  "bg-[linear-gradient(135deg,#C026D3_0%,#EC4899_100%)]",
  "shadow-[0_0_20px_-6px_rgba(236,72,153,0.55)] ring-1 ring-white/12"
);

export const crisisArticleRow = cn(
  "group flex gap-3 rounded-2xl border border-white/[0.06] p-3.5 sm:p-4",
  "bg-[linear-gradient(160deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.01)_100%)]",
  "transition-all duration-300 hover:border-violet-400/22 hover:bg-violet-500/[0.06]",
  "hover:shadow-[0_0_32px_-12px_rgba(139,92,246,0.28)]"
);

/** Lotus-on-lake mood check-in hero — "You Are Not Alone" banner plate */
export const CRISIS_ALONE_BANNER_IMG = MOOD_CHECKIN_IMAGES.heroBanner;

export const crisisAloneBanner = cn(
  "relative overflow-hidden rounded-[1.5rem] border border-fuchsia-400/20",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_48px_-12px_rgba(236,72,153,0.35),0_28px_72px_-36px_rgba(0,0,0,0.75)]"
);

export const crisisAloneBannerImage = cn(
  "absolute inset-0 h-full w-full object-cover object-[center_38%] opacity-45"
);

export const crisisAloneBannerOverlay = cn(
  "absolute inset-0",
  "bg-[linear-gradient(135deg,rgba(76,29,149,0.55)_0%,rgba(136,19,55,0.45)_48%,rgba(30,16,48,0.88)_100%)]"
);

export const crisisAloneBannerContent = cn("relative p-5 sm:p-6");

export const crisisRailHeartWrap = cn(
  "mx-auto flex h-16 w-16 items-center justify-center rounded-full",
  "bg-[linear-gradient(135deg,rgba(192,132,252,0.22)_0%,rgba(236,72,153,0.18)_100%)]",
  "shadow-[0_0_40px_-8px_rgba(236,72,153,0.45)] ring-1 ring-fuchsia-300/25"
);

export const crisisViewAllLink = cn(
  "inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-fuchsia-300/80",
  "transition-colors hover:text-fuchsia-200"
);

export const crisisOutlineBtn = cn(
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/12 px-4 py-2 text-sm font-semibold",
  "bg-[rgba(255,255,255,0.04)] text-white transition-all hover:border-violet-400/28 hover:bg-violet-500/[0.1]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35"
);
