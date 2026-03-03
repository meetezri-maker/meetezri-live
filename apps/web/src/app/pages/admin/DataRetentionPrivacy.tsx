import { motion } from "motion/react";
import { useState } from "react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Database,
  Trash2,
  Clock,
  Shield,
  FileText,
  Download,
  Lock,
  Eye,
  Users,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Settings,
  Archive,
  XCircle,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";

type Policy = {
  dataType: string;
  retention: string;
  autoDelete: boolean;
  lastReview: string;
  itemsAffected: number;
  status: string;
};

export function DataRetentionPrivacy() {
  const [activeTab, setActiveTab] = useState<"retention" | "privacy" | "requests">("retention");
  const [showAddPolicyModal, setShowAddPolicyModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showConfigureModal, setShowConfigureModal] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);

  const retentionPolicies: Policy[] = [
    {
      dataType: "User Personal Information",
      retention: "Account lifetime + 7 years",
      autoDelete: false,
      lastReview: "Dec 15, 2024",
      itemsAffected: 8234,
      status: "active",
    },
    {
      dataType: "Session Transcripts",
      retention: "7 years (HIPAA requirement)",
      autoDelete: false,
      lastReview: "Dec 15, 2024",
      itemsAffected: 45678,
      status: "active",
    },
    {
      dataType: "Mood Check-in Data",
      retention: "5 years",
      autoDelete: true,
      lastReview: "Dec 1, 2024",
      itemsAffected: 123456,
      status: "active",
    },
    {
      dataType: "Journal Entries",
      retention: "User-controlled (default: account lifetime)",
      autoDelete: false,
      lastReview: "Nov 20, 2024",
      itemsAffected: 34567,
      status: "active",
    },
    {
      dataType: "Audit Logs",
      retention: "7 years",
      autoDelete: true,
      lastReview: "Dec 15, 2024",
      itemsAffected: 987654,
      status: "active",
    },
    {
      dataType: "Temporary Session Data",
      retention: "24 hours",
      autoDelete: true,
      lastReview: "Dec 29, 2024",
      itemsAffected: 1234,
      status: "active",
    },
    {
      dataType: "Marketing Communications Data",
      retention: "2 years after last contact",
      autoDelete: true,
      lastReview: "Dec 1, 2024",
      itemsAffected: 5432,
      status: "active",
    },
  ];

  const privacyRequests = [
    {
      id: 1,
      type: "Data Export",
      user: "Sarah Johnson",
      email: "sarah.j@example.com",
      requestDate: "Dec 28, 2024",
      status: "completed",
      completedDate: "Dec 28, 2024",
    },
    {
      id: 2,
      type: "Account Deletion",
      user: "Michael Chen",
      email: "michael.c@example.com",
      requestDate: "Dec 27, 2024",
      status: "in_progress",
      completedDate: null,
    },
    {
      id: 3,
      type: "Data Export",
      user: "Emily Davis",
      email: "emily.d@example.com",
      requestDate: "Dec 26, 2024",
      status: "completed",
      completedDate: "Dec 26, 2024",
    },
    {
      id: 4,
      type: "Data Correction",
      user: "James Wilson",
      email: "james.w@example.com",
      requestDate: "Dec 25, 2024",
      status: "pending",
      completedDate: null,
    },
    {
      id: 5,
      type: "Data Export",
      user: "Lisa Anderson",
      email: "lisa.a@example.com",
      requestDate: "Dec 24, 2024",
      status: "completed",
      completedDate: "Dec 24, 2024",
    },
  ];

  const stats = {
    totalPolicies: retentionPolicies.length,
    activePolicies: retentionPolicies.filter(p => p.status === "active").length,
    totalRequests: privacyRequests.length,
    pendingRequests: privacyRequests.filter(r => r.status === "pending" || r.status === "in_progress").length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
      case "completed":
        return "bg-green-100 text-green-700 border-green-300";
      case "in_progress":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "pending":
        return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "inactive":
        return "bg-gray-100 text-gray-700 border-gray-300";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getRequestTypeIcon = (type: string) => {
    switch (type) {
      case "Data Export":
        return Download;
      case "Account Deletion":
        return Trash2;
      case "Data Correction":
        return FileText;
      default:
        return FileText;
    }
  };

  const handleArchiveData = () => {
    toast.success("Archive process initiated. Old data will be archived within 24 hours.");
    setShowArchiveModal(false);
  };

  const handleAddPolicy = () => {
    toast.success("New retention policy added successfully!");
    setShowAddPolicyModal(false);
  };

  const handleViewPolicy = (policy: Policy) => {
    setSelectedPolicy(policy);
    setShowViewModal(true);
  };

  const handleConfigurePolicy = (policy: Policy) => {
    setSelectedPolicy(policy);
    setShowConfigureModal(true);
  };

  const handleSaveConfiguration = () => {
    toast.success(`Configuration saved for ${selectedPolicy?.dataType}`);
    setShowConfigureModal(false);
    setSelectedPolicy(null);
  };

  const handleProcessRequest = (requestId: number) => {
    const request = privacyRequests.find(r => r.id === requestId);
    if (request) {
      toast.success(`Processing ${request.type} request for ${request.user}`);
    }
  };

  const handleViewRequest = (requestId: number) => {
    const request = privacyRequests.find(r => r.id === requestId);
    if (request) {
      toast.info(`Viewing details for ${request.user}'s request`);
    }
  };

  const handleDownloadExport = (requestId: number) => {
    const request = privacyRequests.find(r => r.id === requestId);
    if (request) {
      toast.success(`Downloading data export for ${request.user}`);
    }
  };

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Data Retention & Privacy</h1>
                <p className="text-muted-foreground">
                  Manage data retention policies and privacy requests
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShowArchiveModal(true)}
              >
                <Archive className="w-4 h-4" />
                Archive Old Data
              </Button>
              <Button
                className="gap-2"
                onClick={() => setShowAddPolicyModal(true)}
              >
                <Plus className="w-4 h-4" />
                Add Policy
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Total Policies</p>
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <p className="text-3xl font-bold">{stats.totalPolicies}</p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Active Policies</p>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-green-600">{stats.activePolicies}</p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Privacy Requests</p>
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-blue-600">{stats.totalRequests}</p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Pending Requests</p>
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-3xl font-bold text-yellow-600">{stats.pendingRequests}</p>
            </Card>
          </motion.div>
        </div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-1">
            <div className="flex gap-1">
              <Button
                variant={activeTab === "retention" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setActiveTab("retention")}
              >
                <Clock className="w-4 h-4 mr-2" />
                Retention Policies
              </Button>
              <Button
                variant={activeTab === "privacy" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setActiveTab("privacy")}
              >
                <Shield className="w-4 h-4 mr-2" />
                Privacy Controls
              </Button>
              <Button
                variant={activeTab === "requests" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setActiveTab("requests")}
              >
                <FileText className="w-4 h-4 mr-2" />
                User Requests
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Retention Policies Tab */}
        {activeTab === "retention" && (
          <div className="space-y-4">
            {retentionPolicies.map((policy, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.05 }}
              >
                <Card className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Database className="w-5 h-5 text-primary" />
                        <h3 className="font-bold text-lg">{policy.dataType}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(policy.status)}`}>
                          {policy.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground mb-1">Retention Period</p>
                          <p className="font-medium">{policy.retention}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Items Affected</p>
                          <p className="font-medium">{policy.itemsAffected.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Last Review</p>
                          <p className="font-medium">{policy.lastReview}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        {policy.autoDelete ? (
                          <span className="flex items-center gap-1 text-sm text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            Auto-deletion enabled
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-sm text-yellow-600">
                            <AlertTriangle className="w-4 h-4" />
                            Manual review required
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConfigurePolicy(policy)}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Configure
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewPolicy(policy)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Privacy Controls Tab */}
        {activeTab === "privacy" && (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4">Privacy Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">Allow User Data Export</p>
                      <p className="text-sm text-muted-foreground">Users can request their data at any time</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">Allow Account Deletion</p>
                      <p className="text-sm text-muted-foreground">Users can delete their account and all data</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">Require Data Processing Consent</p>
                      <p className="text-sm text-muted-foreground">Users must explicitly consent to data processing</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">Anonymous Usage Analytics</p>
                      <p className="text-sm text-muted-foreground">Collect anonymized usage data for improvements</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4">Data Processing Agreements</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium">GDPR Data Processing Agreement</p>
                        <p className="text-sm text-muted-foreground">Last updated: Dec 15, 2024</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium">HIPAA Business Associate Agreement</p>
                        <p className="text-sm text-muted-foreground">Last updated: Dec 15, 2024</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        )}

        {/* User Requests Tab */}
        {activeTab === "requests" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-4 font-medium">Request Type</th>
                      <th className="text-left p-4 font-medium">User</th>
                      <th className="text-left p-4 font-medium">Email</th>
                      <th className="text-left p-4 font-medium">Requested</th>
                      <th className="text-left p-4 font-medium">Status</th>
                      <th className="text-left p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {privacyRequests.map((request, index) => {
                      const Icon = getRequestTypeIcon(request.type);
                      return (
                        <motion.tr
                          key={request.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.5 + index * 0.05 }}
                          className="border-b hover:bg-gray-50"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-primary" />
                              <span className="font-medium">{request.type}</span>
                            </div>
                          </td>
                          <td className="p-4">{request.user}</td>
                          <td className="p-4 text-muted-foreground">{request.email}</td>
                          <td className="p-4">{request.requestDate}</td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(request.status)}`}>
                              {request.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              {request.status === "pending" && (
                                <Button
                                  size="sm"
                                  onClick={() => handleProcessRequest(request.id)}
                                >
                                  Process
                                </Button>
                              )}
                              {request.status === "in_progress" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewRequest(request.id)}
                                >
                                  View
                                </Button>
                              )}
                              {request.status === "completed" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDownloadExport(request.id)}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Archive Old Data Modal */}
        {showArchiveModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full"
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Archive Old Data</h2>
                  <button
                    onClick={() => setShowArchiveModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-gray-700">
                  This will archive all data that exceeds the retention period defined in your policies. Archived data will be moved to cold storage and can be retrieved if needed.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">
                      This process cannot be undone automatically. Archived data will require manual retrieval.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    className="flex-1"
                    onClick={handleArchiveData}
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Start Archiving
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowArchiveModal(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Add Policy Modal */}
        {showAddPolicyModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Add Retention Policy</h2>
                  <button
                    onClick={() => setShowAddPolicyModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-2">
                    Data Type
                  </Label>
                  <Input placeholder="e.g., User Analytics Data" />
                </div>
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-2">
                    Retention Period
                  </Label>
                  <Input placeholder="e.g., 2 years" />
                </div>
                <div>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="w-4 h-4" />
                    <span className="text-sm font-medium text-gray-700">
                      Enable auto-deletion
                    </span>
                  </label>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    className="flex-1"
                    onClick={handleAddPolicy}
                  >
                    Add Policy
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowAddPolicyModal(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* View Policy Modal */}
        {showViewModal && selectedPolicy && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full"
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Policy Details</h2>
                  <button
                    onClick={() => {
                      setShowViewModal(false);
                      setSelectedPolicy(null);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Data Type</Label>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{selectedPolicy.dataType}</p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Retention Period</Label>
                    <p className="mt-1 text-gray-900">{selectedPolicy.retention}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Status</Label>
                    <p className="mt-1">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(selectedPolicy.status)}`}>
                        {selectedPolicy.status}
                      </span>
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Items Affected</Label>
                    <p className="mt-1 text-gray-900">{selectedPolicy.itemsAffected.toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Last Review</Label>
                    <p className="mt-1 text-gray-900">{selectedPolicy.lastReview}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Auto-deletion</Label>
                    <p className="mt-1 text-gray-900">{selectedPolicy.autoDelete ? "Enabled" : "Disabled"}</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setShowViewModal(false);
                      setSelectedPolicy(null);
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Configure Policy Modal */}
        {showConfigureModal && selectedPolicy && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full"
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Configure Policy</h2>
                  <button
                    onClick={() => {
                      setShowConfigureModal(false);
                      setSelectedPolicy(null);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-2">
                    Data Type
                  </Label>
                  <Input defaultValue={selectedPolicy.dataType} />
                </div>
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-2">
                    Retention Period
                  </Label>
                  <Input defaultValue={selectedPolicy.retention} />
                </div>
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      defaultChecked={selectedPolicy.autoDelete}
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Enable auto-deletion
                    </span>
                  </label>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    className="flex-1"
                    onClick={handleSaveConfiguration}
                  >
                    Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowConfigureModal(false);
                      setSelectedPolicy(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </AdminLayoutNew>
  );
}