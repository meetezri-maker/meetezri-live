import { motion } from "motion/react";
import {
  Accessibility,
  ArrowLeft,
  BookOpen,
  Check,
  Contrast,
  ExternalLink,
  Hand,
  Heart,
  MousePointer,
  PlayCircle,
  Shield,
  Sparkles,
  Type,
  Waves,
  AlignVerticalSpaceAround,
  SeparatorHorizontal,
  HelpCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  applyAccessibilitySettings,
  lineHeightToNumber,
  letterSpacingToCss,
  wordSpacingToCss,
  loadAccessibilitySettings,
  saveAccessibilitySettings,
  type AccessibilitySettings,
} from "@/app/pages/app/accessibility-settings/applyAccessibilitySettings";
import {
  ACCESSIBILITY_HEART_IMG,
  ACCESSIBILITY_HERO_IMG,
  accessibilityBackLink,
  accessibilityBtnGhost,
  accessibilityBtnPrimary,
  accessibilityCompactCard,
  accessibilityCompactCardTight,
  accessibilityHeroAccent,
  accessibilityHeroBody,
  accessibilityHeroCard,
  accessibilityHeroIconCapsule,
  accessibilityHeroImage,
  accessibilityHeroInner,
  accessibilityHeroLightScrim,
  accessibilityHeroOverlayAccent,
  accessibilityHeroOverlayBottom,
  accessibilityHeroOverlayReadability,
  accessibilityHeroTitle,
  accessibilityIconChip,
  accessibilityMiniPreviewCard,
  accessibilityPageAtmosphere,
  accessibilityPageFogMid,
  accessibilityPageGlowTop,
  accessibilityPageLanternGlow,
  accessibilityPageVignette,
  accessibilityPanel,
  accessibilityPrefRow,
  accessibilityRailCard,
  accessibilitySectionHeading,
  accessibilitySectionLabel,
  accessibilitySectionSubtitle,
  accessibilitySegmentOption,
  accessibilitySegmentTrack,
  accessibilityWcagBanner,
} from "@/app/pages/app/accessibility-settings/accessibilitySettingsUi";

interface AccessibilityToggleProps {
  enabled: boolean;
  onToggle: () => void;
  ariaLabel: string;
  disabled?: boolean;
}

function AccessibilityToggle({
  enabled,
  onToggle,
  ariaLabel,
  disabled = false,
}: AccessibilityToggleProps) {
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      onClick={disabled ? undefined : onToggle}
      className={cn(
        "a11y-toggle relative h-8 w-14 shrink-0 rounded-full border border-transparent transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/45",
        disabled && "cursor-not-allowed opacity-45",
        enabled
          ? "border-emerald-400/45 bg-gradient-to-r from-emerald-500/75 to-teal-500/75 shadow-[0_0_20px_-4px_rgba(52,211,153,0.55)]"
          : "bg-white/10"
      )}
    >
      <motion.span
        animate={{ x: enabled ? 26 : 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className="a11y-toggle-thumb absolute top-1 left-0 h-6 w-6 rounded-full bg-white shadow-md"
      />
    </motion.button>
  );
}

interface SegmentedControlProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

function SegmentedControl({ options, value, onChange, ariaLabel }: SegmentedControlProps) {
  return (
    <motion.div
      className={cn(accessibilitySegmentTrack, "a11y-segment-track")}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <motion.button
            key={opt.value}
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => onChange(opt.value)}
            className={cn(accessibilitySegmentOption(selected), "a11y-segment-btn")}
            aria-pressed={selected}
          >
            {selected && <Check className="h-3 w-3 shrink-0 text-emerald-300" strokeWidth={3} aria-hidden />}
            {opt.label}
          </motion.button>
        );
      })}
    </motion.div>
  );
}

interface PrefRowProps {
  icon: ReactNode;
  tone: "violet" | "pink" | "cyan" | "amber" | "rose" | "emerald" | "blue" | "orange";
  title: string;
  description: string;
  control: ReactNode;
}

