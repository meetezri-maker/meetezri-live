import { motion } from "motion/react";
import { 
  Eye,
  Volume2,
  Type,
  MousePointer,
  Subtitles,
  Contrast,
  ZoomIn,
  Hand,
  Focus,
  PlayCircle,
  ArrowLeft,
  CheckCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppLayout } from "@/app/components/AppLayout";

export function AccessibilitySettings() {
  const getDefaultSettings = () => ({
    fontSize: "medium",
    textSpacing: "normal",
    highContrast: false,
    reducedMotion: false,
    screenReader: false,
    closedCaptions: true,
    keyboardNav: true,
    focusIndicators: true,
    autoPlay: false,
    largeClickTargets: false
  });

  const [settings, setSettings] = useState(() => {
    const isBrowser =
      typeof window !== "undefined" && typeof window.localStorage !== "undefined";
    const saved = isBrowser
      ? window.localStorage.getItem("ezri_accessibility_settings")
      : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
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

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
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

  const fontSizes = [
    { value: "small", label: "Small", size: "text-sm" },
    { value: "medium", label: "Medium", size: "text-base" },
    { value: "large", label: "Large", size: "text-lg" },
    { value: "xlarge", label: "Extra Large", size: "text-xl" }
  ];

  const containerFontSize =
    settings.fontSize === "small"
      ? "text-sm"
      : settings.fontSize === "large"
      ? "text-lg"
      : settings.fontSize === "xlarge"
      ? "text-xl"
      : "text-base";

  const containerTextSpacing =
    settings.textSpacing === "compact"
      ? "leading-tight"
      : settings.textSpacing === "relaxed"
      ? "leading-relaxed"
      : settings.textSpacing === "loose"
      ? "leading-loose"
      : "";

  return (
    <AppLayout>
      <div className={`min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300 ${containerFontSize} ${containerTextSpacing}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Link 
              to="/app/settings" 
              className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200 mb-6 transition-colors font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Settings
            </Link>

            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Accessibility</h1>
                <p className="text-gray-600 dark:text-slate-400">Customize for your needs</p>
              </div>
            </div>
          </motion.div>

          {/* Text & Display */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-slate-800 mb-6"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Text & Display</h2>

            {/* Font Size */}
            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">
                <Type className="w-4 h-4" />
                Font Size
              </label>
              <div className="grid grid-cols-4 gap-2">
                {fontSizes.map((size) => (
                  <motion.button
                    key={size.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSettings({...settings, fontSize: size.value})}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      settings.fontSize === size.value
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-300"
                        : "border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600 text-gray-900 dark:text-slate-300"
                    }`}
                  >
                    <span className={size.size + " font-medium"}>Aa</span>
                    <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">{size.label}</p>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Text Spacing */}
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">
                <ZoomIn className="w-4 h-4" />
                Text Spacing
              </label>
              <select
                value={settings.textSpacing}
                onChange={(e) => setSettings({...settings, textSpacing: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
              >
                <option value="compact">Compact</option>
                <option value="normal">Normal</option>
                <option value="relaxed">Relaxed</option>
                <option value="loose">Loose</option>
              </select>
            </div>

            {/* High Contrast */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
              <div className="flex items-center gap-3">
                <Contrast className="w-5 h-5 text-gray-600 dark:text-slate-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">High Contrast Mode</p>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Increase color contrast</p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleSetting("highContrast")}
                className={`w-14 h-8 rounded-full transition-colors ${
                  settings.highContrast ? "bg-gray-900 dark:bg-slate-600" : "bg-gray-300 dark:bg-slate-700"
                }`}
              >
                <motion.div
                  animate={{ x: settings.highContrast ? 24 : 2 }}
                  className="w-6 h-6 bg-white rounded-full shadow-md"
                />
              </motion.button>
            </div>
          </motion.div>

          {/* Motion & Animation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-slate-800 mb-6"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Motion & Animation</h2>

            <div className="space-y-4">
              {/* Reduced Motion */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <PlayCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Reduce Motion</p>
                    <p className="text-sm text-gray-600 dark:text-slate-400">Minimize animations and transitions</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleSetting("reducedMotion")}
                  className={`w-14 h-8 rounded-full transition-colors ${
                    settings.reducedMotion ? "bg-purple-500" : "bg-gray-300 dark:bg-slate-700"
                  }`}
                >
                  <motion.div
                    animate={{ x: settings.reducedMotion ? 24 : 2 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </motion.button>
              </div>

              {/* Auto-play */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Auto-play Media</p>
                    <p className="text-sm text-gray-600 dark:text-slate-400">Automatically play videos and audio</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleSetting("autoPlay")}
                  className={`w-14 h-8 rounded-full transition-colors ${
                    settings.autoPlay ? "bg-blue-500" : "bg-gray-300 dark:bg-slate-700"
                  }`}
                >
                  <motion.div
                    animate={{ x: settings.autoPlay ? 24 : 2 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Assistive Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-slate-800 mb-6"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Assistive Features</h2>

            <div className="space-y-4">
              {/* Screen Reader */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Screen Reader Support</p>
                    <p className="text-sm text-gray-600 dark:text-slate-400">Optimize for screen readers</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleSetting("screenReader")}
                  className={`w-14 h-8 rounded-full transition-colors ${
                    settings.screenReader ? "bg-blue-500" : "bg-gray-300 dark:bg-slate-700"
                  }`}
                >
                  <motion.div
                    animate={{ x: settings.screenReader ? 24 : 2 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </motion.button>
              </div>

              {/* Closed Captions */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <Subtitles className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Closed Captions</p>
                    <p className="text-sm text-gray-600 dark:text-slate-400">Show captions for video content</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleSetting("closedCaptions")}
                  className={`w-14 h-8 rounded-full transition-colors ${
                    settings.closedCaptions ? "bg-green-500" : "bg-gray-300 dark:bg-slate-700"
                  }`}
                >
                  <motion.div
                    animate={{ x: settings.closedCaptions ? 24 : 2 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </motion.button>
              </div>

              {/* Keyboard Navigation */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <MousePointer className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Keyboard Navigation</p>
                    <p className="text-sm text-gray-600 dark:text-slate-400">Navigate using keyboard only</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleSetting("keyboardNav")}
                  className={`w-14 h-8 rounded-full transition-colors ${
                    settings.keyboardNav ? "bg-purple-500" : "bg-gray-300 dark:bg-slate-700"
                  }`}
                >
                  <motion.div
                    animate={{ x: settings.keyboardNav ? 24 : 2 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </motion.button>
              </div>

              {/* Focus Indicators */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <Focus className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Enhanced Focus Indicators</p>
                    <p className="text-sm text-gray-600 dark:text-slate-400">Highlight focused elements clearly</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleSetting("focusIndicators")}
                  className={`w-14 h-8 rounded-full transition-colors ${
                    settings.focusIndicators ? "bg-yellow-500" : "bg-gray-300 dark:bg-slate-700"
                  }`}
                >
                  <motion.div
                    animate={{ x: settings.focusIndicators ? 24 : 2 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </motion.button>
              </div>

              {/* Large Click Targets */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <Hand className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Large Click Targets</p>
                    <p className="text-sm text-gray-600 dark:text-slate-400">Increase button and link sizes</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleSetting("largeClickTargets")}
                  className={`w-14 h-8 rounded-full transition-colors ${
                    settings.largeClickTargets ? "bg-orange-500" : "bg-gray-300 dark:bg-slate-700"
                  }`}
                >
                  <motion.div
                    animate={{ x: settings.largeClickTargets ? 24 : 2 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Accessibility Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-800 rounded-2xl p-6"
          >
            <div className="flex items-start gap-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-green-900 dark:text-green-100 mb-2">WCAG 2.1 AA Compliant</h3>
                <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                  Ezri is designed to meet Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards. 
                  We're committed to making mental health support accessible to everyone.
                </p>
                <button className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium underline">
                  Learn more about our accessibility commitment
                </button>
              </div>
            </div>
          </motion.div>

          {showSavedMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-full shadow-md"
            >
              Accessibility settings saved
            </motion.div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
