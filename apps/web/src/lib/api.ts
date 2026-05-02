import { supabase } from './supabase';

/** Base path for REST calls (no trailing slash). In local dev, defaults to `/api` and Vite proxies to the API server — see `apps/web/vite.config.ts`. */
const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? '/api'
    : 'https://meetezri-live-api.vercel.app/api');

async function getHeaders(accessToken?: string) {
  const token =
    accessToken ||
    (await supabase.auth.getSession()).data.session?.access_token;

  // Tells the API which SPA origin to use in email `redirect_to` (signup, resend, etc.).
  // The server honors this over `Origin` when set (see `getWebBaseUrlFromRequest` in the API).
  // Fixes local dev when links would otherwise pick up `WEB_BASE_URL` or a wrong host.
  const webBase =
    typeof window !== 'undefined' && window.location?.origin
      ? { 'X-Web-Base-Url': window.location.origin }
      : {};

  return {
    'Content-Type': 'application/json',
    ...webBase,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Turn Fastify/Zod validation payloads into a short user-facing string. */
function formatApiErrorBody(
  errorData: Record<string, unknown>,
  defaultErrorMessage: string
): string {
  const issues = errorData.issues as { fieldErrors?: Record<string, string[]> } | undefined;
  const fe = issues?.fieldErrors;
  if (fe && typeof fe === 'object') {
    const first = Object.entries(fe).find(([, v]) => Array.isArray(v) && v.length);
    if (first && first[1][0]) {
      const label =
        first[0] === 'email'
          ? 'Email'
          : first[0] === 'full_name'
            ? 'Name'
            : first[0].replace(/_/g, ' ');
      return `${label}: ${first[1][0]}`;
    }
  }

  const raw = errorData.message;
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(raw) as Array<{
        message?: string;
        path?: (string | number)[];
        validation?: string;
      }>;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const e = parsed[0];
        const lastPath = e.path?.length ? String(e.path[e.path.length - 1]) : '';
        if (lastPath === 'email' || e.validation === 'email') {
          return 'Please enter a valid email address (e.g. name@domain.com).';
        }
        if (e.message) {
          return lastPath ? `${lastPath.replace(/_/g, ' ')}: ${e.message}` : e.message;
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (typeof raw === 'string' && raw.length > 0 && !raw.trim().startsWith('[')) {
    return raw;
  }

  const validation = errorData.validation as
    | Array<{ message?: string; instancePath?: string }>
    | undefined;
  if (Array.isArray(validation) && validation[0]?.message) {
    return validation[0].message;
  }

  return defaultErrorMessage;
}

async function handleResponse(res: Response, defaultErrorMessage: string) {
  if (res.status === 401) {
    const errorData = await res.json().catch(() => ({} as Record<string, unknown>));
    const message = typeof errorData.message === 'string' ? errorData.message : '';

    // Some endpoints (e.g. knowledge 2FA verify) legitimately return 401 for bad code.
    // Preserve that message and avoid signing out a valid session.
    if (message && message.toLowerCase().includes('invalid second-factor code')) {
      throw new Error(message);
    }

    // Session is invalid/expired on the server side
    await supabase.auth.signOut();
    throw new Error('Session expired. Please login again.');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({} as Record<string, unknown>));
    throw new Error(formatApiErrorBody(errorData, defaultErrorMessage));
  }

  return res.json();
}

async function handleResponseAllowEmpty(res: Response, defaultErrorMessage: string) {
  if (res.status === 401) {
    const errorData = await res.json().catch(() => ({} as Record<string, unknown>));
    const message = typeof errorData.message === 'string' ? errorData.message : '';

    if (message && message.toLowerCase().includes('invalid second-factor code')) {
      throw new Error(message);
    }

    await supabase.auth.signOut();
    throw new Error('Session expired. Please login again.');
  }
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({} as Record<string, unknown>));
    throw new Error(formatApiErrorBody(errorData, defaultErrorMessage));
  }
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text.trim()) return null;
  return JSON.parse(text);
}

async function handleBlobResponse(res: Response, errorMessage: string) {
  if (!res.ok) {
    const errorBody = await res.text();
    console.error(errorMessage, { status: res.status, body: errorBody });
    throw new Error(errorMessage);
  }
  return res.blob();
}

function parseFilenameFromContentDisposition(contentDisposition: string | null) {
  if (!contentDisposition) return null;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]).replace(/["']/g, "");
    } catch {
      return utf8Match[1].replace(/["']/g, "");
    }
  }

  const plainMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1] ?? null;
}

/** Merge overlapping GET /users/me calls (same tick / auth bootstrap). Admin calls pass explicit token and bypass. */
let getMeInFlight: Promise<any> | null = null;
/** Merge overlapping GET /users/credits calls. */
let getCreditsInFlight: Promise<any> | null = null;
/** Merge overlapping GET /journal list calls (auth/session churn on load). */
let getJournalListInFlight: Promise<any> | null = null;
/** Merge overlapping GET /users/activity calls (dashboard widgets). */
let getRecentActivityInFlight: Promise<any> | null = null;
/** Merge overlapping GET /notifications calls (header + page). */
let getNotificationsInFlight: Promise<any> | null = null;
/** Merge overlapping GET /notifications/unread-count calls (header + page). */
let getUnreadCountInFlight: Promise<any> | null = null;
/** Merge overlapping GET /wellness/challenges?scope=dashboard calls (dashboard). */
let getChallengesForMeInFlight: Promise<any> | null = null;
/** Merge overlapping GET /ai-avatars calls (companion pickers). */
let getAiAvatarsInFlight: Promise<any> | null = null;

type CachedValue = { at: number; value: unknown };
const shortGetCache = new Map<string, CachedValue>();
const shortGetInFlight = new Map<string, Promise<unknown>>();

function getCached<T>(key: string, ttlMs: number): T | null {
  const hit = shortGetCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) return null;
  return hit.value as T;
}

async function getJsonCached<T>(
  cacheKey: string,
  url: string,
  headers: Record<string, string>,
  defaultErrorMessage: string,
  ttlMs: number
): Promise<T> {
  const cached = getCached<T>(cacheKey, ttlMs);
  if (cached !== null) return cached;

  const inFlight = shortGetInFlight.get(cacheKey);
  if (inFlight) return (await inFlight) as T;

  const run = (async () => {
    const res = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
    const json = (await handleResponse(res, defaultErrorMessage)) as T;
    shortGetCache.set(cacheKey, { at: Date.now(), value: json });
    return json;
  })().finally(() => {
    shortGetInFlight.delete(cacheKey);
  });

  shortGetInFlight.set(cacheKey, run);
  return (await run) as T;
}

