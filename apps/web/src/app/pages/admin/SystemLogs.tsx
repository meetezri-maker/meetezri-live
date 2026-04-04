import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
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

function mapErrorToLogEntry(row: any): LogEntry {
  const sev = String(row.severity || "info").toLowerCase();
  let level: LogEntry["level"] = "info";
  if (sev === "error" || sev === "fatal") level = "error";
  else if (sev === "warn" || sev === "warning") level = "warning";
  else if (sev === "debug") level = "debug";
  else if (sev === "success") level = "success";

  const ctx = row.context && typeof row.context === "object" ? (row.context as Record<string, unknown>) : {};
  const catRaw = typeof ctx.category === "string" ? ctx.category : "system";
  const category = (
    ["auth", "api", "database", "security", "system", "user"].includes(catRaw) ? catRaw : "system"
  ) as LogEntry["category"];

  const created = row.created_at ? new Date(row.created_at) : new Date();
  const details =
    row.stack_trace ||
    (() => {
      try {
        return row.context ? JSON.stringify(row.context) : undefined;
      } catch {
        return undefined;
      }
    })();

  return {
    id: String(row.id),
    timestamp: created,
    level,
    category,
    message: row.message || "Error",
    source: typeof ctx.path === "string" ? ctx.path : "error_logs",
    userId: typeof ctx.userId === "string" ? ctx.userId : undefined,
    ipAddress: typeof ctx.ip === "string" ? ctx.ip : undefined,
    details,
    requestId: typeof ctx.requestId === "string" ? ctx.requestId : undefined,
  };
}

export function SystemLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [dateFilter, setDateFilter] = useState("all");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const data = await api.admin.getErrorLogs({ page: 1, limit: 100 });
        const list = Array.isArray(data) ? data : [];
        if (!cancelled) setLogs(list.map(mapErrorToLogEntry));
      } catch (e) {
        console.error(e);
        toast.error("Failed to load system error logs");
        if (!cancelled) setLogs([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;

    return logs.filter((log) => {
      const matchesSearch =
        !q ||
        log.message.toLowerCase().includes(q) ||
        log.source.toLowerCase().includes(q) ||
        (log.details && log.details.toLowerCase().includes(q));
      const matchesLevel = filterLevel === "all" || log.level === filterLevel;
      const matchesCategory = filterCategory === "all" || log.category === filterCategory;
      const t = log.timestamp.getTime();
      let matchesDate = true;
      if (dateFilter === "today") matchesDate = log.timestamp >= startOfToday;
      else if (dateFilter === "yesterday")
        matchesDate = log.timestamp >= startOfYesterday && log.timestamp < startOfToday;
      else if (dateFilter === "7d") matchesDate = t >= now - 7 * 24 * 60 * 60 * 1000;
      else if (dateFilter === "30d") matchesDate = t >= now - 30 * 24 * 60 * 60 * 1000;
      return matchesSearch && matchesLevel && matchesCategory && matchesDate;
    });
  }, [logs, searchQuery, filterLevel, filterCategory, dateFilter]);

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

  const stats = useMemo(() => {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    return {
      totalLogs: logs.length,
      errors: logs.filter((l) => l.level === "error").length,
      warnings: logs.filter((l) => l.level === "warning").length,
      lastHour: logs.filter((l) => l.timestamp.getTime() >= hourAgo).length,
    };
  }, [logs]);

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