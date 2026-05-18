import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { api } from "../../../lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { PhoneInput } from "../../components/ui/phone-input";
import { normalizeStoredPhoneForInput, isValidOptionalAppPhone } from "@/lib/normalizeStoredPhone";
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Shield,
  Search,
  UserPlus,
  Mail,
  Phone,
  Calendar,
  Activity,
  CheckCircle,
  Clock,
  Eye,
  X,
  Crown,
  Building2,
  Lock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  Loader2,
  UserCog,
  Key,
  Filter,
  MoreVertical,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type TeamMemberRow = {
  id: string;
  org_id: string;
  user_id: string;
  org_role: string;
  email: string;
  full_name: string;
  phone: string | null;
  profile_role: string;
  account_status: string | null;
  created_at: string;
  joined_org_at: string;
  session_count: number;
  last_active_at: string | null;
  permissions: string[];
  status: "active" | "inactive" | "pending";
};

type ActiveTab = "members" | "roles" | "invitations";

// ─── Role definitions with full permissions matrix ───────────────────────────

type Permission = {
  key: string;
  label: string;
  category: string;
};

const ALL_PERMISSIONS: Permission[] = [
  // Platform
  { key: "full-access", label: "Full Platform Access", category: "Platform" },
  { key: "system-settings", label: "System Settings", category: "Platform" },
  { key: "audit-logs", label: "Audit Logs", category: "Platform" },
  // Organization
  { key: "org-settings", label: "Organization Settings", category: "Organization" },
  { key: "team-management", label: "Team Management", category: "Organization" },
  { key: "user-management", label: "User Management", category: "Organization" },
  { key: "user-view", label: "View Users", category: "Organization" },
  // Operations
  { key: "session-access", label: "Session Access", category: "Operations" },
  { key: "support-access", label: "Support Access", category: "Operations" },
  { key: "analytics-view", label: "Analytics & Reports", category: "Operations" },
  // App
  { key: "app-user", label: "App User Only", category: "App" },
];

const PERMISSION_CATEGORIES = ["Platform", "Organization", "Operations", "App"];

type RoleDefinition = {
  key: string;
  title: string;
  description: string;
  color: string;
  bgGradient: string;
  icon: React.ElementType;
  permissions: string[];
  canAssign: string[];
};

