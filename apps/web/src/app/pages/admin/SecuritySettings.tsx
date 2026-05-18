import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { 
  Shield,
  Lock,
  Key,
  Eye,
  AlertTriangle,
  Users,
  Clock,
  Smartphone,
  FileText,
  Activity,
  Save,
  X,
  Loader2,
  Download,
  LogOut,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const SECURITY_SETTINGS_KEY = "admin_security_settings";

export type AdminSecurityForm = {
  twoFactorEnabled: boolean;
  twoFactorSms: boolean;
  twoFactorTotp: boolean;
  twoFactorEmail: boolean;
  ssoEnabled: boolean;
  ssoGoogle: boolean;
  ssoAzure: boolean;
  ssoSaml: boolean;
  minPasswordLength: number;
  passwordExpiry: string;
  maxLoginAttempts: string;
  lockoutMinutes: string;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecial: boolean;
  preventReuse: boolean;
  sessionTimeout: string;
  maxConcurrentSessions: string;
  rememberDevice: boolean;
  forceLogoutOnPasswordChange: boolean;
  allowConcurrentSameIp: boolean;
};

const DEFAULT_SECURITY_FORM: AdminSecurityForm = {
  twoFactorEnabled: true,
  twoFactorSms: true,
  twoFactorTotp: true,
  twoFactorEmail: false,
  ssoEnabled: true,
  ssoGoogle: true,
  ssoAzure: false,
  ssoSaml: false,
  minPasswordLength: 12,
  passwordExpiry: "90",
  maxLoginAttempts: "5",
  lockoutMinutes: "30",
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecial: true,
  preventReuse: true,
  sessionTimeout: "30",
  maxConcurrentSessions: "3",
  rememberDevice: true,
  forceLogoutOnPasswordChange: true,
  allowConcurrentSameIp: false,
};

function mergeSecurityPayload(raw: unknown): AdminSecurityForm {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SECURITY_FORM };
  const o = raw as Record<string, unknown>;
  const next = { ...DEFAULT_SECURITY_FORM };
  (Object.keys(DEFAULT_SECURITY_FORM) as Array<keyof AdminSecurityForm>).forEach((k) => {
    if (!(k in o)) return;
    const v = o[k];
    const d = DEFAULT_SECURITY_FORM[k];
    if (typeof d === "boolean" && typeof v === "boolean") (next as Record<string, unknown>)[k] = v;
    else if (typeof d === "number" && typeof v === "number" && Number.isFinite(v))
      (next as Record<string, unknown>)[k] = Math.min(128, Math.max(6, Math.round(v)));
    else if (typeof d === "string" && typeof v === "string") (next as Record<string, unknown>)[k] = v;
  });
  return next;
}

interface SecurityLog {
  id: string;
  event: string;
  severity: "low" | "medium" | "high" | "critical";
  user: string;
  timestamp: Date;
  ipAddress: string;
  action: string;
}

