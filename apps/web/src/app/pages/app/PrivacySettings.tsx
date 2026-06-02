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
import { SolaceSelect } from "@/app/solace";
import {
  PRIVACY_BANNER_IMG,
  PRIVACY_HERO_IMG,
  privacyBackLink,
  privacyBtnPrimary,
  privacyBtnRose,
  privacyCommitmentBanner,
  privacyCommitmentBannerBody,
  privacyCommitmentBannerContent,
  privacyCommitmentBannerImage,
  privacyCommitmentBannerLink,
  privacyCommitmentBannerOverlay,
  privacyCommitmentBannerTitle,
  privacyDataCard,
  privacyGlassCard,
  privacyHeroAccent,
  privacyHeroBody,
  privacyHeroCard,
  privacyHeroCopy,
  privacyHeroImage,
  privacyHeroInner,
  privacyHeroLead,
  privacyHeroLightScrim,
  privacyHeroOrb,
  privacyHeroOrbGlow,
  privacyHeroOrbWrap,
  privacyHeroOverlayAccent,
  privacyHeroOverlayBottom,
  privacyHeroOverlayReadability,
  privacyHeroTitle,
  privacyIconChip,
  privacyLinkMuted,
  privacyPageAtmosphere,
  privacyPageFogMid,
  privacyPageGlowTop,
  privacyPageVignette,
  privacyRailCard,
  privacyRailCardFlat,
  privacyRow,
  privacySectionSubtitle,
  privacySectionTitle,
  privacySessionRow,
} from "@/app/pages/app/privacy-settings/privacySettingsUi";
import {
  computePrivacySecurityStatus,
  privacySecurityToneStyles,
} from "@/app/pages/app/privacy-settings/privacySecurityStatus";

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

interface PrivacySettingsState {
  profileVisibility: string;
  allowAnalytics: boolean;
  shareProgress: boolean;
  allowCookies: boolean;
  marketingEmails: boolean;
  thirdPartySharing: boolean;
  communityEnabled: boolean;
  showDisplayNameInCommunity: boolean;
  showAvatarInCommunity: boolean;
  trustedContactEnabled: boolean;
}

const DEFAULT_PRIVACY_SETTINGS: PrivacySettingsState = {
  profileVisibility: "public",
  allowAnalytics: true,
  shareProgress: false,
  allowCookies: true,
  marketingEmails: false,
  thirdPartySharing: false,
  communityEnabled: true,
  showDisplayNameInCommunity: true,
  showAvatarInCommunity: true,
  trustedContactEnabled: false,
};

function parsePrivacySettings(raw: unknown): PrivacySettingsState {
  const stored =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const visibility =
    stored.profileVisibility === "friends"
      ? "private"
      : stored.profileVisibility === "private"
        ? "private"
        : "public";

  return {
    profileVisibility: visibility,
    allowAnalytics:
      typeof stored.allowAnalytics === "boolean" ? stored.allowAnalytics : DEFAULT_PRIVACY_SETTINGS.allowAnalytics,
    shareProgress:
      typeof stored.shareProgress === "boolean" ? stored.shareProgress : DEFAULT_PRIVACY_SETTINGS.shareProgress,
    allowCookies:
      typeof stored.allowCookies === "boolean" ? stored.allowCookies : DEFAULT_PRIVACY_SETTINGS.allowCookies,
    marketingEmails:
      typeof stored.marketingEmails === "boolean"
        ? stored.marketingEmails
        : DEFAULT_PRIVACY_SETTINGS.marketingEmails,
    thirdPartySharing:
      typeof stored.thirdPartySharing === "boolean"
        ? stored.thirdPartySharing
        : DEFAULT_PRIVACY_SETTINGS.thirdPartySharing,
    communityEnabled:
      typeof stored.communityEnabled === "boolean"
        ? stored.communityEnabled
        : DEFAULT_PRIVACY_SETTINGS.communityEnabled,
    showDisplayNameInCommunity:
      typeof stored.showDisplayNameInCommunity === "boolean"
        ? stored.showDisplayNameInCommunity
        : DEFAULT_PRIVACY_SETTINGS.showDisplayNameInCommunity,
    showAvatarInCommunity:
      typeof stored.showAvatarInCommunity === "boolean"
        ? stored.showAvatarInCommunity
        : DEFAULT_PRIVACY_SETTINGS.showAvatarInCommunity,
    trustedContactEnabled:
      typeof stored.trustedContactEnabled === "boolean"
        ? stored.trustedContactEnabled
        : DEFAULT_PRIVACY_SETTINGS.trustedContactEnabled,
  };
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
  disabled?: boolean;
}

