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

export async function checkUserExists(email: string) {
  const existingUser = await prisma.users.findFirst({
    where: { email: email }
  });

  if (existingUser) {
    return { exists: true, reason: 'email' };
  }

  return { exists: false };
}

export async function createProfile(userId: string, email: string, fullName?: string) {
  const profile = await prisma.profiles.upsert({
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

export async function createProfileForPaidSignup(userId: string, email: string, fullName?: string) {
  return prisma.profiles.upsert({
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

  // Always fetch fresh email verification status from Supabase (so verification link click is reflected quickly)
  let emailVerified = true;
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
  } catch {
    // If we can't fetch, keep whatever is currently in result.email_verified
    emailVerified = result?.email_verified ?? true;
  }

  const planType = (result.subscription_plan || "trial") as keyof typeof PLAN_LIMITS;
  result.email_verified = emailVerified;
  result.needs_email_verification = planType === "trial" && !emailVerified;

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

  // Update profile
  const profile = await prisma.profiles.upsert({
    where: { id: userId },
    create: {
      id: userId,
      ...profileData,
      role,
    },
    update: {
      ...profileData,
      role,
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
