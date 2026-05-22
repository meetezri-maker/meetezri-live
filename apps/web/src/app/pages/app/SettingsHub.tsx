import {
  User,
  Shield,
  Bell,
  Eye,
  Palette,
  HelpCircle,
  BookOpen,
  Brain,
  Phone,
  FileHeart,
  TrendingUp,
  AlertCircle,
  BarChart3,
  History,
  Wind,
  ChevronRight,
  ArrowLeft,
  LogOut,
  Loader2,
  Moon,
  Mail,
  Smartphone,
  Heart,
  Lock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { useAuth } from "@/app/contexts/AuthContext";
import { useNotifications } from "@/app/contexts/NotificationsContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  APPEARANCE_SETTINGS_VERSION,
  applyThemeToDocument,
} from "@/app/pages/app/appearance-settings/appearanceConstants";
import { formatSubscriptionPlanLabel } from "@/app/pages/app/profile/profileUi";
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
import {
  modalBodyText,
  modalDestructiveButton,
  modalSecondaryButton,
  modalTitle,
} from "@/lib/modalTheme";
import {
  SETTINGS_HERO_IMG,
  SETTINGS_HELP_IMG,
  settingsPageAtmosphere,
  settingsPageGlowTop,
  settingsPageFogMid,
  settingsPageVignette,
  settingsCard,
  settingsHeroSection,
  settingsHeroImage,
  settingsHeroOverlayReadability,
  settingsHeroOverlayBottom,
  settingsHeroOverlayAccent,
  settingsSectionTitle,
  settingsRowLink,
  settingsIconChip,
  settingsBtnPrimary,
  settingsQuickCard,
  settingsCompactToolCard,
} from "@/app/pages/app/settings-hub/settingsUi";

interface SettingSection {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: "violet" | "pink" | "cyan" | "amber" | "rose" | "emerald" | "blue" | "orange";
  route?: string;
  badge?: string;
}

interface QuickSettingItem {
  icon: LucideIcon;
  label: string;
  enabled: boolean;
  key: string;
  tone: "violet" | "pink" | "cyan" | "amber";
  statusOn: string;
  statusOff: string;
}

function quickStatus(item: QuickSettingItem): string {
  return item.enabled ? item.statusOn : item.statusOff;
}

