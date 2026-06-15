import { FastifyReply, FastifyRequest } from 'fastify';
import { onboardingSchema, updateProfileSchema, checkUserSchema, CheckUserInput, SignupInput, signupSchema, ResendVerificationPublicInput } from './user.schema';
import * as userService from './user.service';
import * as billingService from '../billing/billing.service';
import { supabaseAdmin } from '../../config/supabase';
import { emailService } from '../email/email.service';
import prisma from '../../lib/prisma';
import { inferAdminRoleFromAuthUser, isAdminRole, normalizeAppRole } from '../../lib/adminRoles';

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

async function resolveEffectiveProfileRole(
  userId: string,
  profileRole?: string | null
): Promise<string | undefined> {
  const normalized = normalizeAppRole(profileRole);
  if (isAdminRole(normalized)) {
    return normalized;
  }

  const authUser = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      is_super_admin: true,
      raw_app_meta_data: true,
      raw_user_meta_data: true,
    },
  });

  const inferred = inferAdminRoleFromAuthUser(
    authUser as {
      is_super_admin?: boolean | null;
      raw_app_meta_data?: Record<string, unknown> | null;
      raw_user_meta_data?: Record<string, unknown> | null;
    } | null
  );
  return inferred ?? normalized ?? profileRole ?? undefined;
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
  const explicit = (request.headers['x-web-base-url'] as string | undefined) ?? null;
  const origin = request.headers.origin;
  const referer = request.headers.referer;

  const fromExplicit = tryParseHttpOrigin(explicit);
  if (fromExplicit) {
    return { webBaseUrl: fromExplicit, source: 'request.x-web-base-url' };
  }

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

  const envCandidateRaw =
    process.env.WEB_BASE_URL || process.env.APP_URL || process.env.CLIENT_URL || '';
  const envCandidate = envCandidateRaw.trim();
  const envParsed = tryParseHttpOrigin(envCandidate);
  if (envParsed) {
    return { webBaseUrl: envParsed, source: 'env' };
  }

  return { webBaseUrl: 'http://localhost:5173', source: 'fallback.localhost' };
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
  // Always route through /auth/callback so the SPA can finalize verification consistently.
  // This is important for magiclinks used in resend-verification, where Supabase may not
  // mark email_confirmed_at as expected unless we explicitly confirm server-side.
  const redirectTo = `${webBaseUrl}/auth/callback?redirect=${encodeURIComponent(targetPath)}&via=verification&flow=${signupType}`;
  return { redirectTo, targetPath };
}

async function sendVerificationReminderForUser(
  request: FastifyRequest,
  params: {
    userId: string;
    email: string;
    signupTypeHint?: 'trial' | 'plan' | null;
  }
): Promise<void> {
  const { userId, email, signupTypeHint } = params;

  const profile = await userService.getProfile(userId);
  let signupTypeResolved: 'trial' | 'plan' | null = signupTypeHint ?? null;
  if (!signupTypeResolved) {
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
  }

  const { webBaseUrl: baseUrl, source: baseUrlSource } =
    getWebBaseUrlFromRequest(request);

  const signupTypeForRedirect: 'trial' | 'plan' =
    signupTypeResolved === 'trial' ? 'trial' : 'plan';
  const { redirectTo, targetPath } = buildVerificationRedirectTo(
    baseUrl,
    signupTypeForRedirect
  );

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
        x_web_base_url: request.headers['x-web-base-url'],
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
  const verificationLinkRaw = linkData.properties?.action_link;
  if (!verificationLinkRaw) throw new Error('Failed to generate verification link');
  let verificationLink = verificationLinkRaw;
  try {
    const u = new URL(verificationLinkRaw);
    u.searchParams.set('redirect_to', redirectTo);
    verificationLink = u.toString();
  } catch {
    verificationLink = verificationLinkRaw;
  }

  try {
    const u = new URL(verificationLink);
    const rt = u.searchParams.get('redirect_to') || '';
    const rtOrigin = rt ? (new URL(rt)).origin : null;
    request.log.info(
      { redirectToPassed: redirectTo, redirectToInLinkOrigin: rtOrigin },
      'Resend verification link redirect_to (origin only)'
    );
  } catch {
    // ignore
  }

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
}

