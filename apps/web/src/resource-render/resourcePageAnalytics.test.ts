import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackGa4PageView } from '@/app/analytics/ga4';
import {
  resetFastifyResourceAnalyticsForTests,
  trackFastifyResourcePageView,
  type ResourceAnalyticsLocation,
} from './resourcePageAnalytics';

vi.mock('@/app/analytics/ga4', () => ({
  trackGa4PageView: vi.fn(),
}));

const PRODUCTION_HOST = 'www.talktosolace2.ai';

function resourceLocation(
  pathname: string,
  {
    search = '',
    hash = '',
    hostname = PRODUCTION_HOST,
  }: { search?: string; hash?: string; hostname?: string } = {},
): ResourceAnalyticsLocation {
  return {
    pathname,
    search,
    hash,
    hostname,
    origin: `https://${hostname}`,
  };
}

describe('Fastify Resource page analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-Z86N4XSSD0');
    vi.stubEnv('VITE_META_PIXEL_ID', '812695911865710');
    resetFastifyResourceAnalyticsForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('tracks the Resource listing once under production browser conditions', () => {
    const runtime = {
      location: resourceLocation('/resources'),
      referrer: '',
      navigationType: 'navigate' as const,
      allowOptions: { isProd: true },
    };

    expect(trackFastifyResourcePageView(runtime)).toBe('/resources');
    expect(trackFastifyResourcePageView(runtime)).toBeNull();
    expect(trackGa4PageView).toHaveBeenCalledTimes(1);
    expect(trackGa4PageView).toHaveBeenCalledWith('/resources', 'Resources');
  });

  it('tracks a published Resource detail with only its sanitized pathname', () => {
    const result = trackFastifyResourcePageView({
      location: resourceLocation('/resources/managing-difficult-days', {
        search: '?email=person@example.com&session_id=secret',
        hash: '#access_token=secret',
      }),
      referrer: 'https://www.talktosolace2.ai/resources',
      navigationType: 'navigate',
      allowOptions: { isProd: true },
    });

    expect(result).toBe('/resources/managing-difficult-days');
    expect(trackGa4PageView).toHaveBeenCalledWith(
      '/resources/managing-difficult-days',
      'Resource',
    );
    expect(JSON.stringify(vi.mocked(trackGa4PageView).mock.calls)).not.toContain('secret');
    expect(JSON.stringify(vi.mocked(trackGa4PageView).mock.calls)).not.toContain('email');
  });

  it('suppresses filter, pagination, query and hash-only navigation', () => {
    const result = trackFastifyResourcePageView({
      location: resourceLocation('/resources', {
        search: '?type=Answer&page=2',
        hash: '#library',
      }),
      referrer: 'https://www.talktosolace2.ai/resources?type=Insight&page=1#library',
      navigationType: 'navigate',
      allowOptions: { isProd: true },
    });

    expect(result).toBeNull();
    expect(trackGa4PageView).not.toHaveBeenCalled();
  });

  it('still tracks a hard reload and a distinct Resource pathname', () => {
    expect(trackFastifyResourcePageView({
      location: resourceLocation('/resources'),
      referrer: 'https://www.talktosolace2.ai/resources?type=Answer',
      navigationType: 'reload',
      allowOptions: { isProd: true },
    })).toBe('/resources');

    resetFastifyResourceAnalyticsForTests();

    expect(trackFastifyResourcePageView({
      location: resourceLocation('/resources/a-published-resource'),
      referrer: 'https://www.talktosolace2.ai/resources?page=2',
      navigationType: 'navigate',
      allowOptions: { isProd: true },
    })).toBe('/resources/a-published-resource');

    expect(trackGa4PageView).toHaveBeenCalledTimes(2);
  });

  it('blocks non-production, unapproved hosts and non-public Resource routes', () => {
    const attempts = [
      {
        location: resourceLocation('/resources'),
        allowOptions: { isProd: false },
      },
      {
        location: resourceLocation('/resources', { hostname: 'preview.talktosolace2.ai' }),
        allowOptions: { isProd: true },
      },
      {
        location: resourceLocation('/admin/content-hub/preview'),
        allowOptions: { isProd: true },
      },
      {
        location: resourceLocation('/app/settings/resources'),
        allowOptions: { isProd: true },
      },
      {
        location: resourceLocation('/resources/access-token-secret'),
        allowOptions: { isProd: true },
      },
    ];

    for (const attempt of attempts) {
      expect(trackFastifyResourcePageView({
        ...attempt,
        referrer: '',
        navigationType: 'navigate',
      })).toBeNull();
    }
    expect(trackGa4PageView).not.toHaveBeenCalled();
  });
});
