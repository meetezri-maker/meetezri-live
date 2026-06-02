import { cn } from "@/lib/utils";
import { MOOD_CHECKIN_IMAGES } from "@/lib/solace/moodCheckInImages";
import { SOLACE_SUPPORT_CARD_IMG } from "@/lib/solace/referenceImagery";
import { settingsIconChip } from "@/app/pages/app/settings-hub/settingsIconChip";
import {
  modalBodyText,
  modalDestructiveButton,
  modalEmphasisText,
  modalInput,
  modalOptionCard,
  modalOptionCardMeta,
  modalOptionCardSelected,
  modalOverlay,
  modalPanelSm,
  modalPrimaryButton,
  modalSecondaryButton,
  modalTitle,
} from "@/lib/modalTheme";
import {
  solaceCard,
  solaceHeroLightScrim,
  solacePageAtmosphere,
  solacePageFogMid,
  solacePageGlowTop,
} from "@/app/solace/solacePageChrome";

const light = "[html[data-ezri-theme=light]_&]";
const lightAlt = "[html[data-theme=light]_&]";

export const ACCOUNT_HERO_IMG = MOOD_CHECKIN_IMAGES.heroBanner;
export const ACCOUNT_HELP_IMG = SOLACE_SUPPORT_CARD_IMG;

export const accountPageAtmosphere = cn(
  solacePageAtmosphere,
  "account-settings-page overflow-hidden pb-6"
);

export const accountPageGlowTop = solacePageGlowTop;

export const accountPageFogMid = solacePageFogMid;

export const accountPageGlowBottom = cn(
  "pointer-events-none absolute bottom-[-6rem] left-[8%] h-96 w-96 rounded-full",
  "bg-[radial-gradient(circle,rgba(192,132,252,0.12)_0%,rgba(236,72,153,0.06)_40%,transparent_70%)] blur-3xl"
);

export const accountPageVignette = cn(
  "pointer-events-none absolute inset-0",
  "bg-[radial-gradient(ellipse_95%_75%_at_50%_45%,transparent_35%,rgba(4,5,14,0.62)_100%)]",
  `${light}:bg-[radial-gradient(ellipse_95%_75%_at_50%_45%,transparent_50%,rgba(243,236,255,0.35)_100%)]`,
  `${lightAlt}:bg-[radial-gradient(ellipse_95%_75%_at_50%_45%,transparent_50%,rgba(243,236,255,0.35)_100%)]`
);

export const accountPageNoise = cn(
  "pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-soft-light",
  "[background-image:url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")]"
);

/** Layered cinematic surface — corner ambient light */
export const accountCinematicSurface = cn(
  solaceCard,
  "relative overflow-hidden rounded-[inherit]",
  "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit]",
  "before:bg-[radial-gradient(ellipse_55%_45%_at_0%_0%,rgba(139,92,246,0.1)_0%,transparent_55%),radial-gradient(ellipse_50%_40%_at_100%_100%,rgba(236,72,153,0.07)_0%,transparent_50%)]",
  `${light}:before:opacity-35`,
  `${lightAlt}:before:opacity-35`,
  "after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-[color:var(--solace-border)] after:to-transparent"
);

export const accountCard = accountCinematicSurface;

export const accountRailCard = cn(
  accountCinematicSurface,
  "rounded-[1.85rem]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_0_36px_-14px_rgba(139,92,246,0.18),0_24px_64px_-36px_rgba(0,0,0,0.75)]"
);

export const accountIconChip = settingsIconChip;

export const accountPageTitle = cn(
  "font-serif text-[clamp(2.25rem,4.5vw,3.25rem)] font-light leading-[1.08] tracking-tight",
  "bg-gradient-to-br from-white via-violet-50/95 to-violet-200/75 bg-clip-text text-transparent",
  "[text-shadow:0_0_48px_rgba(139,92,246,0.15)]",
  `${light}:bg-none ${light}:text-[var(--text-primary)] ${light}:[text-shadow:none]`,
  `${lightAlt}:bg-none ${lightAlt}:text-[var(--text-primary)] ${lightAlt}:[text-shadow:none]`
);

