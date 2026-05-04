
import prisma from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import { CreateAvatarInput, UpdateAvatarInput } from "./ai-avatars.schema";

const avatarsCache = new Map<string, { data: any; timestamp: number }>();
const AVATARS_CACHE_TTL = 60 * 1000; // 60s: avatars rarely change, but dashboard hits often.

export function invalidateAvatarsCache() {
  avatarsCache.clear();
}

export async function createAvatar(input: CreateAvatarInput) {
  const created = await prisma.ai_avatars.create({
    data: input as Prisma.ai_avatarsCreateInput,
  });
  invalidateAvatarsCache();
  return created;
}

/** Usage stats from ended sessions whose JSON config matches avatar name (first name or full) or ai_name. */
export async function getAllAvatarsWithUsageStats() {
  const cached = avatarsCache.get("stats");
  if (cached && Date.now() - cached.timestamp < AVATARS_CACHE_TTL) {
    return cached.data;
  }
  const avatars = await prisma.ai_avatars.findMany({
    orderBy: { created_at: "desc" },
  });

  type StatRow = {
    avatar_id: string;
    unique_users: bigint;
    session_count: bigint;
    avg_mins: number | null;
  };

  const statsRows = await prisma.$queryRaw<StatRow[]>`
    WITH matched AS (
      SELECT DISTINCT ON (s.id)
        s.id AS session_id, s.user_id, s.duration_minutes, a.id AS avatar_id
      FROM app_sessions s
      INNER JOIN ai_avatars a ON (
        s.ended_at IS NOT NULL
        AND (
          -- Match on config->>'avatar': exact full name or first word of avatar name
          (
            s.config IS NOT NULL
            AND (s.config->>'avatar') IS NOT NULL
            AND TRIM(s.config->>'avatar') <> ''
            AND (
              LOWER(TRIM(s.config->>'avatar')) = LOWER(a.name)
              OR LOWER(TRIM(s.config->>'avatar')) = LOWER(SPLIT_PART(a.name, ' ', 1))
            )
          )
          -- Match on config->>'ai_name': exact full name or first word of avatar name
          OR (
            s.config IS NOT NULL
            AND (s.config->>'ai_name') IS NOT NULL
            AND TRIM(s.config->>'ai_name') <> ''
            AND (
              LOWER(TRIM(s.config->>'ai_name')) = LOWER(a.name)
              OR LOWER(TRIM(s.config->>'ai_name')) = LOWER(SPLIT_PART(a.name, ' ', 1))
            )
          )
        )
      )
    )
    SELECT avatar_id::text,
      COUNT(DISTINCT user_id) AS unique_users,
      COUNT(*) AS session_count,
      AVG(duration_minutes) AS avg_mins
    FROM matched
    GROUP BY avatar_id
  `;

  const map = new Map(
    statsRows.map((r) => [
      r.avatar_id,
      {
        unique_users: Number(r.unique_users),
        session_count: Number(r.session_count),
        avg_mins: r.avg_mins != null ? Math.round(Number(r.avg_mins) * 10) / 10 : 0,
      },
    ])
  );

  return avatars.map((a) => {
    const s = map.get(a.id);
    return {
      ...a,
      unique_users: s?.unique_users ?? 0,
      session_count: s?.session_count ?? 0,
      avg_session_minutes: s?.avg_mins ?? 0,
    };
  });
}

export async function getAllAvatars() {
  const cached = avatarsCache.get("list");
  if (cached && Date.now() - cached.timestamp < AVATARS_CACHE_TTL) {
    return cached.data;
  }
  const data = await prisma.ai_avatars.findMany({
    orderBy: { created_at: "desc" },
  });
  avatarsCache.set("list", { data, timestamp: Date.now() });
  return data;
}

export async function getAvatarById(id: string) {
  return prisma.ai_avatars.findUnique({
    where: { id },
  });
}

export async function updateAvatar(id: string, input: UpdateAvatarInput) {
  const updated = await prisma.ai_avatars.update({
    where: { id },
    data: input,
  });
  invalidateAvatarsCache();
  return updated;
}

