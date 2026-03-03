import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';

// Contexts
import { AuthProvider } from '@/app/contexts/AuthContext';
import { NotificationsProvider } from '@/app/contexts/NotificationsContext';
import { SafetyProvider } from '@/app/contexts/SafetyContext';
import { OnboardingProvider } from '@/app/contexts/OnboardingContext';
import { ProtectedRoute } from '@/app/components/ProtectedRoute';

// Components
import { Toaster } from '@/app/components/ui/sonner';
import { MobileMetaTags } from '@/app/components/MobileMetaTags';

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

// Onboarding Pages
import { OnboardingWelcome } from '@/app/pages/onboarding/Welcome';
import { OnboardingProfileSetup } from '@/app/pages/onboarding/ProfileSetup';
import { OnboardingSubscription } from '@/app/pages/onboarding/Subscription';
import { OnboardingWellnessBaseline } from '@/app/pages/onboarding/WellnessBaseline';
import { OnboardingHealthBackground } from '@/app/pages/onboarding/HealthBackground';
import { OnboardingAvatarPreferences } from '@/app/pages/onboarding/AvatarPreferences';
import { OnboardingSafetyConsent } from '@/app/pages/onboarding/SafetyConsent';
import { OnboardingEmergencyContact } from '@/app/pages/onboarding/EmergencyContact';
import { OnboardingPermissions } from '@/app/pages/onboarding/Permissions';
import { OnboardingComplete } from '@/app/pages/onboarding/Complete';

// User App Pages
import { Dashboard } from '@/app/pages/app/Dashboard';
import { Billing } from '@/app/pages/app/Billing';
import { SessionLobby } from '@/app/pages/app/SessionLobby';
import { ActiveSession } from '@/app/pages/app/ActiveSession';
import { SessionHistory } from '@/app/pages/app/SessionHistory';
import { Journal } from '@/app/pages/app/Journal';
import { MoodCheckIn } from '@/app/pages/app/MoodCheckIn';
import { MoodHistory } from '@/app/pages/app/MoodHistory';
import { WellnessTools } from '@/app/pages/app/WellnessTools';
import { Resources } from '@/app/pages/app/Resources';
import { Progress } from '@/app/pages/app/Progress';
import { Achievements } from '@/app/pages/app/Achievements';
import { SettingsHub } from '@/app/pages/app/SettingsHub';
import { CrisisResources } from '@/app/pages/app/CrisisResources';
import { UserProfile } from '@/app/pages/app/UserProfile';
import { HabitTracker } from '@/app/pages/app/HabitTracker';
import { SleepTracker } from '@/app/pages/app/SleepTracker';
import { AccountSettings } from '@/app/pages/app/AccountSettings';
import { PrivacySettings } from '@/app/pages/app/PrivacySettings';
import { NotificationSettings } from '@/app/pages/app/NotificationSettings';
import { AccessibilitySettings } from '@/app/pages/app/AccessibilitySettings';
import { AppearanceSettings } from '@/app/pages/app/AppearanceSettings';
import { ChangeAvatar } from '@/app/pages/app/ChangeAvatar';
import { Community } from '@/app/pages/app/Community';
import { EmergencyContacts } from '@/app/pages/app/EmergencyContacts';
import { SafetyPlan } from '@/app/pages/app/SafetyPlan';
import { SafetyInsights } from '@/app/pages/app/SafetyInsights';
import { ResourceAnalyticsPage } from '@/app/pages/app/ResourceAnalytics';
import { NotificationHistory } from '@/app/pages/app/NotificationHistory';
import { Notifications } from '@/app/pages/app/Notifications';
import { CooldownScreen } from '@/app/pages/app/CooldownScreen';
import { HelpSupport } from '@/app/pages/app/HelpSupport';
import { Challenges } from '@/app/pages/app/Challenges';

