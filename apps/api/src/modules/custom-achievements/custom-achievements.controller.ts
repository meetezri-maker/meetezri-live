import { FastifyReply, FastifyRequest } from "fastify";
import {
  addAchievementCheckIn,
  createCustomAchievement,
  deleteCustomAchievement,
  DuplicateAchievementCheckInError,
  listAchievementCheckIns,
  listCustomAchievements,
  updateCustomAchievement,
} from "./custom-achievements.service";
import {
  CreateAchievementCheckInInput,
  CreateCustomAchievementInput,
  UpdateCustomAchievementInput,
} from "./custom-achievements.schema";
import { completeItem } from "../gamification/completion.service";
import { ProgressValidationError } from "../gamification/progress.service";

export async function listCustomAchievementsHandler(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user as { sub: string };
  return reply.send(await listCustomAchievements(user.sub));
}

export async function createCustomAchievementHandler(
  request: FastifyRequest<{ Body: CreateCustomAchievementInput }>,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  const row = await createCustomAchievement(user.sub, request.body);
  return reply.code(201).send(row);
}

export async function updateCustomAchievementHandler(
  request: FastifyRequest<{ Params: { achievementId: string }; Body: UpdateCustomAchievementInput }>,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  const row = await updateCustomAchievement(user.sub, request.params.achievementId, request.body);
  if (!row) return reply.code(404).send({ message: "Custom achievement not found" });
  return reply.send(row);
}

export async function deleteCustomAchievementHandler(
  request: FastifyRequest<{ Params: { achievementId: string } }>,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  const ok = await deleteCustomAchievement(user.sub, request.params.achievementId);
  if (!ok) return reply.code(404).send({ message: "Custom achievement not found" });
  return reply.code(204).send();
}

/**
 * Award the personal-achievement completion reward (once) when the item has
 * reached 100%. Idempotent: repeat calls never grant duplicate points.
 */
export async function completeCustomAchievementHandler(
  request: FastifyRequest<{ Params: { achievementId: string } }>,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  const result = await completeItem({
    userId: user.sub,
    itemType: "personal_achievement",
    itemId: request.params.achievementId,
  });
  if (result.reason === "not_found") {
    return reply.code(404).send({ message: "Custom achievement not found" });
  }
  if (result.reason === "not_complete") {
    return reply.code(409).send({ message: "Achievement has not reached 100%", points: result.points });
  }
  return reply.send(result);
}

export async function listAchievementCheckInsHandler(
  request: FastifyRequest<{ Params: { achievementId: string } }>,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  const rows = await listAchievementCheckIns(user.sub, request.params.achievementId);
  return reply.send(rows);
}

export async function addAchievementCheckInHandler(
  request: FastifyRequest<{ Params: { achievementId: string }; Body: CreateAchievementCheckInInput }>,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  try {
    const row = await addAchievementCheckIn(user.sub, request.params.achievementId, request.body);
    if (!row) return reply.code(404).send({ message: "Custom achievement not found" });
    return reply.code(201).send(row);
  } catch (err) {
    if (err instanceof DuplicateAchievementCheckInError) {
      return reply.code(409).send({ message: err.message });
    }
    if (err instanceof ProgressValidationError) {
      return reply.code(400).send({ message: err.message });
    }
    throw err;
  }
}