export const accountPageSubtitle = cn(
  "mt-3 max-w-2xl text-[15px] leading-relaxed sm:text-base",
  "text-[rgba(255,255,255,0.52)]",
  `${light}:text-[var(--text-secondary)]`,
  `${lightAlt}:text-[var(--text-secondary)]`
);

export const accountBackLink = cn(
  "inline-flex min-h-[44px] items-center gap-2 text-xs font-medium tracking-[0.12em] transition-all duration-300",
  "text-violet-300/50 hover:text-violet-200/95 hover:drop-shadow-[0_0_14px_rgba(167,139,250,0.4)]",
  `${light}:text-[var(--text-secondary)] ${light}:hover:text-[var(--text-primary)] ${light}:hover:drop-shadow-none`,
  `${lightAlt}:text-[var(--text-secondary)] ${lightAlt}:hover:text-[var(--text-primary)]`
);

export const accountSectionTitle = cn(
  "font-serif text-[1.35rem] font-light tracking-tight sm:text-[1.45rem]",
  "text-white bg-gradient-to-r from-white to-violet-100/80 bg-clip-text text-transparent",
  `${light}:bg-none ${light}:text-[var(--text-primary)]`,
  `${lightAlt}:bg-none ${lightAlt}:text-[var(--text-primary)]`
);

export const accountLabel = cn(
  "mb-2.5 block text-[11px] font-medium uppercase tracking-[0.16em]",
  "text-[rgba(255,255,255,0.42)]",
  `${light}:text-[var(--text-muted)]`,
  `${lightAlt}:text-[var(--text-muted)]`
);

/** Readable copy on cards — colors in account-settings-ui.css (no rgba in class names; avoids global unset) */
export const accountTextPrimary = "account-text-primary font-medium";

export const accountTextSecondary = "account-text-secondary text-sm";

export const accountTextMuted = "account-text-muted text-xs";

export const accountTextSubtle = "account-text-subtle text-xs";

/** Label row with visible lucide icon (DOB, etc.) */
export const accountLabelWithIcon = cn(
  accountLabel,
  "flex items-center gap-2 normal-case tracking-[0.08em]"
);

export const accountInput = cn(
  "account-settings-input w-full rounded-2xl border border-white/[0.09] px-4 py-4",
  "bg-[rgba(15,18,38,0.9)] text-[rgba(255,255,255,0.95)]",
  "shadow-[inset_0_2px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04),0_1px_0_rgba(255,255,255,0.03)]",
  "placeholder:text-[rgba(255,255,255,0.26)]",
  "transition-all duration-300",
  "hover:border-violet-400/20",
  "focus:border-violet-400/40 focus:outline-none focus:ring-2 focus:ring-violet-500/25",
  "focus:shadow-[inset_0_2px_12px_rgba(0,0,0,0.38),0_0_24px_-6px_rgba(139,92,246,0.35)]",
  `${light}:border-[color:var(--input-border,#ddd0fa)]`,
  `${light}:bg-[var(--input-bg,#ffffff)]`,
  `${light}:text-[var(--input-text,#101828)]`,
  `${light}:shadow-none`,
  `${light}:placeholder:text-[var(--input-placeholder,#98a2b3)]`,
  `${light}:focus:border-violet-400/50 ${light}:focus:ring-violet-400/25`,
  `${light}:focus:shadow-[0_0_0_3px_rgba(167,139,250,0.2)]`,
  `${lightAlt}:border-[color:var(--input-border)]`,
  `${lightAlt}:bg-[var(--input-bg)]`,
  `${lightAlt}:text-[var(--input-text)]`,
  `${lightAlt}:shadow-none`
);

export const accountTextarea = cn(accountInput, "min-h-[132px] resize-none leading-relaxed py-4");