// Admin Pages
import { AdminLogin } from '@/app/pages/admin/AdminLogin';
import { TwoFactorAuth } from '@/app/pages/admin/TwoFactorAuth';
import { AdminDashboard } from '@/app/pages/admin/AdminDashboard';
import { SuperAdminDashboard } from '@/app/pages/admin/SuperAdminDashboard';
import { OrgAdminDashboard } from '@/app/pages/admin/OrgAdminDashboard';
import { TeamAdminDashboard } from '@/app/pages/admin/TeamAdminDashboard';
import { UserManagement } from '@/app/pages/admin/UserManagement';
import { UserDetailsEnhanced } from '@/app/pages/admin/UserDetailsEnhanced';
import { UserSegmentation } from '@/app/pages/admin/UserSegmentation';
import { TeamRoleManagement } from '@/app/pages/admin/TeamRoleManagement';
import { CrisisDashboard } from '@/app/pages/admin/CrisisDashboard';
import { CrisisMonitoring } from '@/app/pages/admin/CrisisMonitoring';
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
import { Billing as BillingAdmin } from '@/app/pages/admin/Billing';
import { BillingSubscriptions } from '@/app/pages/admin/BillingSubscriptions';
import { SecuritySettings } from '@/app/pages/admin/SecuritySettings';
import { AuditLogs } from '@/app/pages/admin/AuditLogs';
import { SystemLogs } from '@/app/pages/admin/SystemLogs';
import { AIAvatarManager } from '@/app/pages/admin/AIAvatarManager';
import { ConversationTranscripts } from '@/app/pages/admin/ConversationTranscripts';
import { PackageManager } from '@/app/pages/admin/PackageManager';
import { PayAsYouGoManager } from '@/app/pages/admin/PayAsYouGoManager';
import { CrisisFollowUpQueue } from '@/app/pages/admin/CrisisFollowUpQueue';
import { SafetyEventDashboard } from '@/app/pages/admin/SafetyEventDashboard';
import { SafetyEventDetails } from '@/app/pages/admin/SafetyEventDetails';
import { CrisisEventDetails } from '@/app/pages/admin/CrisisEventDetails';
import { CompanionManagement } from '@/app/pages/admin/CompanionManagement';
import { IntegrationSettings } from '@/app/pages/admin/IntegrationSettings';
import { APIManagement } from '@/app/pages/admin/APIManagement';
import { DataExport } from '@/app/pages/admin/DataExport';
import { BackupRecovery } from '@/app/pages/admin/BackupRecovery';
import { Compliance } from '@/app/pages/admin/Compliance';
import { ComplianceDashboard } from '@/app/pages/admin/ComplianceDashboard';
import { HIPAACompliance } from '@/app/pages/admin/HIPAACompliance';
import { DataRetentionPrivacy } from '@/app/pages/admin/DataRetentionPrivacy';
import { DataPrivacyControls } from '@/app/pages/admin/DataPrivacyControls';
import { LegalDocumentation } from '@/app/pages/admin/LegalDocumentation';
import { BrandingCustomization } from '@/app/pages/admin/BrandingCustomization';
import { ABTesting } from '@/app/pages/admin/ABTesting';
import { AdminCredentials } from '@/app/pages/admin/AdminCredentials';

// Error Pages
import { Error404 } from '@/app/pages/errors/Error404';
import { Error500 } from '@/app/pages/errors/Error500';
import { Offline } from '@/app/pages/errors/Offline';
import { Maintenance } from '@/app/pages/errors/Maintenance';
import { PermissionDenied } from '@/app/pages/errors/PermissionDenied';
import { TrialExpired } from '@/app/pages/errors/TrialExpired';
import { NoDeviceAccess } from '@/app/pages/errors/NoDeviceAccess';

// Demo Page
import { Phase1Demo } from '@/app/pages/Phase1Demo';

import { ThemeManager } from '@/app/components/ThemeManager';

