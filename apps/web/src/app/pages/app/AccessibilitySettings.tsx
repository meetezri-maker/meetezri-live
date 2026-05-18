import { motion } from "motion/react";
import {
  Accessibility,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  Contrast,
  ExternalLink,
  Focus,
  Hand,
  Heart,
  Keyboard,
  Link2,
  Mic,
  MousePointer,
  PlayCircle,
  Shield,
  Sparkles,
  Subtitles,
  Type,
  Volume2,
  Waves,
  AlignVerticalSpaceAround,
  SeparatorHorizontal,
  HelpCircle,
  Home,
  MessageCircle,
  BarChart3,
  Settings,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { cn } from "@/lib/utils";
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
  accessibilityHeroOverlayEmerald,
  accessibilityHeroOverlayLeft,
  accessibilityHeroOverlayPurpleNight,
  accessibilityHeroOverlayPurpleSky,
  accessibilityHeroOverlayReflection,
  accessibilityHeroOverlayTitleHaze,
  accessibilityHeroOverlayVignette,
  accessibilityHeroOverlayWarmth,
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

type AccessibilitySettingsState = {
  fontSize: string;
  textSpacing: string;
  highContrast: boolean;
  reducedMotion: boolean;
  screenReader: boolean;
  closedCaptions: boolean;
  keyboardNav: boolean;
  focusIndicators: boolean;
  autoPlay: boolean;
  largeClickTargets: boolean;
};

interface AccessibilityToggleProps {
  enabled: boolean;
  onToggle: () => void;
  ariaLabel: string;
}

function AccessibilityToggle({ enabled, onToggle, ariaLabel }: AccessibilityToggleProps) {
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      whileTap={{ scale: 0.95 }}
      onClick={onToggle}
      className={cn(
        "relative h-8 w-14 shrink-0 rounded-full transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/45",
        enabled
          ? "bg-gradient-to-r from-emerald-500/75 to-teal-500/75 shadow-[0_0_20px_-4px_rgba(52,211,153,0.55)]"
          : "bg-white/10"
      )}
    >
      <motion.span
        animate={{ x: enabled ? 26 : 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className="absolute top-1 left-0 h-6 w-6 rounded-full bg-white shadow-md"
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
    <motion.div className={accessibilitySegmentTrack} role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <motion.button
            key={opt.value}
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => onChange(opt.value)}
            className={accessibilitySegmentOption(selected)}
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

interface AccessibilitySliderProps {
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}

function AccessibilitySlider({ value, onChange, ariaLabel }: AccessibilitySliderProps) {
  return (
    <input
      type="range"
      min={0}
      max={100}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={ariaLabel}
      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/[0.08] accent-emerald-400 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(52,211,153,0.65)]"
      style={{
        background: `linear-gradient(to right, rgba(52,211,153,0.65) 0%, rgba(52,211,153,0.65) ${value}%, rgba(255,255,255,0.08) ${value}%, rgba(255,255,255,0.08) 100%)`,
      }}
    />
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
        <AccessibilityToggle enabled={enabled} onToggle={onToggle} ariaLabel={ariaLabel} />
      </div>
    </motion.div>
  );
}

export function AccessibilitySettings() {
  const { user, profile } = useAuth();

  const getDefaultSettings = (): AccessibilitySettingsState => ({
    fontSize: "medium",
    textSpacing: "normal",
    highContrast: false,
    reducedMotion: false,
    screenReader: false,
    closedCaptions: true,
    keyboardNav: true,
    focusIndicators: true,
    autoPlay: false,
    largeClickTargets: false,
  });

  const [settings, setSettings] = useState<AccessibilitySettingsState>(() => {
    const isBrowser =
      typeof window !== "undefined" && typeof window.localStorage !== "undefined";
    const saved = isBrowser
      ? window.localStorage.getItem("ezri_accessibility_settings")
      : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<AccessibilitySettingsState>;
        return {
          ...getDefaultSettings(),
          ...parsed,
        };
      } catch {
        return getDefaultSettings();
      }
    }
    return getDefaultSettings();
  });

  const [showSavedMessage, setShowSavedMessage] = useState(false);
  const hasInitializedSettings = useRef(false);

  const [ambientEffects, setAmbientEffects] = useState(28);
  const [breathingAnimation, setBreathingAnimation] = useState(42);
  const [dyslexiaFont, setDyslexiaFont] = useState(false);
  const [readingWidth, setReadingWidth] = useState("medium");
  const [calmTransitions, setCalmTransitions] = useState(true);
  const [voiceNavigation, setVoiceNavigation] = useState(false);
  const [guidedMode, setGuidedMode] = useState(false);
  const [colorFilter, setColorFilter] = useState("off");
  const [descriptiveLabels, setDescriptiveLabels] = useState(true);

  const toggleSetting = (key: keyof AccessibilitySettingsState) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
    if (!hasInitializedSettings.current) {
      hasInitializedSettings.current = true;
      return;
    }
    window.localStorage.setItem("ezri_accessibility_settings", JSON.stringify(settings));
    setShowSavedMessage(true);
    const timer = setTimeout(() => {
      setShowSavedMessage(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [settings]);

  useEffect(() => {
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
  }, [settings.fontSize]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const textSpacingMap: Record<string, { lineHeight: string; letterSpacing: string }> = {
      compact: { lineHeight: "1.35", letterSpacing: "-0.005em" },
      normal: { lineHeight: "1.5", letterSpacing: "0em" },
      relaxed: { lineHeight: "1.7", letterSpacing: "0.01em" },
      loose: { lineHeight: "1.9", letterSpacing: "0.015em" },
    };
    const spacing = textSpacingMap[settings.textSpacing] || textSpacingMap.normal;
    root.style.setProperty("--text-line-height", spacing.lineHeight);
    root.style.setProperty("--text-letter-spacing", spacing.letterSpacing);
  }, [settings.textSpacing]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (settings.highContrast) {
      root.classList.add("high-contrast");
    } else {
      root.classList.remove("high-contrast");
    }
  }, [settings.highContrast]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (settings.reducedMotion) {
      root.classList.add("reduced-motion");
    } else {
      root.classList.remove("reduced-motion");
    }
  }, [settings.reducedMotion]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (settings.focusIndicators) {
      root.classList.add("focus-indicators");
    } else {
      root.classList.remove("focus-indicators");
    }
  }, [settings.focusIndicators]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (settings.largeClickTargets) {
      root.classList.add("large-click-targets");
    } else {
      root.classList.remove("large-click-targets");
    }
  }, [settings.largeClickTargets]);

  const displayName =
    (typeof profile?.full_name === "string" && profile.full_name.trim()) ||
    user?.email?.split("@")[0] ||
    "Member";

  const firstName = displayName.split(" ")[0];

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

  const lineHeightValue =
    settings.textSpacing === "compact"
      ? "tight"
      : settings.textSpacing === "relaxed" || settings.textSpacing === "loose"
        ? "loose"
        : "normal";

  const lineHeightOptions = [
    { value: "tight", label: "Tight" },
    { value: "normal", label: "Normal" },
    { value: "loose", label: "Loose" },
  ];

  const readingWidthOptions = [
    { value: "narrow", label: "Narrow" },
    { value: "medium", label: "Medium" },
    { value: "wide", label: "Wide" },
  ];

  const handleLineHeightChange = (value: string) => {
    const map: Record<string, string> = {
      tight: "compact",
      normal: "normal",
      loose: "relaxed",
    };
    setSettings((prev) => ({ ...prev, textSpacing: map[value] || "normal" }));
  };

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
    let score = 62;
    if (settings.fontSize === "large" || settings.fontSize === "xlarge") score += 6;
    if (settings.textSpacing === "normal" || settings.textSpacing === "relaxed") score += 4;
    if (settings.keyboardNav) score += 5;
    if (settings.screenReader) score += 4;
    if (settings.focusIndicators) score += 5;
    if (settings.largeClickTargets) score += 4;
    if (settings.closedCaptions) score += 3;
    if (!settings.reducedMotion && calmTransitions) score += 4;
    if (!settings.highContrast) score += 2;
    if (settings.closedCaptions) score += 3;
    if (descriptiveLabels) score += 3;
    return Math.min(95, score);
  }, [settings, calmTransitions, descriptiveLabels]);

  const comfortLabel =
    comfortScore >= 85 ? "Great Balance" : comfortScore >= 70 ? "Comfortable" : "Getting Started";

  const cycleFontSmaller = () => {
    const order = ["xlarge", "large", "medium", "small"] as const;
    const idx = order.indexOf(settings.fontSize as (typeof order)[number]);
    const next = order[Math.min(order.length - 1, idx + 1)] ?? "small";
    setSettings((prev) => ({ ...prev, fontSize: next }));
  };

  const cycleFontLarger = () => {
    const order = ["small", "medium", "large", "xlarge"] as const;
    const idx = order.indexOf(settings.fontSize as (typeof order)[number]);
    const next = order[Math.min(order.length - 1, idx + 1)] ?? "xlarge";
    setSettings((prev) => ({ ...prev, fontSize: next }));
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
              <img src={ACCESSIBILITY_HERO_IMG} alt="" className={accessibilityHeroImage} />
              <motion.div className={accessibilityHeroOverlayLeft} aria-hidden />
              <div className={accessibilityHeroOverlayPurpleSky} aria-hidden />
              <div className={accessibilityHeroOverlayPurpleNight} aria-hidden />
              <div className={accessibilityHeroOverlayEmerald} aria-hidden />
              <div className={accessibilityHeroOverlayTitleHaze} aria-hidden />
              <div className={accessibilityHeroOverlayWarmth} aria-hidden />
              <div className={accessibilityHeroOverlayReflection} aria-hidden />
              <div className={accessibilityHeroOverlayVignette} aria-hidden />

              <div className="relative z-10 flex min-h-[232px] flex-col justify-between p-6 sm:min-h-[248px] sm:p-7 lg:min-h-[256px] lg:p-8">
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
                  <h2 className={accessibilitySectionHeading}>1. Text &amp; Readability</h2>
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
                      onChange={(v) => setSettings((prev) => ({ ...prev, fontSize: v }))}
                      ariaLabel="Font size"
                    />
                  }
                />
                <AccessibilityPrefRow
                  icon={<SeparatorHorizontal className="h-4 w-4" aria-hidden />}
                  tone="cyan"
                  title="Text Spacing"
                  description="Adjust spacing between text"
                  control={
                    <SegmentedControl
                      options={textSpacingOptions}
                      value={
                        settings.textSpacing === "loose" ? "relaxed" : settings.textSpacing
                      }
                      onChange={(v) => setSettings((prev) => ({ ...prev, textSpacing: v }))}
                      ariaLabel="Text spacing"
                    />
                  }
                />
                <AccessibilityPrefRow
                  icon={<AlignVerticalSpaceAround className="h-4 w-4" aria-hidden />}
                  tone="blue"
                  title="Line Height"
                  description="Adjust line height for easier reading"
                  control={
                    <SegmentedControl
                      options={lineHeightOptions}
                      value={lineHeightValue}
                      onChange={handleLineHeightChange}
                      ariaLabel="Line height"
                    />
                  }
                />
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <AccessibilityPrefRow
                    icon={<Type className="h-4 w-4" aria-hidden />}
                    tone="violet"
                    title="Dyslexia Friendly Font"
                    description="Use a dyslexia-friendly typeface"
                    control={
                      <AccessibilityToggle
                        enabled={dyslexiaFont}
                        onToggle={() => setDyslexiaFont((v) => !v)}
                        ariaLabel="Dyslexia friendly font"
                      />
                    }
                  />
                  <AccessibilityPrefRow
                    icon={<BookOpen className="h-4 w-4" aria-hidden />}
                    tone="amber"
                    title="Reading Width"
                    description="Optimize reading width"
                    control={
                      <SegmentedControl
                        options={readingWidthOptions}
                        value={readingWidth}
                        onChange={setReadingWidth}
                        ariaLabel="Reading width"
                      />
                    }
                  />
                </div>
              </motion.div>
            </section>

            {/* 2. Motion Comfort */}
            <section className={accessibilityPanel}>
              <div className="flex items-start gap-3">
                <div className={accessibilityIconChip("violet")}>
                  <Waves className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <h2 className={accessibilitySectionHeading}>2. Motion Comfort</h2>
                  <p className={accessibilitySectionSubtitle}>
                    Reduce motion and create a calmer experience.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                  enabled={calmTransitions}
                  onToggle={() => setCalmTransitions((v) => !v)}
                  ariaLabel="Calm transitions"
                />
                <motion.div className={accessibilityCompactCard}>
                  <div className={accessibilityIconChip("cyan")}>
                    <Waves className="h-4 w-4" aria-hidden />
                  </div>
                  <p className="mt-3 text-sm font-medium text-[rgba(255,255,255,0.92)]">Ambient Effects</p>
                  <p className="mt-1 text-[11px] text-[rgba(255,255,255,0.42)]">
                    Lower intensity of ambient visuals
                  </p>
                  <div className="mt-4">
                    <AccessibilitySlider
                      value={ambientEffects}
                      onChange={setAmbientEffects}
                      ariaLabel="Ambient effects intensity"
                    />
                  </div>
                </motion.div>
                <motion.div className={accessibilityCompactCard}>
                  <div className={accessibilityIconChip("pink")}>
                    <Heart className="h-4 w-4" aria-hidden />
                  </div>
                  <p className="mt-3 text-sm font-medium text-[rgba(255,255,255,0.92)]">Breathing Animation</p>
                  <p className="mt-1 text-[11px] text-[rgba(255,255,255,0.42)]">
                    Adjust breathing animation intensity
                  </p>
                  <div className="mt-4">
                    <AccessibilitySlider
                      value={breathingAnimation}
                      onChange={setBreathingAnimation}
                      ariaLabel="Breathing animation intensity"
                    />
                  </div>
                </motion.div>
              </div>
            </section>

            {/* 3. Interaction Comfort */}
            <section className={accessibilityPanel}>
              <div className="flex items-start gap-3">
                <div className={accessibilityIconChip("cyan")}>
                  <Hand className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <h2 className={accessibilitySectionHeading}>3. Interaction Comfort</h2>
                  <p className={accessibilitySectionSubtitle}>
                    Optimize how you interact with Solace.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <CompactToggleCard
                  icon={<MousePointer className="h-4 w-4" aria-hidden />}
                  tone="orange"
                  title="Large Click Targets"
                  description="Increase button and link sizes"
                  enabled={settings.largeClickTargets}
                  onToggle={() => toggleSetting("largeClickTargets")}
                  ariaLabel="Large click targets"
                  tight
                />
                <CompactToggleCard
                  icon={<Keyboard className="h-4 w-4" aria-hidden />}
                  tone="violet"
                  title="Keyboard Navigation"
                  description="Navigate using keyboard only"
                  enabled={settings.keyboardNav}
                  onToggle={() => toggleSetting("keyboardNav")}
                  ariaLabel="Keyboard navigation"
                  tight
                />
                <CompactToggleCard
                  icon={<Volume2 className="h-4 w-4" aria-hidden />}
                  tone="cyan"
                  title="Screen Reader"
                  description="Optimize for screen readers"
                  enabled={settings.screenReader}
                  onToggle={() => toggleSetting("screenReader")}
                  ariaLabel="Screen reader"
                  tight
                />
                <CompactToggleCard
                  icon={<Mic className="h-4 w-4" aria-hidden />}
                  tone="blue"
                  title="Voice Navigation"
                  description="Use voice commands to navigate"
                  enabled={voiceNavigation}
                  onToggle={() => setVoiceNavigation((v) => !v)}
                  ariaLabel="Voice navigation"
                  tight
                />
                <CompactToggleCard
                  icon={<HelpCircle className="h-4 w-4" aria-hidden />}
                  tone="amber"
                  title="Guided Mode"
                  description="Step-by-step interaction help"
                  enabled={guidedMode}
                  onToggle={() => setGuidedMode((v) => !v)}
                  ariaLabel="Guided mode"
                  tight
                />
              </div>
            </section>

            {/* 4. Assistive Features */}
            <section className={accessibilityPanel}>
              <div className="flex items-start gap-3">
                <div className={accessibilityIconChip("rose")}>
                  <Heart className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <h2 className={accessibilitySectionHeading}>4. Assistive Features</h2>
                  <p className={accessibilitySectionSubtitle}>
                    Tools to support your unique needs.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <CompactToggleCard
                  icon={<Contrast className="h-4 w-4" aria-hidden />}
                  tone="amber"
                  title="High Contrast Mode"
                  description="Increase contrast for better visibility"
                  enabled={settings.highContrast}
                  onToggle={() => toggleSetting("highContrast")}
                  ariaLabel="High contrast mode"
                  tight
                />
                <motion.div className={accessibilityCompactCardTight}>
                  <div className={accessibilityIconChip("violet")}>
                    <Sparkles className="h-4 w-4" aria-hidden />
                  </div>
                  <p className="mt-2.5 text-sm font-medium text-[rgba(255,255,255,0.92)]">Color Filter</p>
                  <p className="mt-1 text-[11px] text-[rgba(255,255,255,0.42)]">
                    Adjust colors for better clarity
                  </p>
                  <div className="relative mt-3">
                    <select
                      value={colorFilter}
                      onChange={(e) => setColorFilter(e.target.value)}
                      aria-label="Color filter"
                      className="w-full appearance-none rounded-full border border-white/[0.1] bg-black/30 py-2 pr-9 pl-4 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/35"
                    >
                      <option value="off">Off</option>
                      <option value="protanopia">Protanopia</option>
                      <option value="deuteranopia">Deuteranopia</option>
                      <option value="tritanopia">Tritanopia</option>
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-white/40"
                      aria-hidden
                    />
                  </div>
                </motion.div>
                <CompactToggleCard
                  icon={<Focus className="h-4 w-4" aria-hidden />}
                  tone="emerald"
                  title="Focus Indicator"
                  description="Highlight focused elements more clearly"
                  enabled={settings.focusIndicators}
                  onToggle={() => toggleSetting("focusIndicators")}
                  ariaLabel="Focus indicator"
                  tight
                />
                <CompactToggleCard
                  icon={<Link2 className="h-4 w-4" aria-hidden />}
                  tone="cyan"
                  title="Highlight Links"
                  description="Underline links and buttons"
                  enabled={settings.closedCaptions}
                  onToggle={() => toggleSetting("closedCaptions")}
                  ariaLabel="Highlight links"
                  tight
                />
                <CompactToggleCard
                  icon={<Subtitles className="h-4 w-4" aria-hidden />}
                  tone="pink"
                  title="Descriptive Labels"
                  description="Show helpful labels and hints"
                  enabled={descriptiveLabels}
                  onToggle={() => setDescriptiveLabels((v) => !v)}
                  ariaLabel="Descriptive labels"
                  tight
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
            {/* Accessibility Preview */}
            <div className={accessibilityRailCard}>
              <p className={accessibilitySectionLabel}>Preview</p>
              <h2 className="mt-2 text-sm font-semibold text-white">Accessibility Preview</h2>
              <p className="mt-1 text-xs text-[rgba(255,255,255,0.45)]">
                See how your settings look in real-time.
              </p>

              <div className="relative mt-4 overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#0c0d1a] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_40px_-12px_rgba(52,211,153,0.22)]">
                <motion.div className="flex min-h-[280px]">
                  <div className="flex w-10 shrink-0 flex-col items-center gap-2 border-r border-white/[0.06] bg-[#090a14] py-3">
                    {[Home, MessageCircle, BookOpen, BarChart3].map((Icon, i) => (
                      <span
                        key={`nav-${i}`}
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-md",
                          i === 0 ? "bg-emerald-500/20 text-emerald-200" : "text-white/30"
                        )}
                      >
                        <Icon className="h-3 w-3" aria-hidden />
                      </span>
                    ))}
                  </div>
                  <div className="min-w-0 flex-1 p-2.5">
                    <div className="relative mb-2 h-14 overflow-hidden rounded-xl">
                      <img
                        src={ACCESSIBILITY_HERO_IMG}
                        alt=""
                        className="h-full w-full object-cover brightness-[0.48]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0b18]/92 to-transparent" />
                      <p className="absolute bottom-2 left-2 text-[9px] font-semibold text-white">
                        Good evening, {firstName}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-2">
                      <p className="text-[8px] font-semibold uppercase tracking-wider text-white/50">
                        Daily Progress
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                          <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36" aria-hidden>
                            <circle
                              cx="18"
                              cy="18"
                              r="14"
                              fill="none"
                              stroke="rgba(255,255,255,0.08)"
                              strokeWidth="3"
                            />
                            <circle
                              cx="18"
                              cy="18"
                              r="14"
                              fill="none"
                              stroke="url(#a11yPreviewRing)"
                              strokeWidth="3"
                              strokeDasharray={`${72 * 0.88} 88`}
                              strokeLinecap="round"
                            />
                            <defs>
                              <linearGradient id="a11yPreviewRing" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#34d399" />
                                <stop offset="100%" stopColor="#2dd4bf" />
                              </linearGradient>
                            </defs>
                          </svg>
                          <span className="absolute text-[8px] font-bold text-white">72%</span>
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <motion.div className="h-1.5 rounded-full bg-white/[0.08]" />
                          <div className="h-1.5 w-3/4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" />
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-around border-t border-white/[0.06] pt-2">
                      {[Home, MessageCircle, BookOpen, BarChart3, Settings].map((Icon, i) => (
                        <Icon
                          key={`bottom-${i}`}
                          className={cn("h-3 w-3", i === 0 ? "text-emerald-300" : "text-white/25")}
                          aria-hidden
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

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
                  settings.textSpacing === "relaxed" && "tracking-wide",
                  settings.textSpacing === "compact" && "tracking-tight"
                )}
                style={{
                  lineHeight:
                    settings.textSpacing === "compact"
                      ? 1.35
                      : settings.textSpacing === "relaxed" || settings.textSpacing === "loose"
                        ? 1.7
                        : 1.5,
                }}
              >
                <p className={cn("font-serif text-white", previewSerifSize)}>
                  This is your preview text
                </p>
                <p className="mt-3 text-sm leading-relaxed text-[rgba(255,255,255,0.55)]">
                  Solace is here to support you on your journey to healing and growth.
                </p>
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={cycleFontSmaller}
                    className={accessibilityBtnGhost}
                    aria-label="Smaller preview text"
                  >
                    Aa Smaller
                  </button>
                  <button
                    type="button"
                    onClick={cycleFontLarger}
                    className={cn(
                      accessibilityBtnGhost,
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
