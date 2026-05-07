import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  Pencil,
  Trash2,
  Send,
  Smile,
} from "lucide-react";
import { AnimatedCard } from "@/app/components/AnimatedCard";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { toast } from "sonner";
import { Switch } from "@/app/components/ui/switch";
import { Label } from "@/app/components/ui/label";
import { cn } from "@/app/components/ui/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
import { EmojiText } from "@/components/ui/EmojiText";

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
  /** True when the signed-in user has liked this post (one reaction per user). */
  likedByMe?: boolean;
  comments: number;
  tags: string[];
};

function normalizeCommunityTopicLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/\s+/g, " ");
}

/** Tags shown under a post as hashtags — excludes any tag that duplicates the category line. */
function feedHashtagsExcludingDisplayedCategory(post: FeedPost): string[] {
  const catKey = normalizeCommunityTopicLabel(post.category ?? "");
  if (!catKey) return post.tags;
  return post.tags.filter((tag) => normalizeCommunityTopicLabel(tag) !== catKey);
}

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

type PostComment = {
  id: string;
  userId: string;
  isByCurrentUser: boolean;
  author: { name: string; avatarUrl: string | null; role: "member" | "moderator" | "companion" };
  content: string;
  createdAt: string;
};

const COMMENT_ICONS = ["💬", "🧠", "🌿", "⭐", "📝", "❤️", "🙏", "🔥"] as const;
const EMOJI_KEYBOARD = [
  "😀","😁","😂","🤣","😊","😍","😘","😎","🥹","😭","😤","😴",
  "👍","👎","👏","🙏","💪","🫶","❤️","💜","💙","💚","💛","🧡",
  "🔥","✨","⭐","🌟","🌿","🍀","🌈","☀️","🌙","☕","🧠","📝",
] as const;

