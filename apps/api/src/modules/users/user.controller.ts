import { FastifyReply, FastifyRequest } from 'fastify';
import { onboardingSchema, updateProfileSchema, checkUserSchema, CheckUserInput, SignupInput, signupSchema } from './user.schema';
import * as userService from './user.service';
import * as billingService from '../billing/billing.service';
import { supabaseAdmin } from '../../config/supabase';
import { emailService } from '../email/email.service';

interface UserPayload {
  sub: string;
  email?: string;
  role?: string;
}

type ReportCrisisBody = {
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  eventType?: string;
  keywords?: string[];
  aiConfidence?: number;
  notes?: string;
};

function sanitizeSelfProfileResponse(profile: Record<string, any> | null) {
  if (!profile) return profile;
  const sanitized = { ...profile };

  // Internal/billing/admin-oriented keys should not be exposed from self profile endpoints.
  delete (sanitized as any).stripe_customer_id;
  delete (sanitized as any).stripe_subscription_id;
  delete (sanitized as any).organization_id;
  delete (sanitized as any).deleted_at;
  if ((sanitized as any).permissions && typeof (sanitized as any).permissions === 'object') {
    const perms = { ...((sanitized as any).permissions as Record<string, any>) };
    if (perms.two_factor_knowledge && typeof perms.two_factor_knowledge === 'object') {
      perms.two_factor_knowledge = {
        enabled: perms.two_factor_knowledge.enabled === true,
        security_question: perms.two_factor_knowledge.security_question || null,
      };
    }
    (sanitized as any).permissions = perms;
  }

  return sanitized;
}

