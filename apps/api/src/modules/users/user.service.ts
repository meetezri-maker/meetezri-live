import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { supabaseAdmin } from '../../config/supabase';
import { OnboardingInput, UpdateProfileInput } from './user.schema';
import { PLAN_LIMITS } from '../billing/billing.constants';
import * as billingService from '../billing/billing.service';
import { getLifetimeUsedSeconds, resolveBucketSeconds } from '../billing/credit-balance.service';
import { pbkdf2Sync, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { emailService } from '../email/email.service';
import { sharedDel, sharedGetJson, sharedSetJson } from '../../lib/sharedCache';

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

const ACCOUNT_ACTIVATION_TTL_MS = 24 * 60 * 60 * 1000;
const ACCOUNT_ACTIVATION_RESEND_MS = 60 * 1000;
const accountActivationTokenMap = new Map<
  string,
  { userId: string; expiresAt: number }
>();
const accountActivationResendMap = new Map<string, number>();

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
    'Your Solace 2FA Recovery Code',
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
    'Your Solace Login Authentication Code',
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

const accountStateByEmailCache = new Map<string, { data: any; timestamp: number }>();
const ACCOUNT_STATE_CACHE_TTL = 10 * 1000; // 10s: absorbs fast retries on signup/check.
const accountStateByEmailInFlight = new Map<string, Promise<any>>();

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
  const key = String(email || '').trim().toLowerCase();
  const cached = accountStateByEmailCache.get(key);
  if (cached && Date.now() - cached.timestamp < ACCOUNT_STATE_CACHE_TTL) {
    return cached.data;
  }
  const inFlight = accountStateByEmailInFlight.get(key);
  if (inFlight) return await inFlight;

  const run = (async () => {
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
  // Supabase confirmation wins over a stale client metadata flag left from signup.
  const emailVerified =
    emailConfirmed && (!verificationRequired || emailConfirmed);

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
  })().finally(() => {
    accountStateByEmailInFlight.delete(key);
  });

  accountStateByEmailInFlight.set(key, run);
  const data = await run;
  accountStateByEmailCache.set(key, { data, timestamp: Date.now() });
  return data;
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

/** Build display name from Supabase auth user_metadata (signup form, OAuth, etc.). */
export async function getFullNameFromAuthMeta(authUserId: string): Promise<string | null> {
  try {
    const authUser = await prisma.users.findUnique({
      where: { id: authUserId },
      select: { raw_user_meta_data: true },
    });

    const meta = authUser?.raw_user_meta_data as Record<string, unknown> | null | undefined;
    if (!meta || typeof meta !== 'object') return null;

    const fullName =
      typeof meta.full_name === 'string' ? meta.full_name.trim() : '';
    if (fullName.length > 1) return fullName;

    const first =
      typeof meta.first_name === 'string' ? meta.first_name.trim() : '';
    const last =
      typeof meta.last_name === 'string' ? meta.last_name.trim() : '';
    const combined = `${first} ${last}`.trim();
    if (combined.length > 1) return combined;

    const name = typeof meta.name === 'string' ? meta.name.trim() : '';
    if (name.length > 1) return name;

    return null;
  } catch {
    return null;
  }
}

function isEmailLocalPartDisplayName(
  fullName: string | null | undefined,
  email: string
): boolean {
  const current = (fullName ?? '').trim();
  if (!current) return true;
  const local = email.split('@')[0]?.trim().toLowerCase() ?? '';
  if (!local) return false;
  return current.toLowerCase() === local;
}

/**
 * When a profile was seeded with the email local-part, replace it with the name
 * the user entered at signup (stored in auth metadata).
 */
export async function getProfileNameBackfillFromAuth(
  userId: string,
  email: string,
  existingFullName: string | null | undefined
): Promise<string | null> {
  if (!isEmailLocalPartDisplayName(existingFullName, email)) return null;
  return getFullNameFromAuthMeta(userId);
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
        ...(fullName ? { full_name: fullName } : {}),
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
        ...(fullName ? { full_name: fullName } : {}),
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
        ...(fullName ? { full_name: fullName } : {}),
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
        ...(fullName ? { full_name: fullName } : {}),
      },
    });
  }
}

const userProfileCache = new Map<string, { data: any; timestamp: number }>();
const PROFILE_CACHE_TTL = 30 * 1000; // 30 seconds

