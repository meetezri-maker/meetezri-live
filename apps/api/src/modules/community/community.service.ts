import prisma from '../../lib/prisma';
import { Prisma } from '@prisma/client';
import {
  computeCommunityPulsePercent,
  sentimentSignalsFromTexts,
} from '@meetezri/shared';
import { invalidateCommunityCaches } from '../admin/admin.service';
import { calculateStreak } from '../users/user.service';

let communityOverviewCacheValue: { data: any; timestamp: number } | null = null;
const communityGroupsCache = new Map<string, { data: any; timestamp: number }>();
const communityCommentsCache = new Map<string, { data: any; timestamp: number }>();
const COMMUNITY_CACHE_TTL = 5 * 1000; // 5 seconds

function clearCommunityLocalCaches() {
  communityOverviewCacheValue = null;
  communityGroupsCache.clear();
  communityCommentsCache.clear();
}

type PrivacyJson = {
  communityEnabled?: boolean;
  showDisplayNameInCommunity?: boolean;
  /** When false, avatar is hidden from community feed and public member profile for others. */
  showAvatarInCommunity?: boolean;
  profileVisibility?: string;
} | null;


function resolveCommunityAvatarUrl(
  avatarUrl: string | null | undefined,
  privacy: unknown
): string | null {
  const ps = privacy as PrivacyJson;
  if (ps?.showAvatarInCommunity === false) {
    return null;
  }
  return avatarUrl || null;
}

/** True when privacy settings hide the community profile from other members. */
function isCommunityProfilePrivateForOthers(ps: PrivacyJson): boolean {
  const visibility = ps?.profileVisibility;
  return visibility === 'private' || visibility === 'friends';
}

async function ensureCommunityPostLikesTable(): Promise<void> {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS public.community_post_likes (
      post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      liked_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
      PRIMARY KEY (post_id, user_id)
    )
  `;
}

async function ensureCommunityPresenceTable(): Promise<void> {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS public.community_presence (
      user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
      last_seen_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
    )
  `;
}

const COMMUNITY_ACTIVE_WINDOW_MS = 15 * 60 * 1000;

async function recordCommunityPresence(userId: string): Promise<void> {
  await ensureCommunityPresenceTable();
  await prisma.$executeRaw`
    INSERT INTO public.community_presence (user_id, last_seen_at)
    VALUES (${userId}::uuid, timezone('utc'::text, now()))
    ON CONFLICT (user_id) DO UPDATE
    SET last_seen_at = timezone('utc'::text, now())
  `;
}

async function countActiveCommunityUsers(): Promise<number> {
  await ensureAllCommunityTables();
  const since = new Date(Date.now() - COMMUNITY_ACTIVE_WINDOW_MS);
  const rows = await prisma.$queryRaw<Array<{ c: bigint }>>`
    WITH active AS (
      SELECT user_id AS id
      FROM public.community_presence
      WHERE last_seen_at >= ${since}
      UNION
      SELECT user_id AS id
      FROM public.community_posts
      WHERE deleted_at IS NULL AND created_at >= ${since}
      UNION
      SELECT user_id AS id
      FROM public.community_comments
      WHERE created_at >= ${since}
      UNION
      SELECT user_id AS id
      FROM public.community_post_likes
      WHERE liked_at >= ${since}
    )
    SELECT COUNT(DISTINCT id)::bigint AS c FROM active
  `;
  return Number(rows[0]?.c ?? 0);
}

async function ensureCommunityPostViewsTable(): Promise<void> {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS public.community_post_views (
      post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      viewed_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
      PRIMARY KEY (post_id, user_id)
    )
  `;
}

// Run all three DDL ensures once per server process — avoids DDL overhead on every feed request.
let _tablesEnsuredPromise: Promise<void> | null = null;
function ensureAllCommunityTables(): Promise<void> {
  if (_tablesEnsuredPromise) return _tablesEnsuredPromise;
  _tablesEnsuredPromise = Promise.all([
    ensureCommunityPostViewsTable(),
    ensureCommunityPostLikesTable(),
    ensureCommunityPostAuthorSnapshotsTable(),
    ensureCommunityPresenceTable(),
  ]).then(() => undefined);
  return _tablesEnsuredPromise;
}

function resolveAuthorDisplayName(
  fullName: string | null | undefined,
  privacy: unknown
): string {
  const ps = privacy as PrivacyJson;
  if (ps?.showDisplayNameInCommunity === false) {
    return 'Anonymous';
  }
  return (fullName && fullName.trim()) || 'Member';
}

async function ensureCommunityPostAuthorSnapshotsTable(): Promise<void> {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS public.community_post_author_snapshots (
      post_id uuid PRIMARY KEY REFERENCES public.community_posts(id) ON DELETE CASCADE,
      author_name text NOT NULL,
      author_avatar_url text,
      author_user_id uuid,
      created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
    )
  `;
}


