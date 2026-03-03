import { motion } from "motion/react";
import { 
  Palette,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  Image as ImageIcon,
  Layout,
  ArrowLeft,
  CheckCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/app/components/AppLayout";
import { useAuth } from "@/app/contexts/AuthContext";

export function AppearanceSettings() {
  const { user } = useAuth();

  const storageKey = useMemo(() => {
    if (typeof window === "undefined") return "ezri_appearance_settings";
    if (!user?.id) return "ezri_appearance_settings";
    return `ezri_appearance_settings_${user.id}`;
  }, [user?.id]);

  const getDefaultSettings = () => ({
    theme: "light",
    accentColor: "pink",
    backgroundStyle: "gradient",
    animations: true,
    compactMode: false,
    showAvatars: true
  });

  const [settings, setSettings] = useState(() => {
    const isBrowser =
      typeof window !== "undefined" && typeof window.localStorage !== "undefined";
    const savedSettings = isBrowser
      ? window.localStorage.getItem(storageKey)
      : null;

    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        return {
          ...getDefaultSettings(),
          ...parsed
        };
      } catch {
        return getDefaultSettings();
      }
    }

    return getDefaultSettings();
  });

  const [showSavedMessage, setShowSavedMessage] = useState(false);

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

  // Sync with external changes
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<any>;
      const detail = custom.detail || {};
      // Only update if different to avoid loops
      setSettings(prev => {
        if (JSON.stringify(prev) === JSON.stringify(detail)) return prev;
        return { ...prev, ...detail };
      });
    };

    window.addEventListener("ezri-appearance-change", handler);
    return () => window.removeEventListener("ezri-appearance-change", handler);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;

    const accentMap: Record<string, string> = {
      blue: "#3b82f6",
      purple: "#a855f7",
      pink: "#ec4899",
      green: "#22c55e",
      orange: "#f97316",
      teal: "#14b8a6"
    };

    const accent = accentMap[settings.accentColor] || accentMap.pink;

    root.style.setProperty("--accent", accent);
  }, [settings.accentColor]);

  const updateSetting = (key: string, value: any) => {
    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ezri-appearance-change", { detail: nextSettings })
      );
    }
  };

  const themes = [
    { value: "light", label: "Light", icon: Sun, color: "from-yellow-400 to-orange-500" },
    { value: "dark", label: "Dark", icon: Moon, color: "from-indigo-600 to-purple-700" },
    { value: "auto", label: "Auto", icon: Monitor, color: "from-blue-500 to-indigo-600" }
  ];

  const accentColors = [
    { value: "blue", label: "Ocean Blue", color: "bg-blue-500" },
    { value: "purple", label: "Lavender", color: "bg-purple-500" },
    { value: "pink", label: "Rose Pink", color: "bg-pink-500" },
    { value: "green", label: "Forest Green", color: "bg-green-500" },
    { value: "orange", label: "Sunset Orange", color: "bg-orange-500" },
    { value: "teal", label: "Teal", color: "bg-teal-500" }
  ];

  const backgroundStyles = [
    { value: "solid", label: "Solid Color", preview: "bg-white" },
    { value: "gradient", label: "Gradient", preview: "bg-gradient-to-br from-blue-50 to-indigo-100" },
    { value: "pattern", label: "Pattern", preview: "bg-blue-50" }
  ];

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Link
              to="/app/settings"
              className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Settings
            </Link>

            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600">
                <Palette className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Appearance</h1>
                <p className="text-gray-600 dark:text-gray-400">Customize your visual experience</p>
              </div>
            </div>
          </motion.div>

          {/* Theme Selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-slate-700 mb-6"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Theme</h2>

            <div className="grid grid-cols-3 gap-4">
              {themes.map((theme) => {
                const Icon = theme.icon;
                return (
                  <motion.button
                    key={theme.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => updateSetting('theme', theme.value)}
                    className={`relative p-6 rounded-xl border-2 transition-all ${
                      settings.theme === theme.value
                        ? "border-blue-500 bg-blue-50 dark:bg-slate-800"
                        : "border-gray-200 bg-gray-50 dark:bg-slate-900 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-500"
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${theme.color} flex items-center justify-center mx-auto mb-3`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{theme.label}</p>
                    {settings.theme === theme.value && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2 right-2"
                      >
                        <CheckCircle className="w-5 h-5 text-blue-500" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* Accent Color */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-slate-700 mb-6"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Accent Color</h2>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {accentColors.map((color) => (
                <motion.button
                  key={color.value}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => updateSetting('accentColor', color.value)}
                  className="relative"
                >
                  <div className={`w-full aspect-square rounded-xl ${color.color} ${
                    settings.accentColor === color.value ? "ring-4 ring-offset-2 ring-gray-900" : ""
                  }`} />
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 text-center">{color.label}</p>
                  {settings.accentColor === color.value && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                    >
                      <CheckCircle className="w-6 h-6 text-white drop-shadow-lg" />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Background Style */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-slate-700 mb-6"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Background Style</h2>

            <div className="grid grid-cols-3 gap-4">
              {backgroundStyles.map((style) => (
                <motion.button
                  key={style.value}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => updateSetting('backgroundStyle', style.value)}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    settings.backgroundStyle === style.value
                      ? "border-pink-500 bg-pink-50 dark:bg-slate-800"
                      : "border-gray-200 bg-gray-50 dark:bg-slate-900 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-500"
                  }`}
                >
                  <div className={`w-full h-20 rounded-lg ${style.preview} mb-3 border border-gray-200 dark:border-slate-700`} />
                  <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{style.label}</p>
                  {settings.backgroundStyle === style.value && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2"
                    >
                      <CheckCircle className="w-5 h-5 text-pink-500" />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Visual Preferences */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-slate-700 mb-6"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Visual Preferences</h2>

            <div className="space-y-4">
              {/* Animations */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Smooth Animations</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Enable fluid transitions and effects</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => updateSetting('animations', !settings.animations)}
                  className={`w-14 h-8 rounded-full transition-colors ${
                    settings.animations ? "bg-purple-500" : "bg-gray-300"
                  }`}
                >
                  <motion.div
                    animate={{ x: settings.animations ? 24 : 2 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </motion.button>
              </div>

              {/* Compact Mode */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <Layout className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Compact Mode</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Reduce spacing for more content</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => updateSetting('compactMode', !settings.compactMode)}
                  className={`w-14 h-8 rounded-full transition-colors ${
                    settings.compactMode ? "bg-blue-500" : "bg-gray-300"
                  }`}
                >
                  <motion.div
                    animate={{ x: settings.compactMode ? 24 : 2 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </motion.button>
              </div>

              {/* Show Avatars */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <ImageIcon className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Show Avatars</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Display profile pictures and avatars</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => updateSetting('showAvatars', !settings.showAvatars)}
                  className={`w-14 h-8 rounded-full transition-colors ${
                    settings.showAvatars ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <motion.div
                    animate={{ x: settings.showAvatars ? 24 : 2 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950 dark:to-rose-900 border-2 border-pink-200 dark:border-pink-700 rounded-2xl p-6"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-md">
                <Sparkles className="w-6 h-6 text-pink-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-pink-900 dark:text-pink-200 mb-2">Live Preview</h3>
                <p className="text-sm text-pink-700 dark:text-pink-300 mb-4">
                  Your changes are applied instantly. The app will remember your preferences across sessions.
                </p>
                <div className={`p-4 rounded-xl bg-white dark:bg-slate-900 border-2 ${
                  settings.accentColor === 'blue' ? 'border-blue-200' :
                  settings.accentColor === 'purple' ? 'border-purple-200' :
                  settings.accentColor === 'pink' ? 'border-pink-200' :
                  settings.accentColor === 'green' ? 'border-green-200' :
                  settings.accentColor === 'orange' ? 'border-orange-200' :
                  'border-teal-200'
                }`}>
                  <div className="flex items-center gap-3 mb-2">
                    {settings.showAvatars && (
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${
                        settings.accentColor === 'blue' ? 'from-blue-400 to-blue-600' :
                        settings.accentColor === 'purple' ? 'from-purple-400 to-purple-600' :
                        settings.accentColor === 'pink' ? 'from-pink-400 to-pink-600' :
                        settings.accentColor === 'green' ? 'from-green-400 to-green-600' :
                        settings.accentColor === 'orange' ? 'from-orange-400 to-orange-600' :
                        'from-teal-400 to-teal-600'
                      }`} />
                    )}
                    <div>
                      <p className="font-bold text-gray-900 dark:text-gray-100">Sample Card</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">This is how content will look</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Your selected theme and accent color are applied here.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Saved Message */}
          {showSavedMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-full shadow-md"
            >
              Settings saved!
            </motion.div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
