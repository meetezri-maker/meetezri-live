/**
 * Account data export (GET /users/export) — read-only, explicit allowlist.
 *
 * Contains the signed-in user's account and profile answers, privacy and notification settings,
 * emergency contacts and current membership. It deliberately does NOT contain activity or
 * conversation history (journals, moods, sessions, goals, etc.).
 *
 * Every value is copied field-by-field from an explicit `select`; no row or cached profile
 * object is spread, so a new column can never appear here by accident. Nothing is written,
 * no profile repair runs and Stripe is never contacted (unlike `getProfile`).
 */
import prisma from '../../lib/prisma';
import { DEFAULT_MEMBERSHIP, INTERNAL_PLAN_TO_MEMBERSHIP } from '../entitlements/entitlements.config';
import { isDobShapedSignupAge } from './user.schema';

export const ACCOUNT_DATA_EXPORT_VERSION = 1;

/** Keys the app writes to `profiles.privacy_settings` (Privacy Settings page). */
export const PRIVACY_SETTING_KEYS = [
  'profileVisibility',
  'allowAnalytics',
  'shareProgress',
  'allowCookies',
  'marketingEmails',
  'thirdPartySharing',
  'communityEnabled',
  'showDisplayNameInCommunity',
  'showAvatarInCommunity',
  'trustedContactEnabled',
] as const;

/** Keys the app writes to `profiles.notification_preferences` (settings, onboarding, quiet mode). */
export const NOTIFICATION_PREFERENCE_KEYS = [
  'pushEnabled',
  'emailEnabled',
  'smsEnabled',
  'quietMode',
  'quietHoursEnabled',
  'quietStart',
  'quietEnd',
  'dailyCheckIn',
  'sessionReminders',
  'moodCheckIns',
  'journalPrompts',
  'wellnessTips',
  'weeklyProgress',
  'communityActivity',
  'achievementUnlocked',
  'progressMilestones',
  'crisisAlerts',
] as const;

type Scalar = string | number | boolean | null;

const MEMBERSHIP_NAMES: Record<string, string> = {
  DISCOVER: 'Discover',
  GROW: 'Grow',
  THRIVE: 'Thrive',
};

/** Same statuses `getProfile` treats as the current subscription. */
const CURRENT_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due'];

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/** Only scalar values stored under allowlisted keys; anything else (absent, objects) is null. */
function pickScalars<K extends string>(source: unknown, keys: readonly K[]): Record<K, Scalar> {
  const obj =
    source && typeof source === 'object' && !Array.isArray(source)
      ? (source as Record<string, unknown>)
      : {};
  const out = {} as Record<K, Scalar>;
  for (const key of keys) {
    const v = obj[key];
    out[key] =
      typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : null;
  }
  return out;
}

export interface AccountDataExport {
  exportVersion: number;
  generatedAt: string;
  profile: {
    account: { fullName: string | null; email: string | null; createdAt: string | null };
    profile: {
      /** `profiles.age` holds either a signup DOB (YYYY-MM-DD) or a legacy age as entered. */
      dateOfBirth: string | null;
      ageAsEntered: string | null;
      pronouns: string | null;
      timezone: string | null;
      phone: string | null;
      bio: string | null;
      currentMood: string | null;
      crisisResourcesCountry: string | null;
    };
    wellnessPreferences: {
      goals: string[];
      challenges: string[];
      inTherapy: string | null;
      onMedication: string | null;
      companionAvatar: string | null;
      companionEnvironment: string | null;
      companionVoice: string | null;
    };
    privacySettings: Record<(typeof PRIVACY_SETTING_KEYS)[number], Scalar>;
    notificationPreferences: Record<(typeof NOTIFICATION_PREFERENCE_KEYS)[number], Scalar>;
    emergencyContacts: {
      consentToContact: boolean;
      contacts: Array<{
        name: string | null;
        relationship: string | null;
        phone: string | null;
        email: string | null;
        trustedContact: boolean | null;
      }>;
    };
    membership: {
      name: string;
      status: string | null;
      billingCycle: string | null;
      nextBillingDate: string | null;
    };
  };
}

