import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { supabaseAdmin } from '../../config/supabase';
import { OnboardingInput, UpdateProfileInput } from './user.schema';
import { PLAN_LIMITS } from '../billing/billing.constants';
import * as billingService from '../billing/billing.service';
import { getLifetimeUsedSeconds } from '../billing/credit-balance.service';
import { pbkdf2Sync, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { emailService } from '../email/email.service';

export function calculateStreak(moodEntries: any[]) {
  if (!moodEntries || moodEntries.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Sort by date desc just in case, though DB query should handle it
  const sorted = moodEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  // Check if there's an entry for today or yesterday to start the streak
  const lastEntryDate = new Date(sorted[0].created_at);
  lastEntryDate.setHours(0, 0, 0, 0);
  
  const diffTime = Math.abs(today.getTime() - lastEntryDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  
  if (diffDays > 1) return 0; // Streak broken

  streak = 1;
  let currentDate = lastEntryDate;

  for (let i = 1; i < sorted.length; i++) {
    const entryDate = new Date(sorted[i].created_at);
    entryDate.setHours(0, 0, 0, 0);
    
    const diff = Math.abs(currentDate.getTime() - entryDate.getTime());
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) continue; // Same day entry
    if (days === 1) {
      streak++;
      currentDate = entryDate;
    } else {
      break;
    }
  }
  
  return streak;
}

import * as adminService from '../admin/admin.service';

export async function getAllUsers(page: number = 1, limit: number = 50) {
  // Use the optimized admin service function
  const users = await adminService.getAllUsers(page, limit);

  // Map to the shape expected by this service's consumers
  return users.map((user: any) => ({
    id: user.id,
    name: user.full_name || (user.email ? user.email.split('@')[0] : 'User'),
    email: user.email || '',
    status: user.status === 'suspended' ? 'suspended' : 'active',
    joinDate: user.created_at,
    sessions: user.session_count,
    lastActive: user.last_active,
    riskLevel: user.risk_level || 'low',
    subscription: user.subscription || 'trial',
    organization: user.organization || 'Individual'
  }));
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { email: true }
  });
  return user?.email || null;
}

type KnowledgeTwoFactorConfig = {
  enabled: boolean;
  // PIN-based factor (optional so email-only 2FA can be enabled).
  pin_hash?: string;
  pin_salt?: string;
  security_question?: string;
  // Lower-cased answer hash for timing-safe compare.
  answer_hash?: string;
  answer_salt?: string;
  // If true, the system will allow email authentication codes to be requested/verified.
  email_code_enabled?: boolean;
  updated_at: string;
};

const knowledgeRecoveryMap = new Map<
  string,
  { code: string; expiresAt: number; attempts: number; sentAt: number }
>();
const knowledgeLoginEmailCodeMap = new Map<
  string,
  { code: string; expiresAt: number; attempts: number; sentAt: number }
>();
const KNOWLEDGE_RECOVERY_TTL_MS = 10 * 60 * 1000;
const KNOWLEDGE_RECOVERY_RESEND_MS = 60 * 1000;
const KNOWLEDGE_RECOVERY_MAX_ATTEMPTS = 5;

function hashSecret(secret: string, salt: string): string {
  return pbkdf2Sync(secret, salt, 120000, 32, 'sha256').toString('hex');
}

function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

async function getPermissions(userId: string): Promise<Record<string, any>> {
  const profile = await prisma.profiles.findUnique({
    where: { id: userId },
    select: { permissions: true },
  });
  const permissions = profile?.permissions;
  if (!permissions || typeof permissions !== 'object') return {};
  return permissions as Record<string, any>;
}

export async function getKnowledgeTwoFactorStatus(userId: string) {
  const permissions = await getPermissions(userId);
  const cfg = permissions.two_factor_knowledge as Partial<KnowledgeTwoFactorConfig> | undefined;
  return {
    enabled: cfg?.enabled === true,
    question: cfg?.security_question || null,
    email_code_enabled: cfg?.email_code_enabled === true,
  };
}

export async function setupKnowledgeTwoFactor(
  userId: string,
  input: { pin: string; securityQuestion: string; securityAnswer: string }
) {
  const pin = input.pin.trim();
  const securityQuestion = input.securityQuestion.trim();
  const securityAnswer = input.securityAnswer.trim();

  if (!/^\d{4}$/.test(pin)) {
    const err = new Error('PIN must be exactly 4 digits');
    (err as any).statusCode = 400;
    throw err;
  }
  if (securityQuestion.length < 6 || securityQuestion.length > 160) {
    const err = new Error('Security question must be 6 to 160 characters');
    (err as any).statusCode = 400;
    throw err;
  }
  if (securityAnswer.length < 2 || securityAnswer.length > 120) {
    const err = new Error('Security answer must be 2 to 120 characters');
    (err as any).statusCode = 400;
    throw err;
  }

  const permissions = await getPermissions(userId);
  const pinSalt = randomBytes(16).toString('hex');
  const answerSalt = randomBytes(16).toString('hex');

  const config: KnowledgeTwoFactorConfig = {
    enabled: true,
    pin_hash: hashSecret(pin, pinSalt),
    pin_salt: pinSalt,
    security_question: securityQuestion,
    answer_hash: hashSecret(securityAnswer.toLowerCase(), answerSalt),
    answer_salt: answerSalt,
    email_code_enabled: false,
    updated_at: new Date().toISOString(),
  };

  const nextPermissions = {
    ...permissions,
    two_factor_knowledge: config,
  };

  await prisma.profiles.update({
    where: { id: userId },
    data: { permissions: nextPermissions as any },
  });
  invalidateUserProfileCache(userId);
  return { enabled: true, question: securityQuestion };
}

