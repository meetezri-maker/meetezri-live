/**
 * Generates scripts/crisis-hotlines-seed.sql for Supabase SQL Editor.
 * Run: pnpm exec ts-node --transpile-only scripts/generate-crisis-hotlines-sql.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  CRISIS_HOTLINES_BY_COUNTRY,
  buildCrisisResourcesForCountry,
} from '@meetezri/shared';

function esc(value: string | null | undefined): string {
  if (value == null) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function regionBucket(code: string): string {
  if (code === 'US') return 'US';
  if (code === 'CA') return 'CA';
  if (code === 'GB') return 'UK';
  if (code === 'AU') return 'AU';
  if (code === 'PK') return 'PK';
  const eu = new Set([
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
    'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES',
    'SE', 'IS', 'LI', 'NO', 'CH',
  ]);
  if (eu.has(code)) return 'EU';
  return 'GLOBAL';
}

let sql = `-- ============================================================
-- CRISIS HOTLINES — paste into Supabase → SQL Editor → Run
-- ============================================================

-- 1) Tables + profile column
CREATE TABLE IF NOT EXISTS public.crisis_hotline_countries (
  country_code VARCHAR(2) PRIMARY KEY,
  country_name TEXT NOT NULL,
  dial_code TEXT NOT NULL,
  emergency_phone TEXT,
  region_bucket TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.crisis_hotline_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES public.crisis_hotline_countries(country_code) ON DELETE CASCADE,
  resource_key TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  description TEXT,
  url TEXT,
  availability TEXT NOT NULL DEFAULT '24/7',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (country_code, resource_key)
);

CREATE INDEX IF NOT EXISTS crisis_hotline_resources_country_code_idx
  ON public.crisis_hotline_resources(country_code);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS crisis_country_code VARCHAR(2);

-- 2) Countries
`;

for (const [code, entry] of Object.entries(CRISIS_HOTLINES_BY_COUNTRY)) {
  const c = code.toUpperCase();
  sql += `INSERT INTO public.crisis_hotline_countries (country_code, country_name, dial_code, emergency_phone, region_bucket)
VALUES (${esc(c)}, ${esc(entry.countryName)}, ${esc(entry.dialCode)}, ${esc(entry.emergencyPhone ?? null)}, ${esc(regionBucket(c))})
ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  dial_code = EXCLUDED.dial_code,
  emergency_phone = EXCLUDED.emergency_phone,
  region_bucket = EXCLUDED.region_bucket,
  updated_at = timezone('utc', now());

`;
}

sql += `-- 3) Resources
`;

for (const code of Object.keys(CRISIS_HOTLINES_BY_COUNTRY)) {
  const c = code.toUpperCase();
  const resources = buildCrisisResourcesForCountry(c);
  for (let i = 0; i < resources.length; i++) {
    const r = resources[i];
    sql += `INSERT INTO public.crisis_hotline_resources (country_code, resource_key, resource_type, name, phone, description, url, availability, sort_order)
VALUES (${esc(c)}, ${esc(r.id)}, ${esc(r.type)}, ${esc(r.name)}, ${esc(r.phone ?? null)}, ${esc(r.description)}, ${esc(r.url ?? null)}, ${esc(r.availability)}, ${i})
ON CONFLICT (country_code, resource_key) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  availability = EXCLUDED.availability,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

`;
  }
}

sql += `-- 4) Verify (should show 52 countries)
SELECT c.country_code, c.country_name, count(r.id) AS resource_count
FROM public.crisis_hotline_countries c
LEFT JOIN public.crisis_hotline_resources r ON r.country_code = c.country_code
GROUP BY c.country_code, c.country_name
ORDER BY c.country_code;
`;

const outPath = path.join(__dirname, 'crisis-hotlines-seed.sql');
fs.writeFileSync(outPath, sql, 'utf8');
console.log(`Wrote ${outPath} (${sql.length} characters)`);
