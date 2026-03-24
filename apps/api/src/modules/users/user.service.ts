import prisma from '../../lib/prisma';
import { supabaseAdmin } from '../../config/supabase';
import { OnboardingInput, UpdateProfileInput } from './user.schema';
import { PLAN_LIMITS } from '../billing/billing.constants';
import * as billingService from '../billing/billing.service';

function calculateStreak(moodEntries: any[]) {
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

export async function createProfile(
  userId: string,
  email: string,
  fullName?: string,
  signupType?: 'trial' | 'plan' | null
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
      },
      update: {
        email,
        full_name: fullName || email.split('@')[0],
        onboarding_completed: false,
        onboarding_completed_at: null,
        ...(resolvedSignupType ? { signup_type: resolvedSignupType } : {}),
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
  signupType?: 'trial' | 'plan' | null
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
      },
      update: {
        email,
        full_name: fullName || email.split('@')[0],
        onboarding_completed: false,
        onboarding_completed_at: null,
        ...(resolvedSignupType ? { signup_type: resolvedSignupType } : {}),
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

  // Always fetch fresh email verification status from Supabase.
  // IMPORTANT: default to `false` when we cannot verify, so UI doesn't incorrectly
  // treat users as verified (which breaks the trial verification popup).
  let emailVerified = false;
  try {
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(
      userId,
    );
    const user = authData?.user;
    const isConfirmed = !!user?.email_confirmed_at;
    // Check custom metadata flag we set during trial signup
    const verificationRequired = user?.user_metadata?.email_verification_required === true;
    
    // User is verified ONLY if confirmed by Supabase AND doesn't have the required flag
    emailVerified = isConfirmed && !verificationRequired;

  // Debug visibility: explain why `email_verified` was computed.
  console.log("[emailVerified debug]", {
    userId,
    email_confirmed_at: user?.email_confirmed_at ?? null,
    email_verification_required: user?.user_metadata?.email_verification_required ?? null,
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
    }
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
  const totalSeconds = subscriptionSeconds + purchasedSeconds;

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
    credits: totalSeconds === 0 ? 0 : Math.ceil(totalSeconds / 60),
    subscription:
      subscriptionSeconds === 0 ? 0 : Math.ceil(subscriptionSeconds / 60),
    purchased:
      purchasedSeconds === 0 ? 0 : Math.ceil(purchasedSeconds / 60),
    credits_seconds: totalSeconds,
    subscription_seconds: subscriptionSeconds,
    purchased_seconds: purchasedSeconds,
    subscription_total: subscriptionTotalSeconds === 0 ? 0 : Math.ceil(subscriptionTotalSeconds / 60),
    subscription_total_seconds: subscriptionTotalSeconds,
  };
}

export async function updateProfile(userId: string, data: UpdateProfileInput) {
  // console.log('Updating profile for user:', userId, 'Data:', data);

  const { 
    emergency_contact_name, 
    emergency_contact_phone, 
    emergency_contact_relationship, 
    ...profileData 
  } = data as any;

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
  
  return prisma.profiles.update({
    where: { id: userId },
    data: data as any, // Keep updating legacy fields for now for safety, or use profileData to exclude them
  });
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
