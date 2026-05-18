import { motion } from "motion/react";
import {
  Sun,
  Moon,
  Monitor,
  Sparkles,
  Layout,
  ArrowLeft,
  Check,
  Zap,
  Minimize2,
  Users,
  Wind,
  Contrast,
  Type,
  Feather,
  Headphones,
  Moon as MoonIcon,
  Home,
  MessageCircle,
  BookOpen,
  BarChart3,
  Palette,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  APPEARANCE_HERO_IMG,
  APPEARANCE_LOTUS_IMG,
  appearanceBackLink,
  appearanceBtnGhost,
  appearanceHeroAccent,
  appearanceHeroCard,
  appearanceHeroImage,
  appearanceHeroOverlayLeft,
  appearanceHeroOverlayPurple,
  appearanceHeroOverlayWarmth,
  appearanceHeroTitle,
  appearanceIconChip,
  appearanceMiniPreviewCard,
  appearanceOptionCard,
  appearanceOptionCardSelected,
  appearancePageAtmosphere,
  appearancePageFogMid,
  appearancePageGlowTop,
  appearancePageVignette,
  appearancePanel,
  appearancePrefRow,
  appearanceRailCard,
  appearanceSectionHeading,
  appearanceSectionLabel,
  appearanceSectionSubtitle,
  appearanceValuePill,
} from "@/app/pages/app/appearance-settings/appearanceSettingsUi";

type AppearanceSettingsState = {
  theme: "light" | "dark" | "auto";
  accentColor: "blue" | "purple" | "pink" | "green" | "orange" | "teal";
  backgroundStyle: "solid" | "gradient" | "pattern";
  animations: boolean;
  compactMode: boolean;
  showAvatars: boolean;
};

interface AppearanceToggleProps {
  enabled: boolean;
  onToggle: () => void;
  ariaLabel: string;
}

