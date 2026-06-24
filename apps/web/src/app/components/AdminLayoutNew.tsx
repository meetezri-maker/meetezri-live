import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  BarChart3,
  FileText,
  Bell,
  Menu,
  X,
  Heart,
  LogOut,
  Crown,
  Building2,
  Shield,
  Globe,
  Server,
  DollarSign,
  Flag,
  Eye,
  Settings,
  Lock,
  Database,
  Zap,
  ChevronDown,
  ChevronRight,
  Brain,
  MessageSquare,
  Package,
  Layout,
  Moon,
  Target,
} from "lucide-react";
import { ReactNode, useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { BrandLogo } from "./BrandLogo";
import { useAuth } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { modalDestructiveButton } from "@/lib/modalTheme";
import { useAdminThemeScope } from "@/app/admin/useAdminThemeScope";
import {
  adminPageAtmosphere,
  adminPageRoot,
  adminPageGlowTop,
  adminPageGlowTeal,
  adminPageVignette,
  adminSidebar,
  adminTopBar,
  adminNavSection,
  adminNavSectionActive,
  adminNavLink,
  adminNavLinkActive,
  adminRoleBadge,
  adminBtnGhost,
} from "@/app/admin/adminPageChrome";
import { cn } from "@/lib/utils";
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

interface AdminLayoutProps {
  children: ReactNode;
}

type AdminRole = "super_admin" | "org_admin" | "team_admin";

interface NavSection {
  name: string;
  icon: any;
  roles: AdminRole[];
  pages: {
    name: string;
    href: string;
    icon: any;
    roles: AdminRole[];
  }[];
}

// COMPREHENSIVE NAVIGATION - ALL 69 PAGES
const NAVIGATION: NavSection[] = [
  {
    name: "Dashboards",
    icon: LayoutDashboard,
    roles: ["super_admin", "org_admin", "team_admin"],
    pages: [
      { name: "Super Admin Dashboard", href: "/admin/super-admin-dashboard", icon: Crown, roles: ["super_admin"] },
      { name: "Org Admin Dashboard", href: "/admin/org-admin-dashboard", icon: Building2, roles: ["org_admin"] },
      { name: "Team Admin Dashboard", href: "/admin/team-admin-dashboard", icon: Shield, roles: ["team_admin"] },
    ],
  },
  {
    name: "User Management",
    icon: Users,
    roles: ["super_admin", "org_admin", "team_admin"],
    pages: [
      { name: "All Users", href: "/admin/user-management", icon: Users, roles: ["super_admin", "org_admin", "team_admin"] },
      { name: "Mood Analytics", href: "/admin/user-analytics/moods", icon: Heart, roles: ["super_admin", "org_admin", "team_admin"] },
      { name: "Journal Analytics", href: "/admin/user-analytics/journals", icon: FileText, roles: ["super_admin", "org_admin", "team_admin"] },
      { name: "Sleep Logs", href: "/admin/user-analytics/sleep", icon: Moon, roles: ["super_admin", "org_admin", "team_admin"] },
      { name: "Habit Tracker", href: "/admin/user-analytics/habits", icon: Target, roles: ["super_admin", "org_admin", "team_admin"] },
      { name: "User Segmentation", href: "/admin/user-segmentation", icon: Users, roles: ["super_admin", "org_admin"] },
      { name: "Team Management", href: "/admin/team-role-management", icon: Shield, roles: ["super_admin", "org_admin"] },
      { name: "Companion Management", href: "/admin/companion-management", icon: Users, roles: ["super_admin", "org_admin"] },
    ],
  },
  {
    name: "AI Avatar System",
    icon: Brain,
    roles: ["super_admin", "org_admin"],
    pages: [
      { name: "AI Avatar Manager", href: "/admin/ai-avatar-manager", icon: Brain, roles: ["super_admin", "org_admin"] },
      { name: "Avatar Selection Analytics", href: "/admin/avatar-selection-analytics", icon: BarChart3, roles: ["super_admin", "org_admin"] },
      { name: "Conversation Transcripts", href: "/admin/conversation-transcripts", icon: MessageSquare, roles: ["super_admin", "org_admin", "team_admin"] },
    ],
  },
  {
    name: "Crisis Management",
    icon: AlertTriangle,
    roles: ["super_admin", "org_admin", "team_admin"],
    pages: [
      { name: "Crisis Dashboard", href: "/admin/crisis-dashboard", icon: LayoutDashboard, roles: ["super_admin", "org_admin", "team_admin"] },
      { name: "Crisis Monitoring", href: "/admin/crisis-monitoring", icon: AlertTriangle, roles: ["super_admin", "org_admin", "team_admin"] },
      { name: "Crisis Events", href: "/admin/crisis-event-details", icon: Eye, roles: ["super_admin", "org_admin"] },
      { name: "Follow-Up Queue", href: "/admin/crisis-follow-up-queue", icon: FileText, roles: ["super_admin", "org_admin", "team_admin"] },
      { name: "Crisis Protocol", href: "/admin/crisis-protocol", icon: FileText, roles: ["super_admin", "org_admin"] },
    ],
  },
  {
    name: "Analytics",
    icon: BarChart3,
    roles: ["super_admin", "org_admin", "team_admin"],
    pages: [
      { name: "Platform Analytics", href: "/admin/analytics", icon: Globe, roles: ["super_admin"] },
      { name: "Usage Overview", href: "/admin/usage-overview", icon: BarChart3, roles: ["super_admin", "org_admin"] },
      { name: "Usage Analytics", href: "/admin/usage-analytics", icon: BarChart3, roles: ["super_admin", "org_admin"] },
      { name: "Session Analytics", href: "/admin/session-analytics", icon: BarChart3, roles: ["super_admin", "org_admin", "team_admin"] },
      { name: "Engagement Metrics", href: "/admin/engagement-metrics", icon: BarChart3, roles: ["super_admin", "org_admin"] },
      { name: "Retention Metrics", href: "/admin/retention-metrics", icon: BarChart3, roles: ["super_admin", "org_admin"] },
      { name: "Feature Adoption", href: "/admin/feature-adoption", icon: BarChart3, roles: ["super_admin", "org_admin"] },
      { name: "Onboarding Analytics", href: "/admin/onboarding-analytics", icon: BarChart3, roles: ["super_admin", "org_admin"] },
      { name: "Reports & Analytics", href: "/admin/reports-analytics", icon: BarChart3, roles: ["super_admin", "org_admin", "team_admin"] },
    ],
  },
  {
    name: "Content",
    icon: FileText,
    roles: ["super_admin", "org_admin"],
    pages: [
      { name: "Content Management", href: "/admin/content-management", icon: FileText, roles: ["super_admin", "org_admin"] },
      { name: "Wellness Tools CMS", href: "/admin/wellness-tools-cms", icon: Heart, roles: ["super_admin", "org_admin"] },
      { name: "Wellness Content CMS", href: "/admin/wellness-content-cms", icon: FileText, roles: ["super_admin", "org_admin"] },
      { name: "Content Library", href: "/admin/wellness-content-library", icon: FileText, roles: ["super_admin", "org_admin"] },
      { name: "Tool Editor", href: "/admin/wellness-tool-editor", icon: FileText, roles: ["super_admin", "org_admin"] },
      { name: "Exercise Library", href: "/admin/exercise-library", icon: FileText, roles: ["super_admin", "org_admin"] },
      { name: "Content Performance", href: "/admin/content-performance", icon: BarChart3, roles: ["super_admin", "org_admin"] },
    ],
  },
  {
    name: "Engagement",
    icon: Zap,
    roles: ["super_admin", "org_admin"],
    pages: [
      { name: "Nudge Center", href: "/admin/nudge-center", icon: Bell, roles: ["super_admin", "org_admin"] },
      { name: "Gamification", href: "/admin/gamification", icon: BarChart3, roles: ["super_admin", "org_admin"] },
    ],
  },
  {
    name: "Communications",
    icon: Bell,
    roles: ["super_admin", "org_admin", "team_admin"],
    pages: [
      { name: "Communications Hub", href: "/admin/communications", icon: Bell, roles: ["super_admin", "org_admin", "team_admin"] },
      { name: "Support Tickets", href: "/admin/support-tickets", icon: FileText, roles: ["super_admin", "org_admin", "team_admin"] },
    ],
  },
  {
    name: "Monitoring",
    icon: Eye,
    roles: ["super_admin", "org_admin", "team_admin"],
    pages: [
      { name: "Live Talk It Out", href: "/admin/live-sessions-monitor", icon: Eye, roles: ["super_admin", "org_admin", "team_admin"] },
      { name: "Session Recordings", href: "/admin/session-recordings", icon: Eye, roles: ["super_admin", "org_admin"] },
      { name: "System Health", href: "/admin/system-health-enhanced", icon: Server, roles: ["super_admin"] },
      { name: "Error Tracking", href: "/admin/error-tracking", icon: AlertTriangle, roles: ["super_admin"] },
    ],
  },
  {
    name: "System",
    icon: Settings,
    roles: ["super_admin", "org_admin"],
    pages: [
      { name: "System Settings", href: "/admin/system-settings-enhanced", icon: Settings, roles: ["super_admin"] },
      { name: "Global Configuration", href: "/admin/global-configuration", icon: Globe, roles: ["super_admin"] },
      { name: "Feature Flags", href: "/admin/feature-flags", icon: Flag, roles: ["super_admin"] },
      { name: "API Management", href: "/admin/api-management", icon: Server, roles: ["super_admin"] },
      { name: "Integration Settings", href: "/admin/integration-settings", icon: Settings, roles: ["super_admin", "org_admin"] },
      { name: "Branding & Customization", href: "/admin/branding-customization", icon: Settings, roles: ["super_admin", "org_admin"] },
      { name: "A/B Testing", href: "/admin/ab-testing", icon: BarChart3, roles: ["super_admin", "org_admin"] },
    ],
  },
  {
    name: "Billing",
    icon: DollarSign,
    roles: ["super_admin", "org_admin"],
    pages: [
      { name: "Billing Overview", href: "/admin/billing", icon: DollarSign, roles: ["super_admin", "org_admin"] },
      { name: "Subscriptions", href: "/admin/billing-subscriptions", icon: DollarSign, roles: ["super_admin", "org_admin"] },
      { name: "Package Manager", href: "/admin/package-manager", icon: Package, roles: ["super_admin", "org_admin"] },
      { name: "PAYG Transactions", href: "/admin/payg-transactions", icon: Zap, roles: ["super_admin", "org_admin"] },
    ],
  },
  {
    name: "Security & Compliance",
    icon: Lock,
    roles: ["super_admin", "org_admin"],
    pages: [
      { name: "Security Settings", href: "/admin/security-settings", icon: Lock, roles: ["super_admin"] },
      { name: "Compliance Dashboard", href: "/admin/compliance-dashboard", icon: Shield, roles: ["super_admin", "org_admin"] },
      { name: "HIPAA Compliance", href: "/admin/hipaa-compliance", icon: Shield, roles: ["super_admin"] },
      { name: "Data Privacy", href: "/admin/data-privacy-controls", icon: Lock, roles: ["super_admin"] },
      { name: "Data Retention", href: "/admin/data-retention-privacy", icon: Database, roles: ["super_admin"] },
      { name: "Audit Logs", href: "/admin/audit-logs", icon: FileText, roles: ["super_admin", "org_admin"] },
      { name: "System Logs", href: "/admin/system-logs", icon: FileText, roles: ["super_admin"] },
      { name: "Legal Documentation", href: "/admin/legal-documentation", icon: FileText, roles: ["super_admin"] },
    ],
  },
  {
    name: "Data",
    icon: Database,
    roles: ["super_admin"],
    pages: [
      { name: "Data Export", href: "/admin/data-export", icon: Database, roles: ["super_admin"] },
      { name: "Backup & Recovery", href: "/admin/backup-recovery", icon: Database, roles: ["super_admin"] },
    ],
  },
];

function isNavPageActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

function getActiveSectionName(sections: NavSection[], pathname: string): string | null {
  let match: { name: string; hrefLength: number } | null = null;

  for (const section of sections) {
    for (const page of section.pages) {
      if (!isNavPageActive(pathname, page.href)) continue;
      if (!match || page.href.length > match.hrefLength) {
        match = { name: section.name, hrefLength: page.href.length };
      }
    }
  }

  return match?.name ?? null;
}

const roleInfo: Record<AdminRole, { name: string; accent: string; icon: any }> = {
  super_admin: {
    name: "Super Admin",
    accent: "var(--admin-secondary)",
    icon: Crown,
  },
  org_admin: {
    name: "Organization Admin",
    accent: "var(--admin-primary)",
    icon: Building2,
  },
  team_admin: {
    name: "Team Admin",
    accent: "var(--admin-accent)",
    icon: Users,
  },
};

export function AdminLayoutNew({ children }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut, hasRole, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdmin = hasRole(["super_admin", "org_admin", "team_admin"]);
  
  if (!isLoading && profile && !isAdmin) {
    return <Navigate to="/error/permission-denied" replace />;
  }

  // Use explicit role only; no permissive fallback for non-admin roles
  const adminRole: AdminRole = profile?.role === "super_admin" || profile?.role === "org_admin" || profile?.role === "team_admin"
    ? profile.role
    : "team_admin";
  const adminEmail = user?.email || "admin@ezri.com";
  
  // Find which section contains the current page (longest href match wins)
  const findCurrentSection = () =>
    getActiveSectionName(NAVIGATION, location.pathname);

  // Start with only the current section expanded
  const [expandedSection, setExpandedSection] = useState<string | null>(() => {
    // Try to load from localStorage first
    const saved = localStorage.getItem("adminExpandedSection");
    if (saved) return saved;
    // Otherwise, expand the section containing current page
    return findCurrentSection();
  });
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Keep the section that contains the current page expanded
  useEffect(() => {
    const currentSection = findCurrentSection();
    if (currentSection) {
      setExpandedSection(currentSection);
      localStorage.setItem("adminExpandedSection", currentSection);
    }
  }, [location.pathname]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    await signOut();
    localStorage.removeItem("adminExpandedSection");
    setShowLogoutModal(false);
    navigate("/admin/login");
  };

  const toggleSection = (sectionName: string) => {
    setExpandedSection(prev => {
      // If clicking the same section, collapse it
      const newSection = prev === sectionName ? null : sectionName;
      // Save to localStorage
      if (newSection) {
        localStorage.setItem("adminExpandedSection", newSection);
      } else {
        localStorage.removeItem("adminExpandedSection");
      }
      return newSection;
    });
  };

  // Filter navigation based on role
  const filteredNav = NAVIGATION
    .filter(section => section.roles.includes(adminRole))
    .map(section => ({
      ...section,
      pages: section.pages.filter(page => page.roles.includes(adminRole)),
    }))
    .filter(section => section.pages.length > 0);

  const activeSectionName = useMemo(
    () => getActiveSectionName(filteredNav, location.pathname),
    [filteredNav, location.pathname]
  );

  // Fallback if roleInfo doesn't match adminRole (e.g. invalid role in DB)
  const currentRoleInfo = roleInfo[adminRole] || roleInfo["team_admin"];

  useAdminThemeScope(true);

  return (
    <div className={adminPageRoot}>
      <div className={adminPageAtmosphere} aria-hidden>
        <div className={adminPageGlowTop} />
        <div className={adminPageGlowTeal} />
        <div className={adminPageVignette} />
      </div>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="admin-mobile-sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* SIDEBAR — matte panel, environmental depth */}
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 z-50 w-64 overflow-hidden transition-transform duration-300 ease-in-out",
          adminSidebar,
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0"
        )}
      >
        <div className="relative flex h-full flex-col">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(167,139,250,0.08),transparent_70%)]"
            aria-hidden
          />
          {/* Header */}
          <div className="relative flex items-center justify-between border-b border-[color:var(--admin-border)] px-5 py-4">
            <Link to={`/admin/super-admin-dashboard`} className="flex min-w-0 items-center gap-2.5">
              <BrandLogo heightClass="h-8" themeAware />
              <div className="min-w-0">
                <h1 className="text-sm font-semibold tracking-tight text-[var(--admin-text)]">Solace Admin</h1>
                <span className={adminRoleBadge}>{currentRoleInfo.name}</span>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="shrink-0 rounded-lg p-2 text-[var(--admin-text-muted)] transition-colors hover:bg-white/10 hover:text-[var(--admin-text)] lg:hidden"
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation - Clean List */}
          <nav className="flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-0.5">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="mx-0.5 h-9 animate-pulse rounded-lg bg-white/[0.06]" />
                ))
              ) : filteredNav.map((section) => {
                const isExpanded = expandedSection === section.name;
                const SectionIcon = section.icon;
                const isSectionSelected = section.name === activeSectionName;

                return (
                  <div key={section.name}>
                    {/* Section Header - Minimal */}
                    <button
                      onClick={() => toggleSection(section.name)}
                      className={cn(
                        adminNavSection,
                        isSectionSelected && adminNavSectionActive
                      )}
                    >
                      <SectionIcon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0",
                          isSectionSelected ? "text-violet-300" : "text-zinc-500"
                        )}
                      />
                      <span className="flex-1 truncate text-left">{section.name}</span>
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform duration-200",
                          isExpanded && "rotate-90",
                          isSectionSelected ? "text-violet-300/80" : "text-zinc-500"
                        )}
                      />
                    </button>

                    {/* Pages - Smooth Slide */}
                    {isExpanded && (
                      <div className="ml-6 mt-0.5 mb-1 space-y-0.5">
                        {section.pages.map(page => {
                          const isActive = isNavPageActive(location.pathname, page.href);

                          return (
                            <Link
                              key={page.href}
                              to={page.href}
                              onClick={() => setSidebarOpen(false)}
                              className={cn(adminNavLink, isActive && adminNavLinkActive)}
                            >
                              <span className="truncate">{page.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>

          {/* Footer - Minimal */}
          <div className="relative border-t border-[color:var(--admin-border)] px-3 py-3">
            <div className="admin-card mb-2 flex items-center gap-2 rounded-xl px-3 py-2">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-[#041018]"
                style={{ background: currentRoleInfo.accent }}
              >
                {adminEmail.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[var(--admin-text)]">Admin</p>
                <p className="truncate text-xs text-[var(--admin-text-muted)]">{adminEmail}</p>
              </div>
            </div>
            
            {/* Exit to User App */}
            {/* <Link 
              to="/" 
              className="w-full flex items-center justify-start gap-2 px-3 py-2 text-xs h-8 text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg mb-2 transition-all font-medium"
            >
              <Globe className="w-3.5 h-3.5" />
              Exit to User App
            </Link> */}
            
            <button
              type="button"
              onClick={handleLogout}
              className={cn(adminBtnGhost, "h-8 w-full justify-start")}
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="relative min-h-screen w-full lg:pl-64">
        <header className={adminTopBar}>
          <div className="flex items-center gap-3 px-4 py-4 lg:px-8">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex shrink-0 items-center justify-center rounded-lg p-2 text-[var(--admin-text-muted)] transition-colors hover:bg-white/10 hover:text-[var(--admin-text)] lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h2 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-[var(--admin-text)]">
              Admin Portal
            </h2>
            {/* <Link to="/app/dashboard" className="text-sm text-primary hover:underline font-medium">
              View User App →
            </Link> */}
          </div>
        </header>

        {/* Page Content */}
        <main className="relative p-4 lg:p-8">{children}</main>
      </div>

      <AlertDialog open={showLogoutModal} onOpenChange={setShowLogoutModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to log out of the admin portal?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLogout} className={modalDestructiveButton}>
              Log Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
