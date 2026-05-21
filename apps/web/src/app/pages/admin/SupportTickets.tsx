import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  User,
  Calendar,
  Tag,
  Flag,
  Loader2,
  Send,
  UserCheck,
  RefreshCw,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { AdminTableSkeletonRows } from "../../components/admin/AdminTableSkeleton";

interface Ticket {
  id: string;
  subject: string;
  user: string;
  status: "open" | "in-progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  category: string;
  created: string;
  lastUpdate: string;
  updatedAtIso: string;
  description?: string;
  messages?: { from: string; message: string; time: string }[];
  assignedToLabel?: string | null;
  assignedToId?: string | null;
}

function mapApiStatus(raw: string | null | undefined): Ticket["status"] {
  if (raw === "in_progress") return "in-progress";
  if (raw === "open" || raw === "resolved" || raw === "closed") return raw;
  return "open";
}

function mapApiPriority(raw: string | null | undefined): Ticket["priority"] {
  if (raw === "low" || raw === "medium" || raw === "high" || raw === "urgent") return raw;
  return "medium";
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function getStatusColor(status: string) {
  switch (status) {
    case "open":       return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "in-progress":return "bg-blue-100 text-blue-700 border-blue-200";
    case "resolved":   return "bg-green-100 text-green-700 border-green-200";
    case "closed":     return "bg-gray-100 text-gray-600 border-gray-200";
    default:           return "bg-gray-100 text-gray-600";
  }
}

function getPriorityConfig(priority: string) {
  switch (priority) {
    case "urgent": return { color: "text-red-700 bg-red-50 border-red-200", dot: "bg-red-500" };
    case "high":   return { color: "text-orange-700 bg-orange-50 border-orange-200", dot: "bg-orange-400" };
    case "medium": return { color: "text-yellow-700 bg-yellow-50 border-yellow-200", dot: "bg-yellow-400" };
    default:       return { color: "text-gray-600 bg-gray-50 border-gray-200", dot: "bg-gray-400" };
  }
}

// ─── Skeleton stat card ───────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
          <div className="h-8 w-12 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="w-10 h-10 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    </Card>
  );
}

// ─── Compact modal shell ──────────────────────────────────────────────────────

function CompactModal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <motion.div
        className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        initial={{ scale: 0.95, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 8 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div className="pr-4">
            <h2 className="text-lg font-bold text-gray-900 leading-tight">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500 mt-0.5 truncate max-w-xs">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors shrink-0 mt-0.5"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-5">{children}</div>
      </motion.div>
    </motion.div>
  );
}

// ─── Full ticket detail modal ─────────────────────────────────────────────────

