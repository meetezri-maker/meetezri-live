import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';

// Contexts
import { AuthProvider } from '@/app/contexts/AuthContext';
import { NotificationsProvider } from '@/app/contexts/NotificationsContext';
import { SafetyProvider } from '@/app/contexts/SafetyContext';
import { OnboardingProvider } from '@/app/contexts/OnboardingContext';
import { useAuth } from '@/app/contexts/AuthContext';
import { ProtectedRoute } from '@/app/components/ProtectedRoute';

// Components
import { Toaster } from '@/app/components/ui/sonner';
import { MobileMetaTags } from '@/app/components/MobileMetaTags';
import { ThemeManager } from '@/app/components/ThemeManager';
import { AppLayout } from '@/app/components/AppLayout';

// Public Pages
import { Landing } from '@/app/pages/Landing';
import { HowItWorks } from '@/app/pages/HowItWorks';
import { Privacy } from '@/app/pages/Privacy';
import { Terms } from '@/app/pages/Terms';
import { Accessibility } from '@/app/pages/Accessibility';
import { Pricing } from '@/app/pages/Pricing';

// Auth Pages
import { Login } from '@/app/pages/Login';
import { Signup } from '@/app/pages/Signup';
import { VerifyEmail } from '@/app/pages/VerifyEmail';
import { AuthCallback } from '@/app/pages/AuthCallback';
import { ForgotPassword } from '@/app/pages/ForgotPassword';
import { ResetPassword } from '@/app/pages/ResetPassword';

// Coming Soon Page
import { ComingSoon } from '@/app/pages/onboarding/ComingSoon';

import { OnboardingWelcome } from '@/app/pages/onboarding/Welcome';
import { OnboardingProfileSetup } from '@/app/pages/onboarding/ProfileSetup';
import { OnboardingWellnessBaseline } from '@/app/pages/onboarding/WellnessBaseline';
import { OnboardingHealthBackground } from '@/app/pages/onboarding/HealthBackground';
import { OnboardingAvatarPreferences } from '@/app/pages/onboarding/AvatarPreferences';
import { OnboardingEmergencyContact } from '@/app/pages/onboarding/EmergencyContact';
import { OnboardingPermissions } from '@/app/pages/onboarding/Permissions';
import { OnboardingSafetyConsent } from '@/app/pages/onboarding/SafetyConsent';
import { OnboardingSubscription } from '@/app/pages/onboarding/Subscription';
import { OnboardingComplete } from '@/app/pages/onboarding/Complete';

// User App Pages
import { Dashboard } from '@/app/pages/app/Dashboard';
import { MoodCheckIn } from '@/app/pages/app/MoodCheckIn';
import { UserProfile } from '@/app/pages/app/UserProfile';
import { SessionLobby } from '@/app/pages/app/SessionLobby';
import { ActiveSession } from '@/app/pages/app/ActiveSession';
import { Billing } from '@/app/pages/app/Billing';