function tryParseHttpOrigin(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function getWebBaseUrlFromRequest(
  request: FastifyRequest
): { webBaseUrl: string; source: string } {
  const origin = request.headers.origin;
  const referer = request.headers.referer;

  // Browser requests from the SPA always send Origin (same-origin POST) or Referer.
  // Use that first so production (e.g. Vercel) verification links match the site the user
  // signed up on. The previous logic only honored localhost origins and fell back to env /
  // localhost, which broke deployed frontends when WEB_BASE_URL was unset on the API.
  const fromOrigin = tryParseHttpOrigin(origin);
  if (fromOrigin) {
    return { webBaseUrl: fromOrigin, source: 'request.origin' };
  }

  const fromReferer = tryParseHttpOrigin(referer);
  if (fromReferer) {
    return { webBaseUrl: fromReferer, source: 'request.referer' };
  }

  const envWebBaseUrl =
    process.env.WEB_BASE_URL ||
    process.env.APP_URL ||
    process.env.CLIENT_URL ||
    'http://localhost:5173';

  return { webBaseUrl: envWebBaseUrl, source: 'env' };
}

function resolvePostVerificationTargetPath(signupType: 'trial' | 'plan') {
  // Redirect-only fix:
  // Trial verification magiclink should return to the in-app profile route.
  // Paid flow remains unchanged.
  return signupType === 'trial' ? '/app/user-profile' : '/onboarding/welcome';
}

function buildVerificationRedirectTo(
  webBaseUrl: string,
  signupType: 'trial' | 'plan'
) {
  const targetPath = resolvePostVerificationTargetPath(signupType);
  // Use exact final route URLs per flow so Supabase sends users directly.
  const redirectTo = `${webBaseUrl}${targetPath}`;
  return { redirectTo, targetPath };
}

export async function checkUserExistsHandler(
  request: FastifyRequest<{ Body: CheckUserInput }>,
  reply: FastifyReply
) {
  const { email } = request.body;
  const result = await userService.checkUserExists(email);
  return result;
}

export async function signupHandler(
  request: FastifyRequest<{ Body: SignupInput }>,
  reply: FastifyReply
) {
  const { email, password, firstName, lastName } = request.body;

  const accountState = await userService.resolveAccountStateByEmail(email);
  request.log.info({ email, state: accountState.state }, 'Signup attempt resolved account state');

  const signupType: 'trial' | 'plan' =
    accountState.signup_type === 'trial'
      ? 'trial'
      : 'plan';

  // If onboarding is fully complete, don't allow duplicate account creation.
  if (accountState.state === 'FULLY_ONBOARDED') {
    return reply.code(400).send({ message: 'Account already active. Please log in.' });
  }

  try {
    const fullName = `${firstName} ${lastName}`.trim();

    // Reuse existing auth row when signup retry happens after partial failures.
    let authUserId = accountState.auth_user_id;

    // 1. Create user in Supabase Auth (unconfirmed) only if the auth row is missing
    if (!authUserId) {
      const { data: user, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: false,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
            signup_source: 'app',
          },
        });

      if (createError) throw createError;
      if (!user.user) throw new Error('Failed to create user');

      authUserId = user.user.id;
    }

    if (request.body.stripe_session_id && authUserId) {
      try {
        await userService.createProfileForPaidSignup(authUserId, email, fullName);
        await billingService.linkSubscriptionToUser(authUserId, request.body.stripe_session_id);
      } catch (error) {
        request.log.error({ error }, 'Failed to attach paid subscription during signup');
      }
    }

    // If the email is already verified, do not resend verification.
    // The client will redirect based on onboarding completion state.
    if (accountState.state !== 'NO_ACCOUNT' && !accountState.needs_email_verification) {
      return reply.code(200).send({
        success: true,
        message:
          'Account setup exists but onboarding is not complete. Please continue onboarding.',
        action: 'continue_onboarding',
        next_route:
          signupType === 'trial' ? '/onboarding/profile-setup' : '/onboarding/welcome',
      });
    }

    const { webBaseUrl: baseUrl, source: baseUrlSource } =
      getWebBaseUrlFromRequest(request);

    const { redirectTo: finalRedirectTo, targetPath } =
      buildVerificationRedirectTo(baseUrl, signupType);

    // Required debug logging: exact redirectTo passed to Supabase (Auth admin generateLink).
    request.log.info(
      {
        env: {
          NODE_ENV: process.env.NODE_ENV,
          WEB_BASE_URL: process.env.WEB_BASE_URL,
          APP_URL: process.env.APP_URL,
          CLIENT_URL: process.env.CLIENT_URL,
        },
        request: {
          origin: request.headers.origin,
          referer: request.headers.referer,
          baseUrl,
          baseUrlSource,
          isLocal: baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'),
          signupType,
          targetPath,
        },
        supabase: {
          type: 'signup',
          redirectTo: finalRedirectTo,
        },
      },
      'Supabase signup generateLink redirectTo (exact, per-flow)'
    );

    // 2. Generate verification link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        redirectTo: finalRedirectTo,
      }
    });

    if (linkError) throw linkError;
    const verificationLink = linkData.properties?.action_link;

    if (!verificationLink) throw new Error('Failed to generate verification link');

    const welcomeVerificationEmail = emailService.buildWelcomeVerificationEmail({
      firstName,
      verificationLink,
      audience: signupType,
    });

    await emailService.sendEmail(
      email,
      welcomeVerificationEmail.subject,
      welcomeVerificationEmail.html,
      welcomeVerificationEmail.text
    );

    return reply.code(201).send({
      success: true,
      message: 'Verification email sent. Please check your inbox to verify your account.',
      action: 'verification_sent',
    });

  } catch (error: any) {
    request.log.error({ error }, 'Signup failed');
    return reply.code(500).send({ message: error.message || 'Signup failed' });
  }
}

