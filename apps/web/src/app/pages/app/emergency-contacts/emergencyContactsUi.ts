import { cn } from "@/lib/utils";
import {
  modalDestructiveButton,
  modalOverlay,
  modalPanelMd,
  modalPrimaryButton,
  modalSecondaryButton,
  modalSubtitle,
  modalTitle,
} from "@/lib/modalTheme";
import {
  settingsCard,
  settingsIconChip,
  settingsPageAtmosphere,
  settingsPageFogMid,
  settingsPageGlowTop,
  settingsPageVignette,
} from "@/app/pages/app/settings-hub/settingsUi";
import {
  SETTINGS_SUBPAGE_HERO_IMG,
  settingsSubpageHeroAccent,
  settingsSubpageHeroBackLink,
  settingsSubpageHeroImage,
  settingsSubpageHeroLightScrim,
  settingsSubpageHeroOverlayAccent,
  settingsSubpageHeroOverlayBottom,
  settingsSubpageHeroOverlayReadability,
  settingsSubpageHeroShell,
  settingsSubpageHeroTitleSerif,
} from "@/app/pages/app/settings-hub/settingsSubpageHero";

export const EMERGENCY_HERO_IMG = SETTINGS_SUBPAGE_HERO_IMG;
export const EMERGENCY_RAIL_IMG = SETTINGS_SUBPAGE_HERO_IMG;

export const emergencyPageAtmosphere = cn(settingsPageAtmosphere, "emergency-contacts-page");

export const emergencyHeroCard = cn(settingsSubpageHeroShell, "emergency-hero-card min-h-[240px] sm:min-h-[260px]");

export const emergencyPageGlowTop = settingsPageGlowTop;
export const emergencyPageFogMid = settingsPageFogMid;
export const emergencyPageVignette = settingsPageVignette;

export const emergencyGlassCard = cn(
  settingsCard,
  "light-theme-card light-theme-card-hover rounded-[1.75rem] border-white/[0.06]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_48px_-16px_rgba(139,92,246,0.14),0_28px_72px_-40px_rgba(0,0,0,0.75)]",
  "[html[data-ezri-theme=light]_&]:shadow-[var(--solace-card-shadow)]",
  "[html[data-theme=light]_&]:shadow-[var(--solace-card-shadow)]"
);

export const emergencyRailCard = cn(
  emergencyGlassCard,
  "solace-rail-card rounded-3xl p-5 sm:p-6",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_40px_-14px_rgba(139,92,246,0.18),0_24px_64px_-36px_rgba(0,0,0,0.72)]",
  "[html[data-ezri-theme=light]_&]:bg-[var(--rail-card-bg)]",
  "[html[data-theme=light]_&]:bg-[var(--rail-card-bg)]"
);

export const emergencyHeroImage = settingsSubpageHeroImage;
export const emergencyHeroLightScrim = settingsSubpageHeroLightScrim;
export const emergencyHeroOverlayReadability = settingsSubpageHeroOverlayReadability;
export const emergencyHeroOverlayBottom = settingsSubpageHeroOverlayBottom;
export const emergencyHeroOverlayAccent = settingsSubpageHeroOverlayAccent;
export const emergencyHeroOverlayLeft = emergencyHeroOverlayReadability;
export const emergencyHeroOverlayPurple = emergencyHeroOverlayAccent;
export const emergencyHeroOverlayWarmth = emergencyHeroOverlayBottom;

export const emergencyIconChip = settingsIconChip;

export const emergencyBackLink = settingsSubpageHeroBackLink;

export const emergencyHeroTitle = cn(
  settingsSubpageHeroTitleSerif,
  "text-[clamp(1.85rem,4vw,2.75rem)]"
);

export const emergencyHeroAccent = cn(
  settingsSubpageHeroAccent,
  "from-fuchsia-200 via-rose-200 to-violet-200"
);

/** Hero heart — semantic class avoids light-theme svg currentColor override */
export const emergencyHeroIcon = cn(
  "emergency-hero-icon h-8 w-8 shrink-0",
  "drop-shadow-[0_0_16px_rgba(236,72,153,0.45)]"
);

export const emergencyHeroSubtitle = cn(
  "emergency-hero-subtitle mt-3 max-w-xl text-sm leading-relaxed sm:text-[15px]",
  "text-[rgba(255,255,255,0.62)]"
);

export const emergencyRailTitle = "emergency-rail-title font-serif text-lg font-light text-white";

export const emergencyRailItemTitle = "emergency-rail-title text-sm font-medium";

export const emergencyRailBody = "emergency-rail-body mt-1 text-xs leading-relaxed text-[rgba(255,255,255,0.45)]";

export const emergencyAboutTitle = "emergency-about-title font-serif text-lg font-light text-white";

export const emergencyScenicBanner = cn(emergencyRailCard, "emergency-scenic-banner relative overflow-hidden");

export const emergencyScenicBannerImage = cn(
  "emergency-scenic-banner-img absolute inset-0 z-0 h-full w-full object-cover object-[center_70%]",
  "brightness-[0.38] saturate-[1.1]"
);