const creditsCache = new Map<string, { data: any; timestamp: number }>();
const CREDITS_CACHE_TTL = 15 * 1000; // 15s: credits is expensive; UI doesn't need per-second accuracy.

const creditsPeriodUsedCache = new Map<string, { totalSeconds: number; timestamp: number }>();
const CREDITS_PERIOD_USED_TTL = 60 * 1000; // 60s: period sum is expensive; acceptable staleness for dashboard.

const recentActivityCache = new Map<string, { data: any[]; timestamp: number }>();
const RECENT_ACTIVITY_CACHE_TTL = 5 * 1000; // 5s: absorbs repeated dashboard loads / route changes.

const creditsInFlight = new Map<string, Promise<any>>();
const recentActivityInFlight = new Map<string, Promise<any[]>>();

function recentActivityCacheKey(userId: string, limit: number) {
  return `${userId}|${limit}`;
}

export function invalidateUserProfileCache(userId: string) {
  userProfileCache.delete(userId);
  creditsCache.delete(userId);
  void sharedDel(`users:credits:${userId}`);
  // creditsPeriodUsedCache is keyed by period, so clear all for this user.
  const prefix = `${userId}|`;
  for (const key of creditsPeriodUsedCache.keys()) {
    if (key.startsWith(prefix)) creditsPeriodUsedCache.delete(key);
  }
}

export function invalidateRecentActivityCache(userId: string) {
  const prefix = `${userId}|`;
  for (const key of recentActivityCache.keys()) {
    if (key.startsWith(prefix)) recentActivityCache.delete(key);
  }
  recentActivityInFlight.forEach((_, key) => {
    if (key.startsWith(prefix)) recentActivityInFlight.delete(key);
  });
  // Limits used by dashboard (20), history (100), and legacy callers.
  for (const limit of [10, 20, 25, 50, 100]) {
    void sharedDel(`users:activity:${userId}:${limit}`);
  }
}

