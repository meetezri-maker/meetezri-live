import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Settings,
  Globe,
  ToggleLeft,
  ToggleRight,
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Server,
  Database,
  Mail,
  Bell,
  Users,
  Shield,
  Zap,
  Clock,
  FileText,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface ConfigSection {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  settings: Setting[];
}

interface Setting {
  id: string;
  name: string;
  description: string;
  type: "toggle" | "text" | "number" | "select" | "time";
  value: any;
  options?: { value: string; label: string }[];
  defaultValue?: any;
}

export function GlobalConfiguration() {
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [sections, setSections] = useState<ConfigSection[]>([
    {
      id: "app",
      name: "Application Settings",
      description: "Core application configuration",
      icon: Settings,
      color: "from-blue-500 to-cyan-600",
      settings: [
        {
          id: "app.name",
          name: "Application Name",
          description: "Display name for the application",
          type: "text",
          value: "Ezri Mental Health",
          defaultValue: "Ezri Mental Health",
        },
        {
          id: "app.environment",
          name: "Environment",
          description: "Current deployment environment",
          type: "select",
          value: "production",
          options: [
            { value: "development", label: "Development" },
            { value: "staging", label: "Staging" },
            { value: "production", label: "Production" },
          ],
          defaultValue: "production",
        },
        {
          id: "app.maintenance_mode",
          name: "Maintenance Mode",
          description: "Enable to show maintenance page to users",
          type: "toggle",
          value: false,
          defaultValue: false,
        },
        {
          id: "app.debug_mode",
          name: "Debug Mode",
          description: "Enable detailed logging and error messages",
          type: "toggle",
          value: false,
          defaultValue: false,
        },
      ],
    },
    {
      id: "features",
      name: "Feature Flags",
      description: "Enable or disable application features",
      icon: Zap,
      color: "from-purple-500 to-pink-600",
      settings: [
        {
          id: "features.ai_voice",
          name: "AI Voice Conversations",
          description: "Enable voice interactions with AI avatars",
          type: "toggle",
          value: true,
          defaultValue: true,
        },
        {
          id: "features.mood_tracking",
          name: "Mood Tracking",
          description: "Enable mood check-in and tracking features",
          type: "toggle",
          value: true,
          defaultValue: true,
        },
        {
          id: "features.journaling",
          name: "Journaling",
          description: "Enable journaling functionality",
          type: "toggle",
          value: true,
          defaultValue: true,
        },
        {
          id: "features.community",
          name: "Community Features",
          description: "Enable community forums and groups",
          type: "toggle",
          value: false,
          defaultValue: false,
        },
      ],
    },
    {
      id: "security",
      name: "Security Settings",
      description: "Authentication and security configuration",
      icon: Shield,
      color: "from-red-500 to-rose-600",
      settings: [
        {
          id: "security.require_2fa",
          name: "Require Two-Factor Authentication",
          description: "Require all users to enable 2FA",
          type: "toggle",
          value: false,
          defaultValue: false,
        },
        {
          id: "security.session_timeout",
          name: "Session Timeout (minutes)",
          description: "Automatic logout after inactivity",
          type: "number",
          value: 30,
          defaultValue: 30,
        },
        {
          id: "security.password_expiry",
          name: "Password Expiry (days)",
          description: "Force password reset after specified days",
          type: "number",
          value: 90,
          defaultValue: 90,
        },
        {
          id: "security.max_login_attempts",
          name: "Max Login Attempts",
          description: "Lock account after failed attempts",
          type: "number",
          value: 5,
          defaultValue: 5,
        },
      ],
    },
    {
      id: "notifications",
      name: "Notification Settings",
      description: "Email and push notification configuration",
      icon: Bell,
      color: "from-green-500 to-emerald-600",
      settings: [
        {
          id: "notifications.email",
          name: "Email Notifications",
          description: "Send email notifications to users",
          type: "toggle",
          value: true,
          defaultValue: true,
        },
        {
          id: "notifications.push",
          name: "Push Notifications",
          description: "Send push notifications to mobile devices",
          type: "toggle",
          value: true,
          defaultValue: true,
        },
        {
          id: "notifications.admin_alerts",
          name: "Admin Alerts",
          description: "Send critical alerts to administrators",
          type: "toggle",
          value: true,
          defaultValue: true,
        },
        {
          id: "notifications.frequency",
          name: "Notification Frequency",
          description: "How often to send digest notifications",
          type: "select",
          value: "daily",
          options: [
            { value: "realtime", label: "Real-time" },
            { value: "hourly", label: "Hourly" },
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
          ],
          defaultValue: "daily",
        },
      ],
    },
    {
      id: "performance",
      name: "Performance Settings",
      description: "Caching and optimization configuration",
      icon: Server,
      color: "from-orange-500 to-amber-600",
      settings: [
        {
          id: "performance.enable_caching",
          name: "Enable Caching",
          description: "Cache API responses for better performance",
          type: "toggle",
          value: true,
          defaultValue: true,
        },
        {
          id: "performance.cache_ttl",
          name: "Cache TTL (seconds)",
          description: "How long to cache responses",
          type: "number",
          value: 300,
          defaultValue: 300,
        },
        {
          id: "performance.rate_limiting",
          name: "API Rate Limiting",
          description: "Limit API requests per user",
          type: "toggle",
          value: true,
          defaultValue: true,
        },
        {
          id: "performance.max_requests_per_hour",
          name: "Max Requests per Hour",
          description: "Maximum API requests allowed per hour",
          type: "number",
          value: 1000,
          defaultValue: 1000,
        },
      ],
    },
    {
      id: "database",
      name: "Database Settings",
      description: "Database connection and backup configuration",
      icon: Database,
      color: "from-indigo-500 to-purple-600",
      settings: [
        {
          id: "database.auto_backup",
          name: "Automatic Backups",
          description: "Enable scheduled database backups",
          type: "toggle",
          value: true,
          defaultValue: true,
        },
        {
          id: "database.backup_frequency",
          name: "Backup Frequency",
          description: "How often to backup the database",
          type: "select",
          value: "daily",
          options: [
            { value: "hourly", label: "Hourly" },
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
          ],
          defaultValue: "daily",
        },
        {
          id: "database.connection_pool_size",
          name: "Connection Pool Size",
          description: "Maximum database connections",
          type: "number",
          value: 20,
          defaultValue: 20,
        },
        {
          id: "database.query_timeout",
          name: "Query Timeout (seconds)",
          description: "Maximum time for database queries",
          type: "number",
          value: 30,
          defaultValue: 30,
        },
      ],
    },
  ]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await api.getSettings();
        // data is array of { key, value, description }
        
        setSections(prev => prev.map(section => ({
          ...section,
          settings: section.settings.map(setting => {
            const found = data.find((s: any) => s.key === setting.id);
            return found ? { ...setting, value: found.value } : setting;
          })
        })));
      } catch (err) {
        console.error("Failed to load settings", err);
        toast.error("Failed to load configuration");
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSettingChange = (
    sectionId: string,
    settingId: string,
    value: any
  ) => {
    setSections((prevSections) =>
      prevSections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              settings: section.settings.map((setting) =>
                setting.id === settingId ? { ...setting, value } : setting
              ),
            }
          : section
      )
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const promises = [];
      for (const section of sections) {
        for (const setting of section.settings) {
           promises.push(api.updateSetting(setting.id, setting.value, setting.description));
        }
      }
      
      await Promise.all(promises);
      setHasChanges(false);
      toast.success("Configuration saved successfully");
    } catch (err) {
      console.error("Failed to save", err);
      toast.error("Failed to save configuration");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSections((prevSections) =>
      prevSections.map((section) => ({
        ...section,
        settings: section.settings.map((setting) => ({
          ...setting,
          value: setting.defaultValue,
        })),
      }))
    );
    setHasChanges(true); // Resetting counts as a change to save
  };

  const stats = [
    {
      label: "Total Settings",
      value: sections.reduce((acc, section) => acc + section.settings.length, 0),
      icon: Settings,
      color: "from-blue-500 to-cyan-600",
    },
    {
      label: "Sections",
      value: sections.length,
      icon: FileText,
      color: "from-purple-500 to-pink-600",
    },
    {
      label: "Last Updated",
      value: "Just now",
      icon: Clock,
      color: "from-green-500 to-emerald-600",
    },
    {
      label: "Changes",
      value: hasChanges ? "Unsaved" : "Saved",
      icon: hasChanges ? AlertCircle : CheckCircle2,
      color: hasChanges ? "from-orange-500 to-amber-600" : "from-green-500 to-emerald-600",
    },
  ];

  if (isLoading && sections.every(s => s.settings.every(set => set.value === set.defaultValue))) {
     // Initial loading state can be added here if needed, 
     // but we show default values while loading to prevent layout shift
     // or add a spinner overlay. For now, we just let it load.
  }

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Global Configuration
            </h1>
            <p className="text-gray-600">
              Application-wide settings and feature toggles
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleReset}
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
              disabled={isLoading}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Defaults
            </Button>
            <Button
              onClick={handleSave}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
              disabled={!hasChanges || isLoading}
            >
              <Save className="w-4 h-4 mr-2" />
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-white border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}
                  >
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Configuration Sections */}
        <div className="space-y-6">
          {sections.map((section, sectionIndex) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + sectionIndex * 0.1 }}
            >
              <Card className="bg-white border border-gray-200 p-6">
                {/* Section Header */}
                <div className="flex items-center gap-4 mb-6">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${section.color} flex items-center justify-center`}
                  >
                    <section.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{section.name}</h3>
                    <p className="text-sm text-gray-600">{section.description}</p>
                  </div>
                </div>

                {/* Settings Grid */}
                <div className="space-y-4">
                  {section.settings.map((setting) => (
                    <div
                      key={setting.id}
                      className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all"
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <h4 className="text-gray-900 font-medium mb-1">
                          {setting.name}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {setting.description}
                        </p>
                      </div>

                      {/* Control */}
                      <div className="flex-shrink-0">
                        {setting.type === "toggle" && (
                          <button
                            onClick={() =>
                              handleSettingChange(
                                section.id,
                                setting.id,
                                !setting.value
                              )
                            }
                            className={`relative w-14 h-8 rounded-full transition-all ${
                              setting.value
                                ? "bg-gradient-to-r from-green-500 to-emerald-600"
                                : "bg-gray-300"
                            }`}
                          >
                            <motion.div
                              className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
                              animate={{ left: setting.value ? 30 : 4 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </button>
                        )}

                        {setting.type === "text" && (
                          <input
                            type="text"
                            value={setting.value}
                            onChange={(e) =>
                              handleSettingChange(section.id, setting.id, e.target.value)
                            }
                            className="w-64 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        )}

                        {setting.type === "number" && (
                          <input
                            type="number"
                            value={setting.value}
                            onChange={(e) =>
                              handleSettingChange(
                                section.id,
                                setting.id,
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-32 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        )}

                        {setting.type === "select" && setting.options && (
                          <select
                            value={setting.value}
                            onChange={(e) =>
                              handleSettingChange(section.id, setting.id, e.target.value)
                            }
                            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            {setting.options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Unsaved Changes Banner */}
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Card className="bg-gradient-to-r from-orange-500 to-amber-600 border-0 p-4 shadow-2xl">
              <div className="flex items-center gap-4">
                <AlertCircle className="w-6 h-6 text-white" />
                <div>
                  <p className="text-white font-bold">Unsaved Changes</p>
                  <p className="text-white/80 text-sm">
                    You have unsaved configuration changes
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setHasChanges(false)}
                    variant="outline"
                    className="border-white text-white hover:bg-white/20"
                    size="sm"
                  >
                    Discard
                  </Button>
                  <Button
                    onClick={handleSave}
                    className="bg-white text-orange-600 hover:bg-gray-100"
                    size="sm"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </AdminLayoutNew>
  );
}
