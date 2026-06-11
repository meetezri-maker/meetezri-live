import { motion, AnimatePresence } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
import {
  Settings,
  Mail,
  Bell,
  Shield,
  Database,
  Lock,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Cloud,
  Code,
  Palette,
  Loader2,
  Key,
  Copy,
  X,
  ExternalLink,
  Zap,
} from "lucide-react";

const SETTINGS_KEY = "admin.system_settings_enhanced";
const ADMIN_APPEARANCE_LS_KEY = "ezri_admin_appearance";

function applyAppearanceToDom(appearance: SystemSettingsEnhancedState["appearance"]) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // Theme — explicit data-theme for admin light/dark material system
  if (appearance.defaultTheme === "Dark") {
    root.classList.add("dark");
    root.setAttribute("data-theme", "dark");
    root.setAttribute("data-ezri-theme", "dark");
    root.style.colorScheme = "dark";
  } else if (appearance.defaultTheme === "System") {
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
    const resolved = prefersDark ? "dark" : "light";
    root.setAttribute("data-theme", resolved);
    root.setAttribute("data-ezri-theme", resolved);
    root.style.colorScheme = resolved;
  } else {
    root.classList.remove("dark");
    root.setAttribute("data-theme", "light");
    root.setAttribute("data-ezri-theme", "light");
    root.style.colorScheme = "light";
  }

  // Primary & accent color apply everywhere (admin + user app)
  root.style.setProperty("--primary", appearance.primaryColor);
  root.style.setProperty("--ring", appearance.primaryColor);
  root.style.setProperty("--accent", appearance.accentColor);

  // Reduced motion applies everywhere
  root.classList.toggle("reduced-motion", appearance.reducedMotion);

  // Persist so App.tsx startup effect picks them up on reload
  try {
    localStorage.setItem(ADMIN_APPEARANCE_LS_KEY, JSON.stringify(appearance));
  } catch {
    // ignore storage errors
  }
}

export type SystemSettingsEnhancedState = {
  general: {
    platformName: string;
    supportEmail: string;
    companyWebsite: string;
    timezone: string;
    language: string;
    sessionDuration: string;
    maxConcurrentSessions: number;
    allowAnonymousSessions: boolean;
  };
  email: {
    smtpHost: string;
    smtpPort: number;
    encryption: string;
    smtpUser: string;
    smtpPassword: string;
    fromEmail: string;
    fromName: string;
  };
  notifications: {
    emailNotif: boolean;
    pushNotif: boolean;
    smsNotif: boolean;
    crisisAlerts: boolean;
  };
  security: {
    twoFactor: boolean;
    passwordPolicy: string;
    sessionTimeout: number;
    maxLoginAttempts: number;
    ipWhitelisting: boolean;
    databaseEncryption: boolean;
  };
  database: {
    dbHost: string;
    dbPort: number;
    dbName: string;
    autoBackup: boolean;
    backupSchedule: string;
    retentionPeriod: string;
  };
  api: {
    apiBaseUrl: string;
    masterApiKey: string;
    rateLimit: number;
    apiVersion: string;
  };
  storage: {
    storageProvider: string;
    maxFileMb: number;
    allowedTypes: string;
  };
  appearance: {
    defaultTheme: string;
    primaryColor: string;
    accentColor: string;
    reducedMotion: boolean;
  };
};

