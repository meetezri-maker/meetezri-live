import { useState } from "react";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";
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
  XCircle,
  Clock,
  Award,
  TrendingUp,
  Eye,
  Settings,
  Lock,
  Unlock,
  X,
  AlertCircle,
} from "lucide-react";

interface TeamMember {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  status: "active" | "inactive" | "pending";
  joinDate: string;
  lastActive: string;
  sessionsHandled: number;
  avgResponseTime: string;
  rating: number;
  permissions: string[];
}

interface Role {
  id: number;
  name: string;
  description: string;
  memberCount: number;
  permissions: string[];
  color: string;
}

export function TeamRoleManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"members" | "roles">("members");
  const [showCreateMemberModal, setShowCreateMemberModal] = useState(false);
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [showViewMemberModal, setShowViewMemberModal] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const teamMembers: TeamMember[] = [
    {
      id: 1,
      name: "Dr. Emily Chen",
      email: "emily.chen@ezri.health",
      phone: "+1 (555) 123-4567",
      role: "Crisis Specialist",
      department: "Crisis Response",
      status: "active",
      joinDate: "Jan 15, 2024",
      lastActive: "2 minutes ago",
      sessionsHandled: 342,
      avgResponseTime: "3 min",
      rating: 4.9,
      permissions: ["crisis-access", "user-management", "session-override"],
    },
    {
      id: 2,
      name: "Sarah Williams",
      email: "sarah.w@ezri.health",
      phone: "+1 (555) 234-5678",
      role: "Senior Companion",
      department: "Companionship",
      status: "active",
      joinDate: "Feb 20, 2024",
      lastActive: "15 minutes ago",
      sessionsHandled: 567,
      avgResponseTime: "5 min",
      rating: 4.8,
      permissions: ["session-access", "user-view", "content-edit"],
    },
    {
      id: 3,
      name: "Marcus Johnson",
      email: "marcus.j@ezri.health",
      phone: "+1 (555) 345-6789",
      role: "Content Manager",
      department: "Content",
      status: "active",
      joinDate: "Mar 10, 2024",
      lastActive: "1 hour ago",
      sessionsHandled: 0,
      avgResponseTime: "N/A",
      rating: 4.7,
      permissions: ["content-full", "media-upload", "analytics-view"],
    },
    {
      id: 4,
      name: "Luna Martinez",
      email: "luna.m@ezri.health",
      phone: "+1 (555) 456-7890",
      role: "System Admin",
      department: "IT",
      status: "active",
      joinDate: "Jan 5, 2024",
      lastActive: "5 minutes ago",
      sessionsHandled: 0,
      avgResponseTime: "N/A",
      rating: 5.0,
      permissions: ["full-access", "system-settings", "user-management", "audit-logs"],
    },
    {
      id: 5,
      name: "David Wilson",
      email: "david.w@ezri.health",
      phone: "+1 (555) 567-8901",
      role: "Support Specialist",
      department: "Support",
      status: "active",
      joinDate: "Apr 12, 2024",
      lastActive: "30 minutes ago",
      sessionsHandled: 234,
      avgResponseTime: "8 min",
      rating: 4.6,
      permissions: ["support-access", "user-view", "ticket-management"],
    },
    {
      id: 6,
      name: "Jessica Lee",
      email: "jessica.l@ezri.health",
      phone: "+1 (555) 678-9012",
      role: "Companion",
      department: "Companionship",
      status: "pending",
      joinDate: "Dec 28, 2024",
      lastActive: "Never",
      sessionsHandled: 0,
      avgResponseTime: "N/A",
      rating: 0,
      permissions: ["session-access", "user-view"],
    },
  ];

  const roles: Role[] = [
    {
      id: 1,
      name: "System Admin",
      description: "Full system access with all permissions",
      memberCount: 1,
      permissions: ["full-access", "system-settings", "user-management", "audit-logs", "billing"],
      color: "from-red-500 to-pink-500",
    },
    {
      id: 2,
      name: "Crisis Specialist",
      description: "Crisis intervention and emergency response",
      memberCount: 1,
      permissions: ["crisis-access", "user-management", "session-override", "emergency-contact"],
      color: "from-orange-500 to-red-500",
    },
    {
      id: 3,
      name: "Senior Companion",
      description: "Advanced companionship sessions and supervision",
      memberCount: 1,
      permissions: ["session-access", "user-view", "content-edit", "analytics-view"],
      color: "from-blue-500 to-indigo-500",
    },
    {
      id: 4,
      name: "Companion",
      description: "Standard companionship sessions",
      memberCount: 1,
      permissions: ["session-access", "user-view"],
      color: "from-green-500 to-blue-500",
    },
    {
      id: 5,
      name: "Content Manager",
      description: "Manage wellness content and resources",
      memberCount: 1,
      permissions: ["content-full", "media-upload", "analytics-view"],
      color: "from-purple-500 to-pink-500",
    },
    {
      id: 6,
      name: "Support Specialist",
      description: "User support and ticket management",
      memberCount: 1,
      permissions: ["support-access", "user-view", "ticket-management"],
      color: "from-yellow-500 to-orange-500",
    },
  ];

  const filteredMembers = teamMembers.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === "all" || member.role === filterRole;
    const matchesStatus = filterStatus === "all" || member.status === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const stats = {
    totalMembers: teamMembers.length,
    active: teamMembers.filter((m) => m.status === "active").length,
    pending: teamMembers.filter((m) => m.status === "pending").length,
    totalRoles: roles.length,
    avgResponseTime: "5.2 min",
    avgRating: 4.7,
  };

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

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Team & Role Management</h1>
                <p className="text-muted-foreground">
                  Manage team members, roles, and permissions
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShowCreateRoleModal(true)}
              >
                <Shield className="w-4 h-4" />
                Create Role
              </Button>
              <Button className="gap-2" onClick={() => setShowCreateMemberModal(true)}>
                <UserPlus className="w-4 h-4" />
                Add Member
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Members</p>
                  <p className="text-2xl font-bold">{stats.totalMembers}</p>
                </div>
                <Users className="w-8 h-8 text-primary" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Active</p>
                  <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Roles</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.totalRoles}</p>
                </div>
                <Shield className="w-8 h-8 text-purple-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Avg Response</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.avgResponseTime}</p>
                </div>
                <Activity className="w-8 h-8 text-blue-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Avg Rating</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.avgRating}</p>
                </div>
                <Award className="w-8 h-8 text-orange-500" />
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-1">
            <div className="flex gap-1">
              <Button
                variant={activeTab === "members" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setActiveTab("members")}
              >
                <Users className="w-4 h-4 mr-2" />
                Team Members
              </Button>
              <Button
                variant={activeTab === "roles" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setActiveTab("roles")}
              >
                <Shield className="w-4 h-4 mr-2" />
                Roles & Permissions
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Team Members Tab */}
        {activeTab === "members" && (
          <>
            {/* Filters */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
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
                      <option value="all">All Roles</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.name}>
                          {role.name}
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
            </motion.div>

            {/* Members Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredMembers.map((member, index) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + index * 0.05 }}
                >
                  <Card className="p-6 hover:shadow-lg transition-shadow">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                          {member.name.split(" ").map(n => n[0]).join("")}
                        </div>
                        <div>
                          <h3 className="font-bold">{member.name}</h3>
                          <p className="text-sm text-muted-foreground">{member.role}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(member.status)}`}>
                          {member.status}
                        </span>
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{member.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{member.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>Joined {member.joinDate}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>Last active: {member.lastActive}</span>
                      </div>
                    </div>

                    {/* Performance */}
                    {member.sessionsHandled > 0 && (
                      <div className="border-t pt-4 mb-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-lg font-bold text-blue-600">{member.sessionsHandled}</p>
                            <p className="text-xs text-muted-foreground">Sessions</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-green-600">{member.avgResponseTime}</p>
                            <p className="text-xs text-muted-foreground">Avg Response</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-orange-600">{member.rating}</p>
                            <p className="text-xs text-muted-foreground">Rating</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Permissions */}
                    <div className="mb-4">
                      <p className="text-sm font-medium mb-2">Permissions:</p>
                      <div className="flex flex-wrap gap-2">
                        {member.permissions.slice(0, 3).map((perm, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs"
                          >
                            {perm}
                          </span>
                        ))}
                        {member.permissions.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                            +{member.permissions.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
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
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => {
                          setSelectedMember(member);
                          setShowEditMemberModal(true);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      {member.status === "pending" && (
                        <Button size="sm" className="flex-1">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </>
        )}

        {/* Roles Tab */}
        {activeTab === "roles" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {roles.map((role, index) => (
              <motion.div
                key={role.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.05 }}
              >
                <Card className="p-6 hover:shadow-lg transition-shadow">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${role.color} flex items-center justify-center shadow-lg`}>
                        <Shield className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{role.name}</h3>
                        <p className="text-sm text-muted-foreground">{role.memberCount} member{role.memberCount !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setSelectedRole(role);
                          setShowEditRoleModal(true);
                          toast.info(`Editing role: ${role.name}`);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          toast.error(`Delete role: ${role.name}`);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground mb-4">{role.description}</p>

                  {/* Permissions */}
                  <div>
                    <p className="text-sm font-medium mb-3">Permissions ({role.permissions.length}):</p>
                    <div className="space-y-2">
                      {role.permissions.map((perm, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm">{perm}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setSelectedRole(role);
                        toast.info(`Configuring permissions for ${role.name}`);
                      }}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Configure
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        toast.info(`Viewing members with role: ${role.name}`);
                      }}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      View Members
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Create Member Modal */}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreateMemberModal(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">First Name</label>
                      <Input placeholder="Enter first name..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Last Name</label>
                      <Input placeholder="Enter last name..." />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <Input type="email" placeholder="email@ezri.health" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Phone</label>
                    <Input type="tel" placeholder="+1 (555) 123-4567" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Role</label>
                      <select className="w-full px-3 py-2 border rounded-lg">
                        {roles.map((role) => (
                          <option key={role.id}>{role.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Department</label>
                      <Input placeholder="e.g., Therapy" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => setShowCreateMemberModal(false)}>
                      Cancel
                    </Button>
                    <Button className="flex-1">
                      Add Member
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* View Member Modal */}
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
                      {selectedMember.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{selectedMember.name}</h2>
                      <p className="text-muted-foreground">{selectedMember.role}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowViewMemberModal(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-6">
                  {/* Contact Information */}
                  <div>
                    <h3 className="font-bold text-lg mb-3">Contact Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Mail className="w-4 h-4 text-gray-600" />
                          <p className="text-sm text-gray-600">Email</p>
                        </div>
                        <p className="font-medium">{selectedMember.email}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Phone className="w-4 h-4 text-gray-600" />
                          <p className="text-sm text-gray-600">Phone</p>
                        </div>
                        <p className="font-medium">{selectedMember.phone}</p>
                      </div>
                    </div>
                  </div>

                  {/* Employment Details */}
                  <div>
                    <h3 className="font-bold text-lg mb-3">Employment Details</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Department</p>
                        <p className="font-medium">{selectedMember.department}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Join Date</p>
                        <p className="font-medium">{selectedMember.joinDate}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Status</p>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(selectedMember.status)}`}>
                          {selectedMember.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  {selectedMember.sessionsHandled > 0 && (
                    <div>
                      <h3 className="font-bold text-lg mb-3">Performance Metrics</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-blue-50 rounded-lg text-center">
                          <p className="text-2xl font-bold text-blue-600">{selectedMember.sessionsHandled}</p>
                          <p className="text-sm text-gray-600 mt-1">Sessions Handled</p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg text-center">
                          <p className="text-2xl font-bold text-green-600">{selectedMember.avgResponseTime}</p>
                          <p className="text-sm text-gray-600 mt-1">Avg Response Time</p>
                        </div>
                        <div className="p-4 bg-orange-50 rounded-lg text-center">
                          <p className="text-2xl font-bold text-orange-600">{selectedMember.rating}</p>
                          <p className="text-sm text-gray-600 mt-1">Rating</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Permissions */}
                  <div>
                    <h3 className="font-bold text-lg mb-3">Permissions ({selectedMember.permissions.length})</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedMember.permissions.map((perm, i) => (
                        <div key={i} className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                          <CheckCircle className="w-4 h-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-900">{perm}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Activity */}
                  <div>
                    <h3 className="font-bold text-lg mb-3">Activity</h3>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-600" />
                        <p className="text-sm">
                          <span className="font-medium">Last Active:</span> {selectedMember.lastActive}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6 pt-6 border-t">
                  <Button variant="outline" className="flex-1" onClick={() => setShowViewMemberModal(false)}>
                    Close
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={() => {
                      setShowViewMemberModal(false);
                      setShowEditMemberModal(true);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Member
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Member Modal */}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEditMemberModal(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">First Name</label>
                      <Input placeholder="Enter first name..." defaultValue={selectedMember.name.split(' ')[0]} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Last Name</label>
                      <Input placeholder="Enter last name..." defaultValue={selectedMember.name.split(' ').slice(1).join(' ')} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <Input type="email" defaultValue={selectedMember.email} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Phone</label>
                    <Input type="tel" defaultValue={selectedMember.phone} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Role</label>
                      <select className="w-full px-3 py-2 border rounded-lg" defaultValue={selectedMember.role}>
                        {roles.map((role) => (
                          <option key={role.id}>{role.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Department</label>
                      <Input defaultValue={selectedMember.department} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Status</label>
                    <select className="w-full px-3 py-2 border rounded-lg" defaultValue={selectedMember.status}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => setShowEditMemberModal(false)}>
                      Cancel
                    </Button>
                    <Button className="flex-1">
                      Save Changes
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create Role Modal */}
        <AnimatePresence>
          {showCreateRoleModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowCreateRoleModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold">Create New Role</h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreateRoleModal(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Role Name <span className="text-red-500">*</span></label>
                    <Input placeholder="e.g., Senior Therapist" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <textarea 
                      className="w-full px-3 py-2 border rounded-lg min-h-[80px]"
                      placeholder="Describe the responsibilities and scope of this role..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Color Theme</label>
                    <div className="flex gap-2">
                      {["from-red-500 to-pink-500", "from-orange-500 to-red-500", "from-blue-500 to-indigo-500", "from-green-500 to-blue-500", "from-purple-500 to-pink-500", "from-yellow-500 to-orange-500"].map((color, i) => (
                        <button
                          key={i}
                          className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} border-2 border-gray-200 hover:border-gray-400 transition`}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-3">Permissions</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                      {["full-access", "system-settings", "user-management", "session-access", "content-edit", "analytics-view", "crisis-access", "support-access", "billing", "audit-logs"].map((perm, i) => (
                        <label key={i} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input type="checkbox" className="w-4 h-4" />
                          <span className="text-sm">{perm}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => setShowCreateRoleModal(false)}>
                      Cancel
                    </Button>
                    <Button className="flex-1">
                      <Shield className="w-4 h-4 mr-2" />
                      Create Role
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