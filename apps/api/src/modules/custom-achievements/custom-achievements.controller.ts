import { FastifyReply, FastifyRequest } from "fastify";
import {
  createCustomAchievement,
  deleteCustomAchievement,
  listCustomAchievements,
  updateCustomAchievement,
} from "./custom-achievements.service";
import {
  CreateCustomAchievementInput,
  UpdateCustomAchievementInput,
} from "./custom-achievements.schema";

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
