import { AppLayout } from "@/app/components/AppLayout";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { motion } from "motion/react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  MessageSquare,
  Mail,
  Phone,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
} from "lucide-react";
import { useMemo } from "react";
import type { Notification } from "@/app/contexts/NotificationsContext";
import { useNotifications } from "@/app/contexts/NotificationsContext";

type HistoryRow = {
  id: string;
  timestamp: string;
  headline: string;
  safetyBadge: string;
  method: "app";
  status: "sent" | "failed" | "pending";
  body: string;
};

function isAdminEmergencyNotification(n: Notification): boolean {
  const md = n.metadata as Record<string, unknown> | null | undefined;
  if (!md || typeof md !== "object") return false;
  if (md.manual_admin_broadcast !== true) return false;
  return md.notification_category === "emergency";
}

export function NotificationHistory() {
  const navigate = useNavigate();
  const { notifications: appNotifications } = useNotifications();

  const notifications: HistoryRow[] = useMemo(
    () =>
      appNotifications
        .filter(isAdminEmergencyNotification)
        .map((n) => ({
          id: n.id,
          timestamp: n.created_at,
          headline: (n.title && n.title.trim()) || "Emergency notice",
          safetyBadge: "From our team",
          method: "app",
          status: "sent",
          body: (n.message && n.message.trim()) || "",
        }))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [appNotifications]
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getMethodIcon = (method: string) => {
    if (method === "sms") return <Phone className="w-4 h-4" />;
    if (method === "email") return <Mail className="w-4 h-4" />;
    return <Bell className="w-4 h-4" />;
  };

  const getSafetyStateColor = (label: string) => {
    if (label === "From our team") {
      return "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800";
    }
    return "bg-gray-100 text-gray-700 border-gray-300";
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </button>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Bell className="w-8 h-8 text-primary" />
                <h1 className="text-3xl font-bold">Emergency notification history</h1>
              </div>
              <p className="text-muted-foreground">
                Notices flagged as emergency/safety-related by our team appear here. Routine app alerts stay in{" "}
                <Link to="/app/notifications" className="text-primary underline font-medium">
                  Notifications
                </Link>
                .
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <Card className="notification-history-card p-4 bg-blue-50 border-blue-200 dark:bg-slate-900 dark:border-blue-900">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">What you’ll see</h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Only in-app messages your administrators send with <strong>Emergency / safety notice</strong> enabled
                  are listed. Streak reminders, billing, and other updates are not shown on this page.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        <div className="space-y-4">
          {notifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-2">No emergency notices yet</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                When our team sends you a safety-related in-app notice, it will appear here. For all other alerts, open
                Notifications.
              </p>
              <Button asChild variant="outline">
                <Link to="/app/notifications">
                  <Bell className="w-4 h-4 mr-2" />
                  Open Notifications
                </Link>
              </Button>
            </motion.div>
          ) : (
            notifications.map((notification, index) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + index * 0.04 }}
              >
                <Card className="notification-history-card p-6 shadow-lg hover:shadow-xl transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      {getStatusIcon(notification.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-bold text-lg">{notification.headline}</h3>
                          <div
                            className={`px-2 py-0.5 rounded-full border text-xs font-medium ${getSafetyStateColor(notification.safetyBadge)}`}
                          >
                            {notification.safetyBadge}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {formatTimestamp(notification.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 ml-8">
                    <div className="flex items-center gap-2 text-sm">
                      {getMethodIcon(notification.method)}
                      <span className="text-gray-600 dark:text-gray-300">Delivered in the app</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <MessageSquare className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-green-600 dark:text-green-400">Delivered successfully</span>
                    </div>

                    {notification.body ? (
                      <details className="mt-3">
                        <summary className="text-sm text-primary cursor-pointer hover:underline">
                          View message content
                        </summary>
                        <div className="mt-3 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                          {notification.body.length > 2000
                            ? `${notification.body.slice(0, 2000)}…`
                            : notification.body}
                        </div>
                      </details>
                    ) : null}
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        {notifications.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8"
          >
            <Card className="notification-history-card p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 dark:from-slate-900 dark:to-slate-900 dark:border-slate-700">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Summary
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{notifications.length}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Emergency notices received</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">{notifications.length}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Delivered in-app</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
