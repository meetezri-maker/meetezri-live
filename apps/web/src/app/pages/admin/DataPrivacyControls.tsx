import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Shield,
  Download,
  Trash2,
  Eye,
  EyeOff,
  UserX,
  FileDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  Database,
  X,
} from "lucide-react";
import { useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { toast } from "sonner";

export function DataPrivacyControls() {
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);

  const dataRequests = [
    {
      id: "1",
      type: "Data Export",
      user: "john.doe@example.com",
      status: "pending",
      requestedAt: "2 hours ago",
      deadline: "5 days",
      reason: "User requested a copy of all personal data for records",
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
    {
      id: "2",
      type: "Data Deletion",
      user: "jane.smith@example.com",
      status: "processing",
      requestedAt: "1 day ago",
      deadline: "2 days",
      reason: "Account closure - user requested all data to be deleted",
      ipAddress: "192.168.1.2",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    },
    {
      id: "3",
      type: "Data Access",
      user: "bob.wilson@example.com",
      status: "completed",
      requestedAt: "3 days ago",
      completedAt: "2 days ago",
      reason: "User wanted to review what data is being collected",
      ipAddress: "192.168.1.3",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)",
    },
  ];

  const consentRecords = [
    {
      userId: "user_1234",
      email: "user1@example.com",
      marketing: true,
      analytics: true,
      thirdParty: false,
      lastUpdated: "2024-01-15",
    },
    {
      userId: "user_5678",
      email: "user2@example.com",
      marketing: false,
      analytics: true,
      thirdParty: false,
      lastUpdated: "2024-01-18",
    },
  ];

  const stats = [
    {
      label: "Pending Requests",
      value: "12",
      icon: Clock,
      color: "from-yellow-500 to-orange-600",
    },
    {
      label: "Processed (30d)",
      value: "234",
      icon: CheckCircle2,
      color: "from-green-500 to-emerald-600",
    },
    {
      label: "Data Subjects",
      value: "1,234",
      icon: Users,
      color: "from-blue-500 to-cyan-600",
    },
    {
      label: "Consent Rate",
      value: "87%",
      icon: Shield,
      color: "from-purple-500 to-pink-600",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "processing":
        return "bg-blue-100 text-blue-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const handleApproveRequest = (requestId: string) => {
    const request = dataRequests.find((r) => r.id === requestId);
    if (request) {
      toast.success(`${request.type} request approved for ${request.user}`);
      setSelectedRequest(null);
    }
  };

  const handleRejectRequest = (requestId: string) => {
    const request = dataRequests.find((r) => r.id === requestId);
    if (request) {
      toast.error(`${request.type} request rejected for ${request.user}`);
      setSelectedRequest(null);
    }
  };

  const currentRequest = dataRequests.find((r) => r.id === selectedRequest);

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Data Privacy Controls
          </h1>
          <p className="text-gray-600">
            User data management and privacy requests
          </p>
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Privacy Requests</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>Response time: 72 hours</span>
              </div>
            </div>

            <div className="space-y-3">
              {dataRequests.map((request) => (
                <div
                  key={request.id}
                  className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                        {request.type === "Data Export" ? (
                          <FileDown className="w-5 h-5 text-purple-600" />
                        ) : request.type === "Data Deletion" ? (
                          <Trash2 className="w-5 h-5 text-red-600" />
                        ) : (
                          <Eye className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-gray-900 font-medium">{request.type}</p>
                        <p className="text-sm text-gray-600">{request.user}</p>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        request.status
                      )}`}
                    >
                      {request.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">
                      Requested: {request.requestedAt}
                    </span>
                    {request.status !== "completed" && (
                      <span className="text-xs text-orange-600">
                        Due: {request.deadline}
                      </span>
                    )}
                  </div>

                  {request.status === "pending" && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                        onClick={() => handleApproveRequest(request.id)}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-gray-300 text-gray-900 hover:bg-gray-100"
                        onClick={() => setSelectedRequest(request.id)}
                      >
                        View Details
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Consent Management</h3>
                <button
                  onClick={() => setShowSensitiveData(!showSensitiveData)}
                  className="text-gray-600 hover:text-gray-900"
                >
                  {showSensitiveData ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>

              <div className="space-y-3">
                {consentRecords.map((record) => (
                  <div
                    key={record.userId}
                    className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-gray-900 font-medium">
                          {showSensitiveData ? record.email : "••••••@••••••.com"}
                        </p>
                        <p className="text-xs text-gray-600">
                          Updated: {record.lastUpdated}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: "marketing", label: "Marketing" },
                        { key: "analytics", label: "Analytics" },
                        { key: "thirdParty", label: "3rd Party" },
                      ].map((consent) => (
                        <div
                          key={consent.key}
                          className={`px-2 py-1 rounded text-xs text-center ${
                            record[consent.key as keyof typeof record]
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {consent.label}:{" "}
                          {record[consent.key as keyof typeof record] ? "✓" : "✗"}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                Data Retention Policies
              </h3>

              <div className="space-y-4">
                {[
                  {
                    type: "User Data",
                    retention: "Active + 2 years",
                    icon: Users,
                    color: "blue",
                  },
                  {
                    type: "Session Logs",
                    retention: "90 days",
                    icon: Database,
                    color: "purple",
                  },
                  {
                    type: "Audit Trail",
                    retention: "7 years",
                    icon: Shield,
                    color: "green",
                  },
                  {
                    type: "Backup Data",
                    retention: "30 days",
                    icon: Download,
                    color: "orange",
                  },
                ].map((policy) => (
                  <div
                    key={policy.type}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg ${
                          policy.color === "blue"
                            ? "bg-blue-100"
                            : policy.color === "purple"
                            ? "bg-purple-100"
                            : policy.color === "green"
                            ? "bg-green-100"
                            : "bg-orange-100"
                        } flex items-center justify-center`}
                      >
                        <policy.icon
                          className={`w-5 h-5 ${
                            policy.color === "blue"
                              ? "text-blue-600"
                              : policy.color === "purple"
                              ? "text-purple-600"
                              : policy.color === "green"
                              ? "text-green-600"
                              : "text-orange-600"
                          }`}
                        />
                      </div>
                      <div>
                        <p className="text-gray-900 font-medium">{policy.type}</p>
                        <p className="text-sm text-gray-600">{policy.retention}</p>
                      </div>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-700">
                  All data retention policies comply with GDPR and CCPA
                  requirements.
                </p>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* View Details Modal */}
        {selectedRequest && currentRequest && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Request Details</h2>
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Request Type</label>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{currentRequest.type}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <p className="mt-1">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                          currentRequest.status
                        )}`}
                      >
                        {currentRequest.status}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">User Email</label>
                    <p className="mt-1 text-gray-900">{currentRequest.user}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Requested At</label>
                    <p className="mt-1 text-gray-900">{currentRequest.requestedAt}</p>
                  </div>
                  {currentRequest.deadline && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Deadline</label>
                      <p className="mt-1 text-orange-600 font-medium">{currentRequest.deadline}</p>
                    </div>
                  )}
                  {currentRequest.completedAt && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Completed At</label>
                      <p className="mt-1 text-green-600 font-medium">{currentRequest.completedAt}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Reason for Request</label>
                  <p className="mt-2 text-gray-900 bg-gray-50 p-4 rounded-lg">{currentRequest.reason}</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-gray-500">IP Address</label>
                    <p className="mt-1 text-gray-900 font-mono text-sm">{currentRequest.ipAddress}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">User Agent</label>
                    <p className="mt-1 text-gray-900 text-sm truncate" title={currentRequest.userAgent}>
                      {currentRequest.userAgent}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
                  <div className="flex items-center gap-3">
                    {currentRequest.status === "pending" && (
                      <>
                        <Button
                          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                          onClick={() => handleApproveRequest(currentRequest.id)}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Approve Request
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => handleRejectRequest(currentRequest.id)}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Reject Request
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      className="border-gray-300 text-gray-900 hover:bg-gray-100"
                      onClick={() => setSelectedRequest(null)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </AdminLayoutNew>
  );
}