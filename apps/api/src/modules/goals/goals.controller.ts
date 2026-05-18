import { FastifyReply, FastifyRequest } from "fastify";
import {
  addGoalCheckIn,
  createGoal,
  getGoalById,
  listGoalCheckIns,
  listGoals,
  removeGoal,
  updateGoal,
  updateGoalStatus,
} from "./goals.service";
import {
  CreateGoalCheckInInput,
  CreateGoalInput,
  UpdateGoalInput,
  UpdateGoalStatusInput,
} from "./goals.schema";

export async function listGoalsHandler(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user as { sub: string };
  const goals = await listGoals(user.sub);
  return reply.send(goals);
}

export async function getGoalHandler(
  request: FastifyRequest<{ Params: { goalId: string } }>,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  const goal = await getGoalById(user.sub, request.params.goalId);
  if (!goal) return reply.code(404).send({ message: "Goal not found" });
  return reply.send(goal);
}

export async function createGoalHandler(
  request: FastifyRequest<{ Body: CreateGoalInput }>,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  const goal = await createGoal(user.sub, request.body);
  return reply.code(201).send(goal);
}

export async function updateGoalHandler(
  request: FastifyRequest<{ Params: { goalId: string }; Body: UpdateGoalInput }>,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  const goal = await updateGoal(user.sub, request.params.goalId, request.body);
  if (!goal) return reply.code(404).send({ message: "Goal not found" });
  return reply.send(goal);
}

export async function updateGoalStatusHandler(
  request: FastifyRequest<{ Params: { goalId: string }; Body: UpdateGoalStatusInput }>,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  const goal = await updateGoalStatus(user.sub, request.params.goalId, request.body);
  if (!goal) return reply.code(404).send({ message: "Goal not found" });
  return reply.send(goal);
}

export async function deleteGoalHandler(
  request: FastifyRequest<{ Params: { goalId: string } }>,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  const ok = await removeGoal(user.sub, request.params.goalId);
  if (!ok) return reply.code(404).send({ message: "Goal not found" });
  return reply.code(204).send();
}

export async function listGoalCheckInsHandler(
  request: FastifyRequest<{ Params: { goalId: string } }>,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  const goal = await getGoalById(user.sub, request.params.goalId);
  if (!goal) return reply.code(404).send({ message: "Goal not found" });
  const rows = await listGoalCheckIns(user.sub, request.params.goalId);
  return reply.send(rows);
}

export async function createGoalCheckInHandler(
  request: FastifyRequest<{ Params: { goalId: string }; Body: CreateGoalCheckInInput }>,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  const row = await addGoalCheckIn(user.sub, request.params.goalId, request.body);
  if (!row) return reply.code(404).send({ message: "Goal not found" });
  return reply.code(201).send(row);
}
