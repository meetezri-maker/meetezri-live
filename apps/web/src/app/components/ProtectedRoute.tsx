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
import { isOnboardingResumeMode } from '@/lib/onboarding/onboardingResume';
import { isPaidPlanUser, isTrialPlanUser } from '@/lib/onboarding/paidOnboardingSteps';
import { isTrialUser } from '@/lib/auth/trialUser';
import { APP_DASHBOARD_ROUTE, PAID_ONBOARDING_START_ROUTE } from '@/lib/auth/postAuthRoute';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ALLOW_EXPIRED_PLAN_ROUTES = new Set(['/app/dashboard', '/app/billing']);

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const {
    user,
    profile,
    profileStatus,
    isLoading,
    hasRole,
    signOut,
    refreshProfile,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isOnboardingRoute = location.pathname.startsWith('/onboarding');
  const onboardingResume = isOnboardingResumeMode(location.search);
  const isPaidUserForResume =
    !!profile && isPaidPlanUser(profile) && !isTrialPlanUser(profile);
  const [isCancelling, setIsCancelling] = useState(false);
  const [activationEmailSending, setActivationEmailSending] = useState(false);

  const isAccountInactive = profile?.account_status === 'inactive';

  if (isLoading && !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profileStatus !== 'ready' || !profile) {
    if (profileStatus === 'error') {
      return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-sm text-muted-foreground">
            We could not restore your profile yet. Your onboarding status has not changed.
          </p>
          <Button onClick={() => void refreshProfile()}>Try again</Button>
        </div>
      );
    }

    return (
      <div className="flex h-screen w-full items-center justify-center" aria-label="Restoring profile">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
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
  const onboardingCompleted = profile.onboarding_completed === true;
  const onboardingIncomplete = profile.onboarding_completed === false;
  const signupType: 'trial' | 'plan' = isTrialUser(profile) ? 'trial' : 'plan';
  // After a magic-link verify, Supabase session is confirmed immediately but `/users/me`
  // can still return a cached profile with `email_verified: false` for a moment.
  const sessionEmailVerified = Boolean(user.email_confirmed_at);
  const emailVerified =
    profile?.email_verified === true ||
    (signupType !== 'trial' && sessionEmailVerified);
  // Only paid users are ever sent into onboarding (trial users are stopped below),
  // so the start route is the paid one.
  const onboardingStartRoute = PAID_ONBOARDING_START_ROUTE;
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

  // Trial flow rule: trial users must never see onboarding. This is the hard guard —
  // whatever any auth page navigates to, /onboarding/* never renders for a trial user.
  // Every other route renders as before; trial feature limits are enforced by the pages.
  if (signupType === 'trial') {
    if (isOnboardingRoute) {
      return <Navigate to={APP_DASHBOARD_ROUTE} replace />;
    }
    return <>{children}</>;
  }

  // Trial users were handled above. Paid users enter the app only after the
  // server has explicitly confirmed onboarding completion.
  if (isAppRoute && onboardingIncomplete) {
    return <Navigate to={onboardingStartRoute} replace />;
  }

  // Never allow re-entering onboarding after completion unless a paid user
  // is resuming a specific step from their profile checklist.
  if (isOnboardingRoute && onboardingCompleted && !(onboardingResume && isPaidUserForResume)) {
    return <Navigate to="/app/dashboard" replace />;
  }

  if (isOnboardingRoute && onboardingResume && !isPaidUserForResume) {
    return <Navigate to="/app/user-profile" replace />;
  }

  // Never allow paid onboarding steps until email is verified. Only paid users reach
  // this point, so no trial exemption is needed here.
  if (isOnboardingRoute && onboardingIncomplete && !emailVerified) {
    return <Navigate to="/verify-email" replace />;
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