export async function setupKnowledgeTwoFactorEmail(userId: string) {
  const permissions = await getPermissions(userId);

  const config: KnowledgeTwoFactorConfig = {
    enabled: true,
    email_code_enabled: true,
    // Intentionally omit PIN/security hashes for email-only mode.
    updated_at: new Date().toISOString(),
  };

  const nextPermissions = {
    ...permissions,
    two_factor_knowledge: config,
  };

  await prisma.profiles.update({
    where: { id: userId },
    data: { permissions: nextPermissions as any },
  });

  invalidateUserProfileCache(userId);
  return { enabled: true, question: null, email_code_enabled: true };
}

export async function verifyKnowledgeTwoFactor(
  userId: string,
  input: { code: string }
) {
  const code = input.code.trim();
  if (!code) {
    const err = new Error('Verification code is required');
    (err as any).statusCode = 400;
    throw err;
  }

  const permissions = await getPermissions(userId);
  const cfg = permissions.two_factor_knowledge as Partial<KnowledgeTwoFactorConfig> | undefined;
  if (!cfg?.enabled || !cfg.pin_hash || !cfg.pin_salt || !cfg.answer_hash || !cfg.answer_salt) {
    const err = new Error('Knowledge-based 2FA is not enabled');
    (err as any).statusCode = 404;
    throw err;
  }

  const candidatePinHash = hashSecret(code, cfg.pin_salt);
  const candidateAnswerHash = hashSecret(code.toLowerCase(), cfg.answer_salt);

  const pinOk = constantTimeEquals(candidatePinHash, cfg.pin_hash);
  const answerOk = constantTimeEquals(candidateAnswerHash, cfg.answer_hash);
  if (!pinOk && !answerOk) {
    const err = new Error('Invalid second-factor code');
    (err as any).statusCode = 401;
    throw err;
  }
  return { ok: true };
}

export async function disableKnowledgeTwoFactor(userId: string) {
  const permissions = await getPermissions(userId);
  const nextPermissions = { ...permissions };
  delete (nextPermissions as any).two_factor_knowledge;

  await prisma.profiles.update({
    where: { id: userId },
    data: { permissions: nextPermissions as any },
  });
  invalidateUserProfileCache(userId);
  return { enabled: false };
}

export async function requestKnowledgeTwoFactorRecovery(userId: string) {
  const permissions = await getPermissions(userId);
  const cfg = permissions.two_factor_knowledge as Partial<KnowledgeTwoFactorConfig> | undefined;
  if (!cfg?.enabled) {
    const err = new Error('Knowledge-based 2FA is not enabled');
    (err as any).statusCode = 404;
    throw err;
  }

  const existing = knowledgeRecoveryMap.get(userId);
  const now = Date.now();
  if (existing && now - existing.sentAt < KNOWLEDGE_RECOVERY_RESEND_MS) {
    const waitSeconds = Math.ceil((KNOWLEDGE_RECOVERY_RESEND_MS - (now - existing.sentAt)) / 1000);
    const err = new Error(`Please wait ${waitSeconds}s before requesting another code`);
    (err as any).statusCode = 429;
    throw err;
  }

  const email = await getUserEmail(userId);
  if (!email) {
    const err = new Error('Email not found for account');
    (err as any).statusCode = 400;
    throw err;
  }

  const code = String(randomInt(100000, 1000000));
  knowledgeRecoveryMap.set(userId, {
    code,
    expiresAt: now + KNOWLEDGE_RECOVERY_TTL_MS,
    attempts: 0,
    sentAt: now,
  });

  await emailService.sendEmail(
    email,
    'Your Ezri 2FA Recovery Code',
    `<p>Your one-time recovery code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:2px;">${code}</p><p>It expires in 10 minutes.</p>`,
    `Your one-time recovery code is ${code}. It expires in 10 minutes.`
  );

  return { sent: true };
}

export async function verifyKnowledgeTwoFactorRecovery(userId: string, input: { code: string }) {
  const code = String(input.code || '').trim();
  if (!/^\d{6}$/.test(code)) {
    const err = new Error('Recovery code must be 6 digits');
    (err as any).statusCode = 400;
    throw err;
  }

  const record = knowledgeRecoveryMap.get(userId);
  if (!record) {
    const err = new Error('No active recovery code. Request a new one.');
    (err as any).statusCode = 404;
    throw err;
  }

  if (Date.now() > record.expiresAt) {
    knowledgeRecoveryMap.delete(userId);
    const err = new Error('Recovery code expired. Request a new one.');
    (err as any).statusCode = 401;
    throw err;
  }

  record.attempts += 1;
  if (record.attempts > KNOWLEDGE_RECOVERY_MAX_ATTEMPTS) {
    knowledgeRecoveryMap.delete(userId);
    const err = new Error('Too many attempts. Request a new recovery code.');
    (err as any).statusCode = 429;
    throw err;
  }

  if (record.code !== code) {
    const err = new Error('Invalid recovery code');
    (err as any).statusCode = 401;
    throw err;
  }

  knowledgeRecoveryMap.delete(userId);
  await disableKnowledgeTwoFactor(userId);
  return { ok: true, disabled: true };
}