function PrivacyToggle({ enabled, onToggle, ariaLabel, disabled }: PrivacyToggleProps) {
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      onClick={disabled ? undefined : onToggle}
      className={cn(
        "relative h-8 w-14 shrink-0 rounded-full transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50",
        enabled ? "bg-violet-500/55 shadow-[0_0_20px_-4px_rgba(139,92,246,0.55)]" : "bg-white/10",
        disabled && "cursor-not-allowed opacity-50"
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
  const { updateConsent } = useSafetyConsent();
  const { profile, refreshProfile } = useAuth();

  const [settings, setSettings] = useState<PrivacySettingsState>(DEFAULT_PRIVACY_SETTINGS);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);

  const [thirdPartyExpanded, setThirdPartyExpanded] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [knowledge2faEnabled, setKnowledge2faEnabled] = useState(false);
  const [loginAlertsEnabled, setLoginAlertsEnabled] = useState(true);

  useEffect(() => {
    if (profile?.notification_preferences) {
      setLoginAlertsEnabled(profile.notification_preferences.pushEnabled ?? true);
    }
  }, [profile?.notification_preferences]);

  useEffect(() => {
    if (!profile?.privacy_settings || isSavingPrivacy) return;
    const parsed = parsePrivacySettings(profile.privacy_settings);
    setSettings(parsed);
    updateConsent({ trustedContactEnabled: parsed.trustedContactEnabled });
  }, [profile?.privacy_settings, isSavingPrivacy, updateConsent]);

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
  const emailVerified =
    profile?.email_verified === true && profile?.needs_email_verification !== true;

  const securityStatus = useMemo(
    () =>
      computePrivacySecurityStatus({
        profileVisibility: settings.profileVisibility,
        shareProgress: settings.shareProgress,
        thirdPartySharing: settings.thirdPartySharing,
        marketingEmails: settings.marketingEmails,
        trustedContactEnabled: settings.trustedContactEnabled,
        showAvatarInCommunity: settings.showAvatarInCommunity,
        twoFactorEnabled,
        loginAlertsEnabled,
        emailVerified,
      }),
    [
      settings.profileVisibility,
      settings.shareProgress,
      settings.thirdPartySharing,
      settings.marketingEmails,
      settings.trustedContactEnabled,
      settings.showAvatarInCommunity,
      twoFactorEnabled,
      loginAlertsEnabled,
      emailVerified,
    ]
  );

  const securityTone = privacySecurityToneStyles[securityStatus.tone];

  const buildPrivacyPayload = (patch: Partial<PrivacySettingsState>) => {
    const existing =
      profile?.privacy_settings && typeof profile.privacy_settings === "object"
        ? (profile.privacy_settings as Record<string, unknown>)
        : {};
    return { ...existing, ...settings, ...patch };
  };

  const persistPrivacySettings = async (
    patch: Partial<PrivacySettingsState>,
    options?: { syncTrustedContact?: boolean }
  ) => {
    const previousSettings = settings;
    const nextSettings = { ...settings, ...patch };
    setSettings(nextSettings);
    if (options?.syncTrustedContact && patch.trustedContactEnabled !== undefined) {
      updateConsent({ trustedContactEnabled: patch.trustedContactEnabled });
    }
    setIsSavingPrivacy(true);

    try {
      await api.updateProfile({ privacy_settings: buildPrivacyPayload(patch) });
      await refreshProfile();
      toast.success("Settings saved");
    } catch (error) {
      setSettings(previousSettings);
      if (options?.syncTrustedContact && patch.trustedContactEnabled !== undefined) {
        updateConsent({ trustedContactEnabled: previousSettings.trustedContactEnabled });
      }
      console.error("Failed to update privacy settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSavingPrivacy(false);
    }
  };

  const toggleSetting = (key: keyof PrivacySettingsState) => {
    if (isSavingPrivacy) return;
    const nextValue = !settings[key];
    void persistPrivacySettings(
      { [key]: nextValue } as Partial<PrivacySettingsState>,
      key === "trustedContactEnabled" ? { syncTrustedContact: true } : undefined
    );
  };

  const toggleLoginAlerts = async () => {
    const previousValue = loginAlertsEnabled;
    const nextValue = !previousValue;
    setLoginAlertsEnabled(nextValue);

    const currentPrefs = profile?.notification_preferences || {};
    const newPrefs = { ...currentPrefs, pushEnabled: nextValue };
    try {
      await api.updateProfile({ notification_preferences: newPrefs });
      await refreshProfile();
      toast.success("Settings saved");
    } catch (error) {
      setLoginAlertsEnabled(previousValue);
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
              <img
                src={PRIVACY_HERO_IMG}
                alt=""
                className={privacyHeroImage}
                width={1600}
                height={900}
                loading="eager"
                decoding="async"
              />
              <div className={privacyHeroLightScrim} aria-hidden />
              <div className={privacyHeroOverlayReadability} aria-hidden />
              <div className={privacyHeroOverlayAccent} aria-hidden />
              <div className={privacyHeroOverlayBottom} aria-hidden />

              <div className={privacyHeroInner}>
                <div className={privacyHeroCopy}>
                  <Link to="/app/settings" className={privacyBackLink}>
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    Back to Settings
                  </Link>

                  <h1 className={cn(privacyHeroTitle, "mt-5")}>
                    Privacy & <span className={privacyHeroAccent}>Security</span>
                  </h1>
                  <p className={privacyHeroLead}>
                    You&apos;re in control of your data, your privacy, and your safety.
                  </p>
                  <p className={cn(privacyHeroBody, "mt-4 inline-flex items-center gap-2")}>
                    <Shield className="h-3.5 w-3.5 text-violet-300/70 [html[data-ezri-theme=light]_&]:text-violet-600 [html[data-theme=light]_&]:text-violet-600" aria-hidden />
                    We protect your privacy so you can focus on your wellbeing.
                  </p>
                </div>

                <motion.div className={privacyHeroOrbWrap}>
                  <div className="relative flex h-[190px] w-[190px] items-center justify-center sm:h-[210px] sm:w-[210px]">
                    <div className={cn(privacyHeroOrbGlow, securityTone.heroGlow)} aria-hidden />
                    <div className={privacyHeroOrb}>
                      <Shield className={cn("h-8 w-8", securityTone.shield)} aria-hidden />
                      <p className="settings-subpage-hero-orb-value mt-2 text-lg font-semibold text-white [html[data-ezri-theme=light]_&]:text-[var(--text-primary)] [html[data-theme=light]_&]:text-[var(--text-primary)]">
                        {securityStatus.heroTitle}
                      </p>
                      <p className="settings-subpage-hero-orb-quote mt-1 max-w-[140px] text-[11px] leading-snug">
                        {securityStatus.heroSubtitle}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </section>

            {/* Active sessions */}
            <section className={cn(privacyGlassCard, "overflow-hidden")}>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.05] px-6 py-5">
                <div>
                  <h2 className={privacySectionTitle}>Active sessions</h2>
                  <p className={privacySectionSubtitle}>Manage where you&apos;re signed in</p>
                </div>
                {/* <Link to="/app/settings/account" className={privacyLinkMuted}>
                  View all sessions
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link> */}
              </div>

              <div className={privacySessionRow}>
                <div className={privacyIconChip("amber")}>
                  <Bell className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[rgba(255,255,255,0.92)]">Login alerts</p>
                  <p className="mt-0.5 text-xs text-[rgba(255,255,255,0.45)]">
                    Get notified about suspicious activity
                  </p>
                </div>
                <PrivacyToggle
                  enabled={loginAlertsEnabled}
                  onToggle={toggleLoginAlerts}
                  ariaLabel="Login alerts"
                />
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
                  <SolaceSelect
                    value={settings.profileVisibility}
                    onValueChange={(profileVisibility) => {
                      if (isSavingPrivacy) return;
                      void persistPrivacySettings({ profileVisibility });
                    }}
                    ariaLabel="Profile visibility"
                    variant="compact"
                    size="sm"
                    options={[
                      { value: "public", label: "Public" },
                      { value: "private", label: "Private" },
                    ]}
                  />
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
                    disabled={isSavingPrivacy}
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
                    disabled={isSavingPrivacy}
                  />
                }
              />

              {/* <PrivacyControlRow
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
              /> */}

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
                          disabled={isSavingPrivacy}
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
                          disabled={isSavingPrivacy}
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
                          disabled={isSavingPrivacy}
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
                      enabled={settings.trustedContactEnabled}
                      onToggle={() => toggleSetting("trustedContactEnabled")}
                      ariaLabel="Trusted contact notifications"
                      disabled={isSavingPrivacy}
                    />
                  }
                />
                {settings.trustedContactEnabled ? (
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
              <img src={PRIVACY_BANNER_IMG} alt="" className={privacyCommitmentBannerImage} />
              <div className={privacyCommitmentBannerOverlay} aria-hidden />
              <div className={cn(privacyCommitmentBannerContent, "gap-6 sm:items-start")}>
                <motion.div className={cn(privacyIconChip("violet"), "h-14 w-14 shrink-0 [&_svg]:h-7 [&_svg]:w-7")}>
                  <Shield className="h-7 w-7" aria-hidden />
                </motion.div>
                <div className="min-w-0 flex-1">
                  <h2 className={cn("font-serif text-2xl font-light sm:text-[1.65rem]", privacyCommitmentBannerTitle)}>
                    Your wellbeing. Our responsibility.
                  </h2>
                  <p className={cn("mt-3 max-w-2xl sm:text-[15px]", privacyCommitmentBannerBody)}>
                    We follow industry-leading security practices and HIPAA-aligned standards to keep your data
                    private, secure, and respected.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs">
                    <Link to="/privacy" className={privacyCommitmentBannerLink}>
                      Privacy Policy
                    </Link>
                    <Link to="/terms" className={privacyCommitmentBannerLink}>
                      Terms of Service
                    </Link>
                    <Link to="/privacy" className={privacyCommitmentBannerLink}>
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
                <span className={cn("h-2 w-2 shrink-0 rounded-full", securityTone.dot)} />
                <p className={cn("text-xs font-medium", securityTone.headline)}>
                  {securityStatus.headline}
                </p>
              </div>
              <h2 className="mt-3 text-sm font-semibold text-[rgba(255,255,255,0.92)]">Security status</h2>
              <div className="mt-5 flex flex-col items-center py-2 text-center">
                <div
                  className={cn(
                    "relative flex h-28 w-28 items-center justify-center rounded-full border-2",
                    securityTone.ring
                  )}
                >
                  <Shield className={cn("h-8 w-8", securityTone.shield)} aria-hidden />
                </div>
                <p className="mt-4 text-lg font-semibold text-white">{securityStatus.label}</p>
                <p className="mt-1 text-xs text-[rgba(255,255,255,0.48)]">{securityStatus.summary}</p>
                {securityStatus.recommendations.length > 0 ? (
                  <ul className="mt-3 w-full space-y-1.5 text-left">
                    {securityStatus.recommendations.slice(0, 3).map((item) => (
                      <li
                        key={item}
                        className="flex gap-2 text-[11px] leading-snug text-[rgba(255,255,255,0.5)]"
                      >
                        <span
                          className={cn(
                            "mt-1.5 h-1 w-1 shrink-0 rounded-full",
                            securityStatus.tone === "rose" ? "bg-rose-400" : "bg-amber-400"
                          )}
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
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
              {/* <Link to="/app/settings/privacy" className={cn(privacyLinkMuted, "mt-3")}>
                Learn more
                <ChevronRight className="h-3.5 w-3.5" />
              </Link> */}
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
              <Link to="/app/settings/help-support" className={cn(privacyLinkMuted, "mt-3")}>
                Contact support
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>

            <div className={privacyRailCardFlat}>
              <div className={privacyIconChip("amber")}>
                <Lock className="h-4 w-4" aria-hidden />
              </div>
              <h2 className="mt-3 text-sm font-semibold text-[rgba(255,255,255,0.92)]">
                End-to-end encryption
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-[rgba(255,255,255,0.5)]">
                Your sessions and personal data stay protected with strong encryption.
              </p>
            </div>
          </aside>
        </motion.div>
      </div>
    </motion.div>
  );
}
