import prisma from '../../lib/prisma';
import { supabaseAdmin } from '../../config/supabase';
import { OnboardingInput, UpdateProfileInput } from './user.schema';
import { PLAN_LIMITS } from '../billing/billing.constants';

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
  const profile = await prisma.profiles.create({
    data: {
      id: userId,
      email,
      full_name: fullName || email.split('@')[0],
      role: 'user',
      credits: 30, // Initialize with 30 minutes for Trial
    },
  });

  // Create Trial Subscription (7 days)
  await prisma.subscriptions.create({
    data: {
      user_id: userId,
      plan_type: 'trial',
      status: 'active',
      start_date: new Date(),
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      billing_cycle: 'monthly', // Not really relevant for trial but required by schema default
    }
  });

  return profile;
}

const userProfileCache = new Map<string, { data: any, timestamp: number }>();
const PROFILE_CACHE_TTL = 30 * 1000; // 30 seconds

export async function getProfile(userId: string) {
  // Check cache first
  const cached = userProfileCache.get(userId);
  if (cached && (Date.now() - cached.timestamp < PROFILE_CACHE_TTL)) {
    return cached.data;
  }

  const [profileResult, recentMoods, scheduledAppointments, countsResult] = await Promise.all([
    // 1. Profile + simple relations
    prisma.profiles.findUnique({
      where: { id: userId },
      include: {
        companion_profiles: true,
        subscriptions: {
          where: { status: 'active' },
          orderBy: { created_at: 'desc' },
          take: 1
        },
        emergency_contacts: {
          orderBy: { created_at: 'desc' },
          take: 1
        }
      }
    }),
    // 2. Recent moods
    prisma.mood_entries.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 30
    }),
    // 3. Scheduled appointments
    prisma.appointments.findMany({
      where: {
        user_id: userId,
        status: 'scheduled',
        start_time: { gt: new Date() }
      },
      orderBy: { start_time: 'asc' }
    }),
    // 4. Counts (Single Raw Query)
    prisma.$queryRaw`
      SELECT
        (SELECT count(*) FROM app_sessions WHERE user_id = ${userId}::uuid AND ended_at IS NOT NULL) as sessions,
        (SELECT count(*) FROM mood_entries WHERE user_id = ${userId}::uuid) as moods,
        (SELECT count(*) FROM journal_entries WHERE user_id = ${userId}::uuid) as journals
    `
  ]);

  if (!profileResult) return null;

  const activeSubscription = profileResult.subscriptions[0];
  const latestEmergencyContact = profileResult.emergency_contacts[0];
  
  const counts = (countsResult as any[])[0] || {};
  const completedSessionsCount = Number(counts.sessions || 0);
  const moodEntriesCount = Number(counts.moods || 0);
  const journalEntriesCount = Number(counts.journals || 0);

  const streakDays = calculateStreak(recentMoods);
  const upcomingSessions = scheduledAppointments.length;
  const primaryContact = latestEmergencyContact;

  const planType = (activeSubscription?.plan_type || 'trial') as keyof typeof PLAN_LIMITS;
  const planDetails = PLAN_LIMITS[planType];

  const result = {
    ...profileResult,
    emergency_contact_name: primaryContact?.name || profileResult.emergency_contact_name,
    emergency_contact_phone: primaryContact?.phone || profileResult.emergency_contact_phone,
    emergency_contact_relationship: primaryContact?.relationship || profileResult.emergency_contact_relationship,
    streak_days: streakDays,
    upcoming_sessions: upcomingSessions,
    stats: {
      completed_sessions: completedSessionsCount,
      total_checkins: moodEntriesCount,
      total_journals: journalEntriesCount,
      streak_days: streakDays
    },
    credits_remaining: (profileResult.credits || 0) + (profileResult.purchased_credits || 0),
    credits_total: (planDetails?.credits || 30) + (profileResult.purchased_credits || 0),
    subscription_plan: planType,
    subscriptions: activeSubscription ? [activeSubscription] : [],
    mood_entries: recentMoods,
    appointments_appointments_user_idToprofiles: scheduledAppointments,
    emergency_contacts: latestEmergencyContact ? [latestEmergencyContact] : []
  };

  // Set cache
  userProfileCache.set(userId, {
    data: result,
    timestamp: Date.now()
  });

  return result;
}

export async function getCredits(userId: string) {
  const profile = await prisma.profiles.findUnique({
    where: { id: userId },
    select: { credits: true, purchased_credits: true }
  });
  return { 
    credits: (profile?.credits || 0) + (profile?.purchased_credits || 0),
    subscription: profile?.credits || 0,
    purchased: profile?.purchased_credits || 0
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