export const accountPhoneButton = cn(
  "account-settings-input rounded-2xl border-white/[0.09] bg-[rgba(15,18,38,0.9)] text-[rgba(255,255,255,0.92)]",
  "shadow-[inset_0_2px_10px_rgba(0,0,0,0.35)]",
  "hover:border-violet-400/25 hover:bg-[rgba(22,18,48,0.95)] hover:shadow-[0_0_20px_-8px_rgba(139,92,246,0.25)]",
  `${light}:border-[color:var(--input-border)] ${light}:bg-[var(--input-bg)] ${light}:text-[var(--input-text)]`,
  `${light}:shadow-none`,
  `${lightAlt}:border-[color:var(--input-border)] ${lightAlt}:bg-[var(--input-bg)]`
);

export const accountPhoneInput = accountInput;

/** Dark sanctuary popover + command list (phone country, timezone, etc.) */
export const accountDropdownPopover = cn(
  "z-[200] overflow-visible rounded-xl border border-white/[0.1] bg-[#090b12]/[0.98] p-1 pb-0 backdrop-blur-xl",
  "shadow-[0_28px_60px_-12px_rgba(0,0,0,0.9),0_0_40px_rgba(139,92,246,0.12)]",
  `${light}:border-[color:var(--border)] ${light}:bg-[var(--card-solid,#ffffff)]`,
  `${light}:shadow-[0_20px_50px_-12px_rgba(88,28,135,0.14)]`,
  `${lightAlt}:border-[color:var(--border)] ${lightAlt}:bg-[var(--card-solid,#ffffff)]`
);

export const accountDropdownCommand = cn(
  "overflow-visible rounded-lg bg-transparent text-zinc-200",
  `${light}:text-[var(--text-primary)]`,
  `${lightAlt}:text-[var(--text-primary)]`
);

export const accountDropdownCommandInput = cn(
  "h-10 border-0 border-b border-white/10 bg-transparent text-sm text-zinc-100",
  "placeholder:text-zinc-500",
  "[&_[cmdk-input-wrapper]]:rounded-t-lg [&_[cmdk-input-wrapper]]:border-white/10",
  "[&_[cmdk-input-wrapper]_svg]:text-zinc-500",
  "focus-visible:outline-none",
  "[&_[cmdk-input-wrapper]:focus-within]:ring-2 [&_[cmdk-input-wrapper]:focus-within]:ring-violet-500/30",
  `${light}:border-[color:var(--border)] ${light}:text-[var(--text-primary)]`,
  `${light}:placeholder:text-[var(--input-placeholder)]`
);

export const accountDropdownCommandList = "max-h-[min(280px,50vh)]";

export const accountDropdownCommandItem = cn(
  "rounded-lg text-zinc-200",
  "data-[selected=true]:bg-violet-500/20 data-[selected=true]:text-violet-50",
  "aria-selected:bg-violet-500/20 aria-selected:text-violet-50",
  `${light}:text-[var(--text-primary)]`,
  `${light}:data-[selected=true]:bg-violet-100 ${light}:data-[selected=true]:text-violet-900`,
  `${lightAlt}:data-[selected=true]:bg-violet-100 ${lightAlt}:data-[selected=true]:text-violet-900`
);

export const accountDropdownCommandEmpty = cn(
  "py-6 text-center text-sm text-zinc-500",
  `${light}:text-[var(--text-muted)]`,
  `${lightAlt}:text-[var(--text-muted)]`
);

export const accountHeroCard = cn(
  accountCinematicSurface,
  "account-hero-card solace-hero-media solace-image-card rounded-[2rem] border-violet-400/12 bg-transparent",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_0_64px_-16px_rgba(139,92,246,0.28),0_32px_80px_-40px_rgba(0,0,0,0.82)]",
  "before:opacity-40 after:opacity-90",
  `${light}:border-[color:var(--border)] ${light}:shadow-[var(--solace-card-shadow)]`
);

