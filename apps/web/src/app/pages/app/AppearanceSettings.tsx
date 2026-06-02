import { motion } from "motion/react";
import {
  Sun,
  Moon,
  ArrowLeft,
  Check,
  Feather,
  Headphones,
  Moon as MoonIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useMemo, type CSSProperties } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  APPEARANCE_HERO_IMG,
  appearanceBackLink,
  appearanceBtnGhost,
  appearanceHeroAccent,
  appearanceHeroCard,
  appearanceHeroImage,
  appearanceHeroInner,
  appearanceHeroLightScrim,
  appearanceHeroOverlayAccent,
  appearanceHeroOverlayBottom,
  appearanceHeroOverlayReadability,
  appearanceHeroTitle,
  appearanceIconChip,
  appearanceMiniPreviewCard,
  appearanceOptionCard,
  appearanceOptionCardSelected,
  appearancePageFogMid,
  appearancePageGlowTop,
  appearancePageVignette,
  appearanceThemeClasses,
} from "@/app/pages/app/appearance-settings/appearanceSettingsUi";
import {
  ACCENT_ORB_GRADIENT,
  APPEARANCE_SETTINGS_VERSION,
  applyAccentColorToDocument,
  applyThemeToDocument,
  isAccentColorKey,
  resolveAppearanceTheme,
  type AccentColorKey,
  type AppearanceTheme,
} from "@/app/pages/app/appearance-settings/appearanceConstants";

type AppearanceSettingsState = {
  theme: AppearanceTheme;
  accentColor: AccentColorKey;
  backgroundStyle: "solid" | "gradient" | "pattern";
  animations: boolean;
  compactMode: boolean;
  showAvatars: boolean;
  appearanceVersion?: number;
};

function SelectedCheck() {
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-[0_0_16px_-2px_rgba(192,132,252,0.65)]"
      aria-hidden
    >
      <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
    </motion.span>
  );
}

