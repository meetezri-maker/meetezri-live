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
  Zap,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

type TableCounts = {
  profiles: number;
  app_sessions: number;
  organizations: number;
  journal_entries: number;
  mood_entries: number;
};

type ExportMetadata = {
  counts?: TableCounts;
  exportOptions?: {
    exportType?: string;
    format?: string;
    dateRange?: string;
    compression?: string;
  };
  disclaimer?: string;
};

type BackupRecordRow = {
  id: string;
  kind: string;
  status: string;
  sizeFormatted: string;
  sizeBytes: string | null;
  metadata: ExportMetadata | null;
  createdAt: string;
  completedAt: string | null;
  createdByName: string | null;
  errorMessage?: string | null;
};

type BackupRecoveryResponse = {
  records: BackupRecordRow[];
};

type ExportTypeId = "users" | "sessions" | "analytics" | "billing" | "logs" | "full";

interface DisplayJob {
  id: string;
  name: string;
  type: ExportTypeId;
  format: string;
  status: "completed" | "processing" | "failed";
  createdAt: Date;
  completedAt?: Date;
  fileSize?: string;
  recordCount?: number;
  requestedBy: string;
  exportOptions?: ExportMetadata["exportOptions"];
}

const EXPORT_TYPE_LABELS: Record<string, string> = {
  users: "User Data",
  sessions: "Session Data",
  analytics: "Analytics",
  billing: "Billing Records",
  logs: "System Logs",
  full: "Full aggregate export",
};

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function mapApiStatus(
  s: string
): "completed" | "processing" | "failed" {
  if (s === "in_progress") return "processing";
  if (s === "failed") return "failed";
  return "completed";
}

function recordLabelForType(exportType: string | undefined): string {
  if (!exportType) return "Metadata export";
  return EXPORT_TYPE_LABELS[exportType]
    ? `${EXPORT_TYPE_LABELS[exportType]} export`
    : "Metadata export";
}

function inferExportTypeFromMeta(meta: ExportMetadata | null): ExportTypeId {
  const t = meta?.exportOptions?.exportType;
  if (t === "users" || t === "sessions" || t === "analytics" || t === "billing" || t === "logs" || t === "full") {
    return t;
  }
  return "full";
}

function estimateRecordCount(meta: ExportMetadata | null, exportType: ExportTypeId): number | undefined {
  const counts = meta?.counts;
  if (!counts) return undefined;
  switch (exportType) {
    case "users":
      return counts.profiles;
    case "sessions":
      return counts.app_sessions;
    case "analytics":
      return counts.journal_entries + counts.mood_entries;
    case "billing":
      return counts.organizations;
    case "logs":
      return counts.app_sessions;
    case "full":
      return (
        counts.profiles +
        counts.app_sessions +
        counts.organizations +
        counts.journal_entries +
        counts.mood_entries
      );
    default:
      return undefined;
  }
}

function rowsToJobs(rows: BackupRecordRow[]): DisplayJob[] {
  return rows
    .filter((r) => r.kind === "data_export")
    .map((r) => {
      const meta = r.metadata;
      const exportType = inferExportTypeFromMeta(meta);
      const opts = meta?.exportOptions;
      return {
        id: r.id,
        name: recordLabelForType(opts?.exportType),
        type: exportType,
        format: (opts?.format ?? "json").toLowerCase(),
        status: mapApiStatus(r.status),
        createdAt: new Date(r.createdAt),
        completedAt: r.completedAt ? new Date(r.completedAt) : undefined,
        fileSize: r.status === "completed" ? r.sizeFormatted : undefined,
        recordCount: estimateRecordCount(meta, exportType),
        requestedBy: r.createdByName ?? "Unknown",
        exportOptions: opts,
      };
    });
}

