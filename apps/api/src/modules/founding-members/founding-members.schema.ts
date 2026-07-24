import { z } from 'zod';

/** Attribution strings are stored verbatim but capped so a crafted URL can't bloat a row. */
const ATTRIBUTION_MAX = 255;
const URL_MAX = 2048;

const attributionField = z.string().trim().max(ATTRIBUTION_MAX).nullish();

export const foundingMemberSignupBodySchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .min(3, 'Please enter a valid email address')
    .max(254, 'Please enter a valid email address')
    .email('Please enter a valid email address'),
  firstName: z.string().trim().max(80).nullish(),
  source: attributionField,
  campaign: attributionField,
  utmSource: attributionField,
  utmMedium: attributionField,
  utmCampaign: attributionField,
  utmContent: attributionField,
  utmTerm: attributionField,
  referrer: z.string().trim().max(URL_MAX).nullish(),
  landingPage: z.string().trim().max(URL_MAX).nullish(),
  consentSource: attributionField,
});

export type FoundingMemberSignupBody = z.infer<typeof foundingMemberSignupBodySchema>;

export const foundingMemberSignupResponseSchema = z.object({
  success: z.literal(true),
  status: z.enum(['created', 'existing']),
  message: z.string(),
});

export type FoundingMemberSignupResponse = z.infer<typeof foundingMemberSignupResponseSchema>;
