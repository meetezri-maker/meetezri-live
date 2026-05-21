import { cn } from "@/lib/utils";
import { settingsIconChip } from "@/app/pages/app/settings-hub/settingsUi";

export const ACCOUNT_HERO_IMG = "/community/hero-lake.jpg";
export const ACCOUNT_HELP_IMG = "/community/scene-bedroom.jpg";

/** Matte navy sanctuary base — not flat black */
export const accountPageAtmosphere = cn(
  "relative overflow-hidden pb-6",
  "bg-[linear-gradient(165deg,#0b0d1c_0%,#090a16_38%,#0c0a18_72%,#080910_100%)]"
);

export const accountPageGlowTop = cn(
  "pointer-events-none absolute -top-48 right-[-8%] h-[32rem] w-[32rem] rounded-full",
  "bg-[radial-gradient(circle,rgba(139,92,246,0.2)_0%,rgba(192,132,252,0.08)_35%,transparent_68%)] blur-3xl"
);

export const accountPageFogMid = cn(
  "pointer-events-none absolute left-1/2 top-[12%] h-[36rem] w-[min(100%,58rem)] -translate-x-1/2 rounded-full",
  "bg-[radial-gradient(ellipse_80%_55%_at_50%_40%,rgba(76,29,149,0.14)_0%,rgba(34,211,238,0.04)_45%,transparent_72%)] blur-3xl"
);

export const accountPageGlowBottom = cn(
  "pointer-events-none absolute bottom-[-6rem] left-[8%] h-96 w-96 rounded-full",
  "bg-[radial-gradient(circle,rgba(192,132,252,0.12)_0%,rgba(236,72,153,0.06)_40%,transparent_70%)] blur-3xl"
);

export const accountPageVignette = cn(
  "pointer-events-none absolute inset-0",
  "bg-[radial-gradient(ellipse_95%_75%_at_50%_45%,transparent_35%,rgba(4,5,14,0.62)_100%)]"
);

export const accountPageNoise = cn(
  "pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-soft-light",
  "[background-image:url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")]"
);

/** Layered cinematic surface — corner ambient light */
export const accountCinematicSurface = cn(
  "relative overflow-hidden rounded-[inherit] border border-white/[0.06]",
  "bg-[linear-gradient(180deg,rgba(15,16,32,0.95)_0%,rgba(8,9,20,0.98)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-28px_56px_-28px_rgba(0,0,0,0.4),0_0_48px_-12px_rgba(139,92,246,0.12),0_28px_72px_-40px_rgba(0,0,0,0.78)]",
  "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit]",
  "before:bg-[radial-gradient(ellipse_55%_45%_at_0%_0%,rgba(139,92,246,0.1)_0%,transparent_55%),radial-gradient(ellipse_50%_40%_at_100%_100%,rgba(236,72,153,0.07)_0%,transparent_50%)]",
  "after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent"
);

export const accountCard = accountCinematicSurface;

export const accountRailCard = cn(
  accountCinematicSurface,
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_0_36px_-14px_rgba(139,92,246,0.18),0_24px_64px_-36px_rgba(0,0,0,0.75)]"
);

export const accountIconChip = settingsIconChip;

export const accountPageTitle = cn(
  "font-serif text-[clamp(2.25rem,4.5vw,3.25rem)] font-light leading-[1.08] tracking-tight",
  "bg-gradient-to-br from-white via-violet-50/95 to-violet-200/75 bg-clip-text text-transparent",
  "[text-shadow:0_0_48px_rgba(139,92,246,0.15)]"
);

export const accountPageSubtitle = "mt-3 max-w-2xl text-[15px] leading-relaxed text-[rgba(255,255,255,0.52)] sm:text-base";

export const accountBackLink = cn(
  "inline-flex min-h-[44px] items-center gap-2 text-xs font-medium tracking-[0.12em]",
  "text-violet-300/50 transition-all duration-300",
  "hover:text-violet-200/95 hover:drop-shadow-[0_0_14px_rgba(167,139,250,0.4)]"
);

