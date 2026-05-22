import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ALLOW_EXPIRED_PLAN_ROUTES = new Set(['/app/dashboard', '/app/billing']);

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, isLoading, hasRole, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isOnboardingRoute = location.pathname.startsWith('/onboarding');
  const [isCancelling, setIsCancelling] = useState(false);
  const [activationEmailSending, setActivationEmailSending] = useState(false);

  const isAccountInactive = profile?.account_status === 'inactive';

  if (isLoading) {
    // If we already have a signed-in user, never unmount the entire route tree.
    // Background auth refreshes (often triggered by tab switching) should be silent.
    // Do NOT redirect away from /onboarding during hydration — paid users land here right after email verify.
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

  if (isAccountInactive) {
    const handleSendActivationEmail = async () => {
      setActivationEmailSending(true);
      try {
        const result = await api.requestAccountActivation();
        toast.success('Activation email sent', {
          description: result?.email
            ? `Check ${result.email} for your activation link.`
            : 'Check your inbox for the activation link.',
        });
      } catch (error: unknown) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to send activation email'
        );
      } finally {
        setActivationEmailSending(false);
      }
    };

    const handleSignOutInactive = async () => {
      await signOut();
      navigate('/login', { replace: true });
    };

    return (
      <>
        <div className="min-h-screen bg-[#0a0b18]" />
        <Dialog open>
          <DialogContent
            className="border-white/10 bg-[#12141f] sm:max-w-md"
            onInteractOutside={(event) => event.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="text-zinc-100">Account deactivated</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Your Solace account is paused. You can reactivate it anytime. We will email you a
                secure link to restore access.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                onClick={handleSendActivationEmail}
                isLoading={activationEmailSending}
                disabled={activationEmailSending}
                className="w-full"
              >
                Send activation email
              </Button>
              <Button
                variant="outline"
                onClick={handleSignOutInactive}
                disabled={activationEmailSending}
                className="w-full border-white/15 bg-transparent text-zinc-300 hover:bg-white/5"
              >
                Sign out
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
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
  const isAppRoute = location.pathname.startsWith('/app');
  const isPlanPackageExpired =
    signupType === 'plan' &&
    (profile?.subscription_plan === 'trial' ||
      profile?.subscription_status === 'canceled' ||
      profile?.subscription_status === 'cancelled' ||
      profile?.subscription_status === 'expired');
  if (
    isAppRoute &&
    isPlanPackageExpired &&
    !ALLOW_EXPIRED_PLAN_ROUTES.has(location.pathname)
  ) {
    const handleGoToBilling = () => navigate('/app/billing');
    const handleUnsubscribe = async () => {
      setIsCancelling(true);
      try {
        await api.billing.cancelSubscription();
        toast.success('Subscription cancelled. Auto-renew has been turned off.');
      } catch (error: any) {
        toast.error(error?.message || 'Failed to cancel subscription');
      } finally {
        setIsCancelling(false);
        navigate('/app/billing');
      }
    };

    return (
      <>
        <div className="min-h-screen bg-background" />
        <Dialog open>
          <DialogContent
            className="sm:max-w-md"
            onInteractOutside={(event) => event.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Your package has ended</DialogTitle>
              <DialogDescription>
                This feature is locked until you renew your plan. Go to billing to renew
                now, or unsubscribe to stop future renewals.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleUnsubscribe}
                isLoading={isCancelling}
                disabled={isCancelling}
              >
                Unsubscribe
              </Button>
              <Button onClick={handleGoToBilling} disabled={isCancelling}>
                Go to Billing
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Trial flow rule (per spec):
  // - trial users must NEVER be redirected to any /onboarding/* route
  // - trial users may access session lobby + dashboard + user profile
  if (signupType === 'trial') {
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
    if (isDashboardRoute || (signupType === "trial" && isTrialUserProfileRoute)) {
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
