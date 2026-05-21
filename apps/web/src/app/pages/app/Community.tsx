import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  COMMUNITY_IMAGES,
  communityPostSceneForId,
} from "@/lib/solace/communityImages";
import { motion } from "motion/react";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  Users,
  MessageCircle,
  Share2,
  Plus,
  TrendingUp,
  Clock,
  MessageSquare,
  Search,
  Globe,
  Lock,
  ArrowLeft,
  Loader2,
  Shield,
  Pencil,
  Trash2,
  Send,
  Smile,
  Cloud,
  Moon,
  Star,
  Flower2,
  Flame,
  Heart,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Bookmark,
  Filter,
  Check,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { toast } from "sonner";
import { Switch } from "@/app/components/ui/switch";
import { Label } from "@/app/components/ui/label";
import { cn } from "@/lib/utils";
import { SolaceSelect } from "@/app/solace";
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

const SUPPORT_SPACES: ReadonlyArray<{
  title: string;
  mood: string;
  Icon: LucideIcon;
  glow: string;
  iconWrap: string;
}> = [
  {
    title: "Anxiousness Support",
    mood: "A softer place to land",
    Icon: Cloud,
    glow: "from-sky-500/25 via-indigo-500/10 to-transparent",
    iconWrap: "bg-sky-400/20 text-sky-200 shadow-[0_0_24px_rgba(56,189,248,0.35)]",
  },
  {
    title: "Late Night Thoughts",
    mood: "When the world is quiet",
    Icon: Moon,
    glow: "from-indigo-500/30 via-violet-900/20 to-transparent",
    iconWrap: "bg-indigo-400/20 text-indigo-100 shadow-[0_0_24px_rgba(129,140,248,0.4)]",
  },
  {
    title: "Quiet Wins",
    mood: "Small steps, honored",
    Icon: Star,
    glow: "from-amber-400/20 via-fuchsia-500/15 to-transparent",
    iconWrap: "bg-amber-300/20 text-amber-100 shadow-[0_0_22px_rgba(251,191,36,0.35)]",
  },
  {
    title: "Sleep Circle",
    mood: "Rest, together",
    Icon: Sparkles,
    glow: "from-violet-500/25 via-slate-500/10 to-transparent",
    iconWrap: "bg-violet-400/20 text-violet-100 shadow-[0_0_24px_rgba(167,139,250,0.4)]",
  },
  {
    title: "Burnout Recovery",
    mood: "Gentle pacing back",
    Icon: Flame,
    glow: "from-orange-400/20 via-rose-500/15 to-transparent",
    iconWrap: "bg-orange-300/20 text-orange-100 shadow-[0_0_22px_rgba(251,146,60,0.35)]",
  },
  {
    title: "Healing Journey",
    mood: "You’re allowed to unfold slowly",
    Icon: Flower2,
    glow: "from-emerald-400/15 via-fuchsia-500/20 to-transparent",
    iconWrap: "bg-emerald-400/15 text-emerald-100 shadow-[0_0_22px_rgba(52,211,153,0.3)]",
  },
];

const FEED_PAGE_SIZE = 10;
const PULSE_GAUGE_RADIUS = 48;
const PULSE_GAUGE_ARC_LENGTH = Math.PI * PULSE_GAUGE_RADIUS;
const PULSE_RECENT_MS = 48 * 60 * 60 * 1000;

const COMMUNITY_POST_CATEGORIES = [
  "General Discussion",
  "Wins & Progress",
  "Support & Advice",
  "Professional Insights",
  "Community Events",
] as const;


function findGroupForCircleTitle(title: string, groups: FeedGroup[]): FeedGroup | undefined {
  const t = title.toLowerCase();
  return groups.find((g) => {
    const blob = `${g.name} ${g.category} ${g.description}`.toLowerCase();
    if (t.includes("anxiety")) return blob.includes("anxiety") || blob.includes("support");
    if (t.includes("late night")) return blob.includes("night") || blob.includes("late");
    if (t.includes("quiet")) return blob.includes("quiet") || blob.includes("win");
    if (t.includes("sleep")) return blob.includes("sleep") || blob.includes("rest");
    if (t.includes("burnout")) return blob.includes("burnout") || blob.includes("recover");
    if (t.includes("healing")) return blob.includes("heal") || blob.includes("journey") || blob.includes("growth");
    return false;
  });
}

function circlePresenceLabel(title: string, groups: FeedGroup[], activeNow: number): string {
  const g = findGroupForCircleTitle(title, groups);
  if (g && g.members > 0) return `${g.members.toLocaleString()} members`;
  if (activeNow > 0) return `${activeNow} people nearby`;
  return "Open when you need it";
}

function pickGroupCircleIcon(group: FeedGroup): LucideIcon {
  const blob = `${group.name} ${group.category} ${group.description}`.toLowerCase();
  if (blob.includes("sleep") || blob.includes("rest")) return Sparkles;
  if (blob.includes("night") || blob.includes("late")) return Moon;
  if (blob.includes("anxiety") || blob.includes("panic")) return Cloud;
  if (blob.includes("burnout") || blob.includes("stress")) return Flame;
  return MessageCircle;
}

