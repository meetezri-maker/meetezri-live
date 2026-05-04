
import { FastifyReply, FastifyRequest } from "fastify";
import {
  createAvatar,
  getAllAvatars,
  getAllAvatarsWithUsageStats,
  getAvatarById,
  updateAvatar,
  deleteAvatar,
  getSessionsForAvatar,
  getUsersForAvatar,
} from "./ai-avatars.service";
import { CreateAvatarInput, UpdateAvatarInput } from "./ai-avatars.schema";

export async function createAvatarHandler(
  request: FastifyRequest<{ Body: CreateAvatarInput }>,
  reply: FastifyReply
) {
  try {
    const avatar = await createAvatar(request.body);
    return reply.code(201).send(avatar);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: "Failed to create avatar" });
  }
}

export async function getAllAvatarsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // App uses this for companion selection. Keep it fast: return base avatar rows only.
    const avatars = await getAllAvatars();
    return reply.code(200).send(avatars);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: "Failed to fetch avatars" });
  }
}

export async function getAllAvatarsWithUsageStatsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const avatars = await getAllAvatarsWithUsageStats();
    return reply.code(200).send(avatars);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: "Failed to fetch avatars stats" });
  }
}

export async function getAvatarByIdHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const avatar = await getAvatarById(id);
    if (!avatar) {
      return reply.code(404).send({ message: "Avatar not found" });
    }
    return reply.code(200).send(avatar);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: "Failed to fetch avatar" });
  }
}

export async function updateAvatarHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateAvatarInput }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const avatar = await updateAvatar(id, request.body);
    return reply.code(200).send(avatar);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: "Failed to update avatar" });
  }
}

export async function deleteAvatarHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    await deleteAvatar(id);
    return reply.code(204).send();
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: "Failed to delete avatar" });
  }
}

export async function getAvatarSessionsHandler(
  request: FastifyRequest<{ Params: { id: string }; Querystring: { page?: string; limit?: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const page = request.query.page ? parseInt(request.query.page, 10) : 1;
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;
    const result = await getSessionsForAvatar(id, page, limit);
    return reply.code(200).send(result);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: "Failed to fetch avatar sessions" });
  }
}

export async function getAvatarUsersHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const users = await getUsersForAvatar(id);
    return reply.code(200).send(users);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: "Failed to fetch avatar users" });
  }
}