export const accountSectionTitle = cn(
  "font-serif text-[1.35rem] font-light tracking-tight text-white sm:text-[1.45rem]",
  "bg-gradient-to-r from-white to-violet-100/80 bg-clip-text text-transparent"
);

export const accountLabel = cn(
  "mb-2.5 block text-[11px] font-medium uppercase tracking-[0.16em]",
  "text-[rgba(255,255,255,0.42)]"
);

export const accountInput = cn(
  "w-full rounded-2xl border border-white/[0.09] px-4 py-4",
  "bg-[rgba(15,18,38,0.9)] text-[rgba(255,255,255,0.95)]",
  "shadow-[inset_0_2px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04),0_1px_0_rgba(255,255,255,0.03)]",
  "placeholder:text-[rgba(255,255,255,0.26)]",
  "transition-all duration-300",
  "hover:border-violet-400/20",
  "focus:border-violet-400/40 focus:outline-none focus:ring-2 focus:ring-violet-500/25",
  "focus:shadow-[inset_0_2px_12px_rgba(0,0,0,0.38),0_0_24px_-6px_rgba(139,92,246,0.35)]"
);

export const accountTextarea = cn(accountInput, "min-h-[132px] resize-none leading-relaxed py-4");

export const accountPhoneButton = cn(
  "rounded-2xl border-white/[0.09] bg-[rgba(15,18,38,0.9)] text-[rgba(255,255,255,0.92)]",
  "shadow-[inset_0_2px_10px_rgba(0,0,0,0.35)]",
  "hover:border-violet-400/25 hover:bg-[rgba(22,18,48,0.95)] hover:shadow-[0_0_20px_-8px_rgba(139,92,246,0.25)]"
);

export const accountPhoneInput = accountInput;

export const accountHeroCard = cn(
  accountCinematicSurface,
  "rounded-[2rem] border-violet-400/12 bg-transparent",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_0_64px_-16px_rgba(139,92,246,0.28),0_32px_80px_-40px_rgba(0,0,0,0.82)]",
  "before:opacity-40 after:opacity-90"
);

export const accountHeroImage = cn(
  "absolute inset-0 h-full w-full object-cover object-[center_42%]",
  "brightness-[0.58] contrast-[0.92] saturate-[1.12]"
);

export const accountHeroOverlayLeft = cn(
  "absolute inset-0",
  "bg-gradient-to-r from-[#0a0b18]/96 via-[#0a0b18]/78 to-[#0a0b18]/40 lg:via-[#0a0b18]/55 lg:to-[#0a0b18]/18"
);

export const accountHeroOverlayTop = cn(
  "absolute inset-0",
  "bg-gradient-to-t from-[#0a0b18]/85 via-transparent to-[#1a1030]/20"
);

export const accountHeroOverlayPurple = cn(
  "absolute inset-0",
  "bg-[radial-gradient(ellipse_75%_85%_at_78%_52%,rgba(192,132,252,0.24)_0%,transparent_58%)]"
);

export const accountHeroOverlayWarmth = cn(
  "absolute inset-0",
  "bg-[radial-gradient(ellipse_45%_38%_at_88%_78%,rgba(251,146,60,0.16)_0%,transparent_55%)]"
);

export const accountHeroOverlayMoon = cn(
  "absolute inset-0",
  "bg-[radial-gradient(ellipse_60%_50%_at_70%_25%,rgba(147,197,253,0.08)_0%,transparent_50%)]"
);

export const accountAvatarHalo = cn(
  "absolute -inset-2 rounded-full",
  "bg-[radial-gradient(circle,rgba(167,139,250,0.45)_0%,rgba(139,92,246,0.2)_40%,transparent_70%)]",
  "blur-lg"
);

export const accountAvatarRing = cn(
  "relative rounded-full border-2 border-violet-300/35 object-cover",
  "shadow-[0_0_40px_-6px_rgba(139,92,246,0.65),0_0_0_1px_rgba(255,255,255,0.06)]"
);