export async function getCommunityOverview(viewerUserId?: string) {
  if (viewerUserId) {
    await recordCommunityPresence(viewerUserId).catch(() => undefined);
  }

  if (
    communityOverviewCacheValue &&
    Date.now() - communityOverviewCacheValue.timestamp < COMMUNITY_CACHE_TTL
  ) {
    const cached = communityOverviewCacheValue.data;
    if (viewerUserId) {
      const activeNow = await countActiveCommunityUsers().catch(() => cached.activeNow ?? 0);
      return { ...cached, activeNow };
    }
    return cached;
  }
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    groupCount,
    postCount,
    commentCount,
    distinctMembers,
    distinctPosters,
    likeAggregate,
    recentPosts7d,
    recentPostContents,
    recentCommentContents,
  ] = await Promise.all([
    prisma.community_groups.count({ where: { archived_at: null } }),
    prisma.community_posts.count({ where: { deleted_at: null } }),
    prisma.community_comments.count(),
    prisma.community_group_members.findMany({
      select: { user_id: true },
      distinct: ['user_id'],
    }),
    prisma.community_posts.findMany({
      where: { deleted_at: null },
      select: { user_id: true },
      distinct: ['user_id'],
    }),
    prisma.community_posts.aggregate({
      where: { deleted_at: null },
      _sum: { likes_count: true },
    }),
    prisma.community_posts.count({
      where: { deleted_at: null, created_at: { gte: sevenDaysAgo } },
    }),
    prisma.community_posts.findMany({
      where: { deleted_at: null, created_at: { gte: sevenDaysAgo } },
      orderBy: { created_at: 'desc' },
      take: 100,
      select: { content: true },
    }),
    prisma.community_comments.findMany({
      where: { created_at: { gte: sevenDaysAgo } },
      orderBy: { created_at: 'desc' },
      take: 150,
      select: { content: true },
    }),
  ]);

  const totalLikes = likeAggregate._sum.likes_count ?? 0;
  const activeNow = await countActiveCommunityUsers().catch(() => 0);
  const pulseSignals = sentimentSignalsFromTexts([
    ...recentPostContents.map((p) => p.content),
    ...recentCommentContents.map((c) => c.content),
  ]);
  const pulse = computeCommunityPulsePercent({
    signals: pulseSignals,
    totalPosts: postCount,
  });

  const tagCounts = new Map<string, number>();
  const tagRows = await prisma.community_posts.findMany({
    where: { deleted_at: null },
    orderBy: { created_at: 'desc' },
    take: 120,
    select: {
      tags: true,
      community_groups: { select: { category: true, name: true } },
    },
  });
  for (const row of tagRows) {
    const baseTags = Array.isArray(row.tags) ? row.tags : [];
    const derived =
      baseTags.length > 0
        ? baseTags
        : [
            row.community_groups?.category ||
              row.community_groups?.name ||
              'general discussion',
          ];
    for (const t of derived) {
      const k = String(t || '').trim().toLowerCase();
      if (!k) continue;
      tagCounts.set(k, (tagCounts.get(k) || 0) + 1);
    }
  }
  const trendingTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, posts]) => ({ tag, posts }));

  const data = {
    members: distinctMembers.length,
    uniquePosters: distinctPosters.length,
    posts: postCount,
    groups: groupCount,
    comments: commentCount,
    activeNow,
    totalLikes,
    recentPosts7d,
    pulsePercent: pulse.percent,
    pulsePositive: pulse.positive,
    pulseNegative: pulse.negative,
    pulseNeutral: pulse.neutral,
    trendingTags,
  };
  communityOverviewCacheValue = { data, timestamp: Date.now() };
  return data;
}

