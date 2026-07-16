import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { APP_DASHBOARD_ROUTE, resolvePostAuthRoute } from "@/lib/auth/postAuthRoute";

const SS_REDIRECT = "ezri.auth.callback.redirect";
const SS_FLOW = "ezri.auth.callback.flow";
const SS_VIA = "ezri.auth.callback.via";

/** Persist redirect/flow from URL before Supabase PKCE or history.replaceState drops query params. */
function persistCallbackParamsFromUrl() {
  if (typeof window === "undefined") return;
  const p = new URLSearchParams(window.location.search);
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const r = p.get("redirect") || p.get("next") || h.get("redirect") || h.get("next");
  const f = p.get("flow") || h.get("flow");
  const v = p.get("via") || h.get("via");
  if (r) sessionStorage.setItem(SS_REDIRECT, r);
  if (f) sessionStorage.setItem(SS_FLOW, f);
  if (v) sessionStorage.setItem(SS_VIA, v);
}

function readStoredCallbackParams() {
  if (typeof window === "undefined") {
    return { redirect: null as string | null, flow: null as string | null, via: null as string | null };
  }
  return {
    redirect: sessionStorage.getItem(SS_REDIRECT),
    flow: sessionStorage.getItem(SS_FLOW),
    via: sessionStorage.getItem(SS_VIA),
  };
}

function clearStoredCallbackParams() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SS_REDIRECT);
  sessionStorage.removeItem(SS_FLOW);
  sessionStorage.removeItem(SS_VIA);
}
/** PKCE codes are single-use; React Strict Mode / remounts must not exchange twice. */
const pkceExchangeInflight = new Map<string, ReturnType<typeof supabase.auth.exchangeCodeForSession>>();
const oauthFinalizeOnceKeys = new Set<string>();

function exchangeCodeForSessionDeduped(code: string) {
  let p = pkceExchangeInflight.get(code);
  if (!p) {
    p = supabase.auth.exchangeCodeForSession(code).finally(() => {
      pkceExchangeInflight.delete(code);
    });
    pkceExchangeInflight.set(code, p);
  }
  return p;
}

function shouldFinalizeOAuthOnce(key: string) {
  if (oauthFinalizeOnceKeys.has(key)) return false;
  oauthFinalizeOnceKeys.add(key);
  return true;
}