function splitIconFromComment(content: string): { icon: string | null; text: string } {
  const raw = (content ?? "").trim();
  if (!raw) return { icon: null, text: "" };
  for (const ic of COMMENT_ICONS) {
    if (raw === ic) return { icon: ic, text: "" };
    if (raw.startsWith(`${ic} `)) return { icon: ic, text: raw.slice(ic.length).trimStart() };
  }
  return { icon: null, text: raw };
}

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
  // Group posting is admin-managed; end-users post to the main feed.

  const [overview, setOverview] = useState<Overview | null>(null);
  const [postsData, setPostsData] = useState<FeedPost[]>([]);
  const [groupsData, setGroupsData] = useState<FeedGroup[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [posting, setPosting] = useState(false);
  const [groupActionId, setGroupActionId] = useState<string | null>(null);
  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null);
  const [commentsByPostId, setCommentsByPostId] = useState<Record<string, PostComment[]>>({});
  const [commentsLoadingByPostId, setCommentsLoadingByPostId] = useState<Record<string, boolean>>({});
  const [commentDraftByPostId, setCommentDraftByPostId] = useState<Record<string, string>>({});
  const [commentSendingByPostId, setCommentSendingByPostId] = useState<Record<string, boolean>>({});
  const [emojiPickerOpenByPostId, setEmojiPickerOpenByPostId] = useState<Record<string, boolean>>({});
  const [emojiPickerQueryByPostId, setEmojiPickerQueryByPostId] = useState<Record<string, string>>({});
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editTagsDraft, setEditTagsDraft] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [editingCommentByPostId, setEditingCommentByPostId] = useState<Record<string, string | null>>({});
  const [editCommentDraftByPostId, setEditCommentDraftByPostId] = useState<Record<string, string>>({});
  const [editCommentSavingByPostId, setEditCommentSavingByPostId] = useState<Record<string, boolean>>({});
  const [emojiPickerOpenEditByPostId, setEmojiPickerOpenEditByPostId] = useState<Record<string, boolean>>({});
  const [emojiPickerQueryEditByPostId, setEmojiPickerQueryEditByPostId] = useState<Record<string, string>>({});

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const posts = (await api.getCommunityPosts(40)) as FeedPost[];
      setPostsData(Array.isArray(posts) ? posts : []);
    } catch (e) {
      console.error(e);
      toast.error("Could not load posts. Try again later.");
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  const loadMeta = useCallback(async (opts?: { includeGroups?: boolean }) => {
    setLoadingMeta(true);
    try {
      const [ov, groups] = await Promise.all([
        api.getCommunityOverview(),
        opts?.includeGroups ? api.getCommunityGroups() : Promise.resolve(groupsData),
      ]);
      setOverview(ov as Overview);
      if (opts?.includeGroups) setGroupsData(groups as FeedGroup[]);
    } catch (e) {
      console.error(e);
      // meta is non-blocking; keep UI usable
    } finally {
      setLoadingMeta(false);
    }
  }, [groupsData]);

  useEffect(() => {
    // Fast: show feed ASAP, load meta in background.
    void loadPosts();
    void loadMeta({ includeGroups: false });
  }, [loadPosts, loadMeta]);

  const [privacyDraft, setPrivacyDraft] = useState<PrivacyCommunity>(() => {
    const ps = (profile?.privacy_settings || {}) as PrivacyCommunity;
    return {
      showDisplayNameInCommunity: ps.showDisplayNameInCommunity !== false,
      showAvatarInCommunity: ps.showAvatarInCommunity !== false,
    };
  });

  const showDisplayName = privacyDraft.showDisplayNameInCommunity !== false;
  const showAvatar = privacyDraft.showAvatarInCommunity !== false;

  useEffect(() => {
    const ps = (profile?.privacy_settings || {}) as PrivacyCommunity;
    setPrivacyDraft({
      showDisplayNameInCommunity: ps.showDisplayNameInCommunity !== false,
      showAvatarInCommunity: ps.showAvatarInCommunity !== false,
    });
  }, [profile?.privacy_settings]);

  const persistTimerRef = useRef<number | null>(null);
  const pendingPrivacyRef = useRef<PrivacyCommunity | null>(null);

  const flushPrivacySave = useCallback(async () => {
    const pending = pendingPrivacyRef.current;
    if (!pending) return;
    pendingPrivacyRef.current = null;
    const next = {
      ...(profile?.privacy_settings as object),
      ...pending,
    };
    try {
      await api.updateProfile({ privacy_settings: next });
      // Refresh in background so UI stays snappy.
      void refreshProfile();
    } catch {
      toast.error("Failed to save settings");
    }
  }, [profile?.privacy_settings, refreshProfile]);

  const persistPrivacy = (patch: Partial<PrivacyCommunity>) => {
    setPrivacyDraft((prev) => {
      const next = { ...prev, ...patch };
      pendingPrivacyRef.current = next;
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = window.setTimeout(() => {
        void flushPrivacySave();
      }, 350);
      return next;
    });
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

  const trendingTopics = overview?.trendingTags?.length ? overview.trendingTags : [];

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
      const res = (await api.likeCommunityPost(postId)) as { likes: number; likedByMe: boolean };
      setPostsData((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, likes: res.likes, likedByMe: res.likedByMe } : p
        )
      );
    } catch {
      toast.error("Could not update like");
    }
  };

  const toggleCommentsForPost = async (post: FeedPost) => {
    const nextOpen = openCommentsPostId === post.id ? null : post.id;
    setOpenCommentsPostId(nextOpen);
    if (!nextOpen) return;

    // Lazy-load comments and cache per post.
    if (commentsByPostId[post.id]?.length) return;
    setCommentsLoadingByPostId((m) => ({ ...m, [post.id]: true }));
    try {
      const data = (await api.getCommunityPostComments(post.id)) as PostComment[];
      setCommentsByPostId((m) => ({ ...m, [post.id]: Array.isArray(data) ? data : [] }));
    } catch {
      toast.error("Could not load comments");
    } finally {
      setCommentsLoadingByPostId((m) => ({ ...m, [post.id]: false }));
    }
  };

  const handleCommentPost = async (postId: string) => {
    const draft = (commentDraftByPostId[postId] || "").trim();
    if (!draft) return;
    setCommentSendingByPostId((m) => ({ ...m, [postId]: true }));
    try {
      const res = (await api.addCommunityPostComment(postId, draft)) as { comments: number };
      setCommentDraftByPostId((m) => ({ ...m, [postId]: "" }));
      const latest = (await api.getCommunityPostComments(postId)) as PostComment[];
      setCommentsByPostId((m) => ({ ...m, [postId]: Array.isArray(latest) ? latest : [] }));
      setPostsData((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: res.comments } : p)));
    } catch {
      toast.error("Could not post comment");
    } finally {
      setCommentSendingByPostId((m) => ({ ...m, [postId]: false }));
    }
  };

  const startEditComment = (postId: string, c: PostComment) => {
    setEditingCommentByPostId((m) => ({ ...m, [postId]: c.id }));
    // Keep the full content so any leading emoji icon remains intact.
    setEditCommentDraftByPostId((m) => ({ ...m, [postId]: c.content }));
  };

  const cancelEditComment = (postId: string) => {
    setEditingCommentByPostId((m) => ({ ...m, [postId]: null }));
    setEditCommentDraftByPostId((m) => ({ ...m, [postId]: "" }));
  };

  const saveEditComment = async (postId: string, commentId: string) => {
    const draft = (editCommentDraftByPostId[postId] || "").trim();
    if (!draft) return;
    setEditCommentSavingByPostId((m) => ({ ...m, [postId]: true }));
    try {
      await api.updateCommunityPostComment(postId, commentId, draft);
      const latest = (await api.getCommunityPostComments(postId)) as PostComment[];
      setCommentsByPostId((m) => ({ ...m, [postId]: Array.isArray(latest) ? latest : [] }));
      cancelEditComment(postId);
      toast.success("Comment updated");
    } catch {
      toast.error("Could not update comment");
    } finally {
      setEditCommentSavingByPostId((m) => ({ ...m, [postId]: false }));
    }
  };

  const deleteComment = async (postId: string, commentId: string) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      const res = (await api.deleteCommunityPostComment(postId, commentId)) as { ok: boolean; comments?: number };
      const latest = (await api.getCommunityPostComments(postId)) as PostComment[];
      setCommentsByPostId((m) => ({ ...m, [postId]: Array.isArray(latest) ? latest : [] }));
      if (typeof res?.comments === "number") {
        setPostsData((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: res.comments! } : p)));
      }
      toast.success("Comment deleted");
    } catch {
      toast.error("Could not delete comment");
    }
  };

  const handleDeletePost = async (post: FeedPost) => {
    if (!window.confirm("Delete this post permanently?")) return;
    try {
      await api.deleteCommunityPost(post.id);
      setPostsData((prev) => prev.filter((p) => p.id !== post.id));
      toast.success("Post deleted");
    } catch {
      toast.error("Could not delete post");
    }
  };

  const startEditPost = (post: FeedPost) => {
    setEditingPostId(post.id);
    setEditDraft(post.content);
    setEditTagsDraft(post.tags.join(", "));
  };

  const saveEditPost = async (postId: string) => {
    if (!editDraft.trim()) return;
    const nextTags = editTagsDraft
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);
    setEditSaving(true);
    try {
      await api.updateCommunityPost(postId, editDraft.trim(), nextTags);
      setPostsData((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, content: editDraft.trim(), tags: nextTags } : p
        )
      );
      setEditingPostId(null);
      setEditDraft("");
      setEditTagsDraft("");
      toast.success("Post updated");
    } catch {
      toast.error("Could not update post");
    } finally {
      setEditSaving(false);
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
      const created = (await api.createCommunityPost({
        content: newPostContent.trim(),
        tags: tags.length ? tags : undefined,
        // group_id intentionally omitted
      })) as { id?: string; created_at?: string } | { id?: string; createdAt?: string } | any;

      const createdId = String(created?.id || "");
      const createdAtIso =
        (created?.created_at ? new Date(created.created_at).toISOString() : null) ||
        (created?.createdAt ? new Date(created.createdAt).toISOString() : null) ||
        new Date().toISOString();

      // Optimistic insert: show the post immediately without waiting for a full re-fetch.
      const fullName =
        typeof (profile as any)?.full_name === "string"
          ? ((profile as any).full_name as string)
          : typeof (profile as any)?.fullName === "string"
            ? ((profile as any).fullName as string)
            : "";
      const avatarUrl =
        typeof (profile as any)?.avatar_url === "string"
          ? ((profile as any).avatar_url as string)
          : typeof (profile as any)?.avatarUrl === "string"
            ? ((profile as any).avatarUrl as string)
            : null;
      const displayName = showDisplayName ? (fullName.trim() || "Member") : "Anonymous";
      const optimisticPost: FeedPost = {
        id: createdId || `tmp-${Date.now()}`,
        author: {
          name: displayName,
          avatarUrl: showAvatar ? avatarUrl : null,
          role: ((profile as any)?.role === "therapist" ? "companion" : "member") as any,
        },
        isByCurrentUser: true,
        authorUserId: (profile as any)?.id ?? null,
        content: newPostContent.trim(),
        category: newPostCategory,
        createdAt: createdAtIso,
        views: 0,
        likes: 0,
        likedByMe: false,
        comments: 0,
        tags: tags.length ? tags : [],
      };

      setPostsData((prev) => [optimisticPost, ...prev]);
      setOverview((prev) => (prev ? { ...prev, posts: prev.posts + 1 } : prev));

      setNewPostContent("");
      setNewPostTags("");
      setNewPostCategory("General Discussion");
      setShowNewPostModal(false);
      toast.success("Post published");

      // Background refresh (non-blocking) to reconcile server state (ids, tags, counts).
      void (async () => {
        try {
          const posts = (await api.getCommunityPosts(40)) as FeedPost[];
          if (Array.isArray(posts)) setPostsData(posts);
        } catch {
          // ignore; optimistic UI already updated
        }
      })();
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
      await loadPosts();
      await loadMeta({ includeGroups: true });
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

  if (loadingPosts && postsData.length === 0) {
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
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (tab.id === "groups" && groupsData.length === 0) {
                        void loadMeta({ includeGroups: true });
                      }
                    }}
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
                (loadingPosts ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                  </div>
                ) : filteredPosts.length === 0 ? (
                  <div className="text-center py-16 text-gray-500 dark:text-slate-400 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                    No posts yet. Be the first to share—or check back soon.
                  </div>
                ) : (
                  filteredPosts.map((post, index) => {
                    const hashtagsForDisplay = feedHashtagsExcludingDisplayedCategory(post);
                    const authorRowInteractive =
                      "flex items-start gap-4 mb-4 rounded-xl -mx-2 px-2 pt-2 pb-1 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50";
                    const authorRowStatic = "flex items-start gap-4 mb-4";
                    const authorHeader = (
                      <div className="flex items-start justify-between gap-4 w-full">
                        <div className="flex items-start gap-4 min-w-0">
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
                        </div>

                        {post.isByCurrentUser && (
                          <div className="shrink-0 flex items-center gap-2">
                            <button
                              type="button"
                              className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                startEditPost(post);
                              }}
                              aria-label="Edit post"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void handleDeletePost(post);
                              }}
                              aria-label="Delete post"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
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

                        {editingPostId === post.id ? (
                          <div className="mb-4">
                            <textarea
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              rows={4}
                              className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-gray-900 dark:text-white"
                            />
                            <div className="mt-3">
                              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">
                                Hashtags (comma-separated)
                              </label>
                              <input
                                value={editTagsDraft}
                                onChange={(e) => setEditTagsDraft(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                                placeholder="e.g. General Discussion, anxiety, support"
                              />
                            </div>
                            <div className="mt-2 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-sm"
                                onClick={() => {
                                  setEditingPostId(null);
                                  setEditDraft("");
                                  setEditTagsDraft("");
                                }}
                                disabled={editSaving}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-sm disabled:opacity-60"
                                onClick={() => saveEditPost(post.id)}
                                disabled={editSaving || !editDraft.trim()}
                              >
                                {editSaving ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-700 dark:text-slate-300 mb-4 leading-relaxed whitespace-pre-wrap">
                            <EmojiText emojiSize={22}>{post.content}</EmojiText>
                          </p>
                        )}

                        {hashtagsForDisplay.length > 0 ? (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {hashtagsForDisplay.map((tag) => (
                              <span
                                key={tag}
                                className="text-xs px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-slate-800">
                          <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-slate-400">
                            <div className="flex items-center gap-2">
                              <Eye className="w-4 h-4" />
                              {post.views}
                            </div>
                            <button
                              type="button"
                              className={cn(
                                "flex items-center gap-2 transition-colors rounded-md px-0.5 -mx-0.5",
                                post.likedByMe
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-gray-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                              )}
                              onClick={() => handleLikePost(post.id)}
                              aria-label={post.likedByMe ? "Unlike post" : "Like post"}
                              aria-pressed={Boolean(post.likedByMe)}
                            >
                              <ThumbsUp
                                className={cn(
                                  "w-4 h-4 shrink-0",
                                  post.likedByMe && "fill-current"
                                )}
                              />
                              {post.likes}
                            </button>
                            <button
                              type="button"
                              className="flex items-center gap-2 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                              onClick={() => toggleCommentsForPost(post)}
                              aria-label={openCommentsPostId === post.id ? "Hide comments" : "Show comments"}
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

                        {/* Inline comments (Instagram-style) */}
                        {openCommentsPostId === post.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="mt-4 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/40 overflow-hidden"
                          >
                            <div className="max-h-64 overflow-auto p-4 space-y-3">
                              {commentsLoadingByPostId[post.id] ? (
                                <div className="py-6 flex items-center justify-center">
                                  <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                                </div>
                              ) : (commentsByPostId[post.id] || []).length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">No comments yet. Be the first one.</p>
                              ) : (
                                (commentsByPostId[post.id] || []).map((c) => (
                                  <div key={c.id} className="flex items-start gap-3">
                                    <div className="shrink-0">
                                      {c.author.avatarUrl ? (
                                        <img
                                          src={c.author.avatarUrl}
                                          alt=""
                                          className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-slate-700"
                                        />
                                      ) : (
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-200 to-blue-200 dark:from-purple-900 dark:to-blue-900 flex items-center justify-center text-[10px] font-bold text-purple-900 dark:text-purple-100">
                                          {initials(c.author.name)}
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                          {c.author.name}
                                        </p>
                                        <p className="text-[11px] text-gray-500 dark:text-slate-400 shrink-0">
                                          {(() => {
                                            try {
                                              return formatDistanceToNow(parseISO(c.createdAt), { addSuffix: true });
                                            } catch {
                                              return "recently";
                                            }
                                          })()}
                                        </p>
                                      </div>
                                      {editingCommentByPostId[post.id] === c.id ? (
                                        <div className="mt-1 space-y-2">
                                          <div className="flex items-center gap-2">
                                            <Popover
                                              open={Boolean(emojiPickerOpenEditByPostId[post.id])}
                                              onOpenChange={(open) =>
                                                setEmojiPickerOpenEditByPostId((m) => ({ ...m, [post.id]: open }))
                                              }
                                            >
                                              <PopoverTrigger asChild>
                                                <button
                                                  type="button"
                                                  className="h-7 w-7 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300 hover:border-purple-300 dark:hover:border-purple-600"
                                                  title="Emoji keyboard"
                                                  aria-label="Open emoji keyboard"
                                                >
                                                  <Smile className="w-4 h-4 mx-auto" />
                                                </button>
                                              </PopoverTrigger>
                                              <PopoverContent className="w-72" align="start">
                                                <input
                                                  value={emojiPickerQueryEditByPostId[post.id] || ""}
                                                  onChange={(e) =>
                                                    setEmojiPickerQueryEditByPostId((m) => ({
                                                      ...m,
                                                      [post.id]: e.target.value,
                                                    }))
                                                  }
                                                  placeholder="Search emoji…"
                                                  className="mb-2 w-full rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                                                />
                                                <div className="grid grid-cols-8 gap-1 max-h-44 overflow-auto">
                                                  {EMOJI_KEYBOARD.filter((emo) => {
                                                    const q = (emojiPickerQueryEditByPostId[post.id] || "").trim();
                                                    if (!q) return true;
                                                    return emo.includes(q);
                                                  }).map((emo) => (
                                                    <button
                                                      key={emo}
                                                      type="button"
                                                      className="text-lg p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                                                      onClick={() => {
                                                        setEditCommentDraftByPostId((m) => ({
                                                          ...m,
                                                          [post.id]: `${m[post.id] || ""}${emo}`,
                                                        }));
                                                        setEmojiPickerOpenEditByPostId((m) => ({ ...m, [post.id]: false }));
                                                      }}
                                                    >
                                                      <FluentEmoji emoji={emo} size={22} />
                                                    </button>
                                                  ))}
                                                </div>
                                              </PopoverContent>
                                            </Popover>
                                          </div>
                                          <textarea
                                            value={editCommentDraftByPostId[post.id] || ""}
                                            onChange={(e) =>
                                              setEditCommentDraftByPostId((m) => ({
                                                ...m,
                                                [post.id]: e.target.value,
                                              }))
                                            }
                                            rows={2}
                                            className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400"
                                          />
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs disabled:opacity-60"
                                              onClick={() => saveEditComment(post.id, c.id)}
                                              disabled={
                                                Boolean(editCommentSavingByPostId[post.id]) ||
                                                !(editCommentDraftByPostId[post.id] || "").trim()
                                              }
                                            >
                                              {editCommentSavingByPostId[post.id] ? "Saving..." : "Save"}
                                            </button>
                                            <button
                                              type="button"
                                              className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs"
                                              onClick={() => cancelEditComment(post.id)}
                                              disabled={Boolean(editCommentSavingByPostId[post.id])}
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        (() => {
                                          const { icon, text } = splitIconFromComment(c.content);
                                          return (
                                            <div className="mt-1">
                                              <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                                                {icon ? (
                                                  <span className="mr-1 inline-flex align-middle">
                                                    <FluentEmoji emoji={icon} size={18} />
                                                  </span>
                                                ) : null}
                                                {text}
                                              </p>
                                              {c.isByCurrentUser ? (
                                                <div className="mt-1 flex items-center gap-2">
                                                  <button
                                                    type="button"
                                                    className="p-1 rounded-md text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:text-slate-400 dark:hover:text-purple-400 dark:hover:bg-slate-800/60 transition-colors"
                                                    onClick={() => startEditComment(post.id, c)}
                                                    aria-label="Edit comment"
                                                  >
                                                    <Pencil className="w-4 h-4" />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="p-1 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-slate-800/60 transition-colors"
                                                    onClick={() => void deleteComment(post.id, c.id)}
                                                    aria-label="Delete comment"
                                                  >
                                                    <Trash2 className="w-4 h-4" />
                                                  </button>
                                                </div>
                                              ) : null}
                                            </div>
                                          );
                                        })()
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            <div className="border-t border-gray-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900">
                              <div className="flex items-center gap-2">
                                <Popover
                                  open={Boolean(emojiPickerOpenByPostId[post.id])}
                                  onOpenChange={(open) =>
                                    setEmojiPickerOpenByPostId((m) => ({ ...m, [post.id]: open }))
                                  }
                                >
                                  <PopoverTrigger asChild>
                                    <button
                                      type="button"
                                      className="h-9 w-9 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300 hover:border-purple-300 dark:hover:border-purple-600"
                                      title="Emoji keyboard"
                                      aria-label="Open emoji keyboard"
                                    >
                                      <Smile className="w-4 h-4 mx-auto" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-72" align="start">
                                    <input
                                      value={emojiPickerQueryByPostId[post.id] || ""}
                                      onChange={(e) =>
                                        setEmojiPickerQueryByPostId((m) => ({
                                          ...m,
                                          [post.id]: e.target.value,
                                        }))
                                      }
                                      placeholder="Search emoji…"
                                      className="mb-2 w-full rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                                    />
                                    <div className="grid grid-cols-8 gap-1 max-h-44 overflow-auto">
                                      {EMOJI_KEYBOARD.filter((emo) => {
                                        const q = (emojiPickerQueryByPostId[post.id] || "").trim();
                                        if (!q) return true;
                                        return emo.includes(q);
                                      }).map((emo) => (
                                        <button
                                          key={emo}
                                          type="button"
                                          className="text-lg p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                                          onClick={() => {
                                            setCommentDraftByPostId((m) => ({
                                              ...m,
                                              [post.id]: `${m[post.id] || ""}${emo}`,
                                            }));
                                            setEmojiPickerOpenByPostId((m) => ({ ...m, [post.id]: false }));
                                          }}
                                        >
                                          <FluentEmoji emoji={emo} size={22} />
                                        </button>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                                <input
                                  value={commentDraftByPostId[post.id] || ""}
                                  onChange={(e) =>
                                    setCommentDraftByPostId((m) => ({ ...m, [post.id]: e.target.value }))
                                  }
                                  placeholder="Add a comment..."
                                  className="flex-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400"
                                />
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-600 text-white text-sm disabled:opacity-60"
                                  onClick={() => handleCommentPost(post.id)}
                                  disabled={
                                    Boolean(commentSendingByPostId[post.id]) ||
                                    !(commentDraftByPostId[post.id] || "").trim()
                                  }
                                >
                                  {commentSendingByPostId[post.id] ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Send className="w-4 h-4" />
                                  )}
                                  Post
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
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

              {/* Group selection removed: admins create/manage groups. */}

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