export async function getCommunityGroupsForUser(userId: string) {
  const cached = communityGroupsCache.get(userId);
  if (cached && Date.now() - cached.timestamp < COMMUNITY_CACHE_TTL) {
    return cached.data;
  }
  const groups = await prisma.community_groups.findMany({
    where: { archived_at: null },
    orderBy: { created_at: 'desc' },
    include: {
      _count: {
        select: { community_group_members: true, community_posts: true },
      },
      community_group_members: {
        where: { user_id: userId },
        select: { user_id: true },
      },
    },
  });

  const data = groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description || '',
    category: g.category || 'General',
    privacy: (g.privacy as 'public' | 'private') || 'public',
    members: g._count.community_group_members,
    posts: g._count.community_posts,
    isJoined: g.community_group_members.length > 0,
  }));
  communityGroupsCache.set(userId, { data, timestamp: Date.now() });
  return data;
}

export async function getCommunityPostsForUser(userId: string, limit = 30) {
  await recordCommunityPresence(userId).catch(() => undefined);

  const posts = await prisma.community_posts.findMany({
    where: { deleted_at: null },
    orderBy: { created_at: 'desc' },
    take: Math.min(limit, 50),
    include: {
      profiles: {
        select: {
          full_name: true,
          privacy_settings: true,
          avatar_url: true,
          role: true,
        },
      },
      community_groups: { select: { id: true, name: true, category: true } },
      _count: { select: { community_comments: true } },
    },
  });

  const membershipKeys = posts
    .filter((p) => p.group_id)
    .map((p) => ({ group_id: p.group_id as string, user_id: p.user_id }));

  let roleByPair = new Map<string, string>();
  if (membershipKeys.length > 0) {
    const memberships = await prisma.community_group_members.findMany({
      where: {
        OR: membershipKeys.map((k) => ({
          group_id: k.group_id,
          user_id: k.user_id,
        })),
      },
      select: { group_id: true, user_id: true, role: true },
    });
    roleByPair = new Map(
      memberships.map((m) => [`${m.group_id}:${m.user_id}`, m.role || 'member'])
    );
  }

  const postIds = posts.map((p) => p.id);
  const viewsByPost = new Map<string, number>();
  const likesCountByPost = new Map<string, number>();
  const likedByCurrentUser = new Set<string>();
  const snapshotByPostId = new Map<
    string,
    { author_name: string; author_avatar_url: string | null; author_user_id: string | null }
  >();

  if (postIds.length > 0) {
    // Ensure auxiliary tables exist — runs DDL only once per server process (cached promise).
    await ensureAllCommunityTables();

    const postIdsSql = Prisma.join(postIds.map((id) => Prisma.sql`${id}::uuid`));

    // Record views + fetch counts in one CTE round-trip (was 2 separate queries).
    const viewRows = await prisma.$queryRaw<Array<{ post_id: string; views: bigint }>>(
      Prisma.sql`
        WITH _ins AS (
          INSERT INTO public.community_post_views (post_id, user_id)
          VALUES ${Prisma.join(
            postIds.map((id) => Prisma.sql`(${id}::uuid, ${userId}::uuid)`),
            ', '
          )}
          ON CONFLICT (post_id, user_id) DO NOTHING
        )
        SELECT post_id, COUNT(*)::bigint AS views
        FROM public.community_post_views
        WHERE post_id IN (${postIdsSql})
        GROUP BY post_id
      `
    );
    for (const row of viewRows) {
      viewsByPost.set(row.post_id, Number(row.views || 0));
    }

    // Fetch like counts + whether current user liked — one query (was 2 separate queries).
    const likeRows = await prisma.$queryRaw<
      Array<{ post_id: string; likes: bigint; liked_by_me: boolean }>
    >(
      Prisma.sql`
        SELECT
          post_id,
          COUNT(*)::bigint AS likes,
          BOOL_OR(user_id = ${userId}::uuid) AS liked_by_me
        FROM public.community_post_likes
        WHERE post_id IN (${postIdsSql})
        GROUP BY post_id
      `
    );
    for (const row of likeRows) {
      likesCountByPost.set(row.post_id, Number(row.likes));
      if (row.liked_by_me) likedByCurrentUser.add(row.post_id);
    }

    // Author snapshots.
    const rows = await prisma.$queryRaw<
      Array<{ post_id: string; author_name: string; author_avatar_url: string | null; author_user_id: string | null }>
    >(Prisma.sql`
      SELECT post_id, author_name, author_avatar_url, author_user_id
      FROM public.community_post_author_snapshots
      WHERE post_id IN (${postIdsSql})
    `);
    for (const r of rows) {
      snapshotByPostId.set(r.post_id, {
        author_name: r.author_name,
        author_avatar_url: r.author_avatar_url,
        author_user_id: r.author_user_id,
      });
    }
  }

  return posts.map((p) => {
    const profile = p.profiles;
    const fallbackDisplayName = resolveAuthorDisplayName(profile?.full_name, profile?.privacy_settings);
    let authorRole: 'member' | 'moderator' | 'companion' = 'member';
    if (profile?.role === 'therapist') authorRole = 'companion';
    else if (p.group_id) {
      const r = roleByPair.get(`${p.group_id}:${p.user_id}`);
      if (r === 'moderator' || r === 'admin') authorRole = 'moderator';
    }

    const category =
      p.community_groups?.category ||
      p.community_groups?.name ||
      (p.tags && p.tags[0]) ||
      'General Discussion';

    const snap = snapshotByPostId.get(p.id);
    const displayName = snap?.author_name ?? fallbackDisplayName;
    const avatarUrl =
      snap?.author_avatar_url !== undefined
        ? snap.author_avatar_url
        : resolveCommunityAvatarUrl(profile?.avatar_url, profile?.privacy_settings);
    const authorPrivacy = profile?.privacy_settings as PrivacyJson;
    const showDisplayName = authorPrivacy?.showDisplayNameInCommunity;
    const profilePrivateForOthers = isCommunityProfilePrivateForOthers(authorPrivacy);
    const authorUserId =
      p.user_id === userId
        ? p.user_id
        : showDisplayName !== false && !profilePrivateForOthers
          ? p.user_id
          : null;
    const authorProfilePrivate =
      p.user_id !== userId && profilePrivateForOthers && showDisplayName !== false;

    return {
      id: p.id,
      author: {
        name: displayName,
        avatarUrl,
        role: authorRole,
      },
      /** True when this post belongs to the requesting user. */
      isByCurrentUser: p.user_id === userId,
      /** Set when the author is not anonymous and allows profile discovery — use for “view profile” links. */
      authorUserId,
      /** Name visible in feed but profile page is private for other members. */
      authorProfilePrivate,
      content: p.content,
      category,
      createdAt: p.created_at.toISOString(),
      views: viewsByPost.get(p.id) || 0,
      likes: likesCountByPost.get(p.id) ?? 0,
      likedByMe: likedByCurrentUser.has(p.id),
      comments: p._count.community_comments,
      tags: p.tags || [],
      groupId: p.group_id,
    };
  });
}

