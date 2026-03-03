import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  BarChart3,
  FileText,
  PieChart,
  Settings,
  ScrollText,
  Headphones,
  Bell,
  Menu,
  X,
  Heart,
  LogOut,
  ChevronRight,
  Crown,
  Building2,
  Shield,
  Globe,
  Server,
  DollarSign,
  Flag,
  MessageSquare,
  Calendar,
  TrendingUp,
  Activity,
  Zap,
  Lock,
  Database,
  Mail,
  UserCheck,
  BookOpen,
  Target,
  Award,
  Sparkles,
  LineChart,
  Eye,
  Download,
  Code,
  Palette,
  FileCheck,
  ClipboardList,
  UserPlus,
  Brain,
  Briefcase,
  ChevronDown,
} from "lucide-react";
import { Button } from "./ui/button";

interface AdminLayoutProps {
  children: ReactNode;
}

type AdminRole = "super" | "org" | "team";

interface NavItem {
  name: string;
  href?: string;
  icon: any;
  roles: AdminRole[];
  children?: NavItem[];
}

// Comprehensive navigation structure
const navigationItems: NavItem[] = [
  // DASHBOARDS
  {
    name: "Dashboards",
    icon: LayoutDashboard,
    roles: ["super", "org", "team"],
    children: [
      { name: "Super Admin Dashboard", href: "/admin/super-admin-dashboard", icon: Crown, roles: ["super"] },
      { name: "Org Admin Dashboard", href: "/admin/org-admin-dashboard", icon: Building2, roles: ["org"] },
      { name: "Team Admin Dashboard", href: "/admin/team-admin-dashboard", icon: Shield, roles: ["team"] },
      { name: "Admin Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, roles: ["super", "org", "team"] },
    ],
  },

  // USER MANAGEMENT
  {
    name: "User Management",
    icon: Users,
    roles: ["super", "org", "team"],
    children: [
      { name: "All Users", href: "/admin/user-management", icon: Users, roles: ["super", "org", "team"] },
      { name: "User Details", href: "/admin/user-details-enhanced", icon: UserCheck, roles: ["super", "org", "team"] },
      { name: "User Segmentation", href: "/admin/user-segmentation", icon: Target, roles: ["super", "org"] },
      { name: "Team Management", href: "/admin/team-role-management", icon: Shield, roles: ["super", "org"] },
      { name: "Companion Management", href: "/admin/companion-management", icon: Briefcase, roles: ["super", "org"] },
    ],
  },

  // CRISIS & SAFETY
  {
    name: "Crisis Management",
    icon: AlertTriangle,
    roles: ["super", "org", "team"],
    children: [
      { name: "Crisis Dashboard", href: "/admin/crisis-dashboard", icon: Activity, roles: ["super", "org", "team"] },
      { name: "Crisis Monitoring", href: "/admin/crisis-monitoring", icon: AlertTriangle, roles: ["super", "org", "team"] },
      { name: "Crisis Events", href: "/admin/crisis-event-details", icon: Eye, roles: ["super", "org"] },
      { name: "Follow-Up Queue", href: "/admin/crisis-follow-up-queue", icon: ClipboardList, roles: ["super", "org", "team"] },
      { name: "Crisis Protocol", href: "/admin/crisis-protocol", icon: BookOpen, roles: ["super", "org"] },
    ],
  },

  // SAFETY & MONITORING
  {
    name: "Safety & Monitoring",
    icon: Shield,
    roles: ["super", "org", "team"],
    children: [
      { name: "Safety Events Dashboard", href: "/admin/safety-events", icon: AlertTriangle, roles: ["super", "org", "team"] },
      { name: "Safety Event Details", href: "/admin/safety-event-details", icon: Eye, roles: ["super", "org", "team"] },
      { name: "Conversation Transcripts", href: "/admin/conversation-transcripts", icon: MessageSquare, roles: ["super", "org"] },
    ],
  },

  // ANALYTICS & REPORTS
  {
    name: "Analytics",
    icon: BarChart3,
    roles: ["super", "org", "team"],
    children: [
      { name: "Platform Analytics", href: "/admin/analytics", icon: Globe, roles: ["super"] },
      { name: "Usage Overview", href: "/admin/usage-overview", icon: TrendingUp, roles: ["super", "org"] },
      { name: "Usage Analytics", href: "/admin/usage-analytics", icon: LineChart, roles: ["super", "org"] },
      { name: "Session Analytics", href: "/admin/session-analytics", icon: Activity, roles: ["super", "org", "team"] },
      { name: "Engagement Metrics", href: "/admin/engagement-metrics", icon: Heart, roles: ["super", "org"] },
      { name: "Retention Metrics", href: "/admin/retention-metrics", icon: UserCheck, roles: ["super", "org"] },
      { name: "Feature Adoption", href: "/admin/feature-adoption", icon: Sparkles, roles: ["super", "org"] },
      { name: "Onboarding Analytics", href: "/admin/onboarding-analytics", icon: UserPlus, roles: ["super", "org"] },
      { name: "Reports & Analytics", href: "/admin/reports-analytics", icon: PieChart, roles: ["super", "org", "team"] },
    ],
  },

  // CONTENT MANAGEMENT
  {
    name: "Content",
    icon: FileText,
    roles: ["super", "org"],
    children: [
      { name: "Content Management", href: "/admin/content-management", icon: FileText, roles: ["super", "org"] },
      { name: "Wellness Tools CMS", href: "/admin/wellness-tools-cms", icon: Heart, roles: ["super", "org"] },
      { name: "Wellness Content CMS", href: "/admin/wellness-content-cms", icon: Sparkles, roles: ["super", "org"] },
      { name: "Content Library", href: "/admin/wellness-content-library", icon: BookOpen, roles: ["super", "org"] },
      { name: "Tool Editor", href: "/admin/wellness-tool-editor", icon: FileText, roles: ["super", "org"] },
      { name: "Exercise Library", href: "/admin/exercise-library", icon: Activity, roles: ["super", "org"] },
      { name: "Content Performance", href: "/admin/content-performance", icon: TrendingUp, roles: ["super", "org"] },
      { name: "Content Moderation", href: "/admin/content-moderation", icon: Shield, roles: ["super", "org"] },
    ],
  },

  // ENGAGEMENT & NUDGES
  {
    name: "Engagement",
    icon: Zap,
    roles: ["super", "org"],
    children: [
      { name: "Nudge Management", href: "/admin/nudge-management", icon: Bell, roles: ["super", "org"] },
      { name: "Nudge Templates", href: "/admin/nudge-templates", icon: FileText, roles: ["super", "org"] },
      { name: "Nudge Scheduler", href: "/admin/nudge-scheduler", icon: Calendar, roles: ["super", "org"] },
      { name: "Nudge Performance", href: "/admin/nudge-performance", icon: BarChart3, roles: ["super", "org"] },
      { name: "Wellness Challenges", href: "/admin/wellness-challenges", icon: Target, roles: ["super", "org"] },
      { name: "Badge Manager", href: "/admin/badge-manager", icon: Award, roles: ["super", "org"] },
    ],
  },

  // NOTIFICATIONS & COMMS
  {
    name: "Communications",
    icon: Bell,
    roles: ["super", "org", "team"],
    children: [
      { name: "Notifications Center", href: "/admin/notifications-center", icon: Bell, roles: ["super", "org", "team"] },
      { name: "Manual Notifications", href: "/admin/manual-notifications", icon: MessageSquare, roles: ["super", "org"] },
      { name: "Email Templates", href: "/admin/email-templates", icon: Mail, roles: ["super", "org"] },
      { name: "Push Notifications", href: "/admin/push-notifications", icon: Zap, roles: ["super", "org"] },
      { name: "Support Tickets", href: "/admin/support-tickets", icon: Headphones, roles: ["super", "org", "team"] },
      { name: "Community Management", href: "/admin/community-management", icon: Users, roles: ["super", "org"] },
    ],
  },

  // MONITORING & SESSIONS
  {
    name: "Monitoring",
    icon: Eye,
    roles: ["super", "org", "team"],
    children: [
      { name: "Live Sessions", href: "/admin/live-sessions-monitor", icon: Activity, roles: ["super", "org", "team"] },
      { name: "Session Recordings", href: "/admin/session-recordings", icon: Eye, roles: ["super", "org"] },
      { name: "Activity Monitor", href: "/admin/activity-monitor", icon: TrendingUp, roles: ["super", "org"] },
      { name: "System Health", href: "/admin/system-health-enhanced", icon: Server, roles: ["super"] },
      { name: "System Health Dashboard", href: "/admin/system-health-dashboard", icon: Activity, roles: ["super"] },
      { name: "Error Tracking", href: "/admin/error-tracking", icon: AlertTriangle, roles: ["super"] },
    ],
  },

  // SYSTEM & CONFIGURATION
  {
    name: "System",
    icon: Settings,
    roles: ["super", "org"],
    children: [
      { name: "System Settings", href: "/admin/system-settings-enhanced", icon: Settings, roles: ["super"] },
      { name: "Global Configuration", href: "/admin/global-configuration", icon: Globe, roles: ["super"] },
      { name: "Feature Flags", href: "/admin/feature-flags", icon: Flag, roles: ["super"] },
      { name: "API Management", href: "/admin/api-management", icon: Code, roles: ["super"] },
      { name: "Integration Settings", href: "/admin/integration-settings", icon: Zap, roles: ["super", "org"] },
      { name: "Branding & Customization", href: "/admin/branding-customization", icon: Palette, roles: ["super", "org"] },
      { name: "A/B Testing", href: "/admin/ab-testing", icon: Brain, roles: ["super", "org"] },
    ],
  },

  // BILLING & REVENUE
  {
    name: "Billing",
    icon: DollarSign,
    roles: ["super", "org"],
    children: [
      { name: "Billing Overview", href: "/admin/billing", icon: DollarSign, roles: ["super", "org"] },
      { name: "Subscriptions", href: "/admin/billing-subscriptions", icon: Crown, roles: ["super", "org"] },
    ],
  },

  // SECURITY & COMPLIANCE
  {
    name: "Security & Compliance",
    icon: Lock,
    roles: ["super", "org"],
    children: [
      { name: "Security Settings", href: "/admin/security-settings", icon: Lock, roles: ["super"] },
      { name: "Compliance Dashboard", href: "/admin/compliance-dashboard", icon: FileCheck, roles: ["super", "org"] },
      { name: "HIPAA Compliance", href: "/admin/hipaa-compliance", icon: Shield, roles: ["super"] },
      { name: "Data Privacy", href: "/admin/data-privacy-controls", icon: Lock, roles: ["super"] },
      { name: "Data Retention", href: "/admin/data-retention-privacy", icon: Database, roles: ["super"] },
      { name: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText, roles: ["super", "org"] },
      { name: "System Logs", href: "/admin/system-logs", icon: FileText, roles: ["super"] },
      { name: "Legal Documentation", href: "/admin/legal-documentation", icon: FileCheck, roles: ["super"] },
    ],
  },

  // DATA MANAGEMENT
  {
    name: "Data",
    icon: Database,
    roles: ["super"],
    children: [
      { name: "Data Export", href: "/admin/data-export", icon: Download, roles: ["super"] },
      { name: "Backup & Recovery", href: "/admin/backup-recovery", icon: Database, roles: ["super"] },
    ],
  },
];

const roleInfo = {
  super: {
    name: "Super Admin",
    gradient: "from-purple-500 to-pink-500",
    icon: Crown,
  },
  org: {
    name: "Organization Admin",
    gradient: "from-blue-500 to-cyan-500",
    icon: Building2,
  },
  team: {
    name: "Team Admin",
    gradient: "from-green-500 to-emerald-500",
    icon: Users,
  },
};

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminRole, setAdminRole] = useState<AdminRole>("super");
  const [adminEmail, setAdminEmail] = useState("admin@ezri.com");
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "Dashboards",
    "User Management", 
    "Crisis Management",
    "Analytics"
  ]);

  useEffect(() => {
    // Get admin role from localStorage
    const storedRole = localStorage.getItem("adminRole") as AdminRole;
    const storedEmail = localStorage.getItem("adminEmail");
    if (storedRole) setAdminRole(storedRole);
    if (storedEmail) setAdminEmail(storedEmail);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("adminRole");
    localStorage.removeItem("adminEmail");
    navigate("/admin/login");
  };

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionName)
        ? prev.filter(name => name !== sectionName)
        : [...prev, sectionName]
    );
  };

  // Filter navigation based on role
  const navigation = navigationItems
    .map((item) => ({
      ...item,
      children: item.children?.filter((child) => child.roles.includes(adminRole)),
    }))
    .filter((item) => item.roles.includes(adminRole) && item.children && item.children.length > 0);

  const currentRoleInfo = roleInfo[adminRole];
  const RoleIcon = currentRoleInfo.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-slate-50">
      {/* Mobile sidebar backdrop */}
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

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ x: sidebarOpen ? 0 : "-100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed top-0 left-0 bottom-0 w-72 bg-white border-r border-gray-200 z-50 lg:translate-x-0 lg:z-auto shadow-xl"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <Link to={`/admin/dashboard/${adminRole}`} className="flex items-center gap-3">
              <motion.div
                whileHover={{ rotate: 360, scale: 1.1 }}
                transition={{ duration: 0.5 }}
                className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg"
              >
                <Heart className="w-6 h-6 text-white" fill="white" />
              </motion.div>
              <div>
                <h1 className="font-bold text-lg">Ezri Admin</h1>
                <p className="text-xs text-muted-foreground">{currentRoleInfo.name}</p>
              </div>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Role Badge */}
          <div className="p-4">
            <div className={`p-3 rounded-lg bg-gradient-to-br ${currentRoleInfo.gradient} text-white`}>
              <div className="flex items-center gap-2 mb-1">
                <RoleIcon className="w-4 h-4" />
                <span className="text-sm font-medium">{currentRoleInfo.name}</span>
              </div>
              <p className="text-xs opacity-90">Access Level: {adminRole.toUpperCase()}</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-1">
              {navigation.map((section, sectionIndex) => {
                const isExpanded = expandedSections.includes(section.name);
                const SectionIcon = section.icon;
                
                // Check if any child is active
                const hasActiveChild = section.children?.some(
                  (child) => child.href && location.pathname === child.href
                );

                return (
                  <motion.div
                    key={section.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: sectionIndex * 0.02 }}
                  >
                    {/* Section Header */}
                    <button
                      onClick={() => toggleSection(section.name)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
                        hasActiveChild
                          ? "bg-primary/10 text-primary"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <SectionIcon className="w-4 h-4" />
                      <span className="flex-1 text-left text-sm font-semibold">
                        {section.name}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Section Children */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-gray-200 pl-2">
                            {section.children?.map((item, itemIndex) => {
                              const isActive = item.href && location.pathname === item.href;
                              const ItemIcon = item.icon;

                              return (
                                <motion.div
                                  key={item.name}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: itemIndex * 0.03 }}
                                >
                                  <Link
                                    to={item.href!}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm relative group ${
                                      isActive
                                        ? "bg-primary text-white shadow-md"
                                        : "text-gray-600 hover:bg-gray-100 hover:text-primary"
                                    }`}
                                  >
                                    <ItemIcon className="w-4 h-4 flex-shrink-0" />
                                    <span className="truncate">{item.name}</span>
                                    {isActive && (
                                      <motion.div
                                        layoutId="activeIndicator"
                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-white rounded-r"
                                      />
                                    )}
                                  </Link>
                                </motion.div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </nav>

          {/* Admin info & logout */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg mb-3">
              <div className={`w-10 h-10 bg-gradient-to-br ${currentRoleInfo.gradient} rounded-full flex items-center justify-center text-white font-bold`}>
                {adminEmail.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">Admin User</p>
                <p className="text-xs text-muted-foreground truncate">{adminEmail}</p>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full justify-start gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </motion.aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-200">
          <div className="flex items-center justify-between px-4 lg:px-8 py-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link
                  to="/"
                  className="text-sm text-primary hover:underline font-medium"
                >
                  View User App
                </Link>
              </motion.div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}