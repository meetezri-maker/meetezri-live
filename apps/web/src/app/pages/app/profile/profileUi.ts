import { cn } from "@/lib/utils";

export const PROFILE_HERO_IMG = "/community/hero-lake.jpg";
export const PROFILE_EMERGENCY_BG = "/community/scene-water.jpg";
export const PROFILE_SIDEBAR_INSPIRATION_IMG = "/community/scene-forest.jpg";

/** Page-level night sanctuary atmosphere (no layout change) */
export const profilePageAtmosphere = cn(
  "relative min-h-full overflow-hidden pb-10 bg-[#0a0b18]"
);

export const profilePageGlowTop = cn(
  "pointer-events-none absolute -top-40 right-[-10%] h-[28rem] w-[28rem] rounded-full",
  "bg-[radial-gradient(circle,rgba(139,92,246,0.14)_0%,transparent_68%)] blur-3xl"
);

export const profilePageFogMid = cn(
  "pointer-events-none absolute left-1/2 top-[18%] h-[32rem] w-[min(100%,56rem)] -translate-x-1/2 rounded-full",
  "bg-[radial-gradient(ellipse_80%_55%_at_50%_40%,rgba(76,29,149,0.1)_0%,transparent_70%)] blur-3xl"
);

export const profilePageGlowBottom = cn(
  "pointer-events-none absolute bottom-[-8rem] left-[15%] h-80 w-80 rounded-full",
  "bg-[radial-gradient(circle,rgba(192,132,252,0.1)_0%,transparent_70%)] blur-3xl"
);

export const profilePageVignette = cn(
  "pointer-events-none absolute inset-0",
  "bg-[radial-gradient(ellipse_90%_70%_at_50%_50%,transparent_40%,rgba(4,5,14,0.55)_100%)]"
);

export const profilePageNoise = cn(
  "pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-soft-light",
  "[background-image:url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")]"
);

/** Matte cinematic card surface */
export const profileCard = cn(
  "rounded-[1.25rem] border border-white/[0.05]",
  "bg-[linear-gradient(180deg,rgba(18,18,40,0.95)_0%,rgba(10,10,24,0.98)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-24px_48px_-24px_rgba(0,0,0,0.35),0_0_40px_rgba(168,85,247,0.06),0_24px_64px_-36px_rgba(0,0,0,0.72)]",
  "backdrop-blur-xl"
);

export const profileCardHeader = cn(
  "flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.05] px-5 py-4 sm:px-6",
  "bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,transparent_100%)]"
);

export const profileCardTitle = "text-base font-semibold text-[rgba(255,255,255,0.96)] [text-shadow:0_0_24px_rgba(167,139,250,0.12)]";
export const profileCardSubtitle = "mt-0.5 text-xs text-[rgba(255,255,255,0.68)]";
export const profileBodyMuted = "text-[rgba(255,255,255,0.45)]";

export const profileRow = cn(
  "flex min-h-[44px] items-center gap-3 rounded-2xl border border-white/[0.05] px-3.5 py-3",
  "bg-[linear-gradient(135deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.015)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  "transition-all duration-300 hover:border-violet-400/20 hover:bg-violet-500/[0.07] hover:shadow-[0_0_28px_-8px_rgba(139,92,246,0.2)] group"
);

export const profileIconCircle = (tone: "violet" | "pink" | "cyan" | "amber" | "rose" | "emerald" = "violet") =>
  cn(
    "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1",
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
    }[tone]
  );

export const profilePill = cn(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
);

export const profileBtnPrimary = cn(
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white",
  "bg-[linear-gradient(135deg,#7C3AED_0%,#C026D3_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_36px_-6px_rgba(168,85,247,0.55),0_12px_32px_-16px_rgba(0,0,0,0.65)]",
  "transition-all duration-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_44px_-4px_rgba(192,132,252,0.5),0_14px_36px_-14px_rgba(0,0,0,0.7)]",
  "disabled:opacity-60"
);