export function AppearanceSettings() {
  const { user, profile } = useAuth();

  const storageKey = useMemo(() => {
    if (typeof window === "undefined") return "ezri_appearance_settings";
    if (!user?.id) return "ezri_appearance_settings";
    return `ezri_appearance_settings_${user.id}`;
  }, [user?.id]);

  const getDefaultSettings = (): AppearanceSettingsState => ({
    theme: "dark",
    accentColor: "pink",
    backgroundStyle: "gradient",
    animations: true,
    compactMode: false,
    showAvatars: true,
    appearanceVersion: APPEARANCE_SETTINGS_VERSION,
  });

  const readSettingsFromStorage = (key: string): AppearanceSettingsState => {
    const isBrowser =
      typeof window !== "undefined" && typeof window.localStorage !== "undefined";
    if (!isBrowser) return getDefaultSettings();

    const savedSettings = window.localStorage.getItem(key);
    if (!savedSettings) return getDefaultSettings();

    try {
      const parsed = JSON.parse(savedSettings) as Partial<AppearanceSettingsState> & {
        theme?: string;
      };
      const defaults = getDefaultSettings();
      const theme = resolveAppearanceTheme(parsed.theme, parsed.appearanceVersion);
      const accentColor = isAccentColorKey(parsed.accentColor)
        ? parsed.accentColor
        : defaults.accentColor;
      const backgroundStyle =
        parsed.backgroundStyle === "solid" ||
        parsed.backgroundStyle === "gradient" ||
        parsed.backgroundStyle === "pattern"
          ? parsed.backgroundStyle
          : defaults.backgroundStyle;

      return {
        theme,
        accentColor,
        backgroundStyle,
        animations:
          typeof parsed.animations === "boolean" ? parsed.animations : defaults.animations,
        compactMode:
          typeof parsed.compactMode === "boolean" ? parsed.compactMode : defaults.compactMode,
        showAvatars:
          typeof parsed.showAvatars === "boolean" ? parsed.showAvatars : defaults.showAvatars,
        appearanceVersion: APPEARANCE_SETTINGS_VERSION,
      };
    } catch {
      return getDefaultSettings();
    }
  };

  const [settings, setSettings] = useState(() => {
    return readSettingsFromStorage(storageKey);
  });

  const [showSavedMessage, setShowSavedMessage] = useState(false);

  useEffect(() => {
    const loaded = readSettingsFromStorage(storageKey);
    setSettings(loaded);
    applyThemeToDocument(loaded.theme);
    applyAccentColorToDocument(loaded.accentColor);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ezri-appearance-change", { detail: loaded }));
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(settings));

    setShowSavedMessage(true);
    const timer = setTimeout(() => {
      setShowSavedMessage(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [settings, storageKey]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<Partial<AppearanceSettingsState>>;
      const detail = custom.detail || {};
      setSettings((prev) => {
        const next: AppearanceSettingsState = {
          theme: resolveAppearanceTheme(
            detail.theme,
            detail.appearanceVersion ?? prev.appearanceVersion
          ),
          accentColor: isAccentColorKey(detail.accentColor) ? detail.accentColor : prev.accentColor,
          backgroundStyle:
            typeof detail.backgroundStyle === "string"
              ? detail.backgroundStyle
              : prev.backgroundStyle,
          animations:
            typeof detail.animations === "boolean" ? detail.animations : prev.animations,
          compactMode:
            typeof detail.compactMode === "boolean" ? detail.compactMode : prev.compactMode,
          showAvatars:
            typeof detail.showAvatars === "boolean" ? detail.showAvatars : prev.showAvatars,
        };
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
        return next;
      });
    };

    window.addEventListener("ezri-appearance-change", handler);
    return () => window.removeEventListener("ezri-appearance-change", handler);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;

    applyThemeToDocument(settings.theme);
    applyAccentColorToDocument(settings.accentColor);
    root.classList.toggle("appearance-no-animations", !settings.animations);
    root.classList.toggle("appearance-hide-avatars", !settings.showAvatars);
    root.toggleAttribute("data-ezri-compact-mode", settings.compactMode);
    root.setAttribute("data-ezri-background-style", settings.backgroundStyle);
  }, [settings]);

  const updateSetting = <K extends keyof AppearanceSettingsState>(
    key: K,
    value: AppearanceSettingsState[K]
  ) => {
    const nextSettings = {
      ...settings,
      [key]: value,
      appearanceVersion: APPEARANCE_SETTINGS_VERSION,
    };
    setSettings(nextSettings);

    if (key === "theme") {
      applyThemeToDocument(value as AppearanceTheme);
    }
    if (key === "accentColor") {
      applyAccentColorToDocument(value as AccentColorKey);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ezri-appearance-change", { detail: nextSettings })
      );
    }
  };

  const handleResetDefaults = () => {
    const defaults = getDefaultSettings();
    setSettings(defaults);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ezri-appearance-change", { detail: defaults }));
    }
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

  const backgroundStyles = [
    {
      value: "solid" as const,
      label: "Solid Color",
      preview: "bg-[linear-gradient(180deg,#1a1b2e_0%,#12131f_100%)]",
      dots: ["bg-slate-600", "bg-slate-500", "bg-slate-700", "bg-slate-400"],
    },
    {
      value: "gradient" as const,
      label: "Gradient",
      preview: "bg-[linear-gradient(135deg,#312e81_0%,#1e1b4b_45%,#0f172a_100%)]",
      dots: ["bg-violet-500", "bg-fuchsia-500", "bg-indigo-600", "bg-purple-400"],
    },
    {
      value: "pattern" as const,
      label: "Pattern",
      preview:
        "bg-[linear-gradient(135deg,#1e1b4b_25%,transparent_25%),linear-gradient(225deg,#1e1b4b_25%,transparent_25%)] bg-[length:12px_12px] bg-[#12131f]",
      dots: ["bg-violet-400/80", "bg-fuchsia-400/70", "bg-indigo-400/80", "bg-violet-300/60"],
    },
  ];

  const dense = settings.compactMode;
  const tc = appearanceThemeClasses();

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
          dense ? "py-5" : "py-7 sm:py-9"
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
                  <p className={tc.heroLead}>
                    Customize your visual experience
                  </p>
                  <p className={tc.heroBody}>
                    Shape your space to match your mood and create the perfect environment for
                    your healing and growth.
                  </p>
                </div>
              </div>
            </section>

            {/* Theme mode */}
            <section className={tc.panel}>
              <p className={tc.sectionLabel}>Theme mode</p>
              <h2 className={cn(tc.sectionHeading, "mt-2")}>Choose the mood that feels right for you</h2>
              <p className={tc.sectionSubtitle}>
                Dark keeps your sanctuary as it is today. Light switches to a brighter palette.
              </p>

              <div className={cn("mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2", dense ? "gap-2" : "gap-3")}>
                {themes.map((theme) => {
                  const Icon = theme.icon;
                  const selected = settings.theme === theme.value;
                  return (
                    <motion.button
                      key={theme.value}
                      type="button"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => updateSetting("theme", theme.value)}
                      className={cn(
                        tc.optionCard,
                        selected && tc.optionCardSelected
                      )}
                      aria-pressed={selected}
                    >
                      {selected && <SelectedCheck />}
                      <div className={appearanceIconChip(theme.tone)}>
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <div className="min-w-0 text-left">
                        <p className={tc.optionTitle}>{theme.label}</p>
                        <p className={tc.optionDesc}>
                          {theme.description}
                        </p>
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
                Personalize Solace with a color that feels like you.
              </p>

              <div className="mt-6 flex gap-4 overflow-x-auto pb-2 sm:flex-wrap sm:justify-start sm:gap-5 sm:overflow-visible">
                {accentColors.map((color) => {
                  const selected = settings.accentColor === color.value;
                  const [from, to] = ACCENT_ORB_GRADIENT[color.value];
                  return (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => updateSetting("accentColor", color.value)}
                      className={cn(
                        "group flex shrink-0 flex-col items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/50 focus-visible:ring-offset-2",
                        tc.accentRingOffset
                      )}
                      aria-pressed={selected}
                      aria-label={`${color.label}${selected ? ", selected" : ""}`}
                    >
                      <span
                        className={cn(
                          "appearance-accent-orb hc-preserve-color relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                          selected
                            ? cn(
                                "ring-[3px] ring-fuchsia-400/80 ring-offset-2 shadow-[0_0_28px_-4px_rgba(236,72,153,0.75)]",
                                tc.accentRingOffset
                              )
                            : "ring-1 ring-slate-300/80",
                          !selected && "ring-[color:var(--solace-border)]",
                          "transition-shadow duration-300 group-hover:shadow-[0_0_20px_-6px_rgba(192,132,252,0.45)]"
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
                            <Check className="h-3 w-3 text-fuchsia-600" strokeWidth={3} aria-hidden />
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

              <div className={cn("mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3", dense ? "gap-2" : "gap-3")}>
                {backgroundStyles.map((style) => {
                  const selected = settings.backgroundStyle === style.value;
                  return (
                    <motion.button
                      key={style.value}
                      type="button"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => updateSetting("backgroundStyle", style.value)}
                      className={cn(
                        tc.bgStyleCard,
                        selected && tc.optionCardSelected
                      )}
                      aria-pressed={selected}
                    >
                      {selected && <SelectedCheck />}
                      <div
                        className={cn(
                          "hc-preserve-color mb-3 h-16 w-full rounded-xl border",
                          settings.theme === "light" ? "border-slate-200/80" : "border-white/[0.08]",
                          style.preview
                        )}
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
                  <p className={tc.sectionSubtitle}>
                    See how your changes look across Solace.
                  </p>
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
                    <MoonIcon className="absolute right-2 top-2 h-3 w-3 text-amber-200/80" aria-hidden />
                  </div>
                  <div className="p-2.5">
                    <p className="text-[10px] font-semibold text-white">Good evening, {displayName.split(" ")[0]}</p>
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
                    <Feather className="mb-1.5 h-4 w-4 text-fuchsia-300/80" aria-hidden />
                    <p className="text-[10px] font-semibold text-white">Journal</p>
                    <p className="mt-1 text-[9px] text-[rgba(255,255,255,0.42)]">Your thoughts matter.</p>
                  </div>
                </motion.div>

                <motion.div className={tc.miniPreviewCard}>
                  <motion.div className="flex flex-1 flex-col items-center justify-center p-3 text-center">
                    <Headphones className="mb-1.5 h-4 w-4 text-cyan-300/80" aria-hidden />
                    <p className="text-[10px] font-semibold text-white">Support</p>
                    <p className="mt-1 text-[9px] text-[rgba(255,255,255,0.42)]">We&apos;re here for you 24/7</p>
                  </motion.div>
                </motion.div>

                <motion.div className={tc.miniPreviewCard}>
                  <div className="p-2.5">
                    <p className="text-[10px] font-semibold text-white">Sleep Tracker</p>
                    <div className="mt-2 flex h-8 items-end justify-center gap-0.5">
                      {[40, 65, 55, 80, 70, 90, 75].map((h, i) => (
                        <span
                          key={`sleep-bar-${i}`}
                          className="w-1.5 rounded-t-sm bg-violet-400/70"
                          style={{ height: `${h}%` }}
                          aria-hidden
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-center text-[9px] font-semibold text-violet-200/90">7h 32m</p>
                  </div>
                </motion.div>
              </div>
            </section>
        </motion.div>

        {showSavedMessage && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed right-6 top-6 z-50 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-100 shadow-[0_0_24px_-8px_rgba(52,211,153,0.45)] backdrop-blur-md"
            role="status"
          >
            Settings saved!
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