export function AuthCallback() {
  const { user, profile, profileStatus, isLoading: isAuthLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');
  // Both effects can reach a destination; the callback must only leave once.
  const hasNavigatedRef = useRef(false);

  const leaveCallback = (destination: string) => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    clearStoredCallbackParams();
    navigate(destination, { replace: true });
  };

  // Capture ?redirect= / ?flow= before any async auth exchange mutates the URL.
  useLayoutEffect(() => {
    persistCallbackParamsFromUrl();
  }, [location.search, location.hash]);

  const isSafeRedirectPath = (value: string) => {
    if (!value.startsWith('/')) return false;
    // Prevent redirect loops back into auth/public entry points.
    const blockedPrefixes = ['/auth/callback', '/login', '/signup', '/verify-email'];
    return !blockedPrefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}?`));
  };

  /**
   * An explicit ?redirect= / ?next= asked for by whoever built the link. This is caller
   * intent (deep links), not an inference about the account, so it still wins. Every
   * other destination now comes from resolvePostAuthRoute.
   *
   * Deliberately gone from here: the flow=trial|plan destinations, the
   * user_metadata.signup_type guesses, and the "account younger than five minutes must
   * be a new paid user" heuristic. Each of those decided a final route from something
   * other than the server profile, which is exactly what this phase removes.
   */
  const getRequestedRedirect = (): string | null => {
    const stored = readStoredCallbackParams();
    const searchParams = new URLSearchParams(location.search);
    let requested =
      searchParams.get("redirect") ||
      searchParams.get("next") ||
      stored.redirect ||
      null;

    // Hash params (Supabase Implicit Flow / PKCE edge cases)
    if (!requested && location.hash) {
      const hashParams = new URLSearchParams(location.hash.substring(1));
      requested = hashParams.get("redirect") || hashParams.get("next");
    }

    return requested && isSafeRedirectPath(requested) ? requested : null;
  };

  /**
   * The final destination, from the authoritative profile only.
   *
   * Recovery is bounded and reuses what already exists: one getMe, then AuthContext's
   * refreshProfile (getMe x3 + /users/init on 404). No new retry loop. If the profile
   * still cannot be classified we hand off to ProtectedRoute via the dashboard rather
   * than guess "paid" and force onboarding — trial users are admitted, paid-incomplete
   * users get redirected by the gate once their profile resolves.
   */
  const resolveDestinationFromServer = async (): Promise<string> => {
    let candidate: unknown = null;
    try {
      candidate = await api.getMe();
    } catch (e) {
      console.warn("AuthCallback: getMe failed, falling back to profile recovery", e);
    }

    const direct = resolvePostAuthRoute(candidate as never);
    if (direct) return direct;

    try {
      const refreshed = await refreshProfile();
      const recovered = refreshed ? resolvePostAuthRoute(refreshed) : null;
      if (recovered) return recovered;
    } catch (e) {
      console.warn("AuthCallback: profile recovery failed", e);
    }

    return APP_DASHBOARD_ROUTE;
  };

  const finalizeVerification = async (sessionUser: any) => {
      persistCallbackParamsFromUrl();
      const stored = readStoredCallbackParams();
      const searchParams = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : location.search
      );
      const hashParams = new URLSearchParams(
        typeof window !== "undefined"
          ? window.location.hash.replace(/^#/, "")
          : location.hash.replace(/^#/, "")
      );

      const via =
        searchParams.get("via") ||
        hashParams.get("via") ||
        stored.via;
      const requested =
        searchParams.get("redirect") ||
        searchParams.get("next") ||
        hashParams.get("redirect") ||
        hashParams.get("next") ||
        stored.redirect;

      // Verification magiclink: confirm server-side, then refresh profile so ProtectedRoute sees email_verified.
      if (via === "verification") {
        try {
          await api.confirmEmail();
        } catch (e) {
          console.warn("AuthCallback: failed to confirm email via API", e);
        }
        try {
          await refreshProfile();
        } catch (e) {
          console.warn("AuthCallback: refreshProfile after verify", e);
        }
      }

      // Trial soft-verification: clear the metadata flag and acknowledge. This is
      // verification work, so it stays; only the destination moved to the resolver below.
      if (sessionUser?.user_metadata?.email_verification_required) {
        const signupType = sessionUser?.user_metadata?.signup_type;
        if (signupType === "trial") {
          try {
            await supabase.auth.updateUser({
              data: { email_verification_required: false },
            });
            toast.success("Email verified successfully!");
          } catch (e) {
            console.error("Failed to clear verification flag", e);
          }
        }
      }

      if (requested && isSafeRedirectPath(requested)) {
        leaveCallback(requested);
        return;
      }

      const inviteFlow = sessionUser?.user_metadata?.invite_flow;
      const invitePasswordSet = sessionUser?.user_metadata?.invite_password_set === true;
      const hasGoogleIdentity = Array.isArray(sessionUser?.identities)
        ? sessionUser.identities.some((identity: { provider?: string }) => identity.provider === "google")
        : false;

      const needsInvitePassword =
        typeof inviteFlow === "string" &&
        inviteFlow.startsWith("admin_") &&
        !invitePasswordSet &&
        !hasGoogleIdentity;

      if (needsInvitePassword) {
        try {
          const me = await api.getMe();
          if (me?.onboarding_completed === true) {
            await supabase.auth
              .updateUser({
                data: { invite_password_set: true, invite_flow: null },
              })
              .catch(() => undefined);
          } else {
            clearStoredCallbackParams();
            navigate("/invite/create-password", { replace: true });
            return;
          }
        } catch {
          clearStoredCallbackParams();
          navigate("/invite/create-password", { replace: true });
          return;
        }
      } else if (
        typeof inviteFlow === "string" &&
        inviteFlow.startsWith("admin_") &&
        (invitePasswordSet || hasGoogleIdentity)
      ) {
        await supabase.auth
          .updateUser({
            data: { invite_password_set: true, invite_flow: null },
          })
          .catch(() => undefined);
      }

      // One destination rule for every callback type. The old six branches here keyed off
      // flow, user_metadata and signup_type and disagreed with each other; the server
      // profile is now the only authority, with a bounded recovery inside.
      leaveCallback(await resolveDestinationFromServer());
  };

  useEffect(() => {
    // Check if we are in the middle of an auth flow (Code Exchange or Implicit Flow)
    const searchParams = new URLSearchParams(location.search);
    const hasCode = searchParams.get('code');
    const hasHash =
      location.hash.includes('access_token') ||
      location.hash.includes('error') ||
      location.hash.includes('type=recovery') ||
      location.hash.includes('type=invite');

    // If there is a code or hash, we MUST wait for handleCallback to process the new session
    // DO NOT redirect based on potential stale user session
    if (hasCode || hasHash) {
      console.log("AuthCallback: Detected new auth flow parameters. Waiting for processing...");
      return;
    }

    // Avoid navigating with a stale `user` while AuthProvider is still hydrating.
    if (isAuthLoading) return;

    // Immediate redirect if user is already loaded AND we are not processing
    // the auth callback tokens (code/access_token) yet.
    if (user) {
      const searchParams = new URLSearchParams(location.search);
      const hasCode = !!searchParams.get('code');
      const hasHash =
        location.hash.includes('access_token') ||
        location.hash.includes('error') ||
        location.hash.includes('type=recovery') ||
        location.hash.includes('type=invite');

      if (hasCode || hasHash) return;

      // If user has the "email_verification_required" flag, clear it since they just
      // completed an auth flow. Trial only, as before — this is metadata upkeep, not routing.
      if (user.user_metadata?.email_verification_required) {
        const signupType = user.user_metadata?.signup_type;
        if (signupType === 'trial') {
          supabase.auth.updateUser({
            data: { email_verification_required: false }
          }).then(() => {
            toast.success("Email verified successfully!");
          });
        }
      }

      // An explicitly requested redirect still wins; it is caller intent, not a guess.
      const requested = getRequestedRedirect();
      if (requested) {
        leaveCallback(requested);
        return;
      }

      // Otherwise wait for the authoritative profile. No session-age or metadata guessing.
      if (!profile) {
        // Bounded: AuthContext has already exhausted getMe x3 + /users/init by the time it
        // reports 'error'. Hand off to ProtectedRoute rather than sit here forever.
        if (profileStatus === 'error') leaveCallback(APP_DASHBOARD_ROUTE);
        return;
      }

      leaveCallback(resolvePostAuthRoute(profile) ?? APP_DASHBOARD_ROUTE);
    }
  }, [user, profile, profileStatus, navigate, location.search, location.hash, isAuthLoading]);

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
          const { data, error: exchangeError } = await exchangeCodeForSessionDeduped(code);
          if (exchangeError) throw exchangeError;
          
          if (data?.session) {
            const onceKey = `pkce:${code}`;
            if (!shouldFinalizeOAuthOnce(onceKey)) return;
            setStatus('success');
            await finalizeVerification(data.session.user);
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
            const onceKey = `implicit:${accessToken.slice(0, 24)}`;
            if (!shouldFinalizeOAuthOnce(onceKey)) return;
            setStatus('success');
            await finalizeVerification(data.session.user);
            return;
          }
      }

      // No PKCE code / hash tokens: Supabase may have already persisted the session while the URL
      // still shows ?redirect=&via=verification&flow=plan (especially after refresh).
      if (!code && !(accessToken && refreshToken)) {
        persistCallbackParamsFromUrl();
        const sp = new URLSearchParams(location.search);
        const st = readStoredCallbackParams();
        const viaNoCode = sp.get("via") || st.via;
        if (viaNoCode === "verification") {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user) {
            const onceKey = `verify-no-code:${session.user.id}`;
            if (!shouldFinalizeOAuthOnce(onceKey)) return;
            setStatus("success");
            await finalizeVerification(session.user);
            return;
          }
        }
        return;
      }

      // 5. Verify Session Establishment (PKCE path fell through without returning)
      const checkSession = async (attempts = 0) => {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          const onceKey = `session:${session.user.id}`;
          if (!shouldFinalizeOAuthOnce(onceKey)) return;
          setStatus('success');
          await finalizeVerification(session.user);
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
