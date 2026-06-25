import { z } from 'zod';

export {
  EMERGENCY_CONTACT_CONSENT_PROMPT,
  EmergencyContactConsentPromptSchema,
  type EmergencyContactConsentPrompt,
} from './prompts/emergencyContactConsent';

export {
  canonicalCompanionDisplayName,
  companionAnalyticsChartLabel,
  mergeCompanionAvatarCounts,
} from './companions';
export {
  DEFAULT_AI_COMPANIONS,
  matchDefaultCompanionByAvatarName,
  type DefaultAiCompanionDefinition,
} from './defaultAiCompanions';

export {
  WELLNESS_PLAN_SECTION_IDS,
  wellnessPlanSectionIdSchema,
  wellnessPlanTrustedContactSchema,
  wellnessPlanProfessionalSupportSchema,
  wellnessPlanListItemSchema,
  wellnessPlanUpsertBodySchema,
  wellnessPlanResponseSchema,
  wellnessPlanRecordSchema,
  wellnessPlanOnboardingDraftSchema,
  emptyWellnessPlanResponse,
  wellnessPlanResponseToDocument,
  wellnessPlanUpsertBodyFromDocument,
  type WellnessPlanSectionId,
  type WellnessPlanTrustedContact,
  type WellnessPlanProfessionalSupport,
  type WellnessPlanListItem,
  type WellnessPlanUpsertBody,
  type WellnessPlanResponse,
  type WellnessPlanRecord,
  type WellnessPlanDocument,
  type WellnessPlanOnboardingDraft,
} from './wellnessPlan';

export {
  SOLACE_TRANSCRIPT_LABEL,
  deriveSessionSummaryFromTranscript,
  formatTranscriptForSummary,
  formatTranscriptLine,
  transcriptSpeakerLabel,
  type TranscriptMessage,
} from './sessionTranscriptSummary';

export {
  scoreCommunityTextSentiment,
  sentimentSignalsFromTexts,
  computeCommunityPulsePercent,
  communityPulseHeadlineFromPercent,
  communityPulseDetailFromSignals,
  type CommunitySentimentScore,
  type CommunityPulseSignal,
  type CommunityPulseResult,
} from './communityPulse';

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string().optional(),
});

export {
  PHONE_COUNTRY_RULES,
  OPTIONAL_PHONE_VALIDATION_MESSAGE,
  REQUIRED_PHONE_VALIDATION_MESSAGE,
  countPhoneDigits,
  getMaxLocalDigitsForDialCode,
  isValidOptionalAppPhone,
  isValidRequiredAppPhone,
  matchPhoneCountryRule,
  type PhoneCountryRule,
} from './phoneValidation';

export {
  CRISIS_HOTLINES_BY_COUNTRY,
  DIAL_CODE_TO_COUNTRY,
  SUPPORTED_CRISIS_COUNTRY_CODES,
  buildCrisisResourcesForCountry,
  countryCodeFromPhoneValue,
  dialCodeToCountryCode,
  getCountryHotlineEntry,
  isSupportedCrisisCountry,
  type CountryHotlineEntry,
  type CrisisHotlineExtra,
  type CrisisResourceDto,
  type CrisisResourceType,
} from './crisisHotlines';

export type UserProfile = z.infer<typeof UserProfileSchema>;
