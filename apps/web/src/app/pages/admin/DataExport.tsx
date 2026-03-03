import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { 
  Download,
  Calendar,
  Database,
  FileText,
  Users,
  Activity,
  BarChart3,
  Settings,
  Clock,
  CheckCircle,
  AlertCircle,
  Filter,
  Zap
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ExportJob {
  id: string;
  name: string;
  type: "users" | "sessions" | "analytics" | "billing" | "logs" | "full";
  format: "csv" | "json" | "xlsx" | "pdf";
  status: "completed" | "processing" | "failed" | "scheduled";
  createdAt: Date;
  completedAt?: Date;
  fileSize?: string;
  recordCount?: number;
  requestedBy: string;
  scheduledFor?: Date;
}

export function DataExport() {
  const [selectedType, setSelectedType] = useState("users");
  const [selectedFormat, setSelectedFormat] = useState("csv");
  const [dateRange, setDateRange] = useState("30d");
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Mock export jobs
  const exportJobs: ExportJob[] = [
    {
      id: "exp001",
      name: "User Data Export",
      type: "users",
      format: "csv",
      status: "completed",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
      fileSize: "24.5 MB",
      recordCount: 1205,
      requestedBy: "Admin Sarah"
    },
    {
      id: "exp002",
      name: "Session Analytics Q2 2024",
      type: "sessions",
      format: "xlsx",
      status: "completed",
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
      fileSize: "18.2 MB",
      recordCount: 3421,
      requestedBy: "Admin John"
    },
    {
      id: "exp003",
      name: "Weekly Analytics Report",
      type: "analytics",
      format: "pdf",
      status: "processing",
      createdAt: new Date(Date.now() - 15 * 60 * 60 * 1000),
      requestedBy: "Admin Mike"
    },
    {
      id: "exp004",
      name: "Billing Data Export",
      type: "billing",
      format: "json",
      status: "scheduled",
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      scheduledFor: new Date(Date.now() + 12 * 60 * 60 * 1000),
      requestedBy: "Admin Sarah"
    },
    {
      id: "exp005",
      name: "System Logs Archive",
      type: "logs",
      format: "csv",
      status: "failed",
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      requestedBy: "Admin John"
    },
    {
      id: "exp006",
      name: "Full Database Backup",
      type: "full",
      format: "json",
      status: "completed",
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      fileSize: "2.4 GB",
      recordCount: 125640,
      requestedBy: "System Auto"
    }
  ];

  const exportTypes = [
    {
      id: "users",
      name: "User Data",
      description: "Export all user profiles, settings, and metadata",
      icon: Users,
      color: "from-blue-500 to-indigo-600",
      estimatedRecords: "1,205 users"
    },
    {
      id: "sessions",
      name: "Session Data",
      description: "Export therapy sessions, recordings, and transcripts",
      icon: Activity,
      color: "from-purple-500 to-pink-600",
      estimatedRecords: "3,421 sessions"
    },
    {
      id: "analytics",
      name: "Analytics",
      description: "Export analytics, metrics, and performance data",
      icon: BarChart3,
      color: "from-green-500 to-emerald-600",
      estimatedRecords: "30 days data"
    },
    {
      id: "billing",
      name: "Billing Records",
      description: "Export transactions, subscriptions, and invoices",
      icon: FileText,
      color: "from-orange-500 to-red-600",
      estimatedRecords: "892 transactions"
    },
    {
      id: "logs",
      name: "System Logs",
      description: "Export audit logs, error logs, and system events",
      icon: Database,
      color: "from-gray-500 to-slate-600",
      estimatedRecords: "50,000+ events"
    },
    {
      id: "full",
      name: "Full Backup",
      description: "Complete database backup (all data)",
      icon: Zap,
      color: "from-yellow-500 to-orange-500",
      estimatedRecords: "125,640 records"
    }
  ];

  const getStatusColor = (status: string) => {
    switch(status) {
      case "completed": return "bg-green-100 text-green-700";
      case "processing": return "bg-blue-100 text-blue-700";
      case "failed": return "bg-red-100 text-red-700";
      case "scheduled": return "bg-yellow-100 text-yellow-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "completed": return CheckCircle;
      case "processing": return Clock;
      case "failed": return AlertCircle;
      case "scheduled": return Calendar;
      default: return Clock;
    }
  };

  const stats = {
    completed: exportJobs.filter(j => j.status === "completed").length,
    processing: exportJobs.filter(j => j.status === "processing").length,
    scheduled: exportJobs.filter(j => j.status === "scheduled").length,
    totalSize: "2.5 GB"
  };

  const handleStartExport = () => {
    const selectedTypeData = exportTypes.find(t => t.id === selectedType);
    toast.success(`Starting ${selectedTypeData?.name} export in ${selectedFormat.toUpperCase()} format for ${dateRange}`);
  };

  const handleExportSettings = () => {
    toast.info("Opening export settings");
  };

  const handleDownload = (job: ExportJob) => {
    toast.success(`Downloading ${job.name} (${job.fileSize})`);
  };

  const handleRetry = (job: ExportJob) => {
    toast.info(`Retrying export: ${job.name}`);
  };

  const handleScheduleExport = () => {
    toast.success("Export scheduled successfully!");
    setShowScheduleModal(false);
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
            <h1 className="text-3xl font-bold text-gray-900">Data Export Center</h1>
            <p className="text-gray-600 mt-1">Export and download data in various formats</p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowScheduleModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center gap-2 shadow-lg"
          >
            <Calendar className="w-4 h-4" />
            Schedule Export
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
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
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
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Processing</p>
                <p className="text-2xl font-bold text-gray-900">{stats.processing}</p>
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
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Scheduled</p>
                <p className="text-2xl font-bold text-gray-900">{stats.scheduled}</p>
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
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total Size</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalSize}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Export Types */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">Select Data Type</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {exportTypes.map((type, index) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.id;
              
              return (
                <motion.div
                  key={type.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.05 }}
                  onClick={() => setSelectedType(type.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`border-2 rounded-xl p-5 cursor-pointer transition-all ${
                    isSelected 
                      ? "border-blue-500 bg-blue-50 shadow-md" 
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${type.color} w-fit mb-3`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  <h3 className="font-bold text-gray-900 mb-1">{type.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{type.description}</p>
                  <p className="text-xs text-gray-500">{type.estimatedRecords}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Export Configuration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">Export Configuration</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="csv">CSV (Comma Separated)</option>
                <option value="json">JSON (JavaScript Object)</option>
                <option value="xlsx">XLSX (Excel)</option>
                <option value="pdf">PDF (Report)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="1y">Last year</option>
                <option value="all">All time</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Compression</label>
              <select className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="none">None</option>
                <option value="zip">ZIP</option>
                <option value="gzip">GZIP</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStartExport}
              className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Start Export
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExportSettings}
              className="px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
            >
              <Settings className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>

        {/* Export History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">Export History</h2>

          <div className="space-y-3">
            {exportJobs.map((job, index) => {
              const StatusIcon = getStatusIcon(job.status);
              
              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + index * 0.05 }}
                  className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <StatusIcon className={`w-5 h-5 ${
                      job.status === "completed" ? "text-green-600" :
                      job.status === "processing" ? "text-blue-600" :
                      job.status === "failed" ? "text-red-600" :
                      "text-yellow-600"
                    }`} />

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900">{job.name}</h3>
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium uppercase ${getStatusColor(job.status)}`}>
                          {job.status}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-lg uppercase">
                          {job.format}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>By {job.requestedBy}</span>
                        <span>•</span>
                        <span>{job.createdAt.toLocaleString()}</span>
                        
                        {job.fileSize && (
                          <>
                            <span>•</span>
                            <span>{job.fileSize}</span>
                          </>
                        )}

                        {job.recordCount && (
                          <>
                            <span>•</span>
                            <span>{job.recordCount.toLocaleString()} records</span>
                          </>
                        )}

                        {job.scheduledFor && (
                          <>
                            <span>•</span>
                            <span className="text-yellow-600">
                              Scheduled: {job.scheduledFor.toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {job.status === "completed" && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleDownload(job)}
                        className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </motion.button>
                    )}

                    {job.status === "processing" && (
                      <div className="flex items-center gap-2 text-blue-600">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                          <Clock className="w-5 h-5" />
                        </motion.div>
                        <span className="text-sm font-medium">Processing...</span>
                      </div>
                    )}

                    {job.status === "failed" && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleRetry(job)}
                        className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium"
                      >
                        Retry
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Schedule Modal */}
        {showScheduleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowScheduleModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Schedule Export</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                  <select className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>Daily</option>
                    <option>Weekly</option>
                    <option>Monthly</option>
                    <option>Quarterly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Results To</label>
                  <input
                    type="email"
                    placeholder="admin@ezri.com"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                >
                  Cancel
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleScheduleExport}
                  className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium"
                >
                  Schedule
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AdminLayoutNew>
  );
}