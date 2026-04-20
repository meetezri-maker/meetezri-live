import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "motion/react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { AppLayout } from "@/app/components/AppLayout";
import {
  Users,
  MessageCircle,
  Share2,
  Plus,
  TrendingUp,
  Clock,
  Eye,
  ThumbsUp,
  MessageSquare,
  Search,
  Filter,
  Globe,
  Lock,
  ArrowLeft,
  Loader2,
  Shield,
} from "lucide-react";
import { AnimatedCard } from "@/app/components/AnimatedCard";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { toast } from "sonner";
import { Switch } from "@/app/components/ui/switch";
import { Label } from "@/app/components/ui/label";

type FeedPost = {
  id: string;
  author: { name: string; avatarUrl: string | null; role: "member" | "moderator" | "companion" };
  isByCurrentUser?: boolean;
  /** Present when the author shows a name (not Anonymous) — opens view profile. */
  authorUserId?: string | null;
  content: string;
  category: string;
  createdAt: string;
  views: number;
  likes: number;
  comments: number;
  tags: string[];
};

type FeedGroup = {
  id: string;
  name: string;
  description: string;
  members: number;
  posts: number;
  category: string;
  isJoined: boolean;
  privacy: "public" | "private";
};

type Overview = {
  members: number;
  posts: number;
  groups: number;
  comments: number;
  activeNow: number;
  trendingTags: { tag: string; posts: number }[];
};

type PrivacyCommunity = {
  showDisplayNameInCommunity?: boolean;
  showAvatarInCommunity?: boolean;
};