function AppearanceToggle({ enabled, onToggle, ariaLabel }: AppearanceToggleProps) {
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      whileTap={{ scale: 0.95 }}
      onClick={onToggle}
      className={cn(
        "relative h-8 w-14 shrink-0 rounded-full transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/45",
        enabled
          ? "bg-gradient-to-r from-violet-500/70 to-fuchsia-500/70 shadow-[0_0_20px_-4px_rgba(192,132,252,0.55)]"
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

interface PrefRowProps {
  icon: ReactNode;
  tone: "violet" | "pink" | "cyan" | "amber" | "rose" | "emerald" | "blue";
  title: string;
  description: string;
  control: ReactNode;
}

function AppearancePrefRow({ icon, tone, title, description, control }: PrefRowProps) {
  return (
    <motion.div className={appearancePrefRow} initial={false}>
      <motion.div className="flex min-w-0 flex-1 items-start gap-3.5">
        <div className={appearanceIconChip(tone)}>{icon}</div>
        <motion.div className="min-w-0">
          <p className="text-sm font-medium text-[rgba(255,255,255,0.92)]">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-[rgba(255,255,255,0.45)]">{description}</p>
        </motion.div>
      </motion.div>
      <motion.div className="shrink-0 sm:pl-2">{control}</motion.div>
    </motion.div>
  );
}

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
    theme: "light",
    accentColor: "pink",
    backgroundStyle: "gradient",
    animations: true,
    compactMode: false,
    showAvatars: true,
  });

  const readSettingsFromStorage = (key: string): AppearanceSettingsState => {
    const isBrowser =
      typeof window !== "undefined" && typeof window.localStorage !== "undefined";
    if (!isBrowser) return getDefaultSettings();

    const savedSettings = window.localStorage.getItem(key);
    if (!savedSettings) return getDefaultSettings();

    try {
      const parsed = JSON.parse(savedSettings);
      return {
        ...getDefaultSettings(),
        ...parsed,
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
    setSettings(readSettingsFromStorage(storageKey));
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
          theme: typeof detail.theme === "string" ? detail.theme : prev.theme,
          accentColor:
            typeof detail.accentColor === "string" ? detail.accentColor : prev.accentColor,
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
    let mediaQuery: MediaQueryList | null = null;
    let handleAutoThemeChange: ((event: MediaQueryListEvent) => void) | null = null;

    const accentMap: Record<string, string> = {
      blue: "#3b82f6",
      purple: "#a855f7",
      pink: "#ec4899",
      green: "#22c55e",
      orange: "#f97316",
      teal: "#14b8a6",
    };

    const accent = accentMap[settings.accentColor] || accentMap.pink;

    root.style.setProperty("--accent", accent);
    root.style.setProperty("--primary", accent);
    root.style.setProperty("--ring", accent);
    root.classList.toggle("appearance-no-animations", !settings.animations);
    root.classList.toggle("appearance-hide-avatars", !settings.showAvatars);
    root.toggleAttribute("data-ezri-compact-mode", settings.compactMode);
    root.setAttribute("data-ezri-background-style", settings.backgroundStyle);

    if (settings.theme === "auto") {
      if (typeof window !== "undefined" && window.matchMedia) {
        mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        root.classList.toggle("dark", mediaQuery.matches);
        handleAutoThemeChange = (event: MediaQueryListEvent) => {
          root.classList.toggle("dark", event.matches);
        };
        mediaQuery.addEventListener("change", handleAutoThemeChange);
      }
    } else {
      root.classList.toggle("dark", settings.theme === "dark");
    }

    return () => {
      if (mediaQuery && handleAutoThemeChange) {
        mediaQuery.removeEventListener("change", handleAutoThemeChange);
      }
    };
  }, [settings]);

  const updateSetting = <K extends keyof AppearanceSettingsState>(
    key: K,
    value: AppearanceSettingsState[K]
  ) => {
    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);

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
      value: "light" as const,
      label: "Light",
      description: "Clean, bright and easy on the eyes",
      icon: Sun,
      tone: "amber" as const,
    },
    {
      value: "dark" as const,
      label: "Dark",
      description: "Deep, calm and easy to focus",
      icon: Moon,
      tone: "violet" as const,
    },
    {
      value: "auto" as const,
      label: "Auto",
      description: "Adjusts automatically with your system",
      icon: Monitor,
      tone: "blue" as const,
    },
  ];

  const accentColors: Array<{
    value: AppearanceSettingsState["accentColor"] | null;
    label: string;
    orbClass: string;
    ringClass?: string;
  }> = [
    { value: "pink", label: "Rose Pink", orbClass: "bg-gradient-to-br from-rose-400 to-pink-600" },
    { value: "purple", label: "Lavender", orbClass: "bg-gradient-to-br from-violet-400 to-purple-600" },
    { value: "blue", label: "Ocean Blue", orbClass: "bg-gradient-to-br from-sky-400 to-blue-600" },
    { value: "teal", label: "Teal", orbClass: "bg-gradient-to-br from-teal-400 to-cyan-600" },
    { value: "green", label: "Forest Green", orbClass: "bg-gradient-to-br from-emerald-400 to-green-700" },
    { value: "orange", label: "Sunset Orange", orbClass: "bg-gradient-to-br from-orange-400 to-rose-500" },
    { value: null, label: "Amber", orbClass: "bg-gradient-to-br from-amber-300 to-amber-600" },
    {
      value: null,
      label: "Custom",
      orbClass:
        "bg-[conic-gradient(from_210deg,#ec4899,#a855f7,#3b82f6,#14b8a6,#f97316,#ec4899)]",
      ringClass: "ring-white/20",
    },
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

  const themeLabel =
    settings.theme === "light" ? "Light" : settings.theme === "dark" ? "Dark" : "Auto";

  const accentLabel =
    accentColors.find((c) => c.value === settings.accentColor)?.label ?? "Rose Pink";

  const backgroundLabel =
    settings.backgroundStyle === "solid"
      ? "Solid"
      : settings.backgroundStyle === "gradient"
        ? "Gradient"
        : "Pattern";

  const wellnessScores = useMemo(() => {
    let calmness = 72;
    let focus = 68;
    let comfort = 70;
    if (settings.theme === "dark") calmness += 8;
    if (settings.theme === "light") comfort += 6;
    if (settings.backgroundStyle === "gradient") calmness += 6;
    if (settings.animations) comfort += 5;
    if (!settings.compactMode) focus += 4;
    if (settings.accentColor === "pink" || settings.accentColor === "purple") calmness += 4;
    return {
      calmness: Math.min(95, calmness),
      focus: Math.min(95, focus),
      comfort: Math.min(95, comfort),
    };
  }, [settings]);

  const dense = settings.compactMode;

  return (
    <motion.div
      className={appearancePageAtmosphere}
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
          className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Main column */}
          <div className="min-w-0 space-y-6">
            {/* Hero */}
            <section className={appearanceHeroCard}>
              <img src={APPEARANCE_HERO_IMG} alt="" className={appearanceHeroImage} />
              <motion.div className={appearanceHeroOverlayLeft} aria-hidden />
              <motion.div className={appearanceHeroOverlayPurple} aria-hidden />
              <motion.div className={appearanceHeroOverlayWarmth} aria-hidden />

              <div className="relative flex h-full min-h-[220px] flex-col justify-end p-6 sm:min-h-[240px] sm:p-8 lg:min-h-[250px]">
                <Link to="/app/settings" className={appearanceBackLink}>
                  <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                  Back to Settings
                </Link>

                <div className="mt-4 max-w-xl">
                  <h1 className={appearanceHeroTitle}>
                    <span className={appearanceHeroAccent}>Appearance</span>
                  </h1>
                  <p className="mt-2 text-sm text-[rgba(255,255,255,0.68)] sm:text-[15px]">
                    Customize your visual experience
                  </p>
                  <p className="mt-3 max-w-lg text-xs leading-relaxed text-[rgba(255,255,255,0.48)] sm:text-sm">
                    Shape your space to match your mood and create the perfect environment for
                    your healing and growth.
                  </p>
                </div>
              </div>
            </section>

            {/* Theme mode */}
            <section className={appearancePanel}>
              <p className={appearanceSectionLabel}>Theme mode</p>
              <h2 className={cn(appearanceSectionHeading, "mt-2")}>Choose the mood that feels right for you</h2>
              <p className={appearanceSectionSubtitle}>Light, dark, or matched to your system.</p>

              <div className={cn("mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3", dense ? "gap-2" : "gap-3")}>
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
                        appearanceOptionCard,
                        selected && appearanceOptionCardSelected
                      )}
                      aria-pressed={selected}
                    >
                      {selected && <SelectedCheck />}
                      <div className={appearanceIconChip(theme.tone)}>
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="font-semibold text-white">{theme.label}</p>
                        <p className="mt-1 text-xs leading-relaxed text-[rgba(255,255,255,0.45)]">
                          {theme.description}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </section>

            {/* Accent color */}
            <section className={appearancePanel}>
              <p className={appearanceSectionLabel}>Accent color</p>
              <h2 className={cn(appearanceSectionHeading, "mt-2")}>Personalize your sanctuary</h2>
              <p className={appearanceSectionSubtitle}>
                Personalize Solace with a color that feels like you.
              </p>

              <motion.div className="mt-6 flex gap-4 overflow-x-auto pb-2 sm:flex-wrap sm:justify-between sm:overflow-visible">
                {accentColors.map((color) => {
                  const selected = color.value !== null && settings.accentColor === color.value;
                  return (
                    <motion.button
                      key={color.label}
                      type="button"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      disabled={color.value === null}
                      onClick={() => {
                        if (color.value) updateSetting("accentColor", color.value);
                      }}
                      className={cn(
                        "group flex shrink-0 flex-col items-center gap-2",
                        color.value === null && "cursor-default opacity-90"
                      )}
                      aria-pressed={selected}
                      aria-label={`${color.label}${selected ? ", selected" : ""}`}
                    >
                      <span
                        className={cn(
                          "hc-preserve-color relative flex h-12 w-12 items-center justify-center rounded-full",
                          color.orbClass,
                          selected
                            ? "ring-[3px] ring-fuchsia-300/80 ring-offset-2 ring-offset-[#0a0b18] shadow-[0_0_28px_-4px_rgba(236,72,153,0.75)]"
                            : cn("ring-1 ring-white/10", color.ringClass),
                          "transition-shadow duration-300 group-hover:shadow-[0_0_20px_-6px_rgba(192,132,252,0.45)]"
                        )}
                      >
                        {selected && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-white/95 shadow-md"
                          >
                            <Check className="h-3 w-3 text-fuchsia-600" strokeWidth={3} />
                          </motion.span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] font-medium",
                          selected ? "text-fuchsia-200/95" : "text-[rgba(255,255,255,0.45)]"
                        )}
                      >
                        {color.label}
                      </span>
                    </motion.button>
                  );
                })}
              </motion.div>
            </section>

            {/* Background style */}
            <section className={appearancePanel}>
              <p className={appearanceSectionLabel}>Background style</p>
              <h2 className={cn(appearanceSectionHeading, "mt-2")}>Set your visual backdrop</h2>
              <p className={appearanceSectionSubtitle}>
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
                        "relative flex flex-col items-stretch rounded-[1.25rem] border border-white/[0.07] p-3 text-left",
                        "bg-[linear-gradient(160deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.01)_100%)]",
                        "transition-all duration-300 hover:border-violet-400/22",
                        selected && appearanceOptionCardSelected
                      )}
                      aria-pressed={selected}
                    >
                      {selected && <SelectedCheck />}
                      <div
                        className={cn(
                          "hc-preserve-color mb-3 h-16 w-full rounded-xl border border-white/[0.08]",
                          style.preview
                        )}
                      />
                      <p className="text-center text-sm font-semibold text-white">{style.label}</p>
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

            {/* Visual preferences */}
            <section className={appearancePanel}>
              <p className={appearanceSectionLabel}>Visual preferences</p>
              <h2 className={cn(appearanceSectionHeading, "mt-2")}>Adjust how Solace feels</h2>
              <p className={appearanceSectionSubtitle}>Adjust how Solace looks and feels.</p>

              <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
                <div className="space-y-3">
                  <AppearancePrefRow
                    icon={<Zap className="h-4 w-4" aria-hidden />}
                    tone="violet"
                    title="Smooth Animations"
                    description="Enable fluid transitions and effects"
                    control={
                      <AppearanceToggle
                        enabled={settings.animations}
                        onToggle={() => updateSetting("animations", !settings.animations)}
                        ariaLabel="Smooth animations"
                      />
                    }
                  />
                  <AppearancePrefRow
                    icon={<Minimize2 className="h-4 w-4" aria-hidden />}
                    tone="cyan"
                    title="Compact Mode"
                    description="Reduce spacing for more content"
                    control={
                      <AppearanceToggle
                        enabled={settings.compactMode}
                        onToggle={() => updateSetting("compactMode", !settings.compactMode)}
                        ariaLabel="Compact mode"
                      />
                    }
                  />
                  <AppearancePrefRow
                    icon={<Users className="h-4 w-4" aria-hidden />}
                    tone="emerald"
                    title="Show Avatars"
                    description="Display profile pictures and avatars"
                    control={
                      <AppearanceToggle
                        enabled={settings.showAvatars}
                        onToggle={() => updateSetting("showAvatars", !settings.showAvatars)}
                        ariaLabel="Show avatars"
                      />
                    }
                  />
                </div>

                <div className="space-y-3">
                  <AppearancePrefRow
                    icon={<Wind className="h-4 w-4" aria-hidden />}
                    tone="blue"
                    title="Reduce Motion"
                    description="Minimize animations for a calmer experience"
                    control={
                      <AppearanceToggle
                        enabled={!settings.animations}
                        onToggle={() => updateSetting("animations", !settings.animations)}
                        ariaLabel="Reduce motion"
                      />
                    }
                  />
                  <AppearancePrefRow
                    icon={<Contrast className="h-4 w-4" aria-hidden />}
                    tone="amber"
                    title="High Contrast"
                    description="Increase contrast for better visibility"
                    control={
                      <Link
                        to="/app/settings/accessibility"
                        className={appearanceBtnGhost}
                        aria-label="Manage high contrast in accessibility settings"
                      >
                        Manage
                      </Link>
                    }
                  />
                  <AppearancePrefRow
                    icon={<Type className="h-4 w-4" aria-hidden />}
                    tone="blue"
                    title="Text Size"
                    description="Adjust the size of text across the app"
                    control={
                      <Link
                        to="/app/settings/accessibility"
                        className="inline-flex gap-1 rounded-full border border-white/[0.1] bg-black/30 p-1"
                        aria-label="Adjust text size in accessibility settings"
                      >
                        {(["A-", "A", "A+"] as const).map((label, i) => (
                          <span
                            key={label}
                            className={cn(
                              "flex h-7 min-w-[28px] items-center justify-center rounded-full px-2 text-xs font-semibold",
                              i === 1
                                ? "bg-violet-500/40 text-white shadow-[0_0_12px_-4px_rgba(139,92,246,0.5)]"
                                : "text-[rgba(255,255,255,0.45)]"
                            )}
                          >
                            {label}
                          </span>
                        ))}
                      </Link>
                    }
                  />
                </div>
              </div>
            </section>

            {/* Live preview strip */}
            <section className={appearancePanel}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={appearanceSectionLabel}>Live preview</p>
                  <h2 className={cn(appearanceSectionHeading, "mt-2")}>See your changes</h2>
                  <p className={appearanceSectionSubtitle}>
                    See how your changes look across Solace.
                  </p>
                </div>
                <button type="button" onClick={handleResetDefaults} className={appearanceBtnGhost}>
                  Reset to default
                </button>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <div className={appearanceMiniPreviewCard}>
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

                <div className={appearanceMiniPreviewCard}>
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

                <motion.div className={appearanceMiniPreviewCard}>
                  <div className="flex flex-1 flex-col items-center justify-center p-3 text-center">
                    <Feather className="mb-1.5 h-4 w-4 text-fuchsia-300/80" aria-hidden />
                    <p className="text-[10px] font-semibold text-white">Journal</p>
                    <p className="mt-1 text-[9px] text-[rgba(255,255,255,0.42)]">Your thoughts matter.</p>
                  </div>
                </motion.div>

                <motion.div className={appearanceMiniPreviewCard}>
                  <motion.div className="flex flex-1 flex-col items-center justify-center p-3 text-center">
                    <Headphones className="mb-1.5 h-4 w-4 text-cyan-300/80" aria-hidden />
                    <p className="text-[10px] font-semibold text-white">Support</p>
                    <p className="mt-1 text-[9px] text-[rgba(255,255,255,0.42)]">We&apos;re here for you 24/7</p>
                  </motion.div>
                </motion.div>

                <motion.div className={appearanceMiniPreviewCard}>
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
          </div>

          {/* Right rail */}
          <aside className="w-full shrink-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
            {/* Appearance preview */}
            <div className={appearanceRailCard}>
              <p className={appearanceSectionLabel}>Appearance preview</p>
              <h2 className="mt-2 text-sm font-semibold text-white">A live preview of your setup</h2>
              <p className="mt-1 text-xs text-[rgba(255,255,255,0.45)]">
                A live preview of your current setup.
              </p>

              <div className="relative mt-4 overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#0c0d1a] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_40px_-12px_rgba(139,92,246,0.25)]">
                <div className="flex min-h-[280px]">
                  <div className="flex w-10 shrink-0 flex-col items-center gap-2 border-r border-white/[0.06] bg-[#090a14] py-3">
                    {[Home, MessageCircle, BookOpen, BarChart3].map((Icon, i) => (
                      <span
                        key={`nav-${i}`}
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-md",
                          i === 0 ? "bg-violet-500/25 text-violet-200" : "text-white/30"
                        )}
                      >
                        <Icon className="h-3 w-3" aria-hidden />
                      </span>
                    ))}
                  </div>
                  <div className="min-w-0 flex-1 p-2.5">
                    <div className="relative mb-2 h-14 overflow-hidden rounded-xl">
                      <img
                        src={APPEARANCE_HERO_IMG}
                        alt=""
                        className="h-full w-full object-cover brightness-[0.5]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0b18]/90 to-transparent" />
                      <p className="absolute bottom-2 left-2 text-[9px] font-semibold text-white">
                        Good evening, {displayName.split(" ")[0]}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-2">
                      <p className="text-[8px] font-semibold uppercase tracking-wider text-white/50">
                        Today&apos;s Progress
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <motion.div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
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
                              stroke="url(#previewRing)"
                              strokeWidth="3"
                              strokeDasharray={`${72 * 0.88} 88`}
                              strokeLinecap="round"
                            />
                            <defs>
                              <linearGradient id="previewRing" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#a855f7" />
                                <stop offset="100%" stopColor="#ec4899" />
                              </linearGradient>
                            </defs>
                          </svg>
                          <span className="absolute text-[8px] font-bold text-white">72%</span>
                        </motion.div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="h-1.5 rounded-full bg-white/[0.08]" />
                          <motion.div className="h-1.5 w-3/4 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-around border-t border-white/[0.06] pt-2">
                      {[Home, MessageCircle, BookOpen, BarChart3, Palette].map((Icon, i) => (
                        <Icon
                          key={`bottom-${i}`}
                          className={cn("h-3 w-3", i === 0 ? "text-fuchsia-300" : "text-white/25")}
                          aria-hidden
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Current style */}
            <div className={appearanceRailCard}>
              <p className={appearanceSectionLabel}>Current style</p>
              <h2 className="mt-2 text-sm font-semibold text-white">Your Solace right now</h2>
              <p className="mt-1 text-xs text-[rgba(255,255,255,0.45)]">
                Here&apos;s what your Solace looks like right now.
              </p>

              <ul className="mt-4 divide-y divide-white/[0.06]">
                {[
                  { icon: Moon, label: "Theme", value: themeLabel },
                  { icon: Palette, label: "Accent Color", value: accentLabel },
                  { icon: Sparkles, label: "Background", value: backgroundLabel },
                  { icon: Zap, label: "Animations", value: settings.animations ? "Smooth" : "Off" },
                  { icon: Layout, label: "Compact Mode", value: settings.compactMode ? "On" : "Off" },
                ].map((row) => {
                  const Icon = row.icon;
                  return (
                    <li
                      key={row.label}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 text-violet-300/70" aria-hidden />
                        <span className="text-xs text-[rgba(255,255,255,0.55)]">{row.label}</span>
                      </div>
                      <span className={appearanceValuePill}>{row.value}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Wellness impact */}
            <div className={appearanceRailCard}>
              <p className={appearanceSectionLabel}>Wellness impact</p>
              <h2 className="mt-2 text-sm font-semibold text-white">Visual wellbeing</h2>
              <p className="mt-1 text-xs text-[rgba(255,255,255,0.45)]">
                Your visual settings support your wellbeing.
              </p>

              <div className="mt-4 space-y-4">
                {(
                  [
                    { label: "Calmness", value: wellnessScores.calmness, tone: "from-rose-400 to-fuchsia-500" },
                    { label: "Focus", value: wellnessScores.focus, tone: "from-violet-400 to-indigo-500" },
                    { label: "Comfort", value: wellnessScores.comfort, tone: "from-cyan-400 to-blue-500" },
                  ] as const
                ).map((metric) => (
                  <div key={metric.label}>
                    <motion.div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs text-[rgba(255,255,255,0.55)]">{metric.label}</span>
                      <span className="text-xs font-semibold text-white/80">{metric.value}%</span>
                    </motion.div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <motion.div
                        className={cn("h-full rounded-full bg-gradient-to-r shadow-[0_0_16px_-4px_rgba(192,132,252,0.5)]", metric.tone)}
                        initial={false}
                        animate={{ width: `${metric.value}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pro tip */}
            <div className={cn(appearanceRailCard, "relative overflow-hidden")}>
              <p className={appearanceSectionLabel}>Pro tip</p>
              <p className="mt-3 max-w-[220px] text-sm leading-relaxed text-[rgba(255,255,255,0.72)]">
                Soft colors and smooth motion can help reduce stress and improve focus.
              </p>
              <p className="mt-2 text-xs text-fuchsia-200/80">Your setup is looking perfect. ✨</p>
              <div
                className="pointer-events-none absolute -bottom-4 -right-2 h-28 w-28 opacity-80"
                aria-hidden
              >
                <img
                  src={APPEARANCE_LOTUS_IMG}
                  alt=""
                  className="h-full w-full object-cover object-center mix-blend-screen brightness-125 saturate-150"
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(168,85,247,0.35)_0%,transparent_70%)]" />
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
            Settings saved!
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
