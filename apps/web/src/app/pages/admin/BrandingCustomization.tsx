import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Palette,
  Upload,
  Image as ImageIcon,
  Type,
  Mail,
  Globe,
  Eye,
  Save,
  RotateCcw,
  Sparkles,
  Trash2,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { FluentEmoji } from "@/components/ui/FluentEmoji";

const BRANDING_LS_KEY = "ezri_branding";

interface BrandingState {
  appName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  successColor: string;
  warningColor: string;
  errorColor: string;
  fontFamily: string;
  headerFont: string;
  bodyFont: string;
}

const DEFAULT_BRANDING: BrandingState = {
  appName: "Ezri Mental Health",
  tagline: "Your journey to wellness starts here",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "#8b5cf6",
  secondaryColor: "#ec4899",
  accentColor: "#3b82f6",
  successColor: "#10b981",
  warningColor: "#f59e0b",
  errorColor: "#ef4444",
  fontFamily: "Inter",
  headerFont: "Inter",
  bodyFont: "Inter",
};

/** Apply branding to the live DOM and persist to localStorage so other components react. */
function applyBrandingToDOM(b: BrandingState) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // Brand colors → CSS custom properties
  root.style.setProperty("--primary", b.primaryColor);
  root.style.setProperty("--ring", b.primaryColor);
  root.style.setProperty("--accent", b.accentColor);

  // Document title
  if (b.appName) document.title = b.appName;

  // Favicon
  if (b.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = b.faviconUrl;
  }

  // Body font (only override if non-default)
  if (b.bodyFont && b.bodyFont !== "Inter") {
    root.style.setProperty("--font-family-body", `"${b.bodyFont}", sans-serif`);
    document.body.style.fontFamily = `"${b.bodyFont}", sans-serif`;
  }

  // Persist to localStorage so BrandLogo + App.tsx can read on reload
  try {
    const stored = JSON.parse(localStorage.getItem(BRANDING_LS_KEY) || "{}") as Record<string, unknown>;
    stored.branding = b;
    localStorage.setItem(BRANDING_LS_KEY, JSON.stringify(stored));
  } catch {
    // ignore storage errors
  }

  // Notify other components (e.g., BrandLogo) listening for updates
  window.dispatchEvent(new Event("ezri-branding-updated"));
}