export const accountHeroLightScrimLayer = solaceHeroLightScrim;

export const accountHeroImage = cn(
  "absolute inset-0 z-0 h-full w-full object-cover object-[center_42%]",
  "brightness-[0.58] contrast-[0.92] saturate-[1.12]",
  `${light}:brightness-[1.05] ${light}:contrast-[0.94] ${light}:saturate-[0.88]`,
  `${lightAlt}:brightness-[1.05] ${lightAlt}:contrast-[0.94]`
);

/** Dark cinematic scrims — hidden on light theme (replaced by pastel scrim) */
export const accountHeroOverlaysDark = "account-hero-overlays-dark";

export const accountHeroOverlayLeft = cn(
  accountHeroOverlaysDark,
  "absolute inset-0",
  "bg-gradient-to-r from-[#0a0b18]/96 via-[#0a0b18]/78 to-[#0a0b18]/40 lg:via-[#0a0b18]/55 lg:to-[#0a0b18]/18"
);

export const accountHeroOverlayTop = cn(
  accountHeroOverlaysDark,
  "absolute inset-0",
  "bg-gradient-to-t from-[#0a0b18]/85 via-transparent to-[#1a1030]/20"
);

export const accountHeroOverlayPurple = cn(
  accountHeroOverlaysDark,
  "absolute inset-0",
  "bg-[radial-gradient(ellipse_75%_85%_at_78%_52%,rgba(192,132,252,0.24)_0%,transparent_58%)]"
);

export const accountHeroOverlayWarmth = cn(
  accountHeroOverlaysDark,
  "absolute inset-0",
  "bg-[radial-gradient(ellipse_45%_38%_at_88%_78%,rgba(251,146,60,0.16)_0%,transparent_55%)]"
);

export const accountHeroOverlayMoon = cn(
  accountHeroOverlaysDark,
  "absolute inset-0",
  "bg-[radial-gradient(ellipse_60%_50%_at_70%_25%,rgba(147,197,253,0.08)_0%,transparent_50%)]"
);

export const accountHeroInsetShadow = cn(
  accountHeroOverlaysDark,
  "absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.32)]"
);

export const accountHeroEyebrow = cn(
  "text-xs font-semibold uppercase tracking-[0.2em] text-violet-300/55",
  `${light}:text-[var(--text-muted)]`,
  `${lightAlt}:text-[var(--text-muted)]`
);

export const accountHeroHeading = cn(
  "font-serif text-lg font-light text-white",
  `${light}:text-[var(--text-primary)]`,
  `${lightAlt}:text-[var(--text-primary)]`
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
  "transition-all duration-300 hover:border-violet-400/22 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_32px_-12px_rgba(139,92,246,0.2)]",
  `${light}:border-[color:var(--border)] ${light}:bg-[var(--card-soft,#fbf8ff)]`,
  `${light}:shadow-[var(--solace-card-shadow)] ${light}:hover:border-violet-300/45`
);

/** Security callout — surfaces defined in account-settings-ui.css */
export const account2faCard = cn(
  "account-2fa-card relative overflow-hidden rounded-2xl border p-6 sm:p-7"
);

export const accountDangerCard = cn(
  accountCinematicSurface,
  "rounded-[1.85rem] border-rose-500/15 p-7 sm:p-9",
  "bg-[linear-gradient(165deg,rgba(76,5,25,0.28)_0%,rgba(18,10,18,0.96)_38%,rgba(8,9,20,0.98)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_48px_-18px_rgba(244,63,94,0.22),0_24px_64px_-40px_rgba(0,0,0,0.78)]",
  "before:bg-[radial-gradient(ellipse_60%_50%_at_0%_100%,rgba(244,63,94,0.1)_0%,transparent_55%)]",
  `${light}:border-rose-200/60 ${light}:bg-[linear-gradient(165deg,#fff1f2_0%,#ffffff_100%)]`,
  `${light}:shadow-[var(--solace-card-shadow)]`
);

