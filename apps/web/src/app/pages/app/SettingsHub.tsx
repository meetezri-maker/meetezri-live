import { 
  User,
  Shield,
  Bell,
  Eye,
  Palette,
  HelpCircle,
  Lock,
  Mail,
  Globe,
  Smartphone,
  Moon,
  Zap,
  Heart,
  ChevronRight,
  ArrowLeft,
  LogOut,
  Loader2,
  Trophy,
  Users,
  BookOpen,
  Brain,
  Phone,
  FileHeart,
  TrendingUp,
  AlertCircle,
  BarChart3,
  History,
  Wind,
  CreditCard
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/app/components/AppLayout";
import { useAuth } from "@/app/contexts/AuthContext";
import { useNotifications } from "@/app/contexts/NotificationsContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";

interface SettingSection {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  route?: string;
  badge?: string;
}

export function SettingsHub() {
  const navigate = useNavigate();
  const { profile, refreshProfile, user, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  
  // Quick Settings State
  const [quickSettings, setQuickSettings] = useState([
    { icon: Moon, label: "Dark Mode", enabled: false, key: "darkMode" },
    { icon: Bell, label: "Notifications", enabled: true, key: "pushEnabled" },
    { icon: Smartphone, label: "Mobile Alerts", enabled: true, key: "smsEnabled" },
    { icon: Mail, label: "Email Updates", enabled: false, key: "emailEnabled" }
  ]);

  const appearanceStorageKey = useMemo(() => {
    if (typeof window === "undefined") return "ezri_appearance_settings";
    if (!user?.id) return "ezri_appearance_settings";
    return `ezri_appearance_settings_${user.id}`;
  }, [user?.id]);

  const readAppearanceSettings = () => {
    try {
      const raw = localStorage.getItem(appearanceStorageKey);
      if (!raw) return {} as Record<string, any>;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {} as Record<string, any>;
    }
  };

  // Sync state from profile and localStorage
  useEffect(() => {
    const syncSettings = () => {
      // 1. Appearance (LocalStorage)
      const appearanceSettings = readAppearanceSettings();
      const isDarkMode = appearanceSettings.theme === "dark";

      // 2. Notifications (Profile)
      const prefs = profile?.notification_preferences || {};
      
      setQuickSettings(prev => prev.map(setting => {
          if (setting.key === 'darkMode') return { ...setting, enabled: isDarkMode };
          if (setting.key === 'pushEnabled') return { ...setting, enabled: prefs.pushEnabled ?? true };
          if (setting.key === 'smsEnabled') return { ...setting, enabled: prefs.smsEnabled ?? false };
          if (setting.key === 'emailEnabled') return { ...setting, enabled: prefs.emailEnabled ?? true };
          return setting;
      }));
    };

    syncSettings();

    // Listen for appearance changes from other components
    const handleAppearanceChange = (event: Event) => {
      const custom = event as CustomEvent<any>;
      const detail = custom.detail || {};
      setQuickSettings(prev => prev.map(setting => {
        if (setting.key === 'darkMode') return { ...setting, enabled: detail.theme === 'dark' };
        return setting;
      }));
    };

    window.addEventListener("ezri-appearance-change", handleAppearanceChange);
    return () => window.removeEventListener("ezri-appearance-change", handleAppearanceChange);
  }, [profile, appearanceStorageKey]);

  const toggleQuickSetting = async (key: string) => {
    // Optimistic update
    setQuickSettings(prevSettings =>
      prevSettings.map(setting =>
        setting.key === key ? { ...setting, enabled: !setting.enabled } : setting
      )
    );

    try {
        if (key === 'darkMode') {
            // Handle Appearance
            const currentSettings = readAppearanceSettings();
            const newTheme = currentSettings.theme === 'dark' ? 'light' : 'dark';
            
            const newSettings = { ...currentSettings, theme: newTheme };
            localStorage.setItem(appearanceStorageKey, JSON.stringify(newSettings));
            
            // Apply immediately
            if (newTheme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }

            window.dispatchEvent(
              new CustomEvent("ezri-appearance-change", { detail: newSettings })
            );
            toast.success(`Dark mode ${newTheme === 'dark' ? 'enabled' : 'disabled'}`);
        } else {
            // Handle Notification Preferences
            const currentPrefs = profile?.notification_preferences || {};
            const newPrefs = {
                ...currentPrefs,
                [key]: !currentPrefs[key] // toggle based on current profile state to be safe, or we can use the state. 
                // Using state is safer for optimistic UI if we assume state is up to date. 
                // But let's just toggle the value we know we are flipping.
            };
            
            // Fix: we need to know the *new* value. 
            // The optimistic update flipped it. Let's find the setting in the array *before* update or just infer.
            const setting = quickSettings.find(s => s.key === key);
            const newValue = !setting?.enabled; // New value is opposite of current state
            
            newPrefs[key] = newValue;

            await api.updateProfile({
                notification_preferences: newPrefs
            });
            // refreshProfile(); // Optional, but good to keep sync
            toast.success("Settings saved");
        }
    } catch (error) {
        console.error("Failed to update setting:", error);
        toast.error("Failed to update setting");
        // Revert on error
        setQuickSettings(prevSettings =>
            prevSettings.map(setting =>
              setting.key === key ? { ...setting, enabled: !setting.enabled } : setting
            )
        );
    }
  };

  const confirmLogout = async () => {
    setLogoutLoading(true);
    try {
      await signOut();
      setShowLogoutModal(false);
      navigate("/login");
    } finally {
      setLogoutLoading(false);
    }
  };

  const settingSections: SettingSection[] = [
    {
      id: "account",
      title: "Account Settings",
      description: "Manage your profile, email, and password",
      icon: User,
      color: "from-blue-500 to-indigo-600",
      route: "/app/settings/account"
    },
    {
      id: "billing",
      title: "Billing & Subscription",
      description: "Manage your plan, invoices, and payments",
      icon: CreditCard,
      color: "from-emerald-500 to-teal-600",
      route: "/app/billing"
    },
    {
      id: "privacy",
      title: "Privacy & Security",
      description: "Control your data, privacy settings, and security",
      icon: Shield,
      color: "from-purple-500 to-pink-600",
      route: "/app/settings/privacy"
    },
    {
      id: "notifications",
      title: "Notifications",
      description: "Customize alerts, reminders, and updates",
      icon: Bell,
      color: "from-yellow-500 to-orange-600",
      route: "/app/settings/notifications",
      badge: unreadCount > 0 ? String(unreadCount) : undefined
    },
    {
      id: "accessibility",
      title: "Accessibility",
      description: "Screen reader, text size, and assistive features",
      icon: Eye,
      color: "from-green-500 to-emerald-600",
      route: "/app/settings/accessibility"
    },
    {
      id: "appearance",
      title: "Appearance",
      description: "Theme, colors, and visual preferences",
      icon: Palette,
      color: "from-pink-500 to-rose-600",
      route: "/app/settings/appearance"
    },
    {
      id: "change-avatar",
      title: "Change AI Companion",
      description: "Switch to a different AI companion for your sessions",
      icon: Brain,
      color: "from-blue-500 to-cyan-600",
      route: "/app/settings/change-avatar"
    },
    {
      id: "achievements",
      title: "Achievements",
      description: "View your badges, milestones, and progress",
      icon: Trophy,
      color: "from-yellow-500 to-amber-600",
      route: "/app/settings/achievements"
    },
    {
      id: "community",
      title: "Community",
      description: "Connect with others and share your journey",
      icon: Users,
      color: "from-cyan-500 to-blue-600",
      route: "/app/settings/community"
    },
    {
      id: "resources",
      title: "Resources Library",
      description: "Browse articles, videos, and wellness exercises",
      icon: BookOpen,
      color: "from-indigo-500 to-purple-600",
      route: "/app/settings/resources"
    },
    {
      id: "brain",
      title: "Brain Health",
      description: "Explore cognitive exercises and brain health tips",
      icon: Brain,
      color: "from-teal-500 to-cyan-600",
      route: "/app/settings/brain-health"
    }
  ];

  const safetySections: SettingSection[] = [
    {
      id: "emergency-contacts",
      title: "Emergency Contacts",
      description: "Add trusted contacts who get notified",
      icon: Phone,
      color: "from-red-500 to-rose-600",
      route: "/app/settings/emergency-contacts"
    },
    {
      id: "safety-plan",
      title: "Safety Plan",
      description: "Personalized safety plan builder (6 sections)",
      icon: FileHeart,
      color: "from-orange-500 to-red-600",
      route: "/app/settings/safety-plan"
    },
    {
      id: "safety-insights",
      title: "Safety Insights",
      description: "Your safety score, patterns, recommendations",
      icon: TrendingUp,
      color: "from-green-500 to-emerald-600",
      route: "/app/settings/safety-insights",
      badge: "NEW"
    },
    {
      id: "crisis-resources",
      title: "Crisis Resources",
      description: "27 international hotlines (6 regions)",
      icon: AlertCircle,
      color: "from-red-600 to-pink-600",
      route: "/app/crisis-resources"
    },
    {
      id: "resource-analytics",
      title: "Resource Analytics",
      description: "Track which resources you use",
      icon: BarChart3,
      color: "from-purple-500 to-indigo-600",
      route: "/app/settings/resource-analytics"
    },
    {
      id: "Crisis Notification",
      title: "Crisis Notification ",
      description: "See all notifications sent",
      icon: History,
      color: "from-blue-500 to-cyan-600",
      route: "/app/settings/notification-history"
    },
    {
      id: "cooldown-screen",
      title: "Cooldown Screen",
      description: "Recovery exercises after tough sessions",
      icon: Wind,
      color: "from-cyan-500 to-teal-600",
      route: "/app/settings/cooldown-screen"
    }
  ];

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link
              to="/app/dashboard"
              className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>

            <div className="flex items-center gap-4 mb-2">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg transition-transform hover:scale-[1.02]">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
                <p className="text-gray-600 dark:text-gray-400">Customize your Ezri experience</p>
              </div>
            </div>
          </div>

          {/* Quick Settings */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-slate-700 mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Quick Settings</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {quickSettings.map((setting) => {
                const Icon = setting.icon;
                return (
                  <button
                    type="button"
                    key={setting.label}
                    className={`p-4 rounded-xl border-2 transition-all hover:scale-[1.03] active:scale-[0.97] ${
                      setting.enabled
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                        : "border-gray-200 bg-gray-50 dark:bg-slate-800 dark:border-slate-700"
                    }`}
                    onClick={() => toggleQuickSetting(setting.key)}
                  >
                    <Icon className={`w-6 h-6 mx-auto mb-2 ${
                      setting.enabled ? "text-blue-600 dark:text-blue-400" : "text-gray-400"
                    }`} />
                    <p className={`text-xs font-medium ${
                      setting.enabled ? "text-blue-900 dark:text-blue-100" : "text-gray-600 dark:text-gray-400"
                    }`}>
                      {setting.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Settings Sections */}
          <div className="space-y-4">
            {settingSections.map((section) => {
              const Icon = section.icon;
              const sectionCard = (
                <div className="flex items-start gap-4">
                  <div className={`settings-hub-icon-chip p-3 rounded-xl bg-gradient-to-br ${section.color} shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 break-words">{section.title}</h3>
                      {section.badge && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                          {section.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 break-words">{section.description}</p>
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 mt-1" />
                </div>
              );

              return (
                <div key={section.id}>
                  <Link
                    to={section.route || "/app/settings"}
                    className="block bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-slate-700 hover:shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    {sectionCard}
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Safety & Support Section */}
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="settings-hub-icon-chip p-3 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Safety & Support</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Your wellbeing is our priority</p>
              </div>
            </div>

            <div className="space-y-4">
              {safetySections.map((section) => {
                const Icon = section.icon;
                return (
                  <div key={section.id}>
                <Link
                  to={section.route || "/app/settings"}
                  className="block bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-slate-700 hover:shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                      <div className="flex items-start gap-4">
                        <div className={`settings-hub-icon-chip p-3 rounded-xl bg-gradient-to-br ${section.color} shrink-0`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-gray-900 dark:text-gray-100 break-words">{section.title}</h3>
                            {section.badge && (
                              <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
                                {section.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 break-words">{section.description}</p>
                        </div>

                        <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 mt-1" />
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Additional Options */}
          <div className="mt-6 space-y-3">
            <Link
              to="/app/settings/help-support"
              className="block bg-white dark:bg-slate-900 rounded-xl p-4 shadow-md border border-gray-100 dark:border-slate-700 hover:shadow-lg transition-all"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-gray-900 dark:text-gray-100">Help & Support</span>
                <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 ml-auto" />
              </div>
            </Link>

            <button
              onClick={() => setShowLogoutModal(true)}
              className="w-full bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-red-600" />
                <span className="font-medium text-red-600">Log Out</span>
              </div>
            </button>
          </div>

          {/* App Info */}
          <div className="mt-8 text-center">
            <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-2">
              <Heart className="w-4 h-4" />
              <span>Made with care for your wellbeing</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Ezri v1.0.0 • © 2024 • <Link to="/privacy" className="underline">Privacy</Link> • <Link to="/terms" className="underline">Terms</Link>
            </p>
          </div>

          <AlertDialog
            open={showLogoutModal}
            onOpenChange={(open) => {
              if (logoutLoading) return;
              setShowLogoutModal(open);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Log out?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to log out of your account?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={logoutLoading}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmLogout}
                  className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
                  disabled={logoutLoading}
                >
                  {logoutLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Logging out...
                    </span>
                  ) : (
                    "Log Out"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </AppLayout>
  );
}