function TicketDetailModal({
  ticket,
  onClose,
  onReply,
  onChangeStatus,
  onAssign,
}: {
  ticket: Ticket;
  onClose: () => void;
  onReply: () => void;
  onChangeStatus: () => void;
  onAssign: () => void;
}) {
  const pc = getPriorityConfig(ticket.priority);

  return (
    <motion.div
      key="support-view-modal"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <motion.div
        className="relative z-10 w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] max-h-[90vh] flex flex-col"
        initial={{ scale: 0.96, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 12 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="pr-4 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-gray-400">#{ticket.id.slice(0, 8)}…</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(ticket.status)}`}>
                {ticket.status.replace("-", " ")}
              </span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight truncate">{ticket.subject}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto p-6 space-y-5 flex-1">
          {/* Meta row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: User, label: "User", value: ticket.user },
              { icon: Calendar, label: "Created", value: ticket.created },
              { icon: Tag, label: "Category", value: ticket.category },
              {
                icon: Flag, label: "Priority",
                value: (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${pc.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
                    {ticket.priority.toUpperCase()}
                  </span>
                ),
              },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-400 font-medium">{label}</span>
                </div>
                {typeof value === "string"
                  ? <p className="text-sm font-semibold text-gray-800 truncate">{value}</p>
                  : value}
              </div>
            ))}
          </div>

          {ticket.assignedToLabel && (
            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-700">
              <UserCheck className="w-4 h-4" />
              Assigned to <span className="font-semibold">{ticket.assignedToLabel}</span>
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</h3>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {ticket.description || "No description provided."}
              </p>
            </div>
          </div>

          {/* Conversation */}
          {ticket.messages && ticket.messages.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Conversation ({ticket.messages.length})
              </h3>
              <div className="space-y-3">
                {ticket.messages.map((msg, i) => {
                  const isSupport = msg.from === "Support Team";
                  return (
                    <div
                      key={i}
                      className={`rounded-xl p-4 border ${
                        isSupport ? "bg-blue-50 border-blue-100" : "bg-gray-50 border-gray-100"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            isSupport ? "bg-blue-500 text-white" : "bg-gray-400 text-white"
                          }`}>
                            {msg.from.charAt(0).toUpperCase()}
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{msg.from}</p>
                        </div>
                        <p className="text-xs text-gray-400">{msg.time}</p>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed pl-8">{msg.message}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer actions */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0">
          <div className="flex gap-2">
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700 gap-1.5" onClick={onReply}>
              <Send className="w-3.5 h-3.5" />
              Reply
            </Button>
            <Button variant="outline" className="flex-1 gap-1.5" onClick={onChangeStatus}>
              <RefreshCw className="w-3.5 h-3.5" />
              Status
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={onAssign}>
              <UserCheck className="w-3.5 h-3.5" />
              Assign
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SupportTickets() {
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingTicket, setViewingTicket] = useState<Ticket | null>(null);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [newStatus, setNewStatus] = useState<"open" | "in-progress" | "resolved" | "closed">("open");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [staffUsers, setStaffUsers] = useState<{ id: string; label: string }[]>([]);
  const itemsPerPage = 10;

  useEffect(() => { fetchTickets(); }, [statusFilter]);

  useEffect(() => {
    (async () => {
      try {
        const users = await api.admin.getUsers();
        const list = Array.isArray(users) ? users : [];
        setStaffUsers(
          list
            .filter((u: any) => ["super_admin", "org_admin", "team_admin"].includes(u.role))
            .map((u: any) => ({ id: u.id, label: u.full_name?.trim() || u.email || u.id }))
        );
      } catch { setStaffUsers([]); }
    })();
  }, []);

  const fetchTickets = async () => {
    try {
      setIsLoading(true);
      const params: { page: number; limit: number; status?: string } = { page: 1, limit: 200 };
      if (statusFilter !== "all") params.status = statusFilter === "in-progress" ? "in_progress" : statusFilter;
      const data = await api.admin.getSupportTickets(params);
      const list = Array.isArray(data) ? data : [];
      setTickets(list.map((t: any) => {
        const profile = t.profiles_support_tickets_user_idToprofiles;
        const assignee = t.profiles_support_tickets_assigned_toToprofiles;
        const createdAt = t.created_at ? new Date(t.created_at) : new Date();
        const updatedAt = t.updated_at ? new Date(t.updated_at) : createdAt;
        return {
          id: String(t.id),
          subject: t.subject || "(No subject)",
          user: profile?.full_name?.trim() || profile?.email || "Unknown user",
          status: mapApiStatus(t.status),
          priority: mapApiPriority(t.priority),
          category: typeof t.category === "string" && t.category ? t.category : "Support",
          created: createdAt.toLocaleString(),
          lastUpdate: updatedAt.toLocaleString(),
          updatedAtIso: updatedAt.toISOString(),
          description: t.description ?? "",
          messages: [],
          assignedToLabel: assignee?.full_name?.trim() || assignee?.email || null,
          assignedToId: t.assigned_to ? String(t.assigned_to) : null,
        };
      }));
    } catch (err) {
      console.error("Failed to fetch tickets:", err);
      toast.error("Failed to load support tickets");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = !q
      ? tickets
      : tickets.filter((t) =>
          t.subject.toLowerCase().includes(q) || t.user.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
        );
    return [...list].sort((a, b) => new Date(b.updatedAtIso).getTime() - new Date(a.updatedAtIso).getTime());
  }, [tickets, searchQuery]);

  const stats = useMemo(() => {
    const sod = new Date(); sod.setHours(0, 0, 0, 0);
    let open = 0, inProgress = 0, resolvedToday = 0, urgent = 0;
    for (const t of tickets) {
      if (t.priority === "urgent") urgent++;
      if (t.status === "open") open++;
      else if (t.status === "in-progress") inProgress++;
      else if (t.status === "resolved" && new Date(t.updatedAtIso) >= sod) resolvedToday++;
    }
    return { open, inProgress, resolvedToday, urgent, total: tickets.length };
  }, [tickets]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentTickets = filteredTickets.slice(startIndex, startIndex + itemsPerPage);

  const handleViewTicket = (ticket: Ticket) => {
    setViewingTicket(ticket);
    setNewStatus(ticket.status);
    (async () => {
      try {
        const full = (await api.admin.getSupportTicket(ticket.id)) as any;
        const msgs = Array.isArray(full?.support_ticket_messages)
          ? full.support_ticket_messages.map((m: any) => ({
              from: m?.author_role === "support" ? "Support Team" : m?.profiles?.full_name?.trim() || "User",
              message: m?.body || "",
              time: m?.created_at ? new Date(m.created_at).toLocaleString() : "",
            }))
          : [];
        setViewingTicket((prev) => prev ? { ...prev, description: full?.description ?? prev.description, messages: msgs } : prev);
      } catch (e) { console.error(e); }
    })();
  };

  const refreshViewedTicket = async (id: string) => {
    const full = (await api.admin.getSupportTicket(id)) as any;
    const msgs = Array.isArray(full?.support_ticket_messages)
      ? full.support_ticket_messages.map((m: any) => ({
          from: m?.author_role === "support" ? "Support Team" : m?.profiles?.full_name?.trim() || "User",
          message: m?.body || "",
          time: m?.created_at ? new Date(m.created_at).toLocaleString() : "",
        }))
      : [];
    setViewingTicket((prev) => prev ? { ...prev, description: full?.description ?? prev.description, messages: msgs } : prev);
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !viewingTicket) { toast.error("Please enter a reply message"); return; }
    try {
      setIsSending(true);
      await api.support.addMessage(viewingTicket.id, replyMessage.trim());
      toast.success("Reply sent");
      setReplyMessage("");
      setShowReplyModal(false);
      await Promise.all([fetchTickets(), refreshViewedTicket(viewingTicket.id)]);
    } catch (e) {
      console.error(e); toast.error("Failed to send reply");
    } finally { setIsSending(false); }
  };

  const handleUpdateStatus = async () => {
    if (!viewingTicket) return;
    try {
      setIsUpdatingStatus(true);
      const apiStatus = newStatus === "in-progress" ? "in_progress" : newStatus;
      await api.admin.updateSupportTicket(viewingTicket.id, { status: apiStatus as any });
      toast.success("Status updated");
      setShowStatusModal(false);
      setViewingTicket((prev) => prev ? { ...prev, status: newStatus } : prev);
      await fetchTickets();
    } catch (e) {
      console.error(e); toast.error("Failed to update status");
    } finally { setIsUpdatingStatus(false); }
  };

  const handleAssignAgent = async () => {
    if (!viewingTicket) return;
    try {
      setIsAssigning(true);
      await api.admin.updateSupportTicket(viewingTicket.id, { assigned_to: selectedAgent || null });
      const opt = staffUsers.find((s) => s.id === selectedAgent);
      toast.success("Assignee updated");
      setShowAssignModal(false);
      setViewingTicket((prev) =>
        prev ? { ...prev, assignedToId: selectedAgent, assignedToLabel: opt?.label ?? null } : prev
      );
      await fetchTickets();
    } catch (e) {
      console.error(e); toast.error("Failed to assign ticket");
    } finally { setIsAssigning(false); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const statCards = [
    { label: "Open", value: stats.open, icon: AlertCircle, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-100" },
    { label: "In Progress", value: stats.inProgress, icon: Clock, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
    { label: "Resolved Today", value: stats.resolvedToday, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", border: "border-green-100" },
    { label: "Urgent / Total", value: `${stats.urgent} / ${stats.total}`, icon: MessageSquare, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
  ];

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        {/* Page Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Support Tickets</h1>
              <p className="text-muted-foreground text-sm">Manage user support requests and inquiries</p>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <StatCardSkeleton />
                </motion.div>
              ))
            : statCards.map((card, i) => (
                <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className={`p-5 border ${card.border} ${card.bg}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-xs font-medium ${card.color} uppercase tracking-wide mb-1`}>{card.label}</p>
                        <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                      </div>
                      <div className={`w-10 h-10 rounded-xl ${card.bg} border ${card.border} flex items-center justify-center`}>
                        <card.icon className={`w-5 h-5 ${card.color}`} />
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
        </div>

        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by subject, user, or ticket ID…"
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </Card>
        </motion.div>

        {/* Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/80 border-b">
                  <tr>
                    {["Ticket #", "Subject", "User", "Category", "Priority", "Status", "Last Update", ""].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {isLoading && <AdminTableSkeletonRows columns={8} rows={8} padding="comfortable" />}

                  {!isLoading && filteredTickets.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <MessageSquare className="w-8 h-8 text-gray-300" />
                          <p className="text-sm text-muted-foreground">
                            {tickets.length === 0 ? "No support tickets yet." : "No tickets match your search."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!isLoading && currentTickets.map((ticket) => {
                    const pc = getPriorityConfig(ticket.priority);
                    return (
                      <tr
                        key={ticket.id}
                        className="hover:bg-gray-50/70 transition-colors cursor-pointer"
                        onClick={() => handleViewTicket(ticket)}
                      >
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="font-mono text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                            #{ticket.id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-medium text-sm text-gray-900 max-w-xs truncate">{ticket.subject}</p>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {ticket.user.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm text-gray-700">{ticket.user}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-full text-xs font-medium">
                            {ticket.category}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${pc.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
                            {ticket.priority.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(ticket.status)}`}>
                            {ticket.status.replace("-", " ")}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-xs text-gray-400">{ticket.lastUpdate}</td>
                        <td className="px-5 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => handleViewTicket(ticket)}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-5 py-4 border-t bg-gray-50/50 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {isLoading
                  ? "Loading…"
                  : filteredTickets.length === 0
                  ? "No tickets to show"
                  : `Showing ${startIndex + 1}–${Math.min(startIndex + itemsPerPage, filteredTickets.length)} of ${filteredTickets.length}${
                      searchQuery.trim() ? ` (filtered from ${tickets.length})` : ""
                    }`}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  Next
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* ── Ticket Detail Modal ── */}
        <AnimatePresence>
          {viewingTicket && !showReplyModal && !showStatusModal && !showAssignModal && (
            <TicketDetailModal
              ticket={viewingTicket}
              onClose={() => setViewingTicket(null)}
              onReply={() => setShowReplyModal(true)}
              onChangeStatus={() => { setNewStatus(viewingTicket.status); setShowStatusModal(true); }}
              onAssign={() => { setSelectedAgent(viewingTicket.assignedToId || ""); setShowAssignModal(true); }}
            />
          )}
        </AnimatePresence>

        {/* ── Reply Modal ── */}
        <AnimatePresence>
          {showReplyModal && viewingTicket && (
            <CompactModal
              key="reply-modal"
              title="Reply to Ticket"
              subtitle={viewingTicket.subject}
              onClose={() => { if (!isSending) setShowReplyModal(false); }}
            >
              <div className="space-y-4">
                {/* Compact ticket meta */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {viewingTicket.user.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{viewingTicket.user}</p>
                    <p className="text-xs text-gray-400">{viewingTicket.category} · {viewingTicket.created}</p>
                  </div>
                  <span className={`ml-auto shrink-0 inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(viewingTicket.status)}`}>
                    {viewingTicket.status.replace("-", " ")}
                  </span>
                </div>

                {/* Last message preview if any */}
                {viewingTicket.messages && viewingTicket.messages.length > 0 && (() => {
                  const last = viewingTicket.messages[viewingTicket.messages.length - 1];
                  return (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-semibold text-gray-700">{last.from}</span>
                        <span className="text-xs text-gray-400">· {last.time}</span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">{last.message}</p>
                    </div>
                  );
                })()}

                {/* Textarea */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Your Reply</label>
                  <textarea
                    rows={5}
                    placeholder="Type your reply here…"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-shadow"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    disabled={isSending}
                  />
                  <p className="text-xs text-gray-400">{replyMessage.trim().length} characters</p>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
                    onClick={handleSendReply}
                    disabled={isSending || !replyMessage.trim()}
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {isSending ? "Sending…" : "Send Reply"}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setShowReplyModal(false)} disabled={isSending}>
                    Cancel
                  </Button>
                </div>
              </div>
            </CompactModal>
          )}
        </AnimatePresence>

        {/* ── Change Status Modal ── */}
        <AnimatePresence>
          {showStatusModal && viewingTicket && (
            <CompactModal
              key="status-modal"
              title="Change Status"
              subtitle={viewingTicket.subject}
              onClose={() => { if (!isUpdatingStatus) setShowStatusModal(false); }}
            >
              <div className="space-y-5">
                {/* Current status */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-sm text-gray-500">Current status</span>
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(viewingTicket.status)}`}>
                    {viewingTicket.status.replace("-", " ")}
                  </span>
                </div>

                {/* Status select */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">New Status</label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none h-11 rounded-xl border border-gray-200 bg-white px-4 pr-10 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-shadow cursor-pointer"
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as typeof newStatus)}
                      disabled={isUpdatingStatus}
                    >
                      <option value="open">Open</option>
                      <option value="in-progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
                    onClick={handleUpdateStatus}
                    disabled={isUpdatingStatus || newStatus === viewingTicket.status}
                  >
                    {isUpdatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {isUpdatingStatus ? "Updating…" : "Update Status"}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setShowStatusModal(false)} disabled={isUpdatingStatus}>
                    Cancel
                  </Button>
                </div>
              </div>
            </CompactModal>
          )}
        </AnimatePresence>

        {/* ── Assign Modal ── */}
        <AnimatePresence>
          {showAssignModal && viewingTicket && (
            <CompactModal
              key="assign-modal"
              title="Assign to Team Member"
              subtitle={viewingTicket.subject}
              onClose={() => { if (!isAssigning) setShowAssignModal(false); }}
            >
              <div className="space-y-5">
                {/* Current assignee */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-sm text-gray-500">Currently assigned to</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {viewingTicket.assignedToLabel || <span className="text-gray-400 font-normal">Unassigned</span>}
                  </span>
                </div>

                {/* Agent select */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Assign to</label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none h-11 rounded-xl border border-gray-200 bg-white px-4 pr-10 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-shadow cursor-pointer"
                      value={selectedAgent}
                      onChange={(e) => setSelectedAgent(e.target.value)}
                      disabled={isAssigning}
                    >
                      <option value="">Unassigned</option>
                      {staffUsers.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {staffUsers.length === 0 && (
                    <p className="text-xs text-amber-600">No admin staff found. Only super/org/team admins can be assigned.</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
                    onClick={handleAssignAgent}
                    disabled={isAssigning}
                  >
                    {isAssigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                    {isAssigning ? "Assigning…" : "Confirm Assign"}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setShowAssignModal(false)} disabled={isAssigning}>
                    Cancel
                  </Button>
                </div>
              </div>
            </CompactModal>
          )}
        </AnimatePresence>
      </div>
    </AdminLayoutNew>
  );
}