export async function resendVerificationHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload & { email?: string };
  const userId = user.sub;
  const email = user.email || await userService.getUserEmail(userId);

  if (!email) {
    return reply.code(400).send({ message: 'Email not found' });
  }

  try {
    const profile = await userService.getProfile(userId);
    // Resolve flow type deterministically.
    let signupTypeResolved: 'trial' | 'plan' | null = null;
    if (profile?.signup_type === 'trial' || profile?.signup_type === 'plan') {
      signupTypeResolved = profile.signup_type;
    } else {
      try {
        const metaSignup = await userService.getSignupTypeFromAuthMeta(userId);
        if (metaSignup) signupTypeResolved = metaSignup;
      } catch {
        // leave as null
      }
    }

    const { webBaseUrl: baseUrl, source: baseUrlSource } =
      getWebBaseUrlFromRequest(request);

    const signupTypeForRedirect: 'trial' | 'plan' =
      signupTypeResolved === 'trial' ? 'trial' : 'plan';
    const { redirectTo, targetPath } = buildVerificationRedirectTo(
      baseUrl,
      signupTypeForRedirect
    );

    // Required debug logging: exact redirectTo passed to Supabase (Auth admin generateLink).
    request.log.info(
      {
        env: {
          NODE_ENV: process.env.NODE_ENV,
          WEB_BASE_URL: process.env.WEB_BASE_URL,
          APP_URL: process.env.APP_URL,
          CLIENT_URL: process.env.CLIENT_URL,
        },
        request: {
          origin: request.headers.origin,
          referer: request.headers.referer,
          baseUrl,
          baseUrlSource,
          isLocal: baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'),
          signupTypeResolved,
          targetPath,
        },
        supabase: {
          type: 'magiclink',
          redirectTo,
        },
      },
      'Supabase resend generateLink redirectTo (exact, per-flow)'
    );

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo,
      },
    });

    if (linkError) throw linkError;
    const verificationLink = linkData.properties?.action_link;
    if (!verificationLink) throw new Error('Failed to generate verification link');

    const verificationReminderEmail = emailService.buildVerificationReminderEmail({
      verificationLink,
      audience: signupTypeResolved === 'trial' ? 'trial' : 'plan',
    });

    await emailService.sendEmail(
      email,
      verificationReminderEmail.subject,
      verificationReminderEmail.html,
      verificationReminderEmail.text
    );

    return reply.code(200).send({ success: true, message: 'Verification email sent' });
  } catch (error: any) {
    request.log.error({ error }, 'Resend verification failed');
    return reply.code(500).send({ message: error.message || 'Failed to send verification email' });
  }
}

export async function getAllUsersHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const query = request.query as any;
    const page = query.page ? parseInt(query.page, 10) : 1;
    const limit = query.limit ? parseInt(query.limit, 10) : 50;

    const users = await userService.getAllUsers(page, limit);
    return users;
  } catch (error) {
    request.log.error({ error }, 'Failed to fetch all users');
    return reply.code(500).send({ message: 'Failed to fetch users' });
  }
}

export async function getUserProfileAdminHandler(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply
) {
  const { userId } = request.params;
  const profile = await userService.getProfile(userId);

  if (!profile) {
    return reply.code(404).send({ message: 'Profile not found' });
  }

  return profile;
}

export async function getMeHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const profile = await userService.getProfile(user.sub);

  if (!profile) {
    return reply.code(404).send({ message: 'Profile not found' });
  }

  return sanitizeSelfProfileResponse(profile as any);
}

export async function initProfileHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  request.log.info({ user }, 'Initializing profile for user');
  
  const existingProfile = await userService.getProfile(user.sub);
  if (existingProfile) {
    // Ensure flow type exists for deterministic trial vs plan routing.
    if (!existingProfile.signup_type) {
      try {
        const signupType = await userService.getSignupTypeFromAuthMeta(user.sub);
        if (signupType) {
          await userService.setSignupTypeForProfile(user.sub, signupType);
        }
      } catch (e) {
        request.log.warn({ e }, 'Failed to backfill signup_type on initProfile');
      }
      const refreshedProfile = await userService.getProfile(user.sub);
      return sanitizeSelfProfileResponse(refreshedProfile as any);
    }
    return sanitizeSelfProfileResponse(existingProfile as any);
  }

  let email = user.email;

  // If email is missing in JWT, try to fetch from auth.users via prisma
  if (!email) {
    try {
      // Accessing prisma via the userService's imported prisma instance if possible, 
      // or we can add a helper in userService to get user email.
      // For now, let's assume we can rely on the service to handle "missing email" logic 
      // or we modify the service.
      // Better approach: Let's assume the email MIGHT be in the user object but just in case
      // we can try to fetch the user record.
      // Since I don't have direct access to prisma here (it's in service), 
      // I'll add a method to userService to get email by ID.
      
      // Actually, let's just handle it in the controller by checking if we can get it.
      // But wait, I need to import prisma to query it.
      // Instead, I'll pass undefined to createProfile and let it handle or fail.
      // But createProfile needs email.
      
      // Let's modify the controller to just fail if email is missing for now, 
      // but log it clearly. 
      // If the user says "Profile not found", it means they hit 404 on getMe.
      // Then they hit initProfile.
      
      // If user.email is undefined, we return 400.
      // The user is seeing "Profile not found" which is the 404 from getMe.
      // This means initProfile MIGHT NOT EVEN BE CALLED or failing silently in frontend?
      // No, the user provided the log:
      // {"message":"Profile not found"} http://localhost:3001/api/users/me
      
      // This means the browser is showing the response from the FAILED request.
      // It DOES NOT mean initProfile wasn't called.
      // It means the user is looking at the failed request response.
      
      // If initProfile WAS called, it should have succeeded or failed.
      // If it succeeded, the app should have proceeded.
      
      // Hypothesis: initProfile is failing with 400 because email is missing.
      // So let's try to get the email from the DB if it's missing.
      
      // I will add a `getUserEmail` to userService and use it here.
    } catch (e) {
      // ignore
    }
  }

  if (!email) {
    // Attempt to fetch email from DB as a fallback
    const userEmail = await userService.getUserEmail(user.sub);
    if (userEmail) {
      email = userEmail;
    }
  }

  if (!email) {
    request.log.error({ user }, 'User email is required to initialize profile but was not found');
    return reply.code(400).send({ message: 'User email is required to initialize profile' });
  }

  try {
    const profile = await userService.createProfile(user.sub, email, undefined, undefined, 'app');
    request.log.info({ profile }, 'Profile initialized successfully');
    return sanitizeSelfProfileResponse(profile as any);
  } catch (error) {
    request.log.error({ error }, 'Failed to initialize profile');
    return reply.code(500).send({ message: 'Failed to initialize profile' });
  }
}

