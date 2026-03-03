import { AppLayout } from "@/app/components/AppLayout";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
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
  User
} from "lucide-react";
import { useState, useEffect } from "react";
import { getNotificationHistory, type NotificationEvent } from "@/app/utils/trustedContactNotifications";

export function NotificationHistory() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [filter, setFilter] = useState<'all' | 'sent' | 'failed'>('all');

  useEffect(() => {
    const history = getNotificationHistory();
    setNotifications(history);
  }, []);

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    return n.status === filter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getMethodIcon = (method: string) => {
    return method === 'sms' 
      ? <Phone className="w-4 h-4" />
      : <Mail className="w-4 h-4" />;
  };

  const getSafetyStateColor = (state: string) => {
    switch (state) {
      case 'SAFETY_MODE':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'HIGH_RISK':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'ELEVATED_CONCERN':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
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
            Back
          </button>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Bell className="w-8 h-8 text-primary" />
                <h1 className="text-3xl font-bold">Notification History</h1>
              </div>
              <p className="text-muted-foreground">
                View when your trusted contacts were notified
              </p>
            </div>
          </div>
        </motion.div>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">About Notifications</h3>
                <p className="text-sm text-blue-800">
                  Your trusted contacts receive supportive check-in messages when our safety system detects you may need extra support. All messages are privacy-safe and contain no medical details.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Filter Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-6"
        >
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
              className="flex-1"
            >
              All ({notifications.length})
            </Button>
            <Button
              variant={filter === 'sent' ? 'default' : 'outline'}
              onClick={() => setFilter('sent')}
              className="flex-1"
            >
              Sent ({notifications.filter(n => n.status === 'sent').length})
            </Button>
            <Button
              variant={filter === 'failed' ? 'default' : 'outline'}
              onClick={() => setFilter('failed')}
              className="flex-1"
            >
              Failed ({notifications.filter(n => n.status === 'failed').length})
            </Button>
          </div>
        </motion.div>

        {/* Notifications List */}
        <div className="space-y-4">
          {filteredNotifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-2">No Notifications Yet</h3>
              <p className="text-muted-foreground mb-4">
                {filter === 'all' 
                  ? "Your trusted contacts haven't been notified yet"
                  : `No ${filter} notifications found`
                }
              </p>
              <Button 
                onClick={() => navigate('/app/emergency-contacts')}
                variant="outline"
              >
                <Shield className="w-4 h-4 mr-2" />
                Manage Trusted Contacts
              </Button>
            </motion.div>
          ) : (
            filteredNotifications.map((notification, index) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.05 }}
              >
                <Card className="p-6 shadow-lg hover:shadow-xl transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      {getStatusIcon(notification.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg">{notification.contactName}</h3>
                          <div className={`px-2 py-0.5 rounded-full border text-xs font-medium ${getSafetyStateColor(notification.safetyState)}`}>
                            {notification.safetyState.replace('_', ' ')}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {formatTimestamp(notification.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 ml-8">
                    {/* Method */}
                    <div className="flex items-center gap-2 text-sm">
                      {getMethodIcon(notification.method)}
                      <span className="text-gray-600">
                        Sent via {notification.method.toUpperCase()}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2 text-sm">
                      <MessageSquare className="w-4 h-4 text-gray-400" />
                      <span className={`font-medium ${
                        notification.status === 'sent' ? 'text-green-600' :
                        notification.status === 'failed' ? 'text-red-600' :
                        'text-yellow-600'
                      }`}>
                        {notification.status === 'sent' ? 'Delivered successfully' :
                         notification.status === 'failed' ? 'Delivery failed' :
                         'Pending delivery'}
                      </span>
                    </div>

                    {/* Message Preview (if available) */}
                    {notification.messageTemplate && (
                      <details className="mt-3">
                        <summary className="text-sm text-primary cursor-pointer hover:underline">
                          View message content
                        </summary>
                        <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap">
                          {notification.messageTemplate.substring(0, 200)}
                          {notification.messageTemplate.length > 200 && '...'}
                        </div>
                      </details>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        {/* Stats Summary */}
        {notifications.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8"
          >
            <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" />
                Summary
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-600">{notifications.length}</p>
                  <p className="text-sm text-gray-600">Total Sent</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">
                    {notifications.filter(n => n.status === 'sent').length}
                  </p>
                  <p className="text-sm text-gray-600">Delivered</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-orange-600">
                    {notifications.filter(n => n.safetyState === 'HIGH_RISK').length}
                  </p>
                  <p className="text-sm text-gray-600">High Risk</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-600">
                    {notifications.filter(n => n.safetyState === 'SAFETY_MODE').length}
                  </p>
                  <p className="text-sm text-gray-600">Safety Mode</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