export function Community() {
  const { profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<"feed" | "groups" | "trending">("feed");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostCategory, setNewPostCategory] = useState("General Discussion");
  const [newPostTags, setNewPostTags] = useState("");
  const [newPostGroupId, setNewPostGroupId] = useState<string>("");

  const [overview, setOverview] = useState<Overview | null>(null);
  const [postsData, setPostsData] = useState<FeedPost[]>([]);
  const [groupsData, setGroupsData] = useState<FeedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [groupActionId, setGroupActionId] = useState<string | null>(null);

  const privacy = (profile?.privacy_settings || {}) as PrivacyCommunity;
  const showDisplayName = privacy.showDisplayNameInCommunity !== false;
  const showAvatar = privacy.showAvatarInCommunity !== false;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, posts, groups] = await Promise.all([
        api.getCommunityOverview(),
        api.getCommunityPosts(40),
        api.getCommunityGroups(),
      ]);
      setOverview(ov as Overview);
      setPostsData(posts as FeedPost[]);
      setGroupsData(groups as FeedGroup[]);
    } catch (e) {
      console.error(e);
      toast.error("Could not load community. Try again later.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const persistPrivacy = async (patch: Partial<PrivacyCommunity>) => {
    const next = {
      ...(profile?.privacy_settings as object),
      ...patch,
    };
    try {
      await api.updateProfile({ privacy_settings: next });
      await refreshProfile();
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    }
  };

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return postsData;
    return postsData.filter(
      (p) =>
        p.content.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.author.name.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [postsData, searchQuery]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groupsData;
    return groupsData.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q)
    );
  }, [groupsData, searchQuery]);

  const trendingTopics = overview?.trendingTags?.length
    ? overview.trendingTags
    : [];

  const getRoleBadge = (role: string) => {
    const badges = {
      member: { bg: "bg-gray-200 dark:bg-slate-700", text: "text-gray-700 dark:text-slate-200", label: "Member" },
      moderator: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-200", label: "Moderator" },
      companion: { bg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-700 dark:text-purple-200", label: "Companion" },
    };
    return badges[role as keyof typeof badges] || badges.member;
  };

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  const handleLikePost = async (postId: string) => {
    try {
      const res = (await api.likeCommunityPost(postId)) as { likes: number };
      setPostsData((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, likes: res.likes } : p))
      );
    } catch {
      toast.error("Could not update like");
    }
  };

  const handleCommentPost = async (postId: string) => {
    const content = window.prompt("Write your comment");
    if (!content || !content.trim()) return;
    try {
      const res = (await api.addCommunityPostComment(postId, content.trim())) as { comments: number };
      setPostsData((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comments: res.comments } : p))
      );
      toast.success("Comment posted");
    } catch {
      toast.error("Could not post comment");
    }
  };

  const handleSharePost = async (postId: string) => {
    const url = `${window.location.origin}/app/settings/community#post-${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) {
      toast.error("Write something before posting.");
      return;
    }
    setPosting(true);
    try {
      const extra = newPostTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const tags = [newPostCategory, ...extra]
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20);
      await api.createCommunityPost({
        content: newPostContent.trim(),
        tags: tags.length ? tags : undefined,
        group_id: newPostGroupId || undefined,
      });
      toast.success("Post published");
      setNewPostContent("");
      setNewPostTags("");
      setNewPostGroupId("");
      setNewPostCategory("General Discussion");
      setShowNewPostModal(false);
      await loadData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to publish");
    } finally {
      setPosting(false);
    }
  };

  const toggleGroup = async (g: FeedGroup) => {
    setGroupActionId(g.id);
    try {
      if (g.isJoined) {
        await api.leaveCommunityGroup(g.id);
        toast.success(`Left ${g.name}`);
      } else {
        await api.joinCommunityGroup(g.id);
        toast.success(`Joined ${g.name}`);
      }
      await loadData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not update membership");
    } finally {
      setGroupActionId(null);
    }
  };

  const stats = overview
    ? {
        members: overview.members,
        posts: overview.posts,
        groups: overview.groups,
        activeNow: overview.activeNow,
      }
    : { members: 0, posts: 0, groups: 0, activeNow: 0 };

  if (loading && !overview) {
    return (
      <AppLayout>
        <div className="min-h-[50vh] flex items-center justify-center bg-gray-50 dark:bg-slate-950">
          <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <Link
              to="/app/settings"
              className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200 mb-6 transition-colors font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Settings
            </Link>

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Community</h1>
                  <p className="text-gray-600 dark:text-slate-400">Connect, share, and support each other</p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl text-white font-semibold flex items-center gap-2 hover:shadow-lg hover:shadow-purple-500/50 transition-all"
                onClick={() => setShowNewPostModal(true)}
              >
                <Plus className="w-5 h-5" />
                New Post
              </motion.button>
            </div>

            {/* Privacy & participation (saved to profile.privacy_settings) */}
            <div className="mb-6 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5 shadow-sm">
              <div className="flex items-start gap-3 mb-4">
                <Shield className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">Community preferences</h2>
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    These apply to this page and how you appear to others. They are stored with your account.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 p-3">
                  <div>
                    <Label htmlFor="comm-avatar" className="text-sm font-medium">
                      Show my profile picture
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      When off, your avatar is hidden in community posts and member profile.
                    </p>
                  </div>
                  <Switch
                    id="comm-avatar"
                    checked={showAvatar}
                    onCheckedChange={(v) => persistPrivacy({ showAvatarInCommunity: v })}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 p-3">
                  <div>
                    <Label htmlFor="comm-name" className="text-sm font-medium">
                      Show my display name
                    </Label>
                    <p className="text-xs text-muted-foreground">When off, your posts show as “Anonymous”.</p>
                  </div>
                  <Switch
                    id="comm-name"
                    checked={showDisplayName}
                    onCheckedChange={(v) => persistPrivacy({ showDisplayNameInCommunity: v })}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <AnimatedCard delay={0.1}>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 text-center shadow-sm">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.members.toLocaleString()}</p>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Members</p>
                </div>
              </AnimatedCard>
              <AnimatedCard delay={0.15}>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 text-center shadow-sm">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.posts.toLocaleString()}</p>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Posts</p>
                </div>
              </AnimatedCard>
              <AnimatedCard delay={0.2}>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 text-center shadow-sm">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.groups}</p>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Groups</p>
                </div>
              </AnimatedCard>
              <AnimatedCard delay={0.25}>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 text-center shadow-sm">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-500 flex items-center justify-center gap-2">
                    <span className="w-2 h-2 bg-green-600 dark:bg-green-500 rounded-full animate-pulse" />
                    {stats.activeNow}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Active (30m)</p>
                </div>
              </AnimatedCard>
            </div>
          </div>

          <div className="mb-6 flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  { id: "feed" as const, label: "Feed", icon: MessageCircle },
                  { id: "groups" as const, label: "Groups", icon: Users },
                  { id: "trending" as const, label: "Trending", icon: TrendingUp },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <motion.button
                    key={tab.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-6 py-3 rounded-xl flex items-center gap-2 font-semibold transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md"
                        : "bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-500 hover:bg-gray-50 dark:hover:bg-slate-700"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </motion.button>
                );
              })}
            </div>

            <div className="flex-1 relative min-w-0">
              <Search className="w-5 h-5 text-gray-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search posts, groups, or topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 transition-all"
              />
            </div>

            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all lg:self-center"
              aria-label="Filter"
            >
              <Filter className="w-5 h-5" />
            </motion.button>
          </div>

          {/* items-start: avoid stretching feed column to sidebar height (AnimatedCard uses h-full). */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-start">
            <div className="lg:col-span-2 space-y-6 min-w-0">
              {activeTab === "feed" &&
                (filteredPosts.length === 0 ? (
                  <div className="text-center py-16 text-gray-500 dark:text-slate-400 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                    No posts yet. Be the first to share—or check back soon.
                  </div>
                ) : (
                  filteredPosts.map((post, index) => {
                    const authorRowInteractive =
                      "flex items-start gap-4 mb-4 rounded-xl -mx-2 px-2 pt-2 pb-1 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50";
                    const authorRowStatic = "flex items-start gap-4 mb-4";
                    const authorHeader = (
                      <>
                        <div className="shrink-0">
                          {post.author.avatarUrl ? (
                            <img
                              src={post.author.avatarUrl}
                              alt=""
                              className="w-12 h-12 rounded-full object-cover border border-gray-200 dark:border-slate-700"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-200 to-blue-200 dark:from-purple-900 dark:to-blue-900 flex items-center justify-center text-sm font-bold text-purple-900 dark:text-purple-100">
                              {initials(post.author.name)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">{post.author.name}</h3>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${getRoleBadge(post.author.role).bg} ${getRoleBadge(post.author.role).text}`}
                            >
                              {getRoleBadge(post.author.role).label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400 flex-wrap">
                            <span>{post.category}</span>
                            <span>•</span>
                            <Clock className="w-4 h-4 shrink-0" />
                            <span>
                              {(() => {
                                try {
                                  return formatDistanceToNow(parseISO(post.createdAt), { addSuffix: true });
                                } catch {
                                  return "recently";
                                }
                              })()}
                            </span>
                          </div>
                        </div>
                      </>
                    );
                    return (
                    <AnimatedCard key={post.id} delay={index * 0.05}>
                      <div
                        id={`post-${post.id}`}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-lg transition-all"
                      >
                        {post.authorUserId ? (
                          <Link
                            to={`/app/profile/${post.authorUserId}`}
                            className={authorRowInteractive}
                            aria-label="View profile"
                          >
                            {authorHeader}
                          </Link>
                        ) : (
                          <div className={authorRowStatic}>{authorHeader}</div>
                        )}

                        <p className="text-gray-700 dark:text-slate-300 mb-4 leading-relaxed whitespace-pre-wrap">{post.content}</p>

                        <div className="flex flex-wrap gap-2 mb-4">
                          {post.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-slate-800">
                          <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-slate-400">
                            <div className="flex items-center gap-2">
                              <Eye className="w-4 h-4" />
                              {post.views}
                            </div>
                            <button
                              type="button"
                              className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              onClick={() => handleLikePost(post.id)}
                              aria-label="Like post"
                            >
                              <ThumbsUp className="w-4 h-4" />
                              {post.likes}
                            </button>
                            <button
                              type="button"
                              className="flex items-center gap-2 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                              onClick={() => handleCommentPost(post.id)}
                              aria-label="Comment on post"
                            >
                              <MessageSquare className="w-4 h-4" />
                              {post.comments}
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                              type="button"
                              onClick={() => handleSharePost(post.id)}
                            >
                              <Share2 className="w-5 h-5" />
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </AnimatedCard>
                    );
                  })
                ))}

              {activeTab === "groups" &&
                (filteredGroups.length === 0 ? (
                  <div className="text-center py-16 text-gray-500 dark:text-slate-400 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                    No groups available yet.
                  </div>
                ) : (
                  filteredGroups.map((group, index) => (
                    <AnimatedCard key={group.id} delay={index * 0.05}>
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-lg transition-all">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{group.name}</h3>
                              {group.privacy === "private" ? (
                                <Lock className="w-4 h-4 text-gray-600 dark:text-slate-400 shrink-0" />
                              ) : (
                                <Globe className="w-4 h-4 text-green-600 dark:text-green-500 shrink-0" />
                              )}
                            </div>
                            <p className="text-gray-600 dark:text-slate-400 mb-3">{group.description}</p>
                            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {group.members.toLocaleString()} members
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageCircle className="w-4 h-4" />
                                {group.posts} posts
                              </span>
                            </div>
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            disabled={groupActionId === group.id}
                            onClick={() => toggleGroup(group)}
                            className={`shrink-0 px-6 py-2 rounded-xl font-semibold transition-all ${
                              group.isJoined
                                ? "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-2 border-gray-300 dark:border-slate-700"
                                : "bg-gradient-to-r from-purple-500 to-blue-500 text-white"
                            }`}
                          >
                            {groupActionId === group.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : group.isJoined ? (
                              "Joined"
                            ) : (
                              "Join Group"
                            )}
                          </motion.button>
                        </div>
                      </div>
                    </AnimatedCard>
                  ))
                ))}

              {activeTab === "trending" && (
                <div className="space-y-4">
                  {trendingTopics.length === 0 ? (
                    <div className="text-center py-16 text-gray-500 dark:text-slate-400 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                      Not enough activity for trending tags yet.
                    </div>
                  ) : (
                    trendingTopics.map((topic, index) => (
                      <AnimatedCard key={topic.tag} delay={index * 0.05}>
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-lg transition-all">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">#{topic.tag}</h3>
                              <p className="text-gray-600 dark:text-slate-400">{topic.posts} posts</p>
                            </div>
                            <TrendingUp className="w-8 h-8 text-purple-600 dark:text-purple-500" />
                          </div>
                        </div>
                      </AnimatedCard>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <AnimatedCard delay={0.3}>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-500" />
                    Trending Topics
                  </h3>
                  <div className="space-y-3">
                    {trendingTopics.slice(0, 5).map((topic) => (
                      <div
                        key={topic.tag}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/80 rounded-xl border border-transparent"
                      >
                        <span className="text-gray-700 dark:text-slate-200 font-medium">#{topic.tag}</span>
                        <span className="text-sm text-gray-600 dark:text-slate-400">{topic.posts}</span>
                      </div>
                    ))}
                    {trendingTopics.length === 0 && (
                      <p className="text-sm text-muted-foreground">No tags yet.</p>
                    )}
                  </div>
                </div>
              </AnimatedCard>

              <AnimatedCard delay={0.4}>
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/40 dark:to-blue-950/40 rounded-2xl border border-purple-200 dark:border-purple-900/50 p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Community Guidelines</h3>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600">•</span>
                      Be respectful and supportive
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600">•</span>
                      Share your experiences thoughtfully
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600">•</span>
                      Maintain privacy and confidentiality
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600">•</span>
                      Report harmful content to support
                    </li>
                  </ul>
                </div>
              </AnimatedCard>
            </div>
          </div>
        </div>
      </div>

      {showNewPostModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-blue-900/20 dark:bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={() => !posting && setShowNewPostModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-2xl p-8 w-full max-w-2xl shadow-2xl border border-gray-200 dark:border-slate-800"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Create a New Post</h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors"
                onClick={() => !posting && setShowNewPostModal(false)}
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="Write your post here..."
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 transition-all resize-none"
                rows={6}
                disabled={posting}
              />

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <label className="text-gray-700 dark:text-slate-300 font-medium shrink-0">Category:</label>
                <select
                  value={newPostCategory}
                  onChange={(e) => setNewPostCategory(e.target.value)}
                  className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 transition-all"
                  disabled={posting}
                >
                  <option value="General Discussion">General Discussion</option>
                  <option value="Wins & Progress">Wins & Progress</option>
                  <option value="Support & Advice">Support & Advice</option>
                  <option value="Professional Insights">Professional Insights</option>
                  <option value="Community Events">Community Events</option>
                </select>
              </div>

              {groupsData.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <label className="text-gray-700 dark:text-slate-300 font-medium shrink-0">Group (optional):</label>
                  <select
                    value={newPostGroupId}
                    onChange={(e) => setNewPostGroupId(e.target.value)}
                    className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500"
                    disabled={posting}
                  >
                    <option value="">No group</option>
                    {groupsData
                      .filter((g) => g.privacy === "public" || g.isJoined)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <label className="text-gray-700 dark:text-slate-300 font-medium shrink-0">Tags:</label>
                <input
                  type="text"
                  value={newPostTags}
                  onChange={(e) => setNewPostTags(e.target.value)}
                  placeholder="Add tags (comma-separated)"
                  className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 transition-all"
                  disabled={posting}
                />
              </div>

              <motion.button
                whileHover={{ scale: posting ? 1 : 1.02 }}
                whileTap={{ scale: posting ? 1 : 0.98 }}
                className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl text-white font-semibold text-lg flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-60"
                onClick={handleCreatePost}
                disabled={posting}
                type="button"
              >
                {posting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                Post
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AppLayout>
  );
}
