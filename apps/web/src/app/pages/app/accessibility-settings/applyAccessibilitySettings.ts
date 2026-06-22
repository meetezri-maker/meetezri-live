export type LetterSpacingOption = "compact" | "normal" | "relaxed";
export type LineHeightOption = "tight" | "normal" | "loose";

export type AccessibilitySettings = {
  fontSize: string;
  letterSpacing: LetterSpacingOption;
  lineHeight: LineHeightOption;
  highContrast: boolean;
  reducedMotion: boolean;
  screenReader: boolean;
  closedCaptions: boolean;
  keyboardNav: boolean;
  focusIndicators: boolean;
  autoPlay: boolean;
  largeClickTargets: boolean;
  dyslexiaFont: boolean;
  calmTransitions: boolean;
};

/** @deprecated Legacy field — migrated on load */
type LegacyAccessibilitySettings = Partial<AccessibilitySettings> & {
  textSpacing?: string;
};

export const ACCESSIBILITY_STORAGE_KEY = "ezri_accessibility_settings";

/** Visible steps — normal vs relaxed must be clearly different */
const LETTER_SPACING_CSS: Record<LetterSpacingOption, string> = {
  compact: "-0.05em",
  normal: "0em",
  relaxed: "0.12em",
};

const WORD_SPACING_CSS: Record<LetterSpacingOption, string> = {
  compact: "0em",
  normal: "0em",
  relaxed: "0.2em",
};

const LINE_HEIGHT_CSS: Record<LineHeightOption, string> = {
  tight: "1.35",
  normal: "1.5",
  loose: "1.9",
};

export function defaultAccessibilitySettings(): AccessibilitySettings {
  return {
    fontSize: "medium",
    letterSpacing: "normal",
    lineHeight: "normal",
    highContrast: false,
    reducedMotion: false,
    screenReader: false,
    closedCaptions: true,
    keyboardNav: true,
    focusIndicators: false,
    autoPlay: false,
    largeClickTargets: false,
    dyslexiaFont: false,
    calmTransitions: true,
  };
}

function normalizeLetterSpacing(value: string | undefined): LetterSpacingOption {
  if (value === "compact" || value === "normal" || value === "relaxed") return value;
  if (value === "loose") return "relaxed";
  return "normal";
}

function normalizeLineHeight(value: string | undefined): LineHeightOption {
  if (value === "tight" || value === "normal" || value === "loose") return value;
  return "normal";
}

function migrateFromLegacyTextSpacing(textSpacing: string | undefined): {
  letterSpacing: LetterSpacingOption;
  lineHeight: LineHeightOption;
} {
  if (textSpacing === "compact") {
    return { letterSpacing: "compact", lineHeight: "tight" };
  }
  if (textSpacing === "relaxed" || textSpacing === "loose") {
    return { letterSpacing: "relaxed", lineHeight: "loose" };
  }
  return { letterSpacing: "normal", lineHeight: "normal" };
}

export function normalizeAccessibilitySettings(
  parsed: LegacyAccessibilitySettings
): AccessibilitySettings {
  const defaults = defaultAccessibilitySettings();
  const legacy = parsed.textSpacing ? migrateFromLegacyTextSpacing(parsed.textSpacing) : null;

  return {
    ...defaults,
    ...parsed,
    letterSpacing: parsed.letterSpacing
      ? normalizeLetterSpacing(parsed.letterSpacing)
      : legacy?.letterSpacing ?? defaults.letterSpacing,
    lineHeight: parsed.lineHeight
      ? normalizeLineHeight(parsed.lineHeight)
      : legacy?.lineHeight ?? defaults.lineHeight,
    dyslexiaFont: Boolean(parsed.dyslexiaFont),
    calmTransitions: parsed.calmTransitions ?? defaults.calmTransitions,
  };
}

export function loadAccessibilitySettings(): AccessibilitySettings {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return defaultAccessibilitySettings();
  }
  const saved = window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEY);
  if (!saved) return defaultAccessibilitySettings();
  try {
    return normalizeAccessibilitySettings(JSON.parse(saved) as LegacyAccessibilitySettings);
  } catch {
    return defaultAccessibilitySettings();
  }
}

export function saveAccessibilitySettings(settings: AccessibilitySettings): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
  window.localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(settings));
}

export function letterSpacingToCss(letterSpacing: LetterSpacingOption): string {
  return LETTER_SPACING_CSS[letterSpacing] ?? LETTER_SPACING_CSS.normal;
}

export function wordSpacingToCss(letterSpacing: LetterSpacingOption): string {
  return WORD_SPACING_CSS[letterSpacing] ?? WORD_SPACING_CSS.normal;
}

export function lineHeightToCss(lineHeight: LineHeightOption): string {
  return LINE_HEIGHT_CSS[lineHeight] ?? LINE_HEIGHT_CSS.normal;
}

export function lineHeightToNumber(lineHeight: LineHeightOption): number {
  return Number.parseFloat(lineHeightToCss(lineHeight));
}

export function applyAccessibilitySettings(settings: AccessibilitySettings): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  const fontSizePx =
    settings.fontSize === "small"
      ? "14px"
      : settings.fontSize === "large"
        ? "18px"
        : settings.fontSize === "xlarge"
          ? "20px"
          : "16px";
  root.style.setProperty("--font-size", fontSizePx);
  root.style.setProperty("--text-letter-spacing", letterSpacingToCss(settings.letterSpacing));
  root.style.setProperty("--text-word-spacing", wordSpacingToCss(settings.letterSpacing));
  root.style.setProperty("--text-line-height", lineHeightToCss(settings.lineHeight));

  root.classList.remove("a11y-ls-compact", "a11y-ls-normal", "a11y-ls-relaxed");
  root.classList.add(`a11y-ls-${settings.letterSpacing}`);
  root.classList.remove("a11y-lh-tight", "a11y-lh-normal", "a11y-lh-loose");
  root.classList.add(`a11y-lh-${settings.lineHeight}`);
  root.dataset.a11yLetterSpacing = settings.letterSpacing;
  root.dataset.a11yLineHeight = settings.lineHeight;

  root.classList.toggle("high-contrast", Boolean(settings.highContrast));
  root.classList.toggle("reduced-motion", Boolean(settings.reducedMotion));
  root.classList.toggle("focus-indicators", Boolean(settings.focusIndicators));
  root.classList.toggle("large-click-targets", Boolean(settings.largeClickTargets));
  root.classList.toggle("dyslexia-font", Boolean(settings.dyslexiaFont));
  root.classList.toggle(
    "calm-transitions",
    Boolean(settings.calmTransitions && !settings.reducedMotion)
  );

  root.classList.remove("reading-width-narrow", "reading-width-medium", "reading-width-wide");
}
