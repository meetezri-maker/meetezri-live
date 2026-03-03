import { useState } from "react";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Download,
  FileText,
  XCircle,
  AlertTriangle,
  Clock,
  Search,
  CheckCircle,
  Info,
  Code,
  Shield,
  Zap,
  Database,
  Server,
  User,
} from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: Date;
  level: "info" | "warning" | "error" | "success" | "debug";
  category: "auth" | "api" | "database" | "security" | "system" | "user";
  message: string;
  source: string;
  userId?: string;
  ipAddress?: string;
  details?: string;
  requestId?: string;
}

export function SystemLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [dateFilter, setDateFilter] = useState("today");

  // Mock log entries
  const logs: LogEntry[] = [
    {
      id: "log001",
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      level: "error",
      category: "api",
      message: "Payment API timeout",
      source: "/api/payments/process",
      userId: "u456",
      ipAddress: "192.168.1.45",
      details: "Request to Stripe API timed out after 30 seconds",
      requestId: "req_abc123"
    },
    {
      id: "log002",
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      level: "warning",
      category: "security",
      message: "Multiple failed login attempts",
      source: "/auth/login",
      userId: "unknown",
      ipAddress: "45.123.67.89",
      details: "5 failed login attempts for user@example.com in 2 minutes",
      requestId: "req_def456"
    },
    {
      id: "log003",
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      level: "success",
      category: "auth",
      message: "User login successful",
      source: "/auth/login",
      userId: "u789",
      ipAddress: "192.168.1.12",
      details: "2FA verification passed",
      requestId: "req_ghi789"
    },
    {
      id: "log004",
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
      level: "info",
      category: "database",
      message: "Database backup completed",
      source: "/system/backup",
      details: "Backup size: 2.4 GB, Duration: 8 minutes",
      requestId: "req_jkl012"
    },
    {
      id: "log005",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      level: "error",
      category: "database",
      message: "Connection pool exhausted",
      source: "/database/pool",
      details: "All 100 connections in use, new connections queued",
      requestId: "req_mno345"
    },
    {
      id: "log006",
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
      level: "warning",
      category: "system",
      message: "High memory usage detected",
      source: "/system/monitor",
      details: "Memory usage at 87%, threshold is 80%",
      requestId: "req_pqr678"
    },
    {
      id: "log007",
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      level: "info",
      category: "user",
      message: "New user registration",
      source: "/users/register",
      userId: "u901",
      ipAddress: "192.168.1.23",
      details: "Email verification sent",
      requestId: "req_stu901"
    },
    {
      id: "log008",
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
      level: "debug",
      category: "api",
      message: "AI session initiated",
      source: "/api/ai/session/start",
      userId: "u234",
      ipAddress: "192.168.1.56",
      details: "Model: GPT-4, Session ID: sess_xyz789",
      requestId: "req_vwx234"
    },
    {
      id: "log009",
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
      level: "success",
      category: "security",
      message: "Security scan completed",
      source: "/security/scan",
      details: "No vulnerabilities detected, 1,245 files scanned",
      requestId: "req_yza567"
    },
    {
      id: "log010",
      timestamp: new Date(Date.now() - 7 * 60 * 60 * 1000),
      level: "error",
      category: "api",
      message: "Rate limit exceeded",
      source: "/api/rate-limiter",
      userId: "u567",
      ipAddress: "98.76.54.32",
      details: "User exceeded 100 requests per minute limit",
      requestId: "req_bcd890"
    },
    {
      id: "log011",
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
      level: "info",
      category: "system",
      message: "Server restart completed",
      source: "/system/restart",
      details: "Restart duration: 45 seconds, All services healthy",
      requestId: "req_efg123"
    },
    {
      id: "log012",
      timestamp: new Date(Date.now() - 9 * 60 * 60 * 1000),
      level: "warning",
      category: "database",
      message: "Slow query detected",
      source: "/database/query",
      details: "Query execution time: 3.2 seconds (threshold: 1 second)",
      requestId: "req_hij456"
    }
  ];

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         log.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         log.details?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = filterLevel === "all" || log.level === filterLevel;
    const matchesCategory = filterCategory === "all" || log.category === filterCategory;
    return matchesSearch && matchesLevel && matchesCategory;
  });

  const getLevelColor = (level: string) => {
    switch(level) {
      case "error": return "bg-red-100 text-red-700 border-red-300";
      case "warning": return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "success": return "bg-green-100 text-green-700 border-green-300";
      case "info": return "bg-blue-100 text-blue-700 border-blue-300";
      case "debug": return "bg-purple-100 text-purple-700 border-purple-300";
      default: return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  const getLevelIcon = (level: string) => {
    switch(level) {
      case "error": return XCircle;
      case "warning": return AlertTriangle;
      case "success": return CheckCircle;
      case "info": return Info;
      case "debug": return Code;
      default: return FileText;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch(category) {
      case "auth": return Shield;
      case "api": return Zap;
      case "database": return Database;
      case "security": return Shield;
      case "system": return Server;
      case "user": return User;
      default: return FileText;
    }
  };

  const stats = {
    totalLogs: logs.length,
    errors: logs.filter(l => l.level === "error").length,
    warnings: logs.filter(l => l.level === "warning").length,
    lastHour: logs.filter(l => Date.now() - l.timestamp.getTime() < 60 * 60 * 1000).length
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
            <h1 className="text-3xl font-bold text-gray-900">System Logs</h1>
            <p className="text-gray-600 mt-1">Monitor and debug system activity</p>
          </div>

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center gap-2 shadow-lg"
            >
              <Download className="w-4 h-4" />
              Export Logs
            </motion.button>
          </div>
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
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total Logs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalLogs}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-2 border-red-200"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-rose-600">
                <XCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Errors</p>
                <p className="text-2xl font-bold text-red-600">{stats.errors}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-2 border-yellow-200"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Warnings</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.warnings}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Last Hour</p>
                <p className="text-2xl font-bold text-gray-900">{stats.lastHour}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Levels</option>
              <option value="error">Errors</option>
              <option value="warning">Warnings</option>
              <option value="success">Success</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Categories</option>
              <option value="auth">Authentication</option>
              <option value="api">API</option>
              <option value="database">Database</option>
              <option value="security">Security</option>
              <option value="system">System</option>
              <option value="user">User</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </div>
        </motion.div>

        {/* Logs List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              Log Entries ({filteredLogs.length})
            </h2>
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-3 h-3 rounded-full bg-green-500"
              />
              <span className="text-sm text-green-600 font-medium">Live</span>
            </div>
          </div>

          <div className="space-y-3">
            {filteredLogs.map((log, index) => {
              const LevelIcon = getLevelIcon(log.level);
              const CategoryIcon = getCategoryIcon(log.category);
              
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + index * 0.02 }}
                  onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                  className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                    selectedLog?.id === log.id
                      ? "border-blue-500 bg-blue-50 shadow-md"
                      : `${getLevelColor(log.level)} hover:shadow-md`
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg bg-white ${
                      log.level === "error" ? "text-red-600" :
                      log.level === "warning" ? "text-yellow-600" :
                      log.level === "success" ? "text-green-600" :
                      log.level === "info" ? "text-blue-600" :
                      "text-purple-600"
                    }`}>
                      <LevelIcon className="w-5 h-5" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-gray-900">{log.message}</h3>
                        <span className="px-2 py-0.5 rounded-lg text-xs font-medium uppercase bg-white bg-opacity-50">
                          {log.level}
                        </span>
                        <CategoryIcon className="w-4 h-4 text-gray-500" />
                        <span className="text-xs text-gray-600 capitalize">{log.category}</span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-2">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Clock className="w-3 h-3" />
                          <span>{log.timestamp.toLocaleTimeString()}</span>
                        </div>

                        <div className="flex items-center gap-1 text-gray-600">
                          <Code className="w-3 h-3" />
                          <span className="truncate">{log.source}</span>
                        </div>

                        {log.userId && (
                          <div className="flex items-center gap-1 text-gray-600">
                            <User className="w-3 h-3" />
                            <span>{log.userId}</span>
                          </div>
                        )}

                        {log.ipAddress && (
                          <div className="flex items-center gap-1 text-gray-600">
                            <Server className="w-3 h-3" />
                            <span>{log.ipAddress}</span>
                          </div>
                        )}
                      </div>

                      {log.details && (
                        <p className="text-sm text-gray-700 bg-white bg-opacity-50 rounded-lg p-2">
                          {log.details}
                        </p>
                      )}

                      {/* Expanded Details */}
                      {selectedLog?.id === log.id && log.requestId && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-3 pt-3 border-t border-gray-300"
                        >
                          <div className="bg-gray-900 text-green-400 rounded-lg p-3 font-mono text-xs">
                            <p className="mb-1">Request ID: {log.requestId}</p>
                            <p className="mb-1">Timestamp: {log.timestamp.toISOString()}</p>
                            <p className="mb-1">Source: {log.source}</p>
                            {log.userId && <p className="mb-1">User ID: {log.userId}</p>}
                            {log.ipAddress && <p className="mb-1">IP Address: {log.ipAddress}</p>}
                            {log.details && <p className="text-yellow-400 mt-2">Details: {log.details}</p>}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {filteredLogs.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No logs found matching your filters</p>
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 shadow-lg border-2 border-blue-200"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white rounded-xl p-4 text-left hover:shadow-md transition-shadow"
            >
              <XCircle className="w-8 h-8 text-red-600 mb-2" />
              <h3 className="font-bold text-gray-900 mb-1">View All Errors</h3>
              <p className="text-sm text-gray-600">Filter to show only error logs</p>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white rounded-xl p-4 text-left hover:shadow-md transition-shadow"
            >
              <Shield className="w-8 h-8 text-purple-600 mb-2" />
              <h3 className="font-bold text-gray-900 mb-1">Security Logs</h3>
              <p className="text-sm text-gray-600">Review security-related events</p>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white rounded-xl p-4 text-left hover:shadow-md transition-shadow"
            >
              <Download className="w-8 h-8 text-blue-600 mb-2" />
              <h3 className="font-bold text-gray-900 mb-1">Export Report</h3>
              <p className="text-sm text-gray-600">Download logs as CSV or JSON</p>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}