export const api = {
  async getMe(accessToken?: string) {
    const run = async () => {
      const headers = await getHeaders(accessToken);
      const res = await fetch(`${API_URL}/users/me`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });

      if (res.status === 404) {
        throw new Error('Profile not found');
      }

      return handleResponse(res, 'Failed to fetch user profile');
    };

    if (accessToken) {
      return run();
    }
    if (!getMeInFlight) {
      // Short TTL cache to avoid repeated /users/me calls during route changes.
      const cached = getCached<any>('GET:/users/me', 10_000);
      if (cached !== null) return cached;

      getMeInFlight = run().then((data) => {
        shortGetCache.set('GET:/users/me', { at: Date.now(), value: data });
        return data;
      }).finally(() => {
        getMeInFlight = null;
      });
    }
    return getMeInFlight;
  },

  async initProfile() {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/users/init`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    return handleResponse(res, 'Failed to initialize profile');
  },

  async updateProfile(data: any) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/users/me`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update profile');
  },

  async getCommunityOverview() {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/community/overview`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    return handleResponse(res, 'Failed to load community overview');
  },

  async getCommunityGroups() {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/community/groups`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    return handleResponse(res, 'Failed to load community groups');
  },

  async getCommunityPosts(limit = 30) {
    const headers = await getHeaders();
    const res = await fetch(
      `${API_URL}/community/posts?${new URLSearchParams({ limit: String(limit) })}`,
      { method: 'GET', headers, cache: 'no-store' }
    );
    return handleResponse(res, 'Failed to load community posts');
  },

  async createCommunityPost(body: {
    content: string;
    tags?: string[];
    group_id?: string | null;
  }) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/community/posts`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse(res, 'Failed to create post');
  },

  async joinCommunityGroup(groupId: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/community/groups/${groupId}/join`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    return handleResponse(res, 'Failed to join group');
  },

  async leaveCommunityGroup(groupId: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/community/groups/${groupId}/leave`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    return handleResponse(res, 'Failed to leave group');
  },

  async likeCommunityPost(postId: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/community/posts/${postId}/like`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    return handleResponse(res, 'Failed to like post');
  },

  async addCommunityPostComment(postId: string, content: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/community/posts/${postId}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content }),
    });
    return handleResponse(res, 'Failed to add comment');
  },

  async getCommunityPostComments(postId: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/community/posts/${postId}/comments`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    return handleResponse(res, 'Failed to load comments');
  },

  async updateCommunityPostComment(postId: string, commentId: string, content: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/community/posts/${postId}/comments/${commentId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ content }),
    });
    return handleResponse(res, 'Failed to update comment');
  },

  async deleteCommunityPostComment(postId: string, commentId: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/community/posts/${postId}/comments/${commentId}`, {
      method: 'DELETE',
      headers,
    });
    return handleResponse(res, 'Failed to delete comment');
  },

  async updateCommunityPost(postId: string, content: string, tags?: string[]) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/community/posts/${postId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ content, ...(tags ? { tags } : {}) }),
    });
    return handleResponse(res, 'Failed to update post');
  },

  async deleteCommunityPost(postId: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/community/posts/${postId}`, {
      method: 'DELETE',
      headers,
    });
    return handleResponse(res, 'Failed to delete post');
  },

  async getCommunityMemberProfile(userId: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/community/members/${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    return handleResponse(res, 'Failed to load member profile');
  },

  async resendVerificationEmail() {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/users/resend-verification`, {
      method: 'POST',
      headers: {
        ...headers,
        'x-web-base-url':
          import.meta.env.VITE_WEB_BASE_URL ||
          (typeof window !== 'undefined' ? window.location.origin : ''),
      },
    });
    return handleResponse(res, 'Failed to send verification email');
  },

  async confirmEmail() {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/users/confirm-email`, {
      method: 'POST',
      headers,
    });
    return handleResponse(res, 'Failed to confirm email');
  },

  async getKnowledgeTwoFactorStatus() {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/users/2fa/knowledge/status`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    return handleResponse(res, 'Failed to load knowledge 2FA status');
  },

  async setupKnowledgeTwoFactor(body: {
    pin: string;
    securityQuestion: string;
    securityAnswer: string;
  }) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/users/2fa/knowledge/setup`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse(res, 'Failed to setup knowledge 2FA');
  },

  async setupKnowledgeTwoFactorEmail() {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/users/2fa/knowledge/setup-email`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    return handleResponse(res, 'Failed to setup email authentication code 2FA');
  },

  async verifyKnowledgeTwoFactor(code: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/users/2fa/knowledge/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code }),
    });
    return handleResponse(res, 'Failed to verify knowledge 2FA');
  },

  async disableKnowledgeTwoFactor() {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/users/2fa/knowledge/disable`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    return handleResponse(res, 'Failed to disable knowledge 2FA');
  },

  async requestKnowledgeTwoFactorRecovery() {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/users/2fa/knowledge/recovery/request`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    return handleResponse(res, 'Failed to send recovery code');
  },

  async verifyKnowledgeTwoFactorRecovery(code: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/users/2fa/knowledge/recovery/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code }),
    });
    return handleResponse(res, 'Failed to verify recovery code');
  },

  async requestKnowledgeTwoFactorLoginCode() {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/users/2fa/knowledge/login-code/request`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    return handleResponse(res, 'Failed to send authentication code');
  },

  async verifyKnowledgeTwoFactorLoginCode(code: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/users/2fa/knowledge/login-code/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code }),
    });
    return handleResponse(res, 'Failed to verify authentication code');
  },

  async completeOnboarding(data: any) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/users/onboarding`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to complete onboarding');
  },

  async deleteAccount() {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/users/me`, {
      method: 'DELETE',
      headers,
    });
    
    return handleResponse(res, 'Failed to delete account');
  },

  async exportUserData() {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/users/export`, {
      method: 'GET',
      headers,
    });
    const blob = await handleBlobResponse(res, 'Failed to export user data');
    const contentDisposition = res.headers.get('content-disposition');
    const contentType = res.headers.get('content-type') || blob.type || '';
    const filename = parseFilenameFromContentDisposition(contentDisposition);

    return {
      blob,
      filename,
      contentType,
    };
  },

  async checkUserExists(email: string) {
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : import.meta.env.VITE_WEB_BASE_URL || '';
    const res = await fetch(`${API_URL}/users/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(origin ? { 'x-web-base-url': origin } : {}),
      },
      body: JSON.stringify({ email }),
    });
    return handleResponse(res, 'Failed to check user existence');
  },

  async signup(data: { email: string; password: string; firstName: string; lastName: string; age: string; stripe_session_id?: string }) {
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : import.meta.env.VITE_WEB_BASE_URL || '';
    const res = await fetch(`${API_URL}/users/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(origin ? { 'x-web-base-url': origin } : {}),
      },
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to sign up');
  },

  async sendEmail(to: string, subject: string, html: string, text?: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/email/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ to, subject, html, text }),
    });
    
    return handleResponse(res, 'Failed to send email');
  },

  async getSettings(accessToken?: string) {
    const headers = await getHeaders(accessToken);
    const res = await fetch(`${API_URL}/system-settings`, {
      method: 'GET',
      headers,
    });
    return handleResponse(res, 'Failed to fetch settings');
  },

  async getCredits(): Promise<any> {
    if (!getCreditsInFlight) {
      const cached = getCached<any>('GET:/users/credits', 5_000);
      if (cached !== null) return cached;

      getCreditsInFlight = (async () => {
        const headers = await getHeaders();
        const data = await getJsonCached<any>(
          'GET:/users/credits',
          `${API_URL}/users/credits`,
          headers,
          'Failed to fetch credits',
          5_000
        );
        return data;
      })().finally(() => {
        getCreditsInFlight = null;
      });
    }
    return getCreditsInFlight;
  },

  async getRecentActivity(limit = 25) {
    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const cacheKey = `GET:/users/activity?limit=${safeLimit}`;
    if (!getRecentActivityInFlight) {
      const cached = getCached<any>(cacheKey, 5_000);
      if (cached !== null) return cached;
      getRecentActivityInFlight = (async () => {
        const headers = await getHeaders();
        return await getJsonCached<any>(
          cacheKey,
          `${API_URL}/users/activity?${new URLSearchParams({ limit: String(safeLimit) })}`,
          headers,
          'Failed to fetch recent activity',
          5_000
        );
      })().finally(() => {
        getRecentActivityInFlight = null;
      });
    }
    return getRecentActivityInFlight;
  },

  async reportCrisisEvent(data: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    eventType?: string;
    keywords?: string[];
    aiConfidence?: number;
    notes?: string;
  }) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/users/crisis-events`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to report crisis event');
  },

  async updateSetting(key: string, value: any, description?: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/system-settings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ key, value, description }),
    });
    return handleResponse(res, 'Failed to update setting');
  },

  /** Super admin: feature flags backed by DB */
  async listFeatureFlags() {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/admin/feature-flags`, { method: 'GET', headers, cache: 'no-store' });
    return handleResponse(res, 'Failed to load feature flags');
  },
  async createFeatureFlag(body: Record<string, unknown>) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/admin/feature-flags`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse(res, 'Failed to create feature flag');
  },
  async updateFeatureFlag(id: string, body: Record<string, unknown>) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/admin/feature-flags/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse(res, 'Failed to update feature flag');
  },
  async deleteFeatureFlag(id: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/admin/feature-flags/${id}`, { method: 'DELETE', headers });
    return handleResponseAllowEmpty(res, 'Failed to delete feature flag');
  },

  /** Super admin + org admin: A/B tests */
  async listAbTests() {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/admin/ab-tests`, { method: 'GET', headers, cache: 'no-store' });
    return handleResponse(res, 'Failed to load A/B tests');
  },
  async createAbTest(body: Record<string, unknown>) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/admin/ab-tests`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse(res, 'Failed to create A/B test');
  },
  async updateAbTest(id: string, body: Record<string, unknown>) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/admin/ab-tests/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse(res, 'Failed to update A/B test');
  },
  async deleteAbTest(id: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/admin/ab-tests/${id}`, { method: 'DELETE', headers });
    return handleResponseAllowEmpty(res, 'Failed to delete A/B test');
  },

  /** Super admin: API keys & webhooks (JSON in system_settings) */
  async getApiPlatformConfig() {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/admin/platform/api-config`, { method: 'GET', headers, cache: 'no-store' });
    return handleResponse(res, 'Failed to load API configuration');
  },
  async saveApiPlatformConfig(body: { apiKeys?: unknown[]; webhooks?: unknown[] }) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/admin/platform/api-config`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse(res, 'Failed to save API configuration');
  },
  async createAdminApiKey(body: { name: string; environment: string; rateLimit: string }) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/admin/platform/api-keys`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse(res, 'Failed to create API key');
  },

  /** Integrations + branding (super_admin + org_admin) */
  async getIntegrationsConfig() {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/admin/platform/integrations`, { method: 'GET', headers, cache: 'no-store' });
    return handleResponse(res, 'Failed to load integrations');
  },
  async saveIntegrationsConfig(integrations: unknown[]) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/admin/platform/integrations`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(integrations),
    });
    return handleResponse(res, 'Failed to save integrations');
  },
  async getBrandingConfig() {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/admin/platform/branding`, { method: 'GET', headers, cache: 'no-store' });
    return handleResponse(res, 'Failed to load branding');
  },
  async saveBrandingConfig(payload: Record<string, unknown>) {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/admin/platform/branding`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to save branding');
  },

  // Emergency Contacts API
  emergencyContacts: {
    async getAll() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/emergency-contacts`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch emergency contacts');
    },

    async create(data: { name: string; relationship?: string; phone?: string; email?: string; is_trusted?: boolean }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/emergency-contacts`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to create emergency contact');
    },

    async update(id: string, data: { name?: string; relationship?: string; phone?: string; email?: string; is_trusted?: boolean }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/emergency-contacts/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to update emergency contact');
    },

    async delete(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/emergency-contacts/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
         // handleResponse typically expects JSON, but 204 No Content has no body
         if (res.status === 204) return;
         const errorData = await res.json().catch(() => ({}));
         throw new Error(errorData.message || 'Failed to delete emergency contact');
      }
      return;
    }
  },

  // Journal API
  journal: {
    async create(data: { title?: string; content?: string; mood_tags?: string[]; is_private?: boolean; location?: string }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/journal`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to create journal entry');
    },

    async getAll(): Promise<any> {
      if (!getJournalListInFlight) {
        getJournalListInFlight = (async () => {
          const headers = await getHeaders();
          const res = await fetch(`${API_URL}/journal`, {
            method: 'GET',
            headers,
            cache: 'no-store',
          });
          return handleResponse(res, 'Failed to fetch journal entries');
        })().finally(() => {
          getJournalListInFlight = null;
        });
      }
      return getJournalListInFlight;
    },

    async get(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/journal/${id}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch journal entry');
    },

    async update(id: string, data: { title?: string; content?: string; mood_tags?: string[]; is_private?: boolean; location?: string }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/journal/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to update journal entry');
    },

    async delete(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/journal/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (res.status === 204) return;
      return handleResponse(res, 'Failed to delete journal entry');
    },

    async toggleFavorite(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/journal/${id}/favorite`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      return handleResponse(res, 'Failed to toggle journal favorite');
    },

    async getUserJournals(userId: string) { // Admin only
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/journal/admin/users/${userId}/journals`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch user journals');
    },

    async getAllJournalsAdmin() { // Admin only
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/journal/admin`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch all journals');
    }
  },

  // Wellness API
  wellness: {
    async getAll(category?: string) {
      const headers = await getHeaders();
      const query = category ? `?category=${encodeURIComponent(category)}` : '';
      const res = await fetch(`${API_URL}/wellness${query}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch wellness tools');
    },

    async getTool(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/wellness/${id}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch wellness tool');
    },

    async toggleFavorite(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/wellness/${id}/favorite`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      return handleResponse(res, 'Failed to toggle wellness tool favorite');
    },

    async startSession(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/wellness/${id}/start`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      return handleResponse(res, 'Failed to start wellness session');
    },

    async completeSession(progressId: string, data: { duration_spent: number; feedback_rating?: number }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/wellness/progress/${progressId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to complete wellness session');
    },

    async getProgress() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/wellness/progress`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch wellness progress');
    },

    async getStats() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/wellness/stats`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch wellness stats');
    },
    
    async getChallenges() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/wellness/challenges`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch wellness challenges');
    },

    /** Per-user progress for dashboard (active challenges + level summary). Uses ?scope=dashboard on GET /challenges so older API deploys without /challenges/me still work. */
    async getChallengesForMe() {
      const cacheKey = 'GET:/wellness/challenges?scope=dashboard';
      if (!getChallengesForMeInFlight) {
        const cached = getCached<any>(cacheKey, 5_000);
        if (cached !== null) return cached;
        getChallengesForMeInFlight = (async () => {
          const headers = await getHeaders();
          const url = `${API_URL}/wellness/challenges?scope=dashboard`;
          let res = await fetch(url, {
            method: 'GET',
            headers,
            cache: 'no-store',
          });
          // Fallback if production API predates scope=dashboard (should not happen).
          if (res.status === 404) {
            res = await fetch(`${API_URL}/wellness/challenges/me`, {
              method: 'GET',
              headers,
              cache: 'no-store',
            });
          }
          const data = await handleResponse(res, 'Failed to fetch your wellness challenges');
          shortGetCache.set(cacheKey, { at: Date.now(), value: data });
          return data;
        })().finally(() => {
          getChallengesForMeInFlight = null;
        });
      }
      return getChallengesForMeInFlight;
    },

    async createChallenge(data: {
      title: string;
      description?: string | null;
      category?: string | null;
      start_date: string;
      end_date: string;
      reward_points?: number | null;
      goal_criteria?: unknown | null;
    }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/wellness/challenges`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to create wellness challenge');
    },

    async updateChallenge(
      id: string,
      data: {
        title?: string;
        description?: string | null;
        category?: string | null;
        start_date?: string;
        end_date?: string;
        reward_points?: number | null;
        goal_criteria?: unknown | null;
      }
    ) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/wellness/challenges/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to update wellness challenge');
    },

    async joinChallenge(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/wellness/challenges/${encodeURIComponent(id)}/join`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      return handleResponse(res, 'Failed to join challenge');
    },

    async unjoinChallenge(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/wellness/challenges/${encodeURIComponent(id)}/join`, {
        method: 'DELETE',
        headers,
      });
      if (res.status === 204) return true;
      return handleResponse(res, 'Failed to leave challenge');
    },

    async create(data: any) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/wellness`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to create wellness tool');
    },

    async update(id: string, data: any) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/wellness/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to update wellness tool');
    },

    async delete(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/wellness/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (res.status === 204) return true;
      return handleResponse(res, 'Failed to delete wellness tool');
    },

    async trackProgress(id: string, data: { duration_spent: number; feedback_rating?: number }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/wellness/${id}/progress`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to track progress');
    }
  },

  // Habits API
  goals: {
    async list() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/goals`, {
        method: "GET",
        headers,
        cache: "no-store",
      });
      return handleResponse(res, "Failed to fetch goals");
    },

    async getById(goalId: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/goals/${encodeURIComponent(goalId)}`, {
        method: "GET",
        headers,
        cache: "no-store",
      });
      return handleResponse(res, "Failed to fetch goal");
    },

    async create(data: Record<string, unknown>) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/goals`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, "Failed to create goal");
    },

    async update(goalId: string, data: Record<string, unknown>) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/goals/${encodeURIComponent(goalId)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, "Failed to update goal");
    },

    async updateStatus(goalId: string, status: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/goals/${encodeURIComponent(goalId)}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status }),
      });
      return handleResponse(res, "Failed to update goal status");
    },

    async delete(goalId: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/goals/${encodeURIComponent(goalId)}`, {
        method: "DELETE",
        headers,
      });
      return handleResponseAllowEmpty(res, "Failed to delete goal");
    },

    async listCheckIns(goalId: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/goals/${encodeURIComponent(goalId)}/check-ins`, {
        method: "GET",
        headers,
        cache: "no-store",
      });
      return handleResponse(res, "Failed to fetch goal check-ins");
    },

    async addCheckIn(goalId: string, payload: Record<string, unknown>) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/goals/${encodeURIComponent(goalId)}/check-ins`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      return handleResponse(res, "Failed to create goal check-in");
    },
  },

  customAchievements: {
    async list() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/custom-achievements`, {
        method: "GET",
        headers,
        cache: "no-store",
      });
      return handleResponse(res, "Failed to fetch custom achievements");
    },

    async create(data: Record<string, unknown>) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/custom-achievements`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, "Failed to create custom achievement");
    },

    async update(id: string, data: Record<string, unknown>) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/custom-achievements/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, "Failed to update custom achievement");
    },

    async delete(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/custom-achievements/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers,
      });
      return handleResponseAllowEmpty(res, "Failed to delete custom achievement");
    },
  },

  // Habits API
  habits: {
    async getAll() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/habits`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch habits');
    },

    async create(data: { name: string; category?: string; frequency?: 'daily' | 'weekly'; color?: string; icon?: string }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/habits`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to create habit');
    },

    async update(id: string, data: { name?: string; category?: string; frequency?: 'daily' | 'weekly'; color?: string; icon?: string; is_archived?: boolean }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/habits/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to update habit');
    },

    async delete(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/habits/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (res.status === 204) return;
      return handleResponse(res, 'Failed to delete habit');
    },

    async complete(id: string, date: string) {
      // date is YYYY-MM-DD
      const isoDate = new Date(date).toISOString();
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/habits/${id}/complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ completed_at: isoDate }),
      });
      return handleResponse(res, 'Failed to complete habit');
    },

    async uncomplete(id: string, date: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/habits/${id}/complete?date=${date}`, {
        method: 'DELETE',
        headers,
      });
      return handleResponse(res, 'Failed to uncomplete habit');
    },

    async getUserHabits(userId: string) { // Admin only
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/habits/admin/users/${userId}/habits`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch user habits');
    },

    async getAllHabitsAdmin() { // Admin only
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/habits/admin`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch all habits');
    }
  },

  // Sessions API
  sessions: {
    async create(data: { type: 'instant' | 'scheduled'; duration_minutes: number; scheduled_at?: string; config?: any }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to create session');
    },

    async schedule(data: { duration_minutes: number; scheduled_at: string; config?: any }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/sessions/schedule`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to schedule session');
    },
    async cancelScheduled(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/sessions/${id}/schedule`, {
        method: 'DELETE',
        headers,
      });
      return handleResponse(res, 'Failed to cancel scheduled session');
    },
    async updateScheduled(
      id: string,
      data: { duration_minutes?: number; scheduled_at?: string; config?: any }
    ) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/sessions/${id}/schedule`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to update scheduled session');
    },

    async list(params?: { status?: string; limit?: number }) {
      const headers = await getHeaders();
      const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
      const res = await fetch(`${API_URL}/sessions${query}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch sessions');
    },

    async get(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/sessions/${id}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch session details');
    },

    async toggleFavorite(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/sessions/${id}/favorite`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      return handleResponse(res, 'Failed to toggle session favorite');
    },

    async end(id: string, durationSeconds?: number, recordingUrl?: string, transcript?: any[]) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/sessions/${id}/end`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          duration_seconds: durationSeconds,
          recording_url: recordingUrl,
          transcript
        }),
      });
      return handleResponse(res, 'Failed to end session');
    },

    async heartbeat(id: string, elapsedSeconds: number) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/sessions/${id}/heartbeat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          elapsed_seconds: elapsedSeconds,
        }),
      });
      return handleResponse(res, 'Failed to heartbeat session');
    },

    async addMessage(id: string, role: 'user' | 'assistant' | 'system', content: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/sessions/${id}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ role, content }),
      });
      return handleResponse(res, 'Failed to add message');
    },

    async getTranscript(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/sessions/${id}/transcript`, {
        method: 'GET',
        headers,
      });
      return handleResponse(res, 'Failed to fetch transcript');
    },

    async getUserSessions(userId: string) { // Admin only
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/sessions/admin/users/${userId}/sessions`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch user sessions');
    },
  },

  // Moods API
  moods: {
    async create(data: { mood: string; intensity: number; activities: string[]; notes?: string }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/moods`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to create mood entry');
    },

    async getMyMoods() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/moods`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch mood history');
    },

    async getAllMoods() { // Admin only
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/moods/admin`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch all mood entries');
    },

    async getUserMoods(userId: string) { // Admin only
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/moods/admin/users/${userId}/moods`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch user moods');
    }
  },

  // Admin API
  admin: {
    async getStats(params?: {
      chartPeriod?: 'week' | 'month' | 'year';
      sessionWeekOffset?: number;
      rangeDays?: number;
      dateFrom?: string;
      dateTo?: string;
      /** Bypass server 60s stats cache */
      refresh?: boolean;
    }) {
      const headers = await getHeaders();
      const search = new URLSearchParams();
      if (params?.chartPeriod) search.set('chartPeriod', params.chartPeriod);
      if (params?.sessionWeekOffset != null && params.sessionWeekOffset > 0) {
        search.set('sessionWeekOffset', String(params.sessionWeekOffset));
      }
      if (params?.rangeDays != null && params.rangeDays > 0) {
        search.set('rangeDays', String(params.rangeDays));
      }
      if (params?.dateFrom) search.set('dateFrom', params.dateFrom);
      if (params?.dateTo) search.set('dateTo', params.dateTo);
      if (params?.refresh) search.set('refresh', '1');
      const qs = search.toString();
      const res = await fetch(`${API_URL}/admin/stats${qs ? `?${qs}` : ''}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch admin stats');
    },

    async getRecentActivity() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/stats/recent`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch recent activity');
    },

    async getUserCounts(): Promise<{ total: number; active: number; suspended: number; inactive: number }> {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/users/counts`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch user counts');
    },

    async getUsers(params?: { page?: number; limit?: number }) {
      const headers = await getHeaders();
      const search = new URLSearchParams();
      if (params?.page != null && params.page > 0) search.set('page', String(params.page));
      if (params?.limit != null && params.limit > 0) search.set('limit', String(params.limit));
      const qs = search.toString();
      const res = await fetch(`${API_URL}/admin/users${qs ? `?${qs}` : ''}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch users');
    },

    async createUser(body: {
      email: string;
      full_name: string;
      status?: 'active' | 'suspended' | 'inactive';
      subscription?: 'trial' | 'core' | 'pro';
    }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      return handleResponse(res, 'Failed to create user');
    },

    async getUserProfile(userId: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch user profile');
    },

    async updateUser(userId: string, data: { status?: string; role?: string }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to update user');
    },

    async deleteUser(userId: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers,
      });
      return handleResponse(res, 'Failed to delete user');
    },

    async getUserAuditLogs(userId: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/users/${userId}/audit-logs`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch user audit logs');
    },

    async getOrganizationTeam(orgId?: string) {
      const headers = await getHeaders();
      const q = orgId ? `?org_id=${encodeURIComponent(orgId)}` : '';
      const res = await fetch(`${API_URL}/admin/organization-team${q}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch organization team');
    },

    async addOrganizationTeamMember(body: {
      org_id?: string;
      email: string;
      full_name: string;
      phone?: string;
      profile_role: 'org_admin' | 'team_admin' | 'user';
    }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/organization-team`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      return handleResponse(res, 'Failed to add team member');
    },

    async updateOrganizationTeamMember(
      userId: string,
      query: { org_id?: string },
      body: {
        phone?: string;
        profile_role?: 'org_admin' | 'team_admin' | 'user';
        account_status?: string;
        org_role?: string;
      }
    ) {
      const headers = await getHeaders();
      const q = query.org_id ? `?org_id=${encodeURIComponent(query.org_id)}` : '';
      const res = await fetch(`${API_URL}/admin/organization-team/${userId}${q}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });
      return handleResponse(res, 'Failed to update team member');
    },

    async removeOrganizationTeamMember(userId: string, orgId?: string) {
      const headers = await getHeaders();
      const q = orgId ? `?org_id=${encodeURIComponent(orgId)}` : '';
      const res = await fetch(`${API_URL}/admin/organization-team/${userId}${q}`, {
        method: 'DELETE',
        headers,
      });
      return handleResponse(res, 'Failed to remove team member');
    },

    async getBackupRecovery() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/backup-recovery`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch backup & recovery');
    },

    async createBackupRecord(body: { kind?: 'full' | 'incremental' }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/backup-recovery`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      return handleResponse(res, 'Failed to create backup');
    },

    async exportBackupMetadata(body?: {
      exportType?: string;
      format?: string;
      dateRange?: string;
      compression?: string;
    }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/backup-recovery/export`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body ?? {}),
      });
      return handleResponse(res, 'Failed to export data');
    },

    async requestBackupRestore(backupId: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/backup-recovery/${backupId}/restore`, {
        method: 'POST',
        headers,
      });
      return handleResponse(res, 'Failed to request restore');
    },

    async downloadBackupRecordFile(backupId: string): Promise<void> {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/backup-recovery/${backupId}/download`, {
        method: 'GET',
        headers,
      });
      if (res.status === 401) {
        await supabase.auth.signOut();
        throw new Error('Session expired. Please login again.');
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(formatApiErrorBody(err, 'Failed to download'));
      }
      const text = await res.text();
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ezri-backup-record-${backupId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },

    async getUserSubscription(userId: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/billing/admin/users/${userId}/subscription`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch user subscription');
    },

    // User Segments
    async getUserSegments() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/user-segments`, { method: 'GET', headers });
      return handleResponse(res, 'Failed to fetch segments');
    },
    async createUserSegment(data: any) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/user-segments`, { method: 'POST', headers, body: JSON.stringify(data) });
      return handleResponse(res, 'Failed to create segment');
    },
    async deleteUserSegment(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/user-segments/${id}`, { method: 'DELETE', headers });
      return handleResponse(res, 'Failed to delete segment');
    },
    async getUserSegmentUsers(id: string, query?: { page?: number; limit?: number }) {
      const headers = await getHeaders();
      const sp = new URLSearchParams();
      if (query?.page != null) sp.set('page', String(query.page));
      if (query?.limit != null) sp.set('limit', String(query.limit));
      const qs = sp.toString();
      const res = await fetch(
        `${API_URL}/admin/user-segments/${id}/users${qs ? `?${qs}` : ''}`,
        { method: 'GET', headers, cache: 'no-store' }
      );
      return handleResponse(res, 'Failed to fetch segment users');
    },

    async getCompanions() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/companions`, { method: 'GET', headers, cache: 'no-store' });
      return handleResponse(res, 'Failed to fetch companions');
    },

    async createCompanion(body: {
      email: string;
      full_name: string;
      phone?: string;
      license_number?: string;
      specializations?: string[];
      languages?: string[];
      availability?: string;
    }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/companions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      return handleResponse(res, 'Failed to create companion');
    },

    async updateCompanion(
      id: string,
      body: {
        full_name?: string;
        email?: string;
        phone?: string;
        license_number?: string;
        specializations?: string[];
        languages?: string[];
        availability?: string;
        is_verified?: boolean;
        account_status?: string;
      }
    ) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/companions/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });
      return handleResponse(res, 'Failed to update companion');
    },

    async deleteCompanion(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/companions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      });
      return handleResponse(res, 'Failed to delete companion');
    },

    // Notifications
    async getManualNotifications() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/notifications/manual`, { method: 'GET', headers });
      return handleResponse(res, 'Failed to fetch notifications');
    },
    async getNotificationAudienceCounts() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/notifications/audience-counts`, { method: 'GET', headers });
      return handleResponse(res, 'Failed to fetch audience counts');
    },
    async createManualNotification(data: any) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/notifications/manual`, { method: 'POST', headers, body: JSON.stringify(data) });
      return handleResponse(res, 'Failed to create notification');
    },

    async getNudgeTemplates() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/nudge-templates`, { method: 'GET', headers, cache: 'no-store' });
      return handleResponse(res, 'Failed to fetch nudge templates');
    },
    async createNudgeTemplate(data: any) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/nudge-templates`, { method: 'POST', headers, body: JSON.stringify(data) });
      return handleResponse(res, 'Failed to create nudge template');
    },
    async updateNudgeTemplate(id: string, data: any) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/nudge-templates/${id}`, { method: 'PUT', headers, body: JSON.stringify(data) });
      return handleResponse(res, 'Failed to update nudge template');
    },
    async deleteNudgeTemplate(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/nudge-templates/${id}`, { method: 'DELETE', headers });
      return handleResponse(res, 'Failed to delete nudge template');
    },

    async getNudges() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/nudges`, { method: 'GET', headers, cache: 'no-store' });
      return handleResponse(res, 'Failed to fetch nudges');
    },
    async createNudge(data: any) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/nudges`, { method: 'POST', headers, body: JSON.stringify(data) });
      return handleResponse(res, 'Failed to create nudge');
    },
    async updateNudge(id: string, data: any) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/nudges/${id}`, { method: 'PUT', headers, body: JSON.stringify(data) });
      return handleResponse(res, 'Failed to update nudge');
    },
    async deleteNudge(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/nudges/${id}`, { method: 'DELETE', headers });
      return handleResponse(res, 'Failed to delete nudge');
    },

    // Email Templates
    async getEmailTemplates() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/email-templates`, { method: 'GET', headers });
      return handleResponse(res, 'Failed to fetch templates');
    },
    async createEmailTemplate(data: any) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/email-templates`, { method: 'POST', headers, body: JSON.stringify(data) });
      return handleResponse(res, 'Failed to create template');
    },
    async updateEmailTemplate(id: string, data: any) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/email-templates/${id}`, { method: 'PUT', headers, body: JSON.stringify(data) });
      return handleResponse(res, 'Failed to update template');
    },
    async deleteEmailTemplate(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/email-templates/${id}`, { method: 'DELETE', headers });
      return handleResponse(res, 'Failed to delete template');
    },

    // Push Campaigns
    async getPushCampaigns() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/push-campaigns`, { method: 'GET', headers });
      return handleResponse(res, 'Failed to fetch campaigns');
    },
    async createPushCampaign(data: any) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/push-campaigns`, { method: 'POST', headers, body: JSON.stringify(data) });
      return handleResponse(res, 'Failed to create campaign');
    },
    async updatePushCampaign(id: string, data: any) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/push-campaigns/${id}`, { method: 'PUT', headers, body: JSON.stringify(data) });
      return handleResponse(res, 'Failed to update campaign');
    },
    async deletePushCampaign(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/push-campaigns/${id}`, { method: 'DELETE', headers });
      return handleResponse(res, 'Failed to delete campaign');
    },
    async dispatchPushCampaign(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/push-campaigns/${id}/dispatch`, {
        method: 'POST',
        headers,
      });
      return handleResponse(res, 'Failed to dispatch campaign');
    },

    // Support Tickets
    async getSupportTickets(params?: { page?: number; limit?: number; status?: string }) {
      const headers = await getHeaders();
      const query = params
        ? `?${new URLSearchParams(
            Object.entries(params)
              .filter(([, value]) => value !== undefined && value !== null)
              .reduce((acc, [key, value]) => ({ ...acc, [key]: String(value) }), {} as Record<string, string>)
          ).toString()}`
        : '';
      const res = await fetch(`${API_URL}/admin/support-tickets${query}`, { method: 'GET', headers });
      return handleResponse(res, 'Failed to fetch tickets');
    },
    async getSupportTicket(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/support-tickets/${encodeURIComponent(id)}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch ticket');
    },
    async updateSupportTicket(id: string, data: any) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/support-tickets/${id}`, { method: 'PUT', headers, body: JSON.stringify(data) });
      return handleResponse(res, 'Failed to update ticket');
    },

    async getContentPerformance(params?: { range?: '7d' | '30d' | '90d' }) {
      const headers = await getHeaders();
      const q =
        params?.range != null
          ? `?${new URLSearchParams({ range: params.range }).toString()}`
          : '';
      const res = await fetch(`${API_URL}/admin/content-performance${q}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch content performance');
    },

    /** Platform-wide completion counts per wellness tool id (admin). */
    async getWellnessToolUsage() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/wellness-tools/usage`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch wellness tool usage');
    },

    // Community
    async getCommunityStats() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/community/stats`, { method: 'GET', headers });
      return handleResponse(res, 'Failed to fetch community stats');
    },
    async getCommunityGroups() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/community/groups`, { method: 'GET', headers });
      return handleResponse(res, 'Failed to fetch groups');
    },
    async getCommunityPosts() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/community/posts`, { method: 'GET', headers });
      return handleResponse(res, 'Failed to fetch community posts');
    },
    async patchCommunityPost(id: string, data: { locked?: boolean; flag_count?: number }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/community/posts/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to update post');
    },
    async deleteCommunityPost(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/community/posts/${id}`, { method: 'DELETE', headers });
      return handleResponseAllowEmpty(res, 'Failed to delete post');
    },
    async createCommunityGroup(data: { name: string; description: string; category: string; privacy: string }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/community/groups`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to create group');
    },
    async patchCommunityGroup(id: string, data: Record<string, unknown>) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/community/groups/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to update group');
    },
    async deleteCommunityGroup(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/community/groups/${id}`, { method: 'DELETE', headers });
      return handleResponseAllowEmpty(res, 'Failed to delete group');
    },
    async getCommunityGroupMembers(groupId: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/community/groups/${groupId}/members`, {
        method: 'GET',
        headers,
      });
      return handleResponse(res, 'Failed to fetch group members');
    },
    async addGroupMember(groupId: string, userId: string, role = 'member') {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/community/groups/${groupId}/members`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId, role }),
      });
      return handleResponse(res, 'Failed to add member');
    },
    async removeGroupMember(groupId: string, userId: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/community/groups/${groupId}/members/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers,
      });
      return handleResponseAllowEmpty(res, 'Failed to remove member');
    },

    // Monitoring
    async getLiveSessions() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/live-sessions`, { method: 'GET', headers });
      return handleResponse(res, 'Failed to fetch live sessions');
    },
    async endLiveSession(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/live-sessions/${id}/end`, { method: 'POST', headers });
      return handleResponse(res, 'Failed to end session');
    },
    async flagLiveSession(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/live-sessions/${id}/flag`, { method: 'POST', headers });
      return handleResponse(res, 'Failed to flag session');
    },
    async getActivityLogs(params?: { page?: number; limit?: number }) {
      const headers = await getHeaders();
      const query = params
        ? `?${new URLSearchParams(
            Object.entries(params)
              .filter(([, value]) => value !== undefined && value !== null)
              .reduce((acc, [key, value]) => ({ ...acc, [key]: String(value) }), {} as Record<string, string>)
          ).toString()}`
        : '';
      const res = await fetch(`${API_URL}/admin/activity-logs${query}`, { method: 'GET', headers });
      return handleResponse(res, 'Failed to fetch activity logs');
    },
    async getAuditLogs(params?: { page?: number; limit?: number }) {
      const headers = await getHeaders();
      const query = params
        ? `?${new URLSearchParams(
            Object.entries(params)
              .filter(([, value]) => value !== undefined && value !== null)
              .reduce((acc, [key, value]) => ({ ...acc, [key]: String(value) }), {} as Record<string, string>)
          ).toString()}`
        : '';
      const res = await fetch(`${API_URL}/admin/audit-logs${query}`, { method: 'GET', headers, cache: 'no-store' });
      return handleResponse(res, 'Failed to fetch audit logs');
    },
    async getSessionRecordings(params?: { page?: number; limit?: number }) {
      const headers = await getHeaders();
      const query = params
        ? `?${new URLSearchParams(
            Object.entries(params)
              .filter(([, value]) => value !== undefined && value !== null)
              .reduce((acc, [key, value]) => ({ ...acc, [key]: String(value) }), {} as Record<string, string>)
          ).toString()}`
        : '';
      const res = await fetch(`${API_URL}/admin/session-recordings${query}`, { method: 'GET', headers });
      return handleResponse(res, 'Failed to fetch recordings');
    },
    async getSessionRecordingTranscript(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/session-recordings/${id}/transcript`, { method: 'GET', headers });
      return handleResponse(res, 'Failed to fetch session transcript');
    },
    async getErrorLogs(params?: { page?: number; limit?: number }) {
      const headers = await getHeaders();
      const query = params
        ? `?${new URLSearchParams(
            Object.entries(params)
              .filter(([, value]) => value !== undefined && value !== null)
              .reduce((acc, [key, value]) => ({ ...acc, [key]: String(value) }), {} as Record<string, string>)
          ).toString()}`
        : '';
      const res = await fetch(`${API_URL}/admin/error-logs${query}`, { method: 'GET', headers });
      return handleResponse(res, 'Failed to fetch error logs');
    },
    async resolveErrorLog(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/error-logs/${id}/resolve`, { method: 'PATCH', headers });
      return handleResponseAllowEmpty(res, 'Failed to resolve error log');
    },
    async archiveResolvedErrorLogs() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/error-logs/archive-resolved`, { method: 'POST', headers });
      return handleResponse(res, 'Failed to archive resolved errors');
    },
    async getSystemHealth() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/system-health`, { method: 'GET', headers, cache: 'no-store' });
      return handleResponse(res, 'Failed to fetch system health');
    },
    async markSessionRecordingReviewed(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/session-recordings/${id}/reviewed`, { method: 'POST', headers });
      return handleResponse(res, 'Failed to mark recording reviewed');
    },
    async updateSessionRecording(
      id: string,
      data: {
        admin_flagged?: boolean;
        review_notes?: string;
        topics?: string[];
        summary?: string;
        status?: 'completed' | 'flagged' | 'reviewed' | 'escalated';
      }
    ) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/session-recordings/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to update session recording');
    },

    async getCrisisEvents(params?: { status?: string; page?: number; limit?: number }) {
      const headers = await getHeaders();
      const query = params
        ? `?${new URLSearchParams(
            Object.entries(params)
              .filter(([, value]) => value !== undefined && value !== null)
              .reduce((acc, [key, value]) => ({ ...acc, [key]: String(value) }), {} as Record<string, string>)
          ).toString()}`
        : '';
      const res = await fetch(`${API_URL}/admin/crisis-events${query}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch crisis events');
    },

    async getCrisisEvent(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/crisis-events/${id}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch crisis event');
    },

    async updateCrisisEventStatus(
      id: string,
      data: { status?: string; notes?: string; assigned_to?: string }
    ) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/crisis-events/${id}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to update crisis event');
    },

    async getAchievements(): Promise<{
      totalUsers: number;
      achievements: {
        id: string; name: string; description: string; category: string;
        iconUrl: string; criteria: unknown; points: number; level: number;
        maxLevel: number; createdAt: string; earnedCount: number;
      }[];
    }> {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/achievements`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch achievements');
    },

    async createAchievement(data: {
      name: string; description?: string; category?: string; iconUrl?: string;
      points?: number; level?: number; maxLevel?: number;
    }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/achievements`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to create achievement');
    },

    async updateAchievement(id: string, data: {
      name?: string; description?: string; category?: string; iconUrl?: string;
      points?: number; level?: number; maxLevel?: number;
    }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/achievements/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to update achievement');
    },

    async deleteAchievement(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/achievements/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      });
      if (res.status === 204) return true;
      return handleResponse(res, 'Failed to delete achievement');
    },
  },



  // Support (end-user)
  support: {
    async listTickets(params?: { status?: string; limit?: number }) {
      const headers = await getHeaders();
      const search = new URLSearchParams();
      if (params?.status) search.set('status', params.status);
      if (params?.limit != null) search.set('limit', String(params.limit));
      const qs = search.toString();
      const res = await fetch(`${API_URL}/support/tickets${qs ? `?${qs}` : ''}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to load tickets');
    },

    async createTicket(body: {
      subject: string;
      description: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
    }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/support/tickets`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      return handleResponse(res, 'Failed to create ticket');
    },

    async getTicket(ticketId: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/support/tickets/${encodeURIComponent(ticketId)}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to load ticket');
    },

    async addMessage(ticketId: string, body: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/support/tickets/${encodeURIComponent(ticketId)}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ body }),
      });
      return handleResponse(res, 'Failed to send message');
    },

    async closeTicket(ticketId: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/support/tickets/${encodeURIComponent(ticketId)}/close`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      return handleResponse(res, 'Failed to close ticket');
    },
  },

  // Billing API
  billing: {
    async getSubscription() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/billing`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch subscription');
    },

    async createSubscription(data: { plan_type: 'trial' | 'core' | 'pro'; billing_cycle?: 'monthly' | 'yearly'; payment_method?: string; successUrl?: string; cancelUrl?: string }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/billing`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to create subscription');
    },

    async createGuestSubscription(data: { plan_type: 'trial' | 'core' | 'pro'; billing_cycle?: 'monthly' | 'yearly'; successUrl?: string; cancelUrl?: string }) {
      const res = await fetch(`${API_URL}/billing/guest-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to create guest subscription');
    },

    async buyCredits(data: { credits: number }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/billing/credits`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to create credit purchase session');
    },

    async syncCredits() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/billing/sync-credits`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      return handleResponse(res, 'Failed to sync credits');
    },

    async createPortalSession() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/billing/portal`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      return handleResponse(res, 'Failed to create portal session');
    },

    async updateSubscription(data: { plan_type?: 'trial' | 'core' | 'pro'; billing_cycle?: 'monthly' | 'yearly' }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/billing`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to update subscription');
    },

    async cancelSubscription() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/billing/cancel`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      return handleResponse(res, 'Failed to cancel subscription');
    },

    async getHistory() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/billing/history`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch billing history');
    },

    async getInvoices() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/billing/invoices`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch invoices');
    },

    async getAllSubscriptions() { // Admin only
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/billing/admin/subscriptions`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch all subscriptions');
    },

    async getAdminInvoices() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/billing/admin/invoices`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch invoices');
    },

    async getAdminPaygTransactions() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/billing/admin/payg-transactions`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch PAYG transactions');
    },

    /** DB aggregate only — fast for package manager (no Stripe). */
    async getAdminPaygSummary() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/billing/admin/payg-summary`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch PAYG summary');
    },

    /** Single request: subscriptions + Stripe invoices + PAYG rows (faster than three separate calls). */
    async getAdminBillingOverview() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/billing/admin/overview`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch admin billing overview');
    },

    async updateSubscriptionById(id: string, data: { plan_type?: 'trial' | 'core' | 'pro'; billing_cycle?: 'monthly' | 'yearly'; status?: string }) { // Admin only
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/billing/admin/subscriptions/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to update subscription');
    },

    async getUserSubscription(userId: string) { // Admin only
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/billing/admin/users/${userId}/subscription`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch user subscription');
    },

    async syncSubscription() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/billing/sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      return handleResponse(res, 'Failed to sync subscription');
    }
  },



  // Sleep API
  sleep: {
    async getEntries() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/sleep`, {
        method: 'GET',
        headers,
      });
      return handleResponse(res, 'Failed to fetch sleep entries');
    },

    async createEntry(data: { bed_time: string; wake_time: string; quality_rating?: number; factors?: string[]; notes?: string }) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/sleep`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to create sleep entry');
    },

    async getUserEntries(userId: string) { // Admin only
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/sleep/admin/users/${userId}/sleep`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch user sleep entries');
    },

    async getAllEntriesAdmin() { // Admin only
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/sleep/admin`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch all sleep entries');
    }
  },



  // Notifications API
  notifications: {
    async getAll() {
      const cacheKey = 'GET:/notifications';
      if (!getNotificationsInFlight) {
        const cached = getCached<any>(cacheKey, 5_000);
        if (cached !== null) return cached;
        getNotificationsInFlight = (async () => {
          const headers = await getHeaders();
          return await getJsonCached<any>(
            cacheKey,
            `${API_URL}/notifications`,
            headers,
            'Failed to fetch notifications',
            5_000
          );
        })().finally(() => {
          getNotificationsInFlight = null;
        });
      }
      return getNotificationsInFlight;
    },

    async getUnreadCount() {
      const cacheKey = 'GET:/notifications/unread-count';
      if (!getUnreadCountInFlight) {
        const cached = getCached<any>(cacheKey, 5_000);
        if (cached !== null) return cached;
        getUnreadCountInFlight = (async () => {
          const headers = await getHeaders();
          return await getJsonCached<any>(
            cacheKey,
            `${API_URL}/notifications/unread-count`,
            headers,
            'Failed to fetch unread count',
            5_000
          );
        })().finally(() => {
          getUnreadCountInFlight = null;
        });
      }
      return getUnreadCountInFlight;
    },

    async markAsRead(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/notifications/${id}/read`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({}),
      });
      return handleResponse(res, 'Failed to mark notification as read');
    },

    async markAllAsRead() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/notifications/read-all`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({}),
      });
      return handleResponse(res, 'Failed to mark all notifications as read');
    },
    
    // Admin only
    async create(data: any) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/notifications`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to create notification');
    },

    async broadcast(data: any) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/notifications/broadcast`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to broadcast notification');
    }
  },

  // AI Avatars API
  aiAvatars: {
    async getAll() {
      const cacheKey = 'GET:/ai-avatars';
      if (!getAiAvatarsInFlight) {
        const cached = getCached<any>(cacheKey, 30_000);
        if (cached !== null) return cached;
        getAiAvatarsInFlight = (async () => {
          const headers = await getHeaders();
          return await getJsonCached<any>(
            cacheKey,
            `${API_URL}/ai-avatars`,
            headers,
            'Failed to fetch AI avatars',
            30_000
          );
        })().finally(() => {
          getAiAvatarsInFlight = null;
        });
      }
      return getAiAvatarsInFlight;
    },

    /** Admin-only: includes usage stats computed from session history. */
    async getAllWithUsageStats() {
      const cacheKey = 'GET:/ai-avatars/stats';
      const headers = await getHeaders();
      return await getJsonCached<any>(
        cacheKey,
        `${API_URL}/ai-avatars/stats`,
        headers,
        'Failed to fetch AI avatars stats',
        30_000
      );
    },

    async getById(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/ai-avatars/${id}`, {
        method: 'GET',
        headers,
      });
      return handleResponse(res, 'Failed to fetch AI avatar');
    },

    async create(data: any) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/ai-avatars`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to create AI avatar');
    },

    async update(id: string, data: any) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/ai-avatars/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to update AI avatar');
    },

    async delete(id: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/ai-avatars/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (res.status === 204) return true;
      return handleResponse(res, 'Failed to delete AI avatar');
    }
  }
};