export async function getProfile(userId: string) {
  // Check cache first
  const cached = userProfileCache.get(userId);
  let result: any;
  let fromCache = false;

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
      fromCache = true;
    }
  }

  // When the cache is valid, return immediately: the cached object already includes
  // computed totals (`minutes_used`, `credits_total_seconds`) + verification flags.
  // This avoids extra DB work on hot /users/me traffic (route changes / app boot).
  if (fromCache && result) {
    return result;
  }

  /** When cold-loading profile, we prefetch lifetime + auth in parallel to avoid 3+ sequential round-trips. */
  let preloaded: {
    usedSecondsLifetime: number;
    authUser: {
      email_confirmed_at: Date | null;
      raw_user_meta_data: any;
    } | null;
  } | null = null;

  if (!result) {
    const now = new Date();
    // Single round-trip: profile (no unused companion / appointment row scans) + count + hot aggregates
    const [profileResult, upcomingApptCount, usedSecondsLifetime, authUser] = await Promise.all([
      prisma.profiles.findUnique({
        where: { id: userId },
        include: {
          subscriptions: {
            where: { status: { in: ['active', 'trialing', 'past_due'] } },
            orderBy: { created_at: 'desc' },
            take: 1,
          },
          emergency_contacts: {
            orderBy: { created_at: 'desc' },
            take: 1,
          },
          mood_entries: {
            orderBy: { created_at: 'desc' },
            take: 30,
          },
          _count: {
            select: {
              app_sessions: { where: { ended_at: { not: null } } },
              mood_entries: true,
              journal_entries: true,
            },
          },
        },
      }),
      prisma.appointments.count({
        where: {
          user_id: userId,
          status: 'scheduled',
          start_time: { gt: now },
        },
      }),
      getLifetimeUsedSeconds(userId),
      prisma.users.findUnique({
        where: { id: userId },
        select: {
          email_confirmed_at: true,
          raw_user_meta_data: true,
        },
      }),
    ]);

    if (!profileResult) return null;
    preloaded = { usedSecondsLifetime, authUser };

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
    const upcomingSessions = upcomingApptCount;
    const primaryContact = latestEmergencyContact;

    const internalPlanType = (activeSubscription?.plan_type ||
      "trial") as keyof typeof PLAN_LIMITS;
    const planDetails = PLAN_LIMITS[internalPlanType];

    const subscriptionSeconds = resolveBucketSeconds(
      profileResult.credits,
      profileResult.credits_seconds
    );
    const purchasedSeconds = resolveBucketSeconds(
      profileResult.purchased_credits,
      profileResult.purchased_credits_seconds
    );
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

  let usedSecondsLifetime: number;
  let authForEmail: {
    email_confirmed_at: Date | null;
    raw_user_meta_data: any;
  } | null;
  if (preloaded) {
    usedSecondsLifetime = preloaded.usedSecondsLifetime;
    authForEmail = preloaded.authUser;
  } else {
    [usedSecondsLifetime, authForEmail] = await Promise.all([
      getLifetimeUsedSeconds(userId),
      prisma.users.findUnique({
        where: { id: userId },
        select: {
          email_confirmed_at: true,
          raw_user_meta_data: true,
        },
      }),
    ]);
  }
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
    const isConfirmed = !!authForEmail?.email_confirmed_at;
    const rawMeta = (authForEmail?.raw_user_meta_data ?? {}) as Record<string, any>;
    // Check custom metadata flag we set during trial signup.
    const verificationRequired = rawMeta?.email_verification_required === true;

    // If Supabase has confirmed the email, ignore a stale `email_verification_required`
    // flag that can remain in JWT metadata after password login (callback-only clear).
    const verificationRequiredAfter =
      isConfirmed && verificationRequired ? false : verificationRequired;

    // User is verified ONLY if confirmed by Supabase AND doesn't have the required flag
    emailVerified = isConfirmed && !verificationRequiredAfter;

    // Debug visibility: explain why `email_verified` was computed.
    if (process.env.DEBUG_API === '1' || process.env.DEBUG_API === 'true') {
      console.log("[emailVerified debug]", {
        userId,
        email_confirmed_at: authForEmail?.email_confirmed_at ?? null,
        email_verification_required: rawMeta?.email_verification_required ?? null,
        verificationRequired,
        computedEmailVerified: emailVerified,
        subscription_plan: result?.subscription_plan ?? null,
        signup_type: (result as any)?.signup_type ?? null,
      });
    }
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
  const cached = creditsCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CREDITS_CACHE_TTL) {
    return cached.data;
  }

  const shared = await sharedGetJson<any>(`users:credits:${userId}`);
  if (shared) {
    creditsCache.set(userId, { data: shared, timestamp: Date.now() });
    return shared;
  }

  const inFlight = creditsInFlight.get(userId);
  if (inFlight) return await inFlight;

  const run = (async () => {
    const [activeSub, profile] = await Promise.all([
      prisma.subscriptions.findFirst({
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
      }),
      prisma.profiles.findUnique({
        where: { id: userId },
        select: {
          credits: true,
          purchased_credits: true,
          credits_seconds: true,
          purchased_credits_seconds: true,
        },
      }),
    ]);

    const subscriptionSeconds = resolveBucketSeconds(
      profile?.credits,
      profile?.credits_seconds
    );
    const purchasedSeconds = resolveBucketSeconds(
      profile?.purchased_credits,
      profile?.purchased_credits_seconds
    );
    const remainingSeconds = subscriptionSeconds + purchasedSeconds;

    const ceilMin = (sec: number) => (sec === 0 ? 0 : Math.ceil(sec / 60));

    // "Subscription total" should reflect the full allowance accrued this billing period,
    // including stacked upgrades: total = remaining + used_this_period.
    const periodStart = activeSub?.start_date || activeSub?.created_at || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const periodEnd = activeSub?.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const periodKey = `${userId}|${periodStart.toISOString()}|${periodEnd.toISOString()}`;
    const cachedPeriod = creditsPeriodUsedCache.get(periodKey);
    let usedSecondsThisPeriod: number;
    if (cachedPeriod && Date.now() - cachedPeriod.timestamp < CREDITS_PERIOD_USED_TTL) {
      usedSecondsThisPeriod = cachedPeriod.totalSeconds;
    } else {
      const usedPeriodRows = await prisma.$queryRaw<[{ total: bigint | null }]>(
        Prisma.sql`
          SELECT COALESCE(SUM(COALESCE(s.billed_seconds, 0)), 0)::bigint AS total
          FROM public.app_sessions s
          WHERE s.user_id = ${userId}::uuid
            AND s.status = 'completed'
            AND s.ended_at IS NOT NULL
            AND s.ended_at >= ${periodStart}
            AND s.ended_at <= ${periodEnd}
        `
      );
      usedSecondsThisPeriod = Math.max(0, Number(usedPeriodRows[0]?.total ?? 0) || 0);
      creditsPeriodUsedCache.set(periodKey, { totalSeconds: usedSecondsThisPeriod, timestamp: Date.now() });
    }
    const subscriptionTotalSeconds = subscriptionSeconds + usedSecondsThisPeriod;

    const result = {
      credits: ceilMin(remainingSeconds),
      subscription: ceilMin(subscriptionSeconds),
      purchased: ceilMin(purchasedSeconds),
      credits_seconds: remainingSeconds,
      subscription_seconds: subscriptionSeconds,
      purchased_seconds: purchasedSeconds,
      subscription_total: subscriptionTotalSeconds === 0 ? 0 : Math.ceil(subscriptionTotalSeconds / 60),
      subscription_total_seconds: subscriptionTotalSeconds,
    };
    creditsCache.set(userId, { data: result, timestamp: Date.now() });
    void sharedSetJson(`users:credits:${userId}`, result, CREDITS_CACHE_TTL);
    return result;
  })().finally(() => {
    creditsInFlight.delete(userId);
  });

  creditsInFlight.set(userId, run);
  return await run;
}

