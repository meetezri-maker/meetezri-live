import { cn } from "@/lib/utils";
import { MOOD_CHECKIN_IMAGES } from "@/lib/solace/moodCheckInImages";
import {
  solaceHeroContent,
  solaceHeroImage,
  solaceHeroLightScrim,
  solaceHeroMediaShell,
  solaceHeroOverlayAccent,
  solaceHeroOverlayBottom,
  solaceHeroOverlayReadability,
  solaceHeroSection,
} from "@/app/solace/solacePageChrome";

const light = "[html[data-ezri-theme=light]_&]";
const lightAlt = "[html[data-theme=light]_&]";

/** Shared banner for settings subpages (hero-lake.jpg is not in public assets). */
export const SETTINGS_SUBPAGE_HERO_IMG = MOOD_CHECKIN_IMAGES.heroBanner;

const settingsSubpageHeroSection = cn(
  solaceHeroSection,
  "settings-subpage-hero min-h-[280px] sm:min-h-[300px] lg:min-h-[320px]",
  `${light}:border-[color:var(--border)]`,
  `${lightAlt}:border-[color:var(--border)]`
);

export const settingsSubpageHeroShell = cn(solaceHeroMediaShell, settingsSubpageHeroSection);

const settingsSubpageHeroSectionCompact = cn(
  solaceHeroSection,
  "settings-subpage-hero min-h-[232px] sm:min-h-[248px] lg:min-h-[256px]",
  `${light}:border-[color:var(--border)]`,
  `${lightAlt}:border-[color:var(--border)]`
);

export const settingsSubpageHeroShellCompact = cn(
  solaceHeroMediaShell,
  settingsSubpageHeroSectionCompact
);

export const settingsSubpageHeroInnerCompact = cn(
  solaceHeroContent,
  "relative z-10 flex min-h-[232px] flex-col justify-end p-6 sm:min-h-[248px] sm:p-8 lg:min-h-[256px]"
);

export const settingsSubpageHeroImage = cn(solaceHeroImage, "object-[center_38%]");

export const settingsSubpageHeroLightScrim = solaceHeroLightScrim;

export const settingsSubpageHeroOverlayReadability = solaceHeroOverlayReadability;

export const settingsSubpageHeroOverlayBottom = solaceHeroOverlayBottom;

export const settingsSubpageHeroOverlayAccent = solaceHeroOverlayAccent;

/** Inner layout wrapper — place back link, titles, and optional orb inside */
export const settingsSubpageHeroInner = cn(
  solaceHeroContent,
  "flex min-h-[280px] flex-col justify-between p-6 sm:min-h-[300px] sm:p-8 lg:min-h-[320px] lg:flex-row lg:items-center lg:gap-8"
);

export const settingsSubpageHeroCopy = "max-w-xl flex-1";

export const settingsSubpageHeroBackLink = cn(
  "inline-flex min-h-[40px] items-center gap-2 text-xs font-medium tracking-[0.1em] transition-colors",
  "text-violet-300/55 hover:text-violet-200/95",
  `${light}:text-[var(--text-secondary)] ${light}:hover:text-[var(--text-primary)]`,
  `${lightAlt}:text-[var(--text-secondary)] ${lightAlt}:hover:text-[var(--text-primary)]`
);

export const settingsSubpageHeroTitleSerif = cn(
  "font-serif text-[clamp(2rem,4.2vw,3rem)] font-light leading-[1.06] tracking-tight text-white",
  `${light}:text-[var(--text-primary)] ${light}:[text-shadow:none]`,
  `${lightAlt}:text-[var(--text-primary)] ${lightAlt}:[text-shadow:none]`
);

export const settingsSubpageHeroAccent = cn(
  "bg-gradient-to-r from-violet-200 via-fuchsia-200 to-violet-300 bg-clip-text text-transparent",
  "drop-shadow-[0_0_28px_rgba(167,139,250,0.45)]",
  `${light}:bg-none ${light}:text-[#7c3aed] ${light}:drop-shadow-none`,
  `${lightAlt}:bg-none ${lightAlt}:text-[#7c3aed] ${lightAlt}:drop-shadow-none`
);

export const settingsSubpageHeroLead = cn(
  "settings-subpage-hero-lead mt-3 max-w-lg text-sm leading-relaxed sm:text-[15px]"
);

export const settingsSubpageHeroBody = cn(
  "settings-subpage-hero-body mt-3 max-w-lg text-xs leading-relaxed"
);

/** Notifications-style unread orb */
export const settingsSubpageHeroOrbWrap = "flex shrink-0 justify-center lg:justify-end";

export const settingsSubpageHeroOrbGlow = cn(
  "absolute inset-0 rounded-full blur-md",
  "bg-[radial-gradient(circle,rgba(236,72,153,0.28)_0%,rgba(139,92,246,0.12)_45%,transparent_70%)]",
  `${light}:bg-[radial-gradient(circle,rgba(167,139,250,0.2)_0%,transparent_70%)]`,
  `${lightAlt}:bg-[radial-gradient(circle,rgba(167,139,250,0.2)_0%,transparent_70%)]`
);

export const settingsSubpageHeroOrb = cn(
  "settings-subpage-hero-orb relative flex h-full w-full flex-col items-center justify-center rounded-full border text-center backdrop-blur-md",
  "border-fuchsia-300/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.09)_0%,rgba(15,16,36,0.78)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_52px_-8px_rgba(192,132,252,0.55)]",
  `${light}:border-violet-200/60 ${light}:bg-[rgba(255,255,255,0.92)]`,
  `${light}:shadow-[0_12px_40px_-12px_rgba(88,28,135,0.18)]`,
  `${lightAlt}:border-violet-200/60 ${lightAlt}:bg-[rgba(255,255,255,0.92)]`
);

export const settingsSubpageHeroOrbIcon = cn(
  "h-7 w-7 text-violet-200/90",
  `${light}:text-violet-600`,
  `${lightAlt}:text-violet-600`
);

export const settingsSubpageHeroOrbValue = cn(
  "settings-subpage-hero-orb-value mt-2 text-3xl font-semibold text-white",
  `${light}:text-[var(--text-primary)]`,
  `${lightAlt}:text-[var(--text-primary)]`
);

export const settingsSubpageHeroOrbLabel = cn(
  "settings-subpage-hero-orb-label mt-0.5 text-[11px] font-medium uppercase tracking-wider text-fuchsia-200/70",
  `${light}:text-violet-700`,
  `${lightAlt}:text-violet-700`
);

export const settingsSubpageHeroOrbQuote = cn(
  "settings-subpage-hero-orb-quote mt-2 max-w-[150px] text-[10px] leading-snug"
);
