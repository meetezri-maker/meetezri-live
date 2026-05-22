import { z } from 'zod';

/** UI / API section identifiers (maps to `safety_plans` columns). */
export const WELLNESS_PLAN_SECTION_IDS = [
  'warning-signs',
  'coping-strategies',
  'distractions',
  'safe-people',
  'safe-places',
  'reasons-to-live',
] as const;

export type WellnessPlanSectionId = (typeof WELLNESS_PLAN_SECTION_IDS)[number];

export const wellnessPlanSectionIdSchema = z.enum([
  'warning-signs',
  'coping-strategies',
  'distractions',
  'safe-people',
  'safe-places',
  'reasons-to-live',
]);

export const wellnessPlanTrustedContactSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  relation: z.string().optional(),
});

export type WellnessPlanTrustedContact = z.infer<typeof wellnessPlanTrustedContactSchema>;

export const wellnessPlanProfessionalSupportSchema = z.object({
  reasons_to_live: z.array(z.string()).optional(),
});

export type WellnessPlanProfessionalSupport = z.infer<
  typeof wellnessPlanProfessionalSupportSchema
>;

/** One line item inside a plan section. */
export const wellnessPlanListItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

export type WellnessPlanListItem = z.infer<typeof wellnessPlanListItemSchema>;

/** Request body for PUT /api/wellness-plan */
export const wellnessPlanUpsertBodySchema = z.object({
  warning_signs: z.array(z.string()),
  coping_strategies: z.array(z.string()),
  social_distractions: z.array(z.string()),
  trusted_contacts: z.union([
    z.array(z.string()),
    z.array(wellnessPlanTrustedContactSchema),
  ]),
  reasons_to_live: z.array(z.string()),
  environment_safety: z.array(z.string()),
});

export type WellnessPlanUpsertBody = z.infer<typeof wellnessPlanUpsertBodySchema>;

/** Response from GET/PUT /api/wellness-plan */
export const wellnessPlanResponseSchema = z.object({
  id: z.string().uuid().nullable(),
  user_id: z.string().uuid(),
  warning_signs: z.array(z.string()),
  coping_strategies: z.array(z.string()),
  social_distractions: z.array(z.string()),
  trusted_contacts: z.union([
    z.array(z.string()),
    z.array(wellnessPlanTrustedContactSchema),
  ]),
  professional_support: wellnessPlanProfessionalSupportSchema.nullable(),
  environment_safety: z.array(z.string()),
  last_updated: z.string().nullable(),
});

export type WellnessPlanResponse = z.infer<typeof wellnessPlanResponseSchema>;

/** Prisma / PostgREST row shape for `public.safety_plans`. */
export const wellnessPlanRecordSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  warning_signs: z.array(z.string()).nullable(),
  coping_strategies: z.array(z.string()).nullable(),
  social_distractions: z.array(z.string()).nullable(),
  trusted_contacts: z
    .union([z.array(z.string()), z.array(wellnessPlanTrustedContactSchema)])
    .nullable(),
  professional_support: wellnessPlanProfessionalSupportSchema.nullable(),
  environment_safety: z.array(z.string()).nullable(),
  last_updated: z.string().optional(),
});

export type WellnessPlanRecord = z.infer<typeof wellnessPlanRecordSchema>;

/** Domain aggregate (camelCase). */
export interface WellnessPlanDocument {
  id: string | null;
  userId: string;
  warningSigns: string[];
  copingStrategies: string[];
  distractions: string[];
  trustedContacts: WellnessPlanTrustedContact[];
  safePlaces: string[];
  reasonsToLive: string[];
  lastUpdated?: string | null;
}

/** Onboarding draft before a full plan is synced. */
export const wellnessPlanOnboardingDraftSchema = z.object({
  warningSigns: z.string(),
  copingStrategies: z.string(),
  supportContacts: z.string(),
  createdAt: z.string().optional(),
});

export type WellnessPlanOnboardingDraft = z.infer<typeof wellnessPlanOnboardingDraftSchema>;

export function emptyWellnessPlanResponse(userId: string): WellnessPlanResponse {
  return {
    id: null,
    user_id: userId,
    warning_signs: [],
    coping_strategies: [],
    social_distractions: [],
    trusted_contacts: [],
    professional_support: { reasons_to_live: [] },
    environment_safety: [],
    last_updated: null,
  };
}

export function wellnessPlanResponseToDocument(res: WellnessPlanResponse): WellnessPlanDocument {
  const trusted =
    Array.isArray(res.trusted_contacts) && res.trusted_contacts.length > 0
      ? typeof res.trusted_contacts[0] === 'string'
        ? (res.trusted_contacts as string[]).map((line) => ({ name: line }))
        : (res.trusted_contacts as WellnessPlanTrustedContact[])
      : [];

  return {
    id: res.id,
    userId: res.user_id,
    warningSigns: res.warning_signs,
    copingStrategies: res.coping_strategies,
    distractions: res.social_distractions,
    trustedContacts: trusted,
    safePlaces: res.environment_safety,
    reasonsToLive: res.professional_support?.reasons_to_live ?? [],
    lastUpdated: res.last_updated,
  };
}

export function wellnessPlanUpsertBodyFromDocument(doc: Omit<WellnessPlanDocument, 'id' | 'lastUpdated'>): WellnessPlanUpsertBody {
  return {
    warning_signs: doc.warningSigns,
    coping_strategies: doc.copingStrategies,
    social_distractions: doc.distractions,
    trusted_contacts: doc.trustedContacts,
    reasons_to_live: doc.reasonsToLive,
    environment_safety: doc.safePlaces,
  };
}