export async function requestKnowledgeTwoFactorLoginCode(userId: string) {
  const permissions = await getPermissions(userId);
  const cfg = permissions.two_factor_knowledge as Partial<KnowledgeTwoFactorConfig> | undefined;
  if (!cfg?.enabled || cfg?.email_code_enabled !== true) {
    const err = new Error('Knowledge-based 2FA is not enabled');
    (err as any).statusCode = 404;
    throw err;
  }

  const existing = knowledgeLoginEmailCodeMap.get(userId);
  const now = Date.now();
  if (existing && now - existing.sentAt < KNOWLEDGE_RECOVERY_RESEND_MS) {
    const waitSeconds = Math.ceil((KNOWLEDGE_RECOVERY_RESEND_MS - (now - existing.sentAt)) / 1000);
    const err = new Error(`Please wait ${waitSeconds}s before requesting another code`);
    (err as any).statusCode = 429;
    throw err;
  }

  const email = await getUserEmail(userId);
  if (!email) {
    const err = new Error('Email not found for account');
    (err as any).statusCode = 400;
    throw err;
  }

  const code = String(randomInt(100000, 1000000));
  knowledgeLoginEmailCodeMap.set(userId, {
    code,
    expiresAt: now + KNOWLEDGE_RECOVERY_TTL_MS,
    attempts: 0,
    sentAt: now,
  });

  await emailService.sendEmail(
    email,
    'Your Ezri Login Authentication Code',
    `<p>Your one-time login authentication code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:2px;">${code}</p><p>It expires in 10 minutes.</p>`,
    `Your one-time login authentication code is ${code}. It expires in 10 minutes.`
  );

  return { sent: true };
}

export async function verifyKnowledgeTwoFactorLoginCode(userId: string, input: { code: string }) {
  const code = String(input.code || '').trim();
  if (!/^\d{6}$/.test(code)) {
    const err = new Error('Authentication code must be 6 digits');
    (err as any).statusCode = 400;
    throw err;
  }

  const record = knowledgeLoginEmailCodeMap.get(userId);
  if (!record) {
    const err = new Error('No active authentication code. Request a new one.');
    (err as any).statusCode = 404;
    throw err;
  }

  if (Date.now() > record.expiresAt) {
    knowledgeLoginEmailCodeMap.delete(userId);
    const err = new Error('Authentication code expired. Request a new one.');
    (err as any).statusCode = 401;
    throw err;
  }

  record.attempts += 1;
  if (record.attempts > KNOWLEDGE_RECOVERY_MAX_ATTEMPTS) {
    knowledgeLoginEmailCodeMap.delete(userId);
    const err = new Error('Too many attempts. Request a new code.');
    (err as any).statusCode = 429;
    throw err;
  }

  if (record.code !== code) {
    const err = new Error('Invalid authentication code');
    (err as any).statusCode = 401;
    throw err;
  }

  knowledgeLoginEmailCodeMap.delete(userId);
  return { ok: true };
}

type AccountState =
  | 'NO_ACCOUNT'
  | 'AUTH_CREATED_BUT_PROFILE_NOT_CREATED'
  | 'AUTH_CREATED_PROFILE_CREATED_ONBOARDING_INCOMPLETE'
  | 'EMAIL_UNVERIFIED'
  | 'EMAIL_VERIFIED_ONBOARDING_INCOMPLETE'
  | 'FULLY_ONBOARDED';

function resolveOnboardingCompleted(profile: any): boolean {
  const signupType =
    normalizeSignupType(profile?.signup_type) ??
    (profile?.subscription_plan === "trial" ? "trial" : null);

  const isTrial = signupType === "trial";

  // Explicit DB flag (nullable for backwards-compatibility).
  // Trial flow: `onboarding_completed` may remain false for legacy rows;
  // we still need deterministic "trial profile complete" behavior.
  if (profile?.onboarding_completed === true) return true;
  if (profile?.onboarding_completed === false && !isTrial) return false;

  // Deterministic inference.
  const fullNameOk =
    typeof profile?.full_name === 'string' && profile.full_name.trim().length > 1;

  const emergencyRelationshipOk =
    typeof profile?.emergency_contact_relationship === 'string' &&
    profile.emergency_contact_relationship.trim().length > 0;

  const timezoneOk =
    typeof profile?.timezone === 'string' && profile.timezone.trim().length > 0;

  // The role is required for downstream product logic.
  const roleOk = typeof profile?.role === 'string' && profile.role.length > 0;

  // Trial: "complete profile" means the trial profile setup is done.
  if (isTrial) {
    return fullNameOk && timezoneOk && emergencyRelationshipOk && roleOk;
  }

  // Plan: preserve the stricter definition used for the paid onboarding wizard.
  const goalsOk =
    Array.isArray(profile?.selected_goals) && profile.selected_goals.length > 0;

  const permissionsOk =
    profile?.permissions &&
    typeof profile.permissions === 'object' &&
    Object.keys(profile.permissions).length > 0;

  const notificationPrefsOk =
    profile?.notification_preferences &&
    typeof profile.notification_preferences === 'object' &&
    Object.keys(profile.notification_preferences).length > 0;

  return fullNameOk && goalsOk && emergencyRelationshipOk && permissionsOk && notificationPrefsOk && roleOk;
}