export async function createCommunityPost(
  userId: string,
  data: { content: string; tags?: string[]; group_id?: string | null }
) {
  const profile = await prisma.profiles.findUnique({
    where: { id: userId },
    select: { privacy_settings: true, full_name: true, avatar_url: true },
  });
  const ps = profile?.privacy_settings as PrivacyJson;
  if (ps?.communityEnabled === false) {
    const err = new Error('Community participation is disabled in your privacy settings');
    (err as any).statusCode = 403;
    throw err;
  }

  if (data.group_id) {
    const group = await prisma.community_groups.findFirst({
      where: { id: data.group_id, archived_at: null },
    });
    if (!group) {
      const err = new Error('Group not found');
      (err as any).statusCode = 404;
      throw err;
    }
    const isPrivate = group.privacy === 'private';
    if (isPrivate) {
      const member = await prisma.community_group_members.findUnique({
        where: {
          group_id_user_id: { group_id: data.group_id, user_id: userId },
        },
      });
      if (!member) {
        const err = new Error('Join this group before posting');
        (err as any).statusCode = 403;
        throw err;
      }
    }
  }

  const created = await prisma.community_posts.create({
    data: {
      user_id: userId,
      content: data.content.trim(),
      tags: data.tags?.length ? data.tags : [],
      group_id: data.group_id || null,
      likes_count: 0,
    },
  });

  // Snapshot author fields at time of posting so older posts don't change when privacy settings change.
  await ensureCommunityPostAuthorSnapshotsTable();
  const displayName = resolveAuthorDisplayName(profile?.full_name, profile?.privacy_settings);
  const avatarUrl = resolveCommunityAvatarUrl(profile?.avatar_url, profile?.privacy_settings);
  // Snapshot: store author_user_id when user is showing their name (not anonymous).
  // This mirrors the feed logic: profile-link visibility == showDisplayNameInCommunity.
  const showDisplayNameSnap = (profile?.privacy_settings as PrivacyJson)?.showDisplayNameInCommunity;
  const authorUserId = showDisplayNameSnap !== false ? userId : null;
  await prisma.$executeRaw`
    INSERT INTO public.community_post_author_snapshots (post_id, author_name, author_avatar_url, author_user_id)
    VALUES (${created.id}::uuid, ${displayName}, ${avatarUrl}, ${authorUserId}::uuid)
    ON CONFLICT (post_id) DO NOTHING
  `;

  clearCommunityLocalCaches();
  invalidateCommunityCaches();
  return created;
}

