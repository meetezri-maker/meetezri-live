/**
 * CSV layout for the Privacy Settings "Export your data" download (GET /users/export).
 *
 * Rows are produced only from the fields listed below, in this order, so anything else the
 * server might send is never written. Missing values are left blank; false and 0 are kept.
 */
import { buildCsv, type CsvValue } from '@/lib/csv';

/** What the download contains — written into the file; the card text says the same. */
export const ACCOUNT_DATA_EXPORT_CONTENTS =
  'Account details, profile answers, wellness preferences, privacy and notification settings, emergency contacts and membership.';

export const ACCOUNT_DATA_EXPORT_CARD_TEXT =
  'Download a CSV of your account details, profile answers, wellness preferences, privacy and notification settings, emergency contacts and membership. It does not include journals, mood check-ins or conversation history.';

type Fields = Record<string, unknown>;

interface AccountDataExportPayload {
  generatedAt?: unknown;
  profile: {
    account: Fields;
    profile: Fields;
    wellnessPreferences: Fields;
    privacySettings: Fields;
    notificationPreferences: Fields;
    emergencyContacts: { consentToContact?: unknown; contacts?: unknown };
    membership: Fields;
  };
}

const SECTIONS: Array<{
  key: Exclude<keyof AccountDataExportPayload['profile'], 'emergencyContacts'>;
  title: string;
  fields: Array<[field: string, label: string]>;
}> = [
  {
    key: 'account',
    title: 'Account',
    fields: [
      ['fullName', 'Full name'],
      ['email', 'Email'],
      ['createdAt', 'Account created'],
    ],
  },
  {
    key: 'profile',
    title: 'Profile',
    fields: [
      ['dateOfBirth', 'Date of birth'],
      ['ageAsEntered', 'Age (as entered)'],
      ['pronouns', 'Pronouns'],
      ['timezone', 'Time zone'],
      ['phone', 'Phone'],
      ['bio', 'About me'],
      ['currentMood', 'Current mood'],
      ['crisisResourcesCountry', 'Crisis resources country'],
    ],
  },
  {
    key: 'wellnessPreferences',
    title: 'Wellness preferences',
    fields: [
      ['goals', 'Goals'],
      ['challenges', 'Challenges'],
      ['inTherapy', 'Currently in therapy'],
      ['onMedication', 'Currently on medication'],
      ['companionAvatar', 'Companion avatar'],
      ['companionEnvironment', 'Companion environment'],
      ['companionVoice', 'Companion voice'],
    ],
  },
  {
    key: 'privacySettings',
    title: 'Privacy settings',
    fields: [
      ['profileVisibility', 'Profile visibility'],
      ['allowAnalytics', 'Allow analytics'],
      ['shareProgress', 'Share progress'],
      ['allowCookies', 'Allow cookies'],
      ['marketingEmails', 'Marketing emails'],
      ['thirdPartySharing', 'Third-party sharing'],
      ['communityEnabled', 'Community enabled'],
      ['showDisplayNameInCommunity', 'Show display name in community'],
      ['showAvatarInCommunity', 'Show avatar in community'],
      ['trustedContactEnabled', 'Trusted contact enabled'],
    ],
  },
  {
    key: 'notificationPreferences',
    title: 'Notification preferences',
    fields: [
      ['pushEnabled', 'Push notifications'],
      ['emailEnabled', 'Email notifications'],
      ['smsEnabled', 'SMS notifications'],
      ['quietMode', 'Quiet mode'],
      ['quietHoursEnabled', 'Quiet hours'],
      ['quietStart', 'Quiet hours start'],
      ['quietEnd', 'Quiet hours end'],
      ['dailyCheckIn', 'Daily check-in reminders'],
      ['sessionReminders', 'Session reminders'],
      ['moodCheckIns', 'Mood check-in reminders'],
      ['journalPrompts', 'Journal prompts'],
      ['wellnessTips', 'Wellness tips'],
      ['weeklyProgress', 'Weekly progress'],
      ['communityActivity', 'Community activity'],
      ['achievementUnlocked', 'Achievement unlocked'],
      ['progressMilestones', 'Progress milestones'],
      ['crisisAlerts', 'Crisis alerts'],
    ],
  },
  {
    key: 'membership',
    title: 'Membership',
    fields: [
      ['name', 'Membership'],
      ['status', 'Status'],
      ['billingCycle', 'Billing cycle'],
      ['nextBillingDate', 'Next billing date'],
    ],
  },
];

const CONTACT_FIELDS: Array<[field: string, label: string]> = [
  ['name', 'Name'],
  ['relationship', 'Relationship'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['trustedContact', 'Trusted contact'],
];

function cell(value: unknown): CsvValue {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string').join('; ');
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return null;
}

function isObject(value: unknown): value is Fields {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isExportPayload(value: unknown): value is AccountDataExportPayload {
  if (!isObject(value) || !isObject(value.profile)) return false;
  const p = value.profile;
  return SECTIONS.every((s) => isObject(p[s.key])) && isObject(p.emergencyContacts);
}

/** Builds the CSV text; throws if the response is not the expected export shape. */
export function buildAccountDataExportCsv(payload: unknown): string {
  if (!isExportPayload(payload)) {
    throw new Error('Unexpected data export format');
  }
  const p = payload.profile;
  const rows: CsvValue[][] = [['Section', 'Field', 'Value']];

  rows.push(['Export', 'Generated', cell(payload.generatedAt)]);
  rows.push(['Export', 'Contents', ACCOUNT_DATA_EXPORT_CONTENTS]);

  for (const section of SECTIONS) {
    // Emergency contacts are a list, so they are written separately, just before Membership.
    if (section.key === 'membership') pushEmergencyContacts(rows, p.emergencyContacts);
    for (const [field, label] of section.fields) {
      rows.push([section.title, label, cell(p[section.key][field])]);
    }
  }

  return buildCsv(rows);
}

function pushEmergencyContacts(
  rows: CsvValue[][],
  emergency: AccountDataExportPayload['profile']['emergencyContacts']
): void {
  const title = 'Emergency contacts';
  const contacts = Array.isArray(emergency.contacts) ? emergency.contacts.filter(isObject) : [];
  rows.push([title, 'Consent to contact in an emergency', cell(emergency.consentToContact)]);
  rows.push([title, 'Contacts saved', contacts.length]);
  contacts.forEach((contact, i) => {
    for (const [field, label] of CONTACT_FIELDS) {
      rows.push([title, `Contact ${i + 1} – ${label}`, cell(contact[field])]);
    }
  });
}

/** `solace-account-data-YYYY-MM-DD.csv` in the user's local calendar. */
export function accountDataExportFileName(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `solace-account-data-${y}-${m}-${d}.csv`;
}
