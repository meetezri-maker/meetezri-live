
import prisma from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import { CreateAvatarInput, UpdateAvatarInput } from "./ai-avatars.schema";

export async function createAvatar(input: CreateAvatarInput) {
  return prisma.ai_avatars.create({
    data: input as Prisma.ai_avatarsCreateInput,
  });
}

/** Usage stats from ended sessions whose JSON config matches avatar name (first name or full) or ai_name. */
export async function getAllAvatarsWithUsageStats() {
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
      SELECT s.id AS session_id, s.user_id, s.duration_minutes, a.id AS avatar_id
      FROM app_sessions s
      INNER JOIN ai_avatars a ON (
        s.ended_at IS NOT NULL
        AND s.config IS NOT NULL
        AND (
          (
            (s.config->>'avatar') IS NOT NULL AND (
              LOWER(TRIM(s.config->>'avatar')) = LOWER(SPLIT_PART(a.name, ' ', 1))
              OR LOWER(TRIM(s.config->>'avatar')) = LOWER(a.name)
            )
          )
          OR (
            (s.config->>'ai_name') IS NOT NULL
            AND LOWER(TRIM(s.config->>'ai_name')) = LOWER(a.name)
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
  return prisma.ai_avatars.findMany({
    orderBy: { created_at: "desc" },
  });
}

export async function getAvatarById(id: string) {
  return prisma.ai_avatars.findUnique({
    where: { id },
  });
}

export async function updateAvatar(id: string, input: UpdateAvatarInput) {
  return prisma.ai_avatars.update({
    where: { id },
    data: input,
  });
}

export async function deleteAvatar(id: string) {
  return prisma.ai_avatars.delete({
    where: { id },
  });
}
