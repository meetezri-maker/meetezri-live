import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { api } from "../../../lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
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
  Award,
  Eye,
  X,
} from "lucide-react";

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

function profileRoleLabel(role: string): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "org_admin":
      return "Organization Admin";
    case "team_admin":
      return "Team Admin";
    case "user":
      return "User";
    default:
      return role || "User";
  }
}

const ROLE_INFO = [
  {
    key: "super_admin",
    title: "Super Admin",
    description: "Full platform access across all organizations. Can assign organization admins.",
    color: "from-red-500 to-pink-500",
  },
  {
    key: "org_admin",
    title: "Organization Admin",
    description: "Manages one organization: users, team members, and org-scoped admin tools.",
    color: "from-orange-500 to-red-500",
  },
  {
    key: "team_admin",
    title: "Team Admin",
    description: "Operational access: sessions, support, and analytics. Scoped by admin permissions.",
    color: "from-blue-500 to-indigo-500",
  },
  {
    key: "user",
    title: "User",
    description: "Standard app user. May belong to an organization without admin privileges.",
    color: "from-green-500 to-blue-500",
  },
];

export function TeamRoleManagement() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === "super_admin";

  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"members" | "roles">("members");
  const [showCreateMemberModal, setShowCreateMemberModal] = useState(false);
  const [showViewMemberModal, setShowViewMemberModal] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMemberRow | null>(null);

  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [organizations, setOrganizations] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const [newMember, setNewMember] = useState({
    full_name: "",
    email: "",
    phone: "",
    profile_role: "team_admin" as "org_admin" | "team_admin" | "user",
  });
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    phone: "",
    profile_role: "team_admin" as "org_admin" | "team_admin" | "user",
    account_status: "active",
    org_role: "",
  });

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

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const matchesSearch =
        (member.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (member.email || "").toLowerCase().includes(searchQuery.toLowerCase());
      const pr = profileRoleLabel(member.profile_role);
      const matchesRole = filterRole === "all" || pr === filterRole;
      const matchesStatus = filterStatus === "all" || member.status === filterStatus;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [members, searchQuery, filterRole, filterStatus]);

  const stats = useMemo(() => {
    const totalMembers = members.length;
    const active = members.filter((m) => m.status === "active").length;
    const pending = members.filter((m) => m.status === "pending").length;
    const avgSessions =
      totalMembers > 0
        ? members.reduce((s, m) => s + m.session_count, 0) / totalMembers
        : 0;
    return {
      totalMembers,
      active,
      pending,
      totalRoles: ROLE_INFO.length,
      avgResponseTime: avgSessions > 0 ? `${avgSessions.toFixed(1)} avg sessions` : "—",
      avgRating: "—",
    };
  }, [members]);

  const roleFilterOptions = useMemo(() => {
    const labels = [...new Set(members.map((m) => profileRoleLabel(m.profile_role)))];
    return labels.sort();
  }, [members]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700 border-green-300";
      case "inactive":
        return "bg-gray-100 text-gray-700 border-gray-300";
      case "pending":
        return "bg-yellow-100 text-yellow-700 border-yellow-300";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const openEdit = (m: TeamMemberRow) => {
    setSelectedMember(m);
    setEditForm({
      phone: m.phone ?? "",
      profile_role: (["org_admin", "team_admin", "user"].includes(m.profile_role)
        ? m.profile_role
        : "team_admin") as "org_admin" | "team_admin" | "user",
      account_status: m.account_status === "inactive" ? "inactive" : "active",
      org_role: m.org_role ?? "",
    });
    setShowEditMemberModal(true);
  };

  const handleAddMember = async () => {
    if (!newMember.email.trim() || !newMember.full_name.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSaving(true);
    try {
      await api.admin.addOrganizationTeamMember({
        org_id: isSuperAdmin ? selectedOrgId ?? undefined : undefined,
        email: newMember.email.trim(),
        full_name: newMember.full_name.trim(),
        phone: newMember.phone.trim() || undefined,
        profile_role: newMember.profile_role,
      });
      toast.success("Invitation sent. They will receive an email to join.");
      setShowCreateMemberModal(false);
      setNewMember({ full_name: "", email: "", phone: "", profile_role: "team_admin" });
      await loadTeam();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to add member";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedMember) return;
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
      toast.success("Member updated");
      setShowEditMemberModal(false);
      await loadTeam();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to update";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (m: TeamMemberRow) => {
    if (!confirm(`Remove ${m.full_name || m.email} from this organization? Their login is not deleted.`)) return;
    setSaving(true);
    try {
      await api.admin.removeOrganizationTeamMember(m.id, isSuperAdmin ? selectedOrgId ?? undefined : undefined);
      toast.success("Removed from organization");
      setShowViewMemberModal(false);
      setShowEditMemberModal(false);
      setSelectedMember(null);
      await loadTeam();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to remove";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const displayName = (m: TeamMemberRow) => m.full_name || m.email || "User";

  if (loading && members.length === 0 && !org) {
    return (
      <AdminLayoutNew>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </AdminLayoutNew>
    );
  }

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Team & Role Management</h1>
                <p className="text-muted-foreground">
                  Organization members and access levels (from your database)
                </p>
                {org && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Organization: <span className="font-medium text-foreground">{org.name}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              {isSuperAdmin && organizations.length > 0 && (
                <select
                  className="px-3 py-2 border rounded-lg bg-background text-sm min-w-[200px]"
                  value={selectedOrgId ?? ""}
                  onChange={(e) => setSelectedOrgId(e.target.value || null)}
                >
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              )}
              <Button className="gap-2" onClick={() => setShowCreateMemberModal(true)}>
                <UserPlus className="w-4 h-4" />
                Add Team Member
              </Button>
            </div>
          </div>
        </motion.div>

        {bannerMessage && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {bannerMessage}
          </div>
        )}

        {!org && !bannerMessage && (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
            No organization found. Create an organization in your database, or ask a super admin to assign your account to an{" "}
            <code className="text-xs">org_members</code> row.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Members</p>
                <p className="text-2xl font-bold">{stats.totalMembers}</p>
              </div>
              <Users className="w-8 h-8 text-primary" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Role types</p>
                <p className="text-2xl font-bold text-purple-600">{stats.totalRoles}</p>
              </div>
              <Shield className="w-8 h-8 text-purple-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Engagement</p>
                <p className="text-2xl font-bold text-blue-600">{stats.avgResponseTime}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Rating</p>
                <p className="text-2xl font-bold text-orange-600">{stats.avgRating}</p>
              </div>
              <Award className="w-8 h-8 text-orange-500" />
            </div>
          </Card>
        </div>

        <Card className="p-1">
          <div className="flex gap-1">
            <Button variant={activeTab === "members" ? "default" : "ghost"} className="flex-1" onClick={() => setActiveTab("members")}>
              <Users className="w-4 h-4 mr-2" />
              Team Members
            </Button>
            <Button variant={activeTab === "roles" ? "default" : "ghost"} className="flex-1" onClick={() => setActiveTab("roles")}>
              <Shield className="w-4 h-4 mr-2" />
              Roles & Permissions
            </Button>
          </div>
        </Card>

        {activeTab === "members" && (
          <>
            <Card className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search team members..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    className="px-3 py-2 border rounded-lg"
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                  >
                    <option value="all">All roles</option>
                    {roleFilterOptions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <select
                    className="px-3 py-2 border rounded-lg"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredMembers.map((member, index) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + index * 0.03 }}
                >
                  <Card className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                          {displayName(member)
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <div>
                          <h3 className="font-bold">{displayName(member)}</h3>
                          <p className="text-sm text-muted-foreground">{profileRoleLabel(member.profile_role)}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(member.status)}`}>
                        {member.status}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{member.email || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{member.phone || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>Joined org {formatDistanceToNow(new Date(member.joined_org_at), { addSuffix: true })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>
                          Last active:{" "}
                          {member.last_active_at
                            ? formatDistanceToNow(new Date(member.last_active_at), { addSuffix: true })
                            : "—"}
                        </span>
                      </div>
                    </div>

                    {member.session_count > 0 && (
                      <div className="border-t pt-4 mb-4">
                        <p className="text-lg font-bold text-blue-600">{member.session_count}</p>
                        <p className="text-xs text-muted-foreground">Completed sessions</p>
                      </div>
                    )}

                    <div className="mb-4">
                      <p className="text-sm font-medium mb-2">Permissions (from role)</p>
                      <div className="flex flex-wrap gap-2">
                        {member.permissions.slice(0, 4).map((perm, i) => (
                          <span key={i} className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
                            {perm}
                          </span>
                        ))}
                        {member.permissions.length > 4 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                            +{member.permissions.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setSelectedMember(member);
                          setShowViewMemberModal(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(member)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        disabled={saving}
                        onClick={() => handleRemove(member)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            {filteredMembers.length === 0 && !loading && (
              <p className="text-center text-muted-foreground py-8">No members match your filters.</p>
            )}
          </>
        )}

        {activeTab === "roles" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {ROLE_INFO.map((role, index) => (
              <motion.div
                key={role.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * index }}
              >
                <Card className="p-6">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${role.color} flex items-center justify-center shadow-lg`}>
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{role.title}</h3>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground border-t pt-3">
                    Stored on <code className="text-xs">profiles.role</code>. Admin UI routes check this role for access.
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {showCreateMemberModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowCreateMemberModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Add Team Member</h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowCreateMemberModal(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Full name</label>
                    <Input
                      placeholder="Jane Doe"
                      value={newMember.full_name}
                      onChange={(e) => setNewMember((p) => ({ ...p, full_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <Input
                      type="email"
                      placeholder="colleague@organization.com"
                      value={newMember.email}
                      onChange={(e) => setNewMember((p) => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Phone (optional)</label>
                    <Input
                      type="tel"
                      value={newMember.phone}
                      onChange={(e) => setNewMember((p) => ({ ...p, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Access role</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg"
                      value={newMember.profile_role}
                      onChange={(e) =>
                        setNewMember((p) => ({
                          ...p,
                          profile_role: e.target.value as "org_admin" | "team_admin" | "user",
                        }))
                      }
                    >
                      <option value="team_admin">Team admin (operations)</option>
                      <option value="user">User (no admin UI)</option>
                      {isSuperAdmin && <option value="org_admin">Organization admin</option>}
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Only super admins can assign organization admin. New users receive an email invite to set a password.
                    </p>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => setShowCreateMemberModal(false)}>
                      Cancel
                    </Button>
                    <Button className="flex-1" disabled={saving} onClick={() => void handleAddMember()}>
                      {saving ? "Saving…" : "Add member"}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showViewMemberModal && selectedMember && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowViewMemberModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-xl">
                      {displayName(selectedMember)
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{displayName(selectedMember)}</h2>
                      <p className="text-muted-foreground">{profileRoleLabel(selectedMember.profile_role)}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setShowViewMemberModal(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-lg mb-3">Contact</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Email</p>
                        <p className="font-medium">{selectedMember.email}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Phone</p>
                        <p className="font-medium">{selectedMember.phone || "—"}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-lg mb-3">Organization</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Org label</p>
                        <p className="font-medium">{selectedMember.org_role}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Status</p>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(selectedMember.status)}`}>
                          {selectedMember.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-lg mb-3">Permissions</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedMember.permissions.map((perm, i) => (
                        <div key={i} className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                          <CheckCircle className="w-4 h-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-900">{perm}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6 pt-6 border-t flex-wrap">
                  <Button variant="outline" className="flex-1" onClick={() => setShowViewMemberModal(false)}>
                    Close
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setShowViewMemberModal(false);
                      openEdit(selectedMember);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit member
                  </Button>
                  <Button variant="destructive" className="flex-1" disabled={saving} onClick={() => void handleRemove(selectedMember)}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove from org
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showEditMemberModal && selectedMember && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowEditMemberModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Edit Team Member</h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowEditMemberModal(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {selectedMember.email} — {profileRoleLabel(selectedMember.profile_role)}
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Phone</label>
                    <Input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Access role</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg"
                      value={editForm.profile_role}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          profile_role: e.target.value as "org_admin" | "team_admin" | "user",
                        }))
                      }
                    >
                      <option value="team_admin">Team admin</option>
                      <option value="user">User</option>
                      {isSuperAdmin && <option value="org_admin">Organization admin</option>}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Account status</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg"
                      value={editForm.account_status}
                      onChange={(e) => setEditForm((f) => ({ ...f, account_status: e.target.value }))}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Org label (optional)</label>
                    <Input
                      placeholder="e.g. staff, billing"
                      value={editForm.org_role}
                      onChange={(e) => setEditForm((f) => ({ ...f, org_role: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Stored on the organization membership record.</p>
                  </div>
                  <div className="flex gap-2 pt-4 flex-wrap">
                    <Button variant="outline" className="flex-1" onClick={() => setShowEditMemberModal(false)}>
                      Cancel
                    </Button>
                    <Button className="flex-1" disabled={saving} onClick={() => void handleSaveEdit()}>
                      {saving ? "Saving…" : "Save changes"}
                    </Button>
                    <Button variant="destructive" disabled={saving} onClick={() => void handleRemove(selectedMember)}>
                      Remove
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayoutNew>
  );
}