export async function deleteAvatar(id: string) {
  const deleted = await prisma.ai_avatars.delete({
    where: { id },
  });
  invalidateAvatarsCache();
  return deleted;
}

type AvatarSessionRow = {
  id: string;
  user_id: string;
  started_at: Date | null;
  ended_at: Date | null;
  duration_minutes: number | null;
  full_name: string | null;
  email: string | null;
  message_count: number;
};

type AvatarUserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  last_session: Date | null;
  session_count: bigint;
};

/** Paginated ended sessions matched to a specific avatar by name. */
export async function getSessionsForAvatar(avatarId: string, page = 1, limit = 20) {
  const avatar = await prisma.ai_avatars.findUnique({ where: { id: avatarId }, select: { name: true } });
  if (!avatar) throw new Error('Avatar not found');

  const avatarName = avatar.name.toLowerCase().trim();
  const firstName = avatarName.split(' ')[0];
  const skip = Math.max(0, (page - 1) * limit);
  const take = Math.min(Math.max(limit, 1), 100);

  const [items, countRows] = await Promise.all([
    prisma.$queryRaw<AvatarSessionRow[]>`
      SELECT s.id::text, s.user_id::text, s.started_at, s.ended_at, s.duration_minutes,
             p.full_name, p.email,
             (SELECT COUNT(*)::int FROM session_messages sm WHERE sm.session_id = s.id) AS message_count
      FROM app_sessions s
      LEFT JOIN profiles p ON p.id = s.user_id
      WHERE s.ended_at IS NOT NULL
        AND s.config IS NOT NULL
        AND (
          LOWER(TRIM(s.config->>'avatar')) = ${avatarName}
          OR LOWER(TRIM(s.config->>'avatar')) = ${firstName}
          OR LOWER(TRIM(s.config->>'ai_name')) = ${avatarName}
          OR LOWER(TRIM(s.config->>'ai_name')) = ${firstName}
        )
      ORDER BY s.started_at DESC
      LIMIT ${take} OFFSET ${skip}
    `,
    prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*)::bigint AS total
      FROM app_sessions s
      WHERE s.ended_at IS NOT NULL
        AND s.config IS NOT NULL
        AND (
          LOWER(TRIM(s.config->>'avatar')) = ${avatarName}
          OR LOWER(TRIM(s.config->>'avatar')) = ${firstName}
          OR LOWER(TRIM(s.config->>'ai_name')) = ${avatarName}
          OR LOWER(TRIM(s.config->>'ai_name')) = ${firstName}
        )
    `,
  ]);

  return { items, total: Number(countRows[0]?.total ?? 0) };
}

/** All unique users who have had at least one ended session with the given avatar. */
export async function getUsersForAvatar(avatarId: string) {
  const avatar = await prisma.ai_avatars.findUnique({ where: { id: avatarId }, select: { name: true } });
  if (!avatar) throw new Error('Avatar not found');

  const avatarName = avatar.name.toLowerCase().trim();
  const firstName = avatarName.split(' ')[0];

  const rows = await prisma.$queryRaw<AvatarUserRow[]>`
    SELECT p.id::text, p.full_name, p.email, p.avatar_url,
           MAX(s.started_at) AS last_session,
           COUNT(s.id)::bigint AS session_count
    FROM app_sessions s
    INNER JOIN profiles p ON p.id = s.user_id
    WHERE s.ended_at IS NOT NULL
      AND s.config IS NOT NULL
      AND (
        LOWER(TRIM(s.config->>'avatar')) = ${avatarName}
        OR LOWER(TRIM(s.config->>'avatar')) = ${firstName}
        OR LOWER(TRIM(s.config->>'ai_name')) = ${avatarName}
        OR LOWER(TRIM(s.config->>'ai_name')) = ${firstName}
      )
    GROUP BY p.id, p.full_name, p.email, p.avatar_url
    ORDER BY last_session DESC
  `;

  return rows.map((u) => ({ ...u, session_count: Number(u.session_count) }));
}
