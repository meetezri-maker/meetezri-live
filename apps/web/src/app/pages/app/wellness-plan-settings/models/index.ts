/**
 * Wellness plan domain models — canonical types live in `@meetezri/shared`.
 * UI helpers and editor state: `../wellnessPlanModel.ts`
 */
export type {
  WellnessPlanDocument,
  WellnessPlanListItem,
  WellnessPlanOnboardingDraft,
  WellnessPlanProfessionalSupport,
  WellnessPlanRecord,
  WellnessPlanResponse,
  WellnessPlanSectionId,
  WellnessPlanTrustedContact,
  WellnessPlanUpsertBody,
} from '@meetezri/shared';

export {
  WELLNESS_PLAN_SECTION_IDS,
  wellnessPlanListItemSchema,
  wellnessPlanOnboardingDraftSchema,
  wellnessPlanProfessionalSupportSchema,
  wellnessPlanRecordSchema,
  wellnessPlanResponseSchema,
  wellnessPlanSectionIdSchema,
  wellnessPlanTrustedContactSchema,
  wellnessPlanUpsertBodySchema,
  emptyWellnessPlanResponse,
  wellnessPlanResponseToDocument,
  wellnessPlanUpsertBodyFromDocument,
} from '@meetezri/shared';
