import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Palette,
  Upload,
  Image as ImageIcon,
  Type,
  Mail,
  Smartphone,
  Globe,
  Eye,
  Save,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Trash2,
  Edit,
} from "lucide-react";
import { useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";

export function BrandingCustomization() {
  const [hasChanges, setHasChanges] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

  const [branding, setBranding] = useState({
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
  });

  // File upload handlers
  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBranding({ ...branding, logoUrl: reader.result as string });
        setHasChanges(true);
        alert(
          `✅ Logo uploaded successfully!\n\nFile: ${file.name}\nSize: ${(file.size / 1024).toFixed(
            2
          )} KB`
        );
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFaviconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBranding({ ...branding, faviconUrl: reader.result as string });
        setHasChanges(true);
        alert(
          `✅ Favicon uploaded successfully!\n\nFile: ${file.name}\nSize: ${(file.size / 1024).toFixed(
            2
          )} KB`
        );
      };
      reader.readAsDataURL(file);
    }
  };

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

  const stats = [
    {
      label: "Brand Assets",
      value: "8",
      icon: ImageIcon,
      color: "from-purple-500 to-pink-600",
    },
    {
      label: "Color Themes",
      value: "6",
      icon: Palette,
      color: "from-blue-500 to-cyan-600",
    },
    {
      label: "Email Templates",
      value: "12",
      icon: Mail,
      color: "from-green-500 to-emerald-600",
    },
    {
      label: "Customization",
      value: "95%",
      icon: Sparkles,
      color: "from-orange-500 to-amber-600",
    },
  ];

  const handleSave = () => {
    console.log("Saving branding:", { branding, emailTemplates, whiteLabelSettings });
    setHasChanges(false);
  };

  const handleReset = () => {
    setBranding({
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
    });
    setHasChanges(false);
  };

  const applyColorPreset = (preset: typeof colorPresets[0]) => {
    setBranding({
      ...branding,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
    });
    setHasChanges(true);
  };

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
              Customize logos, colors, and white-label settings
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleReset}
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
              disabled={!hasChanges}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button
              onClick={handleSave}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
              disabled={!hasChanges}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </motion.div>

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
                  <p className="text-sm text-gray-600">Upload brand assets</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Logo Upload */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Primary Logo
                  </label>
                  <div
                    onClick={() => document.getElementById("logo-upload")?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-500 transition-all cursor-pointer bg-gray-50 group"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3 group-hover:text-purple-500" />
                    <p className="text-sm text-gray-900 font-medium mb-1">
                      Click to upload logo
                    </p>
                    <p className="text-xs text-gray-600">
                      SVG, PNG, or JPG (max. 2MB)
                    </p>
                  </div>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/svg+xml, image/png, image/jpeg"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPreviewModal(true)}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </button>
                    <button
                      onClick={() => {
                        setSelectedAsset("logo");
                        setShowDeleteModal(true);
                      }}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Recommended: 512x512px transparent background
                  </p>
                </div>

                {/* Favicon Upload */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Favicon
                  </label>
                  <div
                    onClick={() => document.getElementById("favicon-upload")?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-500 transition-all cursor-pointer bg-gray-50 group"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3 group-hover:text-purple-500" />
                    <p className="text-sm text-gray-900 font-medium mb-1">
                      Click to upload favicon
                    </p>
                    <p className="text-xs text-gray-600">ICO or PNG (32x32px)</p>
                  </div>
                  <input
                    id="favicon-upload"
                    type="file"
                    accept="image/x-icon, image/png"
                    onChange={handleFaviconUpload}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPreviewModal(true)}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </button>
                    <button
                      onClick={() => {
                        setSelectedAsset("favicon");
                        setShowDeleteModal(true);
                      }}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Recommended: 32x32px or 64x64px
                  </p>
                </div>
              </div>

              {/* App Name & Tagline */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Application Name
                  </label>
                  <input
                    type="text"
                    value={branding.appName}
                    onChange={(e) => {
                      setBranding({ ...branding, appName: e.target.value });
                      setHasChanges(true);
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tagline
                  </label>
                  <input
                    type="text"
                    value={branding.tagline}
                    onChange={(e) => {
                      setBranding({ ...branding, tagline: e.target.value });
                      setHasChanges(true);
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Preview */}
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

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-4 mx-auto">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                  {branding.appName}
                </h3>
                <p className="text-sm text-gray-600 text-center">
                  {branding.tagline}
                </p>
              </div>

              <div className="space-y-2">
                <div
                  className="h-12 rounded-lg flex items-center justify-center text-white font-medium"
                  style={{
                    background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})`,
                  }}
                >
                  Primary Button
                </div>
                <div
                  className="h-10 rounded-lg border-2 flex items-center justify-center font-medium"
                  style={{
                    borderColor: branding.primaryColor,
                    color: branding.primaryColor,
                  }}
                >
                  Secondary Button
                </div>
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
                <p className="text-sm text-gray-600">Brand colors and theming</p>
              </div>
            </div>

            {/* Color Presets */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Quick Presets
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => applyColorPreset(preset)}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all text-left group"
                  >
                    <div className="flex gap-2 mb-2">
                      <div
                        className="w-8 h-8 rounded-lg"
                        style={{ backgroundColor: preset.primary }}
                      />
                      <div
                        className="w-8 h-8 rounded-lg"
                        style={{ backgroundColor: preset.secondary }}
                      />
                    </div>
                    <p className="text-xs text-gray-900 font-medium group-hover:text-purple-600">
                      {preset.name}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Color Pickers */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { key: "primaryColor", label: "Primary" },
                { key: "secondaryColor", label: "Secondary" },
                { key: "accentColor", label: "Accent" },
                { key: "successColor", label: "Success" },
                { key: "warningColor", label: "Warning" },
                { key: "errorColor", label: "Error" },
              ].map((color) => (
                <div key={color.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {color.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={branding[color.key as keyof typeof branding] as string}
                      onChange={(e) => {
                        setBranding({ ...branding, [color.key]: e.target.value });
                        setHasChanges(true);
                      }}
                      className="w-12 h-12 rounded-lg cursor-pointer bg-transparent border border-gray-300"
                    />
                    <input
                      type="text"
                      value={branding[color.key as keyof typeof branding] as string}
                      onChange={(e) => {
                        setBranding({ ...branding, [color.key]: e.target.value });
                        setHasChanges(true);
                      }}
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
                  { key: "headerFont", label: "Header Font" },
                  { key: "bodyFont", label: "Body Font" },
                ].map((font) => (
                  <div key={font.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {font.label}
                    </label>
                    <select
                      value={branding[font.key as keyof typeof branding] as string}
                      onChange={(e) => {
                        setBranding({ ...branding, [font.key]: e.target.value });
                        setHasChanges(true);
                      }}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {fontOptions.map((fontOption) => (
                        <option key={fontOption} value={fontOption}>
                          {fontOption}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                <p
                  className="text-2xl font-bold text-gray-900 mb-2"
                  style={{ fontFamily: branding.headerFont }}
                >
                  Header Preview
                </p>
                <p
                  className="text-sm text-gray-700"
                  style={{ fontFamily: branding.bodyFont }}
                >
                  This is how your body text will appear throughout the application.
                  The quick brown fox jumps over the lazy dog.
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
                  { key: "welcomeEmail", label: "Welcome Email" },
                  { key: "passwordReset", label: "Password Reset" },
                  { key: "sessionReminder", label: "Session Reminder" },
                  { key: "weeklyDigest", label: "Weekly Digest" },
                ].map((template) => (
                  <div
                    key={template.key}
                    className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl"
                  >
                    <p className="text-gray-900 font-medium">{template.label}</p>
                    <button
                      onClick={() => {
                        setEmailTemplates({
                          ...emailTemplates,
                          [template.key]: !emailTemplates[
                            template.key as keyof typeof emailTemplates
                          ],
                        });
                        setHasChanges(true);
                      }}
                      className={`relative w-14 h-8 rounded-full transition-all ${
                        emailTemplates[template.key as keyof typeof emailTemplates]
                          ? "bg-gradient-to-r from-green-500 to-emerald-600"
                          : "bg-gray-300"
                      }`}
                    >
                      <motion.div
                        className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
                        animate={{
                          left: emailTemplates[
                            template.key as keyof typeof emailTemplates
                          ]
                            ? 30
                            : 4,
                        }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Footer
                </label>
                <textarea
                  value={emailTemplates.customFooter}
                  onChange={(e) => {
                    setEmailTemplates({
                      ...emailTemplates,
                      customFooter: e.target.value,
                    });
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
                <h3 className="text-xl font-bold text-gray-900">
                  White Label Settings
                </h3>
                <p className="text-sm text-gray-600">
                  Custom domain and branding removal
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Domain
                  </label>
                  <input
                    type="text"
                    value={whiteLabelSettings.customDomain}
                    onChange={(e) => {
                      setWhiteLabelSettings({
                        ...whiteLabelSettings,
                        customDomain: e.target.value,
                      });
                      setHasChanges(true);
                    }}
                    placeholder="app.yourdomain.com"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Support Email
                  </label>
                  <input
                    type="email"
                    value={whiteLabelSettings.customSupportEmail}
                    onChange={(e) => {
                      setWhiteLabelSettings({
                        ...whiteLabelSettings,
                        customSupportEmail: e.target.value,
                      });
                      setHasChanges(true);
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Privacy Policy URL
                  </label>
                  <input
                    type="url"
                    value={whiteLabelSettings.customPrivacyUrl}
                    onChange={(e) => {
                      setWhiteLabelSettings({
                        ...whiteLabelSettings,
                        customPrivacyUrl: e.target.value,
                      });
                      setHasChanges(true);
                    }}
                    placeholder="https://yourdomain.com/privacy"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Terms of Service URL
                  </label>
                  <input
                    type="url"
                    value={whiteLabelSettings.customTermsUrl}
                    onChange={(e) => {
                      setWhiteLabelSettings({
                        ...whiteLabelSettings,
                        customTermsUrl: e.target.value,
                      });
                      setHasChanges(true);
                    }}
                    placeholder="https://yourdomain.com/terms"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-xl">
              <div>
                <p className="text-gray-900 font-medium mb-1">
                  Remove Ezri Branding
                </p>
                <p className="text-sm text-gray-600">
                  Hide "Powered by Ezri" from application
                </p>
              </div>
              <button
                onClick={() => {
                  setWhiteLabelSettings({
                    ...whiteLabelSettings,
                    removeEzriBranding: !whiteLabelSettings.removeEzriBranding,
                  });
                  setHasChanges(true);
                }}
                className={`relative w-14 h-8 rounded-full transition-all ${
                  whiteLabelSettings.removeEzriBranding
                    ? "bg-gradient-to-r from-green-500 to-emerald-600"
                    : "bg-gray-300"
                }`}
              >
                <motion.div
                  className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
                  animate={{
                    left: whiteLabelSettings.removeEzriBranding ? 30 : 4,
                  }}
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
              className="bg-white rounded-2xl p-6 max-w-2xl w-full"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Asset Preview</h3>
              
              <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-12 flex items-center justify-center min-h-[300px]">
                <div className="text-center">
                  <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                    <ImageIcon className="w-16 h-16 text-white" />
                  </div>
                  <p className="text-gray-600">Preview placeholder</p>
                  <p className="text-sm text-gray-500 mt-2">Upload an asset to see preview</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowPreviewModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Delete Modal */}
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
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Delete Asset</h3>
              
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete the <strong>{selectedAsset}</strong> asset? This action cannot be undone.
              </p>

              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                >
                  Cancel
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium"
                >
                  Delete
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AdminLayoutNew>
  );
}