export function SecuritySettings() {
  const [form, setForm] = useState<AdminSecurityForm>(DEFAULT_SECURITY_FORM);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showLogDetails, setShowLogDetails] = useState(false);
  const [selectedLog, setSelectedLog] = useState<SecurityLog | null>(null);
  const [isTerminating, setIsTerminating] = useState(false);

  const patchForm = useCallback((partial: Partial<AdminSecurityForm>) => {
    setForm((f) => ({ ...f, ...partial }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await api.getSettings();
        const list = Array.isArray(rows) ? rows : [];
        const row = list.find((r: { key?: string }) => r.key === SECURITY_SETTINGS_KEY);
        const raw = row?.value;
        if (!cancelled) {
          setForm(mergeSecurityPayload(raw));
          setSettingsLoaded(true);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          toast.error("Could not load saved security settings (using defaults).");
          setSettingsLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      await api.updateSetting(
        SECURITY_SETTINGS_KEY,
        form,
        "Admin security policy configuration (UI preferences; enforce in auth layer separately)"
      );
      toast.success("Security settings saved successfully.");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save security settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTerminateAllSessions = async () => {
    if (!window.confirm("This will sign out your current session. All other active sessions will expire at their next token refresh. Continue?")) return;
    setIsTerminating(true);
    try {
      await supabase.auth.signOut({ scope: "global" });
      toast.success("All sessions terminated. You have been signed out.");
    } catch (e) {
      console.error(e);
      toast.error("Failed to terminate sessions.");
      setIsTerminating(false);
    }
  };

  const handleExportLogs = () => {
    if (securityLogs.length === 0) {
      toast.error("No security logs to export.");
      return;
    }
    const headers = ["ID", "Event", "Severity", "User", "IP Address", "Timestamp", "Action"];
    const rows = securityLogs.map((log) => [
      log.id,
      `"${log.event.replace(/"/g, '""')}"`,
      log.severity,
      log.user,
      log.ipAddress,
      log.timestamp.toISOString(),
      `"${log.action.replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `security-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${securityLogs.length} security log entries.`);
  };

  const handleExportSingleLog = (log: SecurityLog) => {
    const data = JSON.stringify(log, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `security-log-${log.id}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Log exported as JSON.");
  };

  const handleViewLog = (log: SecurityLog) => {
    setSelectedLog(log);
    setShowLogDetails(true);
  };

  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [dashStats, setDashStats] = useState<{
    totalUsers: number;
    activeSessions: number;
    openErrors: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stats, errs, audits] = await Promise.all([
          api.admin.getStats(),
          api.admin.getErrorLogs({ page: 1, limit: 40 }),
          api.admin.getAuditLogs({ page: 1, limit: 25 }),
        ]);
        if (cancelled) return;
        const errList = Array.isArray(errs) ? errs : [];
        const auditList = Array.isArray(audits) ? audits : [];
        setDashStats({
          totalUsers: stats?.totalUsers ?? 0,
          activeSessions: stats?.activeSessions ?? 0,
          openErrors: errList.filter((e: any) => e.status === "open").length,
        });
        const fromErrors: SecurityLog[] = errList.slice(0, 12).map((e: any) => {
          const sev = String(e.severity || "").toLowerCase();
          const severity: SecurityLog["severity"] =
            sev === "error" || sev === "fatal" ? "high" : sev === "warn" || sev === "warning" ? "medium" : "low";
          return {
            id: `err-${e.id}`,
            event: e.message || "Error",
            severity,
            user: "system",
            timestamp: e.created_at ? new Date(e.created_at) : new Date(),
            ipAddress: "—",
            action: `status: ${e.status || "open"}`,
          };
        });
        const fromAudit: SecurityLog[] = auditList.slice(0, 12).map((a: any) => {
          const actor = a.profiles;
          return {
            id: `audit-${a.id}`,
            event: a.action || "Audit event",
            severity: "low",
            user: actor?.email || actor?.full_name || "actor",
            timestamp: a.created_at ? new Date(a.created_at) : new Date(),
            ipAddress: "—",
            action: "Audit log",
          };
        });
        const merged = [...fromErrors, ...fromAudit].sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
        );
        setSecurityLogs(merged.slice(0, 20));
      } catch (e) {
        console.error(e);
        setSecurityLogs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case "critical": return "bg-red-100 text-red-700 border-red-300";
      case "high": return "bg-orange-100 text-orange-700 border-orange-300";
      case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "low": return "bg-blue-100 text-blue-700 border-blue-300";
      default: return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  const stats = {
    totalUsers: dashStats?.totalUsers ?? 0,
    twoFactorEnabled: "—" as const,
    activeSession: dashStats?.activeSessions ?? 0,
    failedLogins: dashStats?.openErrors ?? 0,
  };

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Security Settings</h1>
            <p className="text-gray-600 mt-1">Manage authentication, passwords, and security policies</p>
          </div>

          <motion.button
            type="button"
            disabled={!settingsLoaded || isSaving}
            whileHover={{ scale: settingsLoaded && !isSaving ? 1.02 : 1 }}
            whileTap={{ scale: settingsLoaded && !isSaving ? 0.98 : 1 }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center gap-2 shadow-lg disabled:opacity-60 disabled:pointer-events-none"
            onClick={handleSaveChanges}
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? "Saving…" : "Save Changes"}
          </motion.button>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">2FA enrollment</p>
                <p className="text-2xl font-bold text-gray-900">{stats.twoFactorEnabled}</p>
                <p className="text-xs text-gray-500 mt-1">Not stored in app DB</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Active Talk it out</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeSession}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-2 border-red-200"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-rose-600">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Open error logs</p>
                <p className="text-2xl font-bold text-red-600">{stats.failedLogins}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Authentication Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Authentication Settings</h2>
          </div>

          <div className="space-y-6">
            {/* Two-Factor Authentication */}
            <div className="flex items-start justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Two-Factor Authentication (2FA)</h3>
                  <p className="text-sm text-gray-600">Require users to verify identity with a second factor</p>
                  <div className="mt-3 space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={form.twoFactorSms}
                        onChange={(e) => patchForm({ twoFactorSms: e.target.checked })}
                      />
                      <span className="text-gray-700">SMS verification</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={form.twoFactorTotp}
                        onChange={(e) => patchForm({ twoFactorTotp: e.target.checked })}
                      />
                      <span className="text-gray-700">Authenticator app (TOTP)</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={form.twoFactorEmail}
                        onChange={(e) => patchForm({ twoFactorEmail: e.target.checked })}
                      />
                      <span className="text-gray-700">Email verification</span>
                    </label>
                  </div>
                </div>
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => patchForm({ twoFactorEnabled: !form.twoFactorEnabled })}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  form.twoFactorEnabled ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                <motion.div
                  animate={{ x: form.twoFactorEnabled ? 28 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md"
                />
              </motion.button>
            </div>

            {/* SSO */}
            <div className="flex items-start justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-start gap-3">
                <Key className="w-5 h-5 text-purple-600 mt-1" />
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Single Sign-On (SSO)</h3>
                  <p className="text-sm text-gray-600">Allow users to login with third-party providers</p>
                  <div className="mt-3 space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={form.ssoGoogle}
                        onChange={(e) => patchForm({ ssoGoogle: e.target.checked })}
                      />
                      <span className="text-gray-700">Google OAuth</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={form.ssoAzure}
                        onChange={(e) => patchForm({ ssoAzure: e.target.checked })}
                      />
                      <span className="text-gray-700">Microsoft Azure AD</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={form.ssoSaml}
                        onChange={(e) => patchForm({ ssoSaml: e.target.checked })}
                      />
                      <span className="text-gray-700">SAML 2.0</span>
                    </label>
                  </div>
                </div>
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => patchForm({ ssoEnabled: !form.ssoEnabled })}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  form.ssoEnabled ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                <motion.div
                  animate={{ x: form.ssoEnabled ? 28 : 0 }}
                  className="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md"
                />
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Password Policies */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex items-center gap-3 mb-6">
            <Lock className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold text-gray-900">Password Policies</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Password Length
              </label>
                  <input
                type="number"
                min={6}
                max={128}
                value={form.minPasswordLength}
                onChange={(e) =>
                  patchForm({ minPasswordLength: Math.min(128, Math.max(6, Number(e.target.value) || 6)) })
                }
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password Expiry (days)
              </label>
              <select
                value={form.passwordExpiry}
                onChange={(e) => patchForm({ passwordExpiry: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
                <option value="never">Never</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Login Attempts
              </label>
              <select
                value={form.maxLoginAttempts}
                onChange={(e) => patchForm({ maxLoginAttempts: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="3">3 attempts</option>
                <option value="5">5 attempts</option>
                <option value="10">10 attempts</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Lockout Duration (minutes)
              </label>
              <select
                value={form.lockoutMinutes}
                onChange={(e) => patchForm({ lockoutMinutes: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="1440">24 hours</option>
              </select>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded"
                checked={form.requireUppercase}
                onChange={(e) => patchForm({ requireUppercase: e.target.checked })}
              />
              <span className="text-sm text-gray-700">Require uppercase letters</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded"
                checked={form.requireLowercase}
                onChange={(e) => patchForm({ requireLowercase: e.target.checked })}
              />
              <span className="text-sm text-gray-700">Require lowercase letters</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded"
                checked={form.requireNumbers}
                onChange={(e) => patchForm({ requireNumbers: e.target.checked })}
              />
              <span className="text-sm text-gray-700">Require numbers</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded"
                checked={form.requireSpecial}
                onChange={(e) => patchForm({ requireSpecial: e.target.checked })}
              />
              <span className="text-sm text-gray-700">Require special characters</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded"
                checked={form.preventReuse}
                onChange={(e) => patchForm({ preventReuse: e.target.checked })}
              />
              <span className="text-sm text-gray-700">Prevent password reuse (last 5 passwords)</span>
            </label>
          </div>
        </motion.div>

        {/* Session Management */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex items-center gap-3 mb-6">
            <Clock className="w-6 h-6 text-orange-600" />
            <h2 className="text-xl font-bold text-gray-900">Session Management</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Timeout (minutes)
              </label>
              <select
                value={form.sessionTimeout}
                onChange={(e) => patchForm({ sessionTimeout: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="480">8 hours</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Concurrent Talk it out
              </label>
              <select
                value={form.maxConcurrentSessions}
                onChange={(e) => patchForm({ maxConcurrentSessions: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="1">1 device</option>
                <option value="3">3 devices</option>
                <option value="5">5 devices</option>
                <option value="unlimited">Unlimited</option>
              </select>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded"
                checked={form.rememberDevice}
                onChange={(e) => patchForm({ rememberDevice: e.target.checked })}
              />
              <span className="text-sm text-gray-700">Remember device for 30 days</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded"
                checked={form.forceLogoutOnPasswordChange}
                onChange={(e) => patchForm({ forceLogoutOnPasswordChange: e.target.checked })}
              />
              <span className="text-sm text-gray-700">Force logout on password change</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded"
                checked={form.allowConcurrentSameIp}
                onChange={(e) => patchForm({ allowConcurrentSameIp: e.target.checked })}
              />
              <span className="text-sm text-gray-700">Allow concurrent logins from same IP</span>
            </label>
          </div>

          {/* Terminate All Talk it out */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl">
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Terminate All Talk it out</h3>
                <p className="text-sm text-gray-600">Sign out all users from all devices immediately. Use with caution.</p>
              </div>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={isTerminating}
                onClick={() => void handleTerminateAllSessions()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium disabled:opacity-50 disabled:pointer-events-none"
              >
                {isTerminating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                {isTerminating ? "Terminating…" : "Terminate All Talk it out"}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Security Logs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-bold text-gray-900">Recent Security Events</h2>
            </div>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExportLogs}
              disabled={securityLogs.length === 0}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Download className="w-4 h-4" />
              Export All ({securityLogs.length})
            </motion.button>
          </div>

          <div className="space-y-3">
            {securityLogs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + index * 0.05 }}
                className={`border-2 rounded-xl p-4 ${getSeverityColor(log.severity)}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-gray-900">{log.event}</h3>
                      <span className="px-2 py-1 rounded-lg text-xs font-medium uppercase bg-white bg-opacity-50">
                        {log.severity}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-gray-600">User</p>
                        <p className="font-medium text-gray-900">{log.user}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">IP Address</p>
                        <p className="font-medium text-gray-900">{log.ipAddress}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Time</p>
                        <p className="font-medium text-gray-900">{log.timestamp.toLocaleTimeString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Action</p>
                        <p className="font-medium text-gray-900 text-xs">{log.action}</p>
                      </div>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 rounded-lg hover:bg-white hover:bg-opacity-50"
                    onClick={() => handleViewLog(log)}
                  >
                    <Eye className="w-5 h-5 text-gray-700" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Log Details Modal */}
        {showLogDetails && selectedLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowLogDetails(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${getSeverityColor(selectedLog.severity)} flex items-center justify-center`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Security Event Details</h2>
                    <p className="text-sm text-gray-600">Log ID: {selectedLog.id}</p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 rounded-lg hover:bg-gray-100"
                  onClick={() => setShowLogDetails(false)}
                >
                  <X className="w-5 h-5 text-gray-700" />
                </motion.button>
              </div>

              <div className="space-y-4">
                {/* Event Info */}
                <div className={`border-2 rounded-xl p-4 ${getSeverityColor(selectedLog.severity)}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-xl font-bold text-gray-900">{selectedLog.event}</h3>
                    <span className="px-3 py-1 rounded-lg text-xs font-medium uppercase bg-white bg-opacity-70">
                      {selectedLog.severity}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-4">{selectedLog.action}</p>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-4 bg-white bg-opacity-50 rounded-lg p-4">
                    <div>
                      <p className="text-xs font-medium text-gray-600 uppercase mb-1">User</p>
                      <p className="font-medium text-gray-900">{selectedLog.user}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600 uppercase mb-1">IP Address</p>
                      <p className="font-medium text-gray-900">{selectedLog.ipAddress}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600 uppercase mb-1">Date</p>
                      <p className="font-medium text-gray-900">{selectedLog.timestamp.toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600 uppercase mb-1">Time</p>
                      <p className="font-medium text-gray-900">{selectedLog.timestamp.toLocaleTimeString()}</p>
                    </div>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-600" />
                    Recommended Actions
                  </h4>
                  <ul className="text-sm text-gray-700 space-y-1 ml-6 list-disc">
                    {selectedLog.severity === "high" || selectedLog.severity === "critical" ? (
                      <>
                        <li>Review account activity immediately</li>
                        <li>Contact user to verify recent actions</li>
                        <li>Consider temporary account suspension</li>
                      </>
                    ) : selectedLog.severity === "medium" ? (
                      <>
                        <li>Monitor account for additional suspicious activity</li>
                        <li>Notify user of security event</li>
                      </>
                    ) : (
                      <>
                        <li>Event logged for record keeping</li>
                        <li>No immediate action required</li>
                      </>
                    )}
                  </ul>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium"
                    onClick={() => setShowLogDetails(false)}
                  >
                    Close
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium shadow-lg flex items-center justify-center gap-2"
                    onClick={() => {
                      handleExportSingleLog(selectedLog);
                      setShowLogDetails(false);
                    }}
                  >
                    <Download className="w-4 h-4" />
                    Export Log
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AdminLayoutNew>
  );
}