export async function getCreditsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const credits = await userService.getCredits(user.sub);
  return credits;
}

export async function getRecentActivityHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const query = (request.query || {}) as { limit?: string | number };
  const parsedLimit = Number(query.limit);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 25;
  const activity = await userService.getRecentActivity(user.sub, limit);
  return activity;
}

export async function reportCrisisEventHandler(
  request: FastifyRequest<{ Body: ReportCrisisBody }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const body = (request.body || {}) as ReportCrisisBody;
  const riskLevel = body.riskLevel;

  if (!riskLevel || !['low', 'medium', 'high', 'critical'].includes(riskLevel)) {
    return reply.code(400).send({ message: 'riskLevel is required' });
  }

  try {
    const event = await userService.createCrisisEventFromDetection({
      userId: user.sub,
      riskLevel,
      eventType: body.eventType,
      keywords: Array.isArray(body.keywords) ? body.keywords : [],
      aiConfidence:
        typeof body.aiConfidence === 'number' ? body.aiConfidence : undefined,
      notes: body.notes,
    });
    return reply.code(201).send(event);
  } catch (error) {
    request.log.error({ error }, 'Failed to create crisis event');
    return reply.code(500).send({ message: 'Failed to create crisis event' });
  }
}

export async function getKnowledgeTwoFactorStatusHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  try {
    return await userService.getKnowledgeTwoFactorStatus(user.sub);
  } catch (error: any) {
    return reply.code(500).send({ message: error?.message || 'Failed to load 2FA status' });
  }
}

