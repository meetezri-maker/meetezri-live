import { FastifyReply, FastifyRequest } from "fastify";
import { createMood, getMoodsByUserId, getAllMoods } from "./moods.service";
import { CreateMoodInput } from "./moods.schema";

export async function createMoodHandler(
  request: FastifyRequest<{ Body: CreateMoodInput }>,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  const mood = await createMood(user.sub, request.body);
  return reply.code(201).send(mood);
}

export async function getMyMoodsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  const moods = await getMoodsByUserId(user.sub);
  return reply.send(moods);
}

export async function getAllMoodsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const moods = await getAllMoods();
  return reply.send(moods);
}

export async function getUserMoodsHandler(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply
) {
  const { userId } = request.params;
  const moods = await getMoodsByUserId(userId);
  return reply.send(moods);
}