export function SettingsHub() {
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const [quickSettings, setQuickSettings] = useState<QuickSettingItem[]>([
    {
      icon: Moon,
      label: "Dark mode",
      enabled: false,
      key: "darkMode",
      tone: "violet",
      statusOn: "On",
      statusOff: "Off",
    },
    {
      icon: Bell,
      label: "Notifications",
      enabled: true,
      key: "pushEnabled",
      tone: "pink",
      statusOn: "Enabled",
      statusOff: "Disabled",
    },
    {
      icon: Smartphone,
      label: "Mobile alerts",
      enabled: true,
      key: "smsEnabled",
      tone: "cyan",
      statusOn: "On",
      statusOff: "Off",
    },
    {
      icon: Mail,
      label: "Email updates",
      enabled: false,
      key: "emailEnabled",
      tone: "amber",
      statusOn: "Weekly",
      statusOff: "Off",
    },
  ]);

  const appearanceStorageKey = useMemo(() => {
    if (typeof window === "undefined") return "ezri_appearance_settings";
    if (!user?.id) return "ezri_appearance_settings";
    return `ezri_appearance_settings_${user.id}`;
  }, [user?.id]);

  const readAppearanceSettings = () => {
    try {
      const raw = localStorage.getItem(appearanceStorageKey);
      if (!raw) return {} as Record<string, unknown>;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {} as Record<string, unknown>;
    }
  };

  useEffect(() => {
    const syncSettings = () => {
      const appearanceSettings = readAppearanceSettings();
      const isDarkMode = appearanceSettings.theme === "dark";
      const prefs = profile?.notification_preferences || {};

      setQuickSettings((prev) =>
        prev.map((setting) => {
          if (setting.key === "darkMode") return { ...setting, enabled: isDarkMode };
          if (setting.key === "pushEnabled") return { ...setting, enabled: prefs.pushEnabled ?? true };
          if (setting.key === "smsEnabled") return { ...setting, enabled: prefs.smsEnabled ?? false };
          if (setting.key === "emailEnabled") return { ...setting, enabled: prefs.emailEnabled ?? true };
          return setting;
        })
      );
    };

    syncSettings();

    const handleAppearanceChange = (event: Event) => {
      const custom = event as CustomEvent<{ theme?: string }>;
      const detail = custom.detail || {};
      setQuickSettings((prev) =>
        prev.map((setting) => {
          if (setting.key === "darkMode") return { ...setting, enabled: detail.theme === "dark" };
          return setting;
        })
      );
    };

    window.addEventListener("ezri-appearance-change", handleAppearanceChange);
    return () => window.removeEventListener("ezri-appearance-change", handleAppearanceChange);
  }, [profile, appearanceStorageKey]);

  const toggleQuickSetting = async (key: string) => {
    setQuickSettings((prevSettings) =>
      prevSettings.map((setting) =>
        setting.key === key ? { ...setting, enabled: !setting.enabled } : setting
      )
    );

    try {
      if (key === "darkMode") {
        const currentSettings = readAppearanceSettings();
        const newTheme = currentSettings.theme === "dark" ? "light" : "dark";
        const newSettings = {
          ...currentSettings,
          theme: newTheme,
          appearanceVersion: APPEARANCE_SETTINGS_VERSION,
        };
        localStorage.setItem(appearanceStorageKey, JSON.stringify(newSettings));
        applyThemeToDocument(newTheme === "light" ? "light" : "dark");

        window.dispatchEvent(new CustomEvent("ezri-appearance-change", { detail: newSettings }));
        toast.success(newTheme === "dark" ? "Sanctuary theme restored" : "Light theme applied");
      } else {
        const currentPrefs = profile?.notification_preferences || {};
        const setting = quickSettings.find((s) => s.key === key);
        const newValue = !setting?.enabled;
        const newPrefs = { ...currentPrefs, [key]: newValue };

        await api.updateProfile({
          notification_preferences: newPrefs,
        });
        toast.success("Settings saved");
      }
    } catch (error) {
      console.error("Failed to update setting:", error);
      toast.error("Failed to update setting");
      setQuickSettings((prevSettings) =>
        prevSettings.map((setting) =>
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

  const accountSections: SettingSection[] = [
    {
      id: "account",
      title: "Account Settings",
      description: "Manage your profile, email, and password",
      icon: User,
      tone: "violet",
      route: "/app/settings/account",
    },
    {
      id: "privacy",
      title: "Privacy & Security",
      description: "Control your data, privacy settings, and security",
      icon: Shield,
      tone: "pink",
      route: "/app/settings/privacy",
    },
    {
      id: "notifications",
      title: "Notifications",
      description: "Customize alerts, reminders, and updates",
      icon: Bell,
      tone: "amber",
      route: "/app/settings/notifications",
      badge: unreadCount > 0 ? String(unreadCount) : undefined,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      description: "Screen reader, text size, and assistive features",
      icon: Eye,
      tone: "emerald",
      route: "/app/settings/accessibility",
    },
    {
      id: "appearance",
      title: "Appearance",
      description: "Theme, colors, and visual preferences",
      icon: Palette,
      tone: "rose",
      route: "/app/settings/appearance",
    },
    {
      id: "change-avatar",
      title: "Change Solace Avatar",
      description: "Switch to a different avatar for your talks",
      icon: Brain,
      tone: "blue",
      route: "/app/settings/change-avatar",
    },
    {
      id: "resources",
      title: "Resources Library",
      description: "Browse articles, videos, and wellness exercises",
      icon: BookOpen,
      tone: "violet",
      route: "/app/settings/resources",
    },
  ];

  const wellbeingSections: SettingSection[] = [
    {
      id: "emergency-contacts",
      title: "Emergency Contacts",
      description: "Add trusted contacts who get notified",
      icon: Phone,
      tone: "rose",
      route: "/app/settings/emergency-contacts",
    },
    {
      id: "wellness-plan",
      title: "Wellness Plan",
      description: "Personalized wellness plan builder",
      icon: FileHeart,
      tone: "orange",
      route: "/app/settings/wellness-plan",
    },
    {
      id: "safety-insights",
      title: "Safety Insights",
      description: "Your safety score, patterns, recommendations",
      icon: TrendingUp,
      tone: "emerald",
      route: "/app/settings/safety-insights",
    },
    {
      id: "emergency-resources",
      title: "Emergency Resources",
      description: "International hotlines and local resources",
      icon: AlertCircle,
      tone: "rose",
      route: "/app/emergency-resources",
    },
  ];

  const systemToolCards: SettingSection[] = [
    {
      id: "resource-analytics",
      title: "Resource Analytics",
      description: "Track which resources you use most",
      icon: BarChart3,
      tone: "violet",
      route: "/app/settings/resource-analytics",
    },
    {
      id: "emergency-notifications",
      title: "Emergency Notifications",
      description: "Safety-related notifications & alerts",
      icon: History,
      tone: "blue",
      route: "/app/settings/emergency-notifications",
    },
    {
      id: "cooldown-screen",
      title: "Cooldown Screen",
      description: "Recovery exercises after tough talks",
      icon: Wind,
      tone: "cyan",
      route: "/app/settings/cooldown-screen",
    },
  ];

  const displayName =
    (typeof profile?.full_name === "string" && profile.full_name.trim()) ||
    user?.email?.split("@")[0] ||
    "Member";

  const planLabel = formatSubscriptionPlanLabel(
    typeof profile?.subscription_plan === "string" ? profile.subscription_plan : undefined
  );

  const avatarUrl = typeof profile?.avatar_url === "string" ? profile.avatar_url : null;
  const initials = (displayName[0] || "?").toUpperCase();

  return (
    <motion.div
      className={settingsPageAtmosphere}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <motion.div className={settingsPageGlowTop} aria-hidden />
      <motion.div className={settingsPageFogMid} aria-hidden />
      <motion.div className={settingsPageVignette} aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-[1600px] px-1 sm:px-2">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
          {/* Main content ~70% */}
          <motion.div
            className="min-w-0 flex-[7] space-y-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            {/* Hero */}
            <section className={settingsHeroSection}>
              <img
                src={SETTINGS_HERO_IMG}
                alt=""
                className={settingsHeroImage}
                width={1600}
                height={900}
              />
              <div className={settingsHeroOverlayReadability} aria-hidden />
              <div className={settingsHeroOverlayAccent} aria-hidden />
              <div className={settingsHeroOverlayBottom} aria-hidden />

              <div className="relative z-10 px-5 pb-5 pt-5 sm:px-7 sm:pb-6 sm:pt-6">
                <Link
                  to="/app/dashboard"
                  className="inline-flex min-h-[44px] items-center gap-2 text-sm text-[rgba(255,255,255,0.62)] transition-colors hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                  Back to Dashboard
                </Link>

                <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-lg">
                    <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Settings</h1>
                    <p className="mt-2 text-sm text-[rgba(255,255,255,0.65)] sm:text-base">
                      Customize your Solace experience
                    </p>
                  </div>
                </div>

                <div className="mt-8">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[rgba(255,255,255,0.5)]">
                    Quick settings
                  </p>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {quickSettings.map((setting) => {
                      const Icon = setting.icon;
                      return (
                        <button
                          type="button"
                          key={setting.key}
                          className={settingsQuickCard}
                          onClick={() => toggleQuickSetting(setting.key)}
                          aria-pressed={setting.enabled}
                          aria-label={`${setting.label}: ${quickStatus(setting)}. Tap to toggle.`}
                        >
                          <div className={settingsIconChip(setting.tone)}>
                            <Icon className="h-4 w-4" aria-hidden />
                          </div>
                          <span className="text-xs font-medium text-[rgba(255,255,255,0.88)]">{setting.label}</span>
                          <span
                            className={cn(
                              "text-[11px] font-semibold",
                              setting.enabled ? "text-violet-200" : "text-[rgba(255,255,255,0.4)]"
                            )}
                          >
                            {quickStatus(setting)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <SettingsGroup title="Account & preferences" sections={accountSections} />

            <SettingsGroup title="Wellbeing & support" sections={wellbeingSections} />

            {/* System & tools */}
            <section className="space-y-3">
              <h2 className={settingsSectionTitle}>System & tools</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {systemToolCards.map((card) => (
                  <SystemToolCard key={card.id} section={card} />
                ))}
              </div>
              <motion.div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Link
                  to="/app/settings/help-support"
                  className={cn(
                    settingsCompactToolCard,
                    "min-h-[88px] flex-row items-center gap-4 sm:flex-row"
                  )}
                >
                  <div className={settingsIconChip("blue")}>
                    <HelpCircle className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[rgba(255,255,255,0.94)]">Help & Support</p>
                    <p className="mt-0.5 text-xs text-[rgba(255,255,255,0.48)]">
                      Get help, contact support, and FAQs
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[rgba(255,255,255,0.35)] group-hover:text-violet-300" />
                </Link>

                <button
                  type="button"
                  onClick={() => setShowLogoutModal(true)}
                  className={cn(
                    settingsCompactToolCard,
                    "min-h-[88px] w-full flex-row items-center gap-4 border-rose-500/15 text-left",
                    "hover:border-rose-400/30 hover:bg-rose-500/[0.08] hover:shadow-[0_0_32px_-10px_rgba(244,63,94,0.25)]"
                  )}
                >
                  <div className={settingsIconChip("rose")}>
                    <LogOut className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-rose-200/95">Log out</p>
                    <p className="mt-0.5 text-xs text-[rgba(255,255,255,0.48)]">End your current session</p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-rose-300/40" aria-hidden />
                </button>
              </motion.div>
            </section>

            <footer className="pb-2 pt-2 text-center">
              <div className="mb-2 flex items-center justify-center gap-2 text-sm text-[rgba(255,255,255,0.42)]">
                <Heart className="h-4 w-4 text-fuchsia-400/70" aria-hidden />
                <span>Made with care for your wellbeing</span>
              </div>
              <p className="text-xs text-[rgba(255,255,255,0.32)]">
                Solace v1.0.0 • © 2026 •{" "}
                <Link to="/privacy" className="underline-offset-2 hover:text-violet-300/80 hover:underline">
                  Privacy
                </Link>{" "}
                •{" "}
                <Link to="/terms" className="underline-offset-2 hover:text-violet-300/80 hover:underline">
                  Terms
                </Link>
              </p>
            </footer>
          </motion.div>

          {/* Right rail ~30% */}
          <aside className="w-full shrink-0 space-y-4 xl:sticky xl:top-4 xl:w-[min(100%,380px)] xl:flex-[3] xl:self-start">
            <div className={cn(settingsCard, "overflow-hidden p-5")}>
              <h2 className="text-sm font-semibold text-[rgba(255,255,255,0.92)]">Your profile</h2>
              <div className="mt-4 flex flex-col items-center text-center">
                <div className="relative">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-violet-500/40 to-fuchsia-500/20 blur-md" />
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="relative h-20 w-20 rounded-full border-2 border-white/10 object-cover"
                    />
                  ) : (
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-violet-500/30 to-cyan-500/15 text-2xl font-semibold text-white">
                      {initials}
                    </div>
                  )}
                </div>
                <p className="mt-3 text-lg font-semibold text-white">{displayName}</p>
                <span className="mt-1.5 inline-flex rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-0.5 text-[10px] font-semibold tracking-wide text-violet-200/90">
                  {planLabel}
                </span>
                <Link
                  to="/app/billing"
                  className="mt-4 flex w-full min-h-[44px] items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm transition-colors hover:border-violet-400/20 hover:bg-violet-500/[0.06]"
                >
                  <span className="text-[rgba(255,255,255,0.55)]">Plan</span>
                  <span className="flex items-center gap-1 font-medium text-[rgba(255,255,255,0.9)]">
                    {planLabel}
                    <ChevronRight className="h-4 w-4 text-[rgba(255,255,255,0.35)]" />
                  </span>
                </Link>
                <Link to="/app/billing" className={cn(settingsBtnPrimary, "mt-3")}>
                  Manage Plan
                </Link>
              </div>
            </div>

            <div className={cn(settingsCard, "relative overflow-hidden p-0")}>
              <div className="relative h-28 overflow-hidden">
                <img
                  src={SETTINGS_HELP_IMG}
                  alt="Calm mountain landscape at dusk with soft twilight light"
                  className="h-full w-full object-cover object-[center_42%]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0b18] via-[#0a0b18]/55 to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_90%,rgba(251,146,60,0.18),transparent_60%)]" />
              </div>
              <div className="relative p-5 pt-0">
                <h2 className="text-sm font-semibold text-[rgba(255,255,255,0.92)]">Need help?</h2>
                <p className="mt-1.5 text-sm text-[rgba(255,255,255,0.55)]">We&apos;re here for you</p>
                <Link to="/app/settings/help-support" className={cn(settingsBtnPrimary, "mt-4")}>
                  Contact support
                </Link>
              </div>
            </div>

            <div
              className={cn(
                settingsCard,
                "border-emerald-500/10 p-5 shadow-[0_0_40px_-16px_rgba(52,211,153,0.2)]"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={settingsIconChip("emerald")}>
                  <Lock className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[rgba(255,255,255,0.92)]">Your data is safe</h2>
                  <p className="mt-2 text-xs leading-relaxed text-[rgba(255,255,255,0.5)]">
                    We use advanced encryption to keep your information private and secure.
                  </p>
                  <Link
                    to="/app/settings/privacy"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-300 transition hover:text-violet-200"
                  >
                    Learn more
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <AlertDialog
        open={showLogoutModal}
        onOpenChange={(open) => {
          if (logoutLoading) return;
          setShowLogoutModal(open);
        }}
      >
        <AlertDialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <div className="p-6 pb-5">
            <div className="flex items-start gap-4">
              <div className={settingsIconChip("rose")}>
                <LogOut className="h-5 w-5" aria-hidden />
              </div>
              <AlertDialogHeader className="min-w-0 flex-1 gap-1.5 text-left">
                <AlertDialogTitle className={cn(modalTitle, "text-xl")}>
                  Log out?
                </AlertDialogTitle>
                <AlertDialogDescription className={modalBodyText}>
                  Are you sure you want to log out of your account? You can sign back in anytime.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>
          </div>
          <AlertDialogFooter className="flex-row justify-end gap-3 border-t border-white/[0.08] bg-black/20 px-6 py-4 sm:justify-end">
            <AlertDialogCancel disabled={logoutLoading} className={modalSecondaryButton}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLogout}
              className={modalDestructiveButton}
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
    </motion.div>
  );
}

interface SettingsGroupProps {
  title: string;
  sections: SettingSection[];
}

function SettingsGroup({ title, sections }: SettingsGroupProps) {
  return (
    <section className="space-y-3">
      <h2 className={settingsSectionTitle}>{title}</h2>
      <div className={cn(settingsCard, "overflow-hidden divide-y divide-white/[0.05]")}>
        {sections.map((section) => (
          <SettingRowLink key={section.id} section={section} />
        ))}
      </div>
    </section>
  );
}

function SettingRowLink({ section }: { section: SettingSection }) {
  const Icon = section.icon;
  return (
    <Link to={section.route || "/app/settings"} className={settingsRowLink}>
      <div className={settingsIconChip(section.tone)}>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[rgba(255,255,255,0.94)]">{section.title}</h3>
          {section.badge ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
              {section.badge}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-[rgba(255,255,255,0.48)]">{section.description}</p>
      </div>
      <ChevronRight
        className="h-5 w-5 shrink-0 text-[rgba(255,255,255,0.3)] transition group-hover:text-violet-300"
        aria-hidden
      />
    </Link>
  );
}

function SystemToolCard({ section }: { section: SettingSection }) {
  const Icon = section.icon;
  return (
    <Link to={section.route || "/app/settings"} className={settingsCompactToolCard}>
      <div className={settingsIconChip(section.tone)}>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <motion.div>
        <p className="font-semibold text-[rgba(255,255,255,0.92)]">{section.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-[rgba(255,255,255,0.45)]">{section.description}</p>
      </motion.div>
      <ChevronRight className="mt-3 h-4 w-4 text-[rgba(255,255,255,0.28)]" aria-hidden />
    </Link>
  );
}
