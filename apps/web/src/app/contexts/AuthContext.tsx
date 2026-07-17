import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { isPublicAuthPath } from '@/lib/publicAuthRoutes';
import { isSupabaseSessionExpiredLocally } from '@/lib/jwtUtils';
import { clearOAuthSignupIntent, readOAuthSignupIntent } from '@/lib/oauthSignupIntent';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  profileStatus: 'idle' | 'loading' | 'ready' | 'error';
  isLoading: boolean;
  signOut: () => Promise<void>;
  hasRole: (role: string | string[]) => boolean;
  refreshProfile: () => Promise<any>;
  updateProfileState: (profile: any) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [profileStatus, setProfileStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const lastUserIdRef = useRef<string | null>(null);
  const profileRef = useRef<any | null>(null);
  const profileFetchInFlightRef = useRef<Promise<any> | null>(null);
  profileRef.current = profile;

  const hasRole = (role: string | string[]) => {
    if (!profile?.role) return false;
    if (Array.isArray(role)) {
      return role.includes(profile.role);
    }
    return profile.role === role;
  };

  const applyAppearanceForUser = (targetUser: User | null) => {
    // Logic moved to AppLayout and ThemeManager to avoid conflicts
    return;
    /*
    try {
      if (typeof window === "undefined" || typeof document === "undefined") return;
      const root = document.documentElement;

      if (!targetUser?.id) {
        root.classList.remove("dark");
        root.style.setProperty("--accent", "#ec4899");
        window.dispatchEvent(
          new CustomEvent("ezri-appearance-change", {
            detail: {
              backgroundStyle: "gradient",
              compactMode: false
            }
          })
        );
        return;
      }
      // ... rest of logic
    } catch (error) {
      console.error("Failed to apply appearance settings:", error);
    }
    */
  };

  useEffect(() => {
    const maybeClearEmailVerificationRequired = async (sessionUser: User | null) => {
      if (!sessionUser) return;
      // Clear stale signup metadata once Supabase has confirmed the email.
      // Without this, password logins keep an old JWT flag and paid users get sent to /verify-email.
      try {
        const needsClear =
          (sessionUser.user_metadata as any)?.email_verification_required === true;
        const emailConfirmedAt = (sessionUser as any)?.email_confirmed_at;
        if (needsClear && emailConfirmedAt) {
          await supabase.auth.updateUser({
            data: { email_verification_required: false },
          });
        }
      } catch {
        // Best-effort only; do not block app navigation.
      }
    };

    // Hydrate session once; profile load is driven by onAuthStateChange only so we do not double-fetch /users/me.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.expires_at && isSupabaseSessionExpiredLocally(session.expires_at)) {
        await supabase.auth.signOut({ scope: 'local' });
        setSession(null);
        setUser(null);
        setIsLoading(false);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        lastUserIdRef.current = session.user.id;
        if (window.location.hash && window.location.hash.includes('error=')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        applyAppearanceForUser(session.user);
        // Login pages run their own post-auth flow; avoid racing /users/me with stale JWTs.
        if (typeof window !== 'undefined' && isPublicAuthPath(window.location.pathname)) {
          setIsLoading(false);
          return;
        }
        setIsLoading(true);
        maybeClearEmailVerificationRequired(session.user).finally(() => {
          void fetchProfile();
        });
      } else {
        handleAuthErrors();
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        applyAppearanceForUser(session.user);
        const incomingUserId = session.user.id;
        const lastUserId = lastUserIdRef.current;
        const isSameUser = lastUserId === incomingUserId;
        lastUserIdRef.current = incomingUserId;

        // Token refresh does not change profile; refetching here caused duplicate /users/me traffic.
        const shouldLoadProfile =
          event === 'SIGNED_IN' ||
          event === 'USER_UPDATED' ||
          (event === 'TOKEN_REFRESHED' && !profileRef.current);

        if (shouldLoadProfile) {
          if (typeof window !== 'undefined' && isPublicAuthPath(window.location.pathname)) {
            setIsLoading(false);
            return;
          }
          if (!isSameUser || !profileRef.current) {
            setIsLoading(true);
          }
          maybeClearEmailVerificationRequired(session.user).finally(() => {
            fetchProfile();
          });
        }
      } else {
        setProfile(null);
        setProfileStatus('idle');
        setIsLoading(false);
        lastUserIdRef.current = null;
        applyAppearanceForUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuthErrors = () => {
    const hash = window.location.hash;
    if (hash && hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1));
      const error = params.get('error');
      const errorCode = params.get('error_code');
      const errorDescription = params.get('error_description');

      if (error) {
        console.error('Auth Error:', error, errorDescription);
        
        if (errorCode === 'otp_expired') {
          toast.error('Email verification link has expired', {
            description: 'Please request a new verification link from the login page.',
            duration: 8000,
            action: {
              label: 'Go to Login',
              onClick: () => window.location.href = '/login'
            }
          });
        } else {
          toast.error('Authentication Error', {
            description: errorDescription?.replace(/\+/g, ' ') || 'An error occurred during authentication.',
            duration: 5000,
          });
        }
        
        // Clear the hash to prevent repeated errors
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  };

  const fetchProfile = () => {
    if (profileFetchInFlightRef.current) {
      return profileFetchInFlightRef.current;
    }

    if (!profileRef.current) {
      setProfileStatus('loading');
    }

    const request = (async () => {
      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const data = await api.getMe();
            setProfile(data);
            setProfileStatus('ready');
            return data;
          } catch (error: any) {
            if (error.message === 'Profile not found') {
              try {
                // Hand the OAuth signup intent to the server as it creates the profile.
                // Cleared only on success, so a failed init can safely retry with it.
                const signupIntent = readOAuthSignupIntent() ?? undefined;
                const newProfile = await api.initProfile(signupIntent);
                clearOAuthSignupIntent();
                setProfile(newProfile);
                setProfileStatus('ready');
                return newProfile;
              } catch (initError) {
                console.error('Failed to initialize profile:', initError);
                break;
              }
            }

            console.error('Error fetching profile:', error);
            if (attempt < 2) {
              api.clearMeCache();
              await new Promise((resolve) => window.setTimeout(resolve, 300 * (attempt + 1)));
              continue;
            }
          }
        }

        setProfileStatus(profileRef.current ? 'ready' : 'error');
        return null;
      } catch (error: any) {
        console.error('Error fetching profile:', error);
        setProfileStatus(profileRef.current ? 'ready' : 'error');
        return null;
      }
    })().finally(() => {
      profileFetchInFlightRef.current = null;
      setIsLoading(false);
    });

    profileFetchInFlightRef.current = request;
    return request;
  };

  useEffect(() => {
    if (!user || profile || profileStatus !== 'idle') return;
    void fetchProfile();
  }, [user, profile, profileStatus]);

  const refreshProfile = async () => {
    api.clearMeCache();
    return await fetchProfile();
  };

  const updateProfileState = (updatedProfile: any) => {
    setProfile(updatedProfile);
    setProfileStatus('ready');
  };

  const signOut = async () => {
    applyAppearanceForUser(null);
    await supabase.auth.signOut();
    setProfile(null);
    setProfileStatus('idle');
    setUser(null);
    setSession(null);

    // Clear plan-related client cache so next signup starts fresh
    try {
      window.localStorage.removeItem('selectedPlan');
      window.localStorage.removeItem('planPurchased');
    } catch {
      // Ignore storage errors (e.g. SSR or disabled storage)
    }
  };

  const value = {
    user,
    session,
    profile,
    profileStatus,
    isLoading,
    signOut,
    hasRole,
    refreshProfile,
    updateProfileState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
