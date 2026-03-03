
import { FastifyReply, FastifyRequest } from "fastify";
import { createAvatar, getAllAvatars, getAvatarById, updateAvatar, deleteAvatar } from "./ai-avatars.service";
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
    const avatars = await getAllAvatars();
    return reply.code(200).send(avatars);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: "Failed to fetch avatars" });
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
