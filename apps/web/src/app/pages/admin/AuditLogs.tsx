import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { motion } from "motion/react";
import { Search, Filter, Download, Shield, User, Settings as SettingsIcon } from "lucide-react";
import { useState } from "react";

export function AuditLogs() {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const logs = [
    {
      id: 1,
      action: "User suspended",
      admin: "Admin User",
      target: "michael.c@example.com",
      timestamp: "2024-12-29 14:23:45",
      type: "user_action",
      ip: "192.168.1.100",
    },
    {
      id: 2,
      action: "Settings updated",
      admin: "Admin User",
      target: "General Settings",
      timestamp: "2024-12-29 13:15:22",
      type: "system",
      ip: "192.168.1.100",
    },
    {
      id: 3,
      action: "Crisis event resolved",
      admin: "Support Team",
      target: "Crisis ID #1847",
      timestamp: "2024-12-29 12:45:10",
      type: "crisis",
      ip: "192.168.1.105",
    },
    {
      id: 4,
      action: "Content added",
      admin: "Content Manager",
      target: "New breathing exercise",
      timestamp: "2024-12-29 11:30:00",
      type: "content",
      ip: "192.168.1.110",
    },
    {
      id: 5,
      action: "Report exported",
      admin: "Admin User",
      target: "User Activity Report",
      timestamp: "2024-12-29 10:15:33",
      type: "system",
      ip: "192.168.1.100",
    },
    {
      id: 6,
      action: "User details viewed",
      admin: "Support Team",
      target: "sarah.m@example.com",
      timestamp: "2024-12-29 09:20:15",
      type: "user_action",
      ip: "192.168.1.105",
    },
    {
      id: 7,
      action: "Password changed",
      admin: "Admin User",
      target: "john.d@example.com",
      timestamp: "2024-12-29 08:45:30",
      type: "user_action",
      ip: "192.168.1.100",
    },
    {
      id: 8,
      action: "Feature flag toggled",
      admin: "Admin User",
      target: "Dark Mode Feature",
      timestamp: "2024-12-29 07:30:15",
      type: "system",
      ip: "192.168.1.100",
    },
    {
      id: 9,
      action: "User role updated",
      admin: "Super Admin",
      target: "jane.s@example.com",
      timestamp: "2024-12-28 16:20:45",
      type: "user_action",
      ip: "192.168.1.120",
    },
    {
      id: 10,
      action: "Database backup initiated",
      admin: "System",
      target: "Automated Backup",
      timestamp: "2024-12-28 15:00:00",
      type: "system",
      ip: "192.168.1.1",
    },
    {
      id: 11,
      action: "Crisis alert triggered",
      admin: "Monitoring System",
      target: "Crisis ID #1850",
      timestamp: "2024-12-28 14:15:20",
      type: "crisis",
      ip: "192.168.1.1",
    },
    {
      id: 12,
      action: "Content updated",
      admin: "Content Manager",
      target: "Meditation guide #42",
      timestamp: "2024-12-28 13:00:00",
      type: "content",
      ip: "192.168.1.110",
    },
  ];

  const totalPages = Math.ceil(logs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentLogs = logs.slice(startIndex, endIndex);

  const handleExport = () => {
    // Create CSV content
    const headers = ["ID", "Type", "Action", "Admin", "Target", "IP Address", "Timestamp"];
    const csvContent = [
      headers.join(","),
      ...logs.map(log => [
        log.id,
        log.type,
        `"${log.action}"`,
        `"${log.admin}"`,
        `"${log.target}"`,
        log.ip,
        log.timestamp
      ].join(","))
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    alert(`✅ Exported ${logs.length} audit log entries to CSV file`);
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
            Track all administrative actions and system events
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
                <Input placeholder="Search logs..." className="pl-10" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2">
                  <Filter className="w-4 h-4" />
                  Filter
                </Button>
                <Button variant="outline" className="gap-2" onClick={handleExport}>
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
                      Admin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Target
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      IP Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {currentLogs.map((log, index) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.05 }}
                      className="hover:bg-gray-50"
                    >
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
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-sm">
                        {log.action}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {log.admin}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {log.target}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                        {log.ip}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {log.timestamp}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndex, logs.length)} of {logs.length} entries (Page {currentPage} of {totalPages})
              </p>
              <div className="flex gap-2">
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="p-6 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold mb-1">Security Notice</h3>
                <p className="text-sm text-gray-700">
                  All administrative actions are logged and stored securely for compliance and
                  security purposes. Logs are retained for 90 days.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}