export const profileBtnGhost = cn(
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-white/[0.08] px-5 py-3 text-sm font-semibold",
  "bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)]",
  "text-[rgba(255,255,255,0.88)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  "transition-all duration-300 hover:border-violet-400/25 hover:bg-violet-500/[0.08] hover:shadow-[0_0_24px_-8px_rgba(139,92,246,0.25)]",
  "disabled:opacity-60"
);

export const profileHeroShell = cn(
  "min-h-[300px] sm:min-h-[340px]",
  "border border-white/[0.05]",
  "shadow-[0_0_48px_rgba(168,85,247,0.08),0_32px_80px_-40px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.09)]",
  "[&>img]:z-0 [&>img]:object-[center_32%] [&>img]:brightness-[0.94] [&>img]:contrast-[1.05] [&>img]:saturate-[1.08]"
);

export const profileHeroStatStrip = cn(
  "border-t border-white/[0.06]",
  "bg-[linear-gradient(180deg,rgba(8,8,20,0.55)_0%,rgba(6,6,16,0.82)_100%)]",
  "backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
);

export const profileRightRailGlow = cn(
  "relative",
  "before:pointer-events-none before:absolute before:-inset-px before:rounded-[1.35rem] before:bg-[linear-gradient(180deg,rgba(139,92,246,0.08),transparent_40%,rgba(236,72,153,0.05))] before:opacity-80 before:content-['']"
);

export const profileMilestoneChip = (unlocked: boolean) =>
  cn(
    "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors",
    unlocked
      ? "border-emerald-400/30 bg-[linear-gradient(135deg,rgba(16,185,129,0.12)_0%,rgba(6,78,59,0.08)_100%)] text-[rgba(255,255,255,0.92)] shadow-[inset_0_1px_0_rgba(167,243,208,0.12),0_0_24px_-10px_rgba(52,211,153,0.35)]"
      : "border-white/[0.05] bg-white/[0.02] text-[rgba(255,255,255,0.45)]"
  );

export const profileSupportTile = cn(
  "group flex min-h-[88px] flex-col justify-between rounded-2xl border border-white/[0.05] p-4",
  "bg-[linear-gradient(160deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.01)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  "transition-all duration-300 hover:border-fuchsia-400/22 hover:bg-fuchsia-500/[0.07] hover:shadow-[0_0_32px_-10px_rgba(236,72,153,0.28)]"
);

export const profileEmergencyCard = cn(
  profileCard,
  "relative overflow-hidden border-rose-400/15",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_48px_-12px_rgba(244,63,94,0.15),0_0_40px_rgba(168,85,247,0.05)]"
);

export const profileEmergencyBg = cn(
  "pointer-events-none absolute inset-0 h-full w-full object-cover",
  "opacity-[0.18] mix-blend-soft-light saturate-[1.15]"
);

export const profileEmergencyWarmthAmber = cn(
  "pointer-events-none absolute inset-0",
  "bg-[radial-gradient(ellipse_80%_60%_at_80%_90%,rgba(251,191,36,0.16),transparent_55%)]"
);

export const profileEmergencyWarmthViolet = cn(
  "pointer-events-none absolute inset-0",
  "bg-[radial-gradient(ellipse_60%_50%_at_20%_20%,rgba(192,132,252,0.12),transparent_50%)]"
);

/** Dark sanctuary form controls (profile edit mode) */
export const profileFieldLabel = "mb-1 text-[10px] font-semibold uppercase tracking-widest text-[rgba(255,255,255,0.45)]";

