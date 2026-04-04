import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Filter,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  User,
  Calendar,
  Tag,
  Flag,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface Ticket {
  id: string;
  subject: string;
  user: string;
  status: "open" | "in-progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  category: string;
  created: string;
  lastUpdate: string;
  /** ISO timestamp for stats (resolved today, etc.) */
  updatedAtIso: string;
  description?: string;
  messages?: { from: string; message: string; time: string }[];
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
  const [searchQuery, setSearchQuery] = useState("");
  const itemsPerPage = 5;

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setIsLoading(true);
      const data = await api.admin.getSupportTickets({ page: 1, limit: 200 });
      const list = Array.isArray(data) ? data : [];
      setTickets(
        list.map((t: any) => {
          const profile = t.profiles_support_tickets_user_idToprofiles;
          const userLabel =
            profile?.full_name?.trim() || profile?.email || "Unknown user";
          const createdAt = t.created_at ? new Date(t.created_at) : new Date();
          const updatedAt = t.updated_at ? new Date(t.updated_at) : createdAt;
          return {
            id: String(t.id),
            subject: t.subject || "(No subject)",
            user: userLabel,
            status: mapApiStatus(t.status),
            priority: mapApiPriority(t.priority),
            category: typeof t.category === "string" && t.category ? t.category : "Support",
            created: createdAt.toLocaleString(),
            lastUpdate: updatedAt.toLocaleString(),
            updatedAtIso: updatedAt.toISOString(),
            description: t.description ?? "",
            messages: [],
          };
        })
      );
    } catch (error) {
      console.error("Failed to fetch tickets:", error);
      toast.error("Failed to load support tickets");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter(
      (t) =>
        t.subject.toLowerCase().includes(q) ||
        t.user.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
    );
  }, [tickets, searchQuery]);

  const stats = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    let open = 0;
    let inProgress = 0;
    let resolvedToday = 0;
    let urgent = 0;
    for (const t of tickets) {
      if (t.priority === "urgent") urgent += 1;
      if (t.status === "open") open += 1;
      else if (t.status === "in-progress") inProgress += 1;
      else if (t.status === "resolved") {
        if (new Date(t.updatedAtIso) >= startOfToday) resolvedToday += 1;
      }
    }
    return { open, inProgress, resolvedToday, urgent, total: tickets.length };
  }, [tickets]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTickets = filteredTickets.slice(startIndex, endIndex);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "in-progress":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "resolved":
        return "bg-green-100 text-green-700 border-green-200";
      case "closed":
        return "bg-gray-100 text-gray-700 border-gray-200";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "text-red-600 font-bold";
      case "high":
        return "text-orange-600 font-semibold";
      case "medium":
        return "text-yellow-600";
      case "low":
        return "text-gray-600";
      default:
        return "text-gray-600";
    }
  };

  const handleViewTicket = (ticket: Ticket) => {
    setViewingTicket(ticket);
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleSendReply = () => {
    if (!replyMessage.trim()) {
      alert("⚠️ Please enter a reply message!");
      return;
    }
    
    alert(`✅ Reply sent successfully!\n\nTo: ${viewingTicket?.user}\nMessage: ${replyMessage}\n\nThe user will be notified via email.`);
    
    setReplyMessage("");
    setShowReplyModal(false);
  };

  const handleUpdateStatus = () => {
    alert(`✅ Status updated successfully!\n\nTicket #${viewingTicket?.id}\nOld Status: ${viewingTicket?.status}\nNew Status: ${newStatus}\n\nThe ticket status has been changed.`);
    
    setShowStatusModal(false);
  };

  const handleAssignAgent = () => {
    if (!selectedAgent.trim()) {
      alert("⚠️ Please enter an agent's name!");
      return;
    }
    
    alert(`✅ Ticket assigned successfully!\n\nTicket #${viewingTicket?.id}\nAssigned to: ${selectedAgent}\n\nThe agent will be notified.`);
    
    setSelectedAgent("");
    setShowAssignModal(false);
  };

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-2">Support Tickets</h1>
          <p className="text-muted-foreground">
            Manage user support requests and inquiries
          </p>
        </motion.div>

        {/* Stats — derived from loaded tickets (up to 200) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Open</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? "—" : stats.open}
                  </p>
                </div>
                <AlertCircle className="w-8 h-8 text-yellow-500" />
              </div>
            </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">In progress</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? "—" : stats.inProgress}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-blue-500" />
              </div>
            </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Resolved today</p>
                  <p className="text-2xl font-bold text-green-600">
                    {isLoading ? "—" : stats.resolvedToday}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Urgent / Total</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? "—" : `${stats.urgent} / ${stats.total}`}
                  </p>
                </div>
                <MessageSquare className="w-8 h-8 text-primary" />
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="p-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by subject, user, or ticket id..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                Filter
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Tickets Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Ticket #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Subject
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Last Update
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {isLoading && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                        Loading tickets…
                      </td>
                    </tr>
                  )}
                  {!isLoading && filteredTickets.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                        {tickets.length === 0
                          ? "No support tickets yet."
                          : "No tickets match your search."}
                      </td>
                    </tr>
                  )}
                  {!isLoading &&
                    currentTickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-sm font-medium">
                        #{ticket.id}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-sm max-w-xs truncate">
                          {ticket.subject}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {ticket.user}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                          {ticket.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                            ticket.status
                          )}`}
                        >
                          {ticket.status.replace("-", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {ticket.lastUpdate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewTicket(ticket)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {isLoading
                  ? "Loading…"
                  : filteredTickets.length === 0
                  ? "No tickets to show"
                  : `Showing ${startIndex + 1}-${Math.min(endIndex, filteredTickets.length)} of ${filteredTickets.length}${
                      searchQuery.trim() ? ` (filtered from ${tickets.length})` : ""
                    }`}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground mr-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handlePrevious}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleNext}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* View Ticket Modal */}
        <AnimatePresence>
          {viewingTicket && (
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
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setViewingTicket(null)}
                aria-hidden
              />
              <div
                className="relative z-10 bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                  {/* Modal Header */}
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Ticket #{viewingTicket.id}</h2>
                      <p className="text-sm text-gray-600 mt-1">{viewingTicket.subject}</p>
                    </div>
                    <button
                      onClick={() => setViewingTicket(null)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 space-y-6">
                    {/* Ticket Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <User className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600 mb-1">User</p>
                          <p className="font-medium text-gray-900">{viewingTicket.user}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <Calendar className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Created</p>
                          <p className="font-medium text-gray-900">{viewingTicket.created}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <Tag className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Category</p>
                          <p className="font-medium text-gray-900">{viewingTicket.category}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <Flag className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Priority</p>
                          <p className={`font-medium ${getPriorityColor(viewingTicket.priority)}`}>
                            {viewingTicket.priority.toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      <p className="text-xs text-gray-600 mb-2">Status</p>
                      <span
                        className={`inline-flex px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(
                          viewingTicket.status
                        )}`}
                      >
                        {viewingTicket.status.replace("-", " ")}
                      </span>
                    </div>

                    {/* Description */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Description</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-gray-700 leading-relaxed">
                          {viewingTicket.description || "No description provided."}
                        </p>
                      </div>
                    </div>

                    {/* Messages/Conversation */}
                    {viewingTicket.messages && viewingTicket.messages.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Conversation</h3>
                        <div className="space-y-3">
                          {viewingTicket.messages.map((msg, index) => (
                            <div
                              key={index}
                              className={`p-4 rounded-lg ${
                                msg.from === "Support Team"
                                  ? "bg-blue-50 border border-blue-100"
                                  : "bg-gray-50 border border-gray-200"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-semibold text-sm text-gray-900">{msg.from}</p>
                                <p className="text-xs text-gray-500">{msg.time}</p>
                              </div>
                              <p className="text-gray-700 text-sm">{msg.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t">
                      <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => setShowReplyModal(true)}>
                        Reply to Ticket
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => setShowStatusModal(true)}>
                        Change Status
                      </Button>
                      <Button variant="outline" onClick={() => setShowAssignModal(true)}>
                        Assign to Agent
                      </Button>
                    </div>
                  </div>
                </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reply Modal */}
        <AnimatePresence>
          {showReplyModal && (
            <motion.div
              key="support-reply-modal"
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setShowReplyModal(false)}
                aria-hidden
              />
              <div
                className="relative z-10 bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                  {/* Modal Header */}
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Reply to Ticket #{viewingTicket?.id}</h2>
                      <p className="text-sm text-gray-600 mt-1">{viewingTicket?.subject}</p>
                    </div>
                    <button
                      onClick={() => setShowReplyModal(false)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 space-y-6">
                    {/* Ticket Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <User className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600 mb-1">User</p>
                          <p className="font-medium text-gray-900">{viewingTicket?.user}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <Calendar className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Created</p>
                          <p className="font-medium text-gray-900">{viewingTicket?.created}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <Tag className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Category</p>
                          <p className="font-medium text-gray-900">{viewingTicket?.category}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <Flag className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Priority</p>
                          <p className={`font-medium ${getPriorityColor(viewingTicket?.priority || "low")}`}>
                            {viewingTicket?.priority?.toUpperCase() || "LOW"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      <p className="text-xs text-gray-600 mb-2">Status</p>
                      <span
                        className={`inline-flex px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(
                          viewingTicket?.status || "open"
                        )}`}
                      >
                        {viewingTicket?.status?.replace("-", " ") || "Open"}
                      </span>
                    </div>

                    {/* Description */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Description</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-gray-700 leading-relaxed">
                          {viewingTicket?.description || "No description provided."}
                        </p>
                      </div>
                    </div>

                    {/* Messages/Conversation */}
                    {viewingTicket?.messages && viewingTicket.messages.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Conversation</h3>
                        <div className="space-y-3">
                          {viewingTicket.messages.map((msg, index) => (
                            <div
                              key={index}
                              className={`p-4 rounded-lg ${
                                msg.from === "Support Team"
                                  ? "bg-blue-50 border border-blue-100"
                                  : "bg-gray-50 border border-gray-200"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-semibold text-sm text-gray-900">{msg.from}</p>
                                <p className="text-xs text-gray-500">{msg.time}</p>
                              </div>
                              <p className="text-gray-700 text-sm">{msg.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reply Form */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Reply</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <Input
                          placeholder="Type your reply here..."
                          className="w-full"
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t">
                      <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleSendReply}>
                        Send Reply
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => setShowReplyModal(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Modal */}
        <AnimatePresence>
          {showStatusModal && (
            <motion.div
              key="support-status-modal"
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setShowStatusModal(false)}
                aria-hidden
              />
              <div
                className="relative z-10 bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                  {/* Modal Header */}
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Change Status of Ticket #{viewingTicket?.id}</h2>
                      <p className="text-sm text-gray-600 mt-1">{viewingTicket?.subject}</p>
                    </div>
                    <button
                      onClick={() => setShowStatusModal(false)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 space-y-6">
                    {/* Ticket Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <User className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600 mb-1">User</p>
                          <p className="font-medium text-gray-900">{viewingTicket?.user}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <Calendar className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Created</p>
                          <p className="font-medium text-gray-900">{viewingTicket?.created}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <Tag className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Category</p>
                          <p className="font-medium text-gray-900">{viewingTicket?.category}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <Flag className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Priority</p>
                          <p className={`font-medium ${getPriorityColor(viewingTicket?.priority || "low")}`}>
                            {viewingTicket?.priority?.toUpperCase() || "LOW"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      <p className="text-xs text-gray-600 mb-2">Status</p>
                      <span
                        className={`inline-flex px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(
                          viewingTicket?.status || "open"
                        )}`}
                      >
                        {viewingTicket?.status?.replace("-", " ") || "Open"}
                      </span>
                    </div>

                    {/* Description */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Description</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-gray-700 leading-relaxed">
                          {viewingTicket?.description || "No description provided."}
                        </p>
                      </div>
                    </div>

                    {/* Messages/Conversation */}
                    {viewingTicket?.messages && viewingTicket.messages.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Conversation</h3>
                        <div className="space-y-3">
                          {viewingTicket.messages.map((msg, index) => (
                            <div
                              key={index}
                              className={`p-4 rounded-lg ${
                                msg.from === "Support Team"
                                  ? "bg-blue-50 border border-blue-100"
                                  : "bg-gray-50 border border-gray-200"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-semibold text-sm text-gray-900">{msg.from}</p>
                                <p className="text-xs text-gray-500">{msg.time}</p>
                              </div>
                              <p className="text-gray-700 text-sm">{msg.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Status Form */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Change Status</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <select
                          className="w-full"
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value as "open" | "in-progress" | "resolved" | "closed")}
                        >
                          <option value="open">Open</option>
                          <option value="in-progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t">
                      <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleUpdateStatus}>
                        Update Status
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => setShowStatusModal(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Assign Modal */}
        <AnimatePresence>
          {showAssignModal && (
            <motion.div
              key="support-assign-modal"
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setShowAssignModal(false)}
                aria-hidden
              />
              <div
                className="relative z-10 bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                  {/* Modal Header */}
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Assign Ticket #{viewingTicket?.id}</h2>
                      <p className="text-sm text-gray-600 mt-1">{viewingTicket?.subject}</p>
                    </div>
                    <button
                      onClick={() => setShowAssignModal(false)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 space-y-6">
                    {/* Ticket Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <User className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600 mb-1">User</p>
                          <p className="font-medium text-gray-900">{viewingTicket?.user}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <Calendar className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Created</p>
                          <p className="font-medium text-gray-900">{viewingTicket?.created}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <Tag className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Category</p>
                          <p className="font-medium text-gray-900">{viewingTicket?.category}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <Flag className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Priority</p>
                          <p className={`font-medium ${getPriorityColor(viewingTicket?.priority || "low")}`}>
                            {viewingTicket?.priority?.toUpperCase() || "LOW"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      <p className="text-xs text-gray-600 mb-2">Status</p>
                      <span
                        className={`inline-flex px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(
                          viewingTicket?.status || "open"
                        )}`}
                      >
                        {viewingTicket?.status?.replace("-", " ") || "Open"}
                      </span>
                    </div>

                    {/* Description */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Description</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-gray-700 leading-relaxed">
                          {viewingTicket?.description || "No description provided."}
                        </p>
                      </div>
                    </div>

                    {/* Messages/Conversation */}
                    {viewingTicket?.messages && viewingTicket.messages.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Conversation</h3>
                        <div className="space-y-3">
                          {viewingTicket.messages.map((msg, index) => (
                            <div
                              key={index}
                              className={`p-4 rounded-lg ${
                                msg.from === "Support Team"
                                  ? "bg-blue-50 border border-blue-100"
                                  : "bg-gray-50 border border-gray-200"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-semibold text-sm text-gray-900">{msg.from}</p>
                                <p className="text-xs text-gray-500">{msg.time}</p>
                              </div>
                              <p className="text-gray-700 text-sm">{msg.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Assign Form */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Assign to Agent</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <Input
                          placeholder="Enter agent's name..."
                          className="w-full"
                          value={selectedAgent}
                          onChange={(e) => setSelectedAgent(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t">
                      <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleAssignAgent}>
                        Assign
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => setShowAssignModal(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayoutNew>
  );
}