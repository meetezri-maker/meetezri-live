import { z } from 'zod';

/**
 * Reusable system prompt / copy configuration for the Emergency Contact Consent flow.
 * Safe to import from API jobs, admin tools, or the web app — keep UI separate from this object.
 */
export const EmergencyContactConsentPromptSchema = z.object({
  id: z.literal('emergency_contact_notification_consent'),
  version: z.string().min(1),
  title: z.string().min(1),
  purposeHeading: z.string().min(1),
  purposeBody: z.string().min(1),
  emergencyOnlyHeading: z.string().min(1),
  emergencyOnlyBody: z.string().min(1),
  additionalNotes: z.array(z.string()).default([]),
  checkboxLabel: z.string().min(1),
  consentButtonLabel: z.string().min(1),
  cancelButtonLabel: z.string().min(1),
});

export type EmergencyContactConsentPrompt = z.infer<
  typeof EmergencyContactConsentPromptSchema
>;

/** Default production copy (referenced by Emergency Contacts UI). */
export const EMERGENCY_CONTACT_CONSENT_PROMPT: EmergencyContactConsentPrompt =
  EmergencyContactConsentPromptSchema.parse({
    id: 'emergency_contact_notification_consent',
    version: '1.0.0',
    title: 'Emergency contact notification',
    purposeHeading: 'What you are agreeing to',
    purposeBody:
      'Solace may contact the emergency contacts you add when there is a serious concern for your safety or wellbeing, so someone you trust can help you get support. This step asks for your consent before you manage emergency contacts in the app.',
    emergencyOnlyHeading: 'Important',
    emergencyOnlyBody:
      'Emergency contact notification is not used for marketing, reminders, or routine messages. It is only for serious, safety-related situations where reaching someone you trust may help protect you or get you appropriate help.',
    additionalNotes: [
      'You can update or remove emergency contacts at any time in settings.',
      'If you do not consent, you can use Cancel to leave this page without saving anything to your emergency contacts.',
    ],
    checkboxLabel:
      'I understand and agree that my emergency contact may be notified in serious concern situations for my safety.',
    consentButtonLabel: 'I Consent',
    cancelButtonLabel: 'Cancel',
  });
