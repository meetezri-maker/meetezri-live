import { ReactNode, useEffect, useState, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { 
  Home, 
  Video, 
  Heart, 
  BookOpen, 
  User,
  Bell,
  Settings,
  LogOut,
  TrendingUp,
  Moon,
  Target,
  Clock,
  Sparkles,
  CreditCard,
  AlertTriangle
} from "lucide-react";
import { MobileBottomNav } from "./MobileBottomNav";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationsContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { unreadCount } = useNotifications();

  const appearanceStorageKey = useMemo(() => {
    if (typeof window === "undefined") return "ezri_appearance_settings";
    if (!user?.id) return "ezri_appearance_settings";
    return `ezri_appearance_settings_${user.id}`;
  }, [user?.id]);

  const [appearance, setAppearance] = useState<{
    backgroundStyle: string;
    compactMode: boolean;
    theme: string;
  }>(() => {
    // Initial state setup to avoid flash of wrong theme
    const defaults = {
      backgroundStyle: "gradient",
      compactMode: false,
      theme: "light"
    };

    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
      return defaults;
    }

    // Try to get user-specific key if possible, otherwise fallback
    // Note: This runs before useMemo for appearanceStorageKey, so we replicate the logic slightly
    // but simplified since we might not have user object fully ready yet.
    // However, since this component is usually behind ProtectedRoute, user should be loaded.
    // But hooks order matters. We can't access appearanceStorageKey here as it's defined above.
    // We'll try to read it dynamically.
    
    // We can't easily access the computed appearanceStorageKey inside the useState initializer
    // because it depends on `user` which might change. 
    // BUT, we can try to read from the most likely key if we have the user ID from props or context.
    
    // Actually, let's just use the `appearanceStorageKey` computed value in a useEffect, 
    // but for INITIAL render, we can try to guess or just read the generic one if user ID isn't ready.
    // If we are behind ProtectedRoute, user.id IS ready.
    
    // Let's rely on the fact that `appearanceStorageKey` is computed from `user.id`.
    // If `user` is present, we can construct the key.
    
    const key = user?.id ? `ezri_appearance_settings_${user.id}` : "ezri_appearance_settings";
    const saved = window.localStorage.getItem(key);
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          backgroundStyle: parsed.backgroundStyle || "gradient",
          compactMode: Boolean(parsed.compactMode),
          theme: parsed.theme || "light"
        };
      } catch {
        return defaults;
      }
    }
    
    return defaults;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
      return;
    }
    const saved = window.localStorage.getItem(appearanceStorageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setAppearance({
          backgroundStyle: parsed.backgroundStyle || "gradient",
          compactMode: Boolean(parsed.compactMode),
          theme: parsed.theme || "light"
        });
      } catch {
        setAppearance({
          backgroundStyle: "gradient",
          compactMode: false,
          theme: "light"
        });
      }
    }
  }, [appearanceStorageKey]);

  // Apply theme class when appearance.theme changes
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    const cleanup = () => {
      root.classList.remove("dark");
    };

    if (appearance.theme === "auto") {
      if (typeof window === "undefined" || !window.matchMedia) {
        root.classList.remove("dark");
        return cleanup;
      }
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const applyTheme = (isDark: boolean) => {
        if (isDark) root.classList.add("dark");
        else root.classList.remove("dark");
      };
      applyTheme(mediaQuery.matches);
      
      const listener = (event: MediaQueryListEvent) => applyTheme(event.matches);
      mediaQuery.addEventListener("change", listener);
      return () => {
        mediaQuery.removeEventListener("change", listener);
        cleanup();
      };
    }

    if (appearance.theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    
    // Do NOT return cleanup here. ThemeManager handles removal on route change.
    // Returning cleanup causes flash when this component updates or re-renders.
  }, [appearance.theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (event: Event) => {
      const custom = event as CustomEvent<any>;
      const detail = custom.detail || {};
      setAppearance({
        backgroundStyle: detail.backgroundStyle || "gradient",
        compactMode: Boolean(detail.compactMode),
        theme: detail.theme || "light"
      });
    };

    window.addEventListener("ezri-appearance-change", handler as EventListener);

    return () => {
      window.removeEventListener("ezri-appearance-change", handler as EventListener);
    };
  }, []);

  const navItems = [
    { path: "/app/dashboard", icon: Home, label: "Home" },
    { path: "/app/session-lobby", icon: Video, label: "Session" },
    { path: "/app/mood-checkin", icon: Heart, label: "Mood" },
    { path: "/app/journal", icon: BookOpen, label: "Journal" },
    { path: "/app/user-profile", icon: User, label: "Profile" }
  ];

  const isActive = (path: string) => location.pathname === path;

  const backgroundClass =
    appearance.backgroundStyle === "solid"
      ? "bg-gray-50 dark:bg-slate-950"
      : appearance.backgroundStyle === "pattern"
      ? "bg-gray-50 dark:bg-slate-950"
      : "bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950";

  const mainPaddingClass = appearance.compactMode
    ? "pb-12 sm:pb-4 sm:pl-64"
    : "pb-20 sm:pb-6 sm:pl-72";

  // Check both standard Supabase verification AND our custom metadata flag
  const isUnverified = user && (!user.email_confirmed_at || user.user_metadata?.email_verification_required);

  const resendVerification = async () => {
    if (!user?.email) return;
    
    // Explicitly determine the base URL
    let origin = window.location.origin;
    
    // Safety override: If we are on the production domain, ensure we use the HTTPS production URL
    // This guards against any weird browser behavior or proxy issues
    if (origin.includes('meetezri-live-web.vercel.app') || origin.includes('vercel.app')) {
      origin = 'https://meetezri-live-web.vercel.app';
    }
    
    const redirectUrl = `${origin}/auth/callback?redirect=${encodeURIComponent('/app/user-profile')}`;
    
    // Debugging Alert - Remove after fixing
    // alert(`Resending to: ${redirectUrl}`);
    console.log("Resending verification to:", redirectUrl);
    console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL); // Debugging check

    try {
      // If the user is technically "confirmed" (due to Confirm Email OFF setting) but flagged as unverified,
      // we send a Magic Link instead of a signup verification email.
      if (user.email_confirmed_at && user.user_metadata?.email_verification_required) {
        const { error } = await supabase.auth.signInWithOtp({
          email: user.email,
          options: {
            emailRedirectTo: redirectUrl,
            // data: { ... } // Optional: could pass data to know it's a verification flow
          }
        });
        if (error) throw error;
        toast.success("Verification link sent! Please check your email and click the sign-in link to verify.");
      } else {
        // Standard flow for genuinely unconfirmed users
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: user.email,
          options: {
            emailRedirectTo: redirectUrl
          }
        });
        if (error) throw error;
        toast.success("Verification email sent. Check your inbox.");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send verification email.");
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className={`h-screen overflow-auto ${backgroundClass} flex flex-col`}>
      {/* Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="bg-white/80 dark:bg-slate-900/90 backdrop-blur-lg border-b border-gray-200 dark:border-slate-700 sticky top-0 z-40 shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ 
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                duration: 3,
                repeat: Infinity,
                repeatDelay: 5
              }}
              className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-white font-bold"
            >
              E
            </motion.div>
            <h1 className="font-bold text-xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Ezri
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/app/notifications">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors relative group"
              >
                <Bell className="w-5 h-5 text-gray-600 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </motion.button>
            </Link>
            
            <Link to="/app/settings">
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors group"
              >
                <Settings className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-black dark:group-hover:text-white transition-colors" />
              </motion.button>
            </Link>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleLogout}
              className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5 text-red-600" />
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto ${mainPaddingClass}`}>
        {isUnverified && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 m-4 rounded shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700 dark:text-yellow-200">
                  Your email address is not verified. Please check your inbox for the verification link.
                  <button 
                    onClick={resendVerification} 
                    className="font-medium underline ml-2 hover:text-yellow-600 dark:hover:text-yellow-100"
                  >
                    Resend verification email
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}
        {children}
      </main>

      {/* Bottom Navigation - Mobile Only */}
      <MobileBottomNav />

      {/* Desktop Sidebar - Hidden on mobile */}
      <div className="hidden sm:block fixed left-0 top-16 bottom-0 w-64 bg-white/80 dark:bg-slate-900/90 backdrop-blur-lg border-r border-gray-200 dark:border-slate-700 z-30">
        <nav className="p-4 space-y-2">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <Link key={item.path} to={item.path}>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02, x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    active
                      ? "bg-gradient-to-r from-primary to-secondary dark:from-blue-600 dark:to-indigo-600 text-white shadow-lg"
                      : "hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </motion.div>
              </Link>
            );
          })}

          {/* Additional Desktop Nav Items */}
          <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mt-4 space-y-2">
            <Link to="/app/session-history">
              <motion.div
                whileHover={{ scale: 1.02, x: 5 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200 transition-all"
              >
                <Clock className="w-5 h-5" />
                <span className="font-medium">Session History</span>
              </motion.div>
            </Link>

            <Link to="/app/wellness-tools">
              <motion.div
                whileHover={{ scale: 1.02, x: 5 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200 transition-all"
              >
                <Sparkles className="w-5 h-5" />
                <span className="font-medium">Wellness Tools</span>
              </motion.div>
            </Link>
            
            <Link to="/app/progress">
              <motion.div
                whileHover={{ scale: 1.02, x: 5 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200 transition-all"
              >
                <TrendingUp className="w-5 h-5" />
                <span className="font-medium">Progress</span>
              </motion.div>
            </Link>

            <Link to="/app/sleep-tracker">
              <motion.div
                whileHover={{ scale: 1.02, x: 5 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200 transition-all"
              >
                <Moon className="w-5 h-5" />
                <span className="font-medium">Sleep Tracker</span>
              </motion.div>
            </Link>

            <Link to="/app/billing">
              <motion.div
                whileHover={{ scale: 1.02, x: 5 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 dark:hover:from-emerald-900 dark:hover:to-emerald-800 text-gray-700 dark:text-gray-200 hover:text-green-700 transition-all border border-transparent hover:border-green-200 dark:hover:border-emerald-600"
              >
                <CreditCard className="w-5 h-5" />
                <span className="font-medium">Billing & Credits</span>
              </motion.div>
            </Link>

            <Link to="/app/habit-tracker">
              <motion.div
                whileHover={{ scale: 1.02, x: 5 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200 transition-all"
              >
                <Target className="w-5 h-5" />
                <span className="font-medium">Habit Tracker</span>
              </motion.div>
            </Link>

            <motion.button
              onClick={handleLogout}
              whileHover={{ scale: 1.02, x: 5 }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/40 text-red-600 transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </motion.button>
          </div>
        </nav>
      </div>
    </div>
  );
}
