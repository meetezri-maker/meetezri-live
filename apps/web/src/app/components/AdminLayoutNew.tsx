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
} from "lucide-react";
import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "./ui/button";
import { useAuth } from "../contexts/AuthContext";

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
      { name: "Content Moderation", href: "/admin/content-moderation", icon: Shield, roles: ["super_admin", "org_admin"] },
    ],
  },
  {
    name: "Engagement",
    icon: Zap,
    roles: ["super_admin", "org_admin"],
    pages: [
      { name: "Nudge Management", href: "/admin/nudge-management", icon: Bell, roles: ["super_admin", "org_admin"] },
      { name: "Nudge Templates", href: "/admin/nudge-templates", icon: FileText, roles: ["super_admin", "org_admin"] },
      { name: "Nudge Scheduler", href: "/admin/nudge-scheduler", icon: LayoutDashboard, roles: ["super_admin", "org_admin"] },
      { name: "Nudge Performance", href: "/admin/nudge-performance", icon: BarChart3, roles: ["super_admin", "org_admin"] },
      { name: "Wellness Challenges", href: "/admin/wellness-challenges", icon: FileText, roles: ["super_admin", "org_admin"] },
      { name: "Badge Manager", href: "/admin/badge-manager", icon: FileText, roles: ["super_admin", "org_admin"] },
    ],
  },
  {
    name: "Communications",
    icon: Bell,
    roles: ["super_admin", "org_admin", "team_admin"],
    pages: [
      { name: "Notifications Center", href: "/admin/notifications-center", icon: Bell, roles: ["super_admin", "org_admin", "team_admin"] },
      { name: "Manual Notifications", href: "/admin/manual-notifications", icon: Bell, roles: ["super_admin", "org_admin"] },
      { name: "Email Templates", href: "/admin/email-templates", icon: FileText, roles: ["super_admin", "org_admin"] },
      { name: "Push Notifications", href: "/admin/push-notifications", icon: Bell, roles: ["super_admin", "org_admin"] },
      { name: "Support Tickets", href: "/admin/support-tickets", icon: FileText, roles: ["super_admin", "org_admin", "team_admin"] },
      { name: "Community Management", href: "/admin/community-management", icon: Users, roles: ["super_admin", "org_admin"] },
    ],
  },
  {
    name: "Monitoring",
    icon: Eye,
    roles: ["super_admin", "org_admin", "team_admin"],
    pages: [
      { name: "Live Sessions", href: "/admin/live-sessions-monitor", icon: Eye, roles: ["super_admin", "org_admin", "team_admin"] },
      { name: "Session Recordings", href: "/admin/session-recordings", icon: Eye, roles: ["super_admin", "org_admin"] },
      { name: "Activity Monitor", href: "/admin/activity-monitor", icon: Eye, roles: ["super_admin", "org_admin"] },
      { name: "System Health", href: "/admin/system-health-enhanced", icon: Server, roles: ["super_admin"] },
      { name: "System Health Dashboard", href: "/admin/system-health-dashboard", icon: Server, roles: ["super_admin"] },
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

const roleInfo: Record<AdminRole, { name: string; gradient: string; icon: any }> = {
  super_admin: {
    name: "Super Admin",
    gradient: "from-purple-500 to-pink-500",
    icon: Crown,
  },
  org_admin: {
    name: "Organization Admin",
    gradient: "from-blue-500 to-cyan-500",
    icon: Building2,
  },
  team_admin: {
    name: "Team Admin",
    gradient: "from-green-500 to-emerald-500",
    icon: Users,
  },
};

export function AdminLayoutNew({ children }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Use profile role or fallback
  const adminRole: AdminRole = (profile?.role as AdminRole) || "team_admin";
  const adminEmail = user?.email || "admin@ezri.com";
  
  // Find which section contains the current page
  const findCurrentSection = () => {
    const currentSection = NAVIGATION.find(section => 
      section.pages.some(page => location.pathname === page.href)
    );
    return currentSection?.name || null;
  };

  // Start with only the current section expanded
  const [expandedSection, setExpandedSection] = useState<string | null>(() => {
    // Try to load from localStorage first
    const saved = localStorage.getItem("adminExpandedSection");
    if (saved) return saved;
    // Otherwise, expand the section containing current page
    return findCurrentSection();
  });

  // Update expanded section when navigating to a new page
  useEffect(() => {
    const currentSection = findCurrentSection();
    if (currentSection && !expandedSection) {
      setExpandedSection(currentSection);
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    await signOut();
    localStorage.removeItem("adminExpandedSection");
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

  // Fallback if roleInfo doesn't match adminRole (e.g. invalid role in DB)
  const currentRoleInfo = roleInfo[adminRole] || roleInfo["team_admin"];
  const RoleIcon = currentRoleInfo.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-slate-50">
      {/* Mobile backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* SIDEBAR - Apple Style: Clean & Minimal */}
      <aside className="fixed top-0 left-0 bottom-0 w-64 bg-gray-50/80 backdrop-blur-xl border-r border-gray-200/60 z-50 overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header - Compact */}
          <div className="px-5 py-4 border-b border-gray-200/60">
            <Link to={`/admin/super-admin-dashboard`} className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <Heart className="w-4 h-4 text-white" fill="white" />
              </div>
              <div>
                <h1 className="font-semibold text-sm">Ezri Admin</h1>
                <p className="text-xs text-gray-500">{currentRoleInfo.name}</p>
              </div>
            </Link>
          </div>

          {/* Navigation - Clean List */}
          <nav className="flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-0.5">
              {filteredNav.map((section) => {
                const isExpanded = expandedSection === section.name;
                const SectionIcon = section.icon;
                const hasActiveChild = section.pages.some(
                  page => location.pathname === page.href
                );

                return (
                  <div key={section.name}>
                    {/* Section Header - Minimal */}
                    <button
                      onClick={() => toggleSection(section.name)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium group ${
                        hasActiveChild
                          ? "bg-primary/10 text-primary"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <SectionIcon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 text-left">{section.name}</span>
                      <ChevronRight
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                      />
                    </button>

                    {/* Pages - Smooth Slide */}
                    {isExpanded && (
                      <div className="ml-6 mt-0.5 mb-1 space-y-0.5">
                        {section.pages.map(page => {
                          const isActive = location.pathname === page.href;

                          return (
                            <Link
                              key={page.href}
                              to={page.href}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors text-xs ${
                                isActive
                                  ? "bg-primary text-white font-medium"
                                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                              }`}
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
          <div className="px-3 py-3 border-t border-gray-200/60">
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg mb-2 border border-gray-200/60">
              <div className={`w-7 h-7 bg-gradient-to-br ${currentRoleInfo.gradient} rounded-full flex items-center justify-center text-white font-semibold text-xs`}>
                {adminEmail.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-xs truncate">Admin</p>
                <p className="text-xs text-gray-500 truncate">{adminEmail}</p>
              </div>
            </div>
            
            {/* Exit to User App */}
            <Link 
              to="/" 
              className="w-full flex items-center justify-start gap-2 px-3 py-2 text-xs h-8 text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg mb-2 transition-all font-medium"
            >
              <Globe className="w-3.5 h-3.5" />
              Exit to User App
            </Link>
            
            <Button 
              onClick={handleLogout} 
              variant="ghost" 
              size="sm"
              className="w-full justify-start gap-2 text-xs h-8 text-gray-700 text:bg-gray-500"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="pl-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-lg border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-8 py-4">
            <h2 className="text-lg font-bold text-gray-800">Admin Portal</h2>
            <Link to="/app/dashboard" className="text-sm text-primary hover:underline font-medium">
              View User App →
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