function formatRecentActivitySessionDuration(session: {
  duration_minutes: number | null;
  billed_seconds: number | null;
  started_at: Date | null;
  ended_at: Date | null;
}): string | null {
  const billedSec =
    typeof session.billed_seconds === 'number' &&
    Number.isFinite(session.billed_seconds) &&
    session.billed_seconds > 0
      ? session.billed_seconds
      : null;

  const spanMs =
    session.started_at && session.ended_at
      ? Math.max(0, session.ended_at.getTime() - session.started_at.getTime())
      : null;
  const spanMinutes = spanMs != null ? spanMs / 60000 : null;

  const storedMin =
    typeof session.duration_minutes === 'number' && !Number.isNaN(session.duration_minutes)
      ? session.duration_minutes
      : null;

  if (spanMinutes != null && spanMinutes > 0) {
    if (spanMinutes >= 1) return `${Math.floor(spanMinutes)} min`;
    return '< 1 min';
  }

  if (storedMin != null && storedMin > 0) return `${storedMin} min`;
  if (storedMin === 0) return '0 min';

  if (billedSec != null) {
    const minutes = billedSec / 60;
    return minutes < 1 ? '< 1 min' : `${Math.floor(minutes)} min`;
  }

  return null;
}

export async function getRecentActivity(userId: string, limit: number = 25) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const cacheKey = recentActivityCacheKey(userId, safeLimit);
  const cached = recentActivityCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < RECENT_ACTIVITY_CACHE_TTL) {
    return cached.data;
  }

  const shared = await sharedGetJson<any[]>(`users:activity:${userId}:${safeLimit}`);
  if (shared) {
    recentActivityCache.set(cacheKey, { data: shared, timestamp: Date.now() });
    return shared;
  }

  const inFlight = recentActivityInFlight.get(cacheKey);
  if (inFlight) return await inFlight;

  const run = (async () => {
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
          billed_seconds: true,
          started_at: true,
          ended_at: true,
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
          const durationLabel = formatRecentActivitySessionDuration(session);
          return `Completed ${typeLabel} talking${durationLabel ? ` (${durationLabel})` : ''}`;
        }
        if (session.status === 'scheduled') {
          return typeLabel === 'scheduled'
            ? 'Scheduled talking'
            : `Scheduled ${typeLabel} talking`;
        }
        return `Talking ${session.status}`;
      })(),
      created_at: session.created_at.toISOString(),
      status: session.status,
    })),
  ];

    const result = merged
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, safeLimit);

    recentActivityCache.set(cacheKey, { data: result, timestamp: Date.now() });
    void sharedSetJson(`users:activity:${userId}:${safeLimit}`, result, RECENT_ACTIVITY_CACHE_TTL);
    return result;
  })().finally(() => {
    recentActivityInFlight.delete(cacheKey);
  });

  recentActivityInFlight.set(cacheKey, run);
  return await run;
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

