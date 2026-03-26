import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, isLoading, hasRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    // If we already have a signed-in user, never unmount the entire route tree.
    // Background auth refreshes (often triggered by tab switching) should be silent.
    if (user) {
      return <>{children}</>;
    }
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profile && profile.role === 'suspended') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-red-50 px-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-600">
            You are suspended
          </h1>
          <p className="text-muted-foreground">
            Please contact support if you believe this is a mistake.
          </p>
        </div>
      </div>
    );
  }

  // Onboarding access control (server-derived, not client heuristics)
  const onboardingCompleted = profile?.onboarding_completed === true;
  const emailVerified = profile?.email_verified === true;
  const signupType = (profile?.signup_type as 'trial' | 'plan' | undefined) ?? (profile?.subscription_plan === 'trial' ? 'trial' : 'plan');
  const onboardingStartRoute =
    signupType === 'trial' ? '/onboarding/profile-setup' : '/onboarding/welcome';
  const isOnboardingRoute = location.pathname.startsWith('/onboarding');
  const isAppRoute = location.pathname.startsWith('/app');

  // Trial flow rule (per spec):
  // - trial users must NEVER be redirected to any /onboarding/* route
  // - trial users may access session lobby + dashboard + user profile
  if (signupType === 'trial') {
    if (isOnboardingRoute) {
      return <Navigate to="/app/dashboard" replace />;
    }
    if (
      location.pathname === '/app/dashboard' ||
      location.pathname === '/app/user-profile' ||
      location.pathname === '/app/session-lobby'
    ) {
      return <>{children}</>;
    }
    // For other /app routes, preserve existing trial behavior: allow route rendering
    // unless upstream pages enforce their own restrictions.
    return <>{children}</>;
  }

  // Trial flow requirement:
  // - allow `/app/dashboard` even when onboarding is not complete yet (email verification popup may be shown)
  // - redirect other app routes to the trial onboarding start route.
  if (isAppRoute && !onboardingCompleted) {
    const isDashboardRoute = location.pathname === "/app/dashboard";
    const isTrialUserProfileRoute =
      location.pathname === "/app/user-profile" ||
      location.pathname.startsWith("/app/user-profile?");
    if (signupType === "trial" && (isDashboardRoute || isTrialUserProfileRoute)) {
      return <>{children}</>;
    }
    return <Navigate to={onboardingStartRoute} replace />;
  }

  // Never allow re-entering onboarding after completion.
  if (isOnboardingRoute && onboardingCompleted) {
    return <Navigate to="/app/dashboard" replace />;
  }

  // Never allow paid onboarding steps until email is verified.
  // Trial flow should allow the "complete profile" step from the dashboard stage,
  // so we do NOT block trial onboarding routes on email verification.
  if (isOnboardingRoute && !onboardingCompleted && !emailVerified && signupType !== 'trial') {
    return <Navigate to="/verify-email" replace />;
  }

  // Flow-specific: trial users should not begin at the welcome landing.
  if (
    isOnboardingRoute &&
    !onboardingCompleted &&
    signupType === 'trial' &&
    location.pathname === '/onboarding/welcome'
  ) {
    return <Navigate to="/onboarding/profile-setup" replace />;
  }

  // Trial flow isolation: while trial profile is incomplete, only allow the
  // Trial "complete profile" route. Prevent entry into the paid onboarding steps.
  if (isOnboardingRoute && !onboardingCompleted && signupType === 'trial') {
    if (!location.pathname.startsWith(onboardingStartRoute)) {
      return <Navigate to={onboardingStartRoute} replace />;
    }
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRole(allowedRoles)) {
    // If user tries to access an area they don't have role for:
    // - Admin paths -> permission denied page
    // - App paths -> redirect to main app dashboard
    if (location.pathname.startsWith('/admin')) {
      return <Navigate to="/error/permission-denied" replace />;
    }
    return <Navigate to="/app/dashboard" replace />;
  }

  return <>{children}</>;
}
