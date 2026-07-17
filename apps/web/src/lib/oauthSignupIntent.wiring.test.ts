import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The wiring, not the storage helper: what /users/init actually receives, and whether
 * the intent is cleared at the right moment. This is where the real bug lived - the
 * client always sent {}.
 */

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
    },
  },
}));

import { api } from './api';
import {
  clearOAuthSignupIntent,
  readOAuthSignupIntent,
  storeOAuthSignupIntent,
} from './oauthSignupIntent';

function lastInitBody() {
  const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/users/init'));
  return call ? JSON.parse(call[1].body) : null;
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ id: 'u1', signup_type: 'trial' }),
    text: async () => '',
  });
});

describe('POST /users/init body', () => {
  it('sends signup_type when a trial intent is present', async () => {
    await api.initProfile('trial');
    expect(lastInitBody()).toEqual({ signup_type: 'trial' });
  });

  it('sends signup_type when a plan intent is present', async () => {
    await api.initProfile('plan');
    expect(lastInitBody()).toEqual({ signup_type: 'plan' });
  });

  it('sends an empty body when there is no intent (previous behaviour preserved)', async () => {
    await api.initProfile();
    expect(lastInitBody()).toEqual({});
  });

  it('never forwards an invalid value', async () => {
    // Defence in depth: even if a caller bypasses the reader's validation.
    await api.initProfile('premium' as never);
    expect(lastInitBody()).toEqual({});
    await api.initProfile('' as never);
    expect(lastInitBody()).toEqual({});
    await api.initProfile(null as never);
    expect(lastInitBody()).toEqual({});
  });
});

describe('intent lifecycle around profile initialization', () => {
  // Mirrors AuthContext: read -> init -> clear only on success.
  async function initWithIntent() {
    const intent = readOAuthSignupIntent() ?? undefined;
    const profile = await api.initProfile(intent);
    clearOAuthSignupIntent();
    return profile;
  }

  it('consumes a stored intent and clears it after a successful init', async () => {
    storeOAuthSignupIntent('plan');
    await initWithIntent();

    expect(lastInitBody()).toEqual({ signup_type: 'plan' });
    expect(readOAuthSignupIntent()).toBeNull();
  });

  it('retains the intent when init fails, so a retry still carries it', async () => {
    storeOAuthSignupIntent('trial');
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'boom' }),
      text: async () => 'boom',
    });

    await expect(initWithIntent()).rejects.toBeTruthy();
    expect(readOAuthSignupIntent()).toBe('trial');
  });

  it('drops an invalid stored intent instead of sending it', async () => {
    sessionStorage.setItem('ezri_oauth_signup_intent', 'premium');
    await initWithIntent();

    expect(lastInitBody()).toEqual({});
    expect(readOAuthSignupIntent()).toBeNull();
  });

  it('is idempotent across a callback reload: a second init sends no stale intent', async () => {
    storeOAuthSignupIntent('trial');
    await initWithIntent();
    expect(lastInitBody()).toEqual({ signup_type: 'trial' });

    // Reload re-runs initialization; the intent was consumed, so nothing is re-applied.
    fetchMock.mockClear();
    await initWithIntent();
    expect(lastInitBody()).toEqual({});
  });

  it('a normal login after an abandoned signup carries no intent once cleared', async () => {
    storeOAuthSignupIntent('plan');
    // Login.tsx clears at OAuth start.
    clearOAuthSignupIntent();
    await initWithIntent();

    expect(lastInitBody()).toEqual({});
  });
});
