import { motion } from "motion/react";
import {
  Shield,
  Lock,
  Eye,
  Download,
  Trash2,
  ArrowLeft,
  Bell,
  Heart,
  Brain,
  BarChart3,
  Link2,
  ChevronRight,
  Laptop,
  Smartphone,
  ShieldCheck,
  MessageCircle,
  AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useSafetyConsent } from "@/app/contexts/SafetyContext";
import { useAuth } from "@/app/contexts/AuthContext";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  PRIVACY_BANNER_IMG,
  PRIVACY_ENCRYPTION_IMG,
  PRIVACY_HERO_IMG,
  privacyBackLink,
  privacyBtnGhost,
  privacyBtnPrimary,
  privacyBtnRose,
  privacyCommitmentBanner,
  privacyCompactCard,
  privacyDataCard,
  privacyGlassCard,
  privacyHeroAccent,
  privacyHeroCard,
  privacyHeroImage,
  privacyHeroOverlayLeft,
  privacyHeroOverlayPurple,
  privacyHeroOverlayWarmth,
  privacyHeroTitle,
  privacyIconChip,
  privacyLinkMuted,
  privacyPageAtmosphere,
  privacyPageFogMid,
  privacyPageGlowTop,
  privacyPageVignette,
  privacyRailCard,
  privacyRow,
  privacySectionSubtitle,
  privacySectionTitle,
  privacySelect,
  privacySessionRow,
} from "@/app/pages/app/privacy-settings/privacySettingsUi";

function csvEscape(value: unknown) {
  const normalized = value === null || value === undefined ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function flattenForCsv(value: unknown, basePath = "", rows: Array<[string, string]> = []) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      rows.push([basePath || "root", ""]);
      return rows;
    }
    value.forEach((item, index) => {
      const nextPath = basePath ? `${basePath}[${index}]` : `[${index}]`;
      flattenForCsv(item, nextPath, rows);
    });
    return rows;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      rows.push([basePath || "root", ""]);
      return rows;
    }
    entries.forEach(([key, nestedValue]) => {
      const nextPath = basePath ? `${basePath}.${key}` : key;
      flattenForCsv(nestedValue, nextPath, rows);
    });
    return rows;
  }

  rows.push([basePath || "root", value === null || value === undefined ? "" : String(value)]);
  return rows;
}

function jsonToExcelFriendlyCsv(jsonValue: unknown) {
  const rows = flattenForCsv(jsonValue);
  const contentRows = rows.map(([field, value]) => `${csvEscape(field)},${csvEscape(value)}`);
  return `\uFEFFField,Value\r\n${contentRows.join("\r\n")}`;
}

function getTotpFactorsFromMfaList(data: { totp?: unknown; all?: unknown } | null | undefined) {
  const fromTotp = Array.isArray(data?.totp) ? data.totp : [];
  const fromAll = Array.isArray(data?.all)
    ? (data.all as { factor_type?: string; id?: string }[]).filter((f) => f?.factor_type === "totp")
    : [];
  const byId = new Map<string, (typeof fromTotp)[number]>();
  for (const f of [...fromTotp, ...fromAll] as { id?: string }[]) {
    if (f?.id) byId.set(f.id, f as (typeof fromTotp)[number]);
  }
  return Array.from(byId.values());
}

interface PrivacyToggleProps {
  enabled: boolean;
  onToggle: () => void;
  ariaLabel: string;
}