export async function confirmEmailHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload & { email?: string };
  const userId = user.sub;

  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirm: true,
      user_metadata: {
        email_verification_required: false,
      },
    } as any);

    if (error) throw error;

    return reply.code(200).send({ success: true });
  } catch (error: any) {
    request.log.error({ error, userId }, 'Failed to confirm email');
    return reply.code(500).send({ message: error.message || 'Failed to confirm email' });
  }
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
    const age = (request.body as any)?.age;

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
            age,
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
          x_web_base_url: request.headers['x-web-base-url'],
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
    const verificationLinkRaw = linkData.properties?.action_link;

    if (!verificationLinkRaw) throw new Error('Failed to generate verification link');
    // Supabase can sometimes rewrite/override redirect_to based on project URL config.
    // Enforce our computed redirect explicitly so local dev stays on localhost.
    let verificationLink = verificationLinkRaw;
    try {
      const u = new URL(verificationLinkRaw);
      u.searchParams.set('redirect_to', finalRedirectTo);
      verificationLink = u.toString();
    } catch {
      // If URL parsing fails, keep the original link.
      verificationLink = verificationLinkRaw;
    }

    try {
      const u = new URL(verificationLink);
      const rt = u.searchParams.get('redirect_to') || '';
      const rtOrigin = rt ? (new URL(rt)).origin : null;
      request.log.info(
        { redirectToPassed: finalRedirectTo, redirectToInLinkOrigin: rtOrigin },
        'Signup verification link redirect_to (origin only)'
      );
    } catch {
      // ignore
    }

    const welcomeVerificationEmail = emailService.buildWelcomeVerificationEmail({
      firstName,
      verificationLink,
      audience: signupType,
    });

    // Do not block signup on SMTP latency; link is already generated.
    void emailService
      .sendEmail(
        email,
        welcomeVerificationEmail.subject,
        welcomeVerificationEmail.html,
        welcomeVerificationEmail.text
      )
      .catch((error) => {
        request.log.error({ error, email }, 'Failed to send signup verification email');
      });

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
    await sendVerificationReminderForUser(request, { userId, email });
    return reply.code(200).send({ success: true, message: 'Verification email sent' });
  } catch (error: any) {
    request.log.error({ error }, 'Resend verification failed');
    return reply.code(500).send({ message: error.message || 'Failed to send verification email' });
  }
}