export const accountAvatarEditBtn = cn(
  "absolute bottom-0.5 right-0.5 flex h-9 w-9 items-center justify-center rounded-full",
  "border border-violet-300/35 bg-[linear-gradient(180deg,#1a1630_0%,#0f0d1c_100%)]",
  "shadow-[0_0_22px_-4px_rgba(139,92,246,0.55),inset_0_1px_0_rgba(255,255,255,0.1)]",
  "transition-all duration-300 hover:border-violet-200/45 hover:shadow-[0_0_28px_-2px_rgba(167,139,250,0.5)]"
);

export const accountSectionCard = cn(
  accountCinematicSurface,
  "rounded-[1.85rem] p-7 sm:p-9"
);

export const accountBtnPrimary = cn(
  "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white",
  "bg-[linear-gradient(135deg,#7C3AED_0%,#A855F7_42%,#C026D3_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_40px_-6px_rgba(168,85,247,0.55),0_14px_36px_-14px_rgba(0,0,0,0.7)]",
  "transition-all duration-300",
  "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.26),0_0_52px_-4px_rgba(192,132,252,0.5),0_16px_40px_-12px_rgba(0,0,0,0.75)]",
  "hover:brightness-110 active:scale-[0.98]"
);

export const accountBtnGhost = cn(
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/[0.1] px-5 py-2.5",
  "bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)]",
  "text-sm font-semibold text-[rgba(255,255,255,0.88)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_4px_20px_-8px_rgba(0,0,0,0.5)]",
  "transition-all duration-300 hover:border-violet-300/30 hover:bg-violet-500/[0.1] hover:shadow-[0_0_28px_-8px_rgba(139,92,246,0.3)]",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

export const accountBtnUpload = accountBtnPrimary;

export const accountBtnEnable = cn(
  accountBtnPrimary,
  "shrink-0 !min-h-[40px] whitespace-nowrap rounded-full px-5 py-2 text-sm"
);

export const accountPasswordRow = cn(
  "flex flex-col gap-4 rounded-2xl border border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between",
  "bg-[linear-gradient(135deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.015)_55%,rgba(139,92,246,0.04)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_-20px_rgba(0,0,0,0.5)]",
  "transition-all duration-300 hover:border-violet-400/22 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_32px_-12px_rgba(139,92,246,0.2)]"
);

export const account2faCard = cn(
  "relative overflow-hidden rounded-2xl border border-violet-400/35 p-6 sm:p-7",
  "bg-[linear-gradient(145deg,rgba(88,28,135,0.22)_0%,rgba(30,20,55,0.92)_42%,rgba(10,10,24,0.98)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_56px_-14px_rgba(139,92,246,0.42),0_16px_48px_-24px_rgba(0,0,0,0.65)]",
  "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit]",
  "before:bg-[radial-gradient(ellipse_70%_60%_at_100%_0%,rgba(192,132,252,0.14)_0%,transparent_55%)]"
);

export const accountDangerCard = cn(
  accountCinematicSurface,
  "rounded-[1.85rem] border-rose-500/15 p-7 sm:p-9",
  "bg-[linear-gradient(165deg,rgba(76,5,25,0.28)_0%,rgba(18,10,18,0.96)_38%,rgba(8,9,20,0.98)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_48px_-18px_rgba(244,63,94,0.22),0_24px_64px_-40px_rgba(0,0,0,0.78)]",
  "before:bg-[radial-gradient(ellipse_60%_50%_at_0%_100%,rgba(244,63,94,0.1)_0%,transparent_55%)]"
);

export const accountDangerInner = cn(
  "flex flex-col gap-4 rounded-2xl border border-rose-500/12 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6",
  "bg-[linear-gradient(135deg,rgba(127,29,29,0.12)_0%,rgba(15,10,18,0.65)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_28px_-12px_rgba(244,63,94,0.15)]"
);

export const accountBtnDanger = cn(
  "inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-full px-5 py-2.5",
  "border border-rose-400/30 bg-[linear-gradient(135deg,rgba(153,27,27,0.65)_0%,rgba(76,5,25,0.85)_100%)]",
  "text-sm font-semibold text-rose-50/95",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_28px_-8px_rgba(244,63,94,0.4)]",
  "transition-all duration-300 hover:border-rose-300/40 hover:shadow-[0_0_36px_-6px_rgba(244,63,94,0.45)]",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

export const accountSaveButton = cn(
  "relative inline-flex w-full min-h-[56px] items-center justify-center overflow-hidden rounded-full",
  "px-6 py-4 text-base font-semibold text-white",
  "bg-[linear-gradient(90deg,#7C3AED_0%,#A855F7_35%,#D946EF_68%,#EC4899_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_0_56px_-8px_rgba(236,72,153,0.45),0_0_40px_-10px_rgba(139,92,246,0.4),0_18px_48px_-16px_rgba(0,0,0,0.75)]",
  "transition-all duration-300",
  "hover:brightness-110 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_0_64px_-6px_rgba(236,72,153,0.55),0_0_48px_-8px_rgba(139,92,246,0.45),0_20px_52px_-14px_rgba(0,0,0,0.8)]",
  "active:scale-[0.99]",
  "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-[inherit]",
  "before:bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,transparent_48%)]"
);

/** Centered label + icon above button sheen */
export const accountSaveButtonContent = "relative z-[1] inline-flex items-center justify-center gap-2.5";

export const accountSaveButtonIcon = "h-[18px] w-[18px] shrink-0 stroke-[2.25] opacity-95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]";

export const accountSuccessBanner = cn(
  "mb-6 flex items-center gap-3 rounded-2xl border border-emerald-400/22 px-5 py-4",
  "bg-[linear-gradient(135deg,rgba(6,78,59,0.38)_0%,rgba(8,12,28,0.92)_100%)]",
  "shadow-[0_0_36px_-12px_rgba(52,211,153,0.35),inset_0_1px_0_rgba(167,243,208,0.08)]"
);

export const accountRailProfileGlow = cn(
  "pointer-events-none absolute inset-x-4 top-12 h-32 rounded-full",
  "bg-[radial-gradient(ellipse_80%_100%_at_50%_50%,rgba(139,92,246,0.14)_0%,transparent_70%)] blur-xl"
);

export const accountHelpImage = cn(
  "absolute inset-0 size-full object-cover object-center",
  "brightness-[0.5] contrast-[0.95] saturate-[1.08]"
);

export const accountHelpOverlay = cn(
  "pointer-events-none absolute inset-0",
  "bg-gradient-to-t from-[#0a0b18]/96 via-[#0a0b18]/72 to-[#0a0b18]/35]",
  "bg-[radial-gradient(ellipse_90%_70%_at_50%_100%,rgba(139,92,246,0.12)_0%,transparent_55%)]"
);

export const accountSafeCard = cn(
  accountRailCard,
  "border-emerald-400/15 p-6",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_48px_-16px_rgba(52,211,153,0.28),0_24px_64px_-36px_rgba(0,0,0,0.72)]",
  "before:bg-[radial-gradient(ellipse_70%_55%_at_0%_50%,rgba(52,211,153,0.12)_0%,transparent_55%)]"
);

export const accountTipsList = "mt-5 divide-y divide-white/[0.04]";

export const accountTipRow = "flex gap-3.5 py-4 first:pt-0 last:pb-0";

export const accountModalPanel = cn(
  "w-full max-w-md rounded-[1.75rem] border border-white/[0.08] p-6 shadow-2xl",
  "bg-[linear-gradient(180deg,rgba(18,18,40,0.98)_0%,rgba(10,10,24,0.99)_100%)]",
  "text-[rgba(255,255,255,0.94)]"
);

export const accountModalTitle = "text-xl font-semibold text-white";

export const accountModalMuted = "text-sm text-[rgba(255,255,255,0.55)]";

export const accountModalInput = accountInput;

export const accountModalBtnCancel = accountBtnGhost;

export const accountModalBtnPrimary = cn(accountBtnPrimary, "rounded-2xl px-4 py-3");

export const accountModalBtnDanger = cn(accountBtnDanger, "flex-1 rounded-2xl px-4 py-3");