const DEFAULT_SETTINGS: SystemSettingsEnhancedState = {
  general: {
    platformName: "Ezri Health",
    supportEmail: "support@ezri.health",
    companyWebsite: "https://ezri.health",
    timezone: "UTC",
    language: "English (US)",
    sessionDuration: "30 minutes",
    maxConcurrentSessions: 100,
    allowAnonymousSessions: false,
  },
  email: {
    smtpHost: "smtp.sendgrid.net",
    smtpPort: 587,
    encryption: "TLS",
    smtpUser: "apikey",
    smtpPassword: "",
    fromEmail: "noreply@ezri.health",
    fromName: "Ezri Health",
  },
  notifications: {
    emailNotif: true,
    pushNotif: true,
    smsNotif: false,
    crisisAlerts: true,
  },
  security: {
    twoFactor: true,
    passwordPolicy: "Strong (12+ chars, mixed case, numbers, symbols)",
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    ipWhitelisting: false,
    databaseEncryption: true,
  },
  database: {
    dbHost: "localhost",
    dbPort: 5432,
    dbName: "ezri_production",
    autoBackup: true,
    backupSchedule: "Daily at 2:00 AM",
    retentionPeriod: "30 days",
  },
  api: {
    apiBaseUrl: "https://api.ezri.health/v1",
    masterApiKey: "",
    rateLimit: 100,
    apiVersion: "v1 (Current)",
  },
  storage: {
    storageProvider: "AWS S3",
    maxFileMb: 50,
    allowedTypes: "jpg, png, pdf, mp4, mp3",
  },
  appearance: {
    defaultTheme: "Light",
    primaryColor: "#3B82F6",
    accentColor: "#8B5CF6",
    reducedMotion: false,
  },
};

function mergeLoaded(
  base: SystemSettingsEnhancedState,
  raw: unknown
): SystemSettingsEnhancedState {
  if (!raw || typeof raw !== "object") return base;
  const p = raw as Record<string, unknown>;
  const pick = <K extends keyof SystemSettingsEnhancedState>(k: K) =>
    p[k] && typeof p[k] === "object" ? (p[k] as Record<string, unknown>) : {};

  return {
    general: { ...base.general, ...pick("general") } as SystemSettingsEnhancedState["general"],
    email: { ...base.email, ...pick("email") } as SystemSettingsEnhancedState["email"],
    notifications: {
      ...base.notifications,
      ...pick("notifications"),
    } as SystemSettingsEnhancedState["notifications"],
    security: { ...base.security, ...pick("security") } as SystemSettingsEnhancedState["security"],
    database: { ...base.database, ...pick("database") } as SystemSettingsEnhancedState["database"],
    api: { ...base.api, ...pick("api") } as SystemSettingsEnhancedState["api"],
    storage: { ...base.storage, ...pick("storage") } as SystemSettingsEnhancedState["storage"],
    appearance: {
      ...base.appearance,
      ...pick("appearance"),
    } as SystemSettingsEnhancedState["appearance"],
  };
}

