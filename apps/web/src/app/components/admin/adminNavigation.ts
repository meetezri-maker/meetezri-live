/**
 * Admin sidebar navigation configuration.
 *
 * Extracted verbatim from AdminLayoutNew.tsx so that features adding a nav entry touch a
 * small dedicated file instead of the 567-line layout component. Behaviour, ordering, role
 * filtering and icons are unchanged.
 */
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Brain,
  Building2,
  CheckCircle2,
  Crown,
  Database,
  DollarSign,
  Eye,
  FileText,
  Flag,
  Globe,
  Heart,
  LayoutDashboard,
  Lock,
  MessageSquare,
  Moon,
  Package,
  Server,
  Settings,
  Shield,
  Target,
  Users,
  Zap,
} from "lucide-react";
export type AdminRole = "super_admin" | "org_admin" | "team_admin";

export interface NavSection {
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
export const NAVIGATION: NavSection[] = [
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
      { name: "Expert Reviews", href: "/admin/expert-reviews", icon: CheckCircle2, roles: ["super_admin", "org_admin"] },
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
