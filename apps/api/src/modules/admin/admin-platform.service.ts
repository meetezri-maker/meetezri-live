import crypto from 'crypto';
import prisma from '../../lib/prisma';
import { Prisma } from '@prisma/client';

const API_CONFIG_KEY = 'admin.platform.api_config';
const INTEGRATIONS_KEY = 'admin.platform.integrations';
const BRANDING_KEY = 'admin.platform.branding';

function genToken(prefix: string) {
  return `${prefix}${crypto.randomBytes(28).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)}`;
}

async function getJsonSetting(key: string): Promise<Prisma.JsonValue | null> {
  const row = await prisma.system_settings.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function upsertJsonSetting(key: string, value: Prisma.InputJsonValue, userId?: string) {
  await prisma.system_settings.upsert({
    where: { key },
    create: {
      key,
      value: value as Prisma.InputJsonValue,
      description: 'Platform admin configuration',
      updated_by: userId,
    },
    update: {
      value: value as Prisma.InputJsonValue,
      updated_at: new Date(),
      updated_by: userId,
    },
  });
}

// --- Feature flags (table feature_flags) ---

export async function listFeatureFlags() {
  const rows = await prisma.feature_flags.findMany({ orderBy: { created_at: 'desc' } });
  return rows.map(serializeFeatureFlag);
}

function serializeFeatureFlag(row: {
  id: string;
  name: string;
  description: string | null;
  is_enabled: boolean | null;
  rules: Prisma.JsonValue | null;
  created_at: Date;
}) {
  const rules = (row.rules && typeof row.rules === 'object' ? row.rules : {}) as Record<string, unknown>;
  const lastModified = rules.lastModified as string | undefined;
  return {
    id: row.id,
    key: row.name,
    name: (rules.title as string) || row.name,
    description: row.description ?? '',
    enabled: row.is_enabled ?? false,
    environment: (rules.environment as string) || 'all',
    rolloutPercentage: typeof rules.rolloutPercentage === 'number' ? rules.rolloutPercentage : 100,
    category: (rules.category as string) || 'feature',
    targetUsers: Array.isArray(rules.targetUsers) ? (rules.targetUsers as string[]) : undefined,
    createdBy: (rules.createdBy as string) || 'Admin',
    createdAt: row.created_at.toISOString(),
    lastModified: lastModified || row.created_at.toISOString(),
  };
}

function normalizeFlagKey(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export async function createFeatureFlag(
  input: {
    key: string;
    name: string;
    description?: string;
    enabled?: boolean;
    environment?: string;
    rolloutPercentage?: number;
    category?: string;
    targetUsers?: string[];
    createdBy?: string;
  }
) {
  const key = normalizeFlagKey(input.key);
  if (!key) throw new Error('Flag key is required');
  const existing = await prisma.feature_flags.findUnique({ where: { name: key } });
  if (existing) throw new Error('A flag with this key already exists');

  const rules = {
    title: input.name.trim() || key,
    environment: input.environment ?? 'production',
    rolloutPercentage: input.rolloutPercentage ?? 0,
    category: input.category ?? 'feature',
    targetUsers: input.targetUsers,
    createdBy: input.createdBy ?? 'Admin',
    lastModified: new Date().toISOString(),
  };

  const row = await prisma.feature_flags.create({
    data: {
      name: key,
      description: input.description ?? '',
      is_enabled: input.enabled ?? false,
      rules: rules as Prisma.InputJsonValue,
    },
  });
  return serializeFeatureFlag(row);
}

export async function updateFeatureFlag(
  id: string,
  patch: Partial<{
    name: string;
    description: string;
    enabled: boolean;
    environment: string;
    rolloutPercentage: number;
    category: string;
    targetUsers: string[];
  }>
) {
  const row = await prisma.feature_flags.findUnique({ where: { id } });
  if (!row) throw new Error('Feature flag not found');

  const rules = (row.rules && typeof row.rules === 'object' ? row.rules : {}) as Record<string, unknown>;
  if (patch.name !== undefined) rules.title = patch.name;
  if (patch.environment !== undefined) rules.environment = patch.environment;
  if (patch.rolloutPercentage !== undefined) rules.rolloutPercentage = patch.rolloutPercentage;
  if (patch.category !== undefined) rules.category = patch.category;
  if (patch.targetUsers !== undefined) rules.targetUsers = patch.targetUsers;
  rules.lastModified = new Date().toISOString();

  const updated = await prisma.feature_flags.update({
    where: { id },
    data: {
      description: patch.description !== undefined ? patch.description : row.description,
      is_enabled: patch.enabled !== undefined ? patch.enabled : row.is_enabled,
      rules: rules as Prisma.InputJsonValue,
    },
  });
  return serializeFeatureFlag(updated);
}

export async function deleteFeatureFlag(id: string) {
  await prisma.feature_flags.delete({ where: { id } });
}

// --- A/B tests (table ab_tests) ---

export async function listAbTests() {
  const rows = await prisma.ab_tests.findMany({ orderBy: { created_at: 'desc' } });
  return rows.map(serializeAbTest);
}

function serializeAbTest(row: {
  id: string;
  name: string;
  description: string | null;
  variants: Prisma.JsonValue | null;
  start_date: Date | null;
  end_date: Date | null;
  status: string | null;
  metrics: Prisma.JsonValue | null;
  created_at: Date;
}) {
  const metrics = (row.metrics && typeof row.metrics === 'object' ? row.metrics : {}) as Record<string, unknown>;
  const variants = Array.isArray(row.variants) ? row.variants : [];
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    status: (row.status as string) || 'draft',
    startDate: row.start_date?.toISOString() ?? new Date().toISOString(),
    endDate: row.end_date?.toISOString(),
    variants,
    goal: (metrics.goal as string) || '',
    confidence: typeof metrics.confidence === 'number' ? metrics.confidence : 0,
    winner: metrics.winner as string | undefined,
  };
}

export async function createAbTest(input: {
  name: string;
  description?: string;
  status?: string;
  goal?: string;
  variants?: unknown[];
}) {
  const variants =
    input.variants && input.variants.length > 0
      ? input.variants
      : [
          {
            id: 'control',
            name: 'Control',
            traffic: 50,
            conversions: 0,
            visitors: 0,
            conversionRate: 0,
          },
          {
            id: 'variant_a',
            name: 'Variant A',
            traffic: 50,
            conversions: 0,
            visitors: 0,
            conversionRate: 0,
          },
        ];

  const row = await prisma.ab_tests.create({
    data: {
      name: input.name.trim(),
      description: input.description ?? '',
      status: input.status ?? 'draft',
      start_date: new Date(),
      variants: variants as Prisma.InputJsonValue,
      metrics: {
        goal: input.goal ?? '',
        confidence: 0,
      } as Prisma.InputJsonValue,
    },
  });
  return serializeAbTest(row);
}

export async function updateAbTest(
  id: string,
  patch: Partial<{
    name: string;
    description: string;
    status: string;
    startDate: string;
    endDate: string | null;
    variants: unknown[];
    goal: string;
    confidence: number;
    winner: string | null;
  }>
) {
  const row = await prisma.ab_tests.findUnique({ where: { id } });
  if (!row) throw new Error('A/B test not found');

  const metrics = (row.metrics && typeof row.metrics === 'object' ? row.metrics : {}) as Record<string, unknown>;
  if (patch.goal !== undefined) metrics.goal = patch.goal;
  if (patch.confidence !== undefined) metrics.confidence = patch.confidence;
  if (patch.winner !== undefined) metrics.winner = patch.winner;

  const updated = await prisma.ab_tests.update({
    where: { id },
    data: {
      name: patch.name !== undefined ? patch.name : row.name,
      description: patch.description !== undefined ? patch.description : row.description,
      status: patch.status !== undefined ? patch.status : row.status,
      start_date:
        patch.startDate !== undefined ? new Date(patch.startDate) : row.start_date,
      end_date:
        patch.endDate === undefined
          ? row.end_date
          : patch.endDate
            ? new Date(patch.endDate)
            : null,
      variants:
        patch.variants !== undefined
          ? (patch.variants as Prisma.InputJsonValue)
          : row.variants === null
            ? Prisma.JsonNull
            : (row.variants as Prisma.InputJsonValue),
      metrics: metrics as Prisma.InputJsonValue,
    },
  });
  return serializeAbTest(updated);
}

export async function deleteAbTest(id: string) {
  await prisma.ab_tests.delete({ where: { id } });
}

// --- API config & webhooks (system_settings JSON) ---

const defaultApiConfig = {
  apiKeys: [] as unknown[],
  webhooks: [] as unknown[],
};

export async function getApiPlatformConfig() {
  const raw = await getJsonSetting(API_CONFIG_KEY);
  if (!raw || typeof raw !== 'object') return defaultApiConfig;
  const o = raw as Record<string, unknown>;
  return {
    apiKeys: Array.isArray(o.apiKeys) ? o.apiKeys : [],
    webhooks: Array.isArray(o.webhooks) ? o.webhooks : [],
  };
}

export async function saveApiPlatformConfig(body: { apiKeys?: unknown[]; webhooks?: unknown[] }, userId?: string) {
  const cur = await getApiPlatformConfig();
  const next = {
    apiKeys: body.apiKeys !== undefined ? body.apiKeys : cur.apiKeys,
    webhooks: body.webhooks !== undefined ? body.webhooks : cur.webhooks,
  };
  await upsertJsonSetting(API_CONFIG_KEY, next as Prisma.InputJsonValue, userId);
  return next;
}

export async function createAdminApiKey(
  input: { name: string; environment: string; rateLimit: string },
  userId?: string
) {
  const cur = await getApiPlatformConfig();
  const key = genToken('ezri_');
  const entry = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    key,
    created: new Date().toISOString(),
    lastUsed: new Date().toISOString(),
    requests: 0,
    rateLimit: input.rateLimit,
    status: 'active',
    environment: input.environment,
  };
  const apiKeys = [...(cur.apiKeys as object[]), entry];
  await saveApiPlatformConfig({ apiKeys }, userId);
  return entry;
}

// --- Integrations ---

const defaultIntegrations: Prisma.JsonArray = [];

export async function getIntegrationsConfig() {
  const raw = await getJsonSetting(INTEGRATIONS_KEY);
  if (!raw || !Array.isArray(raw)) return defaultIntegrations;
  return raw;
}

export async function saveIntegrationsConfig(integrations: Prisma.JsonArray, userId?: string) {
  await upsertJsonSetting(INTEGRATIONS_KEY, integrations, userId);
  return integrations;
}

// --- Branding ---

export async function getBrandingConfig() {
  const raw = await getJsonSetting(BRANDING_KEY);
  if (!raw || typeof raw !== 'object') return null;
  return raw as Record<string, unknown>;
}

export async function saveBrandingConfig(payload: Record<string, unknown>, userId?: string) {
  await upsertJsonSetting(BRANDING_KEY, payload as Prisma.InputJsonValue, userId);
  return payload;
}
