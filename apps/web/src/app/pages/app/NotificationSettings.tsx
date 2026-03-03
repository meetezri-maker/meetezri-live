import { motion } from "motion/react";
import { 
  Bell,
  BellOff,
  Mail,
  MessageSquare,
  Calendar,
  Heart,
  TrendingUp,
  Users,
  Zap,
  Moon,
  Volume2,
  VolumeX,
  ArrowLeft
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { AppLayout } from "@/app/components/AppLayout";
import { useAuth } from "@/app/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Skeleton } from "@/app/components/ui/skeleton";

export function NotificationSettings() {
  const { profile, isLoading } = useAuth();
  const [notificationSettings, setNotificationSettings] = useState({
    pushEnabled: true,
    emailEnabled: true,
    smsEnabled: false,
    quietHoursEnabled: true,
    quietStart: "22:00",
    quietEnd: "08:00",
    
    // Specific notifications
    sessionReminders: true,
    moodCheckIns: true,
    journalPrompts: true,
    wellnessTips: false,
    communityActivity: false,
    achievementUnlocked: true,
    progressMilestones: true,
    crisisAlerts: true
  });

  useEffect(() => {
    if (profile?.notification_preferences) {
      setNotificationSettings(prev => ({
        ...prev,
        ...profile.notification_preferences
      }));
    }
  }, [profile]);

  const saveSettings = async (newSettings: typeof notificationSettings) => {
    try {
      await api.updateProfile({
        notification_preferences: newSettings
      });
      // Optionally refresh profile to sync state, though we are optimistic here
      // refreshProfile(); 
    } catch (error) {
      console.error('Failed to save notification settings:', error);
      toast.error('Failed to save settings');
    }
  };

  const toggleSetting = (key: keyof typeof notificationSettings) => {
    setNotificationSettings(prev => {
      const newState = {
        ...prev,
        [key]: !prev[key]
      };
      saveSettings(newState);
      return newState;
    });
  };

  const updateTimeSetting = (key: 'quietStart' | 'quietEnd', value: string) => {
      setNotificationSettings(prev => {
          const newState = {
              ...prev,
              [key]: value
          };
          saveSettings(newState);
          return newState;
      });
  };
  
  const updateAllSettings = (enable: boolean) => {
      setNotificationSettings(prev => {
          const newState = { ...prev };
          Object.keys(newState).forEach(key => {
              if (typeof newState[key as keyof typeof newState] === 'boolean') {
                  (newState as any)[key] = enable;
              }
          });
          saveSettings(newState);
          return newState;
      });
  };

  const notificationCategories = [
    {
      title: "Session Reminders",
      description: "Get notified before scheduled therapy sessions",
      icon: Calendar,
      key: "sessionReminders" as const,
      color: "text-blue-600"
    },
    {
      title: "Mood Check-ins",
      description: "Daily prompts to track your mood",
      icon: Heart,
      key: "moodCheckIns" as const,
      color: "text-pink-600"
    },
    {
      title: "Journal Prompts",
      description: "Writing prompts and journaling reminders",
      icon: MessageSquare,
      key: "journalPrompts" as const,
      color: "text-purple-600"
    },
    {
      title: "Wellness Tips",
      description: "Daily mental health tips and advice",
      icon: Zap,
      key: "wellnessTips" as const,
      color: "text-yellow-600"
    },
    {
      title: "Community Activity",
      description: "Updates from your community connections",
      icon: Users,
      key: "communityActivity" as const,
      color: "text-green-600"
    },
    {
      title: "Achievement Unlocked",
      description: "Notifications for badges and rewards",
      icon: TrendingUp,
      key: "achievementUnlocked" as const,
      color: "text-indigo-600"
    },
    {
      title: "Progress Milestones",
      description: "Celebrate your wellness journey milestones",
      icon: Heart,
      key: "progressMilestones" as const,
      color: "text-rose-600"
    },
    {
      title: "Crisis Alerts",
      description: "Important safety and crisis notifications",
      icon: Bell,
      key: "crisisAlerts" as const,
      color: "text-red-600"
    }
  ];

  if (isLoading && !profile) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
              <Skeleton className="h-5 w-32 mb-4" />
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-7 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <Skeleton className="h-20 w-full rounded-2xl" />
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Link 
              to="/app/settings" 
              className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200 mb-6 transition-colors font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Settings
            </Link>

            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Notifications</h1>
                <p className="text-gray-600 dark:text-slate-400">Manage alerts and reminders</p>
              </div>
            </div>
          </motion.div>

          {/* Master Controls */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-slate-800 mb-6"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Notification Channels</h2>

            <div className="space-y-4">
              {/* Push Notifications */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  {notificationSettings.pushEnabled ? (
                    <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <BellOff className="w-5 h-5 text-gray-400 dark:text-slate-500" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Push Notifications</p>
                    <p className="text-sm text-gray-600 dark:text-slate-400">Real-time alerts on your device</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleSetting("pushEnabled")}
                  className={`w-14 h-8 rounded-full transition-colors ${
                    notificationSettings.pushEnabled ? "bg-blue-500" : "bg-gray-300 dark:bg-slate-700"
                  }`}
                >
                  <motion.div
                    animate={{ x: notificationSettings.pushEnabled ? 24 : 2 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </motion.button>
              </div>

              {/* Email Notifications */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Email Notifications</p>
                    <p className="text-sm text-gray-600 dark:text-slate-400">Receive updates via email</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleSetting("emailEnabled")}
                  className={`w-14 h-8 rounded-full transition-colors ${
                    notificationSettings.emailEnabled ? "bg-purple-500" : "bg-gray-300 dark:bg-slate-700"
                  }`}
                >
                  <motion.div
                    animate={{ x: notificationSettings.emailEnabled ? 24 : 2 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </motion.button>
              </div>

              {/* SMS Notifications */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">SMS Notifications</p>
                    <p className="text-sm text-gray-600 dark:text-slate-400">Text message alerts</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleSetting("smsEnabled")}
                  className={`w-14 h-8 rounded-full transition-colors ${
                    notificationSettings.smsEnabled ? "bg-green-500" : "bg-gray-300 dark:bg-slate-700"
                  }`}
                >
                  <motion.div
                    animate={{ x: notificationSettings.smsEnabled ? 24 : 2 }}
                    className="w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Quiet Hours */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-slate-800 mb-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Moon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Quiet Hours</h2>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Pause notifications during sleep</p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleSetting("quietHoursEnabled")}
                className={`w-14 h-8 rounded-full transition-colors ${
                  notificationSettings.quietHoursEnabled ? "bg-indigo-500" : "bg-gray-300 dark:bg-slate-700"
                }`}
              >
                <motion.div
                  animate={{ x: notificationSettings.quietHoursEnabled ? 24 : 2 }}
                  className="w-6 h-6 bg-white rounded-full shadow-md"
                />
              </motion.button>
            </div>

            {notificationSettings.quietHoursEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="grid grid-cols-2 gap-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Start Time</label>
                  <input
                    type="time"
                    value={notificationSettings.quietStart}
                    onChange={(e) => updateTimeSetting('quietStart', e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">End Time</label>
                  <input
                    type="time"
                    value={notificationSettings.quietEnd}
                    onChange={(e) => updateTimeSetting('quietEnd', e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Notification Types */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-slate-800"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Notification Types</h2>

            <div className="space-y-3">
              {notificationCategories.map((category, index) => {
                const Icon = category.icon;
                return (
                  <motion.div
                    key={category.key}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.05 }}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${category.color}`} />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{category.title}</p>
                        <p className="text-sm text-gray-600 dark:text-slate-400">{category.description}</p>
                      </div>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleSetting(category.key)}
                      className={`w-14 h-8 rounded-full transition-colors ${
                        notificationSettings[category.key] ? "bg-gradient-to-r from-blue-500 to-indigo-600" : "bg-gray-300 dark:bg-slate-700"
                      }`}
                    >
                      <motion.div
                        animate={{ x: notificationSettings[category.key] ? 24 : 2 }}
                        className="w-6 h-6 bg-white rounded-full shadow-md"
                      />
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-6 grid grid-cols-2 gap-3"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => updateAllSettings(true)}
              className="px-4 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium flex items-center justify-center gap-2"
            >
              <Volume2 className="w-4 h-4" />
              Enable All
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => updateAllSettings(false)}
              className="px-4 py-3 rounded-xl bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 font-medium flex items-center justify-center gap-2"
            >
              <VolumeX className="w-4 h-4" />
              Disable All
            </motion.button>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
