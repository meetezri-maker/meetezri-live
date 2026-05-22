import type { Prisma } from '@prisma/client';
import {
  emptyWellnessPlanResponse,
  type WellnessPlanResponse,
  type WellnessPlanUpsertBody,
} from '@meetezri/shared';
import prisma from '../../lib/prisma';

function mapRowToResponse(row: {
  id: string;
  user_id: string;
  warning_signs: string[];
  coping_strategies: string[];
  social_distractions: string[];
  trusted_contacts: Prisma.JsonValue;
  professional_support: Prisma.JsonValue;
  environment_safety: string[];
  last_updated: Date;
}): WellnessPlanResponse {
  const professional =
    row.professional_support && typeof row.professional_support === 'object'
      ? (row.professional_support as { reasons_to_live?: string[] })
      : null;

  return {
    id: row.id,
    user_id: row.user_id,
    warning_signs: row.warning_signs ?? [],
    coping_strategies: row.coping_strategies ?? [],
    social_distractions: row.social_distractions ?? [],
    trusted_contacts: (row.trusted_contacts ?? []) as WellnessPlanResponse['trusted_contacts'],
    professional_support: professional
      ? { reasons_to_live: professional.reasons_to_live ?? [] }
      : { reasons_to_live: [] },
    environment_safety: row.environment_safety ?? [],
    last_updated: row.last_updated.toISOString(),
  };
}

export async function getWellnessPlanForUser(userId: string): Promise<WellnessPlanResponse> {
  const row = await prisma.safety_plans.findFirst({
    where: { user_id: userId },
    orderBy: { last_updated: 'desc' },
    select: {
      id: true,
      user_id: true,
      warning_signs: true,
      coping_strategies: true,
      social_distractions: true,
      trusted_contacts: true,
      professional_support: true,
      environment_safety: true,
      last_updated: true,
    },
  });

  if (!row) {
    return emptyWellnessPlanResponse(userId);
  }

  return mapRowToResponse(row);
}

export async function upsertWellnessPlanForUser(
  userId: string,
  body: WellnessPlanUpsertBody
): Promise<WellnessPlanResponse> {
  const data = {
    warning_signs: body.warning_signs,
    coping_strategies: body.coping_strategies,
    social_distractions: body.social_distractions,
    trusted_contacts: body.trusted_contacts as Prisma.InputJsonValue,
    professional_support: { reasons_to_live: body.reasons_to_live } as Prisma.InputJsonValue,
    environment_safety: body.environment_safety,
    last_updated: new Date(),
  };

  const existing = await prisma.safety_plans.findFirst({
    where: { user_id: userId },
    orderBy: { last_updated: 'desc' },
    select: { id: true },
  });

  const row = existing
    ? await prisma.safety_plans.update({
        where: { id: existing.id },
        data,
        select: {
          id: true,
          user_id: true,
          warning_signs: true,
          coping_strategies: true,
          social_distractions: true,
          trusted_contacts: true,
          professional_support: true,
          environment_safety: true,
          last_updated: true,
        },
      })
    : await prisma.safety_plans.create({
        data: {
          user_id: userId,
          ...data,
        },
        select: {
          id: true,
          user_id: true,
          warning_signs: true,
          coping_strategies: true,
          social_distractions: true,
          trusted_contacts: true,
          professional_support: true,
          environment_safety: true,
          last_updated: true,
        },
      });

  return mapRowToResponse(row);
}

export async function clearWellnessPlanForUser(userId: string): Promise<WellnessPlanResponse> {
  return upsertWellnessPlanForUser(userId, {
    warning_signs: [],
    coping_strategies: [],
    social_distractions: [],
    trusted_contacts: [],
    reasons_to_live: [],
    environment_safety: [],
  });
}
