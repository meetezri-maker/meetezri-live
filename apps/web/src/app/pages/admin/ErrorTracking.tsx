import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { api } from "../../../lib/api";
import {
  AlertTriangle,
  Bug,
  XCircle,
  CheckCircle2,
  Clock,
  User,
  Globe,
  Code,
  Filter,
  Search,
  Eye,
  Archive,
  TrendingDown,
  BarChart3,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ErrorLog {
  id: string;
  type: "error" | "warning" | "critical";
  title: string;
  message: string;
  stackTrace: string;
  endpoint: string;
  method: string;
  statusCode: number;
  user?: string;
  browser: string;
  os: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  resolved: boolean;
}

export function ErrorTracking() {
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [errorToResolve, setErrorToResolve] = useState<ErrorLog | null>(null);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchErrors = async () => {
      try {
        const data = await api.admin.getErrorLogs();
        const mappedErrors: ErrorLog[] = data.map((log: any) => ({
          id: log.id,
          type: (log.severity || 'error') as any,
          title: log.context?.title || log.message.substring(0, 50) + '...',
          message: log.message,
          stackTrace: log.stack_trace || 'No stack trace available',
          endpoint: log.context?.endpoint || 'Unknown',
          method: log.context?.method || 'GET',
          statusCode: log.context?.status_code || 500,
          user: log.context?.user_id,
          browser: log.context?.browser || 'Unknown',
          os: log.context?.os || 'Unknown',
          occurrences: log.context?.occurrences || 1,
          firstSeen: new Date(log.created_at).toLocaleString(),
          lastSeen: new Date(log.created_at).toLocaleString(),
          resolved: log.status === 'resolved'
        }));
        setErrors(mappedErrors);
      } catch (error) {
        console.error("Failed to fetch error logs:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchErrors();
  }, []);
  
  /* const errors: ErrorLog[] = [ ... ] */

  const stats = [
    {
      label: "Total Errors (24h)",
      value: errors.length.toString(),
      change: "-12%",
      trend: "down",
      icon: Bug,
      color: "from-red-500 to-rose-600",
    },
    {
      label: "Critical Issues",
      value: errors.filter(e => e.type === 'critical').length.toString(),
      change: "-50%",
      trend: "down",
      icon: AlertTriangle,
      color: "from-orange-500 to-amber-600",
    },
    {
      label: "Resolved Today",
      value: errors.filter(e => e.resolved).length.toString(),
      change: "+24%",
      trend: "up",
      icon: CheckCircle2,
      color: "from-green-500 to-emerald-600",
    },
    {
      label: "Avg Response Time",
      value: "2.3h",
      change: "-15%",
      trend: "down",
      icon: Clock,
      color: "from-blue-500 to-cyan-600",
    },
  ];

  const trendData = [
    { day: "Mon", critical: 12, error: 45, warning: 23 },
    { day: "Tue", critical: 8, error: 38, warning: 19 },
    { day: "Wed", critical: 15, error: 52, warning: 28 },
    { day: "Thu", critical: 6, error: 34, warning: 16 },
    { day: "Fri", critical: 10, error: 42, warning: 21 },
    { day: "Sat", critical: 4, error: 28, warning: 12 },
    { day: "Sun", critical: 3, error: 24, warning: 10 },
  ];

  const endpointData = [
    { endpoint: "/api/sessions", errors: 156 },
    { endpoint: "/api/ai-session", errors: 134 },
    { endpoint: "/api/user/profile", errors: 89 },
    { endpoint: "/api/mood-checkin", errors: 67 },
    { endpoint: "/api/upload/avatar", errors: 45 },
  ];

  const filteredErrors = errors.filter((error) => {
    const matchesSearch =
      error.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      error.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      error.endpoint.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "all" || error.type === selectedType;
    const matchesStatus =
      selectedStatus === "all" ||
      (selectedStatus === "unresolved" && !error.resolved) ||
      (selectedStatus === "resolved" && error.resolved);
    return matchesSearch && matchesType && matchesStatus;
  });

  const getTypeColor = (type: string) => {
    switch (type) {
      case "critical":
        return "bg-red-100 border-red-300 text-red-700";
      case "error":
        return "bg-orange-100 border-orange-300 text-orange-700";
      case "warning":
        return "bg-yellow-100 border-yellow-300 text-yellow-700";
      default:
        return "bg-gray-100 border-gray-300 text-gray-700";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "critical":
        return XCircle;
      case "error":
        return AlertTriangle;
      case "warning":
        return Bug;
      default:
        return Bug;
    }
  };

  const handleResolveError = (error: ErrorLog) => {
    setErrorToResolve(error);
    setShowResolveModal(true);
  };

  const handleArchiveErrors = () => {
    setShowArchiveModal(true);
  };

  const handleArchiveConfirmed = () => {
    const unresolvedErrors = errors.filter((error) => !error.resolved);
    setErrors(unresolvedErrors);
    setShowArchiveModal(false);
  };

  const handleResolveConfirmed = () => {
    if (errorToResolve) {
      const updatedErrors = errors.map((error) =>
        error.id === errorToResolve.id ? { ...error, resolved: true } : error
      );
      setErrors(updatedErrors);
      setShowResolveModal(false);
    }
  };

  const handleViewDetails = (error: ErrorLog) => {
    setSelectedError(error);
    setShowDetailsModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailsModal(false);
    setShowResolveModal(false);
    setShowArchiveModal(false);
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
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Error Tracking</h1>
            <p className="text-gray-600">
              Application errors, logs, and stack traces
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
              onClick={handleArchiveErrors}
            >
              <Archive className="w-4 h-4 mr-2" />
              Archive All Resolved
            </Button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-white border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}
                  >
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  <div
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      stat.trend === "down"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    <TrendingDown className="w-3 h-3" />
                    {stat.change}
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</h3>
                <p className="text-sm text-gray-600">{stat.label}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Error Trend */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    Error Trend (7 Days)
                  </h3>
                  <p className="text-sm text-gray-600">By severity level</p>
                </div>
                <BarChart3 className="w-5 h-5 text-purple-600" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      color: "#1f2937",
                    }}
                  />
                  <Bar dataKey="critical" fill="#ef4444" name="Critical" />
                  <Bar dataKey="error" fill="#f97316" name="Error" />
                  <Bar dataKey="warning" fill="#eab308" name="Warning" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Errors by Endpoint */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    Errors by Endpoint
                  </h3>
                  <p className="text-sm text-gray-600">Top affected routes</p>
                </div>
                <Code className="w-5 h-5 text-blue-600" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={endpointData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#6b7280" />
                  <YAxis dataKey="endpoint" type="category" width={150} stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      color: "#1f2937",
                    }}
                  />
                  <Bar dataKey="errors" fill="#8b5cf6" name="Errors" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-white border border-gray-200 p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search errors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Type Filter */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Types</option>
                <option value="critical">Critical</option>
                <option value="error">Error</option>
                <option value="warning">Warning</option>
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Status</option>
                <option value="unresolved">Unresolved</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </Card>
        </motion.div>

        {/* Error Logs */}
        <div className="space-y-4">
          {filteredErrors.map((error, index) => {
            const TypeIcon = getTypeIcon(error.type);
            return (
              <motion.div
                key={error.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.05 }}
              >
                <Card className="bg-white border border-gray-200 p-6 hover:shadow-lg transition-all">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border ${getTypeColor(
                        error.type
                      )}`}
                    >
                      <TypeIcon className="w-6 h-6" />
                    </div>

                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 mb-1">
                            {error.title}
                          </h3>
                          <p className="text-sm text-gray-700">{error.message}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium border ${getTypeColor(
                              error.type
                            )}`}
                          >
                            {error.type.toUpperCase()}
                          </span>
                          {error.resolved && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-300">
                              RESOLVED
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Endpoint</p>
                          <p className="text-sm text-gray-900 font-mono">{error.endpoint}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Method</p>
                          <p className="text-sm text-gray-900 font-medium">{error.method}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Status Code</p>
                          <p className="text-sm text-gray-900 font-medium">
                            {error.statusCode}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Occurrences</p>
                          <p className="text-sm text-gray-900 font-bold">
                            {error.occurrences}
                          </p>
                        </div>
                      </div>

                      {/* Stack Trace */}
                      <details className="mb-3">
                        <summary className="text-sm text-purple-600 cursor-pointer hover:text-purple-700 font-medium">
                          View Stack Trace
                        </summary>
                        <pre className="mt-2 p-3 bg-gray-900 rounded-lg text-xs text-gray-100 font-mono overflow-x-auto">
                          {error.stackTrace}
                        </pre>
                      </details>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-4 text-xs text-gray-600">
                          {error.user && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {error.user}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {error.browser}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last: {error.lastSeen}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => handleViewDetails(error)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Details
                          </Button>
                          {!error.resolved && (
                            <Button
                              size="sm"
                              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                              onClick={() => handleResolveError(error)}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Mark Resolved
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredErrors.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Card className="bg-white border border-gray-200 p-12">
              <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">No errors found</h3>
              <p className="text-gray-600">
                No errors match your current filters
              </p>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedError && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-3xl"
          >
            <Card className="bg-white border border-gray-200 p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    Error Details
                  </h3>
                  <p className="text-lg font-semibold text-gray-700">{selectedError.title}</p>
                </div>
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={handleCloseModal}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-sm text-gray-700">{selectedError.message}</p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-xs text-gray-600 mb-1">Endpoint</p>
                  <p className="text-sm text-gray-900 font-mono break-all">{selectedError.endpoint}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-xs text-gray-600 mb-1">Method</p>
                  <p className="text-sm text-gray-900 font-medium">{selectedError.method}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-xs text-gray-600 mb-1">Status Code</p>
                  <p className="text-sm text-gray-900 font-medium">
                    {selectedError.statusCode}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-xs text-gray-600 mb-1">Occurrences</p>
                  <p className="text-sm text-gray-900 font-bold">
                    {selectedError.occurrences}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-xs text-gray-600 mb-1">Browser</p>
                  <p className="text-sm text-gray-900 font-medium">{selectedError.browser}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-xs text-gray-600 mb-1">OS</p>
                  <p className="text-sm text-gray-900 font-medium">{selectedError.os}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-xs text-gray-600 mb-1">First Seen</p>
                  <p className="text-sm text-gray-900 font-medium">{selectedError.firstSeen}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-xs text-gray-600 mb-1">Last Seen</p>
                  <p className="text-sm text-gray-900 font-medium">{selectedError.lastSeen}</p>
                </div>
              </div>

              {/* Stack Trace */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Stack Trace</h4>
                <pre className="p-4 bg-gray-900 rounded-lg text-xs text-gray-100 font-mono overflow-x-auto">
                  {selectedError.stackTrace}
                </pre>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={handleCloseModal}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Close
                </Button>
                {!selectedError.resolved && (
                  <Button
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                    onClick={() => {
                      setShowDetailsModal(false);
                      handleResolveError(selectedError);
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark Resolved
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && errorToResolve && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl"
          >
            <Card className="bg-white border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      Mark Error as Resolved
                    </h3>
                    <p className="text-sm text-gray-600">
                      This will mark the error as resolved and it can be archived later
                    </p>
                  </div>
                </div>
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={handleCloseModal}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h4 className="text-lg font-semibold text-gray-900 mb-2">{errorToResolve.title}</h4>
                <p className="text-sm text-gray-700">{errorToResolve.message}</p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Endpoint</p>
                  <p className="text-sm text-gray-900 font-mono break-all">{errorToResolve.endpoint}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Method</p>
                  <p className="text-sm text-gray-900 font-medium">{errorToResolve.method}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Status Code</p>
                  <p className="text-sm text-gray-900 font-medium">
                    {errorToResolve.statusCode}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Occurrences</p>
                  <p className="text-sm text-gray-900 font-bold">
                    {errorToResolve.occurrences}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={handleCloseModal}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                  onClick={handleResolveConfirmed}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirm Resolution
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Archive Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl"
          >
            <Card className="bg-white border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                    <Archive className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      Archive All Resolved Errors
                    </h3>
                    <p className="text-sm text-gray-600">
                      This will permanently remove all resolved errors from the tracking list
                    </p>
                  </div>
                </div>
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={handleCloseModal}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-yellow-900 mb-1">Warning</h4>
                    <p className="text-sm text-yellow-800">
                      This action cannot be undone. All resolved errors will be permanently removed from the system.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Resolved errors to archive:</span>
                  <span className="text-lg font-bold text-gray-900">
                    {errors.filter((e) => e.resolved).length}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={handleCloseModal}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white"
                  onClick={handleArchiveConfirmed}
                >
                  <Archive className="w-4 h-4 mr-2" />
                  Archive All Resolved
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </AdminLayoutNew>
  );
}