import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Database,
  HardDrive,
  Download,
  Upload,
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
} from "lucide-react";
import { useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { toast } from "sonner";

type Backup = {
  id: string;
  type: string;
  status: string;
  size: string;
  duration: string;
  timestamp: string;
  location: string;
};

type RecoveryPoint = {
  date: string;
  type: string;
  size: string;
};

export function BackupRecovery() {
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingBackup, setViewingBackup] = useState<Backup | null>(null);

  const backups: Backup[] = [
    {
      id: "1",
      type: "Full Backup",
      status: "completed",
      size: "24.5 GB",
      duration: "45 minutes",
      timestamp: "2024-01-21 02:00 AM",
      location: "AWS S3 - us-east-1",
    },
    {
      id: "2",
      type: "Incremental Backup",
      status: "completed",
      size: "3.2 GB",
      duration: "8 minutes",
      timestamp: "2024-01-21 08:00 AM",
      location: "AWS S3 - us-east-1",
    },
    {
      id: "3",
      type: "Incremental Backup",
      status: "completed",
      size: "2.8 GB",
      duration: "7 minutes",
      timestamp: "2024-01-21 14:00 PM",
      location: "AWS S3 - us-east-1",
    },
    {
      id: "4",
      type: "Database Snapshot",
      status: "in_progress",
      size: "12.4 GB",
      duration: "Ongoing",
      timestamp: "2024-01-21 20:00 PM",
      location: "AWS S3 - us-east-1",
    },
  ];

  const recoveryPoints: RecoveryPoint[] = [
    { date: "Jan 21, 2024 - 02:00 AM", type: "Full", size: "24.5 GB" },
    { date: "Jan 20, 2024 - 02:00 AM", type: "Full", size: "24.3 GB" },
    { date: "Jan 19, 2024 - 02:00 AM", type: "Full", size: "24.1 GB" },
    { date: "Jan 18, 2024 - 02:00 AM", type: "Full", size: "23.9 GB" },
  ];

  const stats = [
    {
      label: "Last Backup",
      value: "2 hours ago",
      icon: Clock,
      color: "from-green-500 to-emerald-600",
    },
    {
      label: "Total Backups",
      value: "1,234",
      icon: FileArchive,
      color: "from-blue-500 to-cyan-600",
    },
    {
      label: "Storage Used",
      value: "456 GB",
      icon: HardDrive,
      color: "from-purple-500 to-pink-600",
    },
    {
      label: "Recovery Points",
      value: "30 days",
      icon: RotateCcw,
      color: "from-orange-500 to-amber-600",
    },
  ];

  const handleViewBackup = (backup: Backup) => {
    setViewingBackup(backup);
    setShowViewModal(true);
  };

  const handleRestoreBackup = (backup: Backup) => {
    toast.success(`Restoring ${backup.type} from ${backup.timestamp}`);
  };

  const handleRestorePoint = (point: RecoveryPoint) => {
    toast.success(`Restoring from recovery point: ${point.date}`);
  };

  const handleExportData = () => {
    toast.info("Exporting backup data");
  };

  const handleCreateBackup = () => {
    toast.success("Creating new backup...");
  };

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Backup & Recovery
            </h1>
            <p className="text-gray-600">Data backup and restore management</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
              onClick={handleExportData}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
            <Button
              className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white"
              onClick={handleCreateBackup}
            >
              <Save className="w-4 h-4 mr-2" />
              Create Backup
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
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}
                  >
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
                  <h3 className="text-xl font-bold text-gray-900">Recent Backups</h3>
                  <p className="text-sm text-gray-500">Last 24 hours</p>
                </div>
              </div>

              <div className="space-y-3">
                {backups.map((backup) => (
                  <div
                    key={backup.id}
                    className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
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
                        <div>
                          <p className="text-gray-900 font-medium">{backup.type}</p>
                          <p className="text-xs text-gray-500">{backup.timestamp}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-900 font-medium">{backup.size}</p>
                        <p className="text-xs text-gray-500">{backup.duration}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-200">
                      <span className="flex items-center gap-1">
                        <Cloud className="w-3 h-3" />
                        {backup.location}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => handleViewBackup(backup)}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                        {backup.status === "completed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleRestoreBackup(backup)}
                          >
                            <Download className="w-3 h-3 mr-1" />
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
                  <h3 className="text-xl font-bold text-gray-900">Recovery Points</h3>
                  <p className="text-sm text-gray-500">Available restore points</p>
                </div>
              </div>

              <div className="space-y-3">
                {recoveryPoints.map((point, index) => (
                  <div
                    key={index}
                    className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all cursor-pointer border border-gray-200"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-900 font-medium">{point.date}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                            {point.type}
                          </span>
                          <span className="text-xs text-gray-500">{point.size}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => handleRestorePoint(point)}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Restore
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
                <h3 className="text-xl font-bold text-gray-900">Backup Schedule</h3>
                <p className="text-sm text-gray-500">Automated backup configuration</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h4 className="text-gray-900 font-medium mb-2">Full Backup</h4>
                <p className="text-sm text-gray-600 mb-3">Complete system backup</p>
                <p className="text-xs text-gray-500">Schedule: Daily at 2:00 AM</p>
                <p className="text-xs text-gray-500">Retention: 30 days</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h4 className="text-gray-900 font-medium mb-2">Incremental Backup</h4>
                <p className="text-sm text-gray-600 mb-3">Changes since last backup</p>
                <p className="text-xs text-gray-500">Schedule: Every 6 hours</p>
                <p className="text-xs text-gray-500">Retention: 7 days</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h4 className="text-gray-900 font-medium mb-2">Database Snapshot</h4>
                <p className="text-sm text-gray-600 mb-3">Database point-in-time</p>
                <p className="text-xs text-gray-500">Schedule: Every 12 hours</p>
                <p className="text-xs text-gray-500">Retention: 14 days</p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* View Backup Modal */}
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
                  <h2 className="text-2xl font-bold text-gray-900">{viewingBackup.type}</h2>
                  <p className="text-sm text-gray-500 mt-1">{viewingBackup.timestamp}</p>
                </div>
                <button
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
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      viewingBackup.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : viewingBackup.status === "in_progress"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {viewingBackup.status === "completed"
                      ? "Completed"
                      : viewingBackup.status === "in_progress"
                      ? "In Progress"
                      : "Failed"}
                  </span>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Size</p>
                  <p className="text-2xl font-bold text-gray-900">{viewingBackup.size}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Duration</p>
                  <p className="text-xl font-semibold text-gray-900">{viewingBackup.duration}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Location</p>
                  <p className="text-sm text-gray-900 flex items-center gap-1">
                    <Cloud className="w-4 h-4" />
                    {viewingBackup.location}
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="text-sm font-bold text-blue-900 mb-2">Backup Details</h3>
                <ul className="space-y-1 text-sm text-blue-700">
                  <li>• Includes all database tables and user data</li>
                  <li>• Encrypted with AES-256 encryption</li>
                  <li>• Stored in multiple geographic locations</li>
                  <li>• Compliant with HIPAA and SOC 2 standards</li>
                </ul>
              </div>

              <div className="pt-4 border-t border-gray-200 flex gap-3">
                {viewingBackup.status === "completed" && (
                  <Button
                    className="flex-1"
                    onClick={() => {
                      handleRestoreBackup(viewingBackup);
                      setShowViewModal(false);
                      setViewingBackup(null);
                    }}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restore Backup
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    toast.success(`Downloading ${viewingBackup.type}`);
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
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