export async function resolveAccountStateByEmail(email: string) {
  const authUser = await prisma.users.findFirst({
    where: { email },
    select: {
      id: true,
      email_confirmed_at: true,
      raw_user_meta_data: true,
    },
  });

  if (!authUser) {
    return {
      state: 'NO_ACCOUNT' as AccountState,
      auth_exists: false,
      profile_exists: false,
      auth_user_id: null as string | null,
      onboarding_completed: false,
      email_verified: false,
      needs_email_verification: false,
      email,
      onboarding_completed_at: null,
      signup_type: null as 'trial' | 'plan' | null,
    };
  }

  const emailConfirmed = !!authUser.email_confirmed_at;
  const rawMeta: any = authUser.raw_user_meta_data as any;
  const verificationRequired = rawMeta?.email_verification_required === true;
  const emailVerified = emailConfirmed && !verificationRequired;

  let profile: any = null;
  try {
    // Primary: include new columns when present.
    profile = await prisma.profiles.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        onboarding_completed: true,
        onboarding_completed_at: true,
        signup_type: true,
        full_name: true,
        role: true,
        selected_goals: true,
        emergency_contact_relationship: true,
        permissions: true,
        notification_preferences: true,
      },
    });
  } catch {
    // Fallback for older DBs where new onboarding columns are missing.
    profile = await prisma.profiles.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        full_name: true,
        role: true,
        selected_goals: true,
        emergency_contact_relationship: true,
        permissions: true,
        notification_preferences: true,
      },
    });
  }

  if (!profile) {
    return {
      state: 'AUTH_CREATED_BUT_PROFILE_NOT_CREATED' as AccountState,
      auth_exists: true,
      profile_exists: false,
      auth_user_id: authUser.id,
      onboarding_completed: false,
      email_verified: emailVerified,
      needs_email_verification: !emailVerified,
      email,
      onboarding_completed_at: null,
      signup_type: normalizeSignupType((rawMeta as any)?.signup_type ?? (rawMeta as any)?.signupType ?? (rawMeta as any)?.signup) as any,
    };
  }

  const onboardingCompletedResolved = resolveOnboardingCompleted(profile);
  const signupTypeResolved =
    normalizeSignupType((profile as any).signup_type) ??
    normalizeSignupType(rawMeta?.signup_type ?? rawMeta?.signupType ?? rawMeta?.signup) ??
    null;

  // FULLY_ONBOARDED requires both onboarding completion and email verification.
  if (onboardingCompletedResolved && emailVerified) {
    return {
      state: 'FULLY_ONBOARDED' as AccountState,
      auth_exists: true,
      profile_exists: true,
      auth_user_id: authUser.id,
      onboarding_completed: true,
      email_verified: true,
      needs_email_verification: false,
      email,
      onboarding_completed_at: profile.onboarding_completed_at ?? null,
      signup_type: signupTypeResolved,
    };
  }

  if (!emailVerified) {
    // Explicitly cover unverified email cases even if onboarding is partially present.
    return {
      state: 'EMAIL_UNVERIFIED' as AccountState,
      auth_exists: true,
      profile_exists: true,
      auth_user_id: authUser.id,
      onboarding_completed: onboardingCompletedResolved,
      email_verified: false,
      needs_email_verification: true,
      email,
      onboarding_completed_at: profile.onboarding_completed_at ?? null,
      signup_type: signupTypeResolved,
    };
  }

  // Email verified but onboarding not complete.
  if (!onboardingCompletedResolved) {
    return {
      state: 'EMAIL_VERIFIED_ONBOARDING_INCOMPLETE' as AccountState,
      auth_exists: true,
      profile_exists: true,
      auth_user_id: authUser.id,
      onboarding_completed: false,
      email_verified: true,
      needs_email_verification: false,
      email,
      onboarding_completed_at: profile.onboarding_completed_at ?? null,
      signup_type: signupTypeResolved,
    };
  }

  // If onboarding is completed but email verification is still ambiguous,
  // return a dedicated state for safer client behavior.
  return {
    state: 'AUTH_CREATED_PROFILE_CREATED_ONBOARDING_INCOMPLETE' as AccountState,
    auth_exists: true,
    profile_exists: true,
    auth_user_id: authUser.id,
    onboarding_completed: onboardingCompletedResolved,
    email_verified: emailVerified,
    needs_email_verification: !emailVerified,
    email,
    onboarding_completed_at: profile.onboarding_completed_at ?? null,
    signup_type: signupTypeResolved,
  };
}

export async function checkUserExists(email: string) {
  const resolved = await resolveAccountStateByEmail(email);
  return {
    exists: resolved.state !== 'NO_ACCOUNT',
    ...resolved,
  };
}

export async function getSignupTypeFromAuthMeta(authUserId: string): Promise<'trial' | 'plan' | null> {
  try {
    const authUser = await prisma.users.findUnique({
      where: { id: authUserId },
      select: { raw_user_meta_data: true },
    });

    const meta: any = authUser?.raw_user_meta_data as any;
    const raw = meta?.signup_type ?? meta?.signupType ?? meta?.signup;
    if (raw === 'trial' || raw === 'plan') return raw;
    return null;
  } catch {
    return null;
  }
}

function normalizeSignupType(raw: any): 'trial' | 'plan' | null {
  if (raw === 'trial' || raw === 'plan') return raw;
  return null;
}

export async function setSignupTypeForProfile(userId: string, signupType: 'trial' | 'plan' | null) {
  if (!signupType) return null;
  try {
    return await prisma.profiles.update({
      where: { id: userId },
      data: { signup_type: signupType },
    });
  } catch {
    // Ignore if column doesn't exist yet.
    return null;
  }
}

/** Where the account was created (distinct from signup_type = trial vs plan). */
export type SignupSource = 'app' | 'admin_user' | 'admin_companion' | 'admin_org';