export const accountDangerInner = cn(
  "flex flex-col gap-4 rounded-2xl border border-rose-500/12 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6",
  "bg-[linear-gradient(135deg,rgba(127,29,29,0.12)_0%,rgba(15,10,18,0.65)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_28px_-12px_rgba(244,63,94,0.15)]",
  `${light}:border-rose-200/50 ${light}:bg-rose-50/80 ${light}:shadow-none`
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
  "absolute inset-0 size-full object-cover object-[center_42%]",
  "brightness-[0.5] contrast-[0.95] saturate-[1.08]",
  `${light}:brightness-[0.92] ${light}:contrast-[0.96] ${light}:saturate-[0.9]`,
  `${lightAlt}:brightness-[0.92] ${lightAlt}:contrast-[0.96]`
);

export const accountHelpOverlayDark = "account-help-overlays-dark";

export const accountHelpOverlay = cn(
  accountHelpOverlayDark,
  "pointer-events-none absolute inset-0",
  "bg-gradient-to-t from-[#0a0b18]/96 via-[#0a0b18]/72 to-[#0a0b18]/35]",
  "bg-[radial-gradient(ellipse_90%_70%_at_50%_100%,rgba(139,92,246,0.12)_0%,transparent_55%)]"
);

export const accountHelpOverlayLight = cn(
  "account-help-overlays-light pointer-events-none absolute inset-0 hidden",
  "bg-gradient-to-t from-[rgba(251,248,255,0.92)] via-[rgba(251,248,255,0.55)] to-transparent",
  "bg-[radial-gradient(ellipse_90%_70%_at_50%_100%,rgba(167,139,250,0.1)_0%,transparent_55%)]",
  `${light}:block`,
  `${lightAlt}:block`
);

export const accountSafeCard = cn(
  accountRailCard,
  "border-emerald-400/15 p-6",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_48px_-16px_rgba(52,211,153,0.28),0_24px_64px_-36px_rgba(0,0,0,0.72)]",
  "before:bg-[radial-gradient(ellipse_70%_55%_at_0%_50%,rgba(52,211,153,0.12)_0%,transparent_55%)]"
);

export const accountRailHeading = cn(
  "text-sm font-semibold text-[rgba(255,255,255,0.92)]",
  `${light}:text-[var(--text-primary)]`,
  `${lightAlt}:text-[var(--text-primary)]`
);

export const accountRailDisplayName = cn(
  "mt-3 text-lg font-semibold text-white",
  `${light}:text-[var(--text-primary)]`,
  `${lightAlt}:text-[var(--text-primary)]`
);

export const accountRailPlanBadge = cn(
  "mt-1.5 inline-flex rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-0.5 text-[10px] font-semibold tracking-wide text-violet-200/90",
  `${light}:border-violet-300/50 ${light}:bg-violet-50 ${light}:text-violet-800`,
  `${lightAlt}:border-violet-300/50 ${lightAlt}:bg-violet-50 ${lightAlt}:text-violet-800`
);

export const accountTipTitle = cn(
  "text-sm font-medium text-[rgba(255,255,255,0.9)]",
  `${light}:text-[var(--text-primary)]`,
  `${lightAlt}:text-[var(--text-primary)]`
);

export const accountTipDesc = cn(
  "mt-0.5 text-xs text-[rgba(255,255,255,0.45)]",
  `${light}:text-[var(--text-muted)]`,
  `${lightAlt}:text-[var(--text-muted)]`
);

export const accountFooterMuted = accountTextSubtle;

export const accountFooterFine = cn(
  "text-xs text-[rgba(255,255,255,0.32)]",
  `${light}:text-[var(--text-muted)]`,
  `${lightAlt}:text-[var(--text-muted)]`
);

export const accountTipsList = cn(
  "mt-5 divide-y divide-white/[0.04]",
  `${light}:divide-[color:var(--border)]`,
  `${lightAlt}:divide-[color:var(--border)]`
);

