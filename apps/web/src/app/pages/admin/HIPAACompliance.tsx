import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Lock,
  Eye,
  Clock,
  Users,
  Database,
  Key,
  Activity,
  X,
} from "lucide-react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { useState } from "react";

export function HIPAACompliance() {
  const [showAllAudits, setShowAllAudits] = useState(false);

  const complianceChecks = [
    { category: "Access Controls", passed: 12, failed: 0, total: 12, score: 100 },
    { category: "Audit Controls", passed: 8, failed: 0, total: 8, score: 100 },
    { category: "Data Integrity", passed: 10, failed: 1, total: 11, score: 91 },
    { category: "Encryption", passed: 15, failed: 0, total: 15, score: 100 },
    { category: "Transmission Security", passed: 7, failed: 0, total: 7, score: 100 },
    { category: "Person/Entity Auth", passed: 9, failed: 0, total: 9, score: 100 },
  ];

  const auditTrail = [
    {
      id: "1",
      action: "PHI Access",
      user: "Dr. Sarah Chen",
      resource: "Patient Record #1234",
      timestamp: "2 minutes ago",
      status: "success",
    },
    {
      id: "2",
      action: "Data Export",
      user: "Admin User",
      resource: "Session Analytics",
      timestamp: "15 minutes ago",
      status: "success",
    },
    {
      id: "3",
      action: "PHI Modification",
      user: "Dr. Michael Ross",
      resource: "Patient Record #5678",
      timestamp: "1 hour ago",
      status: "success",
    },
    {
      id: "4",
      action: "Unauthorized Access Attempt",
      user: "Unknown",
      resource: "Patient Database",
      timestamp: "3 hours ago",
      status: "blocked",
    },
  ];

  const allAuditTrail = [
    ...auditTrail,
    {
      id: "5",
      action: "Session Data Access",
      user: "Dr. Emily Johnson",
      resource: "User Session #9012",
      timestamp: "4 hours ago",
      status: "success",
    },
    {
      id: "6",
      action: "User Authentication",
      user: "System Admin",
      resource: "Admin Panel Login",
      timestamp: "5 hours ago",
      status: "success",
    },
    {
      id: "7",
      action: "PHI Access",
      user: "Dr. James Wilson",
      resource: "Patient Record #3456",
      timestamp: "6 hours ago",
      status: "success",
    },
    {
      id: "8",
      action: "Data Backup",
      user: "Automated System",
      resource: "Full Database Backup",
      timestamp: "8 hours ago",
      status: "success",
    },
    {
      id: "9",
      action: "Failed Login Attempt",
      user: "Unknown",
      resource: "Admin Panel",
      timestamp: "9 hours ago",
      status: "blocked",
    },
    {
      id: "10",
      action: "PHI Export",
      user: "Dr. Sarah Chen",
      resource: "Patient Records Batch #001",
      timestamp: "12 hours ago",
      status: "success",
    },
  ];

  const stats = [
    {
      label: "Compliance Score",
      value: "98%",
      icon: Shield,
      color: "from-green-500 to-emerald-600",
    },
    {
      label: "Passed Checks",
      value: "61/63",
      icon: CheckCircle2,
      color: "from-blue-500 to-cyan-600",
    },
    {
      label: "Audit Trail",
      value: "100%",
      icon: FileText,
      color: "from-purple-500 to-pink-600",
    },
    {
      label: "Encryption",
      value: "AES-256",
      icon: Lock,
      color: "from-orange-500 to-amber-600",
    },
  ];

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-2">HIPAA Compliance</h1>
          <p className="text-gray-600">Health data compliance and audit trail</p>
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
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              Compliance Checklist
            </h3>
            <div className="space-y-4">
              {complianceChecks.map((check) => (
                <div key={check.category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-900 font-medium">{check.category}</span>
                    <span className="text-sm text-gray-600">
                      {check.passed}/{check.total} checks passed
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          check.score === 100
                            ? "bg-gradient-to-r from-green-500 to-emerald-600"
                            : check.score >= 90
                            ? "bg-gradient-to-r from-blue-500 to-cyan-600"
                            : "bg-gradient-to-r from-yellow-500 to-orange-600"
                        }`}
                        style={{ width: `${check.score}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-900 w-12">
                      {check.score}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-white border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Audit Trail</h3>
              <Button
                variant="outline"
                className="border-gray-300 text-gray-900 hover:bg-gray-100"
                onClick={() => setShowAllAudits(!showAllAudits)}
              >
                <Eye className="w-4 h-4 mr-2" />
                {showAllAudits ? "Hide All" : "View All"}
              </Button>
            </div>
            <div className="space-y-3">
              {(showAllAudits ? allAuditTrail : auditTrail).map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          entry.status === "success"
                            ? "bg-green-100"
                            : "bg-red-100"
                        }`}
                      >
                        {entry.status === "success" ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-gray-900 font-medium">{entry.action}</p>
                        <p className="text-sm text-gray-600">
                          {entry.user} • {entry.resource}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">{entry.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}