export function DataExport() {
  const [selectedType, setSelectedType] = useState<ExportTypeId>("users");
  const [selectedFormat, setSelectedFormat] = useState("json");
  const [dateRange, setDateRange] = useState("30d");
  const [compression, setCompression] = useState("none");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [dashboard, setDashboard] = useState<BackupRecoveryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const data = (await api.admin.getBackupRecovery()) as BackupRecoveryResponse;
      setDashboard(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load export history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const snapshotCounts = useMemo(() => {
    const rows = dashboard?.records ?? [];
    const withCounts = rows.find(
      (r) =>
        r.kind === "data_export" &&
        r.metadata &&
        typeof r.metadata === "object" &&
        (r.metadata as ExportMetadata).counts
    );
    return (withCounts?.metadata as ExportMetadata | undefined)?.counts;
  }, [dashboard]);

  const exportJobs = useMemo(() => {
    return rowsToJobs(dashboard?.records ?? []);
  }, [dashboard]);

  const stats = useMemo(() => {
    const completed = exportJobs.filter((j) => j.status === "completed").length;
    const processing = exportJobs.filter((j) => j.status === "processing").length;
    let totalBytes = 0n;
    for (const r of dashboard?.records ?? []) {
      if (r.kind !== "data_export" || r.status !== "completed" || !r.sizeBytes) continue;
      try {
        totalBytes += BigInt(r.sizeBytes);
      } catch {
        /* ignore */
      }
    }
    const totalSize = totalBytes > 0n ? formatBytes(Number(totalBytes)) : "—";
    return { completed, processing, totalSize };
  }, [exportJobs, dashboard?.records]);

  const exportTypes: {
    id: ExportTypeId;
    name: string;
    description: string;
    icon: typeof Users;
    color: string;
    estimatedLabel: string;
  }[] = [
    {
      id: "users",
      name: "User Data",
      description: "Aggregate user-related table counts (no PII in export file)",
      icon: Users,
      color: "from-blue-500 to-indigo-600",
      estimatedLabel: snapshotCounts
        ? `${snapshotCounts.profiles.toLocaleString()} profiles (rows)`
        : "Run an export to see counts",
    },
    {
      id: "sessions",
      name: "Session Data",
      description: "App session row counts and related aggregates",
      icon: Activity,
      color: "from-purple-500 to-pink-600",
      estimatedLabel: snapshotCounts
        ? `${snapshotCounts.app_sessions.toLocaleString()} sessions (rows)`
        : "Run an export to see counts",
    },
    {
      id: "analytics",
      name: "Analytics",
      description: "Journal and mood entry counts (metadata)",
      icon: BarChart3,
      color: "from-green-500 to-emerald-600",
      estimatedLabel: snapshotCounts
        ? `${(snapshotCounts.journal_entries + snapshotCounts.mood_entries).toLocaleString()} entries (rows)`
        : "Run an export to see counts",
    },
    {
      id: "billing",
      name: "Billing Records",
      description: "Organization row counts (metadata)",
      icon: FileText,
      color: "from-orange-500 to-red-600",
      estimatedLabel: snapshotCounts
        ? `${snapshotCounts.organizations.toLocaleString()} organizations (rows)`
        : "Run an export to see counts",
    },
    {
      id: "logs",
      name: "System Logs",
      description: "Uses session counts as a proxy in this metadata export",
      icon: Database,
      color: "from-gray-500 to-slate-600",
      estimatedLabel: snapshotCounts
        ? `${snapshotCounts.app_sessions.toLocaleString()} sessions (rows)`
        : "Run an export to see counts",
    },
    {
      id: "full",
      name: "Full aggregate",
      description: "All aggregate row counts in one JSON file",
      icon: Zap,
      color: "from-yellow-500 to-orange-500",
      estimatedLabel: snapshotCounts
        ? `${(
            snapshotCounts.profiles +
            snapshotCounts.app_sessions +
            snapshotCounts.organizations +
            snapshotCounts.journal_entries +
            snapshotCounts.mood_entries
          ).toLocaleString()} total rows (sum)`
        : "Run an export to see counts",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "processing":
        return "bg-blue-100 text-blue-700";
      case "failed":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return CheckCircle;
      case "processing":
        return Clock;
      case "failed":
        return AlertCircle;
      default:
        return Clock;
    }
  };

  const handleStartExport = async () => {
    const selectedTypeData = exportTypes.find((t) => t.id === selectedType);
    try {
      setExporting(true);
      await api.admin.exportBackupMetadata({
        exportType: selectedType,
        format: selectedFormat,
        dateRange,
        compression,
      });
      toast.success(
        `${selectedTypeData?.name ?? "Export"} recorded. You can download the JSON from history.`
      );
      await loadDashboard();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleExportSettings = () => {
    toast.info(
      "Exports are metadata-only JSON (aggregate row counts, no PII). Full database backups are managed in your host console (e.g. Supabase)."
    );
  };

  const handleDownload = async (job: DisplayJob) => {
    try {
      setDownloadingId(job.id);
      await api.admin.downloadBackupRecordFile(job.id);
      toast.success(`Downloaded ${job.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRetry = async (job: DisplayJob) => {
    try {
      setExporting(true);
      await api.admin.exportBackupMetadata({
        exportType: job.exportOptions?.exportType ?? job.type,
        format: job.exportOptions?.format ?? job.format,
        dateRange: job.exportOptions?.dateRange ?? "all",
        compression: job.exportOptions?.compression ?? "none",
      });
      toast.success("Export created again");
      await loadDashboard();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setExporting(false);
    }
  };

  const handleScheduleExport = () => {
    toast.info(
      "Recurring exports are not automated in this app. Use your database host’s backup schedule for retention, or run exports manually here."
    );
    setShowScheduleModal(false);
  };

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Data Export Center</h1>
            <p className="text-gray-600 mt-1">
              Create aggregate metadata exports and download JSON audit records
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => void loadDashboard()}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowScheduleModal(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center gap-2 shadow-lg"
            >
              <Calendar className="w-4 h-4" />
              About scheduling
            </motion.button>
          </div>
        </motion.div>

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
                <p className="text-gray-600 text-sm">Host backups</p>
                <p className="text-sm font-medium text-gray-700 leading-snug">
                  Use DB host for full DB backup / PITR
                </p>
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
                <p className="text-gray-600 text-sm">Export JSON size (sum)</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalSize}</p>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">Select scope</h2>

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
                  <p className="text-xs text-gray-500">{type.estimatedLabel}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-2">Export configuration</h2>
          <p className="text-sm text-gray-600 mb-6">
            The downloadable file is always JSON metadata (aggregate counts). Format and compression
            choices are stored on the export record for your audit trail.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Format (audit label)</label>
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="json">JSON (actual download)</option>
                <option value="csv">CSV (label only)</option>
                <option value="xlsx">XLSX (label only)</option>
                <option value="pdf">PDF (label only)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date range (audit label)</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Compression (audit label)</label>
              <select
                value={compression}
                onChange={(e) => setCompression(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="none">None</option>
                <option value="zip">ZIP</option>
                <option value="gzip">GZIP</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => void handleStartExport()}
              disabled={exporting || loading}
              className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {exporting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              Start export
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExportSettings}
              className="px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
              title="What gets exported?"
            >
              <Settings className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">Export history</h2>

          {loading && !dashboard ? (
            <div className="flex items-center justify-center py-16 text-gray-500 gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              Loading…
            </div>
          ) : exportJobs.length === 0 ? (
            <p className="text-gray-600 py-8 text-center">
              No exports yet. Choose a scope and click Start export.
            </p>
          ) : (
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
                      <StatusIcon
                        className={`w-5 h-5 shrink-0 ${
                          job.status === "completed"
                            ? "text-green-600"
                            : job.status === "processing"
                              ? "text-blue-600"
                              : "text-red-600"
                        }`}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-900 truncate">{job.name}</h3>
                          <span
                            className={`px-2 py-1 rounded-lg text-xs font-medium uppercase ${getStatusColor(job.status)}`}
                          >
                            {job.status}
                          </span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-lg uppercase">
                            {job.format}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                          <span>By {job.requestedBy}</span>
                          <span>•</span>
                          <span>{job.createdAt.toLocaleString()}</span>

                          {job.fileSize && (
                            <>
                              <span>•</span>
                              <span>{job.fileSize}</span>
                            </>
                          )}

                          {job.recordCount != null && (
                            <>
                              <span>•</span>
                              <span>{job.recordCount.toLocaleString()} rows (estimate)</span>
                            </>
                          )}
                        </div>
                      </div>

                      {job.status === "completed" && (
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => void handleDownload(job)}
                          disabled={downloadingId === job.id}
                          className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium flex items-center gap-2 shrink-0 disabled:opacity-60"
                        >
                          {downloadingId === job.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          Download
                        </motion.button>
                      )}

                      {job.status === "processing" && (
                        <div className="flex items-center gap-2 text-blue-600 shrink-0">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          >
                            <Clock className="w-5 h-5" />
                          </motion.div>
                          <span className="text-sm font-medium">Processing…</span>
                        </div>
                      )}

                      {job.status === "failed" && (
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => void handleRetry(job)}
                          disabled={exporting}
                          className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium shrink-0 disabled:opacity-60"
                        >
                          Retry
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {showScheduleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
            onClick={() => setShowScheduleModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Scheduling & retention</h3>
              <p className="text-sm text-gray-600 mb-6">
                This app does not run cron-based data exports. For automated database backups and
                point-in-time recovery, configure your hosting provider (for example Supabase backups).
                You can still run manual exports from this page whenever needed.
              </p>

              <div className="flex gap-3 mt-2">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                >
                  Close
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleScheduleExport}
                  className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium"
                >
                  OK
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AdminLayoutNew>
  );
}