function AccessibilityPrefRow({ icon, tone, title, description, control }: PrefRowProps) {
  return (
    <motion.div className={accessibilityPrefRow} initial={false}>
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <div className={accessibilityIconChip(tone)}>{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[rgba(255,255,255,0.92)]">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-[rgba(255,255,255,0.45)]">{description}</p>
        </div>
      </div>
      <div className="shrink-0 sm:pl-2">{control}</div>
    </motion.div>
  );
}

interface CompactToggleCardProps {
  icon: ReactNode;
  tone: "violet" | "pink" | "cyan" | "amber" | "rose" | "emerald" | "blue" | "orange";
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  ariaLabel: string;
  tight?: boolean;
  disabled?: boolean;
}

function CompactToggleCard({
  icon,
  tone,
  title,
  description,
  enabled,
  onToggle,
  ariaLabel,
  tight = false,
  disabled = false,
}: CompactToggleCardProps) {
  return (
    <motion.div
      className={tight ? accessibilityCompactCardTight : accessibilityCompactCard}
      initial={false}
    >
      <div className={accessibilityIconChip(tone)}>{icon}</div>
      <div className={cn("min-w-0 flex-1", tight ? "mt-2.5" : "mt-3")}>
        <p className="text-sm font-medium text-[rgba(255,255,255,0.92)]">{title}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[rgba(255,255,255,0.42)]">{description}</p>
      </div>
      <div className={tight ? "mt-3" : "mt-4"}>
        <AccessibilityToggle
          enabled={enabled}
          onToggle={onToggle}
          ariaLabel={ariaLabel}
          disabled={disabled}
        />
      </div>
    </motion.div>
  );
}

export function AccessibilitySettings() {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => loadAccessibilitySettings());
  const [showSavedMessage, setShowSavedMessage] = useState(false);
  const hasInitializedSettings = useRef(false);

  const updateSettings = (patch: Partial<AccessibilitySettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const toggleSetting = (key: keyof AccessibilitySettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  useEffect(() => {
    applyAccessibilitySettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!hasInitializedSettings.current) {
      hasInitializedSettings.current = true;
      return;
    }
    saveAccessibilitySettings(settings);
    setShowSavedMessage(true);
    const timer = setTimeout(() => setShowSavedMessage(false), 2000);
    return () => clearTimeout(timer);
  }, [settings]);

  const fontSizes = [
    { value: "small", label: "Small" },
    { value: "medium", label: "Medium" },
    { value: "large", label: "Large" },
    { value: "xlarge", label: "Extra Large" },
  ];

  const textSpacingOptions = [
    { value: "compact", label: "Compact" },
    { value: "normal", label: "Normal" },
    { value: "relaxed", label: "Relaxed" },
  ];

  const lineHeightOptions = [
    { value: "tight", label: "Tight" },
    { value: "normal", label: "Normal" },
    { value: "loose", label: "Loose" },
  ];

  const previewLineHeight = lineHeightToNumber(settings.lineHeight);

  const containerFontSize =
    settings.fontSize === "small"
      ? "text-sm"
      : settings.fontSize === "large"
        ? "text-lg"
        : settings.fontSize === "xlarge"
          ? "text-xl"
          : "text-base";

  const previewSerifSize =
    settings.fontSize === "small"
      ? "text-xl"
      : settings.fontSize === "large"
        ? "text-3xl"
        : settings.fontSize === "xlarge"
          ? "text-4xl"
          : "text-2xl";

  const comfortScore = useMemo(() => {
    let score = 58;
    if (settings.fontSize === "large" || settings.fontSize === "xlarge") score += 8;
    if (settings.letterSpacing === "normal" || settings.letterSpacing === "relaxed") score += 4;
    if (settings.lineHeight === "normal" || settings.lineHeight === "loose") score += 4;
    if (settings.dyslexiaFont) score += 5;
    if (settings.largeClickTargets) score += 8;
    if (settings.reducedMotion) score += 6;
    else if (settings.calmTransitions) score += 5;
    if (settings.highContrast) score += 8;
    return Math.min(95, score);
  }, [settings]);

  const comfortLabel =
    comfortScore >= 85 ? "Great Balance" : comfortScore >= 70 ? "Comfortable" : "Getting Started";

  const cycleFontSmaller = () => {
    const order = ["xlarge", "large", "medium", "small"] as const;
    const idx = order.indexOf(settings.fontSize as (typeof order)[number]);
    const next = order[Math.min(order.length - 1, idx + 1)] ?? "small";
    updateSettings({ fontSize: next });
  };

  const cycleFontLarger = () => {
    const order = ["small", "medium", "large", "xlarge"] as const;
    const idx = order.indexOf(settings.fontSize as (typeof order)[number]);
    const next = order[Math.min(order.length - 1, idx + 1)] ?? "xlarge";
    updateSettings({ fontSize: next });
  };

  return (
    <motion.div
      className={cn(accessibilityPageAtmosphere, containerFontSize)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <div className={accessibilityPageGlowTop} aria-hidden />
      <motion.div className={accessibilityPageFogMid} aria-hidden />
      <div className={accessibilityPageLanternGlow} aria-hidden />
      <motion.div className={accessibilityPageVignette} aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-8 sm:py-9">
        <motion.div
          className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Main column */}
          <div className="min-w-0 space-y-6">
            {/* Hero */}
            <section className={accessibilityHeroCard}>
              <img
                src={ACCESSIBILITY_HERO_IMG}
                alt=""
                className={accessibilityHeroImage}
                width={1600}
                height={900}
                loading="eager"
                decoding="async"
              />
              <div className={accessibilityHeroLightScrim} aria-hidden />
              <div className={accessibilityHeroOverlayReadability} aria-hidden />
              <div className={accessibilityHeroOverlayAccent} aria-hidden />
              <div className={accessibilityHeroOverlayBottom} aria-hidden />

              <div className={accessibilityHeroInner}>
                <Link to="/app/settings" className={accessibilityBackLink}>
                  <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                  Back to Settings
                </Link>

                <div className="flex max-w-2xl items-start gap-4 sm:items-center sm:gap-5">
                  <div className={accessibilityHeroIconCapsule}>
                    <Accessibility className="h-8 w-8 sm:h-9 sm:w-9" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 pb-0.5">
                    <h1 className={accessibilityHeroTitle}>Accessibility</h1>
                    <p className={accessibilityHeroAccent}>Customize for your needs</p>
                    <p className={accessibilityHeroBody}>
                      Adjust Solace to make your experience more comfortable, readable, and easy.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 1. Text & Readability */}
            <section className={accessibilityPanel}>
              <div className="flex items-start gap-3">
                <div className={accessibilityIconChip("emerald")}>
                  <BookOpen className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <h2 className={accessibilitySectionHeading}>Text &amp; Readability</h2>
                  <p className={accessibilitySectionSubtitle}>
                    Improve clarity and reduce eye strain.
                  </p>
                </div>
              </div>

              <motion.div className="mt-6 space-y-3">
                <AccessibilityPrefRow
                  icon={<span className="text-sm font-bold tracking-tight">Aa</span>}
                  tone="emerald"
                  title="Font Size"
                  description="Adjust text size across Solace"
                  control={
                    <SegmentedControl
                      options={fontSizes}
                      value={settings.fontSize}
                      onChange={(v) => updateSettings({ fontSize: v })}
                      ariaLabel="Font size"
                    />
                  }
                />
                <AccessibilityPrefRow
                  icon={<SeparatorHorizontal className="h-4 w-4" aria-hidden />}
                  tone="cyan"
                  title="Text Spacing"
                  description="Adjust space between letters and words"
                  control={
                    <SegmentedControl
                      options={textSpacingOptions}
                      value={settings.letterSpacing}
                      onChange={(v) =>
                        updateSettings({
                          letterSpacing: v as AccessibilitySettings["letterSpacing"],
                        })
                      }
                      ariaLabel="Text spacing"
                    />
                  }
                />
                <AccessibilityPrefRow
                  icon={<AlignVerticalSpaceAround className="h-4 w-4" aria-hidden />}
                  tone="blue"
                  title="Line Height"
                  description="Adjust vertical space between lines"
                  control={
                    <SegmentedControl
                      options={lineHeightOptions}
                      value={settings.lineHeight}
                      onChange={(v) =>
                        updateSettings({
                          lineHeight: v as AccessibilitySettings["lineHeight"],
                        })
                      }
                      ariaLabel="Line height"
                    />
                  }
                />
                <AccessibilityPrefRow
                  icon={<Type className="h-4 w-4" aria-hidden />}
                  tone="violet"
                  title="Dyslexia Friendly Font"
                  description="Use a dyslexia-friendly typeface"
                  control={
                    <AccessibilityToggle
                      enabled={settings.dyslexiaFont}
                      onToggle={() => toggleSetting("dyslexiaFont")}
                      ariaLabel="Dyslexia friendly font"
                    />
                  }
                />
              </motion.div>
            </section>

            {/* 2. Motion Comfort */}
            <section className={accessibilityPanel}>
              <div className="flex items-start gap-3">
                <div className={accessibilityIconChip("violet")}>
                  <Waves className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <h2 className={accessibilitySectionHeading}>Motion Comfort</h2>
                  <p className={accessibilitySectionSubtitle}>
                    Reduce motion and create a calmer experience.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <CompactToggleCard
                  icon={<PlayCircle className="h-4 w-4" aria-hidden />}
                  tone="violet"
                  title="Reduce Motion"
                  description="Minimize animations and transitions"
                  enabled={settings.reducedMotion}
                  onToggle={() => toggleSetting("reducedMotion")}
                  ariaLabel="Reduce motion"
                />
                <CompactToggleCard
                  icon={<Sparkles className="h-4 w-4" aria-hidden />}
                  tone="emerald"
                  title="Calm Transitions"
                  description="Use softer, gentler transitions"
                  enabled={settings.calmTransitions}
                  onToggle={() => toggleSetting("calmTransitions")}
                  ariaLabel="Calm transitions"
                  disabled={settings.reducedMotion}
                />
              </div>
              {settings.reducedMotion && settings.calmTransitions && (
                <p className="mt-3 text-xs text-[rgba(255,255,255,0.42)]">
                  Calm transitions pause while reduce motion is on.
                </p>
              )}
            </section>

            {/* 3. Interaction & Assistive */}
            <section className={accessibilityPanel}>
              <div className="flex items-start gap-3">
                <div className={accessibilityIconChip("cyan")}>
                  <Hand className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <h2 className={accessibilitySectionHeading}>Interaction &amp; Assistive</h2>
                  <p className={accessibilitySectionSubtitle}>
                    Easier tapping and stronger contrast across Solace.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <AccessibilityPrefRow
                  icon={<MousePointer className="h-4 w-4" aria-hidden />}
                  tone="orange"
                  title="Large Click Targets"
                  description="Increase button and link sizes for easier tapping"
                  control={
                    <AccessibilityToggle
                      enabled={settings.largeClickTargets}
                      onToggle={() => toggleSetting("largeClickTargets")}
                      ariaLabel="Large click targets"
                    />
                  }
                />
                <AccessibilityPrefRow
                  icon={<Contrast className="h-4 w-4" aria-hidden />}
                  tone="amber"
                  title="High Contrast Mode"
                  description="Increase contrast for better visibility"
                  control={
                    <AccessibilityToggle
                      enabled={settings.highContrast}
                      onToggle={() => toggleSetting("highContrast")}
                      ariaLabel="High contrast mode"
                    />
                  }
                />
              </div>
            </section>

            {/* WCAG banner */}
            <section className={accessibilityWcagBanner}>
              <div className="flex min-w-0 items-start gap-4">
                <div className={cn(accessibilityIconChip("emerald"), "h-12 w-12 shrink-0")}>
                  <Shield className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-white">WCAG 2.1 AA Compliant</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[rgba(255,255,255,0.55)]">
                    Solace follows Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards.
                    We&apos;re committed to making mental health support accessible to everyone.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => window.open("https://www.w3.org/TR/WCAG21/", "_blank")}
                className={cn(accessibilityBtnGhost, "shrink-0 gap-2 normal-case tracking-normal sm:min-w-[240px]")}
              >
                Learn more about our accessibility commitment
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </button>
            </section>
          </div>

          {/* Right rail */}
          <aside className="w-full shrink-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
            {/* Readability Preview */}
            <div className={accessibilityRailCard}>
              <p className={accessibilitySectionLabel}>Readability</p>
              <h2 className="mt-2 text-sm font-semibold text-white">Readability Preview</h2>
              <p className="mt-1 text-xs text-[rgba(255,255,255,0.45)]">
                See how text looks with your current settings.
              </p>

              <div
                className={cn(
                  accessibilityMiniPreviewCard,
                  "mt-4 p-5",
                  settings.dyslexiaFont && "dyslexia-font",
                  settings.highContrast && "border-white/40"
                )}
                style={{
                  lineHeight: previewLineHeight,
                  letterSpacing: letterSpacingToCss(settings.letterSpacing),
                  wordSpacing: wordSpacingToCss(settings.letterSpacing),
                }}
              >
                <p className={cn("font-serif text-white", previewSerifSize)}>
                  This is your preview text
                </p>
                <p className="mt-3 text-sm text-[rgba(255,255,255,0.55)]">
                  Solace is here to support you on your journey to healing and growth.
                </p>
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={cycleFontSmaller}
                    className={cn(accessibilityBtnGhost, "a11y-btn-ghost")}
                    aria-label="Smaller preview text"
                  >
                    Aa Smaller
                  </button>
                  <button
                    type="button"
                    onClick={cycleFontLarger}
                    className={cn(
                      accessibilityBtnGhost,
                      "a11y-btn-ghost",
                      (settings.fontSize === "large" || settings.fontSize === "xlarge") &&
                        "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                    )}
                    aria-label="Larger preview text"
                  >
                    Aa Larger
                  </button>
                </div>
              </div>
            </div>

            {/* Comfort Score */}
            <motion.div className={accessibilityRailCard}>
              <p className={accessibilitySectionLabel}>Comfort</p>
              <h2 className="mt-2 text-sm font-semibold text-white">Comfort Score</h2>
              <p className="mt-1 text-xs text-[rgba(255,255,255,0.45)]">
                Your current accessibility score
              </p>

              <div className="mt-5 flex flex-col items-center">
                <div className="relative flex h-28 w-28 items-center justify-center">
                  <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100" aria-hidden>
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth="8"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="url(#comfortRing)"
                      strokeWidth="8"
                      strokeDasharray={`${comfortScore * 2.64} 264`}
                      strokeLinecap="round"
                      className="drop-shadow-[0_0_12px_rgba(52,211,153,0.45)]"
                    />
                    <defs>
                      <linearGradient id="comfortRing" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#14b8a6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute text-center">
                    <p className="text-2xl font-bold text-white">{comfortScore}%</p>
                    <p className="text-[11px] font-medium text-emerald-300/90">{comfortLabel}</p>
                  </div>
                </div>
                <p className="mt-4 text-center text-xs leading-relaxed text-[rgba(255,255,255,0.48)]">
                  Your settings are helping create a comfortable and accessible experience.
                </p>
              </div>
            </motion.div>

            {/* Need Help? */}
            <div className={accessibilityRailCard}>
              <h2 className="text-sm font-semibold text-white">Need Help?</h2>
              <p className="mt-1 text-xs text-[rgba(255,255,255,0.48)]">We&apos;re here to support you.</p>
              <Link
                to="/app/settings/help-support"
                className={cn(accessibilityBtnPrimary, "mt-4 rounded-full text-sm normal-case tracking-normal")}
              >
                <HelpCircle className="h-4 w-4" aria-hidden />
                Accessibility Support
              </Link>
              <a
                href="https://www.w3.org/TR/WCAG21/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block text-center text-xs text-violet-300/70 transition-colors hover:text-violet-200"
              >
                Learn more about accessibility
              </a>
            </div>

            {/* You Matter */}
            <div className={cn(accessibilityRailCard, "relative overflow-hidden pb-8")}>
              <h2 className="font-serif text-xl font-light text-white">You Matter</h2>
              <p className="mt-2 max-w-[220px] text-sm leading-relaxed text-[rgba(255,255,255,0.68)]">
                Small adjustments can make a big difference.
              </p>
              <div
                className="pointer-events-none absolute -bottom-6 -right-4 h-36 w-36"
                aria-hidden
              >
                <img
                  src={ACCESSIBILITY_HEART_IMG}
                  alt=""
                  className="h-full w-full object-cover object-center brightness-75 saturate-125"
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(168,85,247,0.42)_0%,transparent_68%)]" />
                <Heart className="absolute top-8 left-8 h-10 w-10 text-fuchsia-300/90 drop-shadow-[0_0_24px_rgba(236,72,153,0.65)]" />
              </div>
            </div>
          </aside>
        </motion.div>

        {showSavedMessage && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed right-6 top-6 z-50 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-100 shadow-[0_0_24px_-8px_rgba(52,211,153,0.45)] backdrop-blur-md"
            role="status"
          >
            Accessibility settings saved
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
