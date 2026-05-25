import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, Outlet, useLocation } from "react-router-dom";
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
  applyAccentColorToDocument,
  applyThemeToDocument,
  resolveAppearanceTheme,
  type AppearanceTheme,
} from "@/app/pages/app/appearance-settings/appearanceConstants";
import { modalDestructiveButton } from "@/lib/modalTheme";
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

/**
 * Exactly one member shell per tree: sidebar, header, main scroll region, mobile nav.
 * Child routes render via `<Outlet />` — do not nest another AppLayout inside pages.
 */
export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user, profile } = useAuth();
  const { unreadCount } = useNotifications();

  /** Talk It Out session: no sidebar / bottom nav; main is edge-to-edge under the header. */
  const isActiveSessionRoute = location.pathname.startsWith("/app/active-session");

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
      theme: "dark",
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
          theme: resolveAppearanceTheme(parsed.theme, parsed.appearanceVersion),
          accentColor: parsed.accentColor || "pink",
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
          theme: resolveAppearanceTheme(parsed.theme, parsed.appearanceVersion),
          accentColor: parsed.accentColor || "pink",
        });
      } catch {
        setAppearance({
          backgroundStyle: "gradient",
          compactMode: false,
          theme: "dark",
          accentColor: "pink",
        });
      }
    }
  }, [appearanceStorageKey]);

  useEffect(() => {
    applyThemeToDocument(appearance.theme as AppearanceTheme);
  }, [appearance.theme]);

  useEffect(() => {
    applyAccentColorToDocument(appearance.accentColor);
  }, [appearance.accentColor]);

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
        theme:
          typeof detail.theme === "string"
            ? resolveAppearanceTheme(detail.theme, detail.appearanceVersion)
            : prev.theme,
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
  /** Mobile bottom nav fills <lg; Solace sidebar is lg+ only — avoids duplicated nav stacks (tablet). */
  const mainPaddingClass = isActiveSessionRoute
    ? "overflow-hidden p-0 pb-0 lg:pl-0"
    : compact
      ? "pb-[5.25rem] lg:pb-5 lg:pl-[280px]"
      : "pb-[5.75rem] lg:pb-8 lg:pl-[280px]";

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
        className="solace-app-header sticky top-0 z-40 border-b border-[color:var(--solace-border)] bg-[color-mix(in_oklab,var(--solace-bg-elevated)_92%,transparent)] shadow-[var(--solace-ds-shadow-cinematic)] backdrop-blur-xl"
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
              <BrandLogo heightClass={compact ? "h-8" : "h-9"} variant="onDark" />
            </motion.div>
          </Link>

          <div className="flex items-center gap-1">
            <Link to="/app/notifications">
              <motion.button
                type="button"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                className="relative rounded-full p-2.5 text-[var(--solace-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--solace-text)_6%,transparent)] hover:text-[var(--solace-text)]"
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
                className="rounded-full p-2.5 text-[var(--solace-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--solace-text)_6%,transparent)] hover:text-[var(--solace-text)]"
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
        className={`flex-1 min-h-0 antialiased ${mainPaddingClass} ${
          isActiveSessionRoute
            ? "flex flex-col overflow-hidden"
            : "solace-scroll overflow-y-auto overscroll-contain"
        }`}
      >
        {isUnverified && (
          <div className="solace-status-warning m-4 rounded-xl border p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
              <p className="text-sm">
                Your email address is not verified. Please check your inbox for the verification link.
                <button
                  type="button"
                  onClick={resendVerification}
                  className="ml-2 font-medium underline underline-offset-2 opacity-90 hover:opacity-100"
                >
                  Resend verification email
                </button>
              </p>
            </div>
          </div>
        )}
        <Outlet />
      </main>

      {!isActiveSessionRoute ? <MobileBottomNav compact={compact} /> : null}

      {/* Environmental sidebar — desktop / tablet */}
      {!isActiveSessionRoute ? (
        <aside
          className={`pointer-events-none fixed bottom-3 left-3 z-30 hidden w-[var(--solace-sidebar-w)] lg:block ${compact ? "top-[calc(3.5rem+0.5rem)]" : "top-[calc(4rem+0.5rem)]"}`}
        >
          <div className="solace-sidebar-shell pointer-events-auto flex h-full flex-col overflow-hidden rounded-2xl border bg-[color-mix(in_oklab,var(--solace-panel)_96%,transparent)] backdrop-blur-xl">
            <SolaceSidebar />
          </div>
        </aside>
      ) : null}

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
              className={modalDestructiveButton}
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
