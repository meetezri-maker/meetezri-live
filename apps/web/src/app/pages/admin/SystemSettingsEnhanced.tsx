import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
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
  Server,
  Cloud,
  Code,
  Palette,
} from "lucide-react";

const SETTINGS_KEY = "admin.system_settings_enhanced";

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
  const [activeSection, setActiveSection] = useState<string>("general");
  const [showApiKey, setShowApiKey] = useState(false);
  const [settings, setSettings] = useState<SystemSettingsEnhancedState>(DEFAULT_SETTINGS);
  const [baseline, setBaseline] = useState<SystemSettingsEnhancedState>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      toast.success("Saved");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
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
    setSettings((s) => ({ ...s, appearance: { ...s.appearance, ...patch } }));

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
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={loading || saving}
                onClick={() => {
                  setSettings(DEFAULT_SETTINGS);
                }}
              >
                <RotateCcw className="w-4 h-4" />
                Reset All
              </Button>
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
                        <label className="block text-sm font-medium mb-2">Max Concurrent Sessions</label>
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
                        <p className="font-medium">Allow Anonymous Sessions</p>
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
                      <Button type="button" variant="outline" size="sm">
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
                      <Button type="button" variant="outline" size="sm">
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
                        <p className="font-medium">Crisis Alerts</p>
                        <p className="text-sm text-muted-foreground">Immediate alerts for crisis situations</p>
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
                    <Button type="button" className="w-full gap-2" variant="secondary">
                      <Database className="w-4 h-4" />
                      Create Backup Now
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
                    <Button type="button" variant="outline" className="w-full">
                      Generate New API Key
                    </Button>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-bold text-lg mb-4">Third-Party Integrations</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">OpenAI API</p>
                        <p className="text-sm text-muted-foreground">AI-powered conversations</p>
                      </div>
                      <Button type="button" variant="outline" size="sm">
                        Configure
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Twilio</p>
                        <p className="text-sm text-muted-foreground">SMS notifications</p>
                      </div>
                      <Button type="button" variant="outline" size="sm">
                        Configure
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Stripe</p>
                        <p className="text-sm text-muted-foreground">Payment processing</p>
                      </div>
                      <Button type="button" variant="outline" size="sm">
                        Configure
                      </Button>
                    </div>
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
                  <h2 className="text-xl font-bold mb-6">Appearance Settings</h2>
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
    </AdminLayoutNew>
  );
}