// Admin Pages
import { SuperAdminDashboard } from '@/app/pages/admin/SuperAdminDashboard';
import { OrgAdminDashboard } from '@/app/pages/admin/OrgAdminDashboard';
import { TeamAdminDashboard } from '@/app/pages/admin/TeamAdminDashboard';
import { UserManagement } from '@/app/pages/admin/UserManagement';
import { UserSegmentation } from '@/app/pages/admin/UserSegmentation';
import { TeamRoleManagement } from '@/app/pages/admin/TeamRoleManagement';
import { CompanionManagement } from '@/app/pages/admin/CompanionManagement';
import { AIAvatarManager } from '@/app/pages/admin/AIAvatarManager';
import { ConversationTranscripts } from '@/app/pages/admin/ConversationTranscripts';
import { CrisisDashboard } from '@/app/pages/admin/CrisisDashboard';
import { CrisisMonitoring } from '@/app/pages/admin/CrisisMonitoring';
import { CrisisEventDetails } from '@/app/pages/admin/CrisisEventDetails';
import { CrisisFollowUpQueue } from '@/app/pages/admin/CrisisFollowUpQueue';
import { CrisisProtocol } from '@/app/pages/admin/CrisisProtocol';
import { Analytics } from '@/app/pages/admin/Analytics';
import { UsageOverview } from '@/app/pages/admin/UsageOverview';
import { UsageAnalytics } from '@/app/pages/admin/UsageAnalytics';
import { SessionAnalytics } from '@/app/pages/admin/SessionAnalytics';
import { EngagementMetrics } from '@/app/pages/admin/EngagementMetrics';
import { RetentionMetrics } from '@/app/pages/admin/RetentionMetrics';
import { FeatureAdoption } from '@/app/pages/admin/FeatureAdoption';
import { OnboardingAnalytics } from '@/app/pages/admin/OnboardingAnalytics';
import { ReportsAnalytics } from '@/app/pages/admin/ReportsAnalytics';
import { ContentManagement } from '@/app/pages/admin/ContentManagement';
import { WellnessToolsCMS } from '@/app/pages/admin/WellnessToolsCMS';
import { WellnessContentCMS } from '@/app/pages/admin/WellnessContentCMS';
import { WellnessContentLibrary } from '@/app/pages/admin/WellnessContentLibrary';
import { WellnessToolEditor } from '@/app/pages/admin/WellnessToolEditor';
import { ExerciseLibrary } from '@/app/pages/admin/ExerciseLibrary';
import { ContentPerformance } from '@/app/pages/admin/ContentPerformance';
import { ContentModeration } from '@/app/pages/admin/ContentModeration';
import { NudgeManagement } from '@/app/pages/admin/NudgeManagement';
import { NudgeTemplates } from '@/app/pages/admin/NudgeTemplates';
import { NudgeScheduler } from '@/app/pages/admin/NudgeScheduler';
import { NudgePerformance } from '@/app/pages/admin/NudgePerformance';
import { WellnessChallenges } from '@/app/pages/admin/WellnessChallenges';
import { BadgeManager } from '@/app/pages/admin/BadgeManager';
import { NotificationsCenter } from '@/app/pages/admin/NotificationsCenter';
import { ManualNotifications } from '@/app/pages/admin/ManualNotifications';
import { EmailTemplates } from '@/app/pages/admin/EmailTemplates';
import { PushNotifications } from '@/app/pages/admin/PushNotifications';
import { SupportTickets } from '@/app/pages/admin/SupportTickets';
import { CommunityManagement } from '@/app/pages/admin/CommunityManagement';
import { LiveSessionsMonitor } from '@/app/pages/admin/LiveSessionsMonitor';
import { SessionRecordings } from '@/app/pages/admin/SessionRecordings';
import { ActivityMonitor } from '@/app/pages/admin/ActivityMonitor';
import { SystemHealthEnhanced } from '@/app/pages/admin/SystemHealthEnhanced';
import { SystemHealthDashboard } from '@/app/pages/admin/SystemHealthDashboard';
import { ErrorTracking } from '@/app/pages/admin/ErrorTracking';
import { SystemSettingsEnhanced } from '@/app/pages/admin/SystemSettingsEnhanced';
import { GlobalConfiguration } from '@/app/pages/admin/GlobalConfiguration';
import { FeatureFlags } from '@/app/pages/admin/FeatureFlags';
import { APIManagement } from '@/app/pages/admin/APIManagement';
import { IntegrationSettings } from '@/app/pages/admin/IntegrationSettings';
import { BrandingCustomization } from '@/app/pages/admin/BrandingCustomization';
import { ABTesting } from '@/app/pages/admin/ABTesting';
import { Billing as AdminBilling } from '@/app/pages/admin/Billing';
import { BillingSubscriptions } from '@/app/pages/admin/BillingSubscriptions';
import { PackageManager } from '@/app/pages/admin/PackageManager';
import { PayAsYouGoManager } from '@/app/pages/admin/PayAsYouGoManager';
import { ComplianceDashboard } from '@/app/pages/admin/ComplianceDashboard';
import { HIPAACompliance } from '@/app/pages/admin/HIPAACompliance';
import { DataPrivacyControls } from '@/app/pages/admin/DataPrivacyControls';
import { DataRetentionPrivacy } from '@/app/pages/admin/DataRetentionPrivacy';
import { AuditLogs } from '@/app/pages/admin/AuditLogs';
import { SystemLogs } from '@/app/pages/admin/SystemLogs';
import { LegalDocumentation } from '@/app/pages/admin/LegalDocumentation';
import { DataExport } from '@/app/pages/admin/DataExport';
import { BackupRecovery } from '@/app/pages/admin/BackupRecovery';

