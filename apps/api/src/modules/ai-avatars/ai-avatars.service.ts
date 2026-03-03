
import prisma from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import { CreateAvatarInput, UpdateAvatarInput } from "./ai-avatars.schema";

export async function createAvatar(input: CreateAvatarInput) {
  return prisma.ai_avatars.create({
    data: input as Prisma.ai_avatarsCreateInput,
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
