import { motion } from "motion/react";
import { AppLayout } from "@/app/components/AppLayout";
import { 
  Bell, 
  Heart, 
  Video, 
  Award, 
  MessageSquare,
  Calendar,
  TrendingUp,
  CheckCircle2,
  X,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useNotifications } from "@/app/contexts/NotificationsContext";
import { formatDistanceToNow } from "date-fns";

export function Notifications() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications();

  // Helper to map type to UI properties
  const getNotificationStyle = (type: string) => {
    switch (type) {
      case 'mood':
        return { icon: TrendingUp, color: "from-green-500 to-emerald-600" };
      case 'session':
        return { icon: Video, color: "from-blue-500 to-cyan-600" };
      case 'achievement':
        return { icon: Award, color: "from-yellow-500 to-orange-600" };
      case 'reminder':
        return { icon: Calendar, color: "from-pink-500 to-rose-600" };
      case 'message':
        return { icon: MessageSquare, color: "from-purple-500 to-indigo-600" };
      case 'safety':
      case 'alert':
        return { icon: AlertTriangle, color: "from-red-500 to-red-600" };
      case 'system':
      default:
        return { icon: Bell, color: "from-gray-500 to-gray-600" };
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <Skeleton className="w-12 h-12 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-gray-200">
                <div className="flex gap-4">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
                <p className="text-gray-600">
                  {unreadCount > 0 
                    ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                    : "You're all caught up!"
                  }
                </p>
              </div>
            </div>
          </div>

          {unreadCount > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4"
            >
              <Button
                onClick={markAllAsRead}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark all as read
              </Button>
            </motion.div>
          )}
        </motion.div>

        <div className="space-y-3">
          {notifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 bg-white rounded-2xl shadow-sm"
            >
              <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-bold text-xl text-gray-900 mb-2">No Notifications</h3>
              <p className="text-gray-600">
                You're all caught up! Check back later for updates.
              </p>
            </motion.div>
          ) : (
            notifications.map((notification, index) => {
              const style = getNotificationStyle(notification.type);
              const Icon = style.icon;
              
              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.01 }}
                  className={`bg-white rounded-2xl shadow-sm p-4 border-l-4 ${
                    notification.is_read 
                      ? "border-gray-200 opacity-75" 
                      : "border-blue-500"
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${style.color} flex items-center justify-center shadow-md`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h3 className={`font-bold text-sm sm:text-base ${
                            notification.is_read ? "text-gray-600" : "text-gray-900"
                          }`}>
                            {notification.title}
                          </h3>
                          <p className={`mt-1 text-xs sm:text-sm ${
                            notification.is_read ? "text-gray-500" : "text-gray-700"
                          }`}>
                            {notification.message}
                          </p>
                          <p className="mt-2 text-xs text-gray-400">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          {!notification.is_read && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => markAsRead(notification.id)}
                              className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                              title="Mark as read"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </motion.button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Footer Info */}
        {notifications.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 text-center text-sm text-gray-500"
          >
            Showing {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
