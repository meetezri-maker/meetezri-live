import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Database,
  HardDrive,
  Download,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Calendar,
  Save,
  FileArchive,
  Cloud,
  Eye,
  X,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { toast } from "sonner";
import { api } from "../../../lib/api";

type BackupRecord = {
  id: string;
  kind: string;
  status: string;
  sizeFormatted: string;
  durationFormatted: string;
  timestampLabel: string;
  relativeTime: string;
  storagePath: string | null;
  metadata: unknown;
  errorMessage: string | null;
  createdByName: string | null;
};

type RecoveryPoint = {
  id: string;
  date: string;
  dateLabel: string;
  type: string;
  sizeFormatted: string;
};

type Dashboard = {
  records: BackupRecord[];
  stats: {
    lastBackupRelative: string;
    totalBackups: number;
    storageUsedFormatted: string;
    recoveryPointsCount: number;
    recoveryRetentionDays: number;
  };
  schedule: {
    full: string;
    incremental: string;
    snapshot: string;
  };
  recoveryPoints: RecoveryPoint[];
};

function kindLabel(kind: string): string {
  switch (kind) {
    case "full":
      return "Full backup";
    case "incremental":
      return "Incremental backup";
    case "data_export":
      return "Data export (JSON)";
    case "restore_request":
      return "Restore request";
    default:
      return kind;
  }
}