export const accountTipRow = "flex gap-3.5 py-4 first:pt-0 last:pb-0";

export const accountModalPanel = cn(modalPanelSm, "account-modal-panel p-6");

export const accountModalTitle = modalTitle;

export const accountModalMuted = modalBodyText;

export const accountModalInput = modalInput;

export const accountModalBtnCancel = cn(modalSecondaryButton, "rounded-2xl px-4 py-3");

export const accountModalBtnPrimary = cn(modalPrimaryButton, "w-full rounded-2xl px-4 py-3");

export const accountModalBtnDanger = cn(modalDestructiveButton, "flex-1 rounded-2xl px-4 py-3");

export const accountModalOverlay = modalOverlay;

/** 2FA method tiles in enroll / disable modals */
export function accountMfaMethodOption(selected: boolean) {
  return cn(
    "account-mfa-option w-full text-left",
    selected && "account-mfa-option--selected",
    selected ? modalOptionCardSelected : modalOptionCard
  );
}

export const accountMfaMethodTitle = cn(modalEmphasisText, "account-mfa-option-title block");

export const accountMfaMethodDesc = cn(modalOptionCardMeta, "account-mfa-option-meta mt-1 block");

export const accountMfaInfoBanner = cn(
  "rounded-2xl border border-violet-400/22 p-3.5 text-sm leading-relaxed",
  "bg-[linear-gradient(135deg,rgba(139,92,246,0.14)_0%,rgba(15,18,38,0.92)_100%)] text-violet-100/90",
  `${light}:border-violet-200/60 ${light}:bg-violet-50 ${light}:text-violet-900`,
  `${lightAlt}:border-violet-200/60 ${lightAlt}:bg-violet-50 ${lightAlt}:text-violet-900`
);

/** Segmented control (PIN vs email, etc.) */
export function accountMfaSegmentBtn(selected: boolean) {
  return cn(
    "flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all duration-300",
    selected
      ? cn(
          "border-violet-400/40 bg-violet-500/20 text-violet-100 shadow-[0_0_20px_-10px_rgba(139,92,246,0.35)]",
          `${light}:border-violet-300/55 ${light}:bg-violet-100 ${light}:text-violet-900 ${light}:shadow-none`
        )
      : cn(
          "border-white/[0.08] bg-[rgba(15,18,38,0.55)] text-[rgba(255,255,255,0.55)] hover:border-violet-400/18 hover:text-[rgba(255,255,255,0.78)]",
          `${light}:border-[color:var(--border)] ${light}:bg-[var(--card-soft)] ${light}:text-[var(--text-muted)]`,
          `${light}:hover:border-violet-300/45 ${light}:hover:text-[var(--text-primary)]`
        )
  );
}

export const accountMfaBackLink = cn(
  "w-full py-2 text-sm font-medium transition-colors",
  "text-violet-300/70 hover:text-violet-100",
  `${light}:text-violet-700 ${light}:hover:text-violet-900`,
  `${lightAlt}:text-violet-700 ${lightAlt}:hover:text-violet-900`
);

export const accountMfaOtpInput = cn(
  accountInput,
  "text-center text-2xl tracking-[0.35em] tabular-nums"
);

export const accountOtpSlot = cn(
  "relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.1]",
  "bg-[rgba(15,18,38,0.92)] text-lg font-semibold text-white",
  "shadow-[inset_0_2px_8px_rgba(0,0,0,0.35)]",
  "first:rounded-l-xl first:border-l last:rounded-r-xl",
  "data-[active=true]:z-10 data-[active=true]:border-violet-400/45",
  "data-[active=true]:ring-2 data-[active=true]:ring-violet-500/25",
  `${light}:border-[color:var(--input-border)] ${light}:bg-white ${light}:text-[var(--text-primary)]`,
  `${light}:shadow-none`,
  `${lightAlt}:border-[color:var(--input-border)] ${lightAlt}:bg-white`
);