export async function setupKnowledgeTwoFactorHandler(
  request: FastifyRequest<{ Body: { pin: string; securityQuestion: string; securityAnswer: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const { pin, securityQuestion, securityAnswer } = request.body || ({} as any);
  try {
    return await userService.setupKnowledgeTwoFactor(user.sub, {
      pin: String(pin || ''),
      securityQuestion: String(securityQuestion || ''),
      securityAnswer: String(securityAnswer || ''),
    });
  } catch (error: any) {
    const status = error?.statusCode === 400 ? 400 : 500;
    return reply.code(status).send({ message: error?.message || 'Failed to setup knowledge 2FA' });
  }
}

export async function setupKnowledgeTwoFactorEmailHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  try {
    return await userService.setupKnowledgeTwoFactorEmail(user.sub);
  } catch (error: any) {
    return reply.code(500).send({ message: error?.message || 'Failed to setup knowledge 2FA email code' });
  }
}

export async function verifyKnowledgeTwoFactorHandler(
  request: FastifyRequest<{ Body: { code: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const { code } = request.body || ({} as any);
  try {
    return await userService.verifyKnowledgeTwoFactor(user.sub, { code: String(code || '') });
  } catch (error: any) {
    const status =
      error?.statusCode === 400 || error?.statusCode === 401 || error?.statusCode === 404
        ? error.statusCode
        : 500;
    return reply.code(status).send({ message: error?.message || 'Failed to verify knowledge 2FA' });
  }
}

export async function disableKnowledgeTwoFactorHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  try {
    return await userService.disableKnowledgeTwoFactor(user.sub);
  } catch (error: any) {
    return reply.code(500).send({ message: error?.message || 'Failed to disable knowledge 2FA' });
  }
}

export async function requestKnowledgeTwoFactorRecoveryHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  try {
    return await userService.requestKnowledgeTwoFactorRecovery(user.sub);
  } catch (error: any) {
    const status =
      error?.statusCode === 400 ||
      error?.statusCode === 404 ||
      error?.statusCode === 429
        ? error.statusCode
        : 500;
    return reply.code(status).send({ message: error?.message || 'Failed to send recovery code' });
  }
}

export async function verifyKnowledgeTwoFactorRecoveryHandler(
  request: FastifyRequest<{ Body: { code: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const { code } = request.body || ({} as any);
  try {
    return await userService.verifyKnowledgeTwoFactorRecovery(user.sub, { code: String(code || '') });
  } catch (error: any) {
    const status =
      error?.statusCode === 400 ||
      error?.statusCode === 401 ||
      error?.statusCode === 404 ||
      error?.statusCode === 429
        ? error.statusCode
        : 500;
    return reply.code(status).send({ message: error?.message || 'Failed to verify recovery code' });
  }
}

export async function requestKnowledgeTwoFactorLoginCodeHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  try {
    return await userService.requestKnowledgeTwoFactorLoginCode(user.sub);
  } catch (error: any) {
    const status =
      error?.statusCode === 400 ||
      error?.statusCode === 404 ||
      error?.statusCode === 429
        ? error.statusCode
        : 500;
    return reply.code(status).send({ message: error?.message || 'Failed to send authentication code' });
  }
}

export async function verifyKnowledgeTwoFactorLoginCodeHandler(
  request: FastifyRequest<{ Body: { code: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const { code } = request.body || ({} as any);
  try {
    return await userService.verifyKnowledgeTwoFactorLoginCode(user.sub, { code: String(code || '') });
  } catch (error: any) {
    const status =
      error?.statusCode === 400 ||
      error?.statusCode === 401 ||
      error?.statusCode === 404 ||
      error?.statusCode === 429
        ? error.statusCode
        : 500;
    return reply.code(status).send({ message: error?.message || 'Failed to verify authentication code' });
  }
}

export async function updateProfileHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  request.log.info({ user, body: request.body }, 'Processing update profile request');
  
  const result = updateProfileSchema.safeParse(request.body);
  if (!result.success) {
    request.log.warn({ error: result.error }, 'Update profile validation failed');
    // Never send the ZodError instance: fastify-type-provider-zod's serializerCompiler
    // validates outgoing payloads and will turn this into a 500 with error "ZodError".
    const firstIssue = result.error.issues[0];
    return reply.code(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: firstIssue?.message ?? 'Validation failed',
      issues: result.error.issues,
    });
  }

  const updatedProfile = await userService.updateProfile(user.sub, result.data);
  request.log.info({ updatedProfile }, 'Profile updated successfully');
  return sanitizeSelfProfileResponse(updatedProfile as any);
}

export async function completeOnboardingHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  request.log.info({ user, body: request.body }, 'Processing complete onboarding request');

  const result = onboardingSchema.safeParse(request.body);
  if (!result.success) {
    request.log.warn({ error: result.error }, 'Onboarding validation failed');
    const firstIssue = result.error.issues[0];
    return reply.code(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: firstIssue?.message ?? 'Validation failed',
      issues: result.error.issues,
    });
  }

  try {
    const profile = await userService.completeOnboarding(user.sub, result.data);
    return sanitizeSelfProfileResponse(profile as any);
  } catch (error) {
    request.log.error({ error }, 'Onboarding completion failed');
    throw error;
  }
}

export async function deleteUserHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  request.log.info({ user }, 'Processing delete user request');

  try {
    await userService.deleteUser(user.sub);
    return reply.code(200).send({ message: 'User account deleted successfully' });
  } catch (error) {
    request.log.error({ error }, 'Delete user failed');
    return reply.code(500).send({ message: 'Failed to delete user account' });
  }
}

export async function exportUserDataHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  request.log.info({ user }, 'Processing user data export request');

  try {
    const userData = await userService.exportUserData(user.sub);
    reply.header('Content-Disposition', `attachment; filename="meetezri-data-export-${new Date().toISOString()}.json"`);
    return reply.send(userData);
  } catch (error) {
    request.log.error({ error }, 'User data export failed');
    return reply.code(500).send({ message: 'Failed to export user data' });
  }
}
