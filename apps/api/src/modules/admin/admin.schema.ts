import { z } from 'zod';

export const dashboardStatsSchema = z.object({
  totalUsers: z.number(),
  activeSessions: z.number(),
  totalSessions: z.number(),
  avgSessionLength: z.number().optional(),
  crisisAlerts: z.number().optional(),
  revenue: z.number(),
  systemHealth: z.array(z.object({
    name: z.string(),
    value: z.string(),
    status: z.string(),
    color: z.string(),
    percentage: z.number()
  })),
  userGrowth: z.array(z.object({
    month: z.string(),
    users: z.number(),
    orgs: z.number()
  })),
  sessionActivity: z.array(z.object({
    day: z.string(),
    sessions: z.number(),
    duration: z.number()
  })),
  hourlyActivity: z.array(z.object({
    hour: z.string(),
    sessions: z.number()
  })),
  revenueData: z.array(z.object({
    month: z.string(),
    revenue: z.number()
  })),
  platformDistribution: z.array(z.object({
    name: z.string(),
    value: z.number(),
    color: z.string()
  })),
  featureUsage: z.array(z.object({
    feature: z.string(),
    usage: z.number()
  }))
});

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  full_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
  // Add derived fields or extra profile fields
  status: z.string().optional().default('active'), // Mocking status if not in DB
  role: z.string().optional().default('user'),
  subscription: z.string().optional(),
  session_count: z.number().optional(),
  last_active: z.date().nullable().optional(),
  risk_level: z.string().optional(),
  organization: z.string().optional(),
});

export const userListSchema = z.array(userSchema);

export const updateUserSchema = z.object({
  status: z.enum(['active', 'suspended', 'inactive']).optional(),
  role: z.string().optional(),
});