export async function createProfile(
  userId: string,
  email: string,
  fullName?: string,
  signupType?: 'trial' | 'plan' | null,
  signupSource?: SignupSource | null
) {
  // If signupType isn't explicitly provided, infer from Supabase auth metadata.
  const resolvedSignupType =
    normalizeSignupType(signupType) ?? (await getSignupTypeFromAuthMeta(userId));
  let profile: any;
  try {
    profile = await prisma.profiles.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email,
        full_name: fullName || email.split('@')[0],
        role: 'user',
        credits: 30,
        credits_seconds: 30 * 60,
        onboarding_completed: false,
        onboarding_completed_at: null,
        signup_type: resolvedSignupType,
        ...(signupSource != null ? { signup_source: signupSource } : {}),
      },
      update: {
        email,
        full_name: fullName || email.split('@')[0],
        onboarding_completed: false,
        onboarding_completed_at: null,
        ...(resolvedSignupType ? { signup_type: resolvedSignupType } : {}),
        ...(signupSource !== undefined ? { signup_source: signupSource } : {}),
      },
    });
  } catch {
    // Backwards-compatibility for DBs missing new columns.
    profile = await prisma.profiles.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email,
        full_name: fullName || email.split('@')[0],
        role: 'user',
        credits: 30,
        credits_seconds: 30 * 60,
      },
      update: {
        email,
        full_name: fullName || email.split('@')[0],
      },
    });
  }

  // Create Trial Subscription (7 days)
  const existingTrial = await prisma.subscriptions.findFirst({
    where: { user_id: userId, plan_type: 'trial' },
    select: { id: true },
  });
  if (!existingTrial) {
    await prisma.subscriptions.create({
      data: {
        user_id: userId,
        plan_type: 'trial',
        status: 'active',
        start_date: new Date(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        billing_cycle: 'monthly',
      },
    });
  }

  return profile;
}

export async function createProfileForPaidSignup(
  userId: string,
  email: string,
  fullName?: string,
  signupType?: 'trial' | 'plan' | null,
  signupSource: SignupSource = 'app'
) {
  const resolvedSignupType = normalizeSignupType(signupType) ?? 'plan';
  try {
    return await prisma.profiles.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email,
        full_name: fullName || email.split('@')[0],
        role: 'user',
        credits: 0,
        credits_seconds: 0,
        onboarding_completed: false,
        onboarding_completed_at: null,
        signup_type: resolvedSignupType,
        signup_source: signupSource,
      },
      update: {
        email,
        full_name: fullName || email.split('@')[0],
        onboarding_completed: false,
        onboarding_completed_at: null,
        ...(resolvedSignupType ? { signup_type: resolvedSignupType } : {}),
        signup_source: signupSource,
      },
    });
  } catch {
    // Backwards-compatibility for DBs missing new columns.
    return await prisma.profiles.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email,
        full_name: fullName || email.split('@')[0],
        role: 'user',
        credits: 0,
        credits_seconds: 0,
      },
      update: {
        email,
        full_name: fullName || email.split('@')[0],
      },
    });
  }
}

const userProfileCache = new Map<string, { data: any; timestamp: number }>();
const PROFILE_CACHE_TTL = 30 * 1000; // 30 seconds

export function invalidateUserProfileCache(userId: string) {
  userProfileCache.delete(userId);
}

