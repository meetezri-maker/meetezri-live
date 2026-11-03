/**
 * Resource Analytics PDF with the real shaping engine (HarfBuzz WebAssembly, bundled Noto fonts),
 * from synthetic interactions only. The PDF is read back from its content streams.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { createShapingRuntime, FontLoadError, UnsupportedCharactersError, type FontManifest, type ShapingAssets, type ShapingRuntime } from '@/lib/pdf/shaped/shapedPdf';
import { readShapedPdf } from '@/lib/pdf/shaped/readShapedPdf.testing';
import { exportResourceAnalytics, type ResourceInteraction } from '@/app/utils/resourceTracking';
import {
  buildResourceAnalyticsPdfSnapshot,
  computeResourceAnalyticsView,
  RESOURCE_ANALYTICS_FALLBACK_WARNING,
  resourceAnalyticsPdfFileName,
  type ResourceAnalyticsTimeFilter,
} from './resourceAnalyticsReport';
import { buildResourceAnalyticsPdf, RESOURCE_ANALYTICS_DEFINITIONS } from './resourceAnalyticsPdfLayout';

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

const NOW = new Date(2026, 10, 4, 10, 0);
beforeEach(() => vi.useFakeTimers({ toFake: ['Date'], now: NOW }));
afterEach(() => vi.useRealTimers());

const DAY = 86_400_000;
const TYPES = ['view', 'call', 'text', 'visit', 'share', 'copy'] as const;
const ix = (i: number, daysAgo: number, over: Partial<ResourceInteraction> = {}): ResourceInteraction => ({
  id: `srv-${i}`,
  resourceId: `res-${i % 3}`,
  resourceName: ['Crisis Line', 'Text Support', 'Local Group'][i % 3],
  resourceType: (['crisis_line', 'text_line', 'support_group'] as const)[i % 3],
  interactionType: TYPES[i % TYPES.length],
  timestamp: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
  safetyState: ['normal', 'elevated'][i % 2],
  ...over,
});
const boundsFor = (f: ResourceAnalyticsTimeFilter) => ({
  start: f === 'all' ? new Date(0) : new Date(NOW.getTime() - { '7d': 7, '30d': 30, '90d': 90 }[f] * DAY),
  end: NOW,
});
function snapshotOf(interactions: ResourceInteraction[], o: { timeFilter?: ResourceAnalyticsTimeFilter; source?: 'server' | 'browser'; serverRecordCount?: number } = {}) {
  const timeFilter = o.timeFilter ?? '30d';
  const bounds = boundsFor(timeFilter);
  const sorted = [...interactions].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const view = computeResourceAnalyticsView({ interactions: sorted, bounds, timeFilter, chartInterval: 'daily' });
  const snapshot = buildResourceAnalyticsPdfSnapshot({
    view, interactions: sorted, timeFilter, bounds, source: o.source ?? 'server', serverRecordCount: o.serverRecordCount ?? sorted.length,
    localRecordLimit: 500, resourceName: (id) => sorted.find((i) => i.resourceId === id)?.resourceName ?? id, generatedAt: NOW, timeZone: 'Asia/Dhaka',
  });
  return { view, snapshot, sorted, bounds };
}
const textOf = async (bytes: Uint8Array) => (await readShapedPdf(bytes)).map((p) => p.text);

describe('Resource Analytics PDF (shaped, real engine)', () => {
  it('reports the page metrics, breakdowns and period exactly, with branding and a server source label', async () => {
    const data = Array.from({ length: 24 }, (_, i) => ix(i, (i * 5) % 29 + 0.2));
    const { view, snapshot, sorted } = snapshotOf(data);
    const r = await buildResourceAnalyticsPdf(snapshot, runtime, { logoPng: read(path.join(WEB, 'public/logos/logo white.png')) });
    const pages = await textOf(r.bytes);
    const all = pages.flat();
    const joined = all.join('\n');

    for (const line of ['Resource Analytics', 'Period: Last 30 days', '5 Oct 2026, 10:00 – 4 Nov 2026, 10:00', 'Generated: 4 Nov 2026, 10:00 (Asia/Dhaka)',
      'Source: server-confirmed activity only.', 'Dates and times are in Asia/Dhaka.', 'Overview', 'Highlights', 'Support Activity Timeline (Daily)', 'Resources',
      'Activity by resource type', 'Activity by safety state', 'Solace · Personal & confidential', `Page 1 of ${pages.length}`]) expect(all).toContain(line);
    expect(joined).not.toContain(RESOURCE_ANALYTICS_FALLBACK_WARNING);
    expect(joined.replace(/\s+/g, ' ')).toContain(RESOURCE_ANALYTICS_DEFINITIONS);

    // Page values (view) = PDF values = JSON values.
    const json = JSON.parse(exportResourceAnalytics(sorted));
    expect(view.totalInteractions).toBe(json.totalInteractions);
    for (const m of [String(view.totalInteractions), String(view.totalClicks), `${view.avgCtr}%`, String(view.resourcesExplored)]) expect(all).toContain(m);
    for (const res of Object.values(json.analytics) as Array<{ resourceId: string; totalViews: number; totalClicks: number }>) {
      const row = snapshot.resources.find((x) => x.name === sorted.find((i) => i.resourceId === res.resourceId)!.resourceName)!;
      expect([row.views, row.engagements]).toEqual([res.totalViews, res.totalClicks]);
      expect(all).toContain(row.name);
    }
    expect(snapshot.byType.reduce((s, t) => s + t.interactions, 0)).toBe(json.totalInteractions);
    expect(Object.fromEntries(snapshot.bySafetyState.map((s) => [s.state, s.interactions]))).toEqual(json.bySafetyState);
    // Timeline: one row per day of the period, zero days included, summing to the total.
    expect(snapshot.timeline.rows).toHaveLength(view.chartBuckets.length);
    expect(snapshot.timeline.rows.some((row) => row.interactions === 0)).toBe(true);
    expect(snapshot.timeline.rows.reduce((s, row) => s + row.interactions, 0)).toBe(json.totalInteractions);
    expect(all).toContain(snapshot.timeline.rows[0].period);

    const meta = await PDFDocument.load(r.bytes);
    expect(meta.getTitle()).toBe('Resource Analytics');
    expect(meta.getCreator()).toBe('Solace');
    expect(r.fonts.sort()).toEqual(['NotoSans-Bold.ttf', 'NotoSans-Regular.ttf']);
    expect(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.resources[0])).toBe(true);
  });

  it('labels the browser fallback with the incomplete-data warning and the local record limit', async () => {
    const { snapshot } = snapshotOf([ix(0, 1), ix(1, 2)], { source: 'browser' });
    const all = (await textOf((await buildResourceAnalyticsPdf(snapshot, runtime)).bytes)).flat();
    expect(all).toContain("Source: this account's activity saved in this browser only.");
    expect(all.join(' ')).toContain(RESOURCE_ANALYTICS_FALLBACK_WARNING);
    expect(all.join(' ')).toContain("This browser keeps at most 500 of this account's most recent records.");
    expect(all).not.toContain('Source: server-confirmed activity only.');
  });

  it('says when the server record limit was reached', async () => {
    const { snapshot } = snapshotOf([ix(0, 1)], { serverRecordCount: 5000 });
    const all = (await textOf((await buildResourceAnalyticsPdf(snapshot, runtime)).bytes)).flat().join(' ');
    expect(all).toContain('The server returns at most 5,000 records for one report. This period reached that limit');
  });

  it('keeps a successful empty response empty, with genuine zeros', async () => {
    const { snapshot } = snapshotOf([]);
    expect(snapshot.resources).toEqual([]);
    expect(snapshot.metrics.map((m) => m.value)).toEqual(['0', '0', '0%', '0']);
    const all = (await textOf((await buildResourceAnalyticsPdf(snapshot, runtime)).bytes)).flat();
    expect(all).toContain('No activity recorded in this period.');
    expect(all).toContain('Source: server-confirmed activity only.');
    expect(snapshot.timeline.rows.every((r) => r.interactions === 0)).toBe(true);
  });

  it.each([
    ['7d', 'Daily', 8, 'solace-resource-analytics-2026-10-28-to-2026-11-04.pdf'],
    ['30d', 'Daily', 31, 'solace-resource-analytics-2026-10-05-to-2026-11-04.pdf'],
    ['90d', 'Weekly', null, 'solace-resource-analytics-2026-08-06-to-2026-11-04.pdf'],
    ['all', 'Weekly', null, 'solace-resource-analytics-all-time-to-2026-11-04.pdf'],
  ] as const)('reports the %s period (%s timeline) and names the file safely', { timeout: 30000 }, async (timeFilter, interval, rows, fileName) => {
    const days = { '7d': 6, '30d': 29, '90d': 89, all: 400 }[timeFilter];
    const data = [ix(0, 0.5), ix(1, days / 2), ix(2, days)];
    const { snapshot, view, bounds } = snapshotOf(data, { timeFilter });
    expect(snapshot.timeline.interval).toBe(interval);
    if (rows) expect(snapshot.timeline.rows).toHaveLength(rows);
    expect(snapshot.timeline.rows.reduce((s, r) => s + r.interactions, 0)).toBe(3);
    if (timeFilter === 'all') {
      expect(snapshot.periodRange).toBe('All recorded activity up to 4 Nov 2026, 10:00');
      expect(snapshot.timeline.rows[0].interactions).toBeGreaterThan(0); // starts at the first active week
      expect(snapshot.timeline.rows.length).toBeLessThan(view.chartBuckets.length);
    }
    expect(resourceAnalyticsPdfFileName(timeFilter, bounds)).toBe(fileName);
    const all = (await textOf((await buildResourceAnalyticsPdf(snapshot, runtime)).bytes)).flat();
    expect(all).toContain(`Period: ${snapshot.periodLabel}`);
    expect(all).toContain(`Support Activity Timeline (${interval})`);
  });

  it('draws multilingual resource names with shaping, keeps direction isolates and marks emoji', async () => {
    const names = ['সহায়তা গোষ্ঠী', 'صديق ⁨Solace 2.0⁩ موثوق', 'いのちの電話', 'Helpline 💜'];
    const data = names.map((name, i) => ix(i, i + 1, { resourceId: `ml-${i}`, resourceName: name }));
    const { snapshot } = snapshotOf(data);
    fontCalls.length = 0;
    const r = await buildResourceAnalyticsPdf(snapshot, runtime, { locale: 'en-US' });
    const all = (await textOf(r.bytes)).flat();
    for (const name of names.slice(0, 3)) expect(all).toContain(name);
    expect(all).toContain('Helpline [emoji]');
    expect(r.emojiReplacedCount).toBeGreaterThan(0);
    expect(all.join(' ')).toContain("Emoji can't be shown in this PDF; each appears as [emoji].");
    expect(r.fonts).toEqual(expect.arrayContaining(['NotoSansBengali-Regular.ttf', 'NotoNaskhArabic-Regular.ttf', 'NotoSansJP-Regular.ttf']));
    expect(fontCalls).not.toContain('NotoSansSC-Regular.ttf');
  });

  it('paginates long content with repeated table headers and a running header', async () => {
    const data = Array.from({ length: 360 }, (_, i) => ix(i, (i % 88) + 0.3, { resourceId: `long-${i % 120}`, resourceName: `Community resource number ${i % 120} with a longer descriptive name` }));
    const { snapshot } = snapshotOf(data, { timeFilter: '90d' });
    const r = await buildResourceAnalyticsPdf(snapshot, runtime);
    const pages = await textOf(r.bytes);
    expect(pages.length).toBeGreaterThan(3);
    expect(r.pages).toBe(pages.length);
    pages.slice(1).forEach((p, i) => {
      expect(p).toContain('Resource Analytics  ·  Last 90 days');
      expect(p).toContain(`Page ${i + 2} of ${pages.length}`);
    });
    // Every resource appears (twice: ranking and engagement breakdown); the header repeats.
    const all = pages.flat();
    const flowed = all.join(' ').replace(/\s+/g, ' ');
    for (let k = 0; k < 120; k++) expect(flowed.split(`Community resource number ${k} with a longer descriptive name`).length - 1).toBeGreaterThanOrEqual(2);
    const rankingPages = pages.filter((p) => p.some((l) => l.startsWith('Community resource number')) && p.includes('Last used'));
    expect(rankingPages.length).toBeGreaterThan(1);
    for (const p of rankingPages) for (const label of ['#', 'Resource', 'Type', 'Views', 'Engagements', 'Last used']) expect(p).toContain(label);
  });

  it('rejects text no bundled font covers before downloading any font', async () => {
    const { snapshot } = snapshotOf([ix(0, 1, { resourceName: 'ߒߞߏ support' })]);
    fontCalls.length = 0;
    await expect(buildResourceAnalyticsPdf(snapshot, runtime)).rejects.toBeInstanceOf(UnsupportedCharactersError);
    expect(fontCalls).toEqual([]);
  });

  it('fails with FontLoadError when fonts cannot be downloaded', async () => {
    const broken = await createShapingRuntime(assets({ font: async () => { throw new Error('HTTP 503'); } }).assets);
    await expect(buildResourceAnalyticsPdf(snapshotOf([ix(0, 1)]).snapshot, broken)).rejects.toBeInstanceOf(FontLoadError);
  });
});
