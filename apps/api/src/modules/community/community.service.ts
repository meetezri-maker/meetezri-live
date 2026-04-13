import prisma from '../../lib/prisma';
import { invalidateCommunityCaches } from '../admin/admin.service';
import { calculateStreak } from '../users/user.service';

type PrivacyJson = {
  communityEnabled?: boolean;
  showDisplayNameInCommunity?: boolean;
  /** When false, avatar is hidden from community feed and public member profile for others. */
  showAvatarInCommunity?: boolean;
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

export async function getCommunityOverview() {
  const [
    groupCount,
    postCount,
    commentCount,
    distinctMembers,
    recentPosts,
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
      orderBy: { created_at: 'desc' },
      take: 80,
      select: { created_at: true },
    }),
  ]);

  const since = Date.now() - 30 * 60 * 1000;
  const activeNow = recentPosts.filter((p) => p.created_at.getTime() >= since).length;

  const tagCounts = new Map<string, number>();
  const tagRows = await prisma.community_posts.findMany({
    where: { deleted_at: null },
    orderBy: { created_at: 'desc' },
    take: 120,
    select: { tags: true },
  });
  for (const row of tagRows) {
    for (const t of row.tags || []) {
      const k = t.trim().toLowerCase();
      if (!k) continue;
      tagCounts.set(k, (tagCounts.get(k) || 0) + 1);
    }
  }
  const trendingTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, posts]) => ({ tag, posts }));

  return {
    members: distinctMembers.length,
    posts: postCount,
    groups: groupCount,
    comments: commentCount,
    activeNow,
    trendingTags,
  };
}

export async function getCommunityGroupsForUser(userId: string) {
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

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description || '',
    category: g.category || 'General',
    privacy: (g.privacy as 'public' | 'private') || 'public',
    members: g._count.community_group_members,
    posts: g._count.community_posts,
    isJoined: g.community_group_members.length > 0,
  }));
}

export async function getCommunityPostsForUser(userId: string, limit = 30) {
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

  return posts.map((p) => {
    const profile = p.profiles;
    const displayName = resolveAuthorDisplayName(profile?.full_name, profile?.privacy_settings);
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

    return {
      id: p.id,
      author: {
        name: displayName,
        avatarUrl: resolveCommunityAvatarUrl(profile?.avatar_url, profile?.privacy_settings),
        role: authorRole,
      },
      /** True when this post belongs to the requesting user. */
      isByCurrentUser: p.user_id === userId,
      /** Set when the author is not anonymous — use for “view profile” links. */
      authorUserId: displayName === 'Anonymous' ? null : p.user_id,
      content: p.content,
      category,
      createdAt: p.created_at.toISOString(),
      likes: p.likes_count || 0,
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
    select: { privacy_settings: true },
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
  invalidateCommunityCaches();
  return { ok: true };
}

export async function leaveCommunityGroup(userId: string, groupId: string) {
  await prisma.community_group_members.deleteMany({
    where: { group_id: groupId, user_id: userId },
  });
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

  const displayName = resolveAuthorDisplayName(profile.full_name, profile.privacy_settings);
  if (displayName === 'Anonymous') {
    const err = new Error('This profile is not public');
    (err as any).statusCode = 404;
    throw err;
  }

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

  const isSelf = viewerUserId === memberUserId;

  const milestones = [
    { id: 'join', label: 'Joined MeetEzri', unlocked: Boolean(profile.created_at) },
    {
      id: 'onboarding',
      label: 'Completed onboarding',
      unlocked: Boolean(profile.onboarding_completed),
    },
    { id: 'first-session', label: 'First session completed', unlocked: sessions >= 1 },
    { id: 'sessions-5', label: '5 sessions completed', unlocked: sessions >= 5 },
    { id: 'sessions-10', label: '10 sessions completed', unlocked: sessions >= 10 },
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

export async function incrementPostLike(postId: string) {
  const post = await prisma.community_posts.findFirst({
    where: { id: postId, deleted_at: null },
  });
  if (!post) {
    const err = new Error('Post not found');
    (err as any).statusCode = 404;
    throw err;
  }
  const updated = await prisma.community_posts.update({
    where: { id: postId },
    data: { likes_count: { increment: 1 } },
  });
  invalidateCommunityCaches();
  return { likes: updated.likes_count || 0 };
}