export async function getProfile(userId: string) {
  // Check cache first
  const cached = userProfileCache.get(userId);
  let result: any;

  if (cached && Date.now() - cached.timestamp < PROFILE_CACHE_TTL) {
    // If user just upgraded, cache can keep returning trial for a short window.
    // When we detect "trial" and the user has a Stripe customer, do a one-time sync.
    const cachedPlan = (cached.data?.subscription_plan || 'trial') as keyof typeof PLAN_LIMITS;
    const hasStripeCustomer = !!cached.data?.stripe_customer_id;

    if (cachedPlan === 'trial' && hasStripeCustomer) {
      try {
        await billingService.syncSubscriptionWithStripe(userId);
        userProfileCache.delete(userId);
      } catch {
        // ignore and fall back to cached
      }
    } else {
      result = { ...cached.data };
    }
  }

  if (!result) {
    // Optimized to use a single query to prevent connection pool exhaustion
    const profileResult = await prisma.profiles.findUnique({
      where: { id: userId },
      include: {
        companion_profiles: true,
        subscriptions: {
          where: { status: { in: ['active', 'trialing', 'past_due'] } },
          orderBy: { created_at: 'desc' },
          take: 1,
        },
        emergency_contacts: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
        // Include recent moods
        mood_entries: {
          orderBy: { created_at: 'desc' },
          take: 30,
        },
        // Include scheduled appointments
        appointments_appointments_user_idToprofiles: {
          where: {
            status: 'scheduled',
            start_time: { gt: new Date() },
          },
          orderBy: { start_time: 'asc' },
        },
        // Get counts
        _count: {
          select: {
            app_sessions: { where: { ended_at: { not: null } } },
            mood_entries: true,
            journal_entries: true,
          },
        },
      },
    });

    if (!profileResult) return null;

    // Stale `prisma generate` can omit `bio` from the client model; still read it from DB.
    let profileBio: string | null | undefined = (profileResult as { bio?: string | null }).bio;
    if (profileBio === undefined) {
      try {
        const bioRows = await prisma.$queryRaw<Array<{ bio: string | null }>>(
          Prisma.sql`SELECT bio FROM public.profiles WHERE id = ${userId}::uuid LIMIT 1`
        );
        profileBio = bioRows[0]?.bio ?? null;
      } catch {
        profileBio = null;
      }
    }

    let activeSubscription = profileResult.subscriptions[0];
    const latestEmergencyContact = profileResult.emergency_contacts[0];

    // If we still think the user is on trial but they have a Stripe customer,
    // try a sync to recover from missing/rewritten billing tables.
    const maybePlanType = (activeSubscription?.plan_type || 'trial') as keyof typeof PLAN_LIMITS;
    if (maybePlanType === 'trial' && profileResult.stripe_customer_id) {
      try {
        await billingService.syncSubscriptionWithStripe(userId);
        activeSubscription = await prisma.subscriptions.findFirst({
          where: {
            user_id: userId,
            status: { in: ['active', 'trialing', 'past_due'] },
          },
          orderBy: { created_at: 'desc' },
        }) || activeSubscription;
      } catch {
        // ignore sync failures; fall back to DB state
      }
    }

    const completedSessionsCount = profileResult._count.app_sessions;
    const moodEntriesCount = profileResult._count.mood_entries;
    const journalEntriesCount = profileResult._count.journal_entries;

    const streakDays = calculateStreak(profileResult.mood_entries);
    const scheduledAppointments =
      profileResult.appointments_appointments_user_idToprofiles;
    const upcomingSessions = scheduledAppointments.length;
    const primaryContact = latestEmergencyContact;

    const internalPlanType = (activeSubscription?.plan_type ||
      "trial") as keyof typeof PLAN_LIMITS;
    const planDetails = PLAN_LIMITS[internalPlanType];

    const subscriptionSeconds =
      (profileResult.credits_seconds && profileResult.credits_seconds > 0)
        ? profileResult.credits_seconds
        : (profileResult.credits || 0) * 60;
    const purchasedSeconds =
      (profileResult.purchased_credits_seconds &&
        profileResult.purchased_credits_seconds > 0)
        ? profileResult.purchased_credits_seconds
        : (profileResult.purchased_credits || 0) * 60;
    const totalSeconds = subscriptionSeconds + purchasedSeconds;

    result = {
      ...profileResult,
      bio: profileBio ?? null,
      emergency_contact_name:
        primaryContact?.name || profileResult.emergency_contact_name,
      emergency_contact_phone:
        primaryContact?.phone || profileResult.emergency_contact_phone,
      emergency_contact_relationship:
        primaryContact?.relationship ||
        profileResult.emergency_contact_relationship,
      streak_days: streakDays,
      upcoming_sessions: upcomingSessions,
      stats: {
        completed_sessions: completedSessionsCount,
        total_checkins: moodEntriesCount,
        total_journals: journalEntriesCount,
        streak_days: streakDays,
      },
      credits_remaining: totalSeconds === 0 ? 0 : Math.ceil(totalSeconds / 60),
      credits_remaining_seconds: totalSeconds,
      credits_total:
        totalSeconds === 0 ? 0 : Math.ceil(totalSeconds / 60),
      credits_total_seconds:
        totalSeconds,
      subscription_plan: internalPlanType,
      subscriptions: activeSubscription ? [activeSubscription] : [],
    };

    userProfileCache.set(userId, { data: result, timestamp: Date.now() });
  }

  const usedSecondsLifetime = await getLifetimeUsedSeconds(userId);
  const remainingSecondsForAccount =
    typeof result.credits_remaining_seconds === 'number'
      ? result.credits_remaining_seconds
      : Math.max(0, (result.credits_remaining || 0) * 60);
  const totalAccountSeconds = remainingSecondsForAccount + usedSecondsLifetime;
  result.minutes_used =
    usedSecondsLifetime === 0 ? 0 : Math.ceil(usedSecondsLifetime / 60);
  result.total_minutes =
    totalAccountSeconds === 0 ? 0 : Math.ceil(totalAccountSeconds / 60);
  result.credits_total = result.total_minutes;
  result.credits_total_seconds = totalAccountSeconds;

  // Resolve email verification from local auth mirror (`auth.users` exposed via prisma.users)
  // to keep GET /users/me fast and avoid remote Supabase Admin API latency on dashboard load.
  // IMPORTANT: default to `false` when we cannot verify, so UI doesn't incorrectly
  // treat users as verified (which breaks the trial verification popup).
  let emailVerified = false;
  try {
    const authUser = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        email_confirmed_at: true,
        raw_user_meta_data: true,
      },
    });
    const isConfirmed = !!authUser?.email_confirmed_at;
    const rawMeta = (authUser?.raw_user_meta_data ?? {}) as Record<string, any>;
    // Check custom metadata flag we set during trial signup.
    const verificationRequired = rawMeta?.email_verification_required === true;

    // Trial-only consistency:
    // If email is confirmed, treat verification_required as cleared logically.
    // (The callback flow may clear it later; we avoid write-side effects in GET /users/me.)
    const signupType = (result as any)?.signup_type;
    const isTrial = signupType === 'trial' || (result?.subscription_plan === 'trial');
    const verificationRequiredAfter =
      isTrial && isConfirmed && verificationRequired
        ? false
        : verificationRequired;

    // User is verified ONLY if confirmed by Supabase AND doesn't have the required flag
    emailVerified = isConfirmed && !verificationRequiredAfter;

  // Debug visibility: explain why `email_verified` was computed.
  console.log("[emailVerified debug]", {
    userId,
    email_confirmed_at: authUser?.email_confirmed_at ?? null,
    email_verification_required: rawMeta?.email_verification_required ?? null,
    verificationRequired,
    computedEmailVerified: emailVerified,
    subscription_plan: result?.subscription_plan ?? null,
    signup_type: (result as any)?.signup_type ?? null,
  });
  } catch {
    // If we can't fetch, fall back to whatever is already present (if any),
    // otherwise keep it as false (safe default for UX).
    emailVerified = result?.email_verified === true;
  }

  const planType = (result.subscription_plan || "trial") as keyof typeof PLAN_LIMITS;
  result.email_verified = emailVerified;
  result.needs_email_verification = planType === "trial" && !emailVerified;

  // Resolve onboarding completion deterministically:
  // - use explicit DB flag when present
  // - otherwise infer from legacy onboarding fields (for backwards-compatibility)
  const onboardingCompletedResolved = resolveOnboardingCompleted(result);
  result.onboarding_completed = onboardingCompletedResolved;
  result.needs_onboarding = !onboardingCompletedResolved;

  // Update cache with fresh verification flags
  userProfileCache.set(userId, { data: result, timestamp: Date.now() });

  return result;
}