export async function joinCommunityGroup(userId: string, groupId: string) {
  const group = await prisma.community_groups.findFirst({
    where: { id: groupId, archived_at: null },
  });
  if (!group) {
    const err = new Error('Group not found');
    (err as any).statusCode = 404;
    throw err;
  }
  const existing = await prisma.community_group_members.findFirst({
    where: { group_id: groupId, user_id: userId },
  });
  if (!existing) {
    await prisma.community_group_members.create({
      data: { group_id: groupId, user_id: userId, role: 'member' },
    });
  }
  clearCommunityLocalCaches();
  invalidateCommunityCaches();
  return { ok: true };
}

export async function leaveCommunityGroup(userId: string, groupId: string) {
  await prisma.community_group_members.deleteMany({
    where: { group_id: groupId, user_id: userId },
  });
  clearCommunityLocalCaches();
  invalidateCommunityCaches();
  return { ok: true };
}

/**
 * Public “view profile” payload for community members (authenticated).
 * Anonymous or community-disabled profiles are not exposed.
 */
export async function getCommunityMemberPublicProfile(
  viewerUserId: string,
  memberUserId: string
) {
  const profile = await prisma.profiles.findUnique({
    where: { id: memberUserId },
    select: {
      full_name: true,
      privacy_settings: true,
      avatar_url: true,
      role: true,
      created_at: true,
      onboarding_completed: true,
      onboarding_completed_at: true,
      selected_avatar: true,
      mood_entries: {
        orderBy: { created_at: 'desc' },
        take: 60,
        select: { created_at: true },
      },
      subscriptions: {
        where: { status: { in: ['active', 'trialing', 'past_due'] } },
        orderBy: { created_at: 'desc' },
        take: 1,
        select: { plan_type: true },
      },
      _count: {
        select: {
          app_sessions: { where: { ended_at: { not: null } } },
          mood_entries: true,
        },
      },
    },
  });

  if (!profile) {
    const err = new Error('Profile not found');
    (err as any).statusCode = 404;
    throw err;
  }

  const ps = profile.privacy_settings as PrivacyJson;
  if (ps?.communityEnabled === false) {
    const err = new Error('This member is not visible in the community');
    (err as any).statusCode = 404;
    throw err;
  }

  const isSelf = viewerUserId === memberUserId;
  if (!isSelf) {
    if (isCommunityProfilePrivateForOthers(ps)) {
      const err = new Error('This account is private');
      (err as any).statusCode = 403;
      (err as any).code = 'PROFILE_PRIVATE';
      throw err;
    }
    if (ps?.showDisplayNameInCommunity === false) {
      const err = new Error('This profile is not visible in the community');
      (err as any).statusCode = 404;
      throw err;
    }
  }

  // Note: a user can choose to appear "Anonymous" in the community feed while still having a
  // public profile (no link is shown when anonymous, but direct URLs shouldn't 404 if public).
  const displayName = resolveAuthorDisplayName(profile.full_name, profile.privacy_settings);

  const sessions = profile._count.app_sessions;
  const checkins = profile._count.mood_entries;
  const streakDays = calculateStreak(profile.mood_entries);

  const planType = profile.subscriptions[0]?.plan_type || 'trial';
  const planLabel =
    typeof planType === 'string' && planType.length > 0
      ? planType.replace(/_/g, ' ')
      : 'trial';

  let authorRole: 'member' | 'moderator' | 'companion' = 'member';
  if (profile.role === 'therapist') authorRole = 'companion';

  const milestones = [
    { id: 'join', label: 'Joined Solace', unlocked: Boolean(profile.created_at) },
    {
      id: 'onboarding',
      label: 'Completed onboarding',
      unlocked: Boolean(profile.onboarding_completed),
    },
    { id: 'first-talk', label: 'First Talk completed', unlocked: sessions >= 1 },
    { id: 'talks-5', label: '5 Talks completed', unlocked: sessions >= 5 },
    { id: 'talks-10', label: '10 Talks completed', unlocked: sessions >= 10 },
    { id: 'checkins-10', label: '10 mood check-ins', unlocked: checkins >= 10 },
    { id: 'streak-7', label: '7-day activity streak', unlocked: streakDays >= 7 },
    {
      id: 'profile-full',
      label: 'Profile fully complete',
      unlocked: Boolean(profile.onboarding_completed && sessions >= 3),
    },
  ];

  return {
    id: memberUserId,
    isSelf,
    displayName,
    // Always respect showAvatarInCommunity so /profile/:id matches what others see
    // (owners can see their real photo on /app/user-profile).
    avatarUrl: resolveCommunityAvatarUrl(profile.avatar_url, profile.privacy_settings),
    authorRole,
    selectedAvatarLabel:
      profile.selected_avatar && profile.selected_avatar !== 'Default Avatar'
        ? profile.selected_avatar
        : 'Default',
    createdAt: profile.created_at.toISOString(),
    onboardingCompleted: Boolean(profile.onboarding_completed),
    onboardingCompletedAt: profile.onboarding_completed_at?.toISOString() ?? null,
    planLabel,
    stats: {
      completedSessions: sessions,
      totalCheckins: checkins,
      streakDays,
    },
    milestones,
  };
}

