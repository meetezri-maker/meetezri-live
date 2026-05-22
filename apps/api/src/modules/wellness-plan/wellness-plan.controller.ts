import { FastifyReply, FastifyRequest } from 'fastify';
import type { WellnessPlanUpsertBody } from './wellness-plan.schema';
import {
  clearWellnessPlanForUser,
  getWellnessPlanForUser,
  upsertWellnessPlanForUser,
} from './wellness-plan.service';

export async function getWellnessPlanHandler(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user as { sub: string };
  const plan = await getWellnessPlanForUser(user.sub);
  return reply.code(200).send(plan);
}

export async function upsertWellnessPlanHandler(
  request: FastifyRequest<{ Body: WellnessPlanUpsertBody }>,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  const plan = await upsertWellnessPlanForUser(user.sub, request.body);
  return reply.code(200).send(plan);
}

export async function clearWellnessPlanHandler(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user as { sub: string };
  const plan = await clearWellnessPlanForUser(user.sub);
  return reply.code(200).send(plan);
}
