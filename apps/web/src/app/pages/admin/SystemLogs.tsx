import { useState, useEffect, useMemo, useCallback } from "react";
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
  RefreshCw,
  WifiOff,
  ChevronDown,
  ChevronRight,
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

  const ctx =
    row.context && typeof row.context === "object"
      ? (row.context as Record<string, unknown>)
      : {};
  const catRaw = typeof ctx.category === "string" ? ctx.category : "system";
  const category = (
    ["auth", "api", "database", "security", "system", "user"].includes(catRaw)
      ? catRaw
      : "system"
  ) as LogEntry["category"];

  const created = row.created_at ? new Date(row.created_at) : new Date();
  const details =
    row.stack_trace ||
    (() => {
      try {
        return row.context ? JSON.stringify(row.context, null, 2) : undefined;
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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setFetchError(null);
    try {
      const data = await api.admin.getErrorLogs({ page: 1, limit: 100 });
      const list = Array.isArray(data) ? data : [];
      setLogs(list.map(mapErrorToLogEntry));
      setLastFetched(new Date());
      if (silent && list.length > 0) toast.success(`Loaded ${list.length} log entries`);
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.message?.includes("Failed to fetch") || e?.message?.includes("NetworkError")
          ? "Cannot reach the API server. Make sure the backend is running."
          : (e?.message ?? "Failed to load system error logs");
      setFetchError(msg);
      if (silent) toast.error(msg);
      setLogs([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(false);
  }, [fetchLogs]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const now = Date.now();

    return logs.filter((log) => {
      const matchesSearch =
        !q ||
        log.message.toLowerCase().includes(q) ||
        log.source.toLowerCase().includes(q) ||
        (log.details && log.details.toLowerCase().includes(q));
      const matchesLevel = filterLevel === "all" || log.level === filterLevel;
      const matchesCategory =
        filterCategory === "all" || log.category === filterCategory;
      const t = log.timestamp.getTime();
      let matchesDate = true;
      if (dateFilter === "today") matchesDate = log.timestamp >= startOfToday;
      else if (dateFilter === "yesterday")
        matchesDate =
          log.timestamp >= startOfYesterday && log.timestamp < startOfToday;
      else if (dateFilter === "7d")
        matchesDate = t >= now - 7 * 24 * 60 * 60 * 1000;
      else if (dateFilter === "30d")
        matchesDate = t >= now - 30 * 24 * 60 * 60 * 1000;
      return matchesSearch && matchesLevel && matchesCategory && matchesDate;
    });
  }, [logs, searchQuery, filterLevel, filterCategory, dateFilter]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "bg-red-50 text-red-700 border-red-200";
      case "warning":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "success":
        return "bg-green-50 text-green-700 border-green-200";
      case "info":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "debug":
        return "bg-purple-50 text-purple-700 border-purple-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case "error":
        return "bg-red-100 text-red-700";
      case "warning":
        return "bg-yellow-100 text-yellow-700";
      case "success":
        return "bg-green-100 text-green-700";
      case "info":
        return "bg-blue-100 text-blue-700";
      case "debug":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error":
        return XCircle;
      case "warning":
        return AlertTriangle;
      case "success":
        return CheckCircle;
      case "info":
        return Info;
      case "debug":
        return Code;
      default:
        return FileText;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "auth":
        return Shield;
      case "api":
        return Zap;
      case "database":
        return Database;
      case "security":
        return Shield;
      case "system":
        return Server;
      case "user":
        return User;
      default:
        return FileText;
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

  const exportLogsCsv = (rows: LogEntry[]) => {
    const headers = [
      "ID",
      "Timestamp (ISO)",
      "Level",
      "Category",
      "Message",
      "Source",
      "UserId",
      "IP",
      "Details",
    ];
    const csvContent = [
      headers.join(","),
      ...rows.map((log) =>
        [
          log.id,
          log.timestamp.toISOString(),
          log.level,
          log.category,
          `"${String(log.message).replace(/"/g, '""')}"`,
          `"${String(log.source).replace(/"/g, '""')}"`,
          log.userId ?? "",
          log.ipAddress ?? "",
          `"${String(log.details ?? "").replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-logs-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} log row${rows.length === 1 ? "" : "s"}`);
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
            <p className="text-gray-500 mt-1 text-sm">
              Monitor system errors and debug events from the database
              {lastFetched && (
                <span className="ml-2 text-gray-400">
                  · Last updated {lastFetched.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>

          <div className="flex gap-2">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isRefreshing}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 flex items-center gap-2 hover:bg-gray-50 disabled:opacity-60"
              onClick={() => fetchLogs(true)}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={filteredLogs.length === 0}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center gap-2 shadow-lg disabled:opacity-50"
              onClick={() => exportLogsCsv(filteredLogs)}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </motion.button>
          </div>
        </motion.div>

        {/* Error Banner */}
        {fetchError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 flex items-start gap-4"
          >
            <WifiOff className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-800">Could not load logs</p>
              <p className="text-sm text-red-600 mt-1">{fetchError}</p>
              <p className="text-xs text-red-500 mt-2">
                System logs are read from the <code className="font-mono bg-red-100 px-1 rounded">error_logs</code> database table via the backend API.
                Ensure the API server is running and you are authenticated as an admin.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchLogs(true)}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </motion.div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              label: "Total Logs",
              value: stats.totalLogs,
              icon: FileText,
              color: "from-blue-500 to-indigo-600",
              border: "border-gray-100",
              valueColor: "text-gray-900",
            },
            {
              label: "Errors",
              value: stats.errors,
              icon: XCircle,
              color: "from-red-500 to-rose-600",
              border: "border-red-200",
              valueColor: "text-red-600",
            },
            {
              label: "Warnings",
              value: stats.warnings,
              icon: AlertTriangle,
              color: "from-yellow-500 to-orange-600",
              border: "border-yellow-200",
              valueColor: "text-yellow-600",
            },
            {
              label: "Last Hour",
              value: stats.lastHour,
              icon: Clock,
              color: "from-purple-500 to-pink-600",
              border: "border-gray-100",
              valueColor: "text-gray-900",
            },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className={`bg-white rounded-2xl p-6 shadow-sm border-2 ${s.border}`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${s.color}`}>
                  <s.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-gray-500 text-sm">{s.label}</p>
                  {isLoading ? (
                    <div className="h-8 w-12 bg-gray-100 rounded animate-pulse mt-1" />
                  ) : (
                    <p className={`text-2xl font-bold ${s.valueColor}`}>{s.value}</p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search message, source, details..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>

            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
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
              className="px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
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
              className="px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>
        </motion.div>

        {/* Logs List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">
              Log Entries
              {!isLoading && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({filteredLogs.length}{logs.length !== filteredLogs.length ? ` of ${logs.length}` : ""})
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs text-gray-500">
                {isLoading ? "Loading…" : lastFetched ? "Fetched from DB" : "Ready"}
              </span>
            </div>
          </div>

          {/* Loading skeleton */}
          {isLoading && (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-100 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-100 rounded w-1/3" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {!isLoading && fetchError && (
            <div className="p-12 text-center">
              <WifiOff className="w-14 h-14 text-red-300 mx-auto mb-4" />
              <p className="text-gray-700 font-medium">API connection failed</p>
              <p className="text-gray-400 text-sm mt-1 max-w-sm mx-auto">{fetchError}</p>
            </div>
          )}

          {/* Empty state - API connected but no records */}
          {!isLoading && !fetchError && logs.length === 0 && (
            <div className="p-14 text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <FileText className="w-8 h-8 text-blue-400" />
              </div>
              <p className="text-gray-800 font-semibold text-lg mb-2">No error logs recorded yet</p>
              <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
                System logs are written to the <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">error_logs</code> database table
                when the application encounters errors. The API connected successfully — the table is just empty.
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 max-w-sm mx-auto text-left text-xs text-gray-600 space-y-1">
                <p className="font-semibold text-gray-700 mb-2">When will logs appear?</p>
                <p>• Application runtime errors are automatically logged</p>
                <p>• Authentication failures are captured</p>
                <p>• Database errors and API failures are recorded</p>
                <p>• Use the app normally and errors will show here</p>
              </div>
              <button
                type="button"
                onClick={() => fetchLogs(true)}
                className="mt-5 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 flex items-center gap-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh now
              </button>
            </div>
          )}

          {/* Empty state - filters hiding logs */}
          {!isLoading && !fetchError && logs.length > 0 && filteredLogs.length === 0 && (
            <div className="p-12 text-center">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No logs match these filters</p>
              <p className="text-gray-400 text-sm mt-1">
                {logs.length} log{logs.length !== 1 ? "s" : ""} total — adjust your filters to see them
              </p>
              <button
                type="button"
                className="mt-4 text-sm text-blue-600 hover:underline"
                onClick={() => {
                  setSearchQuery("");
                  setFilterLevel("all");
                  setFilterCategory("all");
                  setDateFilter("all");
                }}
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* Log rows */}
          {!isLoading && !fetchError && filteredLogs.length > 0 && (
            <div className="divide-y divide-gray-50">
              {filteredLogs.map((log) => {
                const LevelIcon = getLevelIcon(log.level);
                const CategoryIcon = getCategoryIcon(log.category);
                const isExpanded = selectedLog?.id === log.id;

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() =>
                      setSelectedLog(isExpanded ? null : log)
                    }
                    className={`px-6 py-4 cursor-pointer transition-colors ${
                      isExpanded ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg flex-shrink-0 ${
                          log.level === "error"
                            ? "bg-red-100 text-red-600"
                            : log.level === "warning"
                            ? "bg-yellow-100 text-yellow-600"
                            : log.level === "success"
                            ? "bg-green-100 text-green-600"
                            : log.level === "info"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-purple-100 text-purple-600"
                        }`}
                      >
                        <LevelIcon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-gray-900 text-sm truncate">
                            {log.message}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase ${getLevelBadgeColor(
                              log.level
                            )}`}
                          >
                            {log.level}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <CategoryIcon className="w-3 h-3" />
                            {log.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {log.timestamp.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1 font-mono">
                            <Code className="w-3 h-3" />
                            {log.source}
                          </span>
                          {log.userId && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {log.userId}
                            </span>
                          )}
                          {log.ipAddress && (
                            <span className="flex items-center gap-1">
                              <Server className="w-3 h-3" />
                              {log.ipAddress}
                            </span>
                          )}
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="mt-3"
                          >
                            {log.details && (
                              <div className="bg-gray-900 text-green-400 rounded-xl p-4 font-mono text-xs overflow-auto max-h-64">
                                {log.requestId && (
                                  <p className="text-gray-400 mb-2">
                                    Request ID:{" "}
                                    <span className="text-yellow-400">{log.requestId}</span>
                                  </p>
                                )}
                                <p className="text-gray-400 mb-2">
                                  Timestamp:{" "}
                                  <span className="text-white">{log.timestamp.toISOString()}</span>
                                </p>
                                <p className="whitespace-pre-wrap mt-2 text-green-300">
                                  {log.details}
                                </p>
                              </div>
                            )}
                            {!log.details && (
                              <p className="text-xs text-gray-400 italic">No additional details</p>
                            )}
                          </motion.div>
                        )}
                      </div>

                      <div className="flex-shrink-0 text-gray-300">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-blue-100"
        >
          <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white rounded-xl p-4 text-left hover:shadow-md transition-shadow border border-white"
              onClick={() => {
                setFilterLevel("error");
                setFilterCategory("all");
                setDateFilter("all");
                toast.info("Showing error-level logs only.");
              }}
            >
              <XCircle className="w-7 h-7 text-red-500 mb-2" />
              <h3 className="font-bold text-gray-900 mb-1 text-sm">View All Errors</h3>
              <p className="text-xs text-gray-500">Filter to error-level logs</p>
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white rounded-xl p-4 text-left hover:shadow-md transition-shadow border border-white"
              onClick={() => {
                setFilterCategory("security");
                setFilterLevel("all");
                setDateFilter("all");
                toast.info("Filtered to security category.");
              }}
            >
              <Shield className="w-7 h-7 text-purple-500 mb-2" />
              <h3 className="font-bold text-gray-900 mb-1 text-sm">Security Logs</h3>
              <p className="text-xs text-gray-500">Review security-related events</p>
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={filteredLogs.length === 0}
              className="bg-white rounded-xl p-4 text-left hover:shadow-md transition-shadow border border-white disabled:opacity-50"
              onClick={() => exportLogsCsv(filteredLogs)}
            >
              <Download className="w-7 h-7 text-blue-500 mb-2" />
              <h3 className="font-bold text-gray-900 mb-1 text-sm">Export Report</h3>
              <p className="text-xs text-gray-500">Download filtered logs as CSV</p>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}