/** One like per user per post; same endpoint toggles on/off. */
export async function togglePostLike(userId: string, postId: string) {
  const post = await prisma.community_posts.findFirst({
    where: { id: postId, deleted_at: null },
    select: { id: true },
  });
  if (!post) {
    const err = new Error('Post not found');
    (err as any).statusCode = 404;
    throw err;
  }

  await ensureAllCommunityTables();
  await recordCommunityPresence(userId).catch(() => undefined);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.$queryRaw<Array<{ one: number }>>`
      SELECT 1 AS one
      FROM public.community_post_likes
      WHERE post_id = ${postId}::uuid AND user_id = ${userId}::uuid
      LIMIT 1
    `;
    if (existing.length > 0) {
      await tx.$executeRaw`
        DELETE FROM public.community_post_likes
        WHERE post_id = ${postId}::uuid AND user_id = ${userId}::uuid
      `;
    } else {
      await tx.$executeRaw`
        INSERT INTO public.community_post_likes (post_id, user_id)
        VALUES (${postId}::uuid, ${userId}::uuid)
        ON CONFLICT (post_id, user_id) DO NOTHING
      `;
    }
    const countRows = await tx.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*)::bigint AS c
      FROM public.community_post_likes
      WHERE post_id = ${postId}::uuid
    `;
    const likesTotal = Number(countRows[0]?.c ?? 0);
    const meRows = await tx.$queryRaw<Array<{ one: number }>>`
      SELECT 1 AS one
      FROM public.community_post_likes
      WHERE post_id = ${postId}::uuid AND user_id = ${userId}::uuid
      LIMIT 1
    `;
    return { likes: likesTotal, likedByMe: meRows.length > 0 };
  });

  try {
    await prisma.community_posts.update({
      where: { id: postId },
      data: { likes_count: result.likes },
    });
  } catch {
    /* likes_count is denormalized; feed reads from community_post_likes */
  }

  clearCommunityLocalCaches();
  invalidateCommunityCaches();
  return result;
}

export async function addPostComment(userId: string, postId: string, content: string) {
  const post = await prisma.community_posts.findFirst({
    where: { id: postId, deleted_at: null },
    select: { id: true },
  });
  if (!post) {
    const err = new Error('Post not found');
    (err as any).statusCode = 404;
    throw err;
  }

  await prisma.community_comments.create({
    data: {
      post_id: postId,
      user_id: userId,
      content: content.trim(),
    },
  });

  const comments = await prisma.community_comments.count({
    where: { post_id: postId },
  });
  clearCommunityLocalCaches();
  invalidateCommunityCaches();
  return { comments };
}

export async function getPostCommentsForUser(viewerUserId: string, postId: string) {
  const key = `${viewerUserId}|${postId}`;
  const cached = communityCommentsCache.get(key);
  if (cached && Date.now() - cached.timestamp < COMMUNITY_CACHE_TTL) {
    return cached.data;
  }
  const post = await prisma.community_posts.findFirst({
    where: { id: postId, deleted_at: null },
    select: { id: true },
  });
  if (!post) {
    const err = new Error('Post not found');
    (err as any).statusCode = 404;
    throw err;
  }

  const rows = await prisma.community_comments.findMany({
    where: { post_id: postId },
    orderBy: { created_at: 'asc' },
    include: {
      profiles: {
        select: {
          full_name: true,
          avatar_url: true,
          privacy_settings: true,
          role: true,
        },
      },
    },
  });

  const data = rows.map((c) => {
    const p = c.profiles;
    const displayName = resolveAuthorDisplayName(p?.full_name, p?.privacy_settings);
    return {
      id: c.id,
      userId: c.user_id,
      isByCurrentUser: c.user_id === viewerUserId,
      author: {
        name: displayName,
        avatarUrl: resolveCommunityAvatarUrl(p?.avatar_url, p?.privacy_settings),
        role: p?.role === 'therapist' ? 'companion' : 'member',
      },
      content: c.content,
      createdAt: c.created_at.toISOString(),
    };
  });
  communityCommentsCache.set(key, { data, timestamp: Date.now() });
  return data;
}

export async function updatePostComment(
  userId: string,
  postId: string,
  commentId: string,
  content: string
) {
  const comment = await prisma.community_comments.findFirst({
    where: { id: commentId, post_id: postId },
    select: { user_id: true },
  });
  if (!comment) {
    const err = new Error('Comment not found');
    (err as any).statusCode = 404;
    throw err;
  }
  if (comment.user_id !== userId) {
    const err = new Error('You can only edit your own comments');
    (err as any).statusCode = 403;
    throw err;
  }

  await prisma.community_comments.update({
    where: { id: commentId },
    data: { content: content.trim() },
  });
  clearCommunityLocalCaches();
  invalidateCommunityCaches();
  return { ok: true };
}

export async function deletePostComment(userId: string, postId: string, commentId: string) {
  const comment = await prisma.community_comments.findFirst({
    where: { id: commentId, post_id: postId },
    select: { user_id: true },
  });
  if (!comment) {
    const err = new Error('Comment not found');
    (err as any).statusCode = 404;
    throw err;
  }
  if (comment.user_id !== userId) {
    const err = new Error('You can only delete your own comments');
    (err as any).statusCode = 403;
    throw err;
  }

  await prisma.community_comments.delete({ where: { id: commentId } });
  const comments = await prisma.community_comments.count({ where: { post_id: postId } });
  clearCommunityLocalCaches();
  invalidateCommunityCaches();
  return { ok: true, comments };
}

export async function updateCommunityPost(
  userId: string,
  postId: string,
  content: string,
  tags?: string[]
) {
  const post = await prisma.community_posts.findFirst({
    where: { id: postId, deleted_at: null },
    select: { user_id: true },
  });
  if (!post) {
    const err = new Error('Post not found');
    (err as any).statusCode = 404;
    throw err;
  }
  if (post.user_id !== userId) {
    const err = new Error('You can only edit your own posts');
    (err as any).statusCode = 403;
    throw err;
  }
  const normalizedTags =
    tags === undefined
      ? undefined
      : tags
          .map((t) => String(t || '').trim())
          .filter(Boolean)
          .slice(0, 20);
  await prisma.community_posts.update({
    where: { id: postId },
    data: { content: content.trim(), ...(normalizedTags ? { tags: normalizedTags } : {}) },
  });
  clearCommunityLocalCaches();
  invalidateCommunityCaches();
  return { ok: true };
}

export async function deleteCommunityPost(userId: string, postId: string) {
  const post = await prisma.community_posts.findFirst({
    where: { id: postId, deleted_at: null },
    select: { user_id: true },
  });
  if (!post) {
    const err = new Error('Post not found');
    (err as any).statusCode = 404;
    throw err;
  }
  if (post.user_id !== userId) {
    const err = new Error('You can only delete your own posts');
    (err as any).statusCode = 403;
    throw err;
  }
  await prisma.community_posts.update({
    where: { id: postId },
    data: { deleted_at: new Date() },
  });
  clearCommunityLocalCaches();
  invalidateCommunityCaches();
  return { ok: true };
}
