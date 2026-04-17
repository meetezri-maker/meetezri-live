import { useState, useEffect, useCallback, useMemo } from "react";
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
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";

interface ModerationItem {
  id: string;
  source: "community_post" | "crisis_event";
  sourceId: string;
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

function severityFromFlags(count: number): ModerationItem["severity"] {
  if (count >= 5) return "critical";
  if (count >= 3) return "high";
  if (count >= 2) return "medium";
  return "low";
}

function riskToSeverity(risk: string): ModerationItem["severity"] {
  const r = (risk || "").toLowerCase();
  if (r === "critical") return "critical";
  if (r === "high") return "high";
  if (r === "medium") return "medium";
  return "low";
}

function mapCrisisStatusToUi(
  s: string
): "pending" | "approved" | "rejected" {
  const x = (s || "").toLowerCase();
  if (x === "resolved") return "approved";
  return "pending";
}

export function ContentModeration() {
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<ModerationItem | null>(null);
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [posts, crises] = await Promise.all([
        api.admin.getCommunityPosts() as Promise<any[]>,
        api.admin.getCrisisEvents({ limit: 100 }) as Promise<any[]>,
      ]);

      const relevantPosts = (Array.isArray(posts) ? posts : []).filter(
        (p) => (p.flag_count ?? 0) > 0 || p.locked_at
      );

      const postItems: ModerationItem[] = relevantPosts.map((p) => {
        const name = p.profiles?.full_name || p.profiles?.email || "User";
        const pending = (p.flag_count ?? 0) > 0 && !p.locked_at;
        const locked = Boolean(p.locked_at);
        const uiStatus: ModerationItem["status"] = locked
          ? "rejected"
          : pending
            ? "pending"
            : "approved";
        return {
          id: `post:${p.id}`,
          source: "community_post" as const,
          sourceId: p.id,
          type: "comment" as const,
          userId: p.user_id,
          userName: name,
          content: (p.content || "").slice(0, 2000),
          flagReason: `Community flags (${p.flag_count ?? 0})`,
          flaggedBy: (p.flag_count ?? 0) > 0 ? ("user" as const) : ("auto" as const),
          severity: severityFromFlags(p.flag_count ?? 0),
          timestamp: new Date(p.created_at),
          status: uiStatus,
          reviewedBy: locked ? "Moderator (locked)" : undefined,
        };
      });

      const crisisItems: ModerationItem[] = (Array.isArray(crises) ? crises : []).map((c) => {
        const name = c.profiles?.full_name || c.profiles?.email || "User";
        const kw = Array.isArray(c.keywords) ? c.keywords.join(", ") : "";
        const ui = mapCrisisStatusToUi(c.status);
        return {
          id: `crisis:${c.id}`,
          source: "crisis_event" as const,
          sourceId: c.id,
          type: "session" as const,
          userId: c.user_id,
          userName: name,
          content: [c.event_type, kw].filter(Boolean).join(" ") || "Crisis signal",
          flagReason: `Crisis risk: ${c.risk_level || "unknown"}`,
          flaggedBy: "auto" as const,
          severity: riskToSeverity(c.risk_level),
          timestamp: new Date(c.created_at),
          status: ui,
          reviewedBy: ui === "approved" ? c.assigned_profile?.full_name || "Team" : undefined,
        };
      });

      const merged = [...postItems, ...crisisItems].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );
      setItems(merged);
    } catch (e) {
      console.error(e);
      setError("Could not load moderation data. Check admin sign-in.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesStatus = filter === "all" || item.status === filter;
      const matchesSeverity = severityFilter === "all" || item.severity === severityFilter;
      const matchesSearch =
        item.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.flagReason.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSeverity && matchesSearch;
    });
  }, [items, filter, severityFilter, searchQuery]);

  const stats = useMemo(() => {
    const pending = items.filter((i) => i.status === "pending");
    return {
      pending: pending.length,
      critical: pending.filter((i) => i.severity === "critical").length,
      autoFlagged: pending.filter((i) => i.flaggedBy === "auto").length,
      userReported: pending.filter((i) => i.flaggedBy === "user").length,
    };
  }, [items]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "from-red-500 to-rose-600";
      case "high":
        return "from-orange-500 to-amber-600";
      case "medium":
        return "from-yellow-500 to-orange-500";
      case "low":
        return "from-blue-500 to-indigo-600";
      default:
        return "from-gray-500 to-slate-600";
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-700";
      case "high":
        return "bg-orange-100 text-orange-700";
      case "medium":
        return "bg-yellow-100 text-yellow-700";
      case "low":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "approved":
        return "bg-green-100 text-green-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "journal":
        return BookOpen;
      case "session":
        return MessageSquare;
      case "profile":
        return User;
      default:
        return MessageSquare;
    }
  };

  const handleApprove = async (item: ModerationItem) => {
    setActionLoading(true);
    try {
      if (item.source === "community_post") {
        await api.admin.patchCommunityPost(item.sourceId, { flag_count: 0, locked: false });
      } else {
        await api.admin.updateCrisisEventStatus(item.sourceId, {
          status: "in_progress",
          notes: "Reviewed from Content Moderation — triaged",
        });
      }
      setSelectedItem(null);
      await load();
    } catch (e) {
      console.error(e);
      alert("Action failed. Check permissions and try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (item: ModerationItem) => {
    setActionLoading(true);
    try {
      if (item.source === "community_post") {
        await api.admin.deleteCommunityPost(item.sourceId);
      } else {
        await api.admin.updateCrisisEventStatus(item.sourceId, {
          status: "resolved",
          notes: "Closed from Content Moderation after review",
        });
      }
      setSelectedItem(null);
      await load();
    } catch (e) {
      console.error(e);
      alert("Action failed. Check permissions and try again.");
    } finally {
      setActionLoading(false);
    }
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
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Content Moderation</h1>
              <p className="text-gray-600 mt-1">
                Live data: community posts with <code className="text-xs bg-gray-100 px-1 rounded">flag_count &gt; 0</code>{" "}
                or locks, plus crisis events. Empty queue means nothing matched those rules—not demo data.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Refresh
            </button>
          </div>
        </motion.div>

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
        )}

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
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved / Resolved</option>
                <option value="rejected">Rejected / Locked</option>
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-2">Moderation queue</h2>
          <p className="text-sm text-gray-500 mb-6">
            Community: clear flags (approve) or remove post (reject). Crisis: triage (approve) or resolve (reject).
          </p>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-10 h-10 animate-spin mb-3" />
              Loading…
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item, index) => {
                const TypeIcon = getTypeIcon(item.type);

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`p-2 rounded-lg bg-gradient-to-br ${getSeverityColor(item.severity)}`}>
                          <TypeIcon className="w-5 h-5 text-white" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium text-gray-900">{item.userName}</span>
                            <span
                              className={`px-2 py-0.5 rounded-lg text-xs font-medium ${getSeverityBadge(item.severity)}`}
                            >
                              {item.severity.toUpperCase()}
                            </span>
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${getStatusBadge(item.status)}`}>
                              {item.status}
                            </span>
                            <span className="text-xs text-gray-400">
                              {item.source === "community_post" ? "Community post" : "Crisis event"}
                            </span>
                          </div>

                          <p className="text-sm text-gray-600 mb-2">
                            <span className="font-medium">Flag Reason:</span> {item.flagReason}
                          </p>

                          <p className="text-gray-700 text-sm bg-gray-50 p-3 rounded-lg break-words">{item.content}</p>
                        </div>
                      </div>

                      <div className="text-right text-sm text-gray-500 shrink-0">
                        <div className="flex items-center gap-1 mb-1 justify-end">
                          <Calendar className="w-4 h-4" />
                          {formatTimeAgo(item.timestamp)}
                        </div>
                        <div className="text-xs">{item.flaggedBy === "auto" ? "Auto" : "User"} flagged</div>
                      </div>
                    </div>

                    {item.status === "pending" && (
                      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 flex-wrap">
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          disabled={actionLoading}
                          onClick={() => setSelectedItem(item)}
                          className="flex-1 min-w-[120px] px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium flex items-center justify-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View Details
                        </motion.button>

                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          disabled={actionLoading}
                          onClick={() => void handleApprove(item)}
                          className="flex-1 min-w-[120px] px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white font-medium flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          {item.source === "community_post" ? "Clear flags" : "Triage"}
                        </motion.button>

                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          disabled={actionLoading}
                          onClick={() => void handleReject(item)}
                          className="flex-1 min-w-[120px] px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium flex items-center justify-center gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          {item.source === "community_post" ? "Remove post" : "Resolve"}
                        </motion.button>
                      </div>
                    )}

                    {item.reviewedBy && (
                      <div className="mt-3 pt-3 border-t border-gray-200 text-sm text-gray-600">
                        {item.reviewedBy}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {!loading && filteredItems.length === 0 && (
            <div className="text-center py-12">
              {items.length === 0 ? (
                <>
                  <Flag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-900 font-medium mb-2">Nothing in the moderation queue</p>
                  <p className="text-sm text-gray-600 max-w-lg mx-auto">
                    There are no flagged or locked community posts and no crisis events returned by the API. This is
                    expected on a quiet or new environment.
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
                  <p className="text-gray-600">No items match your filters</p>
                  {filter === "pending" && (
                    <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
                      Try <strong>All Status</strong> to include resolved crisis events and cleared posts.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </motion.div>

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
                  <label className="text-sm font-medium text-gray-600">Source</label>
                  <p className="text-gray-900">
                    {selectedItem.source === "community_post" ? "Community post" : "Crisis event"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">Flag Reason</label>
                  <p className="text-gray-900">{selectedItem.flagReason}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">Content</label>
                  <p className="text-gray-900 bg-gray-50 p-4 rounded-xl whitespace-pre-wrap break-words">
                    {selectedItem.content}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">Severity</label>
                  <span
                    className={`inline-block px-3 py-1 rounded-lg text-sm font-medium ${getSeverityBadge(selectedItem.severity)}`}
                  >
                    {selectedItem.severity.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 flex-wrap">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 min-w-[100px] px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                >
                  Close
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={actionLoading}
                  onClick={() => void handleApprove(selectedItem)}
                  className="flex-1 min-w-[100px] px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white font-medium"
                >
                  {selectedItem.source === "community_post" ? "Clear flags" : "Triage"}
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={actionLoading}
                  onClick={() => void handleReject(selectedItem)}
                  className="flex-1 min-w-[100px] px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium"
                >
                  {selectedItem.source === "community_post" ? "Remove post" : "Resolve"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AdminLayoutNew>
  );
}
