import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  MessageSquare,
  Users,
  Flag,
  TrendingUp,
  ThumbsUp,
  Eye,
  AlertTriangle,
  Lock,
  Unlock,
  Trash2,
  MoreVertical,
  Search,
  X,
  Tag,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface ForumPost {
  id: string;
  author: string;
  authorAvatar: string;
  authorEmail?: string;
  authorId?: string;
  title: string;
  content: string;
  category: string;
  timestamp: Date;
  likes: number;
  replies: number;
  views: number;
  flagged: boolean;
  flagCount: number;
  status: "active" | "locked" | "deleted" | "pending";
  tags: string[];
}

interface Group {
  id: string;
  name: string;
  description: string;
  members: number;
  posts: number;
  category: string;
  privacy: "public" | "private";
  moderators: string[];
  active: boolean;
  archived_at?: string | null;
}

function titleFromContent(content: string) {
  const line = content.split("\n")[0]?.trim() || content;
  return line.length > 120 ? `${line.slice(0, 117)}...` : line;
}

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return `${p[0][0]}${p[1][0]}`.toUpperCase();
  if (p.length === 1 && p[0].length >= 2) return p[0].slice(0, 2).toUpperCase();
  return (p[0]?.[0] || "?").toUpperCase();
}

export function CommunityManagement() {
  const [selectedTab, setSelectedTab] = useState<"posts" | "groups" | "reported">("posts");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [stats, setStats] = useState({
    totalPosts: 0,
    flaggedContent: 0,
    totalGroups: 0,
    activeDiscussions: 0,
  });

  const [viewingPost, setViewingPost] = useState<ForumPost | null>(null);
  const [lockingPost, setLockingPost] = useState<ForumPost | null>(null);
  const [deletingPost, setDeletingPost] = useState<ForumPost | null>(null);
  const [viewingGroup, setViewingGroup] = useState<Group | null>(null);
  const [groupMenuOpen, setGroupMenuOpen] = useState<string | null>(null);

  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [editGroupForm, setEditGroupForm] = useState({
    name: "",
    description: "",
    category: "",
    privacy: "public" as "public" | "private",
  });
  const [groupMembers, setGroupMembers] = useState<{ id: string; name: string; email: string; role: string | null }[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [addMemberSaving, setAddMemberSaving] = useState<string | null>(null);
  const [removeMemberSaving, setRemoveMemberSaving] = useState<string | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());

  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createGroupForm, setCreateGroupForm] = useState({
    name: "",
    description: "",
    category: "",
    privacy: "public" as "public" | "private",
  });
  const [createGroupSaving, setCreateGroupSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [statsData, postsData, groupsData] = await Promise.all([
        api.admin.getCommunityStats(),
        api.admin.getCommunityPosts(),
        api.admin.getCommunityGroups(),
      ]);

      setStats({
        totalPosts: statsData.totalPosts ?? 0,
        flaggedContent: statsData.flaggedPosts ?? 0,
        totalGroups: statsData.totalGroups ?? 0,
        activeDiscussions: statsData.activePosts ?? statsData.totalPosts ?? 0,
      });

      const mappedPosts: ForumPost[] = (postsData || []).map((p: any) => {
        const authorName =
          p.profiles?.full_name?.trim() ||
          (p.profiles?.email ? p.profiles.email.split("@")[0] : "User");
        const authorEmail = p.profiles?.email || null;
        const locked = Boolean(p.locked_at);
        return {
          id: p.id,
          author: authorName,
          authorAvatar: initials(authorName),
          authorEmail: authorEmail || undefined,
          authorId: p.user_id || undefined,
          title: titleFromContent(p.content || ""),
          content: p.content || "",
          category: p.community_groups?.category || p.community_groups?.name || "General",
          timestamp: new Date(p.created_at),
          likes: p.likes_count ?? 0,
          replies: p._count?.community_comments ?? 0,
          views: 0,
          flagged: (p.flag_count ?? 0) > 0,
          flagCount: p.flag_count ?? 0,
          status: locked ? "locked" : "active",
          tags: Array.isArray(p.tags) ? p.tags : [],
        };
      });
      setForumPosts(mappedPosts);

      const mappedGroups: Group[] = (groupsData || []).map((g: any) => ({
        id: g.id,
        name: g.name,
        description: g.description || "",
        members: g._count?.community_group_members ?? 0,
        posts: g._count?.community_posts ?? 0,
        category: g.category || "General",
        privacy: (g.privacy || "public") as "public" | "private",
        moderators: [],
        active: !g.archived_at,
        archived_at: g.archived_at,
      }));
      setGroups(mappedGroups);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load community data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const reloadGroupMembers = async (groupId: string) => {
    try {
      const members = await api.admin.getCommunityGroupMembers(groupId);
      setGroupMembers(
        (members || []).map((m: any) => ({
          id: m.user_id,
          name: m.profiles?.full_name?.trim() || m.profiles?.email || "Member",
          email: m.profiles?.email || "",
          role: m.role,
        }))
      );
    } catch {
      setGroupMembers([]);
    }
  };

  useEffect(() => {
    if (!viewingGroup) {
      setGroupMembers([]);
      setMemberSearch("");
      setRecentlyAdded(new Set());
      return;
    }
    reloadGroupMembers(viewingGroup.id);
    // Fetch all users for the add-member picker
    (async () => {
      try {
        const dir = await api.admin.getUsers({ limit: 1000 });
        const list: any[] = Array.isArray((dir as any)?.users)
          ? (dir as any).users
          : Array.isArray(dir)
          ? dir
          : [];
        setAllUsers(
          list.map((u: any) => ({
            id: u.id,
            name: u.full_name?.trim() || u.email?.split("@")[0] || "User",
            email: u.email || "",
          }))
        );
      } catch {
        // fallback: leave empty; current members still show
      }
    })();
  }, [viewingGroup]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    forumPosts.forEach((p) => s.add(p.category));
    return ["all", ...Array.from(s).sort()];
  }, [forumPosts]);

  const filteredPosts = useMemo(() => {
    return forumPosts
      .filter((post) => {
        const matchesSearch =
          post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          post.author.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = filterCategory === "all" || post.category === filterCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [forumPosts, searchQuery, filterCategory]);

  const flaggedPosts = forumPosts.filter((post) => post.flagged);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700";
      case "locked":
        return "bg-yellow-100 text-yellow-700";
      case "deleted":
        return "bg-red-100 text-red-700";
      case "pending":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const handleViewPost = (post: ForumPost) => {
    setViewingPost(post);
  };

  const handleLockToggle = (post: ForumPost) => {
    setLockingPost(post);
  };

  const handleDelete = (post: ForumPost) => {
    setDeletingPost(post);
  };

  const confirmLockToggle = async () => {
    if (!lockingPost) return;
    const nextLocked = lockingPost.status !== "locked";
    try {
      await api.admin.patchCommunityPost(lockingPost.id, { locked: nextLocked });
      toast.success(nextLocked ? "Post locked" : "Post unlocked");
      setLockingPost(null);
      setViewingPost(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Could not update post");
    }
  };

  const confirmDelete = async () => {
    if (!deletingPost) return;
    try {
      await api.admin.deleteCommunityPost(deletingPost.id);
      toast.success("Post removed");
      setDeletingPost(null);
      setViewingPost(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Could not delete post");
    }
  };

  const openEditGroup = (g: Group) => {
    setEditGroupForm({
      name: g.name,
      description: g.description,
      category: g.category,
      privacy: g.privacy,
    });
    setEditGroupOpen(true);
    setGroupMenuOpen(null);
  };

  const saveEditGroup = async () => {
    if (!viewingGroup) return;
    try {
      await api.admin.patchCommunityGroup(viewingGroup.id, {
        name: editGroupForm.name,
        description: editGroupForm.description,
        category: editGroupForm.category,
        privacy: editGroupForm.privacy,
      });
      toast.success("Group updated");
      setEditGroupOpen(false);
      setViewingGroup(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Could not update group");
    }
  };

  const archiveGroup = async (g: Group, archive: boolean) => {
    try {
      await api.admin.patchCommunityGroup(g.id, { archived: archive });
      toast.success(archive ? "Group archived" : "Group restored");
      setGroupMenuOpen(null);
      setViewingGroup(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Could not update group");
    }
  };

  const removeGroup = async (g: Group) => {
    try {
      await api.admin.deleteCommunityGroup(g.id);
      toast.success("Group deleted");
      setGroupMenuOpen(null);
      setViewingGroup(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Could not delete group");
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!viewingGroup) return;
    // Optimistic: add instantly to the members list so the UI updates immediately
    const user = allUsers.find((u) => u.id === userId);
    if (user) {
      setGroupMembers((prev) => [
        ...prev,
        { id: userId, name: user.name, email: user.email, role: "member" },
      ]);
    }
    setRecentlyAdded((prev) => new Set(prev).add(userId));
    setAddMemberSaving(userId);
    try {
      await api.admin.addGroupMember(viewingGroup.id, userId);
      // Background sync — don't await, just keep local state
      void reloadGroupMembers(viewingGroup.id);
      setTimeout(() => {
        setRecentlyAdded((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }, 3000);
    } catch (e) {
      console.error(e);
      toast.error("Could not add member");
      // Rollback optimistic update on failure
      setGroupMembers((prev) => prev.filter((m) => m.id !== userId));
      setRecentlyAdded((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    } finally {
      setAddMemberSaving(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!viewingGroup) return;
    // Optimistic: remove instantly
    setGroupMembers((prev) => prev.filter((m) => m.id !== userId));
    setRemoveMemberSaving(userId);
    try {
      await api.admin.removeGroupMember(viewingGroup.id, userId);
      // Background sync
      void reloadGroupMembers(viewingGroup.id);
    } catch (e) {
      console.error(e);
      toast.error("Could not remove member");
      // Rollback: re-fetch to restore correct state
      await reloadGroupMembers(viewingGroup.id);
    } finally {
      setRemoveMemberSaving(null);
    }
  };

  const handleCreateGroup = async () => {
    if (!createGroupForm.name.trim()) {
      toast.error("Group name is required");
      return;
    }
    setCreateGroupSaving(true);
    try {
      await api.admin.createCommunityGroup({
        name: createGroupForm.name.trim(),
        description: createGroupForm.description.trim(),
        category: createGroupForm.category.trim() || "General",
        privacy: createGroupForm.privacy,
      });
      toast.success("Group created");
      setCreateGroupOpen(false);
      setCreateGroupForm({ name: "", description: "", category: "", privacy: "public" });
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Could not create group");
    } finally {
      setCreateGroupSaving(false);
    }
  };

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-gray-900">Community Management</h1>
          <p className="text-gray-600 mt-1">Manage forum posts, groups, and reported content</p>
        </motion.div>

        {isLoading && (
          <p className="text-sm text-gray-500">Loading community data…</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total Posts</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPosts}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-pink-600">
                <Flag className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Flagged</p>
                <p className="text-2xl font-bold text-gray-900">{stats.flaggedContent}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Groups</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalGroups}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Active posts</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeDiscussions}</p>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-2 shadow-lg border border-gray-100 flex gap-2"
        >
          <button
            type="button"
            onClick={() => setSelectedTab("posts")}
            className={`flex-1 px-4 py-2 rounded-xl font-medium transition-colors ${
              selectedTab === "posts" ? "bg-blue-500 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <MessageSquare className="w-4 h-4 inline mr-2" />
            Forum Posts
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab("groups")}
            className={`flex-1 px-4 py-2 rounded-xl font-medium transition-colors ${
              selectedTab === "groups" ? "bg-blue-500 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Groups
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab("reported")}
            className={`flex-1 px-4 py-2 rounded-xl font-medium transition-colors ${
              selectedTab === "reported" ? "bg-blue-500 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Flag className="w-4 h-4 inline mr-2" />
            Reported ({flaggedPosts.length})
          </button>
        </motion.div>

        {selectedTab === "posts" && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
            >
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search posts by title, content, or author..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c === "all" ? "All Categories" : c}
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {!isLoading && filteredPosts.length === 0 && (
                <p className="text-center text-gray-500 py-8">No posts match your filters.</p>
              )}
              {filteredPosts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-white rounded-2xl p-6 shadow-lg border-2 transition-all ${
                    post.flagged ? "border-red-300" : "border-gray-100"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {post.authorAvatar}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-gray-900">{post.title}</h3>
                            {post.flagged && <Flag className="w-4 h-4 text-red-500" />}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span>{post.author}</span>
                            <span>•</span>
                            <span>{post.category}</span>
                            <span>•</span>
                            <span>{post.timestamp.toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(post.status)}`}>
                            {post.status}
                          </span>
                        </div>
                      </div>

                      <p className="text-gray-700 mb-3 line-clamp-3">{post.content}</p>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {post.tags.map((tag) => (
                          <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg">
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <ThumbsUp className="w-4 h-4" />
                            {post.likes}
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-4 h-4" />
                            {post.replies}
                          </div>
                          <div className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {post.views}
                          </div>
                          {post.flagged && (
                            <div className="flex items-center gap-1 text-red-600">
                              <AlertTriangle className="w-4 h-4" />
                              {post.flagCount} flags
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleViewPost(post)}
                            className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </motion.button>

                          {post.status === "active" ? (
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleLockToggle(post)}
                              className="p-2 rounded-lg hover:bg-yellow-50 text-yellow-600"
                              title="Lock Post"
                            >
                              <Lock className="w-4 h-4" />
                            </motion.button>
                          ) : (
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleLockToggle(post)}
                              className="p-2 rounded-lg hover:bg-green-50 text-green-600"
                              title="Unlock Post"
                            >
                              <Unlock className="w-4 h-4" />
                            </motion.button>
                          )}

                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDelete(post)}
                            className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                            title="Delete Post"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}

        {selectedTab === "groups" && (
          <>
            <div className="flex justify-end">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setCreateGroupOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow"
              >
                <span className="text-lg leading-none">+</span> Create Group
              </motion.button>
            </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid md:grid-cols-2 gap-6"
          >
            {groups.map((group, index) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-gray-900 text-lg">{group.name}</h3>
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          group.privacy === "public" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {group.privacy}
                      </span>
                      {!group.active && (
                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-800">
                          archived
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mb-3">{group.description}</p>
                    <p className="text-xs text-gray-500">Category: {group.category}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <p className="text-gray-600">Members</p>
                    <p className="font-bold text-gray-900">{group.members.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Posts</p>
                    <p className="font-bold text-gray-900">{group.posts}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setViewingGroup(group)}
                    className="flex-1 px-3 py-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm font-medium"
                  >
                    View Details
                  </motion.button>
                  <div className="relative">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setGroupMenuOpen(groupMenuOpen === group.id ? null : group.id)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </motion.button>

                    <AnimatePresence>
                      {groupMenuOpen === group.id && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setViewingGroup(group);
                              openEditGroup(group);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                          >
                            Edit Group
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setGroupMenuOpen(null);
                              setViewingGroup(group);
                              toast.info("Moderators are listed on the group detail view from live membership data.");
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                          >
                            Manage Moderators
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setGroupMenuOpen(null);
                              toast.info("Open your analytics product for group engagement; member and post counts are shown on each card.");
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                          >
                            View Analytics
                          </button>
                          <div className="border-t border-gray-200 my-1" />
                          <button
                            type="button"
                            onClick={() => {
                              setGroupMenuOpen(null);
                              if (group.active) {
                                if (window.confirm(`Archive ${group.name}?`)) archiveGroup(group, true);
                              } else if (window.confirm(`Restore ${group.name}?`)) {
                                archiveGroup(group, false);
                              }
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-yellow-600 hover:bg-gray-100"
                          >
                            {group.active ? "Archive Group" : "Restore Group"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setGroupMenuOpen(null);
                              if (window.confirm(`Delete ${group.name}? This removes the group and its posts.`)) removeGroup(group);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                          >
                            Delete Group
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
          </>
        )}

        {selectedTab === "reported" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6">Flagged Content ({flaggedPosts.length})</h2>

            {flaggedPosts.length === 0 ? (
              <p className="text-gray-500">No flagged posts.</p>
            ) : (
              <div className="space-y-4">
                {flaggedPosts.map((post, index) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="border-2 border-red-300 rounded-xl p-5 bg-red-50"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {post.authorAvatar}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-gray-900">{post.title}</h3>
                              <Flag className="w-4 h-4 text-red-600" />
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <span>{post.author}</span>
                              <span>•</span>
                              <span>{post.category}</span>
                            </div>
                          </div>

                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(post.status)}`}>
                            {post.status}
                          </span>
                        </div>

                        <p className="text-gray-700 mb-3">{post.content}</p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-red-600 font-medium">
                            <AlertTriangle className="w-4 h-4" />
                            {post.flagCount} flags reported
                          </div>

                          <div className="flex gap-2">
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleViewPost(post)}
                              className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"
                            >
                              <Eye className="w-4 h-4" />
                            </motion.button>

                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleLockToggle(post)}
                              className="p-2 rounded-lg hover:bg-yellow-50 text-yellow-600"
                            >
                              <Lock className="w-4 h-4" />
                            </motion.button>

                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleDelete(post)}
                              className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        <AnimatePresence>
          {viewingPost && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                onClick={() => setViewingPost(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={() => setViewingPost(null)}
              >
                <div
                  className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Post Details</h2>
                      <p className="text-sm text-gray-600 mt-1">{viewingPost.title}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewingPost(null)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  <div className="p-6 space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl">
                        {viewingPost.authorAvatar}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{viewingPost.author}</h3>
                        {viewingPost.authorEmail ? (
                          <p className="text-sm text-gray-600">{viewingPost.authorEmail}</p>
                        ) : null}
                        <p className="text-sm text-gray-600">{viewingPost.timestamp.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <Tag className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Category</p>
                          <p className="font-medium text-gray-900">{viewingPost.category}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <Flag className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Status</p>
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(viewingPost.status)}`}>
                            {viewingPost.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Content</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{viewingPost.content}</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {viewingPost.tags.map((tag) => (
                          <span key={tag} className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-lg">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Engagement</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <ThumbsUp className="w-5 h-5 text-gray-600 mx-auto mb-1" />
                          <p className="text-2xl font-bold text-gray-900">{viewingPost.likes}</p>
                          <p className="text-xs text-gray-600">Likes</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <MessageSquare className="w-5 h-5 text-gray-600 mx-auto mb-1" />
                          <p className="text-2xl font-bold text-gray-900">{viewingPost.replies}</p>
                          <p className="text-xs text-gray-600">Replies</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <Eye className="w-5 h-5 text-gray-600 mx-auto mb-1" />
                          <p className="text-2xl font-bold text-gray-900">{viewingPost.views}</p>
                          <p className="text-xs text-gray-600">Views</p>
                        </div>
                      </div>
                    </div>

                    {viewingPost.flagged && (
                      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-red-700">
                          <AlertTriangle className="w-5 h-5" />
                          <span className="font-semibold">This post has been flagged {viewingPost.flagCount} times</span>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t">
                      <button
                        type="button"
                        onClick={() => {
                          setViewingPost(null);
                          handleLockToggle(viewingPost);
                        }}
                        className="flex-1 px-4 py-3 rounded-xl bg-yellow-600 hover:bg-yellow-700 text-white font-medium"
                      >
                        {viewingPost.status === "active" ? "Lock Post" : "Unlock Post"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setViewingPost(null);
                          handleDelete(viewingPost);
                        }}
                        className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium"
                      >
                        Delete Post
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewingPost(null)}
                        className="px-4 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {lockingPost && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                onClick={() => setLockingPost(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={() => setLockingPost(null)}
              >
                <div
                  className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                        lockingPost.status === "active" ? "bg-yellow-100" : "bg-green-100"
                      }`}
                    >
                      {lockingPost.status === "active" ? (
                        <Lock className="w-6 h-6 text-yellow-600" />
                      ) : (
                        <Unlock className="w-6 h-6 text-green-600" />
                      )}
                    </div>

                    <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
                      {lockingPost.status === "active" ? "Lock Post?" : "Unlock Post?"}
                    </h2>
                    <p className="text-gray-600 text-center mb-6">
                      {lockingPost.status === "active"
                        ? "Locking prevents new replies on this post."
                        : "Unlocking allows replies again."}
                    </p>

                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                      <p className="text-sm font-semibold text-gray-900 mb-1">{lockingPost.title}</p>
                      <p className="text-xs text-gray-600">by {lockingPost.author}</p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={confirmLockToggle}
                        className={`flex-1 px-4 py-3 rounded-xl text-white font-medium ${
                          lockingPost.status === "active" ? "bg-yellow-600 hover:bg-yellow-700" : "bg-green-600 hover:bg-green-700"
                        }`}
                      >
                        {lockingPost.status === "active" ? "Lock" : "Unlock"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setLockingPost(null)}
                        className="flex-1 px-4 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {deletingPost && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                onClick={() => setDeletingPost(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={() => setDeletingPost(null)}
              >
                <div
                  className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                      <Trash2 className="w-6 h-6 text-red-600" />
                    </div>

                    <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Delete Post?</h2>
                    <p className="text-gray-600 text-center mb-6">This soft-deletes the post for users. Comments are removed with the post.</p>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                      <p className="text-sm font-semibold text-gray-900 mb-1">{deletingPost.title}</p>
                      <p className="text-xs text-gray-600">by {deletingPost.author}</p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={confirmDelete}
                        className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium"
                      >
                        Delete
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingPost(null)}
                        className="flex-1 px-4 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {viewingGroup && !editGroupOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                onClick={() => setViewingGroup(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={() => setViewingGroup(null)}
              >
                <div
                  className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Group Details</h2>
                      <p className="text-sm text-gray-600 mt-1">{viewingGroup.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewingGroup(null)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  <div className="p-6 space-y-6">
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl">
                          {viewingGroup.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-xl text-gray-900">{viewingGroup.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`px-2 py-1 rounded-lg text-xs font-medium ${
                                viewingGroup.privacy === "public" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {viewingGroup.privacy}
                            </span>
                            <span
                              className={`px-2 py-1 rounded-lg text-xs font-medium ${
                                viewingGroup.active ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                              }`}
                            >
                              {viewingGroup.active ? "Active" : "Archived"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-700">{viewingGroup.description}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <Users className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{groupMembers.length}</p>
                        <p className="text-xs text-gray-600">Members</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <MessageSquare className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{viewingGroup.posts}</p>
                        <p className="text-xs text-gray-600">Posts</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <Tag className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-gray-900">{viewingGroup.category}</p>
                        <p className="text-xs text-gray-600">Category</p>
                      </div>
                    </div>

                    {/* Current members */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">
                        Members ({groupMembers.length})
                      </h3>
                      <div className="bg-gray-50 rounded-lg divide-y divide-gray-200 max-h-48 overflow-y-auto">
                        {groupMembers.length === 0 ? (
                          <p className="text-sm text-gray-500 p-3">No members yet.</p>
                        ) : (
                          groupMembers.map((m) => (
                            <div key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 truncate">{m.name}</p>
                                <p className="text-xs text-gray-500 truncate">{m.email}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 text-xs">
                                  {m.role || "member"}
                                </span>
                                <button
                                  type="button"
                                  disabled={removeMemberSaving === m.id}
                                  onClick={() => handleRemoveMember(m.id)}
                                  className="text-red-500 hover:text-red-700 disabled:opacity-40 text-xs font-medium"
                                  title="Remove from group"
                                >
                                  {removeMemberSaving === m.id ? "…" : "Remove"}
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Add members from all-users list */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-gray-900">Add Members</h3>
                        <span className="text-xs text-green-600 font-medium">✓ Saved automatically</span>
                      </div>
                      <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search users by name or email…"
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-52 overflow-y-auto">
                        {allUsers
                          .filter((u) => {
                            const q = memberSearch.toLowerCase();
                            return (
                              !q ||
                              u.name.toLowerCase().includes(q) ||
                              u.email.toLowerCase().includes(q)
                            );
                          })
                          .map((u) => {
                            const isMember = groupMembers.some((m) => m.id === u.id);
                            return (
                              <div key={u.id} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50">
                                <div className="min-w-0">
                                  <p className="font-medium text-gray-900 truncate">{u.name}</p>
                                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                                </div>
                                {isMember ? (
                                  recentlyAdded.has(u.id) ? (
                                    <span className="shrink-0 ml-2 flex items-center gap-1 text-xs text-green-600 font-semibold">
                                      <span>✓</span> Added
                                    </span>
                                  ) : (
                                    <span className="shrink-0 ml-2 text-xs text-gray-400 font-medium">Already in group</span>
                                  )
                                ) : (
                                  <button
                                    type="button"
                                    disabled={addMemberSaving === u.id}
                                    onClick={() => handleAddMember(u.id)}
                                    className="shrink-0 ml-2 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-medium"
                                  >
                                    {addMemberSaving === u.id ? "Adding…" : "Add"}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        {allUsers.length === 0 && (
                          <p className="text-sm text-gray-500 p-3">Loading users…</p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t">
                      <button
                        type="button"
                        onClick={() => openEditGroup(viewingGroup)}
                        className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium"
                      >
                        Edit Group
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewingGroup(null)}
                        className="flex-1 px-4 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium"
                      >
                        ✓ Done — Changes Saved
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {editGroupOpen && viewingGroup && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
                onClick={() => setEditGroupOpen(false)}
              />
              <motion.div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <div
                  className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-bold mb-4">Edit group</h3>
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2"
                      value={editGroupForm.name}
                      onChange={(e) => setEditGroupForm((f) => ({ ...f, name: e.target.value }))}
                    />
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                      className="w-full border rounded-lg px-3 py-2 min-h-[80px]"
                      value={editGroupForm.description}
                      onChange={(e) => setEditGroupForm((f) => ({ ...f, description: e.target.value }))}
                    />
                    <label className="block text-sm font-medium text-gray-700">Category</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2"
                      value={editGroupForm.category}
                      onChange={(e) => setEditGroupForm((f) => ({ ...f, category: e.target.value }))}
                    />
                    <label className="block text-sm font-medium text-gray-700">Privacy</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2"
                      value={editGroupForm.privacy}
                      onChange={(e) =>
                        setEditGroupForm((f) => ({
                          ...f,
                          privacy: e.target.value as "public" | "private",
                        }))
                      }
                    >
                      <option value="public">public</option>
                      <option value="private">private</option>
                    </select>
                  </div>
                  <div className="flex gap-2 mt-6 justify-end">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg bg-gray-100"
                      onClick={() => setEditGroupOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white"
                      onClick={saveEditGroup}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Create Group Modal */}
      <AnimatePresence>
        {createGroupOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
              onClick={() => setCreateGroupOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4"
              onClick={() => setCreateGroupOpen(false)}
            >
              <div
                className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xl font-bold text-gray-900">Create New Group</h3>
                  <button
                    type="button"
                    onClick={() => setCreateGroupOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Group Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g. Anxiety Support"
                      value={createGroupForm.name}
                      onChange={(e) => setCreateGroupForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 min-h-[80px] focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      placeholder="What is this group about?"
                      value={createGroupForm.description}
                      onChange={(e) => setCreateGroupForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g. Mental Health, General"
                      value={createGroupForm.category}
                      onChange={(e) => setCreateGroupForm((f) => ({ ...f, category: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Privacy</label>
                    <select
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={createGroupForm.privacy}
                      onChange={(e) =>
                        setCreateGroupForm((f) => ({
                          ...f,
                          privacy: e.target.value as "public" | "private",
                        }))
                      }
                    >
                      <option value="public">Public — anyone can join</option>
                      <option value="private">Private — invite only</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={handleCreateGroup}
                    disabled={createGroupSaving}
                    className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium"
                  >
                    {createGroupSaving ? "Creating…" : "Create Group"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateGroupOpen(false)}
                    className="px-4 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AdminLayoutNew>
  );
}
