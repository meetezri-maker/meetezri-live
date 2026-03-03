import prisma from "../../lib/prisma";
import { UpsertSettingInput } from "./system-settings.schema";

export async function upsertSetting(input: UpsertSettingInput, userId?: string) {
  const { key, value, description } = input;
  
  return prisma.system_settings.upsert({
    where: { key },
    update: {
      value,
      description,
      updated_at: new Date(),
      updated_by: userId,
    },
    create: {
      key,
      value,
      description,
      updated_by: userId,
    },
  });
}

export async function getSetting(key: string) {
  return prisma.system_settings.findUnique({
    where: { key },
  });
}

export async function getAllSettings() {
  return prisma.system_settings.findMany();
}
