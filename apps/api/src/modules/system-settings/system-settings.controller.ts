import { FastifyReply, FastifyRequest } from "fastify";
import { upsertSetting, getSetting, getAllSettings } from "./system-settings.service";
import { UpsertSettingInput, GetSettingInput } from "./system-settings.schema";

export async function upsertSettingHandler(
  request: FastifyRequest<{ Body: UpsertSettingInput }>,
  reply: FastifyReply
) {
  const { key, value, description } = request.body;
  // @ts-ignore - user is attached by auth plugin
  const userId = request.user?.sub;

  const setting = await upsertSetting({ key, value, description }, userId);
  return reply.code(200).send(setting);
}

export async function getSettingHandler(
  request: FastifyRequest<{ Params: GetSettingInput }>,
  reply: FastifyReply
) {
  const { key } = request.params;
  const setting = await getSetting(key);
  
  if (!setting) {
    return reply.code(404).send({ message: "Setting not found" });
  }
  
  return reply.code(200).send(setting);
}

export async function getAllSettingsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const settings = await getAllSettings();
  return reply.code(200).send(settings);
}
