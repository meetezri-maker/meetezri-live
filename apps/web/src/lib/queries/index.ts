/**
 * Centralized query key factory for TanStack Query.
 * Import from here to ensure consistent cache keys across the app.
 */
export const queryKeys = {
  sessions: {
    all: () => ["sessions"] as const,
    list: (params?: Record<string, unknown>) =>
      ["sessions", "list", params] as const,
  },
  credits: {
    all: () => ["credits"] as const,
    byUser: (userId: string | undefined) => ["credits", userId] as const,
  },
  activity: {
    all: () => ["activity"] as const,
    /** Prefix — invalidates every cached limit for this user. */
    recentForUser: (userId: string | undefined) => ["activity", "recent", userId] as const,
    recent: (userId: string | undefined, limit = 25) =>
      ["activity", "recent", userId, limit] as const,
  },
  notifications: {
    all: () => ["notifications"] as const,
    byUser: (userId: string | undefined) =>
      ["notifications", userId] as const,
    list: (
      userId: string | undefined,
      params?: { page?: number; pageSize?: number }
    ) => ["notifications", "list", userId, params] as const,
  },
  profile: {
    all: () => ["profile"] as const,
    /** Session `/users/me` document (use for features keyed off profile fields, e.g. consent flags). */
    me: () => ["profile", "me"] as const,
    byUser: (userId: string | undefined) => ["profile", userId] as const,
  },
  moods: {
    all: () => ["moods"] as const,
    my: (userId: string | undefined) => ["moods", "my", userId] as const,
  },
  safetyResourceInteractions: {
    all: () => ["safetyResourceInteractions"] as const,
    list: (params: {
      from?: string;
      to?: string;
      userId: string | undefined;
      /** e.g. `7d` | `all` — distinguishes cache when `from`/`to` are omitted. */
      window?: string;
    }) => ["safetyResourceInteractions", "list", params] as const,
  },
} as const;