function mergeProfileJsonField(
  existing: unknown,
  incoming: unknown
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  const patch =
    incoming && typeof incoming === 'object' && !Array.isArray(incoming)
      ? (incoming as Record<string, unknown>)
      : {};
  return { ...base, ...patch };
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

  if (
    profileForPrisma.privacy_settings !== undefined ||
    profileForPrisma.notification_preferences !== undefined
  ) {
    const existing = await prisma.profiles.findUnique({
      where: { id: userId },
      select: { privacy_settings: true, notification_preferences: true },
    });
    if (profileForPrisma.privacy_settings !== undefined) {
      profileForPrisma.privacy_settings = mergeProfileJsonField(
        existing?.privacy_settings,
        profileForPrisma.privacy_settings
      ) as UpdateProfileInput['privacy_settings'];
    }
    if (profileForPrisma.notification_preferences !== undefined) {
      profileForPrisma.notification_preferences = mergeProfileJsonField(
        existing?.notification_preferences,
        profileForPrisma.notification_preferences
      ) as UpdateProfileInput['notification_preferences'];
    }
  }

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

export async function deactivateAccount(userId: string) {
  const profile = await prisma.profiles.findUnique({
    where: { id: userId },
    select: { account_status: true },
  });
  if (!profile) {
    const err = new Error('Profile not found');
    (err as any).statusCode = 404;
    throw err;
  }
  if (profile.account_status === 'inactive') {
    return { account_status: 'inactive' as const, alreadyInactive: true };
  }

  await prisma.profiles.update({
    where: { id: userId },
    data: { account_status: 'inactive' },
  });
  invalidateUserProfileCache(userId);
  return { account_status: 'inactive' as const };
}

export async function requestAccountActivation(userId: string, webBaseUrl: string) {
  const profile = await prisma.profiles.findUnique({
    where: { id: userId },
    select: { account_status: true },
  });
  if (!profile) {
    const err = new Error('Profile not found');
    (err as any).statusCode = 404;
    throw err;
  }
  if (profile.account_status !== 'inactive') {
    const err = new Error('Account is not deactivated');
    (err as any).statusCode = 400;
    throw err;
  }

  const email = await getUserEmail(userId);
  if (!email) {
    const err = new Error('Email not found for account');
    (err as any).statusCode = 400;
    throw err;
  }

  const now = Date.now();
  const lastSent = accountActivationResendMap.get(userId);
  if (lastSent && now - lastSent < ACCOUNT_ACTIVATION_RESEND_MS) {
    const waitSeconds = Math.ceil((ACCOUNT_ACTIVATION_RESEND_MS - (now - lastSent)) / 1000);
    const err = new Error(`Please wait ${waitSeconds}s before requesting another activation email`);
    (err as any).statusCode = 429;
    throw err;
  }

  const token = randomBytes(32).toString('hex');
  accountActivationTokenMap.set(token, {
    userId,
    expiresAt: now + ACCOUNT_ACTIVATION_TTL_MS,
  });
  accountActivationResendMap.set(userId, now);

  const activationUrl = `${webBaseUrl.replace(/\/$/, '')}/auth/activate-account?token=${encodeURIComponent(token)}`;
  const subject = 'Activate your Solace account';
  const html = `
    <p>We received a request to reactivate your Solace account.</p>
    <p><a href="${activationUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 20px;border-radius:999px;background:linear-gradient(90deg,#7C3AED,#EC4899);color:#fff;text-decoration:none;font-weight:600;">Activate my account</a></p>
    <p>Or copy this link into your browser:</p>
    <p style="word-break:break-all;color:#6b7280;">${activationUrl}</p>
    <p>This link expires in 24 hours. If you did not request this, you can ignore this email.</p>
  `;
  const text = `Activate your Solace account: ${activationUrl}\n\nThis link expires in 24 hours.`;

  await emailService.sendEmail(email, subject, html, text);
  return { sent: true, email };
}

export async function confirmAccountActivation(token: string) {
  const trimmed = String(token || '').trim();
  if (!trimmed || trimmed.length < 32) {
    const err = new Error('Invalid activation link');
    (err as any).statusCode = 400;
    throw err;
  }

  const record = accountActivationTokenMap.get(trimmed);
  if (!record) {
    const err = new Error('Activation link is invalid or has already been used');
    (err as any).statusCode = 404;
    throw err;
  }

  if (Date.now() > record.expiresAt) {
    accountActivationTokenMap.delete(trimmed);
    const err = new Error('Activation link has expired. Request a new one after signing in.');
    (err as any).statusCode = 401;
    throw err;
  }

  await prisma.profiles.update({
    where: { id: record.userId },
    data: { account_status: 'active' },
  });
  accountActivationTokenMap.delete(trimmed);
  invalidateUserProfileCache(record.userId);
  return { activated: true, account_status: 'active' as const };
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
