import prisma from '../../lib/prisma';
import { emailService } from '../email/email.service';
import type { FoundingMemberSignupBody } from './founding-members.schema';

/** Approved Founding Member benefit stored on every lead so it can be honoured at launch. */
export const FOUNDING_MEMBER_DISCOUNT_PERCENTAGE = 20;
export const FOUNDING_MEMBER_DEFAULT_SOURCE = 'prelaunch_landing_page';
export const FOUNDING_MEMBER_DEFAULT_STATUS = 'waiting';

export const FOUNDING_MEMBER_CREATED_MESSAGE = 'Welcome to the Founding Circle.';
export const FOUNDING_MEMBER_EXISTING_MESSAGE =
  'You are already part of the Founding Circle.';

export type FoundingMemberSignupResult = {
  success: true;
  status: 'created' | 'existing';
  message: string;
};

/**
 * `User@example.com`, `user@example.com` and ` user@example.com ` are the same address.
 * The normalized value is what gets stored, so the unique index does the deduping.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeOptional(value: string | null | undefined, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

/**
 * Idempotent Founding Circle signup.
 *
 * A repeat submission is never an error: the caller gets a reassuring `existing`
 * response and no duplicate row is written. Concurrent submissions of the same
 * address race on the unique index and the loser is folded into `existing` too.
 */
export async function registerFoundingMember(
  input: FoundingMemberSignupBody
): Promise<FoundingMemberSignupResult> {
  const email = normalizeEmail(input.email);
  const firstName = normalizeOptional(input.firstName, 80);

  const existing = await prisma.founding_members.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    return {
      success: true,
      status: 'existing',
      message: FOUNDING_MEMBER_EXISTING_MESSAGE,
    };
  }

  try {
    await prisma.founding_members.create({
      data: {
        email,
        first_name: firstName,
        status: FOUNDING_MEMBER_DEFAULT_STATUS,
        source: normalizeOptional(input.source, 255) ?? FOUNDING_MEMBER_DEFAULT_SOURCE,
        campaign: normalizeOptional(input.campaign, 255),
        utm_source: normalizeOptional(input.utmSource, 255),
        utm_medium: normalizeOptional(input.utmMedium, 255),
        utm_campaign: normalizeOptional(input.utmCampaign, 255),
        utm_content: normalizeOptional(input.utmContent, 255),
        utm_term: normalizeOptional(input.utmTerm, 255),
        referrer: normalizeOptional(input.referrer, 2048),
        landing_page: normalizeOptional(input.landingPage, 2048),
        consent_source: normalizeOptional(input.consentSource, 255),
        discount_percentage: FOUNDING_MEMBER_DISCOUNT_PERCENTAGE,
        founding_member: true,
      },
    });
  } catch (error: unknown) {
    // P2002 = unique constraint violation. Another request won the race; same outcome.
    if ((error as { code?: string })?.code === 'P2002') {
      return {
        success: true,
        status: 'existing',
        message: FOUNDING_MEMBER_EXISTING_MESSAGE,
      };
    }
    throw error;
  }

  // Confirmation email is best-effort: a mail failure must never lose a captured lead.
  // Only new rows reach here, so repeated submissions cannot trigger duplicate emails.
  void sendFoundingCircleConfirmation(email, firstName);

  return {
    success: true,
    status: 'created',
    message: FOUNDING_MEMBER_CREATED_MESSAGE,
  };
}

async function sendFoundingCircleConfirmation(
  email: string,
  firstName: string | null
): Promise<void> {
  try {
    const payload = emailService.buildFoundingCircleWelcomeEmail({
      firstName: firstName ?? undefined,
      discountPercentage: FOUNDING_MEMBER_DISCOUNT_PERCENTAGE,
    });
    await emailService.sendEmail(email, payload.subject, payload.html, payload.text);
  } catch (error) {
    console.error('Founding Circle confirmation email failed:', error);
  }
}