const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    key: "super_admin",
    title: "Super Admin",
    description: "Full platform access across all organizations. Can assign organization admins and manage the entire system.",
    color: "text-purple-700",
    bgGradient: "from-purple-500 to-pink-500",
    icon: Crown,
    permissions: ["full-access", "system-settings", "user-management", "audit-logs"],
    canAssign: ["org_admin", "team_admin", "user"],
  },
  {
    key: "org_admin",
    title: "Organization Admin",
    description: "Manages one organization: users, team members, and org-scoped admin tools.",
    color: "text-blue-700",
    bgGradient: "from-blue-500 to-cyan-500",
    icon: Building2,
    permissions: ["org-settings", "user-management", "team-management", "analytics-view"],
    canAssign: ["team_admin", "user"],
  },
  {
    key: "team_admin",
    title: "Team Admin",
    description: "Operational access: sessions, support, and analytics. Scoped by organization permissions.",
    color: "text-indigo-700",
    bgGradient: "from-indigo-500 to-blue-500",
    icon: Shield,
    permissions: ["session-access", "user-view", "support-access", "analytics-view"],
    canAssign: [],
  },
  {
    key: "user",
    title: "User",
    description: "Standard app user. May belong to an organization without admin privileges.",
    color: "text-green-700",
    bgGradient: "from-green-500 to-emerald-500",
    icon: Users,
    permissions: ["app-user"],
    canAssign: [],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function profileRoleLabel(role: string): string {
  switch (role) {
    case "super_admin": return "Super Admin";
    case "org_admin": return "Organization Admin";
    case "team_admin": return "Team Admin";
    case "user": return "User";
    default: return role || "User";
  }
}

function getRoleDefinition(role: string): RoleDefinition {
  return ROLE_DEFINITIONS.find((r) => r.key === role) ?? ROLE_DEFINITIONS[3];
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "active": return "bg-green-100 text-green-700 border-green-200";
    case "inactive": return "bg-gray-100 text-gray-600 border-gray-200";
    case "pending": return "bg-amber-100 text-amber-700 border-amber-200";
    default: return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

function getRoleBadgeClass(role: string) {
  switch (role) {
    case "super_admin": return "bg-purple-100 text-purple-700 border-purple-200";
    case "org_admin": return "bg-blue-100 text-blue-700 border-blue-200";
    case "team_admin": return "bg-indigo-100 text-indigo-700 border-indigo-200";
    default: return "bg-green-100 text-green-700 border-green-200";
  }
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PermissionsMatrix({ highlighted }: { highlighted?: string[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 pr-4 font-semibold text-muted-foreground w-48">Permission</th>
            {ROLE_DEFINITIONS.map((role) => {
              const Icon = role.icon;
              return (
                <th key={role.key} className="text-center py-3 px-4 font-semibold min-w-[120px]">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${role.bgGradient} flex items-center justify-center`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xs">{role.title}</span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_CATEGORIES.map((cat) => {
            const perms = ALL_PERMISSIONS.filter((p) => p.category === cat);
            return perms.map((perm, idx) => (
              <tr
                key={perm.key}
                className={`border-b last:border-b-0 transition-colors ${
                  highlighted?.includes(perm.key) ? "bg-primary/5" : idx % 2 === 0 ? "bg-muted/20" : ""
                }`}
              >
                <td className="py-3 pr-4">
                  <div>
                    <p className="font-medium">{perm.label}</p>
                    {idx === 0 && <p className="text-xs text-muted-foreground">{cat}</p>}
                  </div>
                </td>
                {ROLE_DEFINITIONS.map((role) => {
                  const has = role.permissions.includes(perm.key);
                  return (
                    <td key={role.key} className="text-center py-3 px-4">
                      {has ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground/30 text-lg mx-auto block text-center">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

function RoleCard({ role, memberCount }: { role: RoleDefinition; memberCount: number }) {
  const Icon = role.icon;
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${role.bgGradient} flex items-center justify-center shadow-sm flex-shrink-0`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-bold text-lg">{role.title}</h3>
            <span className="text-sm text-muted-foreground">{memberCount} member{memberCount !== 1 ? "s" : ""}</span>
          </div>
          <p className="text-sm text-muted-foreground mb-3">{role.description}</p>

          <div className="flex flex-wrap gap-2 mb-3">
            {role.permissions.map((p) => {
              const perm = ALL_PERMISSIONS.find((a) => a.key === p);
              return (
                <span key={p} className="px-2 py-1 bg-primary/5 text-primary rounded-md text-xs font-medium border border-primary/10">
                  {perm?.label ?? p}
                </span>
              );
            })}
          </div>

          {role.canAssign.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Key className="w-3.5 h-3.5" />
              <span>Can assign: {role.canAssign.map(profileRoleLabel).join(", ")}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? "Hide" : "View"} full permissions matrix
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 pt-4 border-t">
                  <PermissionsMatrix highlighted={role.permissions} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TeamRoleManagement() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === "super_admin";

  const [activeTab, setActiveTab] = useState<ActiveTab>("members");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [org, setOrg] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [organizations, setOrganizations] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMemberRow | null>(null);

  // Add form
  const [addForm, setAddForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    profile_role: "team_admin" as "org_admin" | "team_admin" | "user",
  });
  const [addErrors, setAddErrors] = useState<Partial<Record<keyof typeof addForm, string>>>({});

  // Edit form
  const [editForm, setEditForm] = useState({
    phone: "",
    profile_role: "team_admin" as "org_admin" | "team_admin" | "user",
    account_status: "active",
    org_role: "",
  });

  // ─── Data loading ─────────────────────────────────────────────────────────

  const loadTeam = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.admin.getOrganizationTeam(selectedOrgId ?? undefined);
      setBannerMessage((data as { message?: string }).message ?? null);
      setOrg((data as { org: typeof org }).org ?? null);
      setOrganizations((data as { organizations?: typeof organizations }).organizations ?? []);
      setMembers((data as { members: TeamMemberRow[] }).members ?? []);
      if (isSuperAdmin && !selectedOrgId && (data as { org: typeof org }).org?.id) {
        setSelectedOrgId((data as { org: { id: string } }).org.id);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load team");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId, isSuperAdmin]);

  useEffect(() => { void loadTeam(); }, [loadTeam]);

  // ─── Derived data ─────────────────────────────────────────────────────────

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (m.full_name || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q) ||
        m.profile_role.toLowerCase().includes(q);
      const matchesRole = filterRole === "all" || m.profile_role === filterRole;
      const matchesStatus = filterStatus === "all" || m.status === filterStatus;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [members, searchQuery, filterRole, filterStatus]);

  const pendingMembers = useMemo(() => members.filter((m) => m.status === "pending"), [members]);
  const activeMembers = useMemo(() => members.filter((m) => m.status === "active"), [members]);

  const stats = useMemo(() => ({
    total: members.length,
    active: activeMembers.length,
    pending: pendingMembers.length,
    inactive: members.filter((m) => m.status === "inactive").length,
    superAdmins: members.filter((m) => m.profile_role === "super_admin").length,
    orgAdmins: members.filter((m) => m.profile_role === "org_admin").length,
    teamAdmins: members.filter((m) => m.profile_role === "team_admin").length,
    users: members.filter((m) => m.profile_role === "user").length,
  }), [members, activeMembers, pendingMembers]);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    ROLE_DEFINITIONS.forEach((r) => {
      counts[r.key] = members.filter((m) => m.profile_role === r.key).length;
    });
    return counts;
  }, [members]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const validateAdd = () => {
    const errors: Partial<Record<keyof typeof addForm, string>> = {};
    if (!addForm.full_name.trim()) errors.full_name = "Full name is required";
    if (!addForm.email.trim()) errors.email = "Email is required";
    if (addForm.phone && !isValidOptionalAppPhone(addForm.phone)) {
      errors.phone = "Enter valid phone with country code (exactly 12 digits)";
    }
    return errors;
  };

  const handleAddMember = async () => {
    const errors = validateAdd();
    if (Object.keys(errors).length > 0) {
      setAddErrors(errors);
      return;
    }
    setSaving(true);
    try {
      await api.admin.addOrganizationTeamMember({
        org_id: isSuperAdmin ? selectedOrgId ?? undefined : undefined,
        email: addForm.email.trim(),
        full_name: addForm.full_name.trim(),
        phone: addForm.phone.trim() || undefined,
        profile_role: addForm.profile_role,
      });
      toast.success("Invitation sent — they'll receive an email to set up their account.");
      setShowAddModal(false);
      setAddForm({ full_name: "", email: "", phone: "", profile_role: "team_admin" });
      setAddErrors({});
      await loadTeam();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to add member";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (m: TeamMemberRow) => {
    setSelectedMember(m);
    setEditForm({
      phone: normalizeStoredPhoneForInput(m.phone ?? ""),
      profile_role: (["org_admin", "team_admin", "user"].includes(m.profile_role)
        ? m.profile_role
        : "team_admin") as "org_admin" | "team_admin" | "user",
      account_status: m.account_status === "inactive" ? "inactive" : "active",
      org_role: m.org_role ?? "",
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedMember) return;
    if (editForm.phone && !isValidOptionalAppPhone(editForm.phone)) {
      toast.error("Enter a valid phone with country code (exactly 12 digits), or leave blank");
      return;
    }
    setSaving(true);
    try {
      await api.admin.updateOrganizationTeamMember(
        selectedMember.id,
        { org_id: isSuperAdmin ? selectedOrgId ?? undefined : undefined },
        {
          phone: editForm.phone.trim() || undefined,
          profile_role: editForm.profile_role,
          account_status: editForm.account_status,
          org_role: editForm.org_role.trim() || undefined,
        }
      );
      toast.success("Member updated successfully");
      setShowEditModal(false);
      await loadTeam();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to update member";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!selectedMember) return;
    setSaving(true);
    try {
      await api.admin.removeOrganizationTeamMember(selectedMember.id, isSuperAdmin ? selectedOrgId ?? undefined : undefined);
      toast.success(`${selectedMember.full_name || selectedMember.email} removed from organization`);
      setShowRemoveModal(false);
      setShowViewModal(false);
      setShowEditModal(false);
      setSelectedMember(null);
      await loadTeam();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to remove member";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const displayName = (m: TeamMemberRow) => m.full_name || m.email || "Unknown User";

  // ─── Loading skeleton ─────────────────────────────────────────────────────

  if (loading && members.length === 0) {
    return (
      <AdminLayoutNew>
        <div className="space-y-6 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted" />
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded w-64" />
              <div className="h-4 bg-muted rounded w-48" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-muted rounded-xl" />)}
          </div>
          <div className="h-12 bg-muted rounded-xl" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted rounded-xl" />)}
          </div>
        </div>
      </AdminLayoutNew>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayoutNew>
      <div className="space-y-6">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <UserCog className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Team & Role Management</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {org ? (
                    <>Organization: <span className="font-medium text-foreground">{org.name}</span></>
                  ) : (
                    "Manage team members and access roles"
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {isSuperAdmin && organizations.length > 0 && (
                <select
                  className="px-3 py-2 border rounded-lg bg-background text-sm"
                  value={selectedOrgId ?? ""}
                  onChange={(e) => setSelectedOrgId(e.target.value || null)}
                >
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => void loadTeam()} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button type="button" className="gap-2" onClick={() => setShowAddModal(true)}>
                <UserPlus className="w-4 h-4" />
                Add Member
              </Button>
            </div>
          </div>
        </motion.div>

        {/* ── Banner ── */}
        {bannerMessage && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{bannerMessage}</span>
          </div>
        )}

        {!org && !bannerMessage && !loading && (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-4 py-4 text-sm">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">No organization found</p>
              <p className="text-muted-foreground mt-0.5">
                Create an organization in your database, or ask a super admin to assign your account to an <code className="text-xs bg-muted px-1 py-0.5 rounded">org_members</code> row.
              </p>
            </div>
          </div>
        )}

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Members", value: stats.total, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Active", value: stats.active, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
            { label: "Pending", value: stats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Inactive", value: stats.inactive, icon: Lock, color: "text-gray-500", bg: "bg-gray-50" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                    <s.icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* ── Role distribution bar ── */}
        {members.length > 0 && (
          <Card className="p-4">
            <p className="text-sm font-medium mb-3">Role Distribution</p>
            <div className="flex items-center gap-4 flex-wrap">
              {ROLE_DEFINITIONS.filter((r) => (roleCounts[r.key] ?? 0) > 0).map((role) => {
                const count = roleCounts[role.key] ?? 0;
                const pct = Math.round((count / members.length) * 100);
                const Icon = role.icon;
                return (
                  <div key={role.key} className="flex items-center gap-2 text-sm">
                    <div className={`w-6 h-6 rounded bg-gradient-to-br ${role.bgGradient} flex items-center justify-center`}>
                      <Icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-muted-foreground">{role.title}</span>
                    <span className="font-bold">{count}</span>
                    <span className="text-muted-foreground/60 text-xs">({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* ── Tabs ── */}
        <Card className="p-1">
          <div className="flex gap-1">
            {(
              [
                { key: "members", icon: Users, label: "Team Members", count: members.length },
                { key: "roles", icon: Shield, label: "Roles & Permissions", count: null },
                { key: "invitations", icon: Clock, label: "Pending Invitations", count: pendingMembers.length },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.count !== null && tab.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    activeTab === tab.key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB: MEMBERS */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "members" && (
          <AnimatePresence mode="wait">
            <motion.div key="members" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

              {/* Filters */}
              <Card className="p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, or role…"
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <select
                        className="pl-8 pr-3 py-2 border rounded-lg bg-background text-sm"
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                      >
                        <option value="all">All roles</option>
                        {ROLE_DEFINITIONS.map((r) => (
                          <option key={r.key} value={r.key}>{r.title}</option>
                        ))}
                      </select>
                    </div>
                    <select
                      className="px-3 py-2 border rounded-lg bg-background text-sm"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <option value="all">All status</option>
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                {filteredMembers.length !== members.length && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Showing {filteredMembers.length} of {members.length} members
                  </p>
                )}
              </Card>

              {/* Member list */}
              {filteredMembers.length === 0 ? (
                <div className="text-center py-16">
                  <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-medium text-muted-foreground">No members match your filters</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">Try adjusting the search or filters</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMembers.map((member, index) => {
                    const roleDef = getRoleDefinition(member.profile_role);
                    const RoleIcon = roleDef.icon;
                    const isExpanded = expandedMemberId === member.id;

                    return (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.03 * index }}
                      >
                        <Card className="overflow-hidden hover:shadow-md transition-shadow">
                          {/* Main row */}
                          <div className="p-4 flex items-center gap-4">
                            {/* Avatar */}
                            <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${roleDef.bgGradient} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm`}>
                              {initials(displayName(member))}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold truncate">{displayName(member)}</span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeClass(member.profile_role)}`}>
                                  <RoleIcon className="w-3 h-3" />
                                  {profileRoleLabel(member.profile_role)}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClass(member.status)}`}>
                                  {member.status}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground truncate mt-0.5">{member.email}</p>
                            </div>

                            {/* Meta */}
                            <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
                              <div className="text-center">
                                <p className="font-bold text-foreground">{member.session_count}</p>
                                <p className="text-xs">sessions</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs">Joined</p>
                                <p className="text-xs font-medium text-foreground">
                                  {format(new Date(member.joined_org_at), "MMM d, yyyy")}
                                </p>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5 ml-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => { setSelectedMember(member); setShowViewModal(true); }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => openEdit(member)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => { setSelectedMember(member); setShowRemoveModal(true); }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                              <button
                                type="button"
                                onClick={() => setExpandedMemberId(isExpanded ? null : member.id)}
                                className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {/* Expanded details */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4 pt-0 border-t bg-muted/20">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Email</p>
                                      <p className="text-sm font-medium break-all">{member.email || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Phone</p>
                                      <p className="text-sm font-medium">{member.phone || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Last Active</p>
                                      <p className="text-sm font-medium">
                                        {member.last_active_at
                                          ? formatDistanceToNow(new Date(member.last_active_at), { addSuffix: true })
                                          : "—"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> Org label</p>
                                      <p className="text-sm font-medium">{member.org_role || "—"}</p>
                                    </div>
                                  </div>
                                  <div className="mt-4">
                                    <p className="text-xs text-muted-foreground mb-2">Permissions from role</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {member.permissions.map((perm) => {
                                        const p = ALL_PERMISSIONS.find((a) => a.key === perm);
                                        return (
                                          <span key={perm} className="px-2 py-1 bg-primary/5 text-primary border border-primary/10 rounded-md text-xs">
                                            {p?.label ?? perm}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB: ROLES & PERMISSIONS */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "roles" && (
          <AnimatePresence mode="wait">
            <motion.div key="roles" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-lg">Permissions Matrix</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-5">
                  Permissions are derived from <code className="text-xs bg-muted px-1 py-0.5 rounded">profiles.role</code>. They are not individually configurable — changing a member's role changes their entire permission set.
                </p>
                <PermissionsMatrix />
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {ROLE_DEFINITIONS.map((role, index) => (
                  <motion.div key={role.key} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * index }}>
                    <RoleCard role={role} memberCount={roleCounts[role.key] ?? 0} />
                  </motion.div>
                ))}
              </div>

              <Card className="p-5 border-amber-200 bg-amber-50/50">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-900">Role assignment restrictions</p>
                    <ul className="text-sm text-amber-800 mt-2 space-y-1 list-disc list-inside">
                      <li>Only <strong>Super Admins</strong> can assign the Organization Admin role</li>
                      <li>Organization Admins can manage Team Admins and Users within their org</li>
                      <li>Team Admins have no role assignment capability</li>
                      <li>Removing a member from the org does not delete their user account</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </motion.div>
          </AnimatePresence>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB: PENDING INVITATIONS */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "invitations" && (
          <AnimatePresence mode="wait">
            <motion.div key="invitations" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {pendingMembers.length === 0 ? (
                <div className="text-center py-16">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="font-medium">No pending invitations</p>
                  <p className="text-sm text-muted-foreground mt-1">All team members have accepted their invitations.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{pendingMembers.length} invitation{pendingMembers.length !== 1 ? "s" : ""} awaiting acceptance.</span>
                  </div>
                  <div className="space-y-3">
                    {pendingMembers.map((member, index) => {
                      const roleDef = getRoleDefinition(member.profile_role);
                      const RoleIcon = roleDef.icon;
                      return (
                        <motion.div key={member.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * index }}>
                          <Card className="p-4 border-amber-100">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                {initials(displayName(member))}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold">{displayName(member)}</span>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeClass(member.profile_role)}`}>
                                    <RoleIcon className="w-3 h-3" />
                                    {profileRoleLabel(member.profile_role)}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-amber-100 text-amber-700 border-amber-200">
                                    pending
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <Mail className="w-3.5 h-3.5" /> {member.email}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  Invited {formatDistanceToNow(new Date(member.joined_org_at), { addSuffix: true })}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEdit(member)}
                                >
                                  <Edit className="w-4 h-4 mr-1.5" />
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 border-red-200 hover:bg-red-50"
                                  onClick={() => { setSelectedMember(member); setShowRemoveModal(true); }}
                                >
                                  <Trash2 className="w-4 h-4 mr-1.5" />
                                  Revoke
                                </Button>
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}

      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: ADD MEMBER */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
            onClick={() => !saving && setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background rounded-2xl shadow-xl border p-6 max-w-lg w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Add Team Member</h2>
                    <p className="text-sm text-muted-foreground">They'll receive an invite email</p>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowAddModal(false)} disabled={saving}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Full name <span className="text-red-500">*</span></label>
                  <Input
                    placeholder="Jane Smith"
                    value={addForm.full_name}
                    onChange={(e) => { setAddForm((p) => ({ ...p, full_name: e.target.value })); setAddErrors((p) => ({ ...p, full_name: undefined })); }}
                    className={addErrors.full_name ? "border-red-400" : ""}
                  />
                  {addErrors.full_name && <p className="text-xs text-red-500 mt-1">{addErrors.full_name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Email address <span className="text-red-500">*</span></label>
                  <Input
                    type="email"
                    placeholder="colleague@organization.com"
                    value={addForm.email}
                    onChange={(e) => { setAddForm((p) => ({ ...p, email: e.target.value })); setAddErrors((p) => ({ ...p, email: undefined })); }}
                    className={addErrors.email ? "border-red-400" : ""}
                  />
                  {addErrors.email && <p className="text-xs text-red-500 mt-1">{addErrors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Phone <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <p className="text-xs text-muted-foreground mb-1.5">Country code + number, exactly 12 digits total.</p>
                  <PhoneInput
                    value={addForm.phone}
                    onChange={(v) => { setAddForm((p) => ({ ...p, phone: v })); setAddErrors((p) => ({ ...p, phone: undefined })); }}
                    placeholder="Phone number"
                  />
                  {addErrors.phone && <p className="text-xs text-red-500 mt-1">{addErrors.phone}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Access role <span className="text-red-500">*</span></label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                    value={addForm.profile_role}
                    onChange={(e) => setAddForm((p) => ({ ...p, profile_role: e.target.value as typeof p.profile_role }))}
                  >
                    <option value="team_admin">Team Admin — operational access (sessions, support, analytics)</option>
                    <option value="user">User — standard app user, no admin UI</option>
                    {isSuperAdmin && <option value="org_admin">Organization Admin — org-wide management</option>}
                  </select>
                  <div className="mt-2 p-3 bg-muted/40 rounded-lg">
                    <p className="text-xs text-muted-foreground font-medium mb-1">Permissions granted:</p>
                    <div className="flex flex-wrap gap-1">
                      {getRoleDefinition(addForm.profile_role).permissions.map((p) => {
                        const perm = ALL_PERMISSIONS.find((a) => a.key === p);
                        return (
                          <span key={p} className="px-1.5 py-0.5 bg-primary/5 text-primary rounded text-xs border border-primary/10">
                            {perm?.label ?? p}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  {!isSuperAdmin && (
                    <p className="text-xs text-muted-foreground mt-1.5">Only super admins can assign the Organization Admin role.</p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddModal(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="button" className="flex-1" disabled={saving} onClick={() => void handleAddMember()}>
                    {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</> : <><UserPlus className="w-4 h-4 mr-2" />Send Invitation</>}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: VIEW MEMBER */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showViewModal && selectedMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
            onClick={() => setShowViewModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background rounded-2xl shadow-xl border p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              {(() => {
                const roleDef = getRoleDefinition(selectedMember.profile_role);
                const RoleIcon = roleDef.icon;
                return (
                  <>
                    <div className="flex items-start justify-between gap-4 mb-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${roleDef.bgGradient} flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                          {initials(displayName(selectedMember))}
                        </div>
                        <div>
                          <h2 className="text-xl font-bold">{displayName(selectedMember)}</h2>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleBadgeClass(selectedMember.profile_role)}`}>
                              <RoleIcon className="w-3.5 h-3.5" />
                              {profileRoleLabel(selectedMember.profile_role)}
                            </span>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBadgeClass(selectedMember.status)}`}>
                              {selectedMember.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowViewModal(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Email", value: selectedMember.email, icon: Mail },
                          { label: "Phone", value: selectedMember.phone || "—", icon: Phone },
                          { label: "Org label", value: selectedMember.org_role || "—", icon: Building2 },
                          { label: "Talk it out", value: String(selectedMember.session_count), icon: Activity },
                          { label: "Joined org", value: format(new Date(selectedMember.joined_org_at), "MMM d, yyyy"), icon: Calendar },
                          {
                            label: "Last active",
                            value: selectedMember.last_active_at
                              ? formatDistanceToNow(new Date(selectedMember.last_active_at), { addSuffix: true })
                              : "—",
                            icon: Clock,
                          },
                        ].map((item) => (
                          <div key={item.label} className="p-3 bg-muted/30 rounded-xl">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                              <item.icon className="w-3.5 h-3.5" />
                              {item.label}
                            </div>
                            <p className="font-medium text-sm break-all">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      <div>
                        <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                          <Key className="w-4 h-4 text-muted-foreground" />
                          Permissions
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedMember.permissions.map((perm) => {
                            const p = ALL_PERMISSIONS.find((a) => a.key === perm);
                            return (
                              <div key={perm} className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/10 rounded-xl">
                                <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                                <span className="text-sm font-medium">{p?.label ?? perm}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-6 pt-5 border-t">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setShowViewModal(false)}>
                        Close
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => { setShowViewModal(false); openEdit(selectedMember); }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => { setShowViewModal(false); setShowRemoveModal(true); }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: EDIT MEMBER */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showEditModal && selectedMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
            onClick={() => !saving && setShowEditModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background rounded-2xl shadow-xl border p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold">Edit Member</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{selectedMember.email}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowEditModal(false)} disabled={saving}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Phone <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <p className="text-xs text-muted-foreground mb-1.5">Country code + number, exactly 12 digits total.</p>
                  <PhoneInput
                    value={editForm.phone}
                    onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))}
                    placeholder="Phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Access role</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                    value={editForm.profile_role}
                    onChange={(e) => setEditForm((f) => ({ ...f, profile_role: e.target.value as typeof f.profile_role }))}
                  >
                    <option value="team_admin">Team Admin — operational access</option>
                    <option value="user">User — standard app user</option>
                    {isSuperAdmin && <option value="org_admin">Organization Admin — org-wide management</option>}
                  </select>
                  <div className="mt-2 p-3 bg-muted/40 rounded-lg">
                    <p className="text-xs text-muted-foreground font-medium mb-1.5">Permissions granted with this role:</p>
                    <div className="flex flex-wrap gap-1">
                      {getRoleDefinition(editForm.profile_role).permissions.map((p) => {
                        const perm = ALL_PERMISSIONS.find((a) => a.key === p);
                        return (
                          <span key={p} className="px-1.5 py-0.5 bg-primary/5 text-primary rounded text-xs border border-primary/10">
                            {perm?.label ?? p}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Account status</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                    value={editForm.account_status}
                    onChange={(e) => setEditForm((f) => ({ ...f, account_status: e.target.value }))}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Organization label <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input
                    placeholder="e.g. staff, billing, support"
                    value={editForm.org_role}
                    onChange={(e) => setEditForm((f) => ({ ...f, org_role: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">A descriptive label stored on the org membership record.</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowEditModal(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="button" className="flex-1" disabled={saving} onClick={() => void handleSaveEdit()}>
                    {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={saving}
                    onClick={() => { setShowEditModal(false); setShowRemoveModal(true); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: CONFIRM REMOVE */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showRemoveModal && selectedMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110] p-4"
            onClick={() => !saving && setShowRemoveModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background rounded-2xl shadow-xl border p-6 max-w-md w-full"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Remove member?</h2>
                  <p className="text-sm text-muted-foreground">This action cannot be undone easily.</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-3">
                <strong className="text-foreground">{displayName(selectedMember)}</strong> will be removed from this organization.
                Their login account will remain intact — only the organization membership is removed.
              </p>

              <div className="flex gap-3 mt-5">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowRemoveModal(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="button" variant="destructive" className="flex-1" disabled={saving} onClick={() => void handleRemove()}>
                  {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Removing…</> : <><Trash2 className="w-4 h-4 mr-2" />Remove member</>}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </AdminLayoutNew>
  );
}
