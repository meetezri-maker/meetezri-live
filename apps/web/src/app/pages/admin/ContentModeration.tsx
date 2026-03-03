import { useState } from "react";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Flag,
  AlertTriangle,
  MessageSquare,
  User,
  Calendar,
  Eye,
  CheckCircle,
  XCircle,
  Search,
  BookOpen,
} from "lucide-react";

interface ModerationItem {
  id: string;
  type: "journal" | "session" | "comment" | "profile";
  userId: string;
  userName: string;
  content: string;
  flagReason: string;
  flaggedBy: "auto" | "user";
  severity: "low" | "medium" | "high" | "critical";
  timestamp: Date;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: string;
}

export function ContentModeration() {
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<ModerationItem | null>(null);

  // Mock moderation queue data
  const moderationItems: ModerationItem[] = [
    {
      id: "m001",
      type: "journal",
      userId: "u123",
      userName: "Anonymous User",
      content: "I've been feeling really down lately. Sometimes I think about ending it all. I don't know what to do anymore...",
      flagReason: "Suicidal ideation detected",
      flaggedBy: "auto",
      severity: "critical",
      timestamp: new Date(Date.now() - 10 * 60 * 1000),
      status: "pending"
    },
    {
      id: "m002",
      type: "session",
      userId: "u456",
      userName: "Sarah J.",
      content: "The AI companion recommended I try [brand name medication] without a prescription. This seems wrong.",
      flagReason: "Medical advice concern",
      flaggedBy: "user",
      severity: "high",
      timestamp: new Date(Date.now() - 25 * 60 * 1000),
      status: "pending"
    },
    {
      id: "m003",
      type: "journal",
      userId: "u789",
      userName: "Michael C.",
      content: "Today was a really good day. I went for a walk and felt the sunshine. Small victories!",
      flagReason: "False positive - manual review",
      flaggedBy: "auto",
      severity: "low",
      timestamp: new Date(Date.now() - 45 * 60 * 1000),
      status: "pending"
    },
    {
      id: "m004",
      type: "profile",
      userId: "u321",
      userName: "David K.",
      content: "Profile bio contains contact information and external links attempting to bypass platform.",
      flagReason: "Spam/External links",
      flaggedBy: "auto",
      severity: "medium",
      timestamp: new Date(Date.now() - 60 * 60 * 1000),
      status: "pending"
    },
    {
      id: "m005",
      type: "session",
      userId: "u654",
      userName: "Emily R.",
      content: "I'm planning to hurt my partner tonight. They deserve it for what they did.",
      flagReason: "Threat of violence",
      flaggedBy: "auto",
      severity: "critical",
      timestamp: new Date(Date.now() - 90 * 60 * 1000),
      status: "pending"
    },
    {
      id: "m006",
      type: "journal",
      userId: "u987",
      userName: "Alex T.",
      content: "Feeling anxious about tomorrow's presentation but practicing breathing exercises.",
      flagReason: "Anxiety keywords - routine monitoring",
      flaggedBy: "auto",
      severity: "low",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: "approved",
      reviewedBy: "Admin John"
    },
    {
      id: "m007",
      type: "comment",
      userId: "u234",
      userName: "Lisa A.",
      content: "This app is terrible! You're all scammers trying to steal money from vulnerable people!",
      flagReason: "Inappropriate language",
      flaggedBy: "user",
      severity: "medium",
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
      status: "rejected",
      reviewedBy: "Admin Sarah"
    }
  ];

  const filteredItems = moderationItems.filter(item => {
    const matchesStatus = filter === "all" || item.status === filter;
    const matchesSeverity = severityFilter === "all" || item.severity === severityFilter;
    const matchesSearch = 
      item.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.flagReason.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSeverity && matchesSearch;
  });

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case "critical": return "from-red-500 to-rose-600";
      case "high": return "from-orange-500 to-amber-600";
      case "medium": return "from-yellow-500 to-orange-500";
      case "low": return "from-blue-500 to-indigo-600";
      default: return "from-gray-500 to-slate-600";
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch(severity) {
      case "critical": return "bg-red-100 text-red-700";
      case "high": return "bg-orange-100 text-orange-700";
      case "medium": return "bg-yellow-100 text-yellow-700";
      case "low": return "bg-blue-100 text-blue-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "pending": return "bg-yellow-100 text-yellow-700";
      case "approved": return "bg-green-100 text-green-700";
      case "rejected": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getTypeIcon = (type: string) => {
    switch(type) {
      case "journal": return BookOpen;
      case "session": return MessageSquare;
      case "profile": return User;
      default: return MessageSquare;
    }
  };

  const stats = {
    pending: moderationItems.filter(i => i.status === "pending").length,
    critical: moderationItems.filter(i => i.severity === "critical" && i.status === "pending").length,
    autoFlagged: moderationItems.filter(i => i.flaggedBy === "auto" && i.status === "pending").length,
    userReported: moderationItems.filter(i => i.flaggedBy === "user" && i.status === "pending").length
  };

  const handleApprove = (itemId: string) => {
    console.log("Approved:", itemId);
    setSelectedItem(null);
  };

  const handleReject = (itemId: string) => {
    console.log("Rejected:", itemId);
    setSelectedItem(null);
  };

  const formatTimeAgo = (date: Date) => {
    const minutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-gray-900">Content Moderation</h1>
          <p className="text-gray-600 mt-1">Review and moderate flagged content</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600">
                <Flag className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Pending Review</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
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
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-rose-600">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Critical</p>
                <p className="text-2xl font-bold text-gray-900">{stats.critical}</p>
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
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Auto-Flagged</p>
                <p className="text-2xl font-bold text-gray-900">{stats.autoFlagged}</p>
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
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">User Reported</p>
                <p className="text-2xl font-bold text-gray-900">{stats.userReported}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search content, users, or reasons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex gap-3">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">All Severity</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Moderation Queue */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">Moderation Queue</h2>

          <div className="space-y-4">
            {filteredItems.map((item, index) => {
              const TypeIcon = getTypeIcon(item.type);
              
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg bg-gradient-to-br ${getSeverityColor(item.severity)}`}>
                        <TypeIcon className="w-5 h-5 text-white" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">{item.userName}</span>
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${getSeverityBadge(item.severity)}`}>
                            {item.severity.toUpperCase()}
                          </span>
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${getStatusBadge(item.status)}`}>
                            {item.status}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">Flag Reason:</span> {item.flagReason}
                        </p>
                        
                        <p className="text-gray-700 text-sm bg-gray-50 p-3 rounded-lg">
                          {item.content}
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-sm text-gray-500">
                      <div className="flex items-center gap-1 mb-1">
                        <Calendar className="w-4 h-4" />
                        {formatTimeAgo(item.timestamp)}
                      </div>
                      <div className="text-xs">
                        {item.flaggedBy === "auto" ? "🤖 Auto" : "👤 User"} flagged
                      </div>
                    </div>
                  </div>

                  {item.status === "pending" && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedItem(item)}
                        className="flex-1 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium flex items-center justify-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View Details
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleApprove(item.id)}
                        className="flex-1 px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white font-medium flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleReject(item.id)}
                        className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </motion.button>
                    </div>
                  )}

                  {item.reviewedBy && (
                    <div className="mt-3 pt-3 border-t border-gray-200 text-sm text-gray-600">
                      Reviewed by {item.reviewedBy}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
              <p className="text-gray-600">No items match your filters</p>
            </div>
          )}
        </motion.div>

        {/* Detail Modal */}
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedItem(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Content Details</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">User</label>
                  <p className="text-gray-900">{selectedItem.userName}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Type</label>
                  <p className="text-gray-900 capitalize">{selectedItem.type}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Flag Reason</label>
                  <p className="text-gray-900">{selectedItem.flagReason}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Content</label>
                  <p className="text-gray-900 bg-gray-50 p-4 rounded-xl">{selectedItem.content}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Severity</label>
                  <span className={`inline-block px-3 py-1 rounded-lg text-sm font-medium ${getSeverityBadge(selectedItem.severity)}`}>
                    {selectedItem.severity.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                >
                  Close
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleApprove(selectedItem.id)}
                  className="flex-1 px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white font-medium"
                >
                  Approve
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleReject(selectedItem.id)}
                  className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium"
                >
                  Reject
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AdminLayoutNew>
  );
}