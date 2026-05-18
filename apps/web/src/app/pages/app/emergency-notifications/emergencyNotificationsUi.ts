import { cn } from "@/lib/utils";
import {
  notificationsBackLink,
  notificationsFilterPill,
  notificationsGlassCard,
  notificationsHeroAccent,
  notificationsHeroCard,
  notificationsHeroImage,
  notificationsHeroOverlayLeft,
  notificationsHeroOverlayPurple,
  notificationsHeroOverlayWarmth,
  notificationsHeroTitle,
  notificationsIconChip,
  notificationsPageAtmosphere,
  notificationsPageFogMid,
  notificationsPageGlowTop,
  notificationsPageVignette,
  notificationsRailCard,
  NOTIFICATIONS_HERO_IMG,
} from "@/app/pages/app/notifications-settings/notificationsSettingsUi";

export { NOTIFICATIONS_HERO_IMG };

export const emergencyPageAtmosphere = notificationsPageAtmosphere;
export const emergencyPageGlowTop = notificationsPageGlowTop;
export const emergencyPageFogMid = notificationsPageFogMid;
export const emergencyPageVignette = notificationsPageVignette;
export const emergencyBackLink = notificationsBackLink;
export const emergencyHeroTitle = notificationsHeroTitle;
export const emergencyHeroAccent = notificationsHeroAccent;
export const emergencyHeroCard = notificationsHeroCard;
export const emergencyHeroImage = notificationsHeroImage;
export const emergencyHeroOverlayLeft = notificationsHeroOverlayLeft;
export const emergencyHeroOverlayPurple = notificationsHeroOverlayPurple;
export const emergencyHeroOverlayWarmth = notificationsHeroOverlayWarmth;
export const emergencyIconChip = notificationsIconChip;
export const emergencyFilterPill = notificationsFilterPill;
export const emergencyRailCard = notificationsRailCard;

export const emergencyGlassCard = cn(
  notificationsGlassCard,
  "rounded-[1.375rem] border-white/[0.06]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_40px_-14px_rgba(139,92,246,0.12),0_24px_64px_-36px_rgba(0,0,0,0.72)]"
);

export const emergencyNotificationCard = cn(
  emergencyGlassCard,
  "group relative overflow-hidden p-5 transition-all duration-300 sm:p-6",
  "hover:-translate-y-0.5 hover:border-violet-400/18 hover:shadow-[0_0_48px_-16px_rgba(139,92,246,0.28),0_28px_72px_-40px_rgba(0,0,0,0.75)]"
);

export const emergencyCategoryPill = (tone: "emergency" | "safety" | "system") =>
  cn(
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
    {
      emergency:
        "border-fuchsia-400/30 bg-fuchsia-500/12 text-fuchsia-100/95 shadow-[0_0_20px_-8px_rgba(236,72,153,0.45)]",
      safety:
        "border-violet-400/28 bg-violet-500/12 text-violet-100/95 shadow-[0_0_20px_-8px_rgba(139,92,246,0.4)]",
      system:
        "border-amber-400/25 bg-amber-500/10 text-amber-100/90 shadow-[0_0_20px_-8px_rgba(251,191,36,0.32)]",
    }[tone]
  );

export const emergencyStatusDot = (tone: "emergency" | "safety" | "system") =>
  cn("h-2 w-2 shrink-0 rounded-full", {
    emergency: "bg-fuchsia-400 shadow-[0_0_10px_2px_rgba(236,72,153,0.5)]",
    safety: "bg-violet-400 shadow-[0_0_10px_2px_rgba(167,139,250,0.45)]",
    system: "bg-amber-300 shadow-[0_0_10px_2px_rgba(251,191,36,0.4)]",
  }[tone]);

export const emergencyIconOrb = (tone: "emergency" | "safety" | "system" | "wellness") =>
  cn(
    "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full ring-1 sm:h-16 sm:w-16",
    "before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:blur-lg before:content-['']",
    {
      emergency:
        "bg-fuchsia-500/15 text-fuchsia-200 ring-fuchsia-400/25 before:bg-fuchsia-500/30 shadow-[0_0_32px_-6px_rgba(236,72,153,0.55)]",
      safety:
        "bg-violet-500/15 text-violet-200 ring-violet-400/25 before:bg-violet-500/28 shadow-[0_0_32px_-6px_rgba(139,92,246,0.5)]",
      wellness:
        "bg-emerald-500/12 text-emerald-200 ring-emerald-400/22 before:bg-emerald-500/25 shadow-[0_0_32px_-6px_rgba(52,211,153,0.4)]",
      system:
        "bg-amber-500/12 text-amber-200 ring-amber-400/22 before:bg-amber-500/25 shadow-[0_0_32px_-6px_rgba(251,191,36,0.4)]",
    }[tone]
  );

export const emergencySortSelect = cn(
  "min-h-[40px] cursor-pointer appearance-none rounded-full border border-white/[0.1] bg-[rgba(10,12,28,0.72)]",
  "px-4 py-2 pr-9 text-xs font-medium text-[rgba(255,255,255,0.75)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35"
);

export const emergencyBannerGradient = cn(
  "relative overflow-hidden rounded-[1.75rem] border border-fuchsia-400/20 p-6 sm:p-8",
  "bg-[linear-gradient(125deg,rgba(190,24,93,0.55)_0%,rgba(192,38,211,0.48)_38%,rgba(124,58,237,0.52)_100%)]",
  "shadow-[0_0_64px_-16px_rgba(236,72,153,0.35),0_28px_72px_-40px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.12)]"
);

export const emergencyBannerCta = cn(
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-white/35",
  "bg-white px-6 py-3 text-sm font-semibold text-fuchsia-700",
  "shadow-[0_8px_32px_-8px_rgba(0,0,0,0.35)] transition-all duration-300",
  "hover:bg-white/95 hover:shadow-[0_12px_40px_-10px_rgba(0,0,0,0.4)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-fuchsia-600/40"
);

export const emergencyFooterStrip = cn(
  "flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-[rgba(10,12,28,0.55)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md"
);

export const emergencyImmediateHelpCard = cn(
  "relative overflow-hidden rounded-3xl border border-fuchsia-400/25 p-5 sm:p-6",
  "bg-[linear-gradient(145deg,#db2777_0%,#c026d3_42%,#7c3aed_100%)]",
  "shadow-[0_0_56px_-12px_rgba(236,72,153,0.45),0_24px_64px_-36px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.15)]"
);

export const emergencyResourceRow = cn(
  "group flex items-center gap-3.5 rounded-2xl border border-transparent px-1 py-3 transition-all duration-300",
  "hover:border-violet-400/15 hover:bg-violet-500/[0.06]"
);

export const emergencyPrefRow = cn(
  "flex items-center justify-between gap-3 border-b border-white/[0.06] py-3.5 last:border-b-0"
);

export const emergencyManageLink = cn(
  "mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-fuchsia-300/90 transition-colors hover:text-fuchsia-200"
);