export async function resendVerificationPublicHandler(
  request: FastifyRequest<{ Body: ResendVerificationPublicInput }>,
  reply: FastifyReply
) {
  const email = request.body.email.trim().toLowerCase();

  try {
    const accountState = await userService.resolveAccountStateByEmail(email);

    if (accountState.state === 'NO_ACCOUNT') {
      return reply.code(200).send({
        success: true,
        message: 'If an account exists with this email, a verification link has been sent.',
      });
    }

    if (accountState.email_verified) {
      return reply.code(400).send({
        message: 'This email is already verified. Please sign in.',
      });
    }

    const authUserId = accountState.auth_user_id;
    if (!authUserId) {
      return reply.code(400).send({ message: 'Unable to resend verification email.' });
    }

    await sendVerificationReminderForUser(request, {
      userId: authUserId,
      email,
      signupTypeHint: accountState.signup_type,
    });

    return reply.code(200).send({ success: true, message: 'Verification email sent' });
  } catch (error: any) {
    request.log.error({ error, email }, 'Public resend verification failed');
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
  let profile = await userService.getProfile(user.sub);

  if (!profile) {
    return reply.code(404).send({ message: 'Profile not found' });
  }

  const email = user.email ?? profile.email;
  if (email) {
    try {
      const backfilledName = await userService.getProfileNameBackfillFromAuth(
        user.sub,
        email,
        profile.full_name
      );
      if (backfilledName) {
        profile = await userService.updateProfile(user.sub, { full_name: backfilledName });
      }
    } catch (e) {
      request.log.warn({ e }, 'Failed to backfill full_name on getMe');
    }
  }

  const effectiveRole = await resolveEffectiveProfileRole(user.sub, profile.role);
  if (effectiveRole) {
    profile = { ...profile, role: effectiveRole };
  }

  return sanitizeSelfProfileResponse(profile as any);
}

export async function initProfileHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  request.log.info({ user }, 'Initializing profile for user');

  let email = user.email;
  if (!email) {
    email = (await userService.getUserEmail(user.sub)) ?? undefined;
  }

  const existingProfile = await userService.getProfile(user.sub);
  if (existingProfile) {
    let profile = existingProfile;

    if (!profile.signup_type) {
      try {
        const signupType = await userService.getSignupTypeFromAuthMeta(user.sub);
        if (signupType) {
          await userService.setSignupTypeForProfile(user.sub, signupType);
          profile = (await userService.getProfile(user.sub)) ?? profile;
        }
      } catch (e) {
        request.log.warn({ e }, 'Failed to backfill signup_type on initProfile');
      }
    }

    const profileEmail = email ?? profile.email;
    if (profileEmail) {
      try {
        const backfilledName = await userService.getProfileNameBackfillFromAuth(
          user.sub,
          profileEmail,
          profile.full_name
        );
        if (backfilledName) {
          profile = await userService.updateProfile(user.sub, { full_name: backfilledName });
        }
      } catch (e) {
        request.log.warn({ e }, 'Failed to backfill full_name on initProfile');
      }
    }

    return sanitizeSelfProfileResponse(profile as any);
  }

  if (!email) {
    request.log.error({ user }, 'User email is required to initialize profile but was not found');
    return reply.code(400).send({ message: 'User email is required to initialize profile' });
  }

  try {
    const fullName = await userService.getFullNameFromAuthMeta(user.sub);
    const profile = await userService.createProfile(
      user.sub,
      email,
      fullName ?? undefined,
      undefined,
      'app'
    );
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

  // Enforce age gate (18+) for onboarding completion.
  // Allow missing `age` only if it was already stored on the user's profile (legacy clients/flows).
  if (!result.data.age) {
    const existing = await userService.getProfile(user.sub);
    const storedAge = (existing as any)?.age;
    if (!storedAge || (typeof storedAge === 'string' && !storedAge.trim())) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Age is required (18+) to complete onboarding',
      });
    }
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

export async function deactivateAccountHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  try {
    const result = await userService.deactivateAccount(user.sub);
    return reply.code(200).send({
      message: 'Account deactivated successfully',
      account_status: result.account_status,
    });
  } catch (error: any) {
    const statusCode = error?.statusCode ?? 500;
    request.log.error({ error }, 'Deactivate account failed');
    return reply.code(statusCode).send({
      message: error?.message || 'Failed to deactivate account',
    });
  }
}

export async function requestAccountActivationHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const { webBaseUrl } = getWebBaseUrlFromRequest(request);
  try {
    const result = await userService.requestAccountActivation(user.sub, webBaseUrl);
    return reply.code(200).send({
      message: 'Activation email sent',
      sent: result.sent,
      email: result.email,
    });
  } catch (error: any) {
    const statusCode = error?.statusCode ?? 500;
    request.log.error({ error }, 'Request account activation failed');
    return reply.code(statusCode).send({
      message: error?.message || 'Failed to send activation email',
    });
  }
}

export async function confirmAccountActivationHandler(
  request: FastifyRequest<{ Body: { token?: string } }>,
  reply: FastifyReply
) {
  const token = request.body?.token;
  try {
    const result = await userService.confirmAccountActivation(String(token || ''));
    return reply.code(200).send({
      message: 'Account activated successfully',
      account_status: result.account_status,
    });
  } catch (error: any) {
    const statusCode = error?.statusCode ?? 500;
    request.log.error({ error }, 'Confirm account activation failed');
    return reply.code(statusCode).send({
      message: error?.message || 'Failed to activate account',
    });
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