export async function getCredits(userId: string) {
  const activeSub = await prisma.subscriptions.findFirst({
    where: {
      user_id: userId,
      status: { in: ['active', 'trialing', 'past_due'] },
    },
    orderBy: { created_at: 'desc' },
    select: {
      start_date: true,
      end_date: true,
      created_at: true,
    },
  });

  const profile = await prisma.profiles.findUnique({
    where: { id: userId },
    select: {
      credits: true,
      purchased_credits: true,
      credits_seconds: true,
      purchased_credits_seconds: true,
    },
  });

  const subscriptionSeconds =
    (profile?.credits_seconds && profile.credits_seconds > 0)
      ? profile.credits_seconds
      : (profile?.credits || 0) * 60;
  const purchasedSeconds =
    (profile?.purchased_credits_seconds &&
      profile.purchased_credits_seconds > 0)
      ? profile.purchased_credits_seconds
      : (profile?.purchased_credits || 0) * 60;
  const remainingSeconds = subscriptionSeconds + purchasedSeconds;

  const usedSecondsLifetime = await getLifetimeUsedSeconds(userId);
  const totalAccountSeconds = remainingSeconds + usedSecondsLifetime;

  const ceilMin = (sec: number) => (sec === 0 ? 0 : Math.ceil(sec / 60));

  // "Subscription total" should reflect the full allowance accrued this billing period,
  // including stacked upgrades: total = remaining + used_this_period.
  const periodStart = activeSub?.start_date || activeSub?.created_at || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const periodEnd = activeSub?.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const usedAgg = await prisma.app_sessions.aggregate({
    where: {
      user_id: userId,
      status: 'completed',
      ended_at: { not: null, gte: periodStart, lte: periodEnd },
    },
    _sum: { billed_seconds: true },
  });

  const usedSecondsThisPeriod = Math.max(0, usedAgg._sum.billed_seconds || 0);
  const subscriptionTotalSeconds = subscriptionSeconds + usedSecondsThisPeriod;

  return {
    credits: ceilMin(remainingSeconds),
    subscription: ceilMin(subscriptionSeconds),
    purchased: ceilMin(purchasedSeconds),
    credits_seconds: remainingSeconds,
    subscription_seconds: subscriptionSeconds,
    purchased_seconds: purchasedSeconds,
    subscription_total: subscriptionTotalSeconds === 0 ? 0 : Math.ceil(subscriptionTotalSeconds / 60),
    subscription_total_seconds: subscriptionTotalSeconds,
  };
}

export async function getRecentActivity(userId: string, limit: number = 25) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const normalizeSessionTypeLabel = (value: string | null | undefined) => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'session';
    if (raw === 'instant' || raw === 'scheduled') return raw;
    return 'session';
  };

  const [activityEvents, moodEntries, journalEntries, sessions] = await Promise.all([
    prisma.activity_events.findMany({
      where: { user_id: userId },
      orderBy: { timestamp: 'desc' },
      take: safeLimit,
      select: {
        id: true,
        timestamp: true,
        app_name: true,
        window_title: true,
        metadata: true,
      },
    }),
    prisma.mood_entries.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: safeLimit,
      select: {
        id: true,
        mood: true,
        intensity: true,
        created_at: true,
      },
    }),
    prisma.journal_entries.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: safeLimit,
      select: {
        id: true,
        title: true,
        created_at: true,
      },
    }),
    prisma.app_sessions.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: safeLimit,
      select: {
        id: true,
        status: true,
        type: true,
        duration_minutes: true,
        created_at: true,
      },
    }),
  ]);

  const merged = [
    ...activityEvents.map((event) => ({
      id: `event:${event.id}`,
      type: 'event',
      text:
        event.window_title ||
        event.app_name ||
        ((event.metadata as Record<string, any> | null)?.action as string | undefined) ||
        'Used the app',
      created_at: event.timestamp.toISOString(),
      metadata: event.metadata,
    })),
    ...moodEntries.map((entry) => ({
      id: `mood:${entry.id}`,
      type: 'mood',
      text: `Logged ${entry.mood} (${entry.intensity}/10)`,
      created_at: entry.created_at.toISOString(),
      mood: entry.mood,
    })),
    ...journalEntries.map((entry) => ({
      id: `journal:${entry.id}`,
      type: 'journal',
      text: `Wrote a journal entry${entry.title ? `: ${entry.title}` : ''}`,
      created_at: entry.created_at.toISOString(),
    })),
    ...sessions.map((session) => ({
      id: `session:${session.id}`,
      type: 'session',
      text: (() => {
        const typeLabel = normalizeSessionTypeLabel(session.type);
        if (session.status === 'completed') {
          return `Completed ${typeLabel} session${session.duration_minutes ? ` (${session.duration_minutes} min)` : ''}`;
        }
        if (session.status === 'scheduled') {
          return typeLabel === 'scheduled'
            ? 'Scheduled session'
            : `Scheduled ${typeLabel} session`;
        }
        return `Session ${session.status}`;
      })(),
      created_at: session.created_at.toISOString(),
      status: session.status,
    })),
  ];

  return merged
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, safeLimit);
}