function Toggle({
  checked,
  onChange,
  accentClass = "peer-checked:bg-blue-600",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  accentClass?: string;
}) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div
        className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${accentClass}`}
      />
    </label>
  );
}

export function SystemSettingsEnhanced() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string>("general");
  const [showApiKey, setShowApiKey] = useState(false);
  const [settings, setSettings] = useState<SystemSettingsEnhancedState>(DEFAULT_SETTINGS);
  const [baseline, setBaseline] = useState<SystemSettingsEnhancedState>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Backup
  const [backupLoading, setBackupLoading] = useState(false);

  // API Key generation modal
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyName, setApiKeyName] = useState("Admin Key");
  const [apiKeyEnv, setApiKeyEnv] = useState("production");
  const [apiKeyRateLimit, setApiKeyRateLimit] = useState("1000/hour");
  const [generatingApiKey, setGeneratingApiKey] = useState(false);
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);

  // Integration config modal
  const [intModal, setIntModal] = useState<{ name: string; field: string; label: string } | null>(null);
  const [intValue, setIntValue] = useState("");
  const [intLoading, setIntLoading] = useState(false);
  const [integrations, setIntegrations] = useState<Record<string, string>>({});

  const sections = [
    { id: "general", label: "General", icon: Settings },
    { id: "email", label: "Email", icon: Mail },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Shield },
    { id: "database", label: "Database", icon: Database },
    { id: "api", label: "API & Integrations", icon: Code },
    { id: "storage", label: "Storage", icon: Cloud },
    { id: "appearance", label: "Appearance", icon: Palette },
  ];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.getSettings();
        const rows = Array.isArray(data) ? data : [];
        const row = rows.find((r: { key?: string }) => r.key === SETTINGS_KEY);
        if (row?.value != null && cancelled === false) {
          const merged = mergeLoaded(DEFAULT_SETTINGS, row.value);
          setSettings(merged);
          setBaseline(merged);
          // Apply saved appearance immediately on load
          applyAppearanceToDom(merged.appearance);
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to load system settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const unsavedChanges = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(baseline),
    [settings, baseline]
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSetting(SETTINGS_KEY, settings, "System Settings (enhanced UI) persisted state");
      setBaseline(settings);
      // Persist appearance to localStorage and apply to DOM
      applyAppearanceToDom(settings.appearance);
      toast.success("Saved");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Load integrations config on mount
  useEffect(() => {
    api.getIntegrationsConfig().then((data: unknown) => {
      if (Array.isArray(data)) {
        const map: Record<string, string> = {};
        for (const item of data as { name?: string; apiKey?: string; key?: string }[]) {
          if (item.name) map[item.name] = item.apiKey ?? item.key ?? "";
        }
        setIntegrations(map);
      }
    }).catch(() => {});
  }, []);

  const handleCreateBackup = async () => {
    setBackupLoading(true);
    try {
      await api.admin.createBackupRecord({ kind: "full" });
      toast.success("Backup record created — check Backup & Recovery for details");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create backup");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleGenerateApiKey = async () => {
    if (!apiKeyName.trim()) { toast.error("Name is required"); return; }
    setGeneratingApiKey(true);
    try {
      const result = await api.createAdminApiKey({
        name: apiKeyName.trim(),
        environment: apiKeyEnv,
        rateLimit: apiKeyRateLimit,
      }) as { key?: string; apiKey?: string };
      const key = result?.key ?? result?.apiKey ?? "ezri_sk_generated";
      setGeneratedApiKey(key);
      setSettings((s) => ({ ...s, api: { ...s.api, masterApiKey: key } }));
      toast.success("API key generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate key");
    } finally {
      setGeneratingApiKey(false);
    }
  };

  const openIntModal = (name: string, field: string, label: string) => {
    setIntModal({ name, field, label });
    setIntValue(integrations[name] ?? "");
    setGeneratedApiKey(null);
  };

  const handleSaveIntegration = async () => {
    if (!intModal) return;
    setIntLoading(true);
    try {
      const existing = Object.entries(integrations)
        .filter(([k]) => k !== intModal.name)
        .map(([name, apiKey]) => ({ name, apiKey }));
      const updated = [...existing, { name: intModal.name, apiKey: intValue.trim() }];
      await api.saveIntegrationsConfig(updated);
      setIntegrations((prev) => ({ ...prev, [intModal.name]: intValue.trim() }));
      toast.success(`${intModal.name} configuration saved`);
      setIntModal(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save integration");
    } finally {
      setIntLoading(false);
    }
  };

  const setG = (patch: Partial<SystemSettingsEnhancedState["general"]>) =>
    setSettings((s) => ({ ...s, general: { ...s.general, ...patch } }));
  const setE = (patch: Partial<SystemSettingsEnhancedState["email"]>) =>
    setSettings((s) => ({ ...s, email: { ...s.email, ...patch } }));
  const setN = (patch: Partial<SystemSettingsEnhancedState["notifications"]>) =>
    setSettings((s) => ({ ...s, notifications: { ...s.notifications, ...patch } }));
  const setSec = (patch: Partial<SystemSettingsEnhancedState["security"]>) =>
    setSettings((s) => ({ ...s, security: { ...s.security, ...patch } }));
  const setDb = (patch: Partial<SystemSettingsEnhancedState["database"]>) =>
    setSettings((s) => ({ ...s, database: { ...s.database, ...patch } }));
  const setApi = (patch: Partial<SystemSettingsEnhancedState["api"]>) =>
    setSettings((s) => ({ ...s, api: { ...s.api, ...patch } }));
  const setSt = (patch: Partial<SystemSettingsEnhancedState["storage"]>) =>
    setSettings((s) => ({ ...s, storage: { ...s.storage, ...patch } }));
  const setAp = (patch: Partial<SystemSettingsEnhancedState["appearance"]>) =>
    setSettings((s) => {
      const next = { ...s, appearance: { ...s.appearance, ...patch } };
      // Apply immediately for live preview (not persisted until Save is clicked)
      applyAppearanceToDom(next.appearance);
      return next;
    });

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center shadow-lg">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">System Settings</h1>
                <p className="text-muted-foreground">
                  Configure platform-wide settings (stored in system settings)
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {confirmReset ? (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                  <span className="text-sm text-red-700 font-medium">Reset all settings?</span>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 bg-red-600 text-white rounded font-medium hover:bg-red-700"
                    onClick={() => { setSettings(DEFAULT_SETTINGS); setConfirmReset(false); toast.success("Settings reset to defaults (not yet saved)"); }}
                  >
                    Yes, reset
                  </button>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 bg-gray-200 rounded font-medium hover:bg-gray-300"
                    onClick={() => setConfirmReset(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={loading || saving}
                  onClick={() => setConfirmReset(true)}
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset All
                </Button>
              )}
              <Button
                type="button"
                className="gap-2"
                disabled={loading || saving || !unsavedChanges}
                onClick={() => void handleSave()}
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
          {unsavedChanges && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2"
            >
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <p className="text-sm text-yellow-700">You have unsaved changes</p>
            </motion.div>
          )}
        </motion.div>

        <div className="grid lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-4">
              <nav className="space-y-1">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        activeSection === section.id
                          ? "bg-primary text-white"
                          : "hover:bg-gray-100"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{section.label}</span>
                    </button>
                  );
                })}
              </nav>
            </Card>
          </motion.div>

          <div className="lg:col-span-3 space-y-6">
            {loading && (
              <p className="text-sm text-muted-foreground">Loading settings…</p>
            )}

            {activeSection === "general" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-6">General Settings</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Platform Name</label>
                      <Input
                        value={settings.general.platformName}
                        onChange={(e) => setG({ platformName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Support Email</label>
                      <Input
                        type="email"
                        value={settings.general.supportEmail}
                        onChange={(e) => setG({ supportEmail: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Company Website</label>
                      <Input
                        type="url"
                        value={settings.general.companyWebsite}
                        onChange={(e) => setG({ companyWebsite: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Default Timezone</label>
                        <select
                          className="w-full px-3 py-2 border rounded-lg"
                          value={settings.general.timezone}
                          onChange={(e) => setG({ timezone: e.target.value })}
                        >
                          <option>UTC</option>
                          <option>America/New_York</option>
                          <option>America/Los_Angeles</option>
                          <option>Europe/London</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Default Language</label>
                        <select
                          className="w-full px-3 py-2 border rounded-lg"
                          value={settings.general.language}
                          onChange={(e) => setG({ language: e.target.value })}
                        >
                          <option>English (US)</option>
                          <option>Spanish</option>
                          <option>French</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-bold text-lg mb-4">Session Configuration</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Default Session Duration</label>
                        <select
                          className="w-full px-3 py-2 border rounded-lg"
                          value={settings.general.sessionDuration}
                          onChange={(e) => setG({ sessionDuration: e.target.value })}
                        >
                          <option>30 minutes</option>
                          <option>45 minutes</option>
                          <option>60 minutes</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Max Concurrent Talk it out</label>
                        <Input
                          type="number"
                          value={settings.general.maxConcurrentSessions}
                          onChange={(e) =>
                            setG({ maxConcurrentSessions: parseInt(e.target.value, 10) || 0 })
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">Allow Anonymous Talk it out</p>
                        <p className="text-sm text-muted-foreground">
                          Users can chat without creating an account
                        </p>
                      </div>
                      <Toggle
                        checked={settings.general.allowAnonymousSessions}
                        onChange={(v) => setG({ allowAnonymousSessions: v })}
                      />
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {activeSection === "email" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-6">Email Configuration</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">SMTP Host</label>
                      <Input value={settings.email.smtpHost} onChange={(e) => setE({ smtpHost: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">SMTP Port</label>
                        <Input
                          type="number"
                          value={settings.email.smtpPort}
                          onChange={(e) => setE({ smtpPort: parseInt(e.target.value, 10) || 0 })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Encryption</label>
                        <select
                          className="w-full px-3 py-2 border rounded-lg"
                          value={settings.email.encryption}
                          onChange={(e) => setE({ encryption: e.target.value })}
                        >
                          <option>TLS</option>
                          <option>SSL</option>
                          <option>None</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">SMTP Username</label>
                      <Input
                        value={settings.email.smtpUser}
                        onChange={(e) => setE({ smtpUser: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">SMTP Password</label>
                      <div className="relative">
                        <Input
                          type={showApiKey ? "text" : "password"}
                          value={settings.email.smtpPassword}
                          placeholder="••••••••"
                          onChange={(e) => setE({ smtpPassword: e.target.value })}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                          onClick={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">From Email</label>
                      <Input
                        type="email"
                        value={settings.email.fromEmail}
                        onChange={(e) => setE({ fromEmail: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">From Name</label>
                      <Input
                        value={settings.email.fromName}
                        onChange={(e) => setE({ fromName: e.target.value })}
                      />
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-bold text-lg mb-4">Email Templates</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="font-medium">Welcome Email</p>
                          <p className="text-sm text-muted-foreground">Sent to new users after signup</p>
                        </div>
                      </div>
                      <Button type="button" variant="outline" size="sm" className="gap-1.5"
                        onClick={() => navigate("/admin/email-templates")}>
                        <ExternalLink className="w-3.5 h-3.5" />
                        Edit
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="font-medium">Password Reset</p>
                          <p className="text-sm text-muted-foreground">Password recovery email</p>
                        </div>
                      </div>
                      <Button type="button" variant="outline" size="sm" className="gap-1.5"
                        onClick={() => navigate("/admin/email-templates")}>
                        <ExternalLink className="w-3.5 h-3.5" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {activeSection === "notifications" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-6">Notification Settings</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">Email Notifications</p>
                        <p className="text-sm text-muted-foreground">Send email updates to users</p>
                      </div>
                      <Toggle
                        checked={settings.notifications.emailNotif}
                        onChange={(v) => setN({ emailNotif: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">Push Notifications</p>
                        <p className="text-sm text-muted-foreground">Send push notifications to mobile apps</p>
                      </div>
                      <Toggle
                        checked={settings.notifications.pushNotif}
                        onChange={(v) => setN({ pushNotif: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">SMS Notifications</p>
                        <p className="text-sm text-muted-foreground">Send text message alerts</p>
                      </div>
                      <Toggle
                        checked={settings.notifications.smsNotif}
                        onChange={(v) => setN({ smsNotif: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">Emergency alerts</p>
                        <p className="text-sm text-muted-foreground">Immediate alerts for emergency situations</p>
                      </div>
                      <Toggle
                        checked={settings.notifications.crisisAlerts}
                        onChange={(v) => setN({ crisisAlerts: v })}
                        accentClass="peer-checked:bg-red-600"
                      />
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {activeSection === "security" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-6">Security Settings</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">Two-Factor Authentication</p>
                        <p className="text-sm text-muted-foreground">Require 2FA for admin accounts</p>
                      </div>
                      <Toggle
                        checked={settings.security.twoFactor}
                        onChange={(v) => setSec({ twoFactor: v })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Password Policy</label>
                      <select
                        className="w-full px-3 py-2 border rounded-lg"
                        value={settings.security.passwordPolicy}
                        onChange={(e) => setSec({ passwordPolicy: e.target.value })}
                      >
                        <option>Strong (12+ chars, mixed case, numbers, symbols)</option>
                        <option>Medium (8+ chars, mixed case, numbers)</option>
                        <option>Basic (6+ chars)</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Session Timeout (minutes)</label>
                        <Input
                          type="number"
                          value={settings.security.sessionTimeout}
                          onChange={(e) =>
                            setSec({ sessionTimeout: parseInt(e.target.value, 10) || 0 })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Max Login Attempts</label>
                        <Input
                          type="number"
                          value={settings.security.maxLoginAttempts}
                          onChange={(e) =>
                            setSec({ maxLoginAttempts: parseInt(e.target.value, 10) || 0 })
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">IP Whitelisting</p>
                        <p className="text-sm text-muted-foreground">Restrict admin access to specific IPs</p>
                      </div>
                      <Toggle
                        checked={settings.security.ipWhitelisting}
                        onChange={(v) => setSec({ ipWhitelisting: v })}
                      />
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-bold text-lg mb-4">Encryption</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="font-medium text-green-900">SSL/TLS Enabled</p>
                          <p className="text-sm text-green-700">All traffic is encrypted</p>
                        </div>
                      </div>
                      <Lock className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">Database Encryption</p>
                        <p className="text-sm text-muted-foreground">Encrypt sensitive data at rest</p>
                      </div>
                      <Toggle
                        checked={settings.security.databaseEncryption}
                        onChange={(v) => setSec({ databaseEncryption: v })}
                      />
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {activeSection === "database" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-6">Database Configuration</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Database Host</label>
                      <Input
                        value={settings.database.dbHost}
                        onChange={(e) => setDb({ dbHost: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Port</label>
                        <Input
                          type="number"
                          value={settings.database.dbPort}
                          onChange={(e) => setDb({ dbPort: parseInt(e.target.value, 10) || 0 })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Database Name</label>
                        <Input
                          value={settings.database.dbName}
                          onChange={(e) => setDb({ dbName: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Database className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-blue-900 mb-1">Database Status</p>
                          <p className="text-sm text-blue-700">
                            Connected • PostgreSQL (values here are configuration; not live DB diagnostics)
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-bold text-lg mb-4">Backup Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">Automatic Backups</p>
                        <p className="text-sm text-muted-foreground">Daily automated backups</p>
                      </div>
                      <Toggle
                        checked={settings.database.autoBackup}
                        onChange={(v) => setDb({ autoBackup: v })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Backup Schedule</label>
                      <select
                        className="w-full px-3 py-2 border rounded-lg"
                        value={settings.database.backupSchedule}
                        onChange={(e) => setDb({ backupSchedule: e.target.value })}
                      >
                        <option>Daily at 2:00 AM</option>
                        <option>Every 12 hours</option>
                        <option>Every 6 hours</option>
                        <option>Weekly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Retention Period</label>
                      <select
                        className="w-full px-3 py-2 border rounded-lg"
                        value={settings.database.retentionPeriod}
                        onChange={(e) => setDb({ retentionPeriod: e.target.value })}
                      >
                        <option>30 days</option>
                        <option>60 days</option>
                        <option>90 days</option>
                        <option>1 year</option>
                      </select>
                    </div>
                    <Button
                      type="button"
                      className="w-full gap-2"
                      variant="secondary"
                      disabled={backupLoading}
                      onClick={() => void handleCreateBackup()}
                    >
                      {backupLoading
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Database className="w-4 h-4" />}
                      {backupLoading ? "Creating backup…" : "Create Backup Now"}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}

            {activeSection === "api" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-6">API Configuration</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">API Base URL</label>
                      <Input
                        value={settings.api.apiBaseUrl}
                        onChange={(e) => setApi({ apiBaseUrl: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Master API Key</label>
                      <div className="relative">
                        <Input
                          type={showApiKey ? "text" : "password"}
                          value={settings.api.masterApiKey}
                          placeholder="ezri_sk_…"
                          onChange={(e) => setApi({ masterApiKey: e.target.value })}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                          onClick={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Rate Limit (req/min)</label>
                        <Input
                          type="number"
                          value={settings.api.rateLimit}
                          onChange={(e) => setApi({ rateLimit: parseInt(e.target.value, 10) || 0 })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">API Version</label>
                        <select
                          className="w-full px-3 py-2 border rounded-lg"
                          value={settings.api.apiVersion}
                          onChange={(e) => setApi({ apiVersion: e.target.value })}
                        >
                          <option>v1 (Current)</option>
                          <option>v2 (Beta)</option>
                        </select>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => { setShowApiKeyModal(true); setGeneratedApiKey(null); setApiKeyName("Admin Key"); setApiKeyEnv("production"); setApiKeyRateLimit("1000/hour"); }}
                    >
                      <Key className="w-4 h-4" />
                      Generate New API Key
                    </Button>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-bold text-lg mb-4">Third-Party Integrations</h3>
                  <div className="space-y-3">
                    {[
                      { name: "OpenAI", field: "apiKey", label: "OpenAI API Key", desc: "AI-powered conversations", icon: "🤖" },
                      { name: "Twilio", field: "apiKey", label: "Twilio Account SID / Auth Token", desc: "SMS notifications", icon: "📱" },
                      { name: "Stripe", field: "apiKey", label: "Stripe Secret Key", desc: "Payment processing", icon: "💳" },
                    ].map((int) => (
                      <div key={int.name} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl inline-flex">
                            <FluentEmoji emoji={int.icon} size={28} />
                          </span>
                          <div>
                            <p className="font-medium">{int.name}</p>
                            <p className="text-sm text-muted-foreground">{int.desc}</p>
                          </div>
                          {integrations[int.name] && (
                            <span className="ml-1 flex items-center gap-1 text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                              <CheckCircle className="w-3 h-3" /> Configured
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => openIntModal(int.name, int.field, int.label)}
                        >
                          <Zap className="w-3.5 h-3.5" />
                          {integrations[int.name] ? "Update" : "Configure"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}

            {activeSection === "storage" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-6">Storage Configuration</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Storage Provider</label>
                      <select
                        className="w-full px-3 py-2 border rounded-lg"
                        value={settings.storage.storageProvider}
                        onChange={(e) => setSt({ storageProvider: e.target.value })}
                      >
                        <option>AWS S3</option>
                        <option>Google Cloud Storage</option>
                        <option>Azure Blob Storage</option>
                        <option>Local Storage</option>
                      </select>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Storage Usage</span>
                        <span className="text-sm text-muted-foreground">(illustrative)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: "45.6%" }} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Max File Size (MB)</label>
                      <Input
                        type="number"
                        value={settings.storage.maxFileMb}
                        onChange={(e) => setSt({ maxFileMb: parseInt(e.target.value, 10) || 0 })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Allowed File Types</label>
                      <Input
                        value={settings.storage.allowedTypes}
                        onChange={(e) => setSt({ allowedTypes: e.target.value })}
                      />
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {activeSection === "appearance" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">Appearance Settings</h2>
                    <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1 font-medium inline-flex items-center gap-1">
                      <FluentEmoji emoji="⚡" size={14} /> Colors apply instantly
                    </span>
                  </div>
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                    <strong>Note:</strong> Theme and brand colors apply to both the admin panel and the user-facing app. Save to persist across sessions.
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Default Theme</label>
                      <select
                        className="w-full px-3 py-2 border rounded-lg"
                        value={settings.appearance.defaultTheme}
                        onChange={(e) => setAp({ defaultTheme: e.target.value })}
                      >
                        <option>Light</option>
                        <option>Dark</option>
                        <option>System</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Primary Color</label>
                      <div className="flex gap-3">
                        <input
                          type="color"
                          value={settings.appearance.primaryColor}
                          onChange={(e) => setAp({ primaryColor: e.target.value })}
                          className="w-16 h-10 border rounded"
                        />
                        <Input
                          value={settings.appearance.primaryColor}
                          onChange={(e) => setAp({ primaryColor: e.target.value })}
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Accent Color</label>
                      <div className="flex gap-3">
                        <input
                          type="color"
                          value={settings.appearance.accentColor}
                          onChange={(e) => setAp({ accentColor: e.target.value })}
                          className="w-16 h-10 border rounded"
                        />
                        <Input
                          value={settings.appearance.accentColor}
                          onChange={(e) => setAp({ accentColor: e.target.value })}
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">Reduced Motion</p>
                        <p className="text-sm text-muted-foreground">Minimize animations for accessibility</p>
                      </div>
                      <Toggle
                        checked={settings.appearance.reducedMotion}
                        onChange={(v) => setAp({ reducedMotion: v })}
                      />
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Generate API Key Modal */}
      <AnimatePresence>
        {showApiKeyModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => { if (!generatingApiKey) setShowApiKeyModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Key className="w-5 h-5 text-blue-600" />
                  Generate API Key
                </h3>
                <button type="button" onClick={() => setShowApiKeyModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {generatedApiKey ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                    <p className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" /> Key generated — copy it now, it won't be shown again
                    </p>
                    <div className="flex items-center gap-2 bg-white border border-green-300 rounded-lg p-2">
                      <code className="flex-1 text-xs font-mono text-gray-800 break-all">{generatedApiKey}</code>
                      <button
                        type="button"
                        className="shrink-0 p-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded"
                        onClick={() => { navigator.clipboard.writeText(generatedApiKey); toast.success("Copied!"); }}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => setShowApiKeyModal(false)}>Done</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Key Name</label>
                    <Input value={apiKeyName} onChange={(e) => setApiKeyName(e.target.value)} placeholder="e.g. Admin Key" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Environment</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      value={apiKeyEnv}
                      onChange={(e) => setApiKeyEnv(e.target.value)}
                    >
                      <option value="production">Production</option>
                      <option value="staging">Staging</option>
                      <option value="development">Development</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rate Limit</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      value={apiKeyRateLimit}
                      onChange={(e) => setApiKeyRateLimit(e.target.value)}
                    >
                      <option value="100/hour">100 / hour</option>
                      <option value="500/hour">500 / hour</option>
                      <option value="1000/hour">1,000 / hour</option>
                      <option value="5000/hour">5,000 / hour</option>
                      <option value="unlimited">Unlimited</option>
                    </select>
                  </div>
                  <div className="flex gap-3 mt-2">
                    <Button variant="outline" className="flex-1" onClick={() => setShowApiKeyModal(false)}>
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 gap-2"
                      disabled={generatingApiKey}
                      onClick={() => void handleGenerateApiKey()}
                    >
                      {generatingApiKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                      {generatingApiKey ? "Generating…" : "Generate"}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Integration Configure Modal */}
      <AnimatePresence>
        {intModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => { if (!intLoading) setIntModal(null); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                  Configure {intModal.name}
                </h3>
                <button type="button" onClick={() => setIntModal(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{intModal.label}</label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={intValue}
                      onChange={(e) => setIntValue(e.target.value)}
                      placeholder="Paste your key here…"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Stored securely in your platform settings.</p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setIntModal(null)}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    disabled={intLoading || !intValue.trim()}
                    onClick={() => void handleSaveIntegration()}
                  >
                    {intLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {intLoading ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayoutNew>
  );
}