export function BackupRecovery() {
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingBackup, setViewingBackup] = useState<BackupRecord | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createKind, setCreateKind] = useState<"full" | "incremental">("full");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = (await api.admin.getBackupRecovery()) as Dashboard;
      setDashboard(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      toast.error(msg);
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyDashboard = (data: unknown) => {
    if (data && typeof data === "object" && "records" in data) {
      setDashboard(data as Dashboard);
    }
  };

  const handleViewBackup = (backup: BackupRecord) => {
    setViewingBackup(backup);
    setShowViewModal(true);
  };

  const handleRestoreBackup = async (backup: BackupRecord) => {
    if (
      !confirm(
        "This does not run a database restore on the server. It logs a restore request for audit and you should complete recovery in your hosting console (e.g. Supabase backups / PITR). Continue?"
      )
    ) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.admin.requestBackupRestore(backup.id);
      applyDashboard(res);
      toast.success("Restore request logged. Use your database host to perform the actual restore.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestorePoint = async (point: RecoveryPoint) => {
    await handleRestoreBackup({
      id: point.id,
      kind: "full",
      status: "completed",
      sizeFormatted: point.sizeFormatted,
      durationFormatted: "—",
      timestampLabel: point.dateLabel,
      relativeTime: "",
      storagePath: null,
      metadata: null,
      errorMessage: null,
      createdByName: null,
    });
  };

  const handleExportData = async () => {
    setActionLoading(true);
    try {
      const res = (await api.admin.exportBackupMetadata()) as { dashboard?: Dashboard; payload?: unknown };
      if (res.dashboard) setDashboard(res.dashboard);
      else await load();
      toast.success("Metadata export recorded. Download JSON from the new export row if needed.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setActionLoading(true);
    try {
      const res = await api.admin.createBackupRecord({ kind: createKind });
      applyDashboard(res);
      toast.success("Logical snapshot recorded.");
      setShowCreateModal(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownload = async (id: string) => {
    setActionLoading(true);
    try {
      await api.admin.downloadBackupRecordFile(id);
      toast.success("Download started");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setActionLoading(false);
    }
  };

  const stats = dashboard
    ? [
        {
          label: "Last backup",
          value: dashboard.stats.lastBackupRelative,
          icon: Clock,
          color: "from-green-500 to-emerald-600",
        },
        {
          label: "Completed snapshots",
          value: String(dashboard.stats.totalBackups),
          icon: FileArchive,
          color: "from-blue-500 to-cyan-600",
        },
        {
          label: "Storage (est.)",
          value: dashboard.stats.storageUsedFormatted,
          icon: HardDrive,
          color: "from-purple-500 to-pink-600",
        },
        {
          label: "Recovery points (30d)",
          value: `${dashboard.stats.recoveryPointsCount} (retention ${dashboard.stats.recoveryRetentionDays}d)`,
          icon: RotateCcw,
          color: "from-orange-500 to-amber-600",
        },
      ]
    : [];

  const records = dashboard?.records ?? [];
  const recoveryPoints = dashboard?.recoveryPoints ?? [];
  const schedule = dashboard?.schedule;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700 border-green-300";
      case "in_progress":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "failed":
        return "bg-red-100 text-red-700 border-red-300";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (loading && !dashboard) {
    return (
      <AdminLayoutNew>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        </div>
      </AdminLayoutNew>
    );
  }

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Backup & Recovery</h1>
            <p className="text-gray-600">
              Logical snapshots and exports stored in this app. Physical Postgres backups are managed by your host (e.g. Supabase).
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-600"
              disabled={actionLoading}
              onClick={() => void handleExportData()}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Export metadata
            </Button>
            <Button
              className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white"
              disabled={actionLoading}
              onClick={() => setShowCreateModal(true)}
            >
              <Save className="w-4 h-4 mr-2" />
              Create backup
            </Button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-white border-gray-200 p-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900 break-words">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Database className="w-6 h-6 text-blue-600" />
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Recent activity</h3>
                  <p className="text-sm text-gray-500">Last 50 records (full, incremental, exports)</p>
                </div>
              </div>

              <div className="space-y-3">
                {records.length === 0 && (
                  <p className="text-sm text-gray-500 py-4">No snapshots yet. Use Create backup or Export metadata.</p>
                )}
                {records.map((backup) => (
                  <div
                    key={backup.id}
                    className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                            backup.status === "completed"
                              ? "bg-green-100"
                              : backup.status === "in_progress"
                                ? "bg-blue-100"
                                : "bg-red-100"
                          }`}
                        >
                          {backup.status === "completed" ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : backup.status === "in_progress" ? (
                            <RotateCcw className="w-5 h-5 text-blue-600 animate-spin" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-gray-900 font-medium truncate">{kindLabel(backup.kind)}</p>
                          <p className="text-xs text-gray-500">{backup.timestampLabel}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm text-gray-900 font-medium">{backup.sizeFormatted}</p>
                        <p className="text-xs text-gray-500">{backup.durationFormatted}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-200 gap-2">
                      <span className="flex items-center gap-1 min-w-0 line-clamp-2">
                        <Cloud className="w-3 h-3 shrink-0" />
                        {backup.storagePath || "—"}
                      </span>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => handleViewBackup(backup)}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-gray-700 hover:bg-gray-700"
                          disabled={actionLoading}
                          onClick={() => void handleDownload(backup.id)}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          JSON
                        </Button>
                        {backup.status === "completed" && backup.kind !== "data_export" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            disabled={actionLoading}
                            onClick={() => void handleRestoreBackup(backup)}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Restore
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Calendar className="w-6 h-6 text-purple-600" />
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Recovery points</h3>
                  <p className="text-sm text-gray-500">Completed full backups (last 30 days)</p>
                </div>
              </div>

              <div className="space-y-3">
                {recoveryPoints.length === 0 && (
                  <p className="text-sm text-gray-500 py-4">No full backups in the last 30 days yet.</p>
                )}
                {recoveryPoints.map((point) => (
                  <div
                    key={point.id}
                    className="p-4 bg-gray-50 rounded-xl border border-gray-200"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-gray-900 font-medium text-sm">{point.dateLabel}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">{point.type}</span>
                          <span className="text-xs text-gray-500">{point.sizeFormatted}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 shrink-0"
                        disabled={actionLoading}
                        onClick={() => void handleRestorePoint(point)}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Log restore
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-white border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Save className="w-6 h-6 text-green-600" />
              <div>
                <h3 className="text-xl font-bold text-gray-900">Where physical backups live</h3>
                <p className="text-sm text-gray-500">Host-level configuration (read from env when set)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h4 className="text-gray-900 font-medium mb-2">Full backup</h4>
                <p className="text-sm text-gray-600">{schedule?.full}</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h4 className="text-gray-900 font-medium mb-2">Incremental / PITR</h4>
                <p className="text-sm text-gray-600">{schedule?.incremental}</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h4 className="text-gray-900 font-medium mb-2">App snapshots</h4>
                <p className="text-sm text-gray-600">{schedule?.snapshot}</p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
          >
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-gray-900">Create logical backup</h2>
              <button type="button" className="text-gray-500 hover:text-gray-700" onClick={() => setShowCreateModal(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Records row counts and an estimated size in the database. This does not replace your host&apos;s automated Postgres backups.
            </p>
            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="bk"
                  checked={createKind === "full"}
                  onChange={() => setCreateKind("full")}
                />
                <span>Full (all tracked tables)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="bk"
                  checked={createKind === "incremental"}
                  onChange={() => setCreateKind("incremental")}
                />
                <span>Incremental (same snapshot style; labeled incremental)</span>
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button className="flex-1" disabled={actionLoading} onClick={() => void handleCreateBackup()}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {showViewModal && viewingBackup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{kindLabel(viewingBackup.kind)}</h2>
                  <p className="text-sm text-gray-500 mt-1">{viewingBackup.timestampLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingBackup(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getStatusBadge(viewingBackup.status)}`}>
                    {viewingBackup.status}
                  </span>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Size (est.)</p>
                  <p className="text-2xl font-bold text-gray-900">{viewingBackup.sizeFormatted}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Duration</p>
                  <p className="text-xl font-semibold text-gray-900">{viewingBackup.durationFormatted}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Storage</p>
                  <p className="text-sm text-gray-900 flex items-start gap-1">
                    <Cloud className="w-4 h-4 shrink-0 mt-0.5" />
                    {viewingBackup.storagePath || "—"}
                  </p>
                </div>
              </div>

              {viewingBackup.createdByName && (
                <p className="text-sm text-gray-600">
                  Created by: <span className="font-medium">{viewingBackup.createdByName}</span>
                </p>
              )}

              {viewingBackup.errorMessage && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-800 text-sm">
                  {viewingBackup.errorMessage}
                </div>
              )}

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="text-sm font-bold text-blue-900 mb-2">Metadata</h3>
                <pre className="text-xs text-blue-900 whitespace-pre-wrap overflow-auto max-h-48">
                  {JSON.stringify(viewingBackup.metadata ?? {}, null, 2)}
                </pre>
              </div>

              <div className="pt-4 border-t border-gray-200 flex flex-wrap gap-3">
                {viewingBackup.status === "completed" && viewingBackup.kind !== "data_export" && (
                  <Button
                    className="flex-1 min-w-[120px]"
                    disabled={actionLoading}
                    onClick={() => void handleRestoreBackup(viewingBackup)}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Log restore request
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1 min-w-[120px]"
                  disabled={actionLoading}
                  onClick={() => void handleDownload(viewingBackup.id)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download JSON
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingBackup(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AdminLayoutNew>
  );
}
