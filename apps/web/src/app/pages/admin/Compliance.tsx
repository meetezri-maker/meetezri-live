import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { 
  Shield,
  FileText,
  CheckCircle,
  AlertTriangle,
  Download,
  Calendar,
  Eye,
  Lock,
  Trash2,
  Globe,
  Database,
  Clock,
  Users
} from "lucide-react";
import { useState } from "react";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

interface ComplianceItem {
  id: string;
  category: "HIPAA" | "GDPR" | "CCPA" | "SOC2";
  requirement: string;
  status: "compliant" | "partial" | "non-compliant" | "review";
  lastAudit: Date;
  nextAudit: Date;
  responsible: string;
  evidence?: string;
}

interface DataRequest {
  id: string;
  userId: string;
  userName: string;
  type: "access" | "deletion" | "portability" | "correction";
  requestedAt: Date;
  status: "pending" | "processing" | "completed" | "rejected";
  deadline: Date;
}

export function Compliance() {
  const [selectedCategory, setSelectedCategory] = useState<"all" | "HIPAA" | "GDPR" | "CCPA" | "SOC2">("all");

  // Mock compliance items
  const complianceItems: ComplianceItem[] = [
    {
      id: "c001",
      category: "HIPAA",
      requirement: "Data Encryption at Rest",
      status: "compliant",
      lastAudit: new Date("2024-05-15"),
      nextAudit: new Date("2024-11-15"),
      responsible: "Security Team",
      evidence: "AES-256 encryption enabled"
    },
    {
      id: "c002",
      category: "HIPAA",
      requirement: "Access Controls & Authentication",
      status: "compliant",
      lastAudit: new Date("2024-06-01"),
      nextAudit: new Date("2024-12-01"),
      responsible: "IT Department",
      evidence: "2FA enabled, role-based access"
    },
    {
      id: "c003",
      category: "HIPAA",
      requirement: "Audit Logging",
      status: "partial",
      lastAudit: new Date("2024-06-10"),
      nextAudit: new Date("2024-09-10"),
      responsible: "Compliance Team",
      evidence: "Logs retained for 6 months (require 12)"
    },
    {
      id: "c004",
      category: "GDPR",
      requirement: "Right to Erasure",
      status: "compliant",
      lastAudit: new Date("2024-06-20"),
      nextAudit: new Date("2024-12-20"),
      responsible: "Data Team",
      evidence: "Automated deletion workflow"
    },
    {
      id: "c005",
      category: "GDPR",
      requirement: "Data Portability",
      status: "compliant",
      lastAudit: new Date("2024-06-15"),
      nextAudit: new Date("2024-12-15"),
      responsible: "Engineering",
      evidence: "Export functionality available"
    },
    {
      id: "c006",
      category: "GDPR",
      requirement: "Consent Management",
      status: "review",
      lastAudit: new Date("2024-05-20"),
      nextAudit: new Date("2024-07-20"),
      responsible: "Legal Team",
      evidence: "Under review for EU updates"
    },
    {
      id: "c007",
      category: "CCPA",
      requirement: "Notice at Collection",
      status: "compliant",
      lastAudit: new Date("2024-06-05"),
      nextAudit: new Date("2024-12-05"),
      responsible: "Legal Team",
      evidence: "Privacy notice on signup"
    },
    {
      id: "c008",
      category: "SOC2",
      requirement: "Incident Response Plan",
      status: "compliant",
      lastAudit: new Date("2024-04-10"),
      nextAudit: new Date("2024-10-10"),
      responsible: "Security Team",
      evidence: "Documented and tested quarterly"
    }
  ];

  // Mock data requests
  const dataRequests: DataRequest[] = [
    {
      id: "dr001",
      userId: "u456",
      userName: "Sarah J.",
      type: "access",
      requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: "processing",
      deadline: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000)
    },
    {
      id: "dr002",
      userId: "u789",
      userName: "Michael C.",
      type: "deletion",
      requestedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      status: "pending",
      deadline: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000)
    },
    {
      id: "dr003",
      userId: "u234",
      userName: "Emily R.",
      type: "portability",
      requestedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: "completed",
      deadline: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000)
    }
  ];

  const filteredItems = selectedCategory === "all" 
    ? complianceItems 
    : complianceItems.filter(item => item.category === selectedCategory);

  const getStatusColor = (status: string) => {
    switch(status) {
      case "compliant": return "bg-green-100 text-green-700 border-green-300";
      case "partial": return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "non-compliant": return "bg-red-100 text-red-700 border-red-300";
      case "review": return "bg-blue-100 text-blue-700 border-blue-300";
      default: return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  const getRequestStatusColor = (status: string) => {
    switch(status) {
      case "completed": return "bg-green-100 text-green-700";
      case "processing": return "bg-blue-100 text-blue-700";
      case "pending": return "bg-yellow-100 text-yellow-700";
      case "rejected": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getRequestIcon = (type: string) => {
    switch(type) {
      case "access": return Eye;
      case "deletion": return Trash2;
      case "portability": return Download;
      case "correction": return FileText;
      default: return FileText;
    }
  };

  // Compliance overview data
  const complianceStats = [
    { name: "Compliant", value: complianceItems.filter(i => i.status === "compliant").length, color: "#10b981" },
    { name: "Partial", value: complianceItems.filter(i => i.status === "partial").length, color: "#f59e0b" },
    { name: "Review", value: complianceItems.filter(i => i.status === "review").length, color: "#3b82f6" },
    { name: "Non-Compliant", value: complianceItems.filter(i => i.status === "non-compliant").length, color: "#ef4444" }
  ];

  const categoryBreakdown = [
    { category: "HIPAA", items: complianceItems.filter(i => i.category === "HIPAA").length },
    { category: "GDPR", items: complianceItems.filter(i => i.category === "GDPR").length },
    { category: "CCPA", items: complianceItems.filter(i => i.category === "CCPA").length },
    { category: "SOC2", items: complianceItems.filter(i => i.category === "SOC2").length }
  ];

  const stats = {
    compliant: complianceItems.filter(i => i.status === "compliant").length,
    total: complianceItems.length,
    pendingRequests: dataRequests.filter(r => r.status === "pending" || r.status === "processing").length,
    nextAudit: 45 // days
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
            <h1 className="text-3xl font-bold text-gray-900">Compliance Dashboard</h1>
            <p className="text-gray-600 mt-1">HIPAA, GDPR, CCPA, and SOC2 compliance tracking</p>
          </div>

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center gap-2 shadow-lg"
            >
              <Download className="w-4 h-4" />
              Export Report
            </motion.button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-2 border-green-200"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Compliant</p>
                <p className="text-2xl font-bold text-green-600">{stats.compliant}/{stats.total}</p>
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
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Data Requests</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingRequests}</p>
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
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Next Audit</p>
                <p className="text-2xl font-bold text-gray-900">{stats.nextAudit}d</p>
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
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Frameworks</p>
                <p className="text-2xl font-bold text-gray-900">4</p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Compliance Status */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6">Compliance Status</h2>
            <ResponsiveContainer width="100%" height={250}>
              <RechartsPie>
                <Pie
                  data={complianceStats}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {complianceStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPie>
            </ResponsiveContainer>
          </motion.div>

          {/* Category Breakdown */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6">Requirements by Framework</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={categoryBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="category" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                />
                <Bar dataKey="items" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100"
        >
          <div className="flex flex-wrap gap-3">
            {(["all", "HIPAA", "GDPR", "CCPA", "SOC2"] as const).map(category => (
              <motion.button
                key={category}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                  selectedCategory === category
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {category === "all" ? "All Frameworks" : category}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Compliance Requirements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">Compliance Requirements</h2>

          <div className="space-y-4">
            {filteredItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.05 }}
                className={`border-2 rounded-xl p-5 ${getStatusColor(item.status)}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 rounded-lg text-xs font-bold bg-white bg-opacity-50">
                        {item.category}
                      </span>
                      <h3 className="font-bold text-gray-900">{item.requirement}</h3>
                      <span className="px-2 py-1 rounded-lg text-xs font-medium uppercase bg-white bg-opacity-50">
                        {item.status.replace("-", " ")}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                      <div>
                        <p className="text-gray-600">Responsible</p>
                        <p className="font-medium text-gray-900">{item.responsible}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Last Audit</p>
                        <p className="font-medium text-gray-900">{item.lastAudit.toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Next Audit</p>
                        <p className="font-medium text-gray-900">{item.nextAudit.toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Days Until</p>
                        <p className="font-medium text-gray-900">
                          {Math.ceil((item.nextAudit.getTime() - Date.now()) / (1000 * 60 * 60 * 24))}d
                        </p>
                      </div>
                    </div>

                    {item.evidence && (
                      <div className="bg-white bg-opacity-50 rounded-lg p-3">
                        <p className="text-xs font-bold text-gray-700 mb-1">Evidence:</p>
                        <p className="text-sm text-gray-900">{item.evidence}</p>
                      </div>
                    )}
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 rounded-lg hover:bg-white hover:bg-opacity-50"
                  >
                    <Eye className="w-5 h-5 text-gray-700" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Data Subject Requests */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Data Subject Access Requests (DSAR)</h2>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-sm font-medium">
              {stats.pendingRequests} Pending
            </span>
          </div>

          <div className="space-y-3">
            {dataRequests.map((request, index) => {
              const RequestIcon = getRequestIcon(request.type);
              const daysLeft = Math.ceil((request.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              
              return (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 + index * 0.05 }}
                  className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                      <RequestIcon className="w-5 h-5 text-white" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900">{request.userName}</h3>
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium uppercase ${getRequestStatusColor(request.status)}`}>
                          {request.status}
                        </span>
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-lg uppercase">
                          {request.type}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Requested {Math.floor((Date.now() - request.requestedAt.getTime()) / (1000 * 60 * 60))}h ago
                        </div>
                        <div className={`flex items-center gap-1 ${daysLeft < 7 ? "text-red-600 font-medium" : ""}`}>
                          <Calendar className="w-4 h-4" />
                          Deadline: {daysLeft} days left
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium text-sm"
                      >
                        Process
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 shadow-lg border-2 border-blue-200"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-4">Compliance Resources</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4">
              <Lock className="w-8 h-8 text-blue-600 mb-2" />
              <h3 className="font-bold text-gray-900 mb-1">Privacy Policy</h3>
              <p className="text-sm text-gray-600 mb-3">Last updated: Jun 28, 2024</p>
              <button className="text-blue-600 text-sm font-medium hover:underline">View Document</button>
            </div>

            <div className="bg-white rounded-xl p-4">
              <FileText className="w-8 h-8 text-green-600 mb-2" />
              <h3 className="font-bold text-gray-900 mb-1">Data Processing Agreement</h3>
              <p className="text-sm text-gray-600 mb-3">GDPR Compliant DPA</p>
              <button className="text-green-600 text-sm font-medium hover:underline">View Document</button>
            </div>

            <div className="bg-white rounded-xl p-4">
              <Shield className="w-8 h-8 text-purple-600 mb-2" />
              <h3 className="font-bold text-gray-900 mb-1">Security Whitepaper</h3>
              <p className="text-sm text-gray-600 mb-3">SOC2 Type II Certified</p>
              <button className="text-purple-600 text-sm font-medium hover:underline">View Document</button>
            </div>
          </div>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}