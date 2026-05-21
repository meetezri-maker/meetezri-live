import { cn } from "@/lib/utils";

export const SETTINGS_HERO_IMG = "/community/hero-lake.jpg";
export const SETTINGS_HELP_IMG = "/community/scene-bedroom.jpg";

export const settingsPageAtmosphere = cn(
  "relative min-h-full overflow-x-hidden pb-10 bg-[#0a0b18]"
);

export const settingsPageGlowTop = cn(
  "pointer-events-none absolute -top-40 right-[-10%] h-[28rem] w-[28rem] rounded-full",
  "bg-[radial-gradient(circle,rgba(139,92,246,0.14)_0%,transparent_68%)] blur-3xl"
);

export const settingsPageFogMid = cn(
  "pointer-events-none absolute left-1/2 top-[18%] h-[32rem] w-[min(100%,56rem)] -translate-x-1/2 rounded-full",
  "bg-[radial-gradient(ellipse_80%_55%_at_50%_40%,rgba(76,29,149,0.1)_0%,transparent_70%)] blur-3xl"
);

export const settingsPageVignette = cn(
  "pointer-events-none absolute inset-0",
  "bg-[radial-gradient(ellipse_90%_70%_at_50%_50%,transparent_40%,rgba(4,5,14,0.55)_100%)]"
);

export const settingsCard = cn(
  "rounded-[1.25rem] border border-white/[0.05]",
  "bg-[linear-gradient(180deg,rgba(18,18,40,0.95)_0%,rgba(10,10,24,0.98)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-24px_48px_-24px_rgba(0,0,0,0.35),0_0_40px_rgba(168,85,247,0.06),0_24px_64px_-36px_rgba(0,0,0,0.72)]",
  "backdrop-blur-xl"
);

/** Hero banner — transparent shell so the photo fills the full section */
export const settingsHeroSection = cn(
  "relative isolate overflow-hidden rounded-[1.25rem] border border-violet-500/10",
  "shadow-[0_0_56px_-20px_rgba(139,92,246,0.35),0_24px_64px_-36px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(255,255,255,0.07)]"
);

export const settingsHeroImage = cn(
  "absolute inset-0 z-0 h-full w-full object-cover object-[center_32%]",
  "brightness-[0.94] contrast-[1.05] saturate-[1.08]"
);

export const settingsHeroOverlayReadability = cn(
  "pointer-events-none absolute inset-0 z-[1]",
  "bg-[linear-gradient(90deg,rgba(10,11,24,0.62)_0%,rgba(10,11,24,0.28)_40%,transparent_62%)]"
);

export const settingsHeroOverlayBottom = cn(
  "pointer-events-none absolute inset-0 z-[1]",
  "bg-[linear-gradient(180deg,transparent_0%,rgba(5,8,22,0.28)_50%,rgba(5,8,22,0.62)_100%)]"
);

export const settingsHeroOverlayAccent = cn(
  "pointer-events-none absolute inset-0 z-[1]",
  "bg-[radial-gradient(ellipse_70%_80%_at_85%_40%,rgba(192,132,252,0.14),transparent_55%)]"
);

export const settingsSectionTitle = "text-sm font-semibold uppercase tracking-[0.22em] text-[rgba(255,255,255,0.45)]";

export const settingsRowLink = cn(
  "group flex min-h-[44px] items-center gap-3.5 px-4 py-3.5 sm:px-5 sm:py-4",
  "transition-all duration-300",
  "hover:bg-violet-500/[0.06] hover:shadow-[inset_0_0_32px_-16px_rgba(139,92,246,0.25)]"
);

export const settingsIconChip = (tone: "violet" | "pink" | "cyan" | "amber" | "rose" | "emerald" | "blue" | "orange" = "violet") =>
  cn(
    "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1",
    "before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:blur-md before:content-['']",
    {
      violet:
        "bg-violet-500/12 text-violet-200 ring-violet-400/20 before:bg-violet-500/25 shadow-[0_0_22px_-6px_rgba(139,92,246,0.55)]",
      pink:
        "bg-fuchsia-500/12 text-fuchsia-200 ring-fuchsia-400/20 before:bg-fuchsia-500/22 shadow-[0_0_22px_-6px_rgba(236,72,153,0.5)]",
      cyan: "bg-cyan-500/12 text-cyan-200 ring-cyan-400/20 before:bg-cyan-500/20 shadow-[0_0_22px_-6px_rgba(34,211,238,0.4)]",
      amber:
        "bg-amber-500/12 text-amber-200 ring-amber-400/20 before:bg-amber-400/25 shadow-[0_0_22px_-6px_rgba(251,191,36,0.45)]",
      rose: "bg-rose-500/12 text-rose-200 ring-rose-400/20 before:bg-rose-500/22 shadow-[0_0_22px_-6px_rgba(244,63,94,0.4)]",
      emerald:
        "bg-emerald-500/12 text-emerald-200 ring-emerald-400/20 before:bg-emerald-500/22 shadow-[0_0_22px_-6px_rgba(52,211,153,0.4)]",
      blue: "bg-blue-500/12 text-blue-200 ring-blue-400/20 before:bg-blue-500/22 shadow-[0_0_22px_-6px_rgba(59,130,246,0.4)]",
      orange:
        "bg-orange-500/12 text-orange-200 ring-orange-400/20 before:bg-orange-500/22 shadow-[0_0_22px_-6px_rgba(249,115,22,0.4)]",
    }[tone]
  );

export const settingsBtnPrimary = cn(
  "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white",
  "bg-[linear-gradient(135deg,#7C3AED_0%,#C026D3_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_36px_-6px_rgba(168,85,247,0.55),0_12px_32px_-16px_rgba(0,0,0,0.65)]",
  "transition-all duration-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_44px_-4px_rgba(192,132,252,0.5),0_14px_36px_-14px_rgba(0,0,0,0.7)]"
);

export const settingsQuickCard = cn(
  "flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border border-white/[0.06] p-3",
  "bg-[linear-gradient(160deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  "transition-all duration-300 hover:border-violet-400/25 hover:bg-violet-500/[0.08] hover:shadow-[0_0_28px_-8px_rgba(139,92,246,0.3)]",
  "active:scale-[0.98]"
);

export const settingsCompactToolCard = cn(
  "group flex min-h-[100px] flex-col justify-between rounded-2xl border border-white/[0.06] p-4",
  "bg-[linear-gradient(160deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.01)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  "transition-all duration-300 hover:border-violet-400/22 hover:bg-violet-500/[0.07] hover:shadow-[0_0_32px_-10px_rgba(139,92,246,0.28)]"
);