function NetworkWatcher() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleOnline = () => {
      if (location.pathname === '/error/offline') {
        navigate('/app/dashboard');
      }
    };

    const handleOffline = () => {
      if (location.pathname !== '/error/offline') {
        navigate('/error/offline');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!navigator.onLine && location.pathname !== '/error/offline') {
      navigate('/error/offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [location.pathname, navigate]);

  return null;
}

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
          
          <Route element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
            <Route element={<OnboardingProvider><Outlet /></OnboardingProvider>}>
              {/* Onboarding Routes */}
              <Route path="/onboarding/welcome" element={<OnboardingWelcome />} />
              <Route path="/onboarding/profile" element={<OnboardingProfileSetup />} />
              <Route path="/onboarding/subscription" element={<OnboardingSubscription />} />
              <Route path="/onboarding/wellness-baseline" element={<OnboardingWellnessBaseline />} />
              <Route path="/onboarding/health-background" element={<OnboardingHealthBackground />} />
              <Route path="/onboarding/avatar-preferences" element={<OnboardingAvatarPreferences />} />
              <Route path="/onboarding/safety-consent" element={<OnboardingSafetyConsent />} />
              <Route path="/onboarding/emergency-contact" element={<OnboardingEmergencyContact />} />
              <Route path="/onboarding/permissions" element={<OnboardingPermissions />} />
              <Route path="/onboarding/complete" element={<OnboardingComplete />} />
            </Route>
          
            {/* App Routes */}
          <Route path="/app/dashboard" element={<Dashboard />} />
          <Route path="/app/billing" element={<Billing />} />
          <Route path="/app/session-lobby" element={<SessionLobby />} />
          <Route path="/app/active-session" element={<ActiveSession />} />
          <Route path="/app/session-history" element={<SessionHistory />} />
          <Route path="/app/journal" element={<Journal />} />
          <Route path="/app/mood-checkin" element={<MoodCheckIn />} />
          <Route path="/app/mood-history" element={<MoodHistory />} />
          <Route path="/app/wellness-tools" element={<WellnessTools />} />
          <Route path="/app/resources" element={<Resources />} />
          <Route path="/app/progress" element={<Progress />} />
          <Route path="/app/achievements" element={<Achievements />} />
          <Route path="/app/settings" element={<SettingsHub />} />
          <Route path="/app/crisis-resources" element={<CrisisResources />} />
          <Route path="/app/user-profile" element={<UserProfile />} />
          <Route path="/app/habit-tracker" element={<HabitTracker />} />
          <Route path="/app/sleep-tracker" element={<SleepTracker />} />
          <Route path="/app/challenges" element={<Challenges />} />
          <Route path="/app/community" element={<Community />} />
          <Route path="/app/notifications" element={<Notifications />} />
          <Route path="/app/cooldown-screen" element={<CooldownScreen />} />
          
          {/* Settings Sub-Routes */}
          <Route path="/app/settings/account" element={<AccountSettings />} />
          <Route path="/app/settings/privacy" element={<PrivacySettings />} />
          <Route path="/app/settings/notifications" element={<NotificationSettings />} />
          <Route path="/app/settings/notifications/list" element={<NotificationHistory />} />
          <Route path="/app/settings/accessibility" element={<AccessibilitySettings />} />
          <Route path="/app/settings/appearance" element={<AppearanceSettings />} />
          <Route path="/app/settings/change-avatar" element={<ChangeAvatar />} />
          <Route path="/app/settings/achievements" element={<Achievements />} />
          <Route path="/app/settings/community" element={<Community />} />
          <Route path="/app/settings/resources" element={<Resources />} />
          <Route path="/app/settings/emergency-contacts" element={<EmergencyContacts />} />
          <Route path="/app/settings/safety-plan" element={<SafetyPlan />} />
          <Route path="/app/settings/safety-insights" element={<SafetyInsights />} />
          <Route path="/app/settings/resource-analytics" element={<ResourceAnalyticsPage />} />
          <Route path="/app/settings/notification-history" element={<NotificationHistory />} />
          <Route path="/app/settings/cooldown-screen" element={<CooldownScreen />} />
          <Route path="/app/settings/help-support" element={<HelpSupport />} />
          
          {/* Legacy routes for backwards compatibility */}
          <Route path="/app/account-settings" element={<AccountSettings />} />
          <Route path="/app/privacy-settings" element={<PrivacySettings />} />
          <Route path="/app/notification-settings" element={<NotificationSettings />} />
          <Route path="/app/accessibility-settings" element={<AccessibilitySettings />} />
          <Route path="/app/appearance-settings" element={<AppearanceSettings />} />
          <Route path="/app/change-avatar" element={<ChangeAvatar />} />
          <Route path="/app/emergency-contacts" element={<EmergencyContacts />} />
          <Route path="/app/safety-plan" element={<SafetyPlan />} />
          <Route path="/app/safety-insights" element={<SafetyInsights />} />
          <Route path="/app/resource-analytics" element={<ResourceAnalyticsPage />} />
          <Route path="/app/notification-history" element={<NotificationHistory />} />
          <Route path="/app/help-support" element={<HelpSupport />} />
          
          </Route>
          {/* Error Pages */}
          <Route path="/error/404" element={<Error404 />} />
          <Route path="/error/500" element={<Error500 />} />
          <Route path="/error/offline" element={<Offline />} />
          <Route path="/error/maintenance" element={<Maintenance />} />
          <Route path="/error/permission-denied" element={<PermissionDenied />} />
          <Route path="/error/no-device-access" element={<NoDeviceAccess />} />
          <Route path="/error/trial-expired" element={<TrialExpired />} />
          
          {/* Demo Routes */}
          <Route path="/demo/phase1" element={<Phase1Demo />} />
          
          {/* Admin Routes - Public */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/credentials" element={<AdminCredentials />} />
          <Route path="/admin/two-factor-auth" element={<TwoFactorAuth />} />

          {/* Admin Routes - Protected */}
          <Route element={<ProtectedRoute allowedRoles={['super_admin', 'org_admin', 'team_admin']}><Outlet /></ProtectedRoute>}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/super-admin-dashboard" element={<SuperAdminDashboard />} />
            <Route path="/admin/org-admin-dashboard" element={<OrgAdminDashboard />} />
            <Route path="/admin/team-admin-dashboard" element={<TeamAdminDashboard />} />
            <Route path="/admin/user-management" element={<UserManagement />} />
            <Route path="/admin/user-details-enhanced/:userId" element={<UserDetailsEnhanced />} />
            <Route path="/admin/crisis-monitoring" element={<CrisisMonitoring />} />
            <Route path="/admin/crisis-dashboard" element={<CrisisDashboard />} />
            <Route path="/admin/crisis-event-details" element={<CrisisEventDetails />} />
            <Route path="/admin/crisis-follow-up-queue" element={<CrisisFollowUpQueue />} />
            <Route path="/admin/safety-events" element={<SafetyEventDashboard />} />
            <Route path="/admin/safety-event-details" element={<SafetyEventDetails />} />
            <Route path="/admin/session-analytics" element={<SessionAnalytics />} />
            <Route path="/admin/content-management" element={<ContentManagement />} />
            <Route path="/admin/reports-analytics" element={<ReportsAnalytics />} />
            <Route path="/admin/support-tickets" element={<SupportTickets />} />
            <Route path="/admin/notifications-center" element={<NotificationsCenter />} />
            <Route path="/admin/audit-logs" element={<AuditLogs />} />
            <Route path="/admin/system-settings" element={<SystemSettingsEnhanced />} />
            <Route path="/admin/analytics" element={<Analytics />} />
            <Route path="/admin/usage-overview" element={<UsageOverview />} />
            <Route path="/admin/engagement-metrics" element={<EngagementMetrics />} />
            <Route path="/admin/feature-adoption" element={<FeatureAdoption />} />
            <Route path="/admin/retention-metrics" element={<RetentionMetrics />} />
            <Route path="/admin/wellness-tools-cms" element={<WellnessToolsCMS />} />
            <Route path="/admin/wellness-tool-editor" element={<WellnessToolEditor />} />
            <Route path="/admin/wellness-content-library" element={<WellnessContentLibrary />} />
            <Route path="/admin/content-performance" element={<ContentPerformance />} />
            <Route path="/admin/nudge-templates" element={<NudgeTemplates />} />
            <Route path="/admin/nudge-scheduler" element={<NudgeScheduler />} />
            <Route path="/admin/nudge-performance" element={<NudgePerformance />} />
            <Route path="/admin/manual-notifications" element={<ManualNotifications />} />
            <Route path="/admin/global-configuration" element={<GlobalConfiguration />} />
            <Route path="/admin/integration-settings" element={<IntegrationSettings />} />
            <Route path="/admin/branding-customization" element={<BrandingCustomization />} />
            <Route path="/admin/system-health-dashboard" element={<SystemHealthDashboard />} />
            <Route path="/admin/error-tracking" element={<ErrorTracking />} />
            <Route path="/admin/backup-recovery" element={<BackupRecovery />} />
            <Route path="/admin/hipaa-compliance" element={<HIPAACompliance />} />
            <Route path="/admin/data-privacy-controls" element={<DataPrivacyControls />} />
            <Route path="/admin/legal-documentation" element={<LegalDocumentation />} />
            <Route path="/admin/ab-testing" element={<ABTesting />} />
            <Route path="/admin/activity-monitor" element={<ActivityMonitor />} />
            <Route path="/admin/content-moderation" element={<ContentModeration />} />
            <Route path="/admin/system-health-enhanced" element={<SystemHealthEnhanced />} />
            <Route path="/admin/live-sessions-monitor" element={<LiveSessionsMonitor />} />
            <Route path="/admin/usage-analytics" element={<UsageAnalytics />} />
            <Route path="/admin/api-management" element={<APIManagement />} />
            <Route path="/admin/feature-flags" element={<FeatureFlags />} />
            <Route path="/admin/email-templates" element={<EmailTemplates />} />
            <Route path="/admin/push-notifications" element={<PushNotifications />} />
            <Route path="/admin/billing" element={<BillingAdmin />} />
            <Route path="/admin/billing-subscriptions" element={<BillingSubscriptions />} />
            <Route path="/admin/companion-management" element={<CompanionManagement />} />
            <Route path="/admin/community-management" element={<CommunityManagement />} />
            <Route path="/admin/crisis-protocol" element={<CrisisProtocol />} />
            <Route path="/admin/data-export" element={<DataExport />} />
            <Route path="/admin/security-settings" element={<SecuritySettings />} />
            <Route path="/admin/compliance" element={<Compliance />} />
            <Route path="/admin/compliance-dashboard" element={<ComplianceDashboard />} />
            <Route path="/admin/user-segmentation" element={<UserSegmentation />} />
            <Route path="/admin/onboarding-analytics" element={<OnboardingAnalytics />} />
            <Route path="/admin/session-recordings" element={<SessionRecordings />} />
            <Route path="/admin/wellness-challenges" element={<WellnessChallenges />} />
            <Route path="/admin/nudge-management" element={<NudgeManagement />} />
            <Route path="/admin/wellness-content-cms" element={<WellnessContentCMS />} />
            <Route path="/admin/exercise-library" element={<ExerciseLibrary />} />
            <Route path="/admin/badge-manager" element={<BadgeManager />} />
            <Route path="/admin/system-logs" element={<SystemLogs />} />
            <Route path="/admin/team-role-management" element={<TeamRoleManagement />} />
            <Route path="/admin/system-settings-enhanced" element={<SystemSettingsEnhanced />} />
            <Route path="/admin/data-retention-privacy" element={<DataRetentionPrivacy />} />
            <Route path="/admin/ai-avatar-manager" element={<AIAvatarManager />} />
            <Route path="/admin/conversation-transcripts" element={<ConversationTranscripts />} />
            <Route path="/admin/package-manager" element={<PackageManager />} />
            <Route path="/admin/payg-transactions" element={<PayAsYouGoManager />} />
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
