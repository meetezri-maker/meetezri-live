import { useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

// Contexts
import { AuthProvider } from '@/app/contexts/AuthContext';
import { NotificationsProvider } from '@/app/contexts/NotificationsContext';
import { SafetyProvider } from '@/app/contexts/SafetyContext';
import { OnboardingProvider } from '@/app/contexts/OnboardingContext';
import { useAuth } from '@/app/contexts/AuthContext';
import { ProtectedRoute } from '@/app/components/ProtectedRoute';

// Components (shell / layout — keep eager so they render before any lazy page loads)
import { Toaster } from '@/app/components/ui/sonner';
import { MobileMetaTags } from '@/app/components/MobileMetaTags';
import { ThemeManager } from '@/app/components/ThemeManager';
import {
  applyAccentColorToDocument,
  applyThemeToDocument,
  isAccentColorKey,
  resolveAppearanceTheme,
} from '@/app/pages/app/appearance-settings/appearanceConstants';
import {
  applyAccessibilitySettings,
  loadAccessibilitySettings,
} from '@/app/pages/app/accessibility-settings/applyAccessibilitySettings';
import { AppLayout } from '@/app/components/AppLayout';
import { PageLoader } from '@/app/components/PageLoader';

// ─── Public Pages ────────────────────────────────────────────────────────────
const Landing              = lazy(() => import('@/app/pages/Landing').then(m => ({ default: m.Landing })));
const HowItWorks           = lazy(() => import('@/app/pages/HowItWorks').then(m => ({ default: m.HowItWorks })));
const Privacy              = lazy(() => import('@/app/pages/Privacy').then(m => ({ default: m.Privacy })));
const Terms                = lazy(() => import('@/app/pages/Terms').then(m => ({ default: m.Terms })));
const Accessibility        = lazy(() => import('@/app/pages/Accessibility').then(m => ({ default: m.Accessibility })));
const Pricing              = lazy(() => import('@/app/pages/Pricing').then(m => ({ default: m.Pricing })));

// ─── Auth Pages ──────────────────────────────────────────────────────────────
const Login                = lazy(() => import('@/app/pages/Login').then(m => ({ default: m.Login })));
const Signup               = lazy(() => import('@/app/pages/Signup').then(m => ({ default: m.Signup })));
const VerifyEmail          = lazy(() => import('@/app/pages/VerifyEmail').then(m => ({ default: m.VerifyEmail })));
const AuthCallback         = lazy(() => import('@/app/pages/AuthCallback').then(m => ({ default: m.AuthCallback })));
const ForgotPassword       = lazy(() => import('@/app/pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword        = lazy(() => import('@/app/pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const InviteCreatePassword = lazy(() => import('@/app/pages/InviteCreatePassword').then(m => ({ default: m.InviteCreatePassword })));
const AuthActivateAccount  = lazy(() => import('@/app/pages/AuthActivateAccount').then(m => ({ default: m.AuthActivateAccount })));

// Admin public auth pages (no role required — treated as auth section)
const AdminLogin           = lazy(() => import('@/app/pages/admin/AdminLogin').then(m => ({ default: m.AdminLogin })));
const AdminCredentials     = lazy(() => import('@/app/pages/admin/AdminCredentials').then(m => ({ default: m.AdminCredentials })));
const TwoFactorAuth        = lazy(() => import('@/app/pages/admin/TwoFactorAuth').then(m => ({ default: m.TwoFactorAuth })));

// ─── Onboarding Pages ────────────────────────────────────────────────────────
const ComingSoon                  = lazy(() => import('@/app/pages/onboarding/ComingSoon').then(m => ({ default: m.ComingSoon })));
const OnboardingWelcome           = lazy(() => import('@/app/pages/onboarding/Welcome').then(m => ({ default: m.OnboardingWelcome })));
const OnboardingProfileSetup      = lazy(() => import('@/app/pages/onboarding/ProfileSetup').then(m => ({ default: m.OnboardingProfileSetup })));
const OnboardingWellnessBaseline  = lazy(() => import('@/app/pages/onboarding/WellnessBaseline').then(m => ({ default: m.OnboardingWellnessBaseline })));
const OnboardingHealthBackground  = lazy(() => import('@/app/pages/onboarding/HealthBackground').then(m => ({ default: m.OnboardingHealthBackground })));
const OnboardingAvatarPreferences = lazy(() => import('@/app/pages/onboarding/AvatarPreferences').then(m => ({ default: m.OnboardingAvatarPreferences })));
const OnboardingEmergencyContact  = lazy(() => import('@/app/pages/onboarding/EmergencyContact').then(m => ({ default: m.OnboardingEmergencyContact })));
const OnboardingPermissions       = lazy(() => import('@/app/pages/onboarding/Permissions').then(m => ({ default: m.OnboardingPermissions })));
const OnboardingSafetyConsent     = lazy(() => import('@/app/pages/onboarding/SafetyConsent').then(m => ({ default: m.OnboardingSafetyConsent })));
const OnboardingSubscription      = lazy(() => import('@/app/pages/onboarding/Subscription').then(m => ({ default: m.OnboardingSubscription })));
const OnboardingComplete          = lazy(() => import('@/app/pages/onboarding/Complete').then(m => ({ default: m.OnboardingComplete })));

// ─── User App Pages ───────────────────────────────────────────────────────────
const Dashboard              = lazy(() => import('@/app/pages/app/Dashboard').then(m => ({ default: m.Dashboard })));
const MoodCheckIn            = lazy(() => import('@/app/pages/app/MoodCheckIn').then(m => ({ default: m.MoodCheckIn })));
const UserProfile            = lazy(() => import('@/app/pages/app/UserProfile').then(m => ({ default: m.UserProfile })));
const MemberProfileView      = lazy(() => import('@/app/pages/app/MemberProfileView').then(m => ({ default: m.MemberProfileView })));
const SessionLobby           = lazy(() => import('@/app/pages/app/SessionLobby').then(m => ({ default: m.SessionLobby })));
const ActiveSession          = lazy(() => import('@/app/pages/app/ActiveSession').then(m => ({ default: m.ActiveSession })));
const Billing                = lazy(() => import('@/app/pages/app/Billing').then(m => ({ default: m.Billing })));
const SleepTracker           = lazy(() => import('@/app/pages/app/SleepTracker').then(m => ({ default: m.SleepTracker })));
const HabitTracker           = lazy(() => import('@/app/pages/app/HabitTracker').then(m => ({ default: m.HabitTracker })));
const MoodHistory            = lazy(() => import('./pages/app/MoodHistory').then(m => ({ default: m.MoodHistory })));
const Journal                = lazy(() => import('./pages/app/Journal').then(m => ({ default: m.Journal })));
const WellnessTools          = lazy(() => import('./pages/app/WellnessTools').then(m => ({ default: m.WellnessTools })));
const SessionHistory         = lazy(() => import('./pages/app/SessionHistory').then(m => ({ default: m.SessionHistory })));
const Settings               = lazy(() => import('./pages/app/Settings').then(m => ({ default: m.Settings })));
const SettingsHub            = lazy(() => import('./pages/app/SettingsHub').then(m => ({ default: m.SettingsHub })));
const AccountSettings        = lazy(() => import('./pages/app/AccountSettings').then(m => ({ default: m.AccountSettings })));
const EmergencyContacts      = lazy(() => import('./pages/app/EmergencyContacts').then(m => ({ default: m.EmergencyContacts })));
const Notifications          = lazy(() => import('./pages/app/Notifications').then(m => ({ default: m.Notifications })));
const PrivacySettings        = lazy(() => import('./pages/app/PrivacySettings').then(m => ({ default: m.PrivacySettings })));
const AccessibilitySettings  = lazy(() => import('./pages/app/AccessibilitySettings').then(m => ({ default: m.AccessibilitySettings })));
const AppearanceSettings     = lazy(() => import('./pages/app/AppearanceSettings').then(m => ({ default: m.AppearanceSettings })));
const ChangeAvatar           = lazy(() => import('./pages/app/ChangeAvatar').then(m => ({ default: m.ChangeAvatar })));
const Achievements           = lazy(() => import('./pages/app/Achievements').then(m => ({ default: m.Achievements })));
const NotificationHistory    = lazy(() => import('./pages/app/NotificationHistory').then(m => ({ default: m.NotificationHistory })));
const RecentActivityHistory  = lazy(() => import('./pages/app/RecentActivityHistory').then(m => ({ default: m.RecentActivityHistory })));
// const GoalsList           = lazy(() => import('./pages/app/GoalsList').then(m => ({ default: m.GoalsList })));
const GoalDetails            = lazy(() => import('./pages/app/GoalDetails').then(m => ({ default: m.GoalDetails })));
const BrainHealth            = lazy(() => import('./pages/app/BrainHealth').then(m => ({ default: m.BrainHealth })));
const Resources              = lazy(() => import('./pages/app/Resources').then(m => ({ default: m.Resources })));
const ResourceArticlePage    = lazy(() => import('./pages/app/ResourceArticlePage').then(m => ({ default: m.ResourceArticlePage })));
const Community              = lazy(() => import('./pages/app/Community').then(m => ({ default: m.Community })));
const CrisisResources        = lazy(() => import('./pages/app/CrisisResources').then(m => ({ default: m.CrisisResources })));
const ResourceAnalyticsPage  = lazy(() => import('./pages/app/ResourceAnalytics').then(m => ({ default: m.ResourceAnalyticsPage })));
const CooldownScreen         = lazy(() => import('./pages/app/CooldownScreen').then(m => ({ default: m.CooldownScreen })));
const HelpSupport            = lazy(() => import('./pages/app/HelpSupport').then(m => ({ default: m.HelpSupport })));
const Progress               = lazy(() => import('./pages/app/Progress').then(m => ({ default: m.Progress })));
const SafetyPlan             = lazy(() => import('./pages/app/SafetyPlan').then(m => ({ default: m.SafetyPlan })));
const Challenges             = lazy(() => import('./pages/app/Challenges').then(m => ({ default: m.Challenges })));
const SafetyInsights         = lazy(() => import('./pages/app/SafetyInsights').then(m => ({ default: m.SafetyInsights })));
// import { Community } from './pages/app/Community';

// ─── Admin Pages ─────────────────────────────────────────────────────────────
const SuperAdminDashboard       = lazy(() => import('@/app/pages/admin/SuperAdminDashboard').then(m => ({ default: m.SuperAdminDashboard })));
const OrgAdminDashboard         = lazy(() => import('@/app/pages/admin/OrgAdminDashboard').then(m => ({ default: m.OrgAdminDashboard })));
const TeamAdminDashboard        = lazy(() => import('@/app/pages/admin/TeamAdminDashboard').then(m => ({ default: m.TeamAdminDashboard })));
const UserManagement            = lazy(() => import('@/app/pages/admin/UserManagement').then(m => ({ default: m.UserManagement })));
const UserDetailsEnhanced       = lazy(() => import('@/app/pages/admin/UserDetailsEnhanced').then(m => ({ default: m.UserDetailsEnhanced })));
const UserMoodAnalytics         = lazy(() => import('@/app/pages/admin/UserMoodAnalytics').then(m => ({ default: m.UserMoodAnalytics })));
const UserJournalAnalytics      = lazy(() => import('@/app/pages/admin/UserJournalAnalytics').then(m => ({ default: m.UserJournalAnalytics })));
const UserSleepAnalytics        = lazy(() => import('@/app/pages/admin/UserSleepAnalytics').then(m => ({ default: m.UserSleepAnalytics })));
const UserHabitAnalytics        = lazy(() => import('@/app/pages/admin/UserHabitAnalytics').then(m => ({ default: m.UserHabitAnalytics })));
const AllUsersMoodAnalytics     = lazy(() => import('@/app/pages/admin/AllUsersMoodAnalytics').then(m => ({ default: m.AllUsersMoodAnalytics })));
const AllUsersJournalAnalytics  = lazy(() => import('@/app/pages/admin/AllUsersJournalAnalytics').then(m => ({ default: m.AllUsersJournalAnalytics })));
const AllUsersSleepAnalytics    = lazy(() => import('@/app/pages/admin/AllUsersSleepAnalytics').then(m => ({ default: m.AllUsersSleepAnalytics })));
const AllUsersHabitAnalytics    = lazy(() => import('@/app/pages/admin/AllUsersHabitAnalytics').then(m => ({ default: m.AllUsersHabitAnalytics })));
const UserSegmentation          = lazy(() => import('@/app/pages/admin/UserSegmentation').then(m => ({ default: m.UserSegmentation })));
const TeamRoleManagement        = lazy(() => import('@/app/pages/admin/TeamRoleManagement').then(m => ({ default: m.TeamRoleManagement })));
const CompanionManagement       = lazy(() => import('@/app/pages/admin/CompanionManagement').then(m => ({ default: m.CompanionManagement })));
const AIAvatarManager           = lazy(() => import('@/app/pages/admin/AIAvatarManager').then(m => ({ default: m.AIAvatarManager })));
const ConversationTranscripts   = lazy(() => import('@/app/pages/admin/ConversationTranscripts').then(m => ({ default: m.ConversationTranscripts })));
const CrisisDashboard           = lazy(() => import('@/app/pages/admin/CrisisDashboard').then(m => ({ default: m.CrisisDashboard })));
const CrisisMonitoring          = lazy(() => import('@/app/pages/admin/CrisisMonitoring').then(m => ({ default: m.CrisisMonitoring })));
const CrisisEventDetails        = lazy(() => import('@/app/pages/admin/CrisisEventDetails').then(m => ({ default: m.CrisisEventDetails })));
const CrisisFollowUpQueue       = lazy(() => import('@/app/pages/admin/CrisisFollowUpQueue').then(m => ({ default: m.CrisisFollowUpQueue })));
const CrisisProtocol            = lazy(() => import('@/app/pages/admin/CrisisProtocol').then(m => ({ default: m.CrisisProtocol })));
const Analytics                 = lazy(() => import('@/app/pages/admin/Analytics').then(m => ({ default: m.Analytics })));
const UsageOverview             = lazy(() => import('@/app/pages/admin/UsageOverview').then(m => ({ default: m.UsageOverview })));
const UsageAnalytics            = lazy(() => import('@/app/pages/admin/UsageAnalytics').then(m => ({ default: m.UsageAnalytics })));
const SessionAnalytics          = lazy(() => import('@/app/pages/admin/SessionAnalytics').then(m => ({ default: m.SessionAnalytics })));
const EngagementMetrics         = lazy(() => import('@/app/pages/admin/EngagementMetrics').then(m => ({ default: m.EngagementMetrics })));
const RetentionMetrics          = lazy(() => import('@/app/pages/admin/RetentionMetrics').then(m => ({ default: m.RetentionMetrics })));
const FeatureAdoption           = lazy(() => import('@/app/pages/admin/FeatureAdoption').then(m => ({ default: m.FeatureAdoption })));
const OnboardingAnalytics       = lazy(() => import('@/app/pages/admin/OnboardingAnalytics').then(m => ({ default: m.OnboardingAnalytics })));
const ReportsAnalytics          = lazy(() => import('@/app/pages/admin/ReportsAnalytics').then(m => ({ default: m.ReportsAnalytics })));
const AvatarSelectionAnalytics  = lazy(() => import('@/app/pages/admin/AvatarSelectionAnalytics').then(m => ({ default: m.AvatarSelectionAnalytics })));
const ContentManagement         = lazy(() => import('@/app/pages/admin/ContentManagement').then(m => ({ default: m.ContentManagement })));
const WellnessToolsCMS          = lazy(() => import('@/app/pages/admin/WellnessToolsCMS').then(m => ({ default: m.WellnessToolsCMS })));
const WellnessContentCMS        = lazy(() => import('@/app/pages/admin/WellnessContentCMS').then(m => ({ default: m.WellnessContentCMS })));
const WellnessContentLibrary    = lazy(() => import('@/app/pages/admin/WellnessContentLibrary').then(m => ({ default: m.WellnessContentLibrary })));
const WellnessToolEditor        = lazy(() => import('@/app/pages/admin/WellnessToolEditor').then(m => ({ default: m.WellnessToolEditor })));
const ExerciseLibrary           = lazy(() => import('@/app/pages/admin/ExerciseLibrary').then(m => ({ default: m.ExerciseLibrary })));
const ContentPerformance        = lazy(() => import('@/app/pages/admin/ContentPerformance').then(m => ({ default: m.ContentPerformance })));
const NudgeCenter               = lazy(() => import('@/app/pages/admin/NudgeCenter').then(m => ({ default: m.NudgeCenter })));
const Gamification              = lazy(() => import('@/app/pages/admin/Gamification').then(m => ({ default: m.Gamification })));
const CommunicationsHub         = lazy(() => import('@/app/pages/admin/CommunicationsHub').then(m => ({ default: m.CommunicationsHub })));
const SupportTickets            = lazy(() => import('@/app/pages/admin/SupportTickets').then(m => ({ default: m.SupportTickets })));
const CommunityManagement       = lazy(() => import('@/app/pages/admin/CommunityManagement').then(m => ({ default: m.CommunityManagement })));
const LiveSessionsMonitor       = lazy(() => import('@/app/pages/admin/LiveSessionsMonitor').then(m => ({ default: m.LiveSessionsMonitor })));
const SessionRecordings         = lazy(() => import('@/app/pages/admin/SessionRecordings').then(m => ({ default: m.SessionRecordings })));
const SystemHealthEnhanced      = lazy(() => import('@/app/pages/admin/SystemHealthEnhanced').then(m => ({ default: m.SystemHealthEnhanced })));
const ErrorTracking             = lazy(() => import('@/app/pages/admin/ErrorTracking').then(m => ({ default: m.ErrorTracking })));
const SystemSettingsEnhanced    = lazy(() => import('@/app/pages/admin/SystemSettingsEnhanced').then(m => ({ default: m.SystemSettingsEnhanced })));
const GlobalConfiguration       = lazy(() => import('@/app/pages/admin/GlobalConfiguration').then(m => ({ default: m.GlobalConfiguration })));
const FeatureFlags              = lazy(() => import('@/app/pages/admin/FeatureFlags').then(m => ({ default: m.FeatureFlags })));
const APIManagement             = lazy(() => import('@/app/pages/admin/APIManagement').then(m => ({ default: m.APIManagement })));
const IntegrationSettings       = lazy(() => import('@/app/pages/admin/IntegrationSettings').then(m => ({ default: m.IntegrationSettings })));
const BrandingCustomization     = lazy(() => import('@/app/pages/admin/BrandingCustomization').then(m => ({ default: m.BrandingCustomization })));
const ABTesting                 = lazy(() => import('@/app/pages/admin/ABTesting').then(m => ({ default: m.ABTesting })));
const AdminBilling              = lazy(() => import('@/app/pages/admin/Billing').then(m => ({ default: m.Billing })));
const BillingSubscriptions      = lazy(() => import('@/app/pages/admin/BillingSubscriptions').then(m => ({ default: m.BillingSubscriptions })));
const PackageManager            = lazy(() => import('@/app/pages/admin/PackageManager').then(m => ({ default: m.PackageManager })));
const PayAsYouGoManager         = lazy(() => import('@/app/pages/admin/PayAsYouGoManager').then(m => ({ default: m.PayAsYouGoManager })));
const SecuritySettings          = lazy(() => import('./pages/admin/SecuritySettings').then(m => ({ default: m.SecuritySettings })));
const ComplianceDashboard       = lazy(() => import('@/app/pages/admin/ComplianceDashboard').then(m => ({ default: m.ComplianceDashboard })));
const HIPAACompliance           = lazy(() => import('@/app/pages/admin/HIPAACompliance').then(m => ({ default: m.HIPAACompliance })));
const DataPrivacyControls       = lazy(() => import('@/app/pages/admin/DataPrivacyControls').then(m => ({ default: m.DataPrivacyControls })));
const DataRetentionPrivacy      = lazy(() => import('@/app/pages/admin/DataRetentionPrivacy').then(m => ({ default: m.DataRetentionPrivacy })));
const AuditLogs                 = lazy(() => import('@/app/pages/admin/AuditLogs').then(m => ({ default: m.AuditLogs })));
const SystemLogs                = lazy(() => import('@/app/pages/admin/SystemLogs').then(m => ({ default: m.SystemLogs })));
const LegalDocumentation        = lazy(() => import('@/app/pages/admin/LegalDocumentation').then(m => ({ default: m.LegalDocumentation })));
const DataExport                = lazy(() => import('@/app/pages/admin/DataExport').then(m => ({ default: m.DataExport })));
const BackupRecovery            = lazy(() => import('@/app/pages/admin/BackupRecovery').then(m => ({ default: m.BackupRecovery })));

// ─── Error Pages ─────────────────────────────────────────────────────────────
const Error404        = lazy(() => import('@/app/pages/errors/Error404').then(m => ({ default: m.Error404 })));
const Error500        = lazy(() => import('@/app/pages/errors/Error500').then(m => ({ default: m.Error500 })));
const Offline         = lazy(() => import('@/app/pages/errors/Offline').then(m => ({ default: m.Offline })));
const Maintenance     = lazy(() => import('@/app/pages/errors/Maintenance').then(m => ({ default: m.Maintenance })));
const PermissionDenied = lazy(() => import('@/app/pages/errors/PermissionDenied').then(m => ({ default: m.PermissionDenied })));
const TrialExpired    = lazy(() => import('@/app/pages/errors/TrialExpired').then(m => ({ default: m.TrialExpired })));
const NoDeviceAccess  = lazy(() => import('@/app/pages/errors/NoDeviceAccess').then(m => ({ default: m.NoDeviceAccess })));

/**
 * Reads saved security settings and enforces idle session timeout.
 * Listens to user activity events and signs out after the configured
 * inactivity period (default 30 min).
 */
function IdleTimeoutEnforcer() {
  const { user, signOut } = useAuth();
  const timerRef = useRef<number | null>(null);
  const timeoutMsRef = useRef(30 * 60 * 1000); // default 30 min

  useEffect(() => {
    if (!user) return;

    // Load saved security settings to get configured timeout
    api.getSettings().then((rows: unknown) => {
      const list = Array.isArray(rows) ? rows : [];
      const row = list.find((r: { key?: string }) => r.key === 'admin_security_settings');
      const minutes = parseInt(String(row?.value?.sessionTimeout ?? '30'), 10);
      if (Number.isFinite(minutes) && minutes > 0) {
        timeoutMsRef.current = minutes * 60 * 1000;
      }
    }).catch(() => {/* use default */});

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        void signOut();
      }, timeoutMsRef.current);
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'click', 'scroll'] as const;
    activityEvents.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer(); // start the timer immediately

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      activityEvents.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [user, signOut]);

  return null;
}

function NetworkWatcher() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let offlineTimer: number | null = null;

    const handleOnline = () => {
      if (offlineTimer) {
        window.clearTimeout(offlineTimer);
        offlineTimer = null;
      }
      if (location.pathname === '/error/offline') {
        navigate('/app/dashboard');
      }
    };

    const handleOffline = () => {
      // Some browsers/devtools can emit transient offline events when the tab is backgrounded
      // (or the HMR websocket is throttled). Avoid redirecting while hidden, and debounce.
      if (document.visibilityState !== 'visible') return;

      if (offlineTimer) window.clearTimeout(offlineTimer);
      offlineTimer = window.setTimeout(() => {
        offlineTimer = null;
        if (!navigator.onLine && location.pathname !== '/error/offline') {
          navigate('/error/offline');
        }
      }, 1200);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!navigator.onLine && location.pathname !== '/error/offline') {
      navigate('/error/offline');
    }

    return () => {
      if (offlineTimer) window.clearTimeout(offlineTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [location.pathname, navigate]);

  return null;
}

/** Ensures onboarding routes require a session. Logged-in users must be allowed through — routing rules live in ProtectedRoute. */
function OnboardingAccessGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// (Removed temporary reload/route persistence helpers; the actual fix is in AuthContext + ProtectedRoute.)

export default function App() {
  useEffect(() => {
    let theme = "dark";
    let accentKey = "pink";
    let accessibilitySettings = loadAccessibilitySettings();

    if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
      const pathname = window.location.pathname;
      // Only apply saved theme for app routes, ensuring public pages stay light by default
      const isAppRoute = pathname.startsWith("/app") || pathname.startsWith("/admin") || pathname.startsWith("/onboarding");
      
      if (isAppRoute) {
        const saved = window.localStorage.getItem("ezri_appearance_settings");
        const savedAccessibility = window.localStorage.getItem("ezri_accessibility_settings");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.theme) {
              theme = resolveAppearanceTheme(parsed.theme, parsed.appearanceVersion);
            }
            if (parsed.accentColor) {
              accentKey = parsed.accentColor;
            }
          } catch {
          }
        }
        // Admin-set appearance (hex colors + theme from system settings page)
        const adminAppearance = window.localStorage.getItem("ezri_admin_appearance");
        if (adminAppearance) {
          try {
            const ap = JSON.parse(adminAppearance) as {
              defaultTheme?: string;
              primaryColor?: string;
              accentColor?: string;
              reducedMotion?: boolean;
            };
            if (ap.defaultTheme === "Dark") theme = "dark";
            else if (ap.defaultTheme === "System") theme = "dark";
            else if (ap.defaultTheme === "Light") theme = "light";
            // Colors and reduced motion apply everywhere
            if (ap.primaryColor) (window as any).__adminPrimaryColor = ap.primaryColor;
            if (ap.accentColor) (window as any).__adminAccentColor = ap.accentColor;
            if (ap.reducedMotion != null) (window as any).__adminReducedMotion = ap.reducedMotion;
          } catch {
          }
        }
        if (savedAccessibility) {
          try {
            accessibilitySettings = loadAccessibilitySettings();
          } catch {
          }
        }
      }
    }

    if (typeof document === "undefined") return;
    const root = document.documentElement;

    applyThemeToDocument(theme === "light" ? "light" : "dark");

    applyAccentColorToDocument(isAccentColorKey(accentKey) ? accentKey : "pink");

    // Override with admin appearance colors (from system settings page)
    const adminPrimary = (window as any).__adminPrimaryColor;
    const adminAccent = (window as any).__adminAccentColor;
    const adminReducedMotion = (window as any).__adminReducedMotion;
    if (adminPrimary) { root.style.setProperty("--primary", adminPrimary); root.style.setProperty("--ring", adminPrimary); }
    if (adminAccent) root.style.setProperty("--accent", adminAccent);
    if (adminReducedMotion != null) root.classList.toggle("reduced-motion", Boolean(adminReducedMotion));

    // Override with brand colors (from branding-customization page — highest priority)
    try {
      const brandingRaw = window.localStorage.getItem("ezri_branding");
      if (brandingRaw) {
        const brandingParsed = JSON.parse(brandingRaw) as { branding?: { primaryColor?: string; accentColor?: string; appName?: string; faviconUrl?: string; bodyFont?: string } };
        const b = brandingParsed.branding;
        if (b?.primaryColor) { root.style.setProperty("--primary", b.primaryColor); root.style.setProperty("--ring", b.primaryColor); }
        if (b?.accentColor) root.style.setProperty("--accent", b.accentColor);
        if (b?.appName) document.title = b.appName;
        if (b?.faviconUrl) {
          let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
          if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
          link.href = b.faviconUrl;
        }
        if (b?.bodyFont && b.bodyFont !== "Inter") {
          document.body.style.fontFamily = `"${b.bodyFont}", sans-serif`;
        }
      }
    } catch {
      // ignore storage errors
    }

    applyAccessibilitySettings(accessibilitySettings);
    if (adminReducedMotion != null) {
      root.classList.toggle("reduced-motion", Boolean(adminReducedMotion));
    }
  }, []);

  return (
    <AuthProvider>
      <NotificationsProvider>
      <SafetyProvider>
        <BrowserRouter>
        <ThemeManager />
        <NetworkWatcher />
        <IdleTimeoutEnforcer />
        <MobileMetaTags />
        <Toaster />
        <Routes>
          {/* ── Boundary 1: Public Routes ─────────────────────────────────── */}
          <Route element={<Suspense fallback={<PageLoader />}><Outlet /></Suspense>}>
            <Route path="/" element={<Landing />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            {/* <Route path="/accessibility" element={<Accessibility />} /> */}
            <Route path="/pricing" element={<Pricing />} />

            {/* Error pages share the public boundary */}
            <Route path="/error/404" element={<Error404 />} />
            <Route path="/error/500" element={<Error500 />} />
            <Route path="/error/offline" element={<Offline />} />
            <Route path="/error/maintenance" element={<Maintenance />} />
            <Route path="/error/permission-denied" element={<PermissionDenied />} />
            <Route path="/error/no-device-access" element={<NoDeviceAccess />} />
            <Route path="/error/trial-expired" element={<TrialExpired />} />
          </Route>

          {/* ── Boundary 2: Auth Routes ───────────────────────────────────── */}
          <Route element={<Suspense fallback={<PageLoader />}><Outlet /></Suspense>}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/activate-account" element={<AuthActivateAccount />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/invite/create-password" element={<InviteCreatePassword />} />

            {/* Admin Routes - Public */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/credentials" element={<AdminCredentials />} />
            <Route path="/admin/two-factor-auth" element={<TwoFactorAuth />} />
          </Route>

          {/* ── Protected Routes ──────────────────────────────────────────── */}
          <Route element={<ProtectedRoute><Outlet /></ProtectedRoute>}>

            {/* ── Boundary 3: Member App Routes (onboarding + /app/*) ───── */}
            <Route element={<Suspense fallback={<PageLoader />}><Outlet /></Suspense>}>
              {/* Protected Routes - All Redirected to Coming Soon */}
              <Route element={<OnboardingProvider><Outlet /></OnboardingProvider>}>
                {/* Onboarding Routes */}
                <Route path="/onboarding" element={<OnboardingAccessGuard><Outlet /></OnboardingAccessGuard>}>
                  <Route index element={<Navigate to="/onboarding/welcome" replace />} />
                  <Route path="welcome" element={<OnboardingWelcome />} />
                  <Route path="profile-setup" element={<OnboardingProfileSetup />} />
                  <Route path="wellness-baseline" element={<OnboardingWellnessBaseline />} />
                  <Route path="health-background" element={<OnboardingHealthBackground />} />
                  <Route path="avatar-preferences" element={<OnboardingAvatarPreferences />} />
                  <Route path="emergency-contact" element={<OnboardingEmergencyContact />} />
                  <Route path="permissions" element={<OnboardingPermissions />} />
                  <Route path="safety-consent" element={<OnboardingSafetyConsent />} />
                  <Route path="subscription" element={<OnboardingSubscription />} />
                  <Route path="complete" element={<OnboardingComplete />} />
                  <Route path="*" element={<Navigate to="/onboarding/welcome" replace />} />
                </Route>
              </Route>

              {/* App Routes — one member shell (Outlet); pages must not wrap AppLayout */}
              <Route element={<AppLayout />}>
                <Route path="/app/dashboard" element={<Dashboard />} />
                <Route path="/app/mood-checkin" element={<MoodCheckIn />} />
                <Route path="/app/mood-history" element={<MoodHistory />} />
                <Route path="/app/journal" element={<Journal />} />
                <Route path="/app/wellness-tools" element={<WellnessTools />} />

                <Route path="/app/session-lobby" element={<SessionLobby />} />
                <Route path="/app/session-history" element={<SessionHistory />} />
                <Route path="/app/settings" element={<SettingsHub />} />
                <Route path="/app/settings/account" element={<AccountSettings />} />
                <Route path="/app/settings/emergency-contacts" element={<EmergencyContacts />} />
                <Route path="/app/notifications" element={<Notifications />} />
                <Route
                  path="/app/active-session"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ActiveSession />
                    </Suspense>
                  }
                />
                <Route path="/app/settings/privacy" element={<PrivacySettings />} />
                <Route path="/app/settings/accessibility" element={<AccessibilitySettings />} />
                <Route path="/app/settings/appearance" element={<AppearanceSettings />} />
                <Route path="/app/settings/change-avatar" element={<ChangeAvatar />} />
                <Route path="/app/settings/achievements" element={<Achievements />} />
                <Route
                  path="/app/settings/notification-history"
                  element={<Navigate to="/app/settings/emergency-notifications" replace />}
                />
                <Route path="/app/settings/emergency-notifications" element={<NotificationHistory />} />
                <Route path="/app/recent-activity-history" element={<RecentActivityHistory />} />
                <Route path="/app/profile/:userId" element={<MemberProfileView />} />
                <Route path="/profile/:userId" element={<MemberProfileView />} />
                <Route path="/app/profile" element={<Navigate to="/app/user-profile" replace />} />
                <Route path="/app/user-profile" element={<UserProfile />} />
                <Route path="/app/crisis-resources" element={<Navigate to="/app/emergency-resources" replace />} />
                <Route path="/app/emergency-resources" element={<CrisisResources />} />
                <Route path="/app/settings/resource-analytics" element={<ResourceAnalyticsPage />} />
                <Route path="/app/settings/cooldown-screen" element={<CooldownScreen />} />
                <Route path="/app/settings/help-support" element={<HelpSupport />} />
                <Route path="/app/progress" element={<Progress />} />
                <Route path="/app/settings/safety-insights" element={<SafetyInsights />} />
                <Route path="/app/billing" element={<Billing />} />
                <Route path="/app/invite/create-password" element={<InviteCreatePassword />} />
                <Route path="/app/sleep-tracker" element={<SleepTracker />} />
                <Route path="/app/habit-tracker" element={<HabitTracker />} />
                <Route path="/app/brain-health" element={<BrainHealth />} />
                <Route path="/app/settings/notifications" element={<Notifications />} />
                <Route path="/app/settings/brain-health" element={<Navigate to="/app/brain-health" replace />} />
                <Route path="/app/settings/resources" element={<Resources />} />
                <Route path="/app/challenges" element={<Challenges />} />
                <Route path="/app/community" element={<Community />} />
                <Route path="/app/settings/resources/article/:articleId" element={<ResourceArticlePage />} />
                <Route path="/app/settings/community" element={<Navigate to="/app/community" replace />} />
                <Route path="/app/settings/safety-plan" element={<Navigate to="/app/settings/wellness-plan" replace />} />
                <Route path="/app/settings/wellness-plan" element={<SafetyPlan />} />
                <Route path="/app/*" element={<ComingSoon />} />
              </Route>
            </Route>

            {/* ── Boundary 4: Admin Routes ──────────────────────────────── */}
            {/* Admin Routes - Protected and role-gated */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'org_admin', 'team_admin']}>
                  <Suspense fallback={<PageLoader />}>
                    <Outlet />
                  </Suspense>
                </ProtectedRoute>
              }
            >
            {/* Dashboards */}
            <Route path="/admin/super-admin-dashboard" element={<SuperAdminDashboard />} />
            <Route path="/admin/org-admin-dashboard" element={<OrgAdminDashboard />} />
            <Route path="/admin/team-admin-dashboard" element={<TeamAdminDashboard />} />

            {/* User Management */}
            <Route path="/admin/user-management" element={<UserManagement />} />
            <Route
              path="/admin/user-details-enhanced/:userId"
              element={<UserDetailsEnhanced />}
            />
            <Route path="/admin/user-analytics/moods/:userId" element={<UserMoodAnalytics />} />
            <Route path="/admin/user-analytics/journals/:userId" element={<UserJournalAnalytics />} />
            <Route path="/admin/user-analytics/sleep/:userId" element={<UserSleepAnalytics />} />
            <Route path="/admin/user-analytics/habits/:userId" element={<UserHabitAnalytics />} />
            <Route path="/admin/user-analytics/moods" element={<AllUsersMoodAnalytics />} />
            <Route path="/admin/user-analytics/journals" element={<AllUsersJournalAnalytics />} />
            <Route path="/admin/user-analytics/sleep" element={<AllUsersSleepAnalytics />} />
            <Route path="/admin/user-analytics/habits" element={<AllUsersHabitAnalytics />} />
            <Route path="/admin/user-segmentation" element={<UserSegmentation />} />
            <Route path="/admin/team-role-management" element={<TeamRoleManagement />} />
            <Route path="/admin/companion-management" element={<CompanionManagement />} />

            {/* AI Avatar System */}
            <Route path="/admin/ai-avatar-manager" element={<AIAvatarManager />} />
            <Route path="/admin/conversation-transcripts" element={<ConversationTranscripts />} />

            {/* Crisis Management */}
            <Route path="/admin/crisis-dashboard" element={<CrisisDashboard />} />
            <Route path="/admin/crisis-monitoring" element={<CrisisMonitoring />} />
            <Route path="/admin/crisis-event-details" element={<CrisisEventDetails />} />
            <Route path="/admin/crisis-follow-up-queue" element={<CrisisFollowUpQueue />} />
            <Route path="/admin/crisis-protocol" element={<CrisisProtocol />} />

            {/* Analytics */}
            <Route path="/admin/analytics" element={<Analytics />} />
            <Route path="/admin/usage-overview" element={<UsageOverview />} />
            <Route path="/admin/usage-analytics" element={<UsageAnalytics />} />
            <Route path="/admin/session-analytics" element={<SessionAnalytics />} />
            <Route path="/admin/engagement-metrics" element={<EngagementMetrics />} />
            <Route path="/admin/retention-metrics" element={<RetentionMetrics />} />
            <Route path="/admin/feature-adoption" element={<FeatureAdoption />} />
            <Route path="/admin/onboarding-analytics" element={<OnboardingAnalytics />} />
            <Route path="/admin/reports-analytics" element={<ReportsAnalytics />} />
            <Route path="/admin/avatar-selection-analytics" element={<AvatarSelectionAnalytics />} />

            {/* Content */}
            <Route path="/admin/content-management" element={<ContentManagement />} />
            <Route path="/admin/wellness-tools-cms" element={<WellnessToolsCMS />} />
            <Route path="/admin/wellness-content-cms" element={<WellnessContentCMS />} />
            <Route path="/admin/wellness-content-library" element={<WellnessContentLibrary />} />
            <Route path="/admin/wellness-tool-editor" element={<WellnessToolEditor />} />
            <Route path="/admin/exercise-library" element={<ExerciseLibrary />} />
            <Route path="/admin/content-performance" element={<ContentPerformance />} />
            {/* Engagement */}
            <Route path="/admin/nudge-center" element={<NudgeCenter />} />
            <Route path="/admin/nudge-management" element={<Navigate to="/admin/nudge-center" replace />} />
            <Route path="/admin/nudge-templates" element={<Navigate to="/admin/nudge-center" replace />} />
            <Route path="/admin/nudge-scheduler" element={<Navigate to="/admin/nudge-center" replace />} />
            <Route path="/admin/nudge-performance" element={<Navigate to="/admin/nudge-center" replace />} />
            <Route path="/admin/gamification" element={<Gamification />} />
            <Route path="/admin/wellness-challenges" element={<Navigate to="/admin/gamification" replace />} />
            <Route path="/admin/badge-manager" element={<Navigate to="/admin/gamification" replace />} />

            {/* Communications */}
            <Route path="/admin/communications" element={<CommunicationsHub />} />
            <Route path="/admin/notifications-center" element={<Navigate to="/admin/communications" replace />} />
            <Route path="/admin/manual-notifications" element={<Navigate to="/admin/communications" replace />} />
            <Route path="/admin/email-templates" element={<Navigate to="/admin/communications" replace />} />
            <Route path="/admin/push-notifications" element={<Navigate to="/admin/communications" replace />} />
            <Route path="/admin/support-tickets" element={<SupportTickets />} />
            <Route path="/admin/community-management" element={<CommunityManagement />} />

            {/* Monitoring */}
            <Route path="/admin/live-sessions-monitor" element={<LiveSessionsMonitor />} />
            <Route path="/admin/session-recordings" element={<SessionRecordings />} />
            <Route path="/admin/system-health-enhanced" element={<SystemHealthEnhanced />} />
            <Route
              path="/admin/system-health-dashboard"
              element={<Navigate to="/admin/system-health-enhanced" replace />}
            />
            <Route path="/admin/error-tracking" element={<ErrorTracking />} />

            {/* System */}
            <Route
              path="/admin/system-settings"
              element={<Navigate to="/admin/system-settings-enhanced" replace />}
            />
            <Route path="/admin/system-settings-enhanced" element={<SystemSettingsEnhanced />} />
            <Route
              path="/admin/global-configuration"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <GlobalConfiguration />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/feature-flags"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <FeatureFlags />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/api-management"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <APIManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/integration-settings"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'org_admin']}>
                  <IntegrationSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/branding-customization"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'org_admin']}>
                  <BrandingCustomization />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/ab-testing"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'org_admin']}>
                  <ABTesting />
                </ProtectedRoute>
              }
            />

            {/* Billing */}
            <Route path="/admin/billing" element={<AdminBilling />} />
            <Route path="/admin/billing-subscriptions" element={<BillingSubscriptions />} />
            <Route path="/admin/package-manager" element={<PackageManager />} />
            <Route path="/admin/payg-transactions" element={<PayAsYouGoManager />} />

            {/* Security & Compliance */}
            <Route path="/admin/security-settings" element={<SecuritySettings />} />
            <Route path="/admin/compliance-dashboard" element={<ComplianceDashboard />} />
            <Route path="/admin/hipaa-compliance" element={<HIPAACompliance />} />
            <Route path="/admin/data-privacy-controls" element={<DataPrivacyControls />} />
            <Route path="/admin/data-retention-privacy" element={<DataRetentionPrivacy />} />
            <Route path="/admin/audit-logs" element={<AuditLogs />} />
            <Route path="/admin/system-logs" element={<SystemLogs />} />
            <Route path="/admin/legal-documentation" element={<LegalDocumentation />} />

            {/* Data */}
            <Route path="/admin/data-export" element={<DataExport />} />
            <Route
              path="/admin/backup-recovery"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <BackupRecovery />
                </ProtectedRoute>
              }
            />

            {/* No generic /admin/* fallback so every admin URL must point to a real page */}
            </Route>
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </BrowserRouter>
      </SafetyProvider>
      </NotificationsProvider>
    </AuthProvider>
  );
}
