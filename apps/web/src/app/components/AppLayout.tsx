import { ReactNode, useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { 
  Bell,
  Settings,
  LogOut,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { MobileBottomNav } from "./MobileBottomNav";
import { BrandLogo } from "./BrandLogo";
import { SolaceSidebar } from "@/app/solace";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationsContext";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const { signOut, user, profile } = useAuth();
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
    accentColor: string;
  }>(() => {
    // Initial state setup to avoid flash of wrong theme
    const defaults = {
      backgroundStyle: "gradient",
      compactMode: false,
      theme: "light",
      accentColor: "pink"
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
          theme: parsed.theme || "light",
          accentColor: parsed.accentColor || "pink"
        };
      } catch {
        return defaults;
      }
    }
    
    return defaults;
  });
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

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
          theme: parsed.theme || "light",
          accentColor: parsed.accentColor || "pink"
        });
      } catch {
        setAppearance({
          backgroundStyle: "gradient",
          compactMode: false,
          theme: "light",
          accentColor: "pink"
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
      // Merge so partial events (e.g. theme-only) do not wipe compactMode / accent.
      setAppearance((prev) => ({
        backgroundStyle:
          typeof detail.backgroundStyle === "string"
            ? detail.backgroundStyle
            : prev.backgroundStyle,
        compactMode:
          typeof detail.compactMode === "boolean" ? detail.compactMode : prev.compactMode,
        theme: typeof detail.theme === "string" ? detail.theme : prev.theme,
        accentColor:
          typeof detail.accentColor === "string" ? detail.accentColor : prev.accentColor,
      }));
    };

    window.addEventListener("ezri-appearance-change", handler as EventListener);

    return () => {
      window.removeEventListener("ezri-appearance-change", handler as EventListener);
    };
  }, []);

  const compact = appearance.compactMode;
  const headerHeightClass = compact ? "h-14" : "h-16";
  const headerInnerClass = compact ? "px-3 sm:px-4" : "px-4 sm:px-6";
  /** Mobile bottom nav + optional breathing room; desktop clears for Solace sidebar */
  const mainPaddingClass = compact
    ? "pb-[5.25rem] sm:pb-5 sm:pl-[280px]"
    : "pb-[5.75rem] sm:pb-8 sm:pl-[280px]";

  // Prefer backend-derived verification (source of truth), fall back to Supabase session flags.
  // Supabase user metadata can remain stale in the client session after verification.
  const isUnverified =
    (profile
      ? profile.needs_email_verification === true || profile.email_verified !== true
      : false) ||
    (user ? (!user.email_confirmed_at || user.user_metadata?.email_verification_required) : false);

  const resendVerification = async () => {
    if (!user?.email) return;
    try {
      await api.resendVerificationEmail();
      toast.success("Verification link sent! Please check your inbox.");
    } catch (error: any) {
      toast.error(error.message || "Failed to send verification email.");
    }
  };

  const handleLogout = async () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setLogoutLoading(true);
    try {
      await signOut();
      setShowLogoutModal(false);
      navigate("/login");
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <div className="solace-app flex h-dvh max-h-dvh flex-col overflow-hidden bg-[var(--solace-bg)] text-[var(--solace-text)]">
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="sticky top-0 z-40 border-b border-white/[0.08] bg-[color-mix(in_oklab,var(--solace-bg-elevated)_92%,transparent)] shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl"
      >
        <div
          className={`mx-auto flex items-center justify-between ${headerInnerClass} ${headerHeightClass}`}
        >
          <Link to="/app/dashboard" className="flex items-center gap-2">
            <motion.div
              animate={{
                rotate: [0, 6, -6, 0],
                scale: [1, 1.03, 1],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                repeatDelay: 6,
              }}
              className="flex items-center justify-center"
            >
              <BrandLogo heightClass={compact ? "h-8" : "h-9"} />
            </motion.div>
          </Link>

          <div className="flex items-center gap-1">
            <Link to="/app/notifications">
              <motion.button
                type="button"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                className="relative rounded-full p-2.5 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.55)]" />
                )}
              </motion.button>
            </Link>

            <Link to="/app/settings">
              <motion.button
                type="button"
                whileHover={{ scale: 1.06, rotate: 90 }}
                whileTap={{ scale: 0.94 }}
                className="rounded-full p-2.5 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100"
              >
                <Settings className="h-5 w-5" />
              </motion.button>
            </Link>

            <motion.button
              type="button"
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={handleLogout}
              className="rounded-full p-2.5 text-rose-300/90 transition-colors hover:bg-rose-500/15"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </motion.button>
          </div>
        </div>
      </motion.header>

      <main
        className={`solace-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain antialiased ${mainPaddingClass}`}
      >
        {isUnverified && (
          <div className="m-4 rounded-xl border border-amber-500/25 bg-amber-950/35 p-4 shadow-[0_0_32px_rgba(245,158,11,0.12)]">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
              <p className="text-sm text-amber-100/90">
                Your email address is not verified. Please check your inbox for the verification link.
                <button
                  type="button"
                  onClick={resendVerification}
                  className="ml-2 font-medium text-amber-200 underline underline-offset-2 hover:text-white"
                >
                  Resend verification email
                </button>
              </p>
            </div>
          </div>
        )}
        {children}
      </main>

      <MobileBottomNav compact={compact} />

      {/* Environmental sidebar — desktop / tablet */}
      <aside
        className={`pointer-events-none fixed bottom-3 left-3 z-30 hidden w-[var(--solace-sidebar-w)] sm:block ${compact ? "top-[calc(3.5rem+0.5rem)]" : "top-[calc(4rem+0.5rem)]"}`}
      >
        <div className="pointer-events-auto flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[color-mix(in_oklab,var(--solace-panel)_96%,transparent)] shadow-[var(--solace-glow-purple),0_20px_60px_-28px_rgba(0,0,0,0.75)] backdrop-blur-xl">
          <SolaceSidebar />
        </div>
      </aside>

      <AlertDialog
        open={showLogoutModal}
        onOpenChange={(open) => {
          if (logoutLoading) return;
          setShowLogoutModal(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to log out of your account?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={logoutLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLogout}
              className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
              disabled={logoutLoading}
            >
              {logoutLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Logging out...
                </span>
              ) : (
                "Log Out"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