function PrivacyToggle({ enabled, onToggle, ariaLabel }: PrivacyToggleProps) {
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      whileTap={{ scale: 0.95 }}
      onClick={onToggle}
      className={cn(
        "relative h-8 w-14 shrink-0 rounded-full transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50",
        enabled ? "bg-violet-500/55 shadow-[0_0_20px_-4px_rgba(139,92,246,0.55)]" : "bg-white/10"
      )}
    >
      <motion.span
        animate={{ x: enabled ? 26 : 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className="absolute top-1 left-0 h-6 w-6 rounded-full bg-white shadow-md"
      />
    </motion.button>
  );
}

interface PrivacyRowProps {
  icon: ReactNode;
  tone: "violet" | "pink" | "cyan" | "amber" | "rose" | "emerald" | "blue";
  title: string;
  description: string;
  control: ReactNode;
}

function PrivacyControlRow({ icon, tone, title, description, control }: PrivacyRowProps) {
  return (
    <motion.div className={privacyRow} initial={false}>
      <motion.div className="flex min-w-0 flex-1 items-start gap-3.5">
        <div className={privacyIconChip(tone)}>{icon}</div>
        <div className="min-w-0">
          <p className="font-medium text-[rgba(255,255,255,0.92)]">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-[rgba(255,255,255,0.45)]">{description}</p>
        </div>
      </motion.div>
      <div className="shrink-0 sm:pl-4">{control}</div>
    </motion.div>
  );
}

export function PrivacySettings() {
  const { consent, updateConsent } = useSafetyConsent();
  const { profile } = useAuth();

  const [settings, setSettings] = useState({
    profileVisibility: "public",
    allowAnalytics: true,
    shareProgress: false,
    allowCookies: true,
    marketingEmails: false,
    thirdPartySharing: false,
    communityEnabled: true,
    showDisplayNameInCommunity: true,
    showAvatarInCommunity: true,
  });

  const [thirdPartyExpanded, setThirdPartyExpanded] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [knowledge2faEnabled, setKnowledge2faEnabled] = useState(false);

  const loginAlertsEnabled = profile?.notification_preferences?.pushEnabled ?? true;

  useEffect(() => {
    if (profile?.privacy_settings) {
      const normalizedVisibility =
        profile.privacy_settings.profileVisibility === "friends"
          ? "private"
          : profile.privacy_settings.profileVisibility ?? "public";
      setSettings((prev) => ({
        ...prev,
        ...profile.privacy_settings,
        ...(normalizedVisibility ? { profileVisibility: normalizedVisibility } : {}),
      }));
    }
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error || cancelled) return;
        const totp = getTotpFactorsFromMfaList(data);
        setMfaEnabled(totp.length > 0);
        const knowledge = await api.getKnowledgeTwoFactorStatus().catch(() => null);
        if (!cancelled && knowledge) {
          setKnowledge2faEnabled(Boolean(knowledge.enabled));
        }
      } catch {
        /* display-only */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentDevice = useMemo(() => {
    if (typeof navigator === "undefined") {
      return { label: "This device", meta: "Current session", isMobile: false };
    }
    const ua = navigator.userAgent;
    const isMobile = /iPhone|iPad|Android/i.test(ua);
    const isMac = /Mac OS X/i.test(ua);
    const isWin = /Windows/i.test(ua);
    const browser = /Chrome/i.test(ua) && !/Edg/i.test(ua)
      ? "Chrome"
      : /Safari/i.test(ua) && !/Chrome/i.test(ua)
        ? "Safari"
        : /Firefox/i.test(ua)
          ? "Firefox"
          : "Browser";
    const os = isMobile
      ? /iPhone|iPad/i.test(ua)
        ? "iOS"
        : "Android"
      : isMac
        ? "macOS"
        : isWin
          ? "Windows"
          : "Desktop";
    const label = isMobile ? (/iPhone/i.test(ua) ? "iPhone" : "Mobile device") : isMac ? "MacBook Pro 16\"" : "This device";
    return {
      label,
      meta: `${os} · ${browser} · Active now`,
      isMobile,
    };
  }, []);

  const twoFactorEnabled = mfaEnabled || knowledge2faEnabled;
  const accountScore = twoFactorEnabled && settings.profileVisibility === "private" ? 92 : twoFactorEnabled ? 86 : 78;
  const accountScoreLabel = accountScore >= 90 ? "Excellent" : accountScore >= 80 ? "Good" : "Fair";

  const updateSettings = async (newSettings: typeof settings) => {
    setSettings(newSettings);

    try {
      await api.updateProfile({
        privacy_settings: newSettings,
      });
    } catch (error) {
      console.error("Failed to update privacy settings:", error);
      toast.error("Failed to save settings");
      if (profile?.privacy_settings) {
        setSettings((prev) => ({
          ...prev,
          ...profile.privacy_settings,
        }));
      }
    }
  };

  const toggleSetting = (key: keyof typeof settings) => {
    const newSettings = {
      ...settings,
      [key]: !settings[key],
    };
    updateSettings(newSettings);
  };

  const toggleLoginAlerts = async () => {
    const currentPrefs = profile?.notification_preferences || {};
    const newPrefs = { ...currentPrefs, pushEnabled: !loginAlertsEnabled };
    try {
      await api.updateProfile({ notification_preferences: newPrefs });
      toast.success("Settings saved");
    } catch (error) {
      console.error("Failed to update login alerts:", error);
      toast.error("Failed to save settings");
    }
  };

  const handleDownloadData = async () => {
    toast.info("Preparing your data for download...");
    try {
      const { blob, filename, contentType } = await api.exportUserData();
      const isJsonPayload =
        contentType.toLowerCase().includes("json") ||
        (filename?.toLowerCase().endsWith(".json") ?? false);

      let blobToDownload = blob;
      let resolvedFilename = filename?.trim() || `ezri-data-export-${new Date().toISOString().split("T")[0]}.json`;

      if (isJsonPayload) {
        try {
          const jsonText = await blob.text();
          const parsedJson = JSON.parse(jsonText);
          const csvContent = jsonToExcelFriendlyCsv(parsedJson);
          blobToDownload = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
          resolvedFilename = resolvedFilename.replace(/\.json$/i, ".csv");
          if (!resolvedFilename.toLowerCase().endsWith(".csv")) {
            resolvedFilename = `ezri-data-export-${new Date().toISOString().split("T")[0]}.csv`;
          }
        } catch (conversionError) {
          console.warn("Export returned JSON-like file that could not be converted to CSV:", conversionError);
        }
      } else if (!filename?.trim()) {
        const fallbackExtension = contentType.includes("csv")
          ? "csv"
          : contentType.includes("zip")
            ? "zip"
            : "json";
        resolvedFilename = `ezri-data-export-${new Date().toISOString().split("T")[0]}.${fallbackExtension}`;
      }

      const url = window.URL.createObjectURL(blobToDownload);
      const a = document.createElement("a");
      a.href = url;
      a.download = resolvedFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success("Your data has been downloaded successfully!");
    } catch (error) {
      console.error("Failed to download user data:", error);
      toast.error("Failed to download your data. Please try again.");
    }
  };

  const handleDeleteAllData = async () => {
    const confirmation = window.confirm(
      "⚠️ Warning: This will permanently delete ALL your data including:\n\n" +
        "• Profile information\n" +
        "• Mood tracking history\n" +
        "• Journal entries\n" +
        "• Session data\n" +
        "• Habits and goals\n" +
        "• All wellness data\n\n" +
        "This action CANNOT be undone. Are you sure you want to continue?"
    );

    if (confirmation) {
      const finalConfirmation = window.confirm(
        'Final confirmation: Type "DELETE" in your mind and click OK to permanently delete all your data.'
      );

      if (finalConfirmation) {
        try {
          await api.deleteAccount();
          toast.success("Your data has been permanently deleted.");
        } catch (error) {
          console.error("Failed to delete user data:", error);
          toast.error("Failed to delete your data. Please try again.");
        }
      }
    }
  };

  return (
    <motion.div
      className={privacyPageAtmosphere}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <div className={privacyPageGlowTop} aria-hidden />
      <motion.div className={privacyPageFogMid} aria-hidden />
      <div className={privacyPageVignette} aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9">
        <motion.div
          className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Main column */}
          <div className="min-w-0 space-y-6">
            {/* Hero */}
            <section className={privacyHeroCard}>
              <img src={PRIVACY_HERO_IMG} alt="" className={privacyHeroImage} />
              <motion.div className={privacyHeroOverlayLeft} aria-hidden />
              <motion.div className={privacyHeroOverlayPurple} aria-hidden />
              <motion.div className={privacyHeroOverlayWarmth} aria-hidden />

              <div className="relative flex h-full min-h-[280px] flex-col justify-between p-6 sm:min-h-[300px] sm:p-8 lg:min-h-[320px] lg:flex-row lg:items-center lg:gap-8">
                <div className="max-w-xl flex-1">
                  <Link to="/app/settings" className={privacyBackLink}>
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    Back to Settings
                  </Link>

                  <h1 className={cn(privacyHeroTitle, "mt-5")}>
                    Privacy & <span className={privacyHeroAccent}>Security</span>
                  </h1>
                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-[rgba(255,255,255,0.62)] sm:text-[15px]">
                    You&apos;re in control of your data, your privacy, and your safety.
                  </p>
                  <p className="mt-4 inline-flex items-center gap-2 text-xs text-[rgba(255,255,255,0.5)]">
                    <Shield className="h-3.5 w-3.5 text-violet-300/70" aria-hidden />
                    We protect your privacy so you can focus on your wellbeing.
                  </p>
                </div>

                <motion.div className="flex shrink-0 justify-center lg:justify-end">
                  <div className="relative flex h-[190px] w-[190px] items-center justify-center sm:h-[210px] sm:w-[210px]">
                    <div
                      className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.35)_0%,rgba(139,92,246,0.08)_45%,transparent_70%)] blur-md"
                      aria-hidden
                    />
                    <div className="relative flex h-full w-full flex-col items-center justify-center rounded-full border border-violet-300/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(15,16,36,0.75)_100%)] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_48px_-8px_rgba(139,92,246,0.5)] backdrop-blur-md">
                      <Shield className="h-8 w-8 text-violet-200/90" aria-hidden />
                      <p className="mt-2 text-lg font-semibold text-white">Protected</p>
                      <p className="mt-1 max-w-[140px] text-[11px] leading-snug text-[rgba(255,255,255,0.55)]">
                        Your data is encrypted and secure
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </section>

            {/* Account protection */}
            <section className={cn(privacyGlassCard, "p-6 sm:p-8")}>
              <div>
                <h2 className={privacySectionTitle}>Account protection</h2>
                <p className={privacySectionSubtitle}>Keep your account safe and secure</p>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className={privacyCompactCard}>
                  <div className={privacyIconChip("violet")}>
                    <Lock className="h-4 w-4" aria-hidden />
                  </div>
                  <motion.div>
                    <p className="text-sm font-semibold text-white">Password</p>
                    <p className="mt-1 text-[11px] text-[rgba(255,255,255,0.45)]">Manage in account settings</p>
                  </motion.div>
                  <Link to="/app/settings/account" className={privacyBtnGhost}>
                    Change
                  </Link>
                </div>

                <div className={privacyCompactCard}>
                  <motion.div className={privacyIconChip("blue")}>
                    <Shield className="h-4 w-4" aria-hidden />
                  </motion.div>
                  <div>
                    <p className="text-sm font-semibold text-white">Two-factor auth</p>
                    <p className="mt-1 text-[11px] text-[rgba(255,255,255,0.45)]">Added protection for your account</p>
                  </div>
                  {twoFactorEnabled ? (
                    <span className="inline-flex w-fit rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">
                      Enabled
                    </span>
                  ) : (
                    <Link to="/app/settings/account" className={privacyBtnGhost}>
                      Enable
                    </Link>
                  )}
                </div>

                <div className={privacyCompactCard}>
                  <div className={privacyIconChip("emerald")}>
                    <ShieldCheck className="h-4 w-4" aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Recovery methods</p>
                    <p className="mt-1 text-[11px] text-[rgba(255,255,255,0.45)]">Email & backup methods</p>
                  </div>
                  <Link to="/app/settings/account" className={privacyBtnGhost}>
                    Manage
                  </Link>
                </div>

                <div className={privacyCompactCard}>
                  <div className={privacyIconChip("amber")}>
                    <Bell className="h-4 w-4" aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Login alerts</p>
                    <p className="mt-1 text-[11px] leading-snug text-[rgba(255,255,255,0.45)]">
                      Get notified about suspicious activity
                    </p>
                  </div>
                  <PrivacyToggle
                    enabled={loginAlertsEnabled}
                    onToggle={toggleLoginAlerts}
                    ariaLabel="Login alerts"
                  />
                </div>

                <div className={privacyCompactCard}>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-violet-400/35 bg-violet-500/10 text-lg font-semibold text-violet-100 shadow-[0_0_28px_-8px_rgba(139,92,246,0.45)]">
                    {accountScore}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white">{accountScoreLabel}</p>
                    <Link to="/app/settings/account" className={cn(privacyLinkMuted, "mt-1 justify-center")}>
                      View details
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            {/* Active sessions */}
            <section className={cn(privacyGlassCard, "overflow-hidden")}>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.05] px-6 py-5">
                <div>
                  <h2 className={privacySectionTitle}>Active sessions</h2>
                  <p className={privacySectionSubtitle}>Manage where you&apos;re signed in</p>
                </div>
                <Link to="/app/settings/account" className={privacyLinkMuted}>
                  View all sessions
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <Link to="/app/settings/account" className={cn(privacySessionRow, "group")}>
                <div className={privacyIconChip("cyan")}>
                  {currentDevice.isMobile ? (
                    <Smartphone className="h-4 w-4" aria-hidden />
                  ) : (
                    <Laptop className="h-4 w-4" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[rgba(255,255,255,0.92)]">{currentDevice.label}</p>
                    <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">
                      Current session
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[rgba(255,255,255,0.45)]">{currentDevice.meta}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-300/80">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
                  Active now
                </div>
                <ChevronRight className="h-5 w-5 text-[rgba(255,255,255,0.28)] group-hover:text-violet-300" />
              </Link>

              <div className={cn(privacySessionRow, "opacity-80")}>
                <div className={privacyIconChip("blue")}>
                  <Smartphone className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[rgba(255,255,255,0.88)]">Other devices</p>
                  <p className="mt-0.5 text-xs text-[rgba(255,255,255,0.42)]">Review sign-ins in account settings</p>
                </div>
                <span className="text-xs text-[rgba(255,255,255,0.38)]">—</span>
                <ChevronRight className="h-5 w-5 text-[rgba(255,255,255,0.2)]" aria-hidden />
              </div>
            </section>

            {/* Privacy controls */}
            <section className={cn(privacyGlassCard, "overflow-hidden")}>
              <div className="border-b border-white/[0.05] px-6 py-5">
                <h2 className={privacySectionTitle}>Privacy controls</h2>
                <p className={privacySectionSubtitle}>Control what you share and how your data is used</p>
              </div>

              <PrivacyControlRow
                icon={<Eye className="h-4 w-4" />}
                tone="violet"
                title="Profile visibility"
                description="Choose who can see your profile and activity"
                control={
                  <select
                    value={settings.profileVisibility}
                    onChange={(e) => updateSettings({ ...settings, profileVisibility: e.target.value })}
                    className={privacySelect}
                    aria-label="Profile visibility"
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                }
              />

              <PrivacyControlRow
                icon={<Brain className="h-4 w-4" />}
                tone="pink"
                title="Companion memory"
                description="Allow Solace to remember your preferences and patterns"
                control={
                  <PrivacyToggle
                    enabled={settings.communityEnabled}
                    onToggle={() => toggleSetting("communityEnabled")}
                    ariaLabel="Companion memory"
                  />
                }
              />

              <PrivacyControlRow
                icon={<BarChart3 className="h-4 w-4" />}
                tone="cyan"
                title="Data insights"
                description="Allow insights to improve your experience"
                control={
                  <PrivacyToggle
                    enabled={settings.shareProgress}
                    onToggle={() => toggleSetting("shareProgress")}
                    ariaLabel="Data insights"
                  />
                }
              />

              <PrivacyControlRow
                icon={<Shield className="h-4 w-4" />}
                tone="emerald"
                title="Anonymous analytics"
                description="Help improve Solace with anonymous usage data"
                control={
                  <PrivacyToggle
                    enabled={settings.allowAnalytics}
                    onToggle={() => toggleSetting("allowAnalytics")}
                    ariaLabel="Anonymous analytics"
                  />
                }
              />

              <div>
                <button
                  type="button"
                  className={cn(privacyRow, "w-full text-left")}
                  onClick={() => setThirdPartyExpanded((v) => !v)}
                  aria-expanded={thirdPartyExpanded}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3.5">
                    <div className={privacyIconChip("amber")}>
                      <Link2 className="h-4 w-4" aria-hidden />
                    </div>
                    <div>
                      <p className="font-medium text-[rgba(255,255,255,0.92)]">Third-party services</p>
                      <p className="mt-1 text-sm text-[rgba(255,255,255,0.45)]">
                        Manage data shared with third-party services
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className={cn(
                      "h-5 w-5 shrink-0 text-[rgba(255,255,255,0.35)] transition-transform",
                      thirdPartyExpanded && "rotate-90"
                    )}
                  />
                </button>

                {thirdPartyExpanded ? (
                  <div className="border-t border-white/[0.05] bg-black/20 px-4 pb-4 sm:px-6">
                    <PrivacyControlRow
                      icon={<Link2 className="h-4 w-4" />}
                      tone="amber"
                      title="Third-party data sharing"
                      description="Share with partner services"
                      control={
                        <PrivacyToggle
                          enabled={settings.thirdPartySharing}
                          onToggle={() => toggleSetting("thirdPartySharing")}
                          ariaLabel="Third-party data sharing"
                        />
                      }
                    />
                    <PrivacyControlRow
                      icon={<Bell className="h-4 w-4" />}
                      tone="rose"
                      title="Marketing communications"
                      description="Receive promotional emails"
                      control={
                        <PrivacyToggle
                          enabled={settings.marketingEmails}
                          onToggle={() => toggleSetting("marketingEmails")}
                          ariaLabel="Marketing communications"
                        />
                      }
                    />
                    <PrivacyControlRow
                      icon={<Lock className="h-4 w-4" />}
                      tone="violet"
                      title="Essential cookies"
                      description="Required for app functionality"
                      control={
                        <PrivacyToggle
                          enabled={settings.allowCookies}
                          onToggle={() => toggleSetting("allowCookies")}
                          ariaLabel="Essential cookies"
                        />
                      }
                    />
                  </div>
                ) : null}
              </div>

              {/* Trusted contact notifications — preserved from prior page */}
              <div className="border-t border-white/[0.05] bg-violet-500/[0.04]">
                <PrivacyControlRow
                  icon={<Heart className="h-4 w-4" />}
                  tone="pink"
                  title="Trusted contact notifications"
                  description="Allow trusted contacts to receive supportive check-in messages when our safety system detects you may need extra support"
                  control={
                    <PrivacyToggle
                      enabled={consent.trustedContactEnabled}
                      onToggle={() => updateConsent({ trustedContactEnabled: !consent.trustedContactEnabled })}
                      ariaLabel="Trusted contact notifications"
                    />
                  }
                />
                {consent.trustedContactEnabled ? (
                  <div className="mx-4 mb-4 rounded-2xl border border-blue-400/15 bg-blue-500/[0.08] p-4 sm:mx-6">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-300/80" aria-hidden />
                      <div>
                        <p className="text-sm font-medium text-blue-100/95">Trusted contact notifications enabled</p>
                        <p className="mt-1 text-xs leading-relaxed text-[rgba(255,255,255,0.5)]">
                          Messages are privacy-safe and contain no details about your conversations or sessions.
                        </p>
                        <Link
                          to="/app/settings/emergency-contacts"
                          className={cn(privacyLinkMuted, "mt-2")}
                        >
                          Manage trusted contacts
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                        <Link
                          to="/app/settings/emergency-notifications"
                          className={cn(privacyLinkMuted, "mt-2 ml-4")}
                        >
                          Emergency notice history
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            {/* Data management */}
            <section className={cn(privacyGlassCard, "p-6 sm:p-8")}>
              <div>
                <h2 className={privacySectionTitle}>Data management</h2>
                <p className={privacySectionSubtitle}>Your data belongs to you</p>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className={privacyDataCard}>
                  <div className={privacyIconChip("cyan")}>
                    <Download className="h-4 w-4" aria-hidden />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Export your data</p>
                    <p className="mt-2 text-sm leading-relaxed text-[rgba(255,255,255,0.48)]">
                      Download a copy of all your data including journals, insights, and account information.
                    </p>
                  </div>
                  <button type="button" onClick={handleDownloadData} className={privacyBtnPrimary}>
                    Export data
                  </button>
                </div>

                <div
                  className={cn(
                    privacyDataCard,
                    "border-rose-500/12 bg-[linear-gradient(165deg,rgba(76,5,25,0.18)_0%,rgba(12,10,20,0.65)_100%)]"
                  )}
                >
                  <div className={privacyIconChip("rose")}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Delete your data</p>
                    <p className="mt-2 text-sm leading-relaxed text-[rgba(255,255,255,0.48)]">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                  </div>
                  <button type="button" onClick={handleDeleteAllData} className={privacyBtnRose}>
                    Delete account
                  </button>
                </div>
              </div>
            </section>

            {/* Commitment banner */}
            <section className={privacyCommitmentBanner}>
              <img src={PRIVACY_BANNER_IMG} alt="" className="absolute inset-0 h-full w-full object-cover brightness-[0.4] saturate-[1.08]" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0a0b18]/95 via-[#0a0b18]/75 to-[#0a0b18]/55" aria-hidden />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_0%_50%,rgba(139,92,246,0.15)_0%,transparent_55%)]" aria-hidden />

              <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start">
                <motion.div className={cn(privacyIconChip("violet"), "h-14 w-14 shrink-0 [&_svg]:h-7 [&_svg]:w-7")}>
                  <Shield className="h-7 w-7" aria-hidden />
                </motion.div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-serif text-2xl font-light text-white sm:text-[1.65rem]">
                    Your wellbeing. Our responsibility.
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[rgba(255,255,255,0.55)] sm:text-[15px]">
                    We follow industry-leading security practices and HIPAA-aligned standards to keep your data
                    private, secure, and respected.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs">
                    <Link to="/privacy" className={privacyLinkMuted}>
                      Privacy Policy
                    </Link>
                    <Link to="/terms" className={privacyLinkMuted}>
                      Terms of Service
                    </Link>
                    <Link to="/privacy" className={privacyLinkMuted}>
                      HIPAA Compliance
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right security rail */}
          <aside className="w-full space-y-4 xl:sticky xl:top-6 xl:self-start">
            <div className={privacyRailCard}>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
                <p className="text-xs font-medium text-emerald-200/90">All systems secure</p>
              </div>
              <h2 className="mt-3 text-sm font-semibold text-[rgba(255,255,255,0.92)]">Security status</h2>
              <div className="mt-5 flex flex-col items-center py-2 text-center">
                <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-2 border-emerald-400/25 bg-emerald-500/[0.06] shadow-[0_0_36px_-10px_rgba(52,211,153,0.35)]">
                  <Shield className="h-8 w-8 text-emerald-200/90" aria-hidden />
                </div>
                <p className="mt-4 text-lg font-semibold text-white">{accountScoreLabel}</p>
                <p className="mt-1 text-xs text-[rgba(255,255,255,0.48)]">
                  Your account is protected and up to date.
                </p>
              </div>
            </div>

            <div className={privacyRailCard}>
              <div className={privacyIconChip("violet")}>
                <Shield className="h-4 w-4" aria-hidden />
              </div>
              <h2 className="mt-3 text-sm font-semibold text-[rgba(255,255,255,0.92)]">Privacy promise</h2>
              <p className="mt-2 text-xs leading-relaxed text-[rgba(255,255,255,0.5)]">
                We never sell your data. Your emotional privacy is our highest priority.
              </p>
              <Link to="/privacy" className={cn(privacyLinkMuted, "mt-3")}>
                Learn more
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className={privacyRailCard}>
              <div className={privacyIconChip("rose")}>
                <Heart className="h-4 w-4" aria-hidden />
              </div>
              <h2 className="mt-3 text-sm font-semibold text-[rgba(255,255,255,0.92)]">Emergency access</h2>
              <p className="mt-2 text-xs leading-relaxed text-[rgba(255,255,255,0.5)]">
                In a crisis, trusted contacts you&apos;ve chosen can receive limited information to help keep you safe.
              </p>
              <Link to="/app/settings/emergency-contacts" className={cn(privacyLinkMuted, "mt-3")}>
                Manage contacts
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <motion.div className={privacyRailCard}>
              <div className={privacyIconChip("pink")}>
                <MessageCircle className="h-4 w-4" aria-hidden />
              </div>
              <h2 className="mt-3 text-sm font-semibold text-[rgba(255,255,255,0.92)]">Need reassurance?</h2>
              <p className="mt-2 text-xs leading-relaxed text-[rgba(255,255,255,0.5)]">
                Our support team is here to help with any privacy or security concerns.
              </p>
              <Link to="/app/settings/help-support" className={cn(privacyBtnPrimary, "mt-4 w-full")}>
                Contact support
              </Link>
            </motion.div>

            <div className={cn(privacyRailCard, "overflow-hidden p-0")}>
              <div className="p-5 sm:p-6">
                <h2 className="text-sm font-semibold text-[rgba(255,255,255,0.92)]">End-to-end encryption</h2>
                <p className="mt-2 text-xs leading-relaxed text-[rgba(255,255,255,0.5)]">
                  All journal entries, messages, and personal data are encrypted in transit and at rest.
                </p>
              </div>
              <div className="relative h-36 overflow-hidden">
                <img src={PRIVACY_ENCRYPTION_IMG} alt="" className="h-full w-full object-cover brightness-[0.45] saturate-[1.05]" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0b18] via-[#0a0b18]/40 to-transparent" />
                <div className="absolute inset-0 flex items-end justify-center pb-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-300/30 bg-amber-500/15 shadow-[0_0_32px_-6px_rgba(251,191,36,0.45)]">
                    <Lock className="h-5 w-5 text-amber-200/90" aria-hidden />
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </motion.div>
      </div>
    </motion.div>
  );
}
