import { motion } from "motion/react";
import {
  Sun,
  Moon,
  ArrowLeft,
  Check,
  Feather,
  Headphones,
  Moon as MoonIcon,
  Save,
  RotateCcw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback, type CSSProperties } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  APPEARANCE_HERO_IMG,
  appearanceThemeClasses,
  appearancePageFogMid,
  appearancePageGlowTop,
  appearancePageVignette,
  appearanceHeroCard,
  appearanceHeroImage,
  appearanceHeroInner,
  appearanceHeroLightScrim,
  appearanceHeroOverlayAccent,
  appearanceHeroOverlayBottom,
  appearanceHeroOverlayReadability,
  appearanceIconChip,
} from "@/app/pages/app/appearance-settings/appearanceSettingsUi";
import {
  ACCENT_ORB_GRADIENT,
  APPEARANCE_SETTINGS_VERSION,
  applyAppearanceToDocument,
  dispatchAppearanceChange,
  getAppearanceStorageKey,
  getBackdropTokensForStyle,
  getDefaultAppearanceSettings,
  readAppearanceFromStorage,
  resetAppearanceToDefaults,
  saveAppearanceToStorage,
  type AccentColorKey,
  type AppearanceSettingsSnapshot,
} from "@/app/pages/app/appearance-settings/appearanceConstants";

function SelectedCheck() {
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="appearance-selected-check absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full"
      aria-hidden
    >
      <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
    </motion.span>
  );
}

