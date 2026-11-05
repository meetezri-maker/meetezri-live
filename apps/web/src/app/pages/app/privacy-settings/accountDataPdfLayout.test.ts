/**
 * Account Data Report PDF with the real shaping engine (HarfBuzz WebAssembly, bundled Noto fonts),
 * from synthetic exports only. The PDF is read back from its content streams.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { createShapingRuntime, FontLoadError, UnsupportedCharactersError, type FontManifest, type ShapingAssets, type ShapingRuntime } from '@/lib/pdf/shaped/shapedPdf';
import { readShapedPdf } from '@/lib/pdf/shaped/readShapedPdf.testing';
import { ACCOUNT_DATA_EXPORT_CONTENTS, ACCOUNT_DATA_EXPORT_EXCLUSIONS, accountDataExportRows, buildAccountDataExportCsv } from './accountDataExportCsv';
import { accountDataDisplayValue, buildAccountDataPdfSnapshot } from './accountDataPdfSnapshot';
import { ACCOUNT_DATA_LEGEND, ACCOUNT_DATA_SNAPSHOT_NOTE, buildAccountDataPdf } from './accountDataPdfLayout';

const WEB = process.cwd();
const FONT_DIR = path.join(WEB, 'public/fonts/pdf/noto/v1');
const read = (p: string) => new Uint8Array(fs.readFileSync(p));
function assets(overrides: Partial<ShapingAssets> = {}) {
  const fontCalls: string[] = [];
  const a: ShapingAssets = {
    hbWasm: async () => read(path.join(WEB, 'node_modules/harfbuzzjs/hb.wasm')),
    subsetWasm: async () => read(path.join(WEB, 'node_modules/harfbuzzjs/hb-subset.wasm')),
    manifest: async () => JSON.parse(fs.readFileSync(path.join(FONT_DIR, 'manifest.json'), 'utf8')) as FontManifest,
    font: async (file) => { fontCalls.push(file); return read(path.join(FONT_DIR, file)); },
    ...overrides,
  };
  return { assets: a, fontCalls };
}
let runtime: ShapingRuntime;
let fontCalls: string[];
beforeAll(async () => {
  const a = assets();
  fontCalls = a.fontCalls;
  runtime = await createShapingRuntime(a.assets);
});

const URDU = 'آج میں نے بہت سکون محسوس کیا';
const BENGALI = 'আমি আজ ভালো আছি — ক্ষ পে';
type Payload = ReturnType<typeof populated>;
const populated = () => ({
  exportVersion: 1,
  generatedAt: '2026-11-05T09:30:00.000Z',
  unexpectedTopLevel: 'must-not-appear',
  profile: {
    account: { fullName: 'Ayesha Khan', email: 'ayesha@example.test', createdAt: '2026-01-02T03:04:05.000Z', stripe_customer_id: 'cus_TEST123' },
    profile: {
      dateOfBirth: '1995-04-12', ageAsEntered: null, pronouns: 'she/her', timezone: 'Asia/Karachi', phone: '+92 300 0000000',
      bio: '=HYPERLINK("https://evil.example","x")', currentMood: 'calm', crisisResourcesCountry: 'PK', role: 'super_admin',
    },
    wellnessPreferences: { goals: ['sleep better', 'reduce stress, at work'], challenges: [], inTherapy: 'no', onMedication: null, companionAvatar: 'maya', companionEnvironment: 'forest', companionVoice: '' },
    privacySettings: { profileVisibility: 'private', allowAnalytics: false, shareProgress: null, allowCookies: true, marketingEmails: 0, secretToken: 'tok_abc' },
    notificationPreferences: { pushEnabled: false, quietStart: '22:00', weeklyProgress: 0, dailyCheckIn: true },
    emergencyContacts: { consentToContact: false, contacts: [{ name: 'Sara', relationship: 'sister', phone: '-5', email: null, trustedContact: false, id: 'ec-1' }] },
    membership: { name: 'Thrive', status: 'active', billingCycle: 'monthly', nextBillingDate: '2026-11-02T00:00:00.000Z', stripe_sub_id: 'sub_TEST456' },
    credits: { credits_seconds: 600 },
  },
});
const minimal = () => ({
  exportVersion: 1,
  generatedAt: '2026-11-05T09:30:00.000Z',
  profile: { account: {}, profile: {}, wellnessPreferences: {}, privacySettings: {}, notificationPreferences: {}, emergencyContacts: {}, membership: {} },
});
const build = async (payload: unknown, tz = 'Asia/Karachi') => {
  const snapshot = buildAccountDataPdfSnapshot(accountDataExportRows(payload), tz);
  const r = await buildAccountDataPdf(snapshot, runtime, { logoPng: read(path.join(WEB, 'public/logos/logo white.png')) });
  const pages = (await readShapedPdf(r.bytes)).map((p) => p.text);
  return { r, snapshot, pages, all: pages.flat(), flowed: pages.flat().join(' ').replace(/\s+/g, ' ') };
};

describe('Account Data Report PDF (shaped, real engine)', () => {
  it('reports every allowlisted field in CSV order with the CSV values, plus branding and scope', async () => {
    const payload = populated();
    const { r, pages, all, flowed, snapshot } = await build(payload);
    for (const line of ['Account Data Report', 'Solace · Personal & confidential', `Page 1 of ${pages.length}`]) expect(all).toContain(line);
    expect(flowed).toContain(`Generated: ${snapshot.generatedAt} (Asia/Karachi)`);
    expect(flowed).toContain(ACCOUNT_DATA_SNAPSHOT_NOTE);
    expect(flowed).toContain(`This report contains: ${ACCOUNT_DATA_EXPORT_CONTENTS} ${ACCOUNT_DATA_EXPORT_EXCLUSIONS}`);
    expect(flowed).toContain(ACCOUNT_DATA_LEGEND);
    expect(flowed).not.toMatch(/all your data|complete archive/i);

    // Parity: every CSV row (except the "Export" header rows) is a PDF row, in the same order.
    const rows = accountDataExportRows(payload).filter((row) => row.section !== 'Export');
    const csvLines = buildAccountDataExportCsv(payload).split('\r\n').slice(3, -1);
    expect(csvLines).toHaveLength(rows.length);
    let from = 0;
    for (const row of rows) {
      const at = all.indexOf(row.label, from);
      expect(at, row.label).toBeGreaterThanOrEqual(from);
      from = at;
      for (const line of accountDataDisplayValue(row.value).split('\n')) expect(all).toContain(line);
    }
    // Sections in CSV order.
    const order = ['Account', 'Profile', 'Wellness preferences', 'Privacy settings', 'Notification preferences', 'Emergency contacts', 'Membership'];
    expect(snapshot.sections.map((s) => s.title)).toEqual(order);
    let last = -1;
    for (const title of order) { const at = all.indexOf(title); expect(at).toBeGreaterThan(last); last = at; }

    // Original values: formulas as entered (the CSV keeps its apostrophe), false, 0, lists, missing.
    expect(all).toContain('=HYPERLINK("https://evil.example","x")');
    expect(buildAccountDataExportCsv(payload)).toContain(`"'=HYPERLINK(""https://evil.example"",""x"")"`);
    const value = (label: string) => snapshot.sections.flatMap((s) => s.rows).find((row) => row.label === label)?.value;
    expect([value('Allow analytics'), value('Marketing emails'), value('Weekly progress'), value('Contact 1 – Trusted contact')]).toEqual(['false', '0', '0', 'false']);
    expect(value('Goals')).toBe('sleep better\nreduce stress, at work');
    expect(all).toEqual(expect.arrayContaining(['sleep better', 'reduce stress, at work']));
    expect([value('Challenges'), value('Age (as entered)'), value('Companion voice'), value('Share progress')]).toEqual(['None', 'Not provided', 'Not provided', 'Not provided']);
    expect(value('Contact 1 – Phone')).toBe('-5');
    expect(value('Contacts saved')).toBe('1');

    // Nothing outside the allowlist.
    for (const forbidden of ['cus_TEST123', 'sub_TEST456', 'tok_abc', 'super_admin', 'ec-1', 'must-not-appear', 'credits']) expect(flowed).not.toContain(forbidden);

    const meta = await PDFDocument.load(r.bytes);
    expect(meta.getTitle()).toBe('Account Data Report');
    expect(meta.getCreator()).toBe('Solace');
    expect(r.fonts.sort()).toEqual(['NotoSans-Bold.ttf', 'NotoSans-Regular.ttf']);
    expect(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.sections[0].rows[0])).toBe(true);
  });

  it('marks every field of a minimal export as not provided, with no contacts', async () => {
    const { snapshot, all } = await build(minimal());
    const rows = snapshot.sections.flatMap((s) => s.rows);
    expect(rows.find((r) => r.label === 'Contacts saved')?.value).toBe('0');
    expect(rows.filter((r) => r.label !== 'Contacts saved').every((r) => r.value === 'Not provided' || r.value === 'None')).toBe(true);
    expect(rows.some((r) => r.label.startsWith('Contact 1'))).toBe(false);
    expect(all).toContain('Not provided');
  });

  it('continues a very long value across pages without losing text', async () => {
    const payload: Payload = populated();
    payload.profile.profile.bio = Array.from({ length: 90 }, (_, i) => `Paragraph ${i}: ${'steady words '.repeat(14)}end`).join('\n');
    const { pages, flowed } = await build(payload);
    expect(pages.length).toBeGreaterThan(2);
    for (let i = 0; i < 90; i++) expect(flowed).toContain(`Paragraph ${i}: `);
    expect(pages.flat()).toContain('About me (continued)');
    pages.slice(1).forEach((p, i) => {
      expect(p.some((l) => l.startsWith('Account Data Report  ·  Generated'))).toBe(true);
      expect(p).toContain(`Page ${i + 2} of ${pages.length}`);
    });
  });

  it('draws Bengali, Urdu and mixed-script values with shaping, keeps direction controls and marks emoji', async () => {
    const payload: Payload = populated();
    payload.profile.account.fullName = 'আয়েশা খান';
    payload.profile.profile.bio = `${URDU} — ${BENGALI} ⁨Solace 2.0⁩ 💜`;
    payload.profile.emergencyContacts.contacts[0].name = 'سارہ ⁧علی⁩';
    fontCalls.length = 0;
    const { r, all, flowed } = await build(payload);
    expect(all).toContain('আয়েশা খান');
    expect(all).toContain('سارہ ⁧علی⁩');
    expect(flowed).toContain(`${URDU} — ${BENGALI} ⁨Solace 2.0⁩ [emoji]`);
    expect(r.emojiReplacedCount).toBe(1);
    expect(flowed).toContain("Emoji can't be shown in this PDF; each appears as [emoji].");
    expect(r.fonts).toEqual(expect.arrayContaining(['NotoSansBengali-Regular.ttf', 'NotoNaskhArabic-Regular.ttf']));
    expect(fontCalls.some((f) => /SC|JP|KR|TC/.test(f))).toBe(false);
  });

  it('keeps every section heading on the same page as its first field', async () => {
    const payload: Payload = populated();
    payload.profile.account.fullName = 'আয়েশা খান';
    payload.profile.profile.bio = `${URDU} — ${BENGALI} ⁨Solace 2.0⁩ 💜\nमैं ठीक हूँ। ধন্যবাদ`;
    payload.profile.wellnessPreferences.goals = ['ঘুম ভালো করা', 'کم پریشانی', 'sleep better'];
    const { pages, snapshot } = await build(payload);
    for (const sec of snapshot.sections) {
      const page = pages.find((p) => p.includes(sec.title) && p.includes('Field'))!;
      expect(page, sec.title).toBeDefined();
      expect(page.indexOf(sec.rows[0].label, page.indexOf(sec.title) + 1), sec.title).toBeGreaterThan(page.indexOf(sec.title));
    }
  });

  it('rejects text no bundled font covers before downloading any font', async () => {
    const payload: Payload = populated();
    payload.profile.profile.pronouns = 'ߒߞߏ';
    fontCalls.length = 0;
    await expect(build(payload)).rejects.toBeInstanceOf(UnsupportedCharactersError);
    expect(fontCalls).toEqual([]);
  });

  it('fails with FontLoadError when fonts cannot be downloaded', async () => {
    const broken = await createShapingRuntime(assets({ font: async () => { throw new Error('HTTP 503'); } }).assets);
    const snapshot = buildAccountDataPdfSnapshot(accountDataExportRows(populated()), 'UTC');
    await expect(buildAccountDataPdf(snapshot, broken)).rejects.toBeInstanceOf(FontLoadError);
  });
});
