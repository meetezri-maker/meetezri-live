import { describe, it, expect } from 'vitest';
import {
  ACCOUNT_DATA_EXPORT_CARD_TEXT,
  accountDataExportFileName,
  buildAccountDataExportCsv,
} from './accountDataExportCsv';

const URDU = 'آج میں نے بہت سکون محسوس کیا';

/** Minimal RFC 4180 reader, enough to prove the file round-trips. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' && text[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const exportPayload =(over: Record<string, unknown> = {}) => ({
  exportVersion: 1,
  generatedAt: '2026-10-27T09:30:00.000Z',
  unexpectedTopLevel: 'must-not-appear',
  profile: {
    account: { fullName: 'Ayesha "AK" Khan', email: 'ayesha@example.test', createdAt: '2026-01-02T03:04:05.000Z', stripe_customer_id: 'cus_TEST123' },
    profile: {
      dateOfBirth: '1995-04-12', ageAsEntered: null, pronouns: 'she/her', timezone: 'Asia/Karachi', phone: '+92 300 0000000',
      bio: `=HYPERLINK("https://evil.example","x")\nLine 2, ${URDU}`, currentMood: 'calm', crisisResourcesCountry: 'PK', role: 'super_admin',
    },
    wellnessPreferences: {
      goals: ['sleep better', 'reduce stress, at work'], challenges: [], inTherapy: 'no', onMedication: null,
      companionAvatar: 'maya', companionEnvironment: 'forest', companionVoice: null,
    },
    privacySettings: { profileVisibility: 'private', allowAnalytics: false, shareProgress: null, secretToken: 'tok_abc' },
    notificationPreferences: { pushEnabled: false, quietStart: '22:00' },
    emergencyContacts: {
      consentToContact: false,
      contacts: [{ name: 'Sara', relationship: 'sister', phone: '+92 300 2222222', email: null, trustedContact: false, id: 'ec-1' }],
    },
    membership: { name: 'Thrive', status: 'active', billingCycle: 'monthly', nextBillingDate: '2026-11-02T00:00:00.000Z', stripe_sub_id: 'sub_TEST456' },
    credits: { credits_seconds: 600 },
  },
  ...over,
});

function rowsOf(csv: string) {
  expect(csv.startsWith('﻿')).toBe(true);
  const rows = parseCsv(csv.slice(1));
  const value = (section: string, field: string) =>
    rows.find((r) => r[0] === section && r[1] === field)?.[2];
  return { rows, value };
}

describe('buildAccountDataExportCsv', () => {
  it('writes labelled Section/Field/Value rows that parse back to the source values', () => {
    const csv = buildAccountDataExportCsv(exportPayload());
    const { rows, value } = rowsOf(csv);

    expect(rows[0]).toEqual(['Section', 'Field', 'Value']);
    expect(rows.every((r) => r.length === 3)).toBe(true);
    expect(value('Account', 'Full name')).toBe('Ayesha "AK" Khan');
    expect(value('Profile', 'Date of birth')).toBe('1995-04-12');
    expect(value('Profile', 'Age (as entered)')).toBe('');
    expect(value('Profile', 'About me')).toBe(`'=HYPERLINK("https://evil.example","x")\nLine 2, ${URDU}`);
    expect(value('Profile', 'Phone')).toBe("'+92 300 0000000");
    expect(value('Wellness preferences', 'Goals')).toBe('sleep better; reduce stress, at work');
    expect(value('Wellness preferences', 'Challenges')).toBe('');
    expect(value('Privacy settings', 'Allow analytics')).toBe('false');
    expect(value('Privacy settings', 'Share progress')).toBe('');
    expect(value('Notification preferences', 'Push notifications')).toBe('false');
    expect(value('Emergency contacts', 'Consent to contact in an emergency')).toBe('false');
    expect(value('Emergency contacts', 'Contacts saved')).toBe('1');
    expect(value('Emergency contacts', 'Contact 1 – Name')).toBe('Sara');
    expect(value('Emergency contacts', 'Contact 1 – Trusted contact')).toBe('false');
    expect(value('Membership', 'Membership')).toBe('Thrive');
  });

  it('uses CRLF line endings outside quoted values', () => {
    const csv = buildAccountDataExportCsv(exportPayload());
    expect(csv.endsWith('\r\n')).toBe(true);
    const unquoted = csv.replace(/"(?:[^"]|"")*"/g, '');
    expect(unquoted).not.toMatch(/[^\r]\n/);
  });

  it('never writes fields outside the documented layout', () => {
    const csv = buildAccountDataExportCsv(exportPayload());
    for (const forbidden of ['cus_TEST123', 'sub_TEST456', 'tok_abc', 'super_admin', 'ec-1', 'must-not-appear', 'credits_seconds']) {
      expect(csv).not.toContain(forbidden);
    }
  });

  it('handles no contacts', () => {
    const payload = exportPayload();
    payload.profile.emergencyContacts = { consentToContact: false, contacts: [] };
    const { rows, value } = rowsOf(buildAccountDataExportCsv(payload));
    expect(value('Emergency contacts', 'Contacts saved')).toBe('0');
    expect(rows.some((r) => r[1].startsWith('Contact 1'))).toBe(false);
  });

  it('rejects an unexpected response instead of dumping it', () => {
    expect(() => buildAccountDataExportCsv({ profile: { id: 'x', stripe_customer_id: 'cus_1' } })).toThrow(
      'Unexpected data export format'
    );
  });

  it('describes only the exported categories on the card', () => {
    const csv = buildAccountDataExportCsv(exportPayload());
    const sections = new Set(rowsOf(csv).rows.slice(1).map((r) => r[0]));
    expect([...sections]).toEqual([
      'Export', 'Account', 'Profile', 'Wellness preferences', 'Privacy settings',
      'Notification preferences', 'Emergency contacts', 'Membership',
    ]);
    for (const phrase of ['account details', 'profile answers', 'wellness preferences', 'privacy and notification settings', 'emergency contacts', 'membership']) {
      expect(ACCOUNT_DATA_EXPORT_CARD_TEXT).toContain(phrase);
    }
    expect(ACCOUNT_DATA_EXPORT_CARD_TEXT).toMatch(/does not include journals, mood check-ins or conversation history/);
  });

  it('names the file solace-account-data-YYYY-MM-DD.csv', () => {
    expect(accountDataExportFileName(new Date(2026, 9, 27, 23, 59))).toBe('solace-account-data-2026-10-27.csv');
  });
});
