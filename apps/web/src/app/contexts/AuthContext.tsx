import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  hasRole: (role: string | string[]) => boolean;
  refreshProfile: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // User is authenticated, clear any error hash
        if (window.location.hash && window.location.hash.includes('error=')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        applyAppearanceForUser(session.user);
        // Optimize: Don't wait for profile fetch to unblock UI
        setIsLoading(false);
        fetchProfile();
      } else {
        // No session, check for errors in URL
        handleAuthErrors();
        setIsLoading(false);
      }
    });

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        applyAppearanceForUser(session.user);
        // Optimize: Don't wait for profile fetch to unblock UI
        setIsLoading(false);
        fetchProfile();
      } else {
        setProfile(null);
        setIsLoading(false);
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

  const fetchProfile = async () => {
    try {
      const data = await api.getMe();
      setProfile(data);
      return data;
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      if (error.message === 'Profile not found') {
        try {
          // Attempt to initialize profile if it doesn't exist
          const newProfile = await api.initProfile();
          setProfile(newProfile);
          return newProfile;
        } catch (initError) {
          console.error('Failed to initialize profile:', initError);
          // Do not sign out here. Allow the user to proceed to onboarding
          // where the profile can be created via completeOnboarding.
        }
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    return await fetchProfile();
  };

  const signOut = async () => {
    applyAppearanceForUser(null);
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
  };

  const value = {
    user,
    session,
    profile,
    isLoading,
    signOut,
    hasRole,
    refreshProfile,
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