export function BrandingCustomization() {
  const [hasChanges, setHasChanges] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<"logo" | "favicon">("logo");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<"logo" | "favicon" | null>(null);
  const [saving, setSaving] = useState(false);

  const [branding, setBranding] = useState<BrandingState>(DEFAULT_BRANDING);

  const [emailTemplates, setEmailTemplates] = useState({
    welcomeEmail: true,
    passwordReset: true,
    sessionReminder: true,
    weeklyDigest: true,
    customFooter: "© 2024 Ezri Mental Health. All rights reserved.",
  });

  const [whiteLabelSettings, setWhiteLabelSettings] = useState({
    removeEzriBranding: false,
    customDomain: "",
    customSupportEmail: "support@ezri.app",
    customPrivacyUrl: "",
    customTermsUrl: "",
  });

  const colorPresets = [
    { name: "Purple Dream", primary: "#8b5cf6", secondary: "#ec4899" },
    { name: "Ocean Blue", primary: "#3b82f6", secondary: "#06b6d4" },
    { name: "Forest Green", primary: "#10b981", secondary: "#14b8a6" },
    { name: "Sunset Orange", primary: "#f59e0b", secondary: "#f97316" },
    { name: "Royal Purple", primary: "#7c3aed", secondary: "#a855f7" },
    { name: "Rose Pink", primary: "#ec4899", secondary: "#f472b6" },
  ];

  const fontOptions = [
    "Inter",
    "Roboto",
    "Open Sans",
    "Lato",
    "Montserrat",
    "Poppins",
    "Raleway",
    "Source Sans Pro",
  ];

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadBranding = useCallback(async () => {
    try {
      const data = (await api.getBrandingConfig()) as Record<string, unknown> | null;
      if (!data || Object.keys(data).length === 0) return;
      let loadedBranding = branding;
      if (data.branding && typeof data.branding === "object") {
        loadedBranding = { ...DEFAULT_BRANDING, ...(data.branding as BrandingState) };
        setBranding(loadedBranding);
      }
      if (data.emailTemplates && typeof data.emailTemplates === "object") {
        setEmailTemplates((prev) => ({ ...prev, ...(data.emailTemplates as typeof emailTemplates) }));
      }
      if (data.whiteLabelSettings && typeof data.whiteLabelSettings === "object") {
        setWhiteLabelSettings((prev) => ({ ...prev, ...(data.whiteLabelSettings as typeof whiteLabelSettings) }));
      }
      // Apply loaded branding to DOM immediately
      applyBrandingToDOM(loadedBranding);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load branding");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadBranding();
  }, [loadBranding]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const updateBranding = (patch: Partial<BrandingState>) => {
    setBranding((prev) => {
      const next = { ...prev, ...patch };
      applyBrandingToDOM(next);
      return next;
    });
    setHasChanges(true);
  };

  // ── File uploads ──────────────────────────────────────────────────────────

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2 MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      updateBranding({ logoUrl: reader.result as string });
      toast.success(`Logo uploaded — ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    };
    reader.readAsDataURL(file);
  };

  const handleFaviconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      updateBranding({ faviconUrl: reader.result as string });
      toast.success(`Favicon uploaded — ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.saveBrandingConfig({ branding, emailTemplates, whiteLabelSettings });
      applyBrandingToDOM(branding);
      setHasChanges(false);
      toast.success("Branding saved and applied to the app");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save branding");
    } finally {
      setSaving(false);
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setBranding(DEFAULT_BRANDING);
    applyBrandingToDOM(DEFAULT_BRANDING);
    setHasChanges(false);
    toast.info("Branding reset to defaults");
  };

  // ── Color presets ─────────────────────────────────────────────────────────

  const applyColorPreset = (preset: (typeof colorPresets)[0]) => {
    updateBranding({ primaryColor: preset.primary, secondaryColor: preset.secondary });
  };

  // ── Delete asset ──────────────────────────────────────────────────────────

  const confirmDeleteAsset = () => {
    if (!selectedAsset) return;
    if (selectedAsset === "logo") updateBranding({ logoUrl: "" });
    else updateBranding({ faviconUrl: "" });
    setShowDeleteModal(false);
    setSelectedAsset(null);
    toast.success(`${selectedAsset === "logo" ? "Logo" : "Favicon"} removed`);
  };

  // ── Stats (derived from real state) ──────────────────────────────────────

  const stats = [
    {
      label: "Brand Assets",
      value: [branding.logoUrl, branding.faviconUrl].filter(Boolean).length.toString(),
      icon: ImageIcon,
      color: "from-purple-500 to-pink-600",
    },
    {
      label: "Color Themes",
      value: colorPresets.length.toString(),
      icon: Palette,
      color: "from-blue-500 to-cyan-600",
    },
    {
      label: "Email Templates",
      value: Object.values(emailTemplates).filter((v) => v === true).length.toString(),
      icon: Mail,
      color: "from-green-500 to-emerald-600",
    },
    {
      label: "Font Options",
      value: fontOptions.length.toString(),
      icon: Type,
      color: "from-orange-500 to-amber-600",
    },
  ];

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Branding & Customization
            </h1>
            <p className="text-gray-600">
              Customize logos, colors, fonts, and white-label settings — changes apply across the entire app
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={handleReset}
              variant="outline"
              className="border-gray-300 text-gray-700"
              disabled={!hasChanges || saving}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </motion.div>

        {/* Live-apply banner */}
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-800">
          <span className="inline-flex items-center gap-1.5 flex-wrap">
            <FluentEmoji emoji="⚡" size={20} />
            <strong>Live preview:</strong>
            <span>
              Color, font, logo, and title changes apply to the app instantly as you make them. Click{" "}
              <strong>Save Changes</strong> to persist across sessions.
            </span>
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-white border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}
                  >
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Logo & Assets */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card className="bg-white border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Logo & Assets</h3>
                  <p className="text-sm text-gray-600">Upload brand assets — they replace the default logo across the app</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Logo Upload */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Primary Logo
                  </label>

                  {branding.logoUrl ? (
                    <div className="border-2 border-purple-300 rounded-xl p-4 bg-purple-50 flex flex-col items-center gap-3">
                      <img
                        src={branding.logoUrl}
                        alt="Logo preview"
                        className="max-h-24 max-w-full object-contain"
                      />
                      <p className="text-xs text-purple-700 font-medium">Logo uploaded ✓</p>
                    </div>
                  ) : (
                    <div
                      onClick={() => document.getElementById("logo-upload")?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-500 transition-all cursor-pointer bg-gray-50 group"
                    >
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3 group-hover:text-purple-500" />
                      <p className="text-sm text-gray-900 font-medium mb-1">Click to upload logo</p>
                      <p className="text-xs text-gray-600">SVG, PNG, or JPG (max 2 MB)</p>
                    </div>
                  )}

                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/svg+xml, image/png, image/jpeg"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => document.getElementById("logo-upload")?.click()}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      {branding.logoUrl ? "Replace" : "Upload"}
                    </button>
                    {branding.logoUrl && (
                      <>
                        <button
                          onClick={() => { setPreviewAsset("logo"); setShowPreviewModal(true); }}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </button>
                        <button
                          onClick={() => { setSelectedAsset("logo"); setShowDeleteModal(true); }}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Recommended: 512×512px, transparent background</p>
                </div>

                {/* Favicon Upload */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Favicon</label>

                  {branding.faviconUrl ? (
                    <div className="border-2 border-purple-300 rounded-xl p-4 bg-purple-50 flex flex-col items-center gap-3">
                      <img
                        src={branding.faviconUrl}
                        alt="Favicon preview"
                        className="w-16 h-16 object-contain"
                      />
                      <p className="text-xs text-purple-700 font-medium">Favicon uploaded ✓</p>
                    </div>
                  ) : (
                    <div
                      onClick={() => document.getElementById("favicon-upload")?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-500 transition-all cursor-pointer bg-gray-50 group"
                    >
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3 group-hover:text-purple-500" />
                      <p className="text-sm text-gray-900 font-medium mb-1">Click to upload favicon</p>
                      <p className="text-xs text-gray-600">ICO or PNG (32×32px)</p>
                    </div>
                  )}

                  <input
                    id="favicon-upload"
                    type="file"
                    accept="image/x-icon, image/png"
                    onChange={handleFaviconUpload}
                    className="hidden"
                  />

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => document.getElementById("favicon-upload")?.click()}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      {branding.faviconUrl ? "Replace" : "Upload"}
                    </button>
                    {branding.faviconUrl && (
                      <>
                        <button
                          onClick={() => { setPreviewAsset("favicon"); setShowPreviewModal(true); }}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </button>
                        <button
                          onClick={() => { setSelectedAsset("favicon"); setShowDeleteModal(true); }}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Recommended: 32×32px or 64×64px</p>
                </div>
              </div>

              {/* App Name & Tagline */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Application Name</label>
                  <input
                    type="text"
                    value={branding.appName}
                    onChange={(e) => updateBranding({ appName: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Updates the browser tab title instantly</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tagline</label>
                  <input
                    type="text"
                    value={branding.tagline}
                    onChange={(e) => updateBranding({ tagline: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Live Preview Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white border border-gray-200 p-6 sticky top-6">
              <div className="flex items-center gap-3 mb-6">
                <Eye className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-bold text-gray-900">Live Preview</h3>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-4 text-center">
                {branding.logoUrl ? (
                  <img
                    src={branding.logoUrl}
                    alt="Logo"
                    className="max-h-16 max-w-full mx-auto mb-4 object-contain"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-4 mx-auto"
                    style={{ background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})` }}>
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                )}
                <h3
                  className="text-xl font-bold text-gray-900 text-center mb-2"
                  style={{ fontFamily: branding.headerFont }}
                >
                  {branding.appName}
                </h3>
                <p
                  className="text-sm text-gray-600 text-center"
                  style={{ fontFamily: branding.bodyFont }}
                >
                  {branding.tagline}
                </p>
              </div>

              <div className="space-y-2">
                <div
                  className="h-12 rounded-lg flex items-center justify-center text-white font-medium"
                  style={{ background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})` }}
                >
                  Primary Button
                </div>
                <div
                  className="h-10 rounded-lg border-2 flex items-center justify-center font-medium"
                  style={{ borderColor: branding.primaryColor, color: branding.primaryColor }}
                >
                  Secondary Button
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Success", color: branding.successColor },
                  { label: "Warning", color: branding.warningColor },
                  { label: "Error", color: branding.errorColor },
                ].map((c) => (
                  <div key={c.label} className="text-center">
                    <div className="w-8 h-8 rounded-lg mx-auto mb-1" style={{ backgroundColor: c.color }} />
                    <p className="text-xs text-gray-600">{c.label}</p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Color Scheme */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-white border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                <Palette className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Color Scheme</h3>
                <p className="text-sm text-gray-600">Brand colors — primary updates immediately app-wide</p>
              </div>
            </div>

            {/* Color Presets */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Quick Presets</label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => applyColorPreset(preset)}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all text-left group"
                  >
                    <div className="flex gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: preset.primary }} />
                      <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: preset.secondary }} />
                    </div>
                    <p className="text-xs text-gray-900 font-medium group-hover:text-purple-600">{preset.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Color Pickers */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { key: "primaryColor" as const, label: "Primary" },
                { key: "secondaryColor" as const, label: "Secondary" },
                { key: "accentColor" as const, label: "Accent" },
                { key: "successColor" as const, label: "Success" },
                { key: "warningColor" as const, label: "Warning" },
                { key: "errorColor" as const, label: "Error" },
              ].map((color) => (
                <div key={color.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{color.label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={branding[color.key]}
                      onChange={(e) => updateBranding({ [color.key]: e.target.value })}
                      className="w-12 h-12 rounded-lg cursor-pointer bg-transparent border border-gray-300"
                    />
                    <input
                      type="text"
                      value={branding[color.key]}
                      onChange={(e) => updateBranding({ [color.key]: e.target.value })}
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Typography & Email Templates */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Typography */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <Type className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Typography</h3>
                  <p className="text-sm text-gray-600">Font selection</p>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { key: "headerFont" as const, label: "Header Font" },
                  { key: "bodyFont" as const, label: "Body Font" },
                ].map((font) => (
                  <div key={font.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{font.label}</label>
                    <select
                      value={branding[font.key]}
                      onChange={(e) => updateBranding({ [font.key]: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {fontOptions.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                <p className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: branding.headerFont }}>
                  Header Preview
                </p>
                <p className="text-sm text-gray-700" style={{ fontFamily: branding.bodyFont }}>
                  This is how body text appears throughout the application. The quick brown fox jumps over the lazy dog.
                </p>
              </div>
            </Card>
          </motion.div>

          {/* Email Templates */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Email Templates</h3>
                  <p className="text-sm text-gray-600">Branded email settings</p>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                {[
                  { key: "welcomeEmail" as const, label: "Welcome Email" },
                  { key: "passwordReset" as const, label: "Password Reset" },
                  { key: "sessionReminder" as const, label: "Session Reminder" },
                  { key: "weeklyDigest" as const, label: "Weekly Digest" },
                ].map((template) => (
                  <div
                    key={template.key}
                    className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  >
                    <p className="text-gray-900 font-medium">{template.label}</p>
                    <button
                      onClick={() => {
                        setEmailTemplates({ ...emailTemplates, [template.key]: !emailTemplates[template.key] });
                        setHasChanges(true);
                      }}
                      className={`relative w-14 h-8 rounded-full transition-all ${
                        emailTemplates[template.key]
                          ? "bg-gradient-to-r from-green-500 to-emerald-600"
                          : "bg-gray-300"
                      }`}
                    >
                      <motion.div
                        className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
                        animate={{ left: emailTemplates[template.key] ? 30 : 4 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Footer</label>
                <textarea
                  value={emailTemplates.customFooter}
                  onChange={(e) => {
                    setEmailTemplates({ ...emailTemplates, customFooter: e.target.value });
                    setHasChanges(true);
                  }}
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>
            </Card>
          </motion.div>
        </div>

        {/* White Label Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-white border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">White Label Settings</h3>
                <p className="text-sm text-gray-600">Custom domain and branding removal</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Custom Domain</label>
                  <input
                    type="text"
                    value={whiteLabelSettings.customDomain}
                    onChange={(e) => { setWhiteLabelSettings({ ...whiteLabelSettings, customDomain: e.target.value }); setHasChanges(true); }}
                    placeholder="app.yourdomain.com"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Support Email</label>
                  <input
                    type="email"
                    value={whiteLabelSettings.customSupportEmail}
                    onChange={(e) => { setWhiteLabelSettings({ ...whiteLabelSettings, customSupportEmail: e.target.value }); setHasChanges(true); }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Privacy Policy URL</label>
                  <input
                    type="url"
                    value={whiteLabelSettings.customPrivacyUrl}
                    onChange={(e) => { setWhiteLabelSettings({ ...whiteLabelSettings, customPrivacyUrl: e.target.value }); setHasChanges(true); }}
                    placeholder="https://yourdomain.com/privacy"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Terms of Service URL</label>
                  <input
                    type="url"
                    value={whiteLabelSettings.customTermsUrl}
                    onChange={(e) => { setWhiteLabelSettings({ ...whiteLabelSettings, customTermsUrl: e.target.value }); setHasChanges(true); }}
                    placeholder="https://yourdomain.com/terms"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-xl">
              <div>
                <p className="text-gray-900 font-medium mb-1">Remove Ezri Branding</p>
                <p className="text-sm text-gray-600">Hide "Powered by Ezri" from application</p>
              </div>
              <button
                onClick={() => { setWhiteLabelSettings({ ...whiteLabelSettings, removeEzriBranding: !whiteLabelSettings.removeEzriBranding }); setHasChanges(true); }}
                className={`relative w-14 h-8 rounded-full transition-all ${
                  whiteLabelSettings.removeEzriBranding
                    ? "bg-gradient-to-r from-green-500 to-emerald-600"
                    : "bg-gray-300"
                }`}
              >
                <motion.div
                  className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
                  animate={{ left: whiteLabelSettings.removeEzriBranding ? 30 : 4 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          </Card>
        </motion.div>

        {/* Preview Modal */}
        {showPreviewModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPreviewModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-lg w-full"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {previewAsset === "logo" ? "Logo" : "Favicon"} Preview
              </h3>

              <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-12 flex items-center justify-center min-h-[200px]">
                {(previewAsset === "logo" ? branding.logoUrl : branding.faviconUrl) ? (
                  <img
                    src={previewAsset === "logo" ? branding.logoUrl : branding.faviconUrl}
                    alt={previewAsset}
                    className="max-h-40 max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center text-gray-500">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No {previewAsset} uploaded yet</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Delete / Remove Modal */}
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Remove Asset</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to remove the <strong>{selectedAsset}</strong>? The default Ezri logo will be used instead.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteAsset}
                  className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium"
                >
                  Remove
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AdminLayoutNew>
  );
}