export const emergencyScenicLightScrim = cn(
  "emergency-scenic-light-scrim",
  settingsSubpageHeroLightScrim
);

export const emergencyScenicOverlayDark = cn(
  "emergency-scenic-overlays-dark pointer-events-none absolute inset-0 z-[1]",
  "bg-gradient-to-t from-[#0a0b18]/95 via-[#0a0b18]/70 to-[#0a0b18]/35"
);

export const emergencyScenicOverlayWarm = cn(
  "emergency-scenic-overlays-dark pointer-events-none absolute inset-0 z-[1]",
  "bg-[radial-gradient(ellipse_70%_50%_at_50%_100%,rgba(251,146,60,0.18)_0%,transparent_60%)]"
);

export const emergencyBannerTitle = "emergency-banner-title font-serif text-lg font-light";

export const emergencyBannerTitleLg =
  "emergency-banner-title font-serif text-xl font-light sm:text-[1.35rem]";

export const emergencyBannerBody = "emergency-banner-body mt-2 text-sm leading-relaxed";

export const emergencyBannerBodyMuted = "emergency-banner-body mt-2 text-sm";

export const emergencyBannerContent = "emergency-banner-content relative z-10";

export const emergencyResourcesBanner = cn(
  "emergency-resources-banner relative overflow-hidden rounded-[1.75rem] border border-fuchsia-400/18 p-6 sm:p-7",
  "bg-[linear-gradient(135deg,rgba(76,29,149,0.55)_0%,rgba(136,19,55,0.42)_45%,rgba(30,16,48,0.88)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_48px_-12px_rgba(236,72,153,0.35),0_28px_72px_-36px_rgba(0,0,0,0.75)]"
);

export const emergencyResourcesBannerImg = cn(
  "emergency-resources-banner-img pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-[center_42%] opacity-35 mix-blend-soft-light"
);

export const emergencyResourcesOverlayDark = cn(
  "emergency-resources-overlays-dark pointer-events-none absolute inset-0 z-[1]",
  "bg-[linear-gradient(135deg,rgba(76,29,149,0.65)_0%,rgba(136,19,55,0.5)_50%,rgba(15,10,35,0.85)_100%)]"
);

export const emergencyFooterMuted = "emergency-footer-muted text-sm text-[rgba(255,255,255,0.42)]";

export const emergencyFooterFine = "emergency-footer-muted mt-1 text-xs text-[rgba(255,255,255,0.32)]";

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

/** Consent confirmed badge on contact avatar */
export const emergencyContactConsentBadge = cn(
  "absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full",
  "border border-emerald-300/40 bg-emerald-500/90 text-white",
  "shadow-[0_0_12px_-2px_rgba(52,211,153,0.55)]"
);

export const emergencyActionBtn = cn(
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.08]",
  "bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)]",
  "text-violet-200/90 transition-all duration-300",
  "hover:border-violet-400/28 hover:bg-violet-500/[0.12] hover:text-fuchsia-100 hover:shadow-[0_0_20px_-6px_rgba(139,92,246,0.45)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
);

/** @deprecated Use emergencyResourcesBanner */
export const emergencyResourcesCard = emergencyResourcesBanner;

