import { FastifyReply, FastifyRequest } from "fastify";
import { CreateHabitInput, UpdateHabitInput, LogHabitInput } from "./habits.schema";
import { createHabit, getHabits, updateHabit, deleteHabit, logHabitCompletion, removeHabitCompletion } from "./habits.service";

interface UserPayload {
  sub: string;
  email?: string;
  role?: string;
}

export async function createHabitHandler(
  request: FastifyRequest<{
    Body: CreateHabitInput;
  }>,
  reply: FastifyReply
) {
  try {
    const user = request.user as UserPayload;
    const habit = await createHabit(user.sub, request.body);
    return reply.code(201).send(habit);
  } catch (e: any) {
    console.error('Error creating habit:', e);
    if (e.message && e.message.includes('User profile not found')) {
      return reply.code(400).send({ message: e.message });
    }
    return reply.code(500).send({ message: "Error creating habit", error: e.message });
  }
}

export async function getHabitsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const user = request.user as UserPayload;
    const habits = await getHabits(user.sub);
    return reply.code(200).send(habits);
  } catch (e) {
    console.error(e);
    return reply.code(500).send({ message: "Error fetching habits" });
  }
}

export async function updateHabitHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: UpdateHabitInput;
  }>,
  reply: FastifyReply
) {
  try {
    const user = request.user as UserPayload;
    const habit = await updateHabit(user.sub, request.params.id, request.body);
    return reply.code(200).send(habit);
  } catch (e) {
    console.error(e);
    return reply.code(500).send({ message: "Error updating habit" });
  }
}

export async function deleteHabitHandler(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  try {
    const user = request.user as UserPayload;
    await deleteHabit(user.sub, request.params.id);
    return reply.code(204).send();
  } catch (e) {
    console.error(e);
    return reply.code(500).send({ message: "Error deleting habit" });
  }
}

export async function logHabitCompletionHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: LogHabitInput;
  }>,
  reply: FastifyReply
) {
  try {
    const user = request.user as UserPayload;
    const log = await logHabitCompletion(user.sub, request.params.id, request.body);
    return reply.code(201).send(log);
  } catch (e) {
    console.error(e);
    return reply.code(500).send({ message: "Error logging habit completion" });
  }
}

export async function getUserHabitsHandler(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply
) {
  try {
    const { userId } = request.params;
    const habits = await getHabits(userId);
    return reply.code(200).send(habits);
  } catch (e) {
    console.error(e);
    return reply.code(500).send({ message: "Error fetching user habits" });
  }
}

export async function removeHabitCompletionHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Querystring: { date: string };
  }>,
  reply: FastifyReply
) {
  try {
    const user = request.user as UserPayload;
    const result = await removeHabitCompletion(user.sub, request.params.id, request.query.date);
    return reply.code(200).send(result);
  } catch (e) {
    console.error(e);
    return reply.code(500).send({ message: "Error removing habit completion" });
  }
}