function primaryEmotionalTag(post: FeedPost): string | null {
  const extra = feedHashtagsExcludingDisplayedCategory(post);
  const raw = extra[0] ?? post.tags?.[0] ?? null;
  if (!raw) return null;
  return raw.replace(/^#/, "").trim() || null;
}

const BOOKMARKS_STORAGE_KEY = "meetezri_community_bookmarks";

type CommunityPulse = {
  percent: number | null;
  headline: string;
  detail: string;
};

function isRecentCommunityPost(createdAt: string, nowMs: number): boolean {
  try {
    return nowMs - parseISO(createdAt).getTime() < PULSE_RECENT_MS;
  } catch {
    return false;
  }
}

function computeCommunityPulse(overview: Overview | null, posts: FeedPost[]): CommunityPulse {
  const nowMs = Date.now();
  const recentPosts = posts.filter((p) => isRecentCommunityPost(p.createdAt, nowMs));
  const recentLikes = recentPosts.reduce((sum, p) => sum + p.likes, 0);
  const recentComments = recentPosts.reduce((sum, p) => sum + p.comments, 0);
  const recentPostCount = recentPosts.length;

  const hasFeedSignal = recentPostCount > 0 || recentLikes > 0 || recentComments > 0;
  const hasOverviewSignal =
    overview != null &&
    (overview.posts > 0 || overview.comments > 0 || overview.activeNow > 0);

  if (!hasFeedSignal && !hasOverviewSignal) {
    return {
      percent: null,
      headline: "",
      detail: "We'll show a gentle pulse once there's a little more activity to reflect on.",
    };
  }

  const replyRate =
    recentPostCount > 0 ? Math.min(1, recentComments / Math.max(recentPostCount * 2, 1)) : 0;
  const warmthRate =
    recentPostCount > 0 ? Math.min(1, recentLikes / Math.max(recentPostCount * 3, 1)) : 0;
  const presenceRate = overview
    ? Math.min(1, overview.activeNow / Math.max(Math.min(overview.members, 12), 3))
    : 0;
  const overviewEngagement =
    overview && overview.posts > 0
      ? Math.min(1, overview.comments / Math.max(overview.posts * 2, 1))
      : 0;

  const blended = hasFeedSignal
    ? replyRate * 0.4 + warmthRate * 0.35 + presenceRate * 0.25
    : overviewEngagement * 0.6 + presenceRate * 0.4;

  const percent = Math.round(Math.min(96, Math.max(34, 38 + blended * 58)));

  let headline = "The community is quietly present today.";
  if (percent >= 78) headline = "Positive energy is growing today.";
  else if (percent >= 62) headline = "Support is flowing gently through the feed.";
  else if (percent >= 48) headline = "A calm space — room for your voice.";

  let detail = "Shaped by recent replies and people showing up gently.";
  if (recentComments > 0 || recentLikes > 0) {
    const parts: string[] = [];
    if (recentComments > 0) {
      parts.push(`${recentComments} recent ${recentComments === 1 ? "reply" : "replies"}`);
    }
    if (recentLikes > 0) {
      parts.push(`${recentLikes} ${recentLikes === 1 ? "reaction" : "reactions"}`);
    }
    detail = `Shaped by ${parts.join(" and ")} in the last couple of days.`;
  } else if (overview && overview.activeNow > 0) {
    detail = `${overview.activeNow} ${overview.activeNow === 1 ? "person" : "people"} showed up recently — your voice can spark the next wave.`;
  }

  return { percent, headline, detail };
}

function emotionalSocialProofLine(post: FeedPost): string | null {
  if (post.likes > 0) return `${post.likes} people relate to this`;
  if (post.comments > 0) return `${post.comments} people here with you`;
  if (post.views > 0) return `${post.views} others listened quietly`;
  return null;
}

interface CinematicEnterProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

function CinematicEnter({ children, delay = 0, className }: CinematicEnterProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.75, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Community() {
  const { profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<"feed" | "groups" | "trending">("feed");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterMyPostsOnly, setFilterMyPostsOnly] = useState(false);
  const [filterBookmarkedOnly, setFilterBookmarkedOnly] = useState(false);
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
  const [bookmarkedPostIds, setBookmarkedPostIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr)) setBookmarkedPostIds(new Set(arr.filter((x) => typeof x === "string")));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleBookmarkPost = useCallback((postId: string) => {
    setBookmarkedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      try {
        localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  /** Keeps latest groups for loadMeta without putting groupsData in useCallback deps (that caused an infinite fetch loop). */
  const groupsDataRef = useRef<FeedGroup[]>([]);
  useEffect(() => {
    groupsDataRef.current = groupsData;
  }, [groupsData]);

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
        opts?.includeGroups ? api.getCommunityGroups() : Promise.resolve(groupsDataRef.current),
      ]);
      setOverview(ov as Overview);
      if (opts?.includeGroups) setGroupsData(groups as FeedGroup[]);
    } catch (e) {
      console.error(e);
      // meta is non-blocking; keep UI usable
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    void loadPosts();
    void loadMeta({ includeGroups: true });
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

  const hasActiveFeedFilters = filterCategory !== "" || filterMyPostsOnly || filterBookmarkedOnly;

  const filteredPosts = useMemo(() => {
    let list = postsData;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.content.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.author.name.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (filterCategory) {
      list = list.filter((p) => p.category === filterCategory);
    }
    if (filterMyPostsOnly) {
      list = list.filter((p) => p.isByCurrentUser);
    }
    if (filterBookmarkedOnly) {
      list = list.filter((p) => bookmarkedPostIds.has(p.id));
    }
    return list;
  }, [postsData, searchQuery, filterCategory, filterMyPostsOnly, filterBookmarkedOnly, bookmarkedPostIds]);

  const [feedPage, setFeedPage] = useState(1);
  const feedTotalPages = Math.max(1, Math.ceil(filteredPosts.length / FEED_PAGE_SIZE));

  const pagedFeedPosts = useMemo(() => {
    const safePage = Math.min(Math.max(1, feedPage), feedTotalPages);
    const start = (safePage - 1) * FEED_PAGE_SIZE;
    return filteredPosts.slice(start, start + FEED_PAGE_SIZE);
  }, [filteredPosts, feedPage, feedTotalPages]);

  useEffect(() => {
    setFeedPage(1);
  }, [searchQuery, filterCategory, filterMyPostsOnly, filterBookmarkedOnly]);

  const clearFeedFilters = () => {
    setFilterCategory("");
    setFilterMyPostsOnly(false);
    setFilterBookmarkedOnly(false);
  };

  const applyFeedFilterChange = () => {
    if (activeTab !== "feed") setActiveTab("feed");
  };

  useEffect(() => {
    setFeedPage((p) => Math.min(Math.max(1, p), feedTotalPages));
  }, [feedTotalPages]);

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
  const trendingBarMax = trendingTopics.reduce((m, t) => Math.max(m, t.posts), 0) || 1;
  const supportCirclesPreview = useMemo(
    () => [...groupsData].sort((a, b) => b.members - a.members || b.posts - a.posts).slice(0, 4),
    [groupsData],
  );

  const getRoleBadge = (role: string) => {
    const badges = {
      member: {
        bg: "bg-white/10 ring-1 ring-white/15",
        text: "text-violet-100/90",
        label: "Member",
      },
      moderator: {
        bg: "bg-sky-500/15 ring-1 ring-sky-400/35",
        text: "text-sky-100",
        label: "Moderator",
      },
      companion: {
        bg: "bg-fuchsia-500/15 ring-1 ring-fuchsia-400/40",
        text: "text-fuchsia-100",
        label: "Companion",
      },
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
      void loadMeta();
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
      setOverview((prev) => (prev ? { ...prev, comments: prev.comments + 1 } : prev));
      void loadMeta();
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
    const url = `${window.location.origin}/app/community#post-${postId}`;
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
          await loadMeta();
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

  const communityPulse = useMemo(
    () => computeCommunityPulse(overview, postsData),
    [overview, postsData],
  );
  const pulseArcFilled =
    communityPulse.percent != null
      ? (communityPulse.percent / 100) * PULSE_GAUGE_ARC_LENGTH
      : 0;

  if (loadingPosts && postsData.length === 0) {
    return (
      <div className="relative flex min-h-[50vh] items-center justify-center overflow-hidden bg-[#06060f]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(139,92,246,0.25)_0%,transparent_55%),radial-gradient(ellipse_at_80%_80%,rgba(236,72,153,0.12)_0%,transparent_50%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.03)_0%,transparent_70%)]" />
        <Loader2 className="relative h-10 w-10 animate-spin text-violet-300 drop-shadow-[0_0_20px_rgba(167,139,250,0.6)]" aria-hidden />
        <span className="sr-only">Loading community</span>
      </div>
    );
  }

  return (
    <>
      <div className="relative min-h-screen overflow-hidden bg-[#06060f] text-slate-100 transition-colors duration-500">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(109,40,217,0.35)_0%,transparent_50%),radial-gradient(ellipse_at_100%_0%,rgba(236,72,153,0.12)_0%,transparent_45%),radial-gradient(ellipse_at_0%_100%,rgba(56,189,248,0.08)_0%,transparent_40%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.4)_0%,transparent_35%,rgba(2,6,23,0.85)_100%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.4] mix-blend-soft-light bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.06%22/%3E%3C/svg%3E')]" />

        <div className="relative z-10 mx-auto max-w-[1720px] px-4 pb-24 pt-8 sm:px-6 sm:pt-10 lg:px-10">
          <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--solace-ds-border-glow,rgba(168,85,247,0.22))] bg-white/[0.06] text-violet-200 shadow-[0_0_24px_rgba(168,85,247,0.2)]">
                <Users className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-[#F7F3FF] sm:text-4xl">Community</h1>
                <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-[#A7A1B8] sm:text-[15px]">
                  Connect, share and support each other.
                </p>
              </div>
            </div>
            <motion.button
              type="button"
              whileHover={{ y: -1 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 self-start rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_28px_rgba(168,85,247,0.4),inset_0_1px_0_rgba(255,255,255,0.18)] transition-shadow hover:shadow-[0_0_36px_rgba(236,72,153,0.35)] sm:self-center"
              onClick={() => setShowNewPostModal(true)}
            >
              <Plus className="h-5 w-5" aria-hidden />
              New Post
            </motion.button>
          </header>

          <details className="group mb-8 rounded-[24px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-medium text-violet-100/90 marker:content-none [&::-webkit-details-marker]:hidden">
              <Shield className="h-4 w-4 shrink-0 text-fuchsia-300/80" aria-hidden />
              <span>Community visibility</span>
              <span className="ml-auto text-xs text-violet-300/50">Tap to adjust</span>
            </summary>
            <div className="border-t border-white/[0.06] px-4 pb-4 pt-2 md:px-5">
              <p className="mb-4 text-xs leading-relaxed text-violet-200/50">
                These apply to this page and how you appear to others. They are stored with your account.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-black/25 p-3">
                  <div>
                    <Label htmlFor="comm-avatar" className="text-sm font-medium text-violet-50/90">
                      Show my profile picture
                    </Label>
                    <p className="text-xs text-violet-200/45">When off, your avatar is hidden in community posts.</p>
                  </div>
                  <Switch
                    id="comm-avatar"
                    checked={showAvatar}
                    onCheckedChange={(v) => persistPrivacy({ showAvatarInCommunity: v })}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-black/25 p-3">
                  <div>
                    <Label htmlFor="comm-name" className="text-sm font-medium text-violet-50/90">
                      Show my display name
                    </Label>
                    <p className="text-xs text-violet-200/45">When off, your posts show as “Anonymous”.</p>
                  </div>
                  <Switch
                    id="comm-name"
                    checked={showDisplayName}
                    onCheckedChange={(v) => persistPrivacy({ showDisplayNameInCommunity: v })}
                  />
                </div>
              </div>
            </div>
          </details>

          <CinematicEnter className="mb-10">
            <div className="relative min-h-[280px] overflow-hidden rounded-[28px] border border-[color:rgba(168,85,247,0.25)] bg-[#0B1020] shadow-[0_0_80px_-24px_rgba(88,28,135,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] lg:min-h-[300px]">
              <img
                src={COMMUNITY_IMAGES.hero}
                alt=""
                width={1200}
                height={800}
                loading="eager"
                decoding="async"
                aria-hidden
                className="absolute inset-0 h-full w-full object-cover object-[62%_45%]"
              />
              <div
                className="absolute inset-0 bg-gradient-to-r from-[#050816]/90 via-[#050816]/55 to-[#050816]/20"
                aria-hidden
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050816]/55 via-transparent to-[#050816]/25" aria-hidden />
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_100%,rgba(251,191,36,0.15)_0%,transparent_50%)]"
                aria-hidden
              />
              <div className="relative z-10 flex min-h-[280px] flex-col justify-center space-y-5 px-6 py-8 sm:px-8 lg:min-h-[300px] lg:px-10">
                <h2 className="text-balance font-serif text-3xl font-normal leading-[1.12] tracking-tight text-white sm:text-[2.25rem] lg:text-[2.5rem]">
                  A safe place to{" "}
                  <span className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-pink-300 bg-clip-text text-transparent">
                    be you.
                  </span>
                </h2>
                <p className="max-w-md text-[15px] leading-relaxed text-[#A7A1B8]">
                  Share your thoughts, listen with kindness and grow together.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex -space-x-2">
                    {postsData.slice(0, 5).map((p) => (
                      <div
                        key={p.id}
                        className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-[#050816]"
                      >
                        {p.author.avatarUrl ? (
                          <img src={p.author.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-600/85 to-indigo-900 text-[11px] font-semibold text-white">
                            {initials(p.author.name)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-violet-100/85">
                    {stats.members > 0
                      ? `${stats.members.toLocaleString()} people here for you today.`
                      : "People are here for you today."}
                  </span>
                </div>
              </div>
            </div>
          </CinematicEnter>

          <section className="mb-10">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[#F7F3FF]">Find your circle</h3>
                <p className="mt-1 text-sm leading-relaxed text-[#A7A1B8]">Choose a space that feels right for what you need.</p>
              </div>
              <button
                type="button"
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-violet-100/85 backdrop-blur-md transition-all hover:border-fuchsia-400/30 hover:bg-white/[0.08] hover:text-white"
                onClick={() => {
                  setActiveTab("groups");
                  if (groupsData.length === 0) void loadMeta({ includeGroups: true });
                }}
              >
                View all circles
                <ChevronRight className="h-4 w-4 opacity-70" aria-hidden />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SUPPORT_SPACES.map((space, i) => {
                const Icon = space.Icon;
                const presence = circlePresenceLabel(space.title, groupsData, stats.activeNow);
                return (
                  <CinematicEnter key={space.title} delay={i * 0.04} className="w-[148px] shrink-0 sm:w-[158px]">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("groups");
                        if (groupsData.length === 0) void loadMeta({ includeGroups: true });
                      }}
                      className="group relative flex h-full min-h-[168px] w-full flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.04] p-3.5 text-left shadow-[0_20px_50px_-40px_rgba(0,0,0,0.85)] transition-all duration-300 hover:border-violet-400/35 hover:shadow-[0_0_32px_-8px_rgba(168,85,247,0.35)]"
                    >
                      <div
                        className={cn(
                          "pointer-events-none absolute inset-0 opacity-55 transition-opacity duration-300 group-hover:opacity-80",
                          "bg-gradient-to-br",
                          space.glow,
                        )}
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050816]/90 via-[#050816]/35 to-transparent" />
                      <div className="relative flex flex-1 flex-col">
                        <div className={cn("mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg", space.iconWrap)}>
                          <Icon className="h-4 w-4" strokeWidth={1.5} />
                        </div>
                        <p className="text-[13px] font-semibold leading-snug text-white">{space.title}</p>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-violet-200/55">{space.mood}</p>
                        <p className="mt-auto pt-2 text-[10px] font-medium uppercase tracking-wider text-emerald-200/80">
                          <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]" />
                          {presence}
                        </p>
                      </div>
                    </button>
                  </CinematicEnter>
                );
              })}
            </div>
          </section>

          <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            <div className="flex min-h-[44px] flex-wrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                    type="button"
                    whileHover={{ y: -1 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (tab.id === "groups" && groupsData.length === 0) {
                        void loadMeta({ includeGroups: true });
                      }
                    }}
                    className={cn(
                      "inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300",
                      isActive
                        ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-[0_0_24px_rgba(124,58,237,0.4)]"
                        : "border border-white/10 bg-white/[0.05] text-violet-100/80 backdrop-blur-md hover:border-fuchsia-400/25 hover:bg-white/[0.08] hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4 opacity-90" />
                    {tab.label}
                  </motion.button>
                );
              })}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-300/45" />
                <input
                  type="search"
                  placeholder="Search posts, groups, or topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="min-h-[44px] w-full rounded-full border border-white/10 bg-black/30 py-2.5 pl-10 pr-4 text-sm text-[#F7F3FF] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md placeholder:text-violet-300/35 focus:border-violet-400/35 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
              <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium backdrop-blur-md transition-all",
                      hasActiveFeedFilters
                        ? "border-violet-400/35 bg-violet-500/15 text-violet-100 shadow-[0_0_24px_rgba(124,58,237,0.25)]"
                        : "border-white/10 bg-white/[0.05] text-violet-100/80 hover:border-fuchsia-400/30 hover:bg-white/[0.08] hover:text-white",
                    )}
                    aria-label="Filter posts"
                  >
                    <Filter className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    Filter
                    <ChevronDown
                      className={cn("h-3.5 w-3.5 shrink-0 opacity-60 transition-transform", filterOpen && "rotate-180")}
                      aria-hidden
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={8}
                  className="w-[min(100vw-2rem,20rem)] rounded-2xl border border-white/10 bg-[#0e0e18]/98 p-4 shadow-[0_0_48px_-12px_rgba(139,92,246,0.45)] backdrop-blur-xl"
                >
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-violet-300/70">Category</p>
                  <div className="mb-4 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setFilterCategory("");
                        applyFeedFilterChange();
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        filterCategory === ""
                          ? "border-violet-400/40 bg-violet-500/15 text-violet-100"
                          : "border-white/10 bg-white/[0.04] text-violet-200/60 hover:border-violet-400/25 hover:text-violet-100",
                      )}
                    >
                      All
                    </button>
                    {COMMUNITY_POST_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setFilterCategory(cat);
                          applyFeedFilterChange();
                        }}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                          filterCategory === cat
                            ? "border-violet-400/40 bg-violet-500/15 text-violet-100"
                            : "border-white/10 bg-white/[0.04] text-violet-200/60 hover:border-violet-400/25 hover:text-violet-100",
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="mb-3 space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFilterMyPostsOnly((v) => !v);
                        applyFeedFilterChange();
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all",
                        filterMyPostsOnly
                          ? "border-violet-400/35 bg-violet-500/10"
                          : "border-white/10 bg-white/[0.03] hover:border-violet-400/25",
                      )}
                    >
                      <span className="text-sm font-medium text-violet-50/90">My posts only</span>
                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-wider",
                          filterMyPostsOnly ? "text-fuchsia-200" : "text-violet-300/45",
                        )}
                      >
                        {filterMyPostsOnly ? "On" : "Off"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterBookmarkedOnly((v) => !v);
                        applyFeedFilterChange();
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all",
                        filterBookmarkedOnly
                          ? "border-fuchsia-400/35 bg-fuchsia-500/10"
                          : "border-white/10 bg-white/[0.03] hover:border-fuchsia-400/25",
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-violet-50/90">
                        <Bookmark className="h-3.5 w-3.5 text-fuchsia-300/80" aria-hidden />
                        Saved posts only
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-wider",
                          filterBookmarkedOnly ? "text-fuchsia-200" : "text-violet-300/45",
                        )}
                      >
                        {filterBookmarkedOnly ? "On" : "Off"}
                      </span>
                    </button>
                  </div>
                  {hasActiveFeedFilters ? (
                    <button
                      type="button"
                      onClick={() => {
                        clearFeedFilters();
                        applyFeedFilterChange();
                      }}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 text-xs font-medium text-violet-100/80 transition-colors hover:border-violet-400/30 hover:bg-white/[0.08]"
                    >
                      Clear all filters
                    </button>
                  ) : null}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2.15fr)_minmax(280px,1fr)] lg:items-start lg:gap-10">
            <div className="min-w-0 space-y-5">
              {activeTab === "feed" &&
                (loadingPosts ? (
                  <div className="flex justify-center py-20">
                    <Loader2 className="h-9 w-9 animate-spin text-fuchsia-300/80 drop-shadow-[0_0_20px_rgba(217,70,239,0.45)]" />
                  </div>
                ) : filteredPosts.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] py-20 text-center text-violet-200/55 backdrop-blur-md">
                    No posts yet. Be the first to share—or check back soon.
                  </div>
                ) : (
                  pagedFeedPosts.map((post, index) => {
                    const hashtagsForDisplay = feedHashtagsExcludingDisplayedCategory(post);
                    const proofLine = emotionalSocialProofLine(post);
                    const moodTag = primaryEmotionalTag(post);
                    const postSceneSrc = communityPostSceneForId(post.id);
                    const timeLabel = (() => {
                      try {
                        return formatDistanceToNow(parseISO(post.createdAt), { addSuffix: true });
                      } catch {
                        return "recently";
                      }
                    })();
                    const extraTags =
                      moodTag && hashtagsForDisplay.length
                        ? hashtagsForDisplay.filter((t) => normalizeCommunityTopicLabel(t) !== normalizeCommunityTopicLabel(moodTag))
                        : hashtagsForDisplay;

                    const headerLeft = (
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="shrink-0">
                          {post.author.avatarUrl ? (
                            <img
                              src={post.author.avatarUrl}
                              alt=""
                              className="h-10 w-10 rounded-full border border-white/10 object-cover ring-1 ring-violet-500/30"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-600/90 to-indigo-900 text-xs font-semibold text-white ring-1 ring-violet-400/30">
                              {initials(post.author.name)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-[15px] font-semibold tracking-tight text-[#F7F3FF]">{post.author.name}</h3>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                                getRoleBadge(post.author.role).bg,
                                getRoleBadge(post.author.role).text,
                              )}
                            >
                              {getRoleBadge(post.author.role).label}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#A7A1B8]">
                            <span className="truncate rounded-full border border-fuchsia-400/12 bg-fuchsia-500/10 px-2 py-0.5 font-medium text-fuchsia-100/85">
                              {post.category}
                            </span>
                            <span className="text-violet-500/40">·</span>
                            <Clock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                            <span>{timeLabel}</span>
                          </div>
                        </div>
                      </div>
                    );

                    return (
                      <CinematicEnter key={post.id} delay={index * 0.04}>
                        <div className="space-y-0">
                          <article
                            id={`post-${post.id}`}
                            className="relative overflow-hidden rounded-2xl border border-white/[0.08] shadow-[0_20px_55px_-38px_rgba(0,0,0,0.8)] transition-colors duration-300 hover:border-violet-400/25"
                          >
                            <div
                              className="pointer-events-none absolute inset-y-0 right-0 hidden w-[min(44%,240px)] sm:block"
                              aria-hidden
                            >
                              <img
                                src={postSceneSrc}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                width={480}
                                height={320}
                                className="h-full w-full object-cover object-center"
                              />
                              <div className="absolute inset-0 bg-gradient-to-l from-[#050816] via-[#050816]/82 to-transparent" />
                              <div className="absolute inset-0 bg-gradient-to-t from-[#050816]/40 via-transparent to-transparent" />
                            </div>
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#070a14]/88 via-[#050816]/82 to-[#050816]/94 sm:bg-gradient-to-r sm:from-[#050816]/92 sm:via-[#050816]/88 sm:to-[#050816]/55" aria-hidden />

                            <div className="relative z-10 px-4 pb-3 pt-3.5 sm:pr-[min(46%,252px)] sm:px-4">
                              <div className="flex items-start justify-between gap-2">
                                {post.authorUserId ? (
                                  <Link
                                    to={`/app/profile/${post.authorUserId}`}
                                    className="group/profile min-w-0 flex-1 rounded-xl outline-none ring-offset-2 ring-offset-[#050816] focus-visible:ring-2 focus-visible:ring-violet-500/50"
                                    aria-label="View profile"
                                  >
                                    {headerLeft}
                                  </Link>
                                ) : (
                                  headerLeft
                                )}
                                <div className="flex shrink-0 items-start gap-1.5">
                                  {moodTag ? (
                                    <span className="rounded-full border border-violet-400/25 bg-violet-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-100/95">
                                      #{moodTag.replace(/\s+/g, "-")}
                                    </span>
                                  ) : null}
                                  {post.isByCurrentUser ? (
                                    <>
                                      <button
                                        type="button"
                                        className="rounded-lg p-2 text-violet-300/70 transition-colors hover:bg-white/[0.06] hover:text-fuchsia-200"
                                        onClick={() => startEditPost(post)}
                                        aria-label="Edit post"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded-lg p-2 text-violet-300/70 transition-colors hover:bg-rose-500/10 hover:text-rose-200"
                                        onClick={() => void handleDeletePost(post)}
                                        aria-label="Delete post"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              </div>

                              {editingPostId === post.id ? (
                                <div className="mt-3 space-y-3">
                                  <textarea
                                    value={editDraft}
                                    onChange={(e) => setEditDraft(e.target.value)}
                                    rows={4}
                                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-violet-300/40 backdrop-blur-sm focus:border-fuchsia-400/40 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20"
                                  />
                                  <div>
                                    <label className="mb-1 block text-xs font-semibold text-violet-200/70">
                                      Hashtags (comma-separated)
                                    </label>
                                    <input
                                      value={editTagsDraft}
                                      onChange={(e) => setEditTagsDraft(e.target.value)}
                                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white backdrop-blur-sm focus:border-fuchsia-400/40 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20"
                                      placeholder="e.g. General Discussion, anxiety, support"
                                    />
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-violet-100/85 hover:bg-white/5"
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
                                      className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                                      onClick={() => saveEditPost(post.id)}
                                      disabled={editSaving || !editDraft.trim()}
                                    >
                                      {editSaving ? "Saving..." : "Save"}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="mt-2.5 text-pretty text-sm leading-relaxed text-[#F7F3FF]/90 whitespace-pre-wrap">
                                  <EmojiText emojiSize={20}>{post.content}</EmojiText>
                                </p>
                              )}

                              {extraTags.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {extraTags.slice(0, 4).map((tag) => (
                                    <span
                                      key={tag}
                                      className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-violet-200/75"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              ) : null}

                              <div className="mt-3 flex min-h-[44px] flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
                                <div className="flex flex-wrap items-center gap-3">
                                  <button
                                    type="button"
                                    className={cn(
                                      "inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm transition-colors",
                                      post.likedByMe ? "text-rose-300" : "text-[#A7A1B8] hover:text-rose-200",
                                    )}
                                    onClick={() => handleLikePost(post.id)}
                                    aria-label={post.likedByMe ? "Unlike post" : "Like post"}
                                    aria-pressed={Boolean(post.likedByMe)}
                                  >
                                    <Heart className={cn("h-4 w-4", post.likedByMe && "fill-current")} />
                                    {post.likes}
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm text-[#A7A1B8] transition-colors hover:text-fuchsia-200"
                                    onClick={() => toggleCommentsForPost(post)}
                                    aria-label={openCommentsPostId === post.id ? "Hide comments" : "Show comments"}
                                  >
                                    <MessageSquare className="h-4 w-4" />
                                    {post.comments}
                                  </button>
                                </div>

                                {proofLine ? (
                                  <div className="hidden min-w-0 flex-1 items-center justify-center gap-2 px-2 sm:flex">
                                    <div className="flex -space-x-1.5">
                                      {postsData.slice(0, 4).map((p) => (
                                        <div
                                          key={`pf-${post.id}-${p.id}`}
                                          className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full ring-2 ring-[#050816]"
                                        >
                                          {p.author.avatarUrl ? (
                                            <img src={p.author.avatarUrl} alt="" className="h-full w-full object-cover" />
                                          ) : (
                                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-700/90 to-indigo-900 text-[8px] font-bold text-white">
                                              {initials(p.author.name)}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                    <p className="truncate text-center text-[11px] font-medium text-fuchsia-200/75">{proofLine}</p>
                                  </div>
                                ) : (
                                  <div className="hidden flex-1 sm:block" />
                                )}

                                <div className="ml-auto flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    className="rounded-lg p-2 text-[#A7A1B8] transition-colors hover:bg-white/[0.06] hover:text-amber-200"
                                    onClick={() => toggleBookmarkPost(post.id)}
                                    aria-label={bookmarkedPostIds.has(post.id) ? "Remove bookmark" : "Bookmark post"}
                                    aria-pressed={bookmarkedPostIds.has(post.id)}
                                  >
                                    <Bookmark className={cn("h-4 w-4", bookmarkedPostIds.has(post.id) && "fill-amber-300/80 text-amber-200")} />
                                  </button>
                                  <motion.button
                                    type="button"
                                    whileHover={{ y: -1 }}
                                    transition={{ duration: 0.25 }}
                                    className="rounded-lg p-2 text-[#A7A1B8] transition-colors hover:bg-white/[0.06] hover:text-violet-100"
                                    onClick={() => handleSharePost(post.id)}
                                    aria-label="Share post"
                                  >
                                    <Share2 className="h-4 w-4" />
                                  </motion.button>
                                </div>
                              </div>

                              {proofLine ? (
                                <div className="mt-2 flex items-center gap-2 border-t border-transparent pt-0 sm:hidden">
                                  <div className="flex -space-x-1.5">
                                    {postsData.slice(0, 3).map((p) => (
                                      <div
                                        key={`pm-${post.id}-${p.id}`}
                                        className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full ring-2 ring-[#050816]"
                                      >
                                        {p.author.avatarUrl ? (
                                          <img src={p.author.avatarUrl} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-700/90 to-indigo-900 text-[8px] font-bold text-white">
                                            {initials(p.author.name)}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-[11px] font-medium text-fuchsia-200/75">{proofLine}</p>
                                </div>
                              ) : null}
                            </div>
                          </article>

                          {openCommentsPostId === post.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                            className="border-t border-white/10 bg-black/25 backdrop-blur-md"
                          >
                            <div className="max-h-64 space-y-3 overflow-auto p-4">
                              {commentsLoadingByPostId[post.id] ? (
                                <div className="flex items-center justify-center py-6">
                                  <Loader2 className="h-5 w-5 animate-spin text-fuchsia-400/80" />
                                </div>
                              ) : (commentsByPostId[post.id] || []).length === 0 ? (
                                <p className="py-2 text-sm text-violet-200/50">No comments yet. Be the first one.</p>
                              ) : (
                                (commentsByPostId[post.id] || []).map((c) => (
                                  <div key={c.id} className="flex items-start gap-3">
                                    <div className="shrink-0">
                                      {c.author.avatarUrl ? (
                                        <img
                                          src={c.author.avatarUrl}
                                          alt=""
                                          className="h-8 w-8 rounded-full border border-white/10 object-cover ring-1 ring-violet-500/20"
                                        />
                                      ) : (
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-700/80 to-indigo-900 text-[10px] font-bold text-white">
                                          {initials(c.author.name)}
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-3">
                                        <p className="truncate text-sm font-medium text-white">{c.author.name}</p>
                                        <p className="shrink-0 text-[11px] text-violet-300/45">
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
                                                  className="h-7 w-7 rounded-lg border border-white/10 bg-white/5 text-violet-200/80 hover:border-fuchsia-400/35 hover:bg-white/10"
                                                  title="Emoji keyboard"
                                                  aria-label="Open emoji keyboard"
                                                >
                                                  <Smile className="mx-auto h-4 w-4" />
                                                </button>
                                              </PopoverTrigger>
                                              <PopoverContent className="w-72 border-white/10 bg-[#12121c] text-white" align="start">
                                                <input
                                                  value={emojiPickerQueryEditByPostId[post.id] || ""}
                                                  onChange={(e) =>
                                                    setEmojiPickerQueryEditByPostId((m) => ({
                                                      ...m,
                                                      [post.id]: e.target.value,
                                                    }))
                                                  }
                                                  placeholder="Search emoji…"
                                                  className="mb-2 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1 text-sm text-white placeholder:text-violet-300/40"
                                                />
                                                <div className="grid max-h-44 grid-cols-8 gap-1 overflow-auto">
                                                  {EMOJI_KEYBOARD.filter((emo) => {
                                                    const q = (emojiPickerQueryEditByPostId[post.id] || "").trim();
                                                    if (!q) return true;
                                                    return emo.includes(q);
                                                  }).map((emo) => (
                                                    <button
                                                      key={emo}
                                                      type="button"
                                                      className="rounded-md p-1.5 text-lg transition-colors hover:bg-white/10"
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
                                            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-violet-300/40"
                                          />
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
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
                                              className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-violet-100/80 hover:bg-white/5"
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
                                              <p className="break-words whitespace-pre-wrap text-sm text-violet-100/80">
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
                                                    className="rounded-md p-1 text-violet-300/60 transition-colors hover:bg-white/10 hover:text-fuchsia-200"
                                                    onClick={() => startEditComment(post.id, c)}
                                                    aria-label="Edit comment"
                                                  >
                                                    <Pencil className="h-4 w-4" />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="rounded-md p-1 text-violet-300/60 transition-colors hover:bg-rose-500/15 hover:text-rose-200"
                                                    onClick={() => void deleteComment(post.id, c.id)}
                                                    aria-label="Delete comment"
                                                  >
                                                    <Trash2 className="h-4 w-4" />
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

                            <div className="border-t border-white/10 bg-black/30 p-3 backdrop-blur-sm">
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
                                      className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 text-violet-200/80 hover:border-fuchsia-400/35 hover:bg-white/10"
                                      title="Emoji keyboard"
                                      aria-label="Open emoji keyboard"
                                    >
                                      <Smile className="mx-auto h-4 w-4" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-72 border-white/10 bg-[#12121c] text-white" align="start">
                                    <input
                                      value={emojiPickerQueryByPostId[post.id] || ""}
                                      onChange={(e) =>
                                        setEmojiPickerQueryByPostId((m) => ({
                                          ...m,
                                          [post.id]: e.target.value,
                                        }))
                                      }
                                      placeholder="Search emoji…"
                                      className="mb-2 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1 text-sm text-white placeholder:text-violet-300/40"
                                    />
                                    <div className="grid max-h-44 grid-cols-8 gap-1 overflow-auto">
                                      {EMOJI_KEYBOARD.filter((emo) => {
                                        const q = (emojiPickerQueryByPostId[post.id] || "").trim();
                                        if (!q) return true;
                                        return emo.includes(q);
                                      }).map((emo) => (
                                        <button
                                          key={emo}
                                          type="button"
                                          className="rounded-md p-1.5 text-lg transition-colors hover:bg-white/10"
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
                                  className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-violet-300/40"
                                />
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                                  onClick={() => handleCommentPost(post.id)}
                                  disabled={
                                    Boolean(commentSendingByPostId[post.id]) ||
                                    !(commentDraftByPostId[post.id] || "").trim()
                                  }
                                >
                                  {commentSendingByPostId[post.id] ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Send className="h-4 w-4" />
                                  )}
                                  Post
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </CinematicEnter>
                    );
                  })
                ))}

              {activeTab === "feed" && !loadingPosts && filteredPosts.length > 0 && feedPage < feedTotalPages && (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/10 bg-[rgba(15,18,32,0.72)] px-6 py-2.5 text-sm font-semibold text-[#F7F3FF] shadow-[0_0_24px_rgba(139,92,246,0.18)] backdrop-blur-md transition-colors hover:border-violet-400/35 hover:bg-white/[0.06]"
                    onClick={() => setFeedPage((p) => Math.min(feedTotalPages, p + 1))}
                  >
                    Load more posts
                    <ChevronDown className="h-4 w-4 text-violet-200/80" aria-hidden />
                  </button>
                </div>
              )}

              {activeTab === "feed" && !loadingPosts && filteredPosts.length > 0 && feedTotalPages > 1 && (
                <nav
                  className="mt-4 flex flex-col items-stretch gap-3 rounded-2xl border border-white/[0.08] bg-[rgba(15,18,32,0.55)] px-4 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between"
                  aria-label="Feed pagination"
                >
                  <p className="text-center text-sm text-violet-100/70 sm:text-left">
                    Showing{" "}
                    <span className="font-medium text-white">
                      {(Math.min(feedPage, feedTotalPages) - 1) * FEED_PAGE_SIZE + 1}
                    </span>
                    –
                    <span className="font-medium text-white">
                      {Math.min(Math.min(feedPage, feedTotalPages) * FEED_PAGE_SIZE, filteredPosts.length)}
                    </span>{" "}
                    of <span className="font-medium text-white">{filteredPosts.length}</span> posts
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      aria-label="Previous page"
                      disabled={feedPage <= 1}
                      onClick={() => setFeedPage((p) => Math.max(1, p - 1))}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-violet-100 transition-colors hover:border-amber-400/30 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <span className="min-w-[7rem] text-center text-sm tabular-nums text-violet-100/85">
                      Page {Math.min(feedPage, feedTotalPages)} of {feedTotalPages}
                    </span>
                    <button
                      type="button"
                      aria-label="Next page"
                      disabled={feedPage >= feedTotalPages}
                      onClick={() => setFeedPage((p) => Math.min(feedTotalPages, p + 1))}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-violet-100 transition-colors hover:border-amber-400/30 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </nav>
              )}

              {activeTab === "groups" &&
                (filteredGroups.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] py-16 text-center text-violet-200/55 backdrop-blur-md">
                    No groups available yet.
                  </div>
                ) : (
                  filteredGroups.map((group, index) => (
                    <CinematicEnter key={group.id} delay={index * 0.05}>
                      <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_32px_90px_-50px_rgba(0,0,0,0.85)] backdrop-blur-xl transition-all duration-500 hover:border-fuchsia-400/25">
                        <div className="mb-4 flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <h3 className="text-xl font-semibold text-white">{group.name}</h3>
                              {group.privacy === "private" ? (
                                <Lock className="h-4 w-4 shrink-0 text-violet-300/50" />
                              ) : (
                                <Globe className="h-4 w-4 shrink-0 text-emerald-300/70" />
                              )}
                            </div>
                            <p className="mb-3 text-sm leading-relaxed text-violet-200/55">{group.description}</p>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-violet-300/50">
                              <span className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                {group.members.toLocaleString()} members
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageCircle className="h-4 w-4" />
                                {group.posts} posts
                              </span>
                            </div>
                          </div>
                          <motion.button
                            type="button"
                            whileHover={{ y: -1 }}
                            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                            disabled={groupActionId === group.id}
                            onClick={() => toggleGroup(group)}
                            className={cn(
                              "shrink-0 rounded-full px-6 py-2 text-sm font-semibold transition-all",
                              group.isJoined
                                ? "border border-white/15 bg-white/5 text-violet-100/85 hover:bg-white/10"
                                : "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-[0_0_28px_rgba(124,58,237,0.35)]",
                            )}
                          >
                            {groupActionId === group.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : group.isJoined ? (
                              "Joined"
                            ) : (
                              "Join Group"
                            )}
                          </motion.button>
                        </div>
                      </div>
                    </CinematicEnter>
                  ))
                ))}

              {activeTab === "trending" && (
                <div className="space-y-4">
                  {trendingTopics.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] py-16 text-center text-violet-200/55 backdrop-blur-md">
                      Not enough activity for trending tags yet.
                    </div>
                  ) : (
                    trendingTopics.map((topic, index) => (
                      <CinematicEnter key={topic.tag} delay={index * 0.05}>
                        <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl transition-all duration-500 hover:border-fuchsia-400/25">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="mb-1 text-xl font-semibold text-white">#{topic.tag}</h3>
                              <p className="text-sm text-violet-200/50">{topic.posts} posts</p>
                            </div>
                            <TrendingUp className="h-8 w-8 text-fuchsia-400/80" />
                          </div>
                        </div>
                      </CinematicEnter>
                    ))
                  )}
                </div>
              )}

              <CinematicEnter delay={0.15} className="mt-10">
                <div className="relative overflow-hidden rounded-[26px] border border-fuchsia-400/20 bg-gradient-to-br from-violet-950/50 to-[#0c0c16] p-6 shadow-[0_0_48px_-12px_rgba(192,38,211,0.35)]">
                  <div className="pointer-events-none absolute -right-8 top-0 h-32 w-32 rounded-full bg-fuchsia-500/20 blur-3xl" />
                  <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-fuchsia-200/90 shadow-[inset_0_0_24px_rgba(244,114,182,0.12)]">
                      <Heart className="h-9 w-9" strokeWidth={1.25} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-fuchsia-200/60">You matter here</p>
                      <p className="text-lg font-medium leading-snug text-white">Your voice is a lantern — someone needs that light.</p>
                      <p className="text-sm text-violet-200/50">There is no wrong way to show up gently.</p>
                    </div>
                    <motion.button
                      type="button"
                      whileHover={{ y: -1 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="shrink-0 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_28px_rgba(192,38,211,0.4)]"
                      onClick={() => setShowNewPostModal(true)}
                    >
                      Create a post
                    </motion.button>
                  </div>
                </div>
              </CinematicEnter>
            </div>

            <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
              <CinematicEnter delay={0.05}>
                <div className="rounded-[26px] border border-fuchsia-500/20 bg-[rgba(15,18,32,0.82)] p-6 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.75)] backdrop-blur-xl">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-violet-200/70">Community Pulse</h3>
                  {loadingMeta && communityPulse.percent == null ? (
                    <div className="mb-4 flex justify-center py-6">
                      <Loader2 className="h-6 w-6 animate-spin text-fuchsia-300/70" aria-hidden />
                      <span className="sr-only">Loading community pulse</span>
                    </div>
                  ) : (
                    <>
                      {communityPulse.percent != null ? (
                        <p className="mb-4 text-center text-sm font-medium leading-snug text-[#F7F3FF]/90">
                          {communityPulse.headline}
                        </p>
                      ) : null}
                      <div className="relative flex flex-col items-center">
                        <div className="pointer-events-none absolute inset-x-0 top-6 mx-auto h-28 w-28 rounded-full bg-fuchsia-500/20 blur-2xl" />
                        <div className="pointer-events-none absolute inset-x-0 top-10 mx-auto h-20 w-20 rounded-full bg-violet-500/15 blur-xl" />
                        <svg
                          viewBox="0 0 120 72"
                          className="relative w-full max-w-[200px] drop-shadow-[0_0_20px_rgba(192,132,252,0.35)]"
                          role="img"
                          aria-label={
                            communityPulse.percent != null
                              ? `Community pulse at ${communityPulse.percent} percent`
                              : "Community pulse unavailable"
                          }
                        >
                          <defs>
                            <linearGradient id="communityPulseArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#c084fc" />
                              <stop offset="100%" stopColor="#f472b6" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M 12 60 A 48 48 0 0 1 108 60"
                            fill="none"
                            pathLength={PULSE_GAUGE_ARC_LENGTH}
                            stroke="rgba(255,255,255,0.08)"
                            strokeWidth="10"
                            strokeLinecap="round"
                          />
                          {communityPulse.percent != null ? (
                            <path
                              d="M 12 60 A 48 48 0 0 1 108 60"
                              fill="none"
                              pathLength={PULSE_GAUGE_ARC_LENGTH}
                              stroke="url(#communityPulseArcGrad)"
                              strokeWidth="10"
                              strokeLinecap="round"
                              strokeDasharray={`${pulseArcFilled} ${PULSE_GAUGE_ARC_LENGTH}`}
                              className="transition-[stroke-dasharray] duration-700 ease-out"
                            />
                          ) : null}
                        </svg>
                        {communityPulse.percent != null ? (
                          <>
                            <p className="-mt-2 text-center text-3xl font-semibold tabular-nums text-white">
                              {communityPulse.percent}%
                            </p>
                            <p className="mt-1 max-w-[14rem] text-center text-xs font-medium leading-relaxed text-fuchsia-200/70">
                              {communityPulse.detail}
                            </p>
                          </>
                        ) : (
                          <p className="-mt-1 max-w-[15rem] text-center text-xs leading-relaxed text-[#A7A1B8]">
                            {communityPulse.detail}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </CinematicEnter>

              <CinematicEnter delay={0.1}>
                <div className="rounded-[26px] border border-white/10 bg-[rgba(15,18,32,0.82)] p-6 backdrop-blur-xl">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-violet-200/70">Active Now</h3>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex -space-x-2">
                      {postsData.slice(0, 6).map((p) => (
                        <div
                          key={`active-${p.id}`}
                          className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-[#0b0b14]"
                        >
                          {p.author.avatarUrl ? (
                            <img src={p.author.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-700/90 to-indigo-900 text-[10px] font-bold text-white">
                              {initials(p.author.name)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {stats.activeNow > 0 ? (
                      <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-violet-100/85">
                        {stats.activeNow.toLocaleString()} online
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[#A7A1B8]">
                    {stats.activeNow > 0
                      ? "People supporting each other right now."
                      : "People are supporting each other right now."}
                  </p>
                </div>
              </CinematicEnter>

              <CinematicEnter delay={0.12}>
                <div className="rounded-[26px] border border-white/10 bg-[rgba(15,18,32,0.82)] p-6 backdrop-blur-xl">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-violet-200/70">
                      <TrendingUp className="h-4 w-4 text-fuchsia-300/80" aria-hidden />
                      Trending Topics
                    </h3>
                    {trendingTopics.length > 0 ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-fuchsia-200/80 underline-offset-4 transition-colors hover:text-fuchsia-100 hover:underline"
                        onClick={() => setActiveTab("trending")}
                      >
                        View all
                      </button>
                    ) : null}
                  </div>
                  <div className="space-y-4">
                    {trendingTopics.slice(0, 5).map((topic) => (
                      <div key={topic.tag}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                          <span className="truncate font-medium text-violet-100/90">#{topic.tag}</span>
                          <span className="shrink-0 tabular-nums text-violet-300/45">{topic.posts}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-[0_0_12px_rgba(167,139,250,0.5)]"
                            style={{ width: `${Math.max(8, (topic.posts / trendingBarMax) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {trendingTopics.length === 0 && (
                      <p className="text-sm text-violet-200/45">Topics will appear as people share.</p>
                    )}
                  </div>
                </div>
              </CinematicEnter>

              <CinematicEnter delay={0.14}>
                <div className="rounded-[26px] border border-white/10 bg-[rgba(15,18,32,0.82)] p-6 backdrop-blur-xl">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-violet-200/70">
                    Support Circles Happening Now
                  </h3>
                  {supportCirclesPreview.length === 0 ? (
                    <p className="text-sm leading-relaxed text-[#A7A1B8]">
                      No open circles yet. Explore groups when you&apos;re ready.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {supportCirclesPreview.map((g) => {
                        const RowIcon = pickGroupCircleIcon(g);
                        return (
                          <li
                            key={g.id}
                            className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2.5"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10 text-violet-100">
                                <RowIcon className="h-5 w-5" aria-hidden />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-white">{g.name}</p>
                                <p className="truncate text-xs text-violet-300/50">
                                  {g.members > 0 ? `${g.members.toLocaleString()} members` : "Open circle"}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3.5 py-2 text-xs font-semibold text-fuchsia-100/90 transition-colors hover:bg-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={groupActionId === g.id}
                              onClick={() => {
                                if (g.isJoined) {
                                  setActiveTab("groups");
                                } else {
                                  void toggleGroup(g);
                                }
                              }}
                            >
                              {groupActionId === g.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              ) : g.isJoined ? (
                                "Open"
                              ) : (
                                "Join"
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {supportCirclesPreview.length > 0 ? (
                    <button
                      type="button"
                      className="mt-4 w-full text-center text-xs font-semibold text-violet-200/70 underline-offset-4 transition-colors hover:text-fuchsia-200 hover:underline"
                      onClick={() => {
                        setActiveTab("groups");
                        if (groupsData.length === 0) void loadMeta({ includeGroups: true });
                      }}
                    >
                      Browse all circles
                    </button>
                  ) : null}
                </div>
              </CinematicEnter>

              <CinematicEnter delay={0.15}>
                <div className="relative overflow-hidden rounded-[26px] border border-fuchsia-500/15 shadow-[0_28px_70px_-40px_rgba(0,0,0,0.8)]">
                  <img
                    src={COMMUNITY_IMAGES.dailyReminder}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={640}
                    height={360}
                    className="absolute inset-0 h-full w-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050816]/92 via-[#050816]/55 to-[#1e1b4b]/35" />
                  <div className="relative space-y-3 p-6">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-fuchsia-300/90" aria-hidden />
                      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-amber-100/75">Daily reminder</p>
                    </div>
                    <p className="text-lg font-medium leading-snug text-[#F7F3FF]">You don&apos;t have to have it all figured out.</p>
                    <p className="text-sm leading-relaxed text-[#A7A1B8]">One moment at a time.</p>
                  </div>
                </div>
              </CinematicEnter>

              <CinematicEnter delay={0.18}>
                <div className="rounded-[26px] border border-violet-400/15 bg-[rgba(15,18,32,0.82)] p-6 backdrop-blur-xl">
                  <h3 className="mb-4 text-base font-semibold text-[#F7F3FF]">Community Guidelines</h3>
                  <ul className="space-y-3 text-sm leading-relaxed text-[#A7A1B8]">
                    <li className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/80" strokeWidth={2.5} aria-hidden />
                      <span>Be respectful and kind.</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/80" strokeWidth={2.5} aria-hidden />
                      <span>Share your experiences thoughtfully.</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/80" strokeWidth={2.5} aria-hidden />
                      <span>Maintain privacy and confidentiality.</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/80" strokeWidth={2.5} aria-hidden />
                      <span>Report harmful content to support.</span>
                    </li>
                  </ul>
                  <Link
                    to="/app/settings/help-support"
                    className="mt-4 inline-flex text-sm font-semibold text-fuchsia-200/85 underline-offset-4 transition-colors hover:text-fuchsia-100 hover:underline"
                  >
                    Learn more
                  </Link>
                </div>
              </CinematicEnter>
            </div>
          </div>
        </div>
      </div>

      {showNewPostModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#030308]/80 p-4 backdrop-blur-xl"
          onClick={() => !posting && setShowNewPostModal(false)}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#0e0e18]/95 p-8 shadow-[0_0_80px_-20px_rgba(139,92,246,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-2xl font-semibold tracking-tight text-white">Create a New Post</h3>
              <button
                type="button"
                className="rounded-full border border-white/10 p-2 text-violet-200/70 transition-colors hover:bg-white/10 hover:text-white"
                onClick={() => !posting && setShowNewPostModal(false)}
                aria-label="Close"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="Write your post here..."
                className="min-h-[160px] w-full resize-none rounded-2xl border border-white/10 bg-black/40 p-4 text-white placeholder:text-violet-300/35 backdrop-blur-sm focus:border-fuchsia-400/40 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 disabled:opacity-50"
                rows={6}
                disabled={posting}
              />

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <label className="shrink-0 font-medium text-violet-100/80">Category:</label>
                <SolaceSelect
                  value={newPostCategory}
                  onValueChange={setNewPostCategory}
                  ariaLabel="Post category"
                  variant="form"
                  disabled={posting}
                  triggerClassName="flex-1"
                  options={COMMUNITY_POST_CATEGORIES.map((c) => ({ value: c, label: c }))}
                />
              </div>

              {/* Group selection removed: admins create/manage groups. */}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <label className="shrink-0 font-medium text-violet-100/80">Tags:</label>
                <input
                  type="text"
                  value={newPostTags}
                  onChange={(e) => setNewPostTags(e.target.value)}
                  placeholder="Add tags (comma-separated)"
                  className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-violet-300/35 backdrop-blur-sm focus:border-fuchsia-400/40 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 disabled:opacity-50"
                  disabled={posting}
                />
              </div>

              <motion.button
                whileHover={{ y: posting ? 0 : -1 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500 px-6 py-4 text-lg font-semibold text-white shadow-[0_0_36px_rgba(192,38,211,0.35)] transition-shadow hover:shadow-[0_0_48px_rgba(192,38,211,0.5)] disabled:opacity-60"
                onClick={handleCreatePost}
                disabled={posting}
                type="button"
              >
                {posting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                Post
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