export async function createCrisisEventFromDetection(input: {
  userId: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  eventType?: string;
  keywords?: string[];
  aiConfidence?: number;
  notes?: string;
}) {
  const keywords = (input.keywords || [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 20);

  const event = await prisma.crisis_events.create({
    data: {
      user_id: input.userId,
      risk_level: input.riskLevel,
      event_type: input.eventType || 'keyword_detection',
      keywords,
      ai_confidence:
        typeof input.aiConfidence === 'number'
          ? Math.max(0, Math.min(100, Math.round(input.aiConfidence)))
          : null,
      notes: input.notes,
      status: 'pending',
    },
  });

  adminService.invalidateCrisisEventsCache();

  return event;
}

export async function updateProfile(userId: string, data: UpdateProfileInput) {
  const {
    emergency_contact_name,
    emergency_contact_phone,
    emergency_contact_relationship,
    bio,
    brain_health_settings,
    ...profileForPrisma
  } = data;

  console.log("Updating profile for user:", userId);
  console.log("Emergency Contact Data:", { emergency_contact_name, emergency_contact_phone, emergency_contact_relationship });

  // Handle emergency contact update if any of the fields are present
  if (emergency_contact_name !== undefined || emergency_contact_phone !== undefined || emergency_contact_relationship !== undefined) {
    const existingContact = await prisma.emergency_contacts.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' }
    });

    if (existingContact) {
      await prisma.emergency_contacts.update({
        where: { id: existingContact.id },
        data: {
          name: emergency_contact_name ?? existingContact.name,
          phone: emergency_contact_phone ?? existingContact.phone,
          relationship: emergency_contact_relationship ?? existingContact.relationship,
        }
      });
    } else if (emergency_contact_name) {
      // Create new if name is provided
      await prisma.emergency_contacts.create({
        data: {
          user_id: userId,
          name: emergency_contact_name,
          phone: emergency_contact_phone,
          relationship: emergency_contact_relationship,
          is_trusted: true
        }
      });
    }
  }

  const bioDbValue =
    bio === undefined
      ? undefined
      : typeof bio === 'string' && bio.trim() === ''
        ? null
        : bio;

  const brainHealthDbValue =
    brain_health_settings === undefined
      ? undefined
      : JSON.stringify(brain_health_settings);

  // `bio` is written via raw SQL so profile saves work even when the generated Prisma
  // client is stale (e.g. dev server locks query_engine during `prisma generate`).
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.profiles.update({
      where: { id: userId },
      data: profileForPrisma as any,
    });
    if (bioDbValue !== undefined) {
      await tx.$executeRaw(
        Prisma.sql`UPDATE public.profiles SET bio = ${bioDbValue} WHERE id = ${userId}::uuid`
      );
    }
    if (brainHealthDbValue !== undefined) {
      await tx.$executeRaw(
        Prisma.sql`UPDATE public.profiles SET brain_health_settings = ${brainHealthDbValue}::jsonb WHERE id = ${userId}::uuid`
      );
    }
    return row;
  });

  invalidateUserProfileCache(userId);
  if (bioDbValue !== undefined || brainHealthDbValue !== undefined) {
    return {
      ...updated,
      ...(bioDbValue !== undefined ? { bio: bioDbValue } : {}),
      ...(brainHealthDbValue !== undefined
        ? { brain_health_settings: brain_health_settings }
        : {}),
    };
  }
  return updated;
}

export async function completeOnboarding(userId: string, data: OnboardingInput) {
  console.log('Completing onboarding for user:', userId, 'Data:', JSON.stringify(data, null, 2));
  const { role, license_number, specializations, languages, ...profileData } = data;
  const completedAt = new Date();

  // Update profile
  const profile = await prisma.profiles.upsert({
    where: { id: userId },
    create: {
      id: userId,
      ...profileData,
      role,
      onboarding_completed: true,
      onboarding_completed_at: completedAt,
    },
    update: {
      ...profileData,
      role,
      onboarding_completed: true,
      onboarding_completed_at: completedAt,
    },
  });

  // If therapist, create/update therapist profile
  if (role === 'therapist') {
    await prisma.companion_profiles.upsert({
      where: { id: userId },
      create: {
        id: userId,
        license_number,
        specializations: specializations || [],
        languages: languages || [],
      },
      update: {
        license_number,
        specializations: specializations || [],
        languages: languages || [],
      },
    });
  }

  invalidateUserProfileCache(userId);
  return getProfile(userId);
}

export async function deleteUser(userId: string) {
  // Delete from Prisma (application data)
  // We use a transaction or just delete. Deleting profile usually cascades to related tables in Prisma schema
  // But let's just delete the profile.
  try {
    await prisma.profiles.delete({
      where: { id: userId },
    });
  } catch (error) {
    // If record doesn't exist, we can proceed to delete from Auth
    console.warn(`Failed to delete profile for user ${userId}:`, error);
  }

  // Delete from Supabase Auth
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(`Failed to delete user from Supabase Auth: ${error.message}`);
  }

  return { success: true };
}

export async function exportUserData(userId: string) {
  const profile = await getProfile(userId);
  // You can expand this to include more data from other services
  return {
    profile,
  };
}
