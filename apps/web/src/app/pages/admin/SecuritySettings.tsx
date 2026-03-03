import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { 
  Shield,
  Lock,
  Key,
  Eye,
  AlertTriangle,
  CheckCircle,
  Users,
  Clock,
  Smartphone,
  Mail,
  FileText,
  Activity,
  Settings,
  Save,
  X
} from "lucide-react";
import { useState } from "react";

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
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [passwordExpiry, setPasswordExpiry] = useState("90");
  const [maxLoginAttempts, setMaxLoginAttempts] = useState("5");
  const [sessionTimeout, setSessionTimeout] = useState("30");
  const [showLogDetails, setShowLogDetails] = useState(false);
  const [selectedLog, setSelectedLog] = useState<SecurityLog | null>(null);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

  const handleSaveChanges = () => {
    console.log("Saving security settings:", {
      twoFactorEnabled,
      passwordExpiry,
      maxLoginAttempts,
      sessionTimeout
    });
    setShowSaveConfirmation(true);
    setTimeout(() => setShowSaveConfirmation(false), 3000);
  };

  const handleViewLog = (log: SecurityLog) => {
    setSelectedLog(log);
    setShowLogDetails(true);
  };

  // Mock security logs
  const securityLogs: SecurityLog[] = [
    {
      id: "log001",
      event: "Failed login attempt",
      severity: "medium",
      user: "unknown",
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      ipAddress: "192.168.1.45",
      action: "Account locked after 5 attempts"
    },
    {
      id: "log002",
      event: "Password changed",
      severity: "low",
      user: "admin@ezri.com",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      ipAddress: "192.168.1.12",
      action: "Password updated successfully"
    },
    {
      id: "log003",
      event: "Suspicious activity detected",
      severity: "high",
      user: "user@example.com",
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
      ipAddress: "45.123.67.89",
      action: "Multiple location login attempts"
    },
    {
      id: "log004",
      event: "2FA enabled",
      severity: "low",
      user: "sarah@ezri.com",
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
      ipAddress: "192.168.1.23",
      action: "Two-factor authentication activated"
    },
    {
      id: "log005",
      event: "API key regenerated",
      severity: "medium",
      user: "admin@ezri.com",
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      ipAddress: "192.168.1.12",
      action: "Production API key rotated"
    }
  ];

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
    totalUsers: 1205,
    twoFactorEnabled: 892,
    activeSession: 234,
    failedLogins: 12
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
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center gap-2 shadow-lg"
            onClick={handleSaveChanges}
          >
            <Save className="w-4 h-4" />
            Save Changes
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
                <p className="text-gray-600 text-sm">2FA Enabled</p>
                <p className="text-2xl font-bold text-gray-900">{stats.twoFactorEnabled}</p>
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
                <p className="text-gray-600 text-sm">Active Sessions</p>
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
                <p className="text-gray-600 text-sm">Failed Logins (24h)</p>
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
                      <input type="checkbox" className="rounded" defaultChecked />
                      <span className="text-gray-700">SMS verification</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="rounded" defaultChecked />
                      <span className="text-gray-700">Authenticator app (TOTP)</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="rounded" />
                      <span className="text-gray-700">Email verification</span>
                    </label>
                  </div>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  twoFactorEnabled ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                <motion.div
                  animate={{ x: twoFactorEnabled ? 28 : 0 }}
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
                      <input type="checkbox" className="rounded" defaultChecked />
                      <span className="text-gray-700">Google OAuth</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="rounded" />
                      <span className="text-gray-700">Microsoft Azure AD</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="rounded" />
                      <span className="text-gray-700">SAML 2.0</span>
                    </label>
                  </div>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                className="relative w-14 h-7 rounded-full transition-colors bg-green-500"
              >
                <motion.div
                  animate={{ x: 28 }}
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
                defaultValue="12"
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password Expiry (days)
              </label>
              <select
                value={passwordExpiry}
                onChange={(e) => setPasswordExpiry(e.target.value)}
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
                value={maxLoginAttempts}
                onChange={(e) => setMaxLoginAttempts(e.target.value)}
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
              <select className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="1440">24 hours</option>
              </select>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="rounded" defaultChecked />
              <span className="text-sm text-gray-700">Require uppercase letters</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="rounded" defaultChecked />
              <span className="text-sm text-gray-700">Require lowercase letters</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="rounded" defaultChecked />
              <span className="text-sm text-gray-700">Require numbers</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="rounded" defaultChecked />
              <span className="text-sm text-gray-700">Require special characters</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="rounded" defaultChecked />
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
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
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
                Max Concurrent Sessions
              </label>
              <select className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="1">1 device</option>
                <option value="3">3 devices</option>
                <option value="5">5 devices</option>
                <option value="unlimited">Unlimited</option>
              </select>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="rounded" defaultChecked />
              <span className="text-sm text-gray-700">Remember device for 30 days</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="rounded" defaultChecked />
              <span className="text-sm text-gray-700">Force logout on password change</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="rounded" />
              <span className="text-sm text-gray-700">Allow concurrent logins from same IP</span>
            </label>
          </div>
        </motion.div>

        {/* Security Logs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">Recent Security Events</h2>
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

        {/* Save Confirmation Toast */}
        {showSaveConfirmation && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-10 right-10 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50"
          >
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Settings saved successfully!</span>
          </motion.div>
        )}

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
                    className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium shadow-lg"
                    onClick={() => {
                      console.log("Exporting log:", selectedLog.id);
                      setShowLogDetails(false);
                    }}
                  >
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