function settingsEqual(a: AppearanceSettingsSnapshot, b: AppearanceSettingsSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function AppearanceSettings() {
  const { user, profile } = useAuth();

  const storageKey = useMemo(() => getAppearanceStorageKey(user?.id), [user?.id]);

  const [savedSettings, setSavedSettings] = useState<AppearanceSettingsSnapshot>(() =>
    getDefaultAppearanceSettings()
  );
  const [draftSettings, setDraftSettings] = useState<AppearanceSettingsSnapshot>(() =>
    getDefaultAppearanceSettings()
  );
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = !settingsEqual(draftSettings, savedSettings);

  const loadFromStorage = useCallback(() => {
    const loaded = readAppearanceFromStorage(user?.id);
    setSavedSettings(loaded);
    setDraftSettings(loaded);
    applyAppearanceToDocument(loaded);
  }, [user?.id]);

  useEffect(() => {
    loadFromStorage();
  }, [storageKey, loadFromStorage]);

  useEffect(() => {
    applyAppearanceToDocument(draftSettings);
  }, [draftSettings]);

  useEffect(() => {
    return () => {
      const persisted = readAppearanceFromStorage(user?.id);
      applyAppearanceToDocument(persisted);
    };
  }, [user?.id]);

  const updateDraft = <K extends keyof AppearanceSettingsSnapshot>(
    key: K,
    value: AppearanceSettingsSnapshot[K]
  ) => {
    setDraftSettings((prev) => ({
      ...prev,
      [key]: value,
      appearanceVersion: APPEARANCE_SETTINGS_VERSION,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const next = {
        ...draftSettings,
        appearanceVersion: APPEARANCE_SETTINGS_VERSION,
      };
      saveAppearanceToStorage(next, user?.id);
      setSavedSettings(next);
      applyAppearanceToDocument(next);
      dispatchAppearanceChange(next);
      toast.success("Appearance saved");
    } catch {
      toast.error("Could not save appearance settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setDraftSettings(savedSettings);
    applyAppearanceToDocument(savedSettings);
    toast.message("Changes discarded");
  };

  const handleResetDefaults = () => {
    const defaults = resetAppearanceToDefaults(user?.id);
    setSavedSettings(defaults);
    setDraftSettings(defaults);
    toast.success("Restored Solace default appearance");
  };

  const displayName =
    (typeof profile?.full_name === "string" && profile.full_name.trim()) ||
    user?.email?.split("@")[0] ||
    "Member";

  const themes = [
    {
      value: "dark" as const,
      label: "Dark",
      description:
        "Your current Solace look — cinematic glass and moonlit calm (no extra darkening)",
      icon: Moon,
      tone: "violet" as const,
    },
    {
      value: "light" as const,
      label: "Light",
      description: "A brighter, open theme with lighter surfaces across the app",
      icon: Sun,
      tone: "amber" as const,
    },
  ];

  const accentColors: Array<{ value: AccentColorKey; label: string }> = [
    { value: "pink", label: "Rose Pink" },
    { value: "purple", label: "Lavender" },
    { value: "blue", label: "Ocean Blue" },
    { value: "teal", label: "Teal" },
    { value: "green", label: "Forest Green" },
    { value: "orange", label: "Sunset Orange" },
  ];

  const backgroundStyles: Array<{
    value: "solid" | "gradient" | "pattern";
    label: string;
    dots: string[];
  }> = [
    {
      value: "solid",
      label: "Solid Color",
      dots: ["bg-slate-600", "bg-slate-500", "bg-slate-700", "bg-slate-400"],
    },
    {
      value: "gradient",
      label: "Gradient",
      dots: ["bg-violet-500", "bg-fuchsia-500", "bg-indigo-600", "bg-purple-400"],
    },
    {
      value: "pattern",
      label: "Pattern",
      dots: ["bg-slate-500/80", "bg-slate-400/70", "bg-slate-600/80", "bg-slate-400/50"],
    },
  ];

  const dense = draftSettings.compactMode;
  const tc = appearanceThemeClasses();

  const getBackgroundPreviewStyle = useCallback(
    (style: "solid" | "gradient" | "pattern"): CSSProperties => {
      const tokens = getBackdropTokensForStyle(style, draftSettings.theme);
      return {
        backgroundColor: tokens.color,
        backgroundImage: tokens.image === "none" ? undefined : tokens.image,
        backgroundSize: tokens.size,
        backgroundPosition: tokens.position,
        backgroundRepeat: tokens.repeat,
      };
    },
    [draftSettings.theme]
  );

  return (
    <motion.div
      className={tc.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <div className={appearancePageGlowTop} aria-hidden />
      <motion.div className={appearancePageFogMid} aria-hidden />
      <div className={appearancePageVignette} aria-hidden />

      <div
        className={cn(
          "relative z-10 mx-auto w-full max-w-[1500px] px-4 sm:px-7",
          dense ? "py-5" : "py-7 sm:py-9",
          isDirty ? "pb-28" : ""
        )}
      >
        <motion.div
          className="mx-auto min-w-0 max-w-[1100px] space-y-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Hero */}
          <section className={appearanceHeroCard}>
            <img
              src={APPEARANCE_HERO_IMG}
              alt=""
              className={appearanceHeroImage}
              width={1600}
              height={900}
              loading="eager"
              decoding="async"
            />
            <div className={appearanceHeroLightScrim} aria-hidden />
            <div className={appearanceHeroOverlayReadability} aria-hidden />
            <div className={appearanceHeroOverlayAccent} aria-hidden />
            <div className={appearanceHeroOverlayBottom} aria-hidden />

            <div className={appearanceHeroInner}>
              <Link to="/app/settings" className={tc.backLink}>
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                Back to Settings
              </Link>

              <div className="mt-4 max-w-xl">
                <h1 className={tc.heroTitle}>
                  <span className={tc.heroAccent}>Appearance</span>
                </h1>
                <p className={tc.heroLead}>Customize your visual experience</p>
                <p className={tc.heroBody}>
                  Shape your space to match your mood and create the perfect environment for your
                  healing and growth.
                </p>
              </div>
            </div>
          </section>

          {/* Theme mode */}
          <section className={tc.panel}>
            <p className={tc.sectionLabel}>Theme mode</p>
            <h2 className={cn(tc.sectionHeading, "mt-2")}>
              Choose the mood that feels right for you
            </h2>
            <p className={tc.sectionSubtitle}>
              Dark keeps your sanctuary as it is today. Light switches to a brighter palette.
            </p>

            <div
              className={cn(
                "mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2",
                dense ? "gap-2" : "gap-3"
              )}
            >
              {themes.map((theme) => {
                const Icon = theme.icon;
                const selected = draftSettings.theme === theme.value;
                return (
                  <motion.button
                    key={theme.value}
                    type="button"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => updateDraft("theme", theme.value)}
                    className={cn(tc.optionCard, selected && tc.optionCardSelected)}
                    aria-pressed={selected}
                  >
                    {selected && <SelectedCheck />}
                    <div className={appearanceIconChip(theme.tone)}>
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0 text-left">
                      <p className={tc.optionTitle}>{theme.label}</p>
                      <p className={tc.optionDesc}>{theme.description}</p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </section>

          {/* Accent color */}
          <section className={tc.panel}>
            <p className={tc.sectionLabel}>Accent color</p>
            <h2 className={cn(tc.sectionHeading, "mt-2")}>Personalize your sanctuary</h2>
            <p className={tc.sectionSubtitle}>
              Personalize Solace with a color that feels like you. Accent applies to buttons,
              sidebars, scrollbars, and glows — not your page background.
            </p>

            <div className="mt-6 flex gap-4 overflow-x-auto pb-2 sm:flex-wrap sm:justify-start sm:gap-5 sm:overflow-visible">
              {accentColors.map((color) => {
                const selected = draftSettings.accentColor === color.value;
                const [from, to] = ACCENT_ORB_GRADIENT[color.value];
                return (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => updateDraft("accentColor", color.value)}
                    className={cn(
                      "group flex shrink-0 flex-col items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/50 focus-visible:ring-offset-2",
                      tc.accentRingOffset
                    )}
                    aria-pressed={selected}
                    aria-label={`${color.label}${selected ? ", selected" : ""}`}
                  >
                    <span
                      className={cn(
                        "appearance-accent-orb hc-preserve-color relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                        selected
                          ? cn("appearance-accent-swatch--selected", tc.accentRingOffset)
                          : "ring-1 ring-[color:var(--solace-border)]",
                        "transition-shadow duration-300 group-hover:shadow-[0_0_20px_-6px_color-mix(in_srgb,var(--accent)_45%,transparent)]"
                      )}
                      style={
                        {
                          "--appearance-orb-from": from,
                          "--appearance-orb-to": to,
                        } as CSSProperties
                      }
                    >
                      {selected && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/95 shadow-md">
                          <Check
                            className="h-3 w-3 text-[color:var(--accent)]"
                            strokeWidth={3}
                            aria-hidden
                          />
                        </span>
                      )}
                    </span>
                    <span className={tc.accentLabel(selected)}>{color.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Background style */}
          <section className={tc.panel}>
            <p className={tc.sectionLabel}>Background style</p>
            <h2 className={cn(tc.sectionHeading, "mt-2")}>Set your visual backdrop</h2>
            <p className={tc.sectionSubtitle}>
              Set the visual background for your experience.
            </p>

            <div
              className={cn(
                "mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3",
                dense ? "gap-2" : "gap-3"
              )}
            >
              {backgroundStyles.map((style) => {
                const selected = draftSettings.backgroundStyle === style.value;
                return (
                  <motion.button
                    key={style.value}
                    type="button"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => updateDraft("backgroundStyle", style.value)}
                    className={cn(tc.bgStyleCard, selected && tc.optionCardSelected)}
                    aria-pressed={selected}
                  >
                    {selected && <SelectedCheck />}
                    <div
                      className={cn(
                        "hc-preserve-color mb-3 h-16 w-full rounded-xl border",
                        draftSettings.theme === "light"
                          ? "border-slate-200/80"
                          : "border-white/[0.08]"
                      )}
                      style={getBackgroundPreviewStyle(style.value)}
                    />
                    <p className={tc.bgStyleLabel}>{style.label}</p>
                    <div className="mt-3 flex justify-center gap-1.5">
                      {style.dots.map((dot, i) => (
                        <span
                          key={`${style.value}-dot-${i}`}
                          className={cn("h-2 w-2 rounded-full", dot)}
                          aria-hidden
                        />
                      ))}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </section>

          {/* Live preview strip */}
          <section className={tc.panel}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className={tc.sectionLabel}>Live preview</p>
                <h2 className={cn(tc.sectionHeading, "mt-2")}>See your changes</h2>
                <p className={tc.sectionSubtitle}>See how your changes look across Solace.</p>
              </div>
              <button type="button" onClick={handleResetDefaults} className={tc.btnGhost}>
                Reset to default
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <div className={tc.miniPreviewCard}>
                <div className="relative h-12 overflow-hidden">
                  <img
                    src={APPEARANCE_HERO_IMG}
                    alt=""
                    className="h-full w-full object-cover object-center brightness-[0.55]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0b18] to-transparent" />
                  <MoonIcon
                    className="absolute right-2 top-2 h-3 w-3 text-amber-200/80"
                    aria-hidden
                  />
                </div>
                <div className="p-2.5">
                  <p className="text-[10px] font-semibold text-white">
                    Good evening, {displayName.split(" ")[0]}
                  </p>
                </div>
              </div>

              <div className={tc.miniPreviewCard}>
                <div className="p-2.5">
                  <p className="text-[10px] font-semibold text-white">Today&apos;s Check-in</p>
                  <div className="mt-2 flex justify-between gap-0.5">
                    {["😊", "🙂", "😐", "😔", "😢"].map((emoji) => (
                      <span
                        key={emoji}
                        className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.06] text-[10px]"
                        aria-hidden
                      >
                        {emoji}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <motion.div className={tc.miniPreviewCard}>
                <div className="flex flex-1 flex-col items-center justify-center p-3 text-center">
                  <Feather className="mb-1.5 h-4 w-4 text-[color:var(--accent)]/80" aria-hidden />
                  <p className="text-[10px] font-semibold text-white">Journal</p>
                  <p className="mt-1 text-[9px] text-[rgba(255,255,255,0.42)]">
                    Your thoughts matter.
                  </p>
                </div>
              </motion.div>

              <motion.div className={tc.miniPreviewCard}>
                <motion.div className="flex flex-1 flex-col items-center justify-center p-3 text-center">
                  <Headphones className="mb-1.5 h-4 w-4 text-[color:var(--accent)]/80" aria-hidden />
                  <p className="text-[10px] font-semibold text-white">Support</p>
                  <p className="mt-1 text-[9px] text-[rgba(255,255,255,0.42)]">
                    We&apos;re here for you 24/7
                  </p>
                </motion.div>
              </motion.div>

              <motion.div className={tc.miniPreviewCard}>
                <div className="p-2.5">
                  <p className="text-[10px] font-semibold text-white">Sleep Tracker</p>
                  <div className="mt-2 flex h-8 items-end justify-center gap-0.5">
                    {[40, 65, 55, 80, 70, 90, 75].map((h, i) => (
                      <span
                        key={`sleep-bar-${i}`}
                        className="w-1.5 rounded-t-sm bg-[color:var(--accent)]/70"
                        style={{ height: `${h}%` }}
                        aria-hidden
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-center text-[9px] font-semibold text-[color:var(--accent)]/90">
                    7h 32m
                  </p>
                </div>
              </motion.div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="button" className={cn("solace-btn-primary rounded-2xl px-6 py-2.5")}>
                Sample button
              </button>
              <div className="solace-scroll h-16 max-w-[200px] overflow-y-auto rounded-xl border border-[color:var(--solace-border)] bg-[var(--solace-ds-surface)] p-3 text-xs text-[var(--solace-muted)]">
                <p>Scrollbar preview</p>
                <p className="mt-8">Scroll to see accent thumb</p>
                <p className="mt-8">More content</p>
              </div>
            </div>
          </section>
        </motion.div>

        {isDirty && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed inset-x-0 bottom-0 z-50 border-t border-[color:var(--solace-border)] bg-[color-mix(in_oklab,var(--solace-bg-elevated)_94%,transparent)] px-4 py-4 backdrop-blur-xl sm:px-7"
            role="region"
            aria-label="Save appearance changes"
          >
            <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--solace-muted)]">You have unsaved appearance changes</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={isSaving}
                  className={cn(tc.btnGhost, "inline-flex items-center gap-2")}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className={cn(
                    "solace-btn-primary min-h-[44px] rounded-2xl px-6 py-2.5",
                    "disabled:opacity-60"
                  )}
                >
                  <Save className="h-4 w-4" aria-hidden />
                  {isSaving ? "Saving…" : "Save appearance"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
