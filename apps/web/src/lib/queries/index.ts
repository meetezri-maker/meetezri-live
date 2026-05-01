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
    recent: (userId: string | undefined) =>
      ["activity", "recent", userId] as const,
  },
  notifications: {
    all: () => ["notifications"] as const,
    byUser: (userId: string | undefined) =>
      ["notifications", userId] as const,
  },
  profile: {
    all: () => ["profile"] as const,
    byUser: (userId: string | undefined) => ["profile", userId] as const,
  },
} as const;
