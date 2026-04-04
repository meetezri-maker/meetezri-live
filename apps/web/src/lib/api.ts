import { supabase } from './supabase';

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? 'http://localhost:3001/api'
    : 'https://meetezri-live-api.vercel.app/api');

async function getHeaders(accessToken?: string) {
  const token =
    accessToken ||
    (await supabase.auth.getSession()).data.session?.access_token;

  return {
    'Content-Type': 'application/json',
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

async function handleBlobResponse(res: Response, errorMessage: string) {
  if (!res.ok) {
    const errorBody = await res.text();
    console.error(errorMessage, { status: res.status, body: errorBody });
    throw new Error(errorMessage);
  }
  return res.blob();
}

export const api = {
  async getMe(accessToken?: string) {
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

  async resendVerificationEmail() {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/users/resend-verification`, {
      method: 'POST',
      headers,
    });
    return handleResponse(res, 'Failed to send verification email');
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
    return handleBlobResponse(res, 'Failed to export user data');
  },

  async checkUserExists(email: string) {
    const res = await fetch(`${API_URL}/users/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    return handleResponse(res, 'Failed to check user existence');
  },

  async signup(data: { email: string; password: string; firstName: string; lastName: string; stripe_session_id?: string }) {
    const res = await fetch(`${API_URL}/users/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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

  async getCredits() {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/users/credits`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    return handleResponse(res, 'Failed to fetch credits');
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

    async getAll() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/journal`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch journal entries');
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
      const res = await fetch(`${API_URL}/admin/users/${userId}/journals`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch user journals');
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

    async list(params?: { status?: string }) {
      const headers = await getHeaders();
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
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
      const res = await fetch(`${API_URL}/admin/users/${userId}/sessions`, {
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
      const res = await fetch(`${API_URL}/admin/users/${userId}/moods`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      return handleResponse(res, 'Failed to fetch user moods');
    }
  },

  // Admin API
  admin: {
    async getStats(params?: { chartPeriod?: 'week' | 'month' | 'year'; sessionWeekOffset?: number }) {
      const headers = await getHeaders();
      const search = new URLSearchParams();
      if (params?.chartPeriod) search.set('chartPeriod', params.chartPeriod);
      if (params?.sessionWeekOffset != null && params.sessionWeekOffset > 0) {
        search.set('sessionWeekOffset', String(params.sessionWeekOffset));
      }
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

    async getUsers() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/users`, {
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

    async getUserSubscription(userId: string) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/users/${userId}/subscription`, {
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
    async updateSupportTicket(id: string, data: any) {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/admin/support-tickets/${id}`, { method: 'PUT', headers, body: JSON.stringify(data) });
      return handleResponse(res, 'Failed to update ticket');
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
    }
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
    }
  },



  // Notifications API
  notifications: {
    async getAll() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/notifications`, {
        method: 'GET',
        headers,
      });
      return handleResponse(res, 'Failed to fetch notifications');
    },

    async getUnreadCount() {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/notifications/unread-count`, {
        method: 'GET',
        headers,
      });
      return handleResponse(res, 'Failed to fetch unread count');
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
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/ai-avatars`, {
        method: 'GET',
        headers,
      });
      return handleResponse(res, 'Failed to fetch AI avatars');
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