/** Returns null when the user has no profile row. Every query is scoped to `userId`. */
export async function buildAccountDataExport(
  userId: string,
  now: Date = new Date()
): Promise<AccountDataExport | null> {
  const [profile, contacts, subscription, authUser] = await Promise.all([
    prisma.profiles.findUnique({
      where: { id: userId },
      select: {
        full_name: true,
        email: true,
        created_at: true,
        age: true,
        pronouns: true,
        timezone: true,
        phone: true,
        bio: true,
        current_mood: true,
        crisis_country_code: true,
        selected_goals: true,
        selected_triggers: true,
        in_therapy: true,
        on_medication: true,
        selected_avatar: true,
        selected_environment: true,
        selected_voice: true,
        privacy_settings: true,
        notification_preferences: true,
        emergency_consent: true,
        emergency_contact_name: true,
        emergency_contact_phone: true,
        emergency_contact_relationship: true,
      },
    }),
    prisma.emergency_contacts.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'asc' },
      select: { name: true, relationship: true, phone: true, email: true, is_trusted: true },
    }),
    prisma.subscriptions.findFirst({
      where: { user_id: userId, status: { in: CURRENT_SUBSCRIPTION_STATUSES } },
      orderBy: { created_at: 'desc' },
      select: { plan_type: true, status: true, billing_cycle: true, next_billing_at: true },
    }),
    prisma.users.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);

  if (!profile) return null;

  const storedAge = profile.age?.trim() || null;
  const ageIsDob = storedAge !== null && isDobShapedSignupAge(storedAge);

  // Older accounts kept their one contact on the profile row; show it when no list rows exist.
  const contactRows =
    contacts.length > 0
      ? contacts.map((c) => ({
          name: c.name,
          relationship: c.relationship,
          phone: c.phone,
          email: c.email,
          trustedContact: c.is_trusted,
        }))
      : profile.emergency_contact_name || profile.emergency_contact_phone
        ? [
            {
              name: profile.emergency_contact_name,
              relationship: profile.emergency_contact_relationship,
              phone: profile.emergency_contact_phone,
              email: null,
              trustedContact: null,
            },
          ]
        : [];

  // Same rule the app uses: no current subscription means the default (Discover) membership.
  const tier =
    INTERNAL_PLAN_TO_MEMBERSHIP[subscription?.plan_type ?? 'trial'] ?? DEFAULT_MEMBERSHIP;

  return {
    exportVersion: ACCOUNT_DATA_EXPORT_VERSION,
    generatedAt: now.toISOString(),
    profile: {
      account: {
        fullName: profile.full_name,
        email: profile.email ?? authUser?.email ?? null,
        createdAt: iso(profile.created_at),
      },
      profile: {
        dateOfBirth: ageIsDob ? storedAge : null,
        ageAsEntered: ageIsDob ? null : storedAge,
        pronouns: profile.pronouns,
        timezone: profile.timezone,
        phone: profile.phone,
        bio: profile.bio,
        currentMood: profile.current_mood,
        crisisResourcesCountry: profile.crisis_country_code,
      },
      wellnessPreferences: {
        goals: profile.selected_goals ?? [],
        challenges: profile.selected_triggers ?? [],
        inTherapy: profile.in_therapy,
        onMedication: profile.on_medication,
        companionAvatar: profile.selected_avatar,
        companionEnvironment: profile.selected_environment,
        companionVoice: profile.selected_voice,
      },
      privacySettings: pickScalars(profile.privacy_settings, PRIVACY_SETTING_KEYS),
      notificationPreferences: pickScalars(
        profile.notification_preferences,
        NOTIFICATION_PREFERENCE_KEYS
      ),
      emergencyContacts: {
        consentToContact: profile.emergency_consent,
        contacts: contactRows,
      },
      membership: {
        name: MEMBERSHIP_NAMES[tier] ?? tier,
        status: subscription?.status ?? null,
        billingCycle: subscription?.billing_cycle ?? null,
        nextBillingDate: iso(subscription?.next_billing_at),
      },
    },
  };
}
