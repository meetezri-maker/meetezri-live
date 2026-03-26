import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { api } from "@/lib/api";

export function AuthCallback() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const isSafeRedirectPath = (value: string) => {
    if (!value.startsWith('/')) return false;
    // Prevent redirect loops back into auth/public entry points.
    const blockedPrefixes = ['/auth/callback', '/login', '/signup', '/verify-email'];
    return !blockedPrefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}?`));
  };

  const getRedirectPath = (currentUser?: any) => {
    const targetUser = currentUser || user;
    
    // 1. Check standard search params
    const searchParams = new URLSearchParams(location.search);
    let requested = searchParams.get('redirect') || searchParams.get('next');
    
    // 2. Check hash params (Supabase Implicit Flow / PKCE edge cases)
    if (!requested && location.hash) {
       const hashStr = location.hash.substring(1);
       const hashParams = new URLSearchParams(hashStr);
       requested = hashParams.get('redirect') || hashParams.get('next');
    }

    console.log("Resolved Redirect Path:", requested);

    if (requested && isSafeRedirectPath(requested)) return requested;

    // 3. Smart Fallback based on User Metadata
    // Trial users (Soft Verification) -> Profile to complete setup
    if (targetUser?.user_metadata?.email_verification_required) {
      // Only trial users land on the profile route after verification.
      const signupType = targetUser?.user_metadata?.signup_type;
      if (signupType === 'trial') return '/onboarding/profile-setup';
      return '/onboarding/welcome';
    }

    // 4. Heuristic for New Paid Users (if param is lost)
    if (targetUser?.created_at) {
      const created = new Date(targetUser.created_at).getTime();
      const now = Date.now();
      const isNew = (now - created) < 5 * 60 * 1000; // 5 minutes threshold
      
      if (isNew) {
         console.log("AuthCallback: Detected new user (heuristic), redirecting to onboarding");
         return '/onboarding/welcome';
      }
    }

    // Default Fallback
    return '/app/dashboard';
  };

  const finalizeVerification = async (sessionUser: any) => {
      // If this is a Trial User verifying for the first time
      if (sessionUser?.user_metadata?.email_verification_required) {
        const signupType = sessionUser?.user_metadata?.signup_type;
        if (signupType !== 'trial') {
          // For non-trial users, fall through to deterministic routing.
        } else {
          try {
            await supabase.auth.updateUser({
              data: { email_verification_required: false }
            });
            toast.success("Email verified successfully!");
            navigate('/onboarding/profile-setup', { replace: true });
            return;
          } catch (e) {
            console.error("Failed to clear verification flag", e);
          }
        }
      }

      // Deterministic routing:
      // Prefer URL-provided redirect (for older links), otherwise resolve from backend profile.
      const searchParams = new URLSearchParams(location.search);
      let requested =
        searchParams.get('redirect') || searchParams.get('next') || null;

      if (!requested && location.hash) {
        const hashStr = location.hash.substring(1);
        const hashParams = new URLSearchParams(hashStr);
        requested = hashParams.get('redirect') || hashParams.get('next') || null;
      }

      if (requested && isSafeRedirectPath(requested)) {
        navigate(requested, { replace: true });
        return;
      }

      try {
        const me = await api.getMe();
        console.log("AuthCallback: api.getMe after verification", {
          email_verified: me?.email_verified,
          signup_type: me?.signup_type,
          onboarding_completed: me?.onboarding_completed,
        });
        if (me?.onboarding_completed === true) {
          navigate('/app/dashboard', { replace: true });
          return;
        }

        if (me?.signup_type === 'trial') {
          navigate('/onboarding/profile-setup', { replace: true });
          return;
        }

        navigate('/onboarding/welcome', { replace: true });
        return;
      } catch (e) {
        // Fallback: metadata/heuristics-based navigation.
        navigate(getRedirectPath(sessionUser), { replace: true });
      }
  };

  useEffect(() => {
    // Check if we are in the middle of an auth flow (Code Exchange or Implicit Flow)
    const searchParams = new URLSearchParams(location.search);
    const hasCode = searchParams.get('code');
    const hasHash = location.hash.includes('access_token') || location.hash.includes('error') || location.hash.includes('type=recovery');

    // If there is a code or hash, we MUST wait for handleCallback to process the new session
    // DO NOT redirect based on potential stale user session
    if (hasCode || hasHash) {
      console.log("AuthCallback: Detected new auth flow parameters. Waiting for processing...");
      return;
    }

    // Immediate redirect if user is already loaded AND we are not processing
    // the auth callback tokens (code/access_token) yet.
    if (user) {
      const searchParams = new URLSearchParams(location.search);
      const hasCode = !!searchParams.get('code');
      const hasHash =
        location.hash.includes('access_token') ||
        location.hash.includes('error') ||
        location.hash.includes('type=recovery');

      if (hasCode || hasHash) return;

      // If user has the "email_verification_required" flag, clear it since they just completed an auth flow
      if (user.user_metadata?.email_verification_required) {
        const signupType = user.user_metadata?.signup_type;
        if (signupType !== 'trial') {
          navigate('/onboarding/welcome', { replace: true });
          return;
        }
        supabase.auth.updateUser({
          data: { email_verification_required: false }
        }).then(() => {
          toast.success("Email verified successfully!");
        });
        // Redirect to profile with verified flag
        navigate('/onboarding/profile-setup', { replace: true });
        return;
      }
      navigate(getRedirectPath(), { replace: true });
    }
  }, [user, navigate, location.search, location.hash]);

  useEffect(() => {
    console.log("AuthCallback mounted. URL:", window.location.href);
    console.log("Search:", location.search, "Hash:", location.hash);

    const handleCallback = async () => {
      // 1. Parse Parameters
      const searchParams = new URLSearchParams(location.search);
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      const hashParams = new URLSearchParams(location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const errorHash = hashParams.get('error');
      const errorDescriptionHash = hashParams.get('error_description');

      // 2. Handle Errors from URL
      if (error || errorHash) {
        const msg = errorDescription || errorDescriptionHash || 'Authentication failed';
        console.error('Auth error:', error || errorHash, msg);
        toast.error(msg);
        setErrorMessage(msg);
        setStatus('error');
        return;
      }

      // 3. Handle Code Exchange (PKCE)
      if (code) {
        try {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          
          if (data?.session) {
            setStatus('success');
            finalizeVerification(data.session.user);
            return;
          }
        } catch (err: any) {
          console.error('Code exchange error:', err);
          const msg = err.message || 'Failed to verify email';
          toast.error(msg);
          setErrorMessage(msg);
          setStatus('error');
          return;
        }
      } 
      // 4. Handle Tokens (Implicit)
      else if (accessToken && refreshToken) {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) {
             console.error('Session set error:', sessionError);
             const msg = sessionError.message;
             toast.error(msg);
             setErrorMessage(msg);
             setStatus('error');
             return;
          }
          
          if (data?.session) {
            setStatus('success');
            finalizeVerification(data.session.user);
            return;
          }
      }

      // 5. Verify Session Establishment
      const checkSession = async (attempts = 0) => {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          setStatus('success');
          // Navigate immediately - user wants "nano seconds" response
          finalizeVerification(session.user);
          return;
        }

        // Retry every 50ms for up to 5 seconds (100 attempts)
        if (attempts < 100) {
          setTimeout(() => checkSession(attempts + 1), 50);
        } else {
          console.warn("Session check timed out after 5 seconds");
          setErrorMessage("Session establishment timed out. Please try logging in.");
          setStatus('error');
        }
      };
      
      checkSession();
    };

    handleCallback();
  }, [location, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white via-purple-50/30 to-white">
      <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-lg shadow-sm border border-gray-100">
        {status === 'processing' && (
          <>
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <h2 className="text-xl font-semibold text-gray-700">Verifying your email...</h2>
            <p className="text-muted-foreground">Please wait while we confirm your account.</p>
          </>
        )}

        {status === 'success' && (
           <>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-500 font-bold text-xl">✓</div>
            <h2 className="text-xl font-semibold text-gray-700">Email Verified!</h2>
            <p className="text-muted-foreground">Redirecting...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-500 font-bold text-xl">!</div>
            <h2 className="text-xl font-semibold text-gray-700">Verification Failed</h2>
            <p className="text-muted-foreground text-center max-w-sm">
              {errorMessage || "We couldn't verify your email link. It may be expired or invalid."}
            </p>
            <button 
              onClick={() => navigate('/login')}
              className="mt-4 px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