export const profileInput = cn(
  "w-full rounded-xl border border-white/[0.08] px-3 py-2.5 text-sm font-medium",
  "bg-[rgba(15,18,38,0.92)] text-[rgba(255,255,255,0.95)]",
  "shadow-[inset_0_2px_10px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.04)]",
  "placeholder:text-[rgba(255,255,255,0.28)]",
  "transition-all duration-300",
  "hover:border-violet-400/22",
  "focus:border-violet-400/35 focus:outline-none focus:ring-2 focus:ring-violet-500/22",
  "focus:shadow-[inset_0_2px_10px_rgba(0,0,0,0.32),0_0_20px_-8px_rgba(139,92,246,0.28)]",
  "disabled:opacity-60"
);

export const profilePhoneButton = cn(
  "h-10 shrink-0 justify-between rounded-xl border-white/[0.08] px-3 sm:w-[120px]",
  "bg-[rgba(15,18,38,0.92)] text-[rgba(255,255,255,0.92)]",
  "shadow-[inset_0_2px_10px_rgba(0,0,0,0.35)]",
  "hover:border-violet-400/25 hover:bg-[rgba(22,18,48,0.95)] hover:text-white"
);

export const profilePhoneInput = cn(
  "h-10 min-h-[40px] flex-1 rounded-xl border-white/[0.08]",
  "bg-[rgba(15,18,38,0.92)] text-[rgba(255,255,255,0.95)]",
  "shadow-[inset_0_2px_10px_rgba(0,0,0,0.35)]",
  "placeholder:text-[rgba(255,255,255,0.28)]",
  "focus-visible:border-violet-400/35 focus-visible:ring-violet-500/22",
  "!bg-[rgba(15,18,38,0.92)]"
);

export const profileEmergencyLabel = "mb-1 text-[10px] font-semibold uppercase tracking-widest text-[rgba(255,255,255,0.52)]";

export const profileEmergencyInput = cn(
  "w-full rounded-xl border border-rose-400/15 px-3 py-2.5 text-sm font-medium",
  "bg-[rgba(18,14,32,0.92)] text-[rgba(255,255,255,0.95)]",
  "shadow-[inset_0_2px_10px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.04)]",
  "placeholder:text-[rgba(255,255,255,0.28)]",
  "transition-all duration-300",
  "hover:border-rose-400/22",
  "focus:border-rose-400/30 focus:outline-none focus:ring-2 focus:ring-rose-400/20",
  "focus:shadow-[inset_0_2px_10px_rgba(0,0,0,0.32),0_0_20px_-8px_rgba(244,63,94,0.2)]",
  "disabled:opacity-60"
);

export const profileEmergencyPhoneButton = cn(
  "h-10 shrink-0 justify-between rounded-xl border-rose-400/15 px-3 sm:w-[120px]",
  "bg-[rgba(18,14,32,0.92)] text-[rgba(255,255,255,0.9)]",
  "shadow-[inset_0_2px_10px_rgba(0,0,0,0.38)]",
  "hover:border-rose-400/28 hover:bg-rose-500/[0.08] hover:text-white"
);

export const profileEmergencyPhoneInput = cn(
  "h-10 min-h-[40px] flex-1 rounded-xl border-rose-400/15",
  "bg-[rgba(18,14,32,0.92)] text-[rgba(255,255,255,0.95)]",
  "shadow-[inset_0_2px_10px_rgba(0,0,0,0.38)]",
  "placeholder:text-[rgba(255,255,255,0.28)]",
  "focus-visible:border-rose-400/30 focus-visible:ring-rose-400/20",
  "!bg-[rgba(18,14,32,0.92)]"
);

export function formatSubscriptionPlanLabel(plan: string | undefined | null): string {
  const raw = String(plan || "").trim().toLowerCase();
  if (!raw) return "Member plan";
  if (raw === "trial") return "Trial plan";
  if (raw === "core") return "Core plan";
  if (raw === "pro") return "Pro plan";
  if (raw === "basic") return "Basic plan";
  if (raw.includes("premium")) return "Premium plan";
  return raw.charAt(0).toUpperCase() + raw.slice(1).replace(/_/g, " ");
}