// Error Pages
import { Error404 } from '@/app/pages/errors/Error404';
import { Error500 } from '@/app/pages/errors/Error500';
import { Offline } from '@/app/pages/errors/Offline';
import { Maintenance } from '@/app/pages/errors/Maintenance';
import { PermissionDenied } from '@/app/pages/errors/PermissionDenied';
import { TrialExpired } from '@/app/pages/errors/TrialExpired';
import { NoDeviceAccess } from '@/app/pages/errors/NoDeviceAccess';

// Admin Public Pages
import { AdminLogin } from '@/app/pages/admin/AdminLogin';
import { AdminCredentials } from '@/app/pages/admin/AdminCredentials';
import { TwoFactorAuth } from '@/app/pages/admin/TwoFactorAuth';
import { MoodHistory } from './pages/app/MoodHistory';
import { Journal } from './pages/app/Journal';
import { WellnessTools } from './pages/app/WellnessTools';
import { SecuritySettings } from './pages/admin/SecuritySettings';

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

// (Removed temporary reload/route persistence helpers; the actual fix is in AuthContext + ProtectedRoute.)

export default function App() {
  useEffect(() => {
    let theme = "light";
    let accentKey = "pink";

    if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
      const pathname = window.location.pathname;
      // Only apply saved theme for app routes, ensuring public pages stay light by default
      const isAppRoute = pathname.startsWith("/app") || pathname.startsWith("/admin") || pathname.startsWith("/onboarding");
      
      if (isAppRoute) {
        const saved = window.localStorage.getItem("ezri_appearance_settings");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.theme) {
              theme = parsed.theme;
            }
            if (parsed.accentColor) {
              accentKey = parsed.accentColor;
            }
          } catch {
          }
        }
      }
    }

    if (typeof document === "undefined") return;
    const root = document.documentElement;

    if (theme === "auto") {
      if (typeof window !== "undefined" && window.matchMedia) {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        if (mediaQuery.matches) {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      } else {
        root.classList.remove("dark");
      }
    } else if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    const accentMap: Record<string, string> = {
      blue: "#3b82f6",
      purple: "#a855f7",
      pink: "#ec4899",
      green: "#22c55e",
      orange: "#f97316",
      teal: "#14b8a6"
    };

    const accent = accentMap[accentKey] || accentMap.pink;
    root.style.setProperty("--accent", accent);
  }, []);

  return (
    <AuthProvider>
      <NotificationsProvider>
      <SafetyProvider>
        <BrowserRouter>
        <ThemeManager />
        <NetworkWatcher />
        <MobileMetaTags />
        <Toaster />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/accessibility" element={<Accessibility />} />
          <Route path="/pricing" element={<Pricing />} />
          
          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Admin Routes - Public */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/credentials" element={<AdminCredentials />} />
          <Route path="/admin/two-factor-auth" element={<TwoFactorAuth />} />

          {/* Protected Routes - All Redirected to Coming Soon */}
          <Route element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
            <Route element={<OnboardingProvider><Outlet /></OnboardingProvider>}>
              {/* Onboarding Routes */}
              <Route path="/onboarding">
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
          
            {/* App Routes */}
            <Route path="/app/dashboard" element={<Dashboard />} />
            <Route path="/app/mood-checkin" element={<MoodCheckIn />} />
            <Route path="/app/mood-history" element={<MoodHistory />} />
            <Route path="/app/journal" element={<Journal />} />
            <Route path="/app/wellness-tools" element={<WellnessTools />} />
            <Route path="/app/session-lobby" element={<SessionLobby />} />
            <Route path="/app/active-session" element={<ActiveSession />} />
            <Route path="/app/user-profile" element={<UserProfile />} />
            <Route path="/app/billing" element={<Billing />} />
            <Route path="/app/*" element={<AppLayout><ComingSoon /></AppLayout>} />
            
            {/* Admin Routes - Protected and role-gated */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'org_admin', 'team_admin']}>
                  <Outlet />
                </ProtectedRoute>
              }
            >
            {/* Dashboards */}
            <Route path="/admin/super-admin-dashboard" element={<SuperAdminDashboard />} />
            <Route path="/admin/org-admin-dashboard" element={<OrgAdminDashboard />} />
            <Route path="/admin/team-admin-dashboard" element={<TeamAdminDashboard />} />

            {/* User Management */}
            <Route path="/admin/user-management" element={<UserManagement />} />
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

            {/* Content */}
            <Route path="/admin/content-management" element={<ContentManagement />} />
            <Route path="/admin/wellness-tools-cms" element={<WellnessToolsCMS />} />
            <Route path="/admin/wellness-content-cms" element={<WellnessContentCMS />} />
            <Route path="/admin/wellness-content-library" element={<WellnessContentLibrary />} />
            <Route path="/admin/wellness-tool-editor" element={<WellnessToolEditor />} />
            <Route path="/admin/exercise-library" element={<ExerciseLibrary />} />
            <Route path="/admin/content-performance" element={<ContentPerformance />} />
            <Route path="/admin/content-moderation" element={<ContentModeration />} />

            {/* Engagement */}
            <Route path="/admin/nudge-management" element={<NudgeManagement />} />
            <Route path="/admin/nudge-templates" element={<NudgeTemplates />} />
            <Route path="/admin/nudge-scheduler" element={<NudgeScheduler />} />
            <Route path="/admin/nudge-performance" element={<NudgePerformance />} />
            <Route path="/admin/wellness-challenges" element={<WellnessChallenges />} />
            <Route path="/admin/badge-manager" element={<BadgeManager />} />

            {/* Communications */}
            <Route path="/admin/notifications-center" element={<NotificationsCenter />} />
            <Route path="/admin/manual-notifications" element={<ManualNotifications />} />
            <Route path="/admin/email-templates" element={<EmailTemplates />} />
            <Route path="/admin/push-notifications" element={<PushNotifications />} />
            <Route path="/admin/support-tickets" element={<SupportTickets />} />
            <Route path="/admin/community-management" element={<CommunityManagement />} />

            {/* Monitoring */}
            <Route path="/admin/live-sessions-monitor" element={<LiveSessionsMonitor />} />
            <Route path="/admin/session-recordings" element={<SessionRecordings />} />
            <Route path="/admin/activity-monitor" element={<ActivityMonitor />} />
            <Route path="/admin/system-health-enhanced" element={<SystemHealthEnhanced />} />
            <Route path="/admin/system-health-dashboard" element={<SystemHealthDashboard />} />
            <Route path="/admin/error-tracking" element={<ErrorTracking />} />

            {/* System */}
            <Route path="/admin/system-settings-enhanced" element={<SystemSettingsEnhanced />} />
            <Route path="/admin/global-configuration" element={<GlobalConfiguration />} />
            <Route path="/admin/feature-flags" element={<FeatureFlags />} />
            <Route path="/admin/api-management" element={<APIManagement />} />
            <Route path="/admin/integration-settings" element={<IntegrationSettings />} />
            <Route path="/admin/branding-customization" element={<BrandingCustomization />} />
            <Route path="/admin/ab-testing" element={<ABTesting />} />

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
            <Route path="/admin/backup-recovery" element={<BackupRecovery />} />

            {/* No generic /admin/* fallback so every admin URL must point to a real page */}
            </Route>
          </Route>

          {/* Error Pages */}
          <Route path="/error/404" element={<Error404 />} />
          <Route path="/error/500" element={<Error500 />} />
          <Route path="/error/offline" element={<Offline />} />
          <Route path="/error/maintenance" element={<Maintenance />} />
          <Route path="/error/permission-denied" element={<PermissionDenied />} />
          <Route path="/error/no-device-access" element={<NoDeviceAccess />} />
          <Route path="/error/trial-expired" element={<TrialExpired />} />
          
          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </BrowserRouter>
      </SafetyProvider>
      </NotificationsProvider>
    </AuthProvider>
  );
}
