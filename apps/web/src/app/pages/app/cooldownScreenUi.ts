import { cn } from "@/lib/utils";

export const COOLDOWN_HERO_IMG = "/community/hero-lake.jpg";

export const cooldownPageAtmosphere = cn(
  "pointer-events-none fixed inset-0 z-0",
  "bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(139,92,246,0.12),transparent_55%)]",
);

export const cooldownMatteCard = cn(
  "relative overflow-hidden rounded-[26px] border border-white/[0.08]",
  "bg-[linear-gradient(160deg,rgba(22,24,38,0.92)_0%,rgba(10,12,22,0.9)_55%,rgba(8,10,18,0.94)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_32px_80px_-40px_rgba(0,0,0,0.85)]",
  "backdrop-blur-xl",
);

export const cooldownBackLink = cn(
  "inline-flex min-h-[44px] items-center gap-2 text-sm font-medium",
  "text-violet-200/70 transition-colors hover:text-violet-100",
);

export const cooldownHeroShell = cn(
  "relative overflow-hidden rounded-[28px] border border-white/[0.1]",
  "shadow-[0_40px_100px_-48px_rgba(0,0,0,0.9),0_0_60px_-24px_rgba(88,28,135,0.35)]",
);

export const cooldownHeroImage = "absolute inset-0 h-full w-full object-cover object-center";

export const cooldownHeroOverlay = cn(
  "absolute inset-0",
  "bg-[linear-gradient(105deg,rgba(5,6,14,0.92)_0%,rgba(15,10,28,0.72)_42%,rgba(40,20,50,0.45)_68%,rgba(5,6,14,0.55)_100%)]",
);

export const cooldownHeroWarmth = cn(
  "absolute inset-0 mix-blend-soft-light opacity-70",
  "bg-[radial-gradient(ellipse_45%_55%_at_78%_62%,rgba(251,191,36,0.35),transparent_65%)]",
);

export const cooldownPill = cn(
  "inline-flex items-center gap-2 rounded-full border border-white/[0.1]",
  "bg-black/30 px-3.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur-sm",
);

export const cooldownBenefitChip = cn(
  "inline-flex items-center gap-2 rounded-full border border-white/[0.08]",
  "bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/65",
);

export const cooldownActivityCard = (glow: string) =>
  cn(
    cooldownMatteCard,
    "cursor-pointer p-6 text-center transition-all duration-300",
    "hover:border-white/[0.14] hover:shadow-[0_0_48px_-16px_var(--glow)]",
    glow,
  );

export const cooldownContinueBtn = (enabled: boolean) =>
  cn(
    "inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-semibold transition-all duration-300",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07080f]",
    enabled
      ? "border border-violet-300/30 bg-gradient-to-r from-violet-600/90 via-fuchsia-600/85 to-violet-700/90 text-white shadow-[0_0_40px_-8px_rgba(168,85,247,0.65),inset_0_1px_0_rgba(255,255,255,0.15)] hover:brightness-110"
      : "cursor-not-allowed border border-white/[0.08] bg-white/[0.06] text-white/40 shadow-none",
  );

export const cooldownHomeBtn = cn(
  "inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/[0.12]",
  "bg-white/[0.04] px-6 text-sm font-medium text-white/80 transition-colors",
  "hover:border-white/[0.18] hover:bg-white/[0.07] hover:text-white",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
);

export const cooldownResourceCard = cn(
  "group flex min-h-[56px] items-center gap-3 rounded-2xl border border-white/[0.1]",
  "bg-black/25 px-4 py-3 backdrop-blur-md transition-all",
  "hover:border-white/[0.18] hover:bg-black/35",
);
