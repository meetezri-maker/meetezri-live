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
import { UserProfile } from '@/app/pages/app/UserProfile';

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
            <Route path="/app/user-profile" element={<UserProfile />} />
            <Route path="/app/*" element={<AppLayout><ComingSoon /></AppLayout>} />
            
            {/* Admin Routes - Protected */}
            <Route path="/admin/*" element={<AppLayout><ComingSoon /></AppLayout>} />
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