export const emergencyResourcesCta = cn(
  "emergency-resources-cta group mt-5 flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-white/20",
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

/** Modal backdrop — shared modalTheme + page hook for light CSS */
export const emergencyModalOverlay = cn(
  modalOverlay,
  "emergency-modal-overlay fixed inset-0",
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

export const emergencyModalShell = cn(
  modalPanelMd,
  "emergency-modal-panel w-full max-w-[min(600px,calc(100%-2rem))] max-h-[min(90vh,calc(100%-2rem))] overflow-y-auto",
  "rounded-[28px] p-7 sm:p-8",
  "border-violet-500/[0.22]",
  "bg-[linear-gradient(180deg,rgba(18,18,38,0.98)_0%,rgba(8,9,22,0.98)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_60px_-12px_rgba(139,92,246,0.32),0_32px_80px_-24px_rgba(0,0,0,0.78)]",
  "text-[rgba(255,255,255,0.94)]"
);

export const emergencyModalPanel = emergencyModalShell;

export const emergencyModalHeaderIcon = cn(
  emergencyIconChip("pink"),
  "emergency-modal-header-icon h-12 w-12 shrink-0 [&_svg]:h-5 [&_svg]:w-5"
);

export const emergencyModalEyebrow = cn(
  "emergency-modal-eyebrow text-[10px] font-semibold uppercase tracking-[0.2em]",
  "text-fuchsia-300/55"
);

export const emergencyModalTitle = cn(
  modalTitle,
  "emergency-modal-title font-serif text-xl font-light leading-snug sm:text-[1.35rem]"
);

export const emergencyModalSubtitle = cn(modalSubtitle, "emergency-modal-subtitle mt-1 leading-relaxed");

export const emergencyModalSectionHeading = cn(
  "text-sm font-semibold text-[rgba(255,255,255,0.9)]"
);

export const emergencyModalBody = cn(
  "text-sm leading-relaxed text-[rgba(255,255,255,0.52)]"
);

/** Important notice — purple sanctuary tone (matches modal shell) */
export const emergencyModalAmberNotice = cn(
  "space-y-2 rounded-2xl border border-violet-400/22 p-4",
  "bg-[linear-gradient(165deg,rgba(76,29,149,0.32)_0%,rgba(18,12,32,0.58)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_28px_-14px_rgba(139,92,246,0.2)]"
);

export const emergencyModalAmberTitle = cn(
  "flex items-center gap-2 text-sm font-semibold text-violet-100/95"
);

/** Pink safety consent checkbox card */
export const emergencyModalConsentBox = cn(
  "emergency-modal-consent rounded-2xl border border-fuchsia-400/18 px-4 py-3.5",
  "bg-[linear-gradient(165deg,rgba(76,5,45,0.22)_0%,rgba(18,12,28,0.55)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
);

export const emergencyModalCheckbox = cn(
  "emergency-modal-checkbox mt-0.5 border-violet-400/35 bg-[rgba(10,12,28,0.95)]",
  "data-[state=checked]:border-fuchsia-400/50 data-[state=checked]:bg-violet-500",
  "data-[state=checked]:text-white focus-visible:ring-fuchsia-400/35"
);

export const emergencyModalCheckboxLabel = cn(
  "emergency-modal-checkbox-label cursor-pointer text-xs font-normal leading-snug",
  "text-[rgba(255,255,255,0.78)]"
);

export const emergencyModalCheckboxHelp = cn(
  "emergency-modal-checkbox-help text-xs text-[rgba(255,255,255,0.42)]"
);

export const emergencyModalNoteList = "space-y-2.5";

export const emergencyModalNoteItem = cn(
  "flex gap-2.5 text-sm leading-relaxed text-[rgba(255,255,255,0.48)]"
);

export const emergencyModalField = cn(
  "emergency-modal-field flex min-h-[48px] items-center gap-2.5 rounded-2xl border border-violet-400/22 px-3.5",
  "bg-[rgba(10,12,28,0.72)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  "transition-all duration-300 focus-within:border-violet-400/38 focus-within:bg-[rgba(14,16,34,0.85)]",
  "focus-within:ring-2 focus-within:ring-violet-400/20"
);

export const emergencyModalInput = cn(
  "emergency-modal-input flex-1 bg-transparent text-sm outline-none",
  "text-white/92 placeholder:text-violet-300/40"
);

export const emergencyModalLabel = cn(
  "emergency-modal-label mb-2 block text-sm font-medium text-white/88"
);

export const emergencyModalFieldHint = cn(
  "emergency-modal-field-hint mb-2 text-xs text-violet-200/52"
);

export const emergencyModalPhoneButton = cn(
  "emergency-modal-phone-btn h-12 min-h-[48px] w-[120px] shrink-0 justify-between rounded-2xl border border-violet-400/22 px-3 sm:w-[140px]",
  "bg-[rgba(10,12,28,0.72)] text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  "transition-all duration-300 hover:border-violet-400/35 hover:bg-[rgba(14,16,34,0.82)]"
);

export const emergencyModalPhoneInput = cn(
  "emergency-modal-phone-input h-12 min-h-[48px] flex-1 rounded-2xl border border-violet-400/22 bg-[rgba(10,12,28,0.72)]",
  "text-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  "placeholder:text-violet-300/40",
  "transition-all duration-300 focus:border-violet-400/38 focus:ring-2 focus:ring-violet-400/20"
);

export const emergencyModalEmphasis = "emergency-modal-emphasis font-medium";

export const emergencyModalFormStack = "space-y-[18px]";

export const emergencyModalBtnRow = cn(
  "flex flex-col-reverse gap-3.5 pt-1 sm:flex-row sm:gap-3.5"
);

export const emergencyModalBtnCancel = cn(
  modalSecondaryButton,
  "emergency-modal-btn-cancel inline-flex min-h-[44px] flex-1 items-center justify-center rounded-2xl px-4 text-sm font-semibold",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

export const emergencyModalBtnPrimary = cn(
  modalPrimaryButton,
  "emergency-modal-btn-save inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl px-4",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

export const emergencyModalBtnSave = emergencyModalBtnPrimary;

export const emergencyModalBtnDestructive = cn(
  modalDestructiveButton,
  "emergency-modal-btn-destructive inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl px-4",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

/** Opens safety consent in review mode (eye control on Emergency Contacts hero). */
export const emergencyConsentReviewTrigger = cn(
  "inline-flex min-h-[36px] items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
  "transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35",
  "border-violet-400/22 bg-violet-500/[0.08] text-violet-200/85",
  "hover:border-violet-300/38 hover:bg-violet-500/14 hover:text-violet-100/95"
);

export const emergencyConsentReviewTriggerAgreed = cn(
  emergencyConsentReviewTrigger,
  "border-emerald-400/25 bg-emerald-500/[0.1] text-emerald-200/90",
  "hover:border-emerald-300/35 hover:bg-emerald-500/16 hover:text-emerald-100/95"
);
