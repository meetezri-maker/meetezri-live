import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { motion } from "motion/react";
import { Search, Download, Shield, User, Settings as SettingsIcon } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Row = {
  id: string;
  action: string;
  admin: string;
  target: string;
  timestamp: string;
  type: string;
  ip: string;
};

function classifyType(action: string): string {
  const a = action.toLowerCase();
  if (a.includes("crisis")) return "crisis";
  if (a.includes("user") || a.includes("profile") || a.includes("role")) return "user_action";
  if (a.includes("content") || a.includes("wellness")) return "content";
  return "system";
}

function targetFromDetails(details: unknown): string {
  if (details == null || details === undefined) return "—";
  if (typeof details === "object" && details !== null) {
    const d = details as Record<string, unknown>;
    if (typeof d.target === "string") return d.target;
    if (typeof d.resource === "string") return d.resource;
  }
  try {
    const s = JSON.stringify(details);
    return s.length > 140 ? `${s.slice(0, 137)}…` : s;
  } catch {
    return "—";
  }
}

function ipFromDetails(details: unknown): string {
  if (details == null || typeof details !== "object") return "—";
  const d = details as Record<string, unknown>;
  if (typeof d.ip === "string") return d.ip;
  if (typeof d.ip_address === "string") return d.ip_address;
  return "—";
}

export function AuditLogs() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const itemsPerPage = 8;

  const load = async () => {
    try {
      setIsLoading(true);
      const data = await api.admin.getAuditLogs({ page: 1, limit: 100 });
      const list = Array.isArray(data) ? data : [];
      setRows(
        list.map((log: any) => {
          const actor = log.profiles;
          const admin = actor?.full_name?.trim() || actor?.email || "System";
          const created = log.created_at ? new Date(log.created_at) : new Date();
          return {
            id: String(log.id),
            action: log.action || "—",
            admin,
            target: targetFromDetails(log.details),
            timestamp: created.toLocaleString(),
            type: classifyType(log.action || ""),
            ip: ipFromDetails(log.details),
          };
        })
      );
    } catch (e) {
      console.error(e);
      toast.error("Failed to load audit logs");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.action.toLowerCase().includes(q) ||
        r.admin.toLowerCase().includes(q) ||
        r.target.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentLogs = filtered.slice(startIndex, endIndex);

  const handleExport = () => {
    const headers = ["ID", "Type", "Action", "Admin", "Target", "IP Address", "Timestamp"];
    const csvContent = [
      headers.join(","),
      ...filtered.map((log) =>
        [
          log.id,
          log.type,
          `"${String(log.action).replace(/"/g, '""')}"`,
          `"${String(log.admin).replace(/"/g, '""')}"`,
          `"${String(log.target).replace(/"/g, '""')}"`,
          log.ip,
          log.timestamp,
        ].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} rows`);
  };

  const handlePrevious = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case "user_action":
        return <User className="w-4 h-4" />;
      case "crisis":
        return <Shield className="w-4 h-4" />;
      default:
        return <SettingsIcon className="w-4 h-4" />;
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case "user_action":
        return "bg-blue-100 text-blue-700";
      case "crisis":
        return "bg-red-100 text-red-700";
      case "content":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-2">Audit Logs</h1>
          <p className="text-muted-foreground">
            Administrative actions from the database (latest 100 records)
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search action, actor, target…"
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2" onClick={() => load()} disabled={isLoading}>
                  Refresh
                </Button>
                <Button variant="outline" className="gap-2" onClick={handleExport} disabled={filtered.length === 0}>
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Target / details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      IP (if logged)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {isLoading && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                        Loading audit logs…
                      </td>
                    </tr>
                  )}
                  {!isLoading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                        No audit log entries yet, or nothing matches your search.
                      </td>
                    </tr>
                  )}
                  {!isLoading &&
                    currentLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getActionColor(
                              log.type
                            )}`}
                          >
                            {getActionIcon(log.type)}
                            {log.type.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-sm max-w-[200px] truncate" title={log.action}>
                          {log.action}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{log.admin}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={log.target}>
                          {log.target}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{log.ip}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{log.timestamp}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {isLoading
                  ? "…"
                  : filtered.length === 0
                  ? "0 entries"
                  : `Showing ${startIndex + 1}-${Math.min(endIndex, filtered.length)} of ${filtered.length} entries (Page ${currentPage} of ${totalPages})`}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePrevious} disabled={currentPage === 1 || isLoading}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNext}
                  disabled={currentPage === totalPages || isLoading}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="p-6 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold mb-1">Security notice</h3>
                <p className="text-sm text-gray-700">
                  Entries come from the <code className="text-xs bg-white/80 px-1 rounded">audit_logs</code> table.
                  Retention follows your organization&apos;s policy.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}
