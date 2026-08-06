import prisma from '../../lib/prisma';
import { emailService } from '../email/email.service';
import type { FoundingMemberSignupBody } from './founding-members.schema';

/** Approved Founding Member benefit stored on every lead so it can be honoured at launch. */
export const FOUNDING_MEMBER_DISCOUNT_PERCENTAGE = 20;
export const FOUNDING_MEMBER_DEFAULT_SOURCE = 'prelaunch_landing_page';
export const FOUNDING_MEMBER_DEFAULT_STATUS = 'waiting';
/**
 * Set once the welcome email is accepted by the provider. A failed send leaves
 * the row at `waiting`, which is what makes unsent leads findable later.
 *
 * `status` is a plain String column with no enum or CHECK constraint, so this
 * value needs no migration.
 */
export const FOUNDING_MEMBER_EMAIL_SENT_STATUS = 'email_sent';

export const FOUNDING_MEMBER_CREATED_MESSAGE = 'Welcome to the Founding Circle.';
export const FOUNDING_MEMBER_EXISTING_MESSAGE =
  'You are already part of the Founding Circle.';

export type FoundingMemberSignupResult = {
  success: true;
  status: 'created' | 'existing';
  message: string;
};

/**
 * Structural subset of the Fastify/pino logger, so the service can log through
 * the request logger without importing Fastify or inventing a second logger.
 */
export type FoundingMemberLogger = {
  error: (context: Record<string, unknown>, message: string) => void;
  /** Present on the Fastify/pino logger; optional so tests can pass `{ error }` alone. */
  info?: (context: Record<string, unknown>, message: string) => void;
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
  input: FoundingMemberSignupBody,
  logger?: FoundingMemberLogger
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

  let created: { id: string };

  try {
    created = await prisma.founding_members.create({
      // The id is what the post-send status update targets, so the row is
      // identified exactly rather than looked up by email a second time.
      select: { id: true },
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

  /*
   * Awaited, not fire-and-forget.
   *
   * This API runs as a Vercel serverless function (`apps/api/vercel.json` +
   * `api/index.ts`). Once the handler returns, the instance is frozen and may be
   * terminated, so a detached promise is not guaranteed to finish — and an SMTP
   * round trip to Resend measures ~2s, far longer than that window. Every row in
   * the table was stuck at `waiting` with `updated_at == created_at`, which is
   * exactly what a killed background promise looks like.
   *
   * `sendFoundingCircleWelcome` handles all of its own errors and never throws,
   * so awaiting it cannot fail registration. It is also internally time-bounded,
   * so it cannot push the handler past the 9s ceiling in `api/index.ts`.
   *
   * Only new rows reach here: both the `existing` lookup and the P2002 race
   * return before this point, so no repeat submission can trigger a second send.
   */
  await sendFoundingCircleWelcome(created.id, email, firstName, logger);

  return {
    success: true,
    status: 'created',
    message: FOUNDING_MEMBER_CREATED_MESSAGE,
  };
}

/**
 * Upper bound on the welcome email, so a hung SMTP socket cannot hold the
 * request open. `api/index.ts` fails the whole request at 9s; the shared
 * transport's own timeouts are 30s and belong to every other transactional
 * email, so the bound is applied here rather than by retuning the transport.
 *
 * A timeout is treated exactly like a delivery failure: the row stays
 * `waiting` and remains retryable.
 */
const WELCOME_EMAIL_TIMEOUT_MS = 7000;

/**
 * Welcome email, then the status transition. Awaited by the caller.
 *
 * Never throws: every path is caught and reported, so registration succeeds
 * regardless of what the mail provider does. The member is already persisted
 * before this runs, so nothing here can roll back the write.
 *
 * Lifecycle:
 *   created            -> `waiting`
 *   email delivered    -> `email_sent`
 *   email failed       -> stays `waiting`, so a future retry process can find it
 *
 * The send and the status update are caught separately on purpose. If the mail
 * provider accepted the message but the update fails, the error is logged and
 * the message is *not* sent again — a duplicate email is worse than a stale row.
 */
async function sendFoundingCircleWelcome(
  id: string,
  email: string,
  firstName: string | null,
  logger?: FoundingMemberLogger
): Promise<void> {
  // The address itself is user data and is never logged. The domain alone
  // distinguishes a provider-wide outage from a single bad address.
  const emailDomain = email.split('@')[1] ?? 'unknown';
  const base = {
    foundingMemberId: id,
    emailDomain,
    template: 'founding_circle_welcome',
    smtpHost: process.env.SMTP_HOST ?? 'unset',
  };

  function report(error: unknown, message: string, extra: Record<string, unknown> = {}) {
    // Nodemailer surfaces the useful diagnosis on `code` and `command`; neither
    // contains credentials or message content.
    const e = error as { code?: string; command?: string; responseCode?: number } | undefined;
    const context = {
      err: error,
      ...base,
      errorCode: e?.code,
      errorCommand: e?.command,
      responseCode: e?.responseCode,
      ...extra,
    };
    if (logger) {
      logger.error(context, message);
      return;
    }
    // No request logger (direct service call, scripts, tests): still surface it.
    console.error(message, context);
  }

  let timer: NodeJS.Timeout | undefined;

  try {
    const payload = emailService.buildFoundingCircleWelcomeEmail({
      // Now carries the full name submitted through the form, not just a first
      // name — the parameter keeps its name for compatibility.
      firstName: firstName ?? undefined,
    });

    const info = (await Promise.race([
      emailService.sendEmail(email, payload.subject, payload.html, payload.text),
      new Promise((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              Object.assign(new Error('Welcome email timed out'), { code: 'ETIMEDOUT_WELCOME' })
            ),
          WELCOME_EMAIL_TIMEOUT_MS
        );
      }),
    ])) as { messageId?: string; accepted?: unknown[]; rejected?: unknown[] } | undefined;

    // Safe delivery diagnostics: no address, no subject, no body.
    logger?.info?.(
      {
        ...base,
        messageId: info?.messageId,
        acceptedCount: info?.accepted?.length ?? 0,
        rejectedCount: info?.rejected?.length ?? 0,
      },
      'Founding Circle welcome email accepted by provider'
    );
  } catch (error) {
    // Delivery failed or timed out: leave the row at `waiting` so it stays retryable.
    report(error, 'Founding Circle welcome email failed');
    return;
  } finally {
    if (timer) clearTimeout(timer);
  }

  try {
    await prisma.founding_members.update({
      where: { id },
      data: { status: FOUNDING_MEMBER_EMAIL_SENT_STATUS },
    });
  } catch (error) {
    // The email did go out; only the bookkeeping failed. Surfaced, never retried.
    report(error, 'Founding Circle status update failed after a successful send', {
      foundingMemberId: id,
      intendedStatus: FOUNDING_MEMBER_EMAIL_SENT_STATUS,
    });
  }
}
