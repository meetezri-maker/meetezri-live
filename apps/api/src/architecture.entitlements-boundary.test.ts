/**
 * PHASE 2B — mechanical architecture protection for the entitlement boundary.
 *
 * THE RULE (previously documentation only, in `modules/entitlements/index.ts`):
 *
 *   A feature module MUST NOT decide membership permissions by importing `PLAN_LIMITS`, importing
 *   the billing subscription service, querying `prisma.subscriptions`, comparing `plan_type`,
 *   reimplementing trial expiry, or restating an approved membership limit. Authorization goes
 *   through the entitlements public API.
 *
 * This test is the primary enforcement mechanism rather than the ESLint rule that ships alongside
 * it (`.eslintrc.cjs`), for one practical reason: the repository has no CI, so `jest` is the only
 * check that actually runs. Lint is a second net, not the net.
 *
 * BASELINE + RATCHET. Billing, admin, users, entitlements and the auth plugin legitimately use
 * billing data — for money, admin tooling, and user-facing subscription display. Those are
 * allow-listed by directory. Anything else is a violation unless it appears in
 * `DOCUMENTED_EXCEPTIONS` with a stated reason. New coupling fails; existing display-only code
 * keeps working.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const SRC_ROOT = join(__dirname);

// ---------------------------------------------------------------------------
// Allowed zones
// ---------------------------------------------------------------------------

/**
 * Directories permitted to touch billing data directly.
 *
 * Deliberately NOT a blanket allowance for anything that "displays" something — each entry is a
 * whole area with a standing reason, and everything outside them is closed by default.
 */
const ALLOWED_PREFIXES: Array<{ path: string; reason: string }> = [
  { path: 'modules/billing', reason: 'the financial authority: prices, minutes, PAYG rates, Stripe' },
  { path: 'modules/admin', reason: 'admin reporting and membership management tooling' },
  { path: 'modules/entitlements', reason: 'the entitlement engine itself' },
  { path: 'modules/users', reason: 'user-facing subscription display (/users/me)' },
  { path: 'plugins', reason: 'auth plugin resolves signup_type, which is account-flow, not membership authorization' },
  { path: 'scripts', reason: 'operational scripts and migrations' },
  { path: 'config', reason: 'client construction (Stripe/Supabase)' },
  {
    path: 'test-integration',
    reason:
      'integration-test infrastructure: factories seed subscription rows so the SERVICE under test ' +
      'resolves a real membership. It never makes an authorization decision, and it ships no ' +
      'production code path.',
  },
];

/**
 * Per-file exceptions outside the allowed zones. Each needs a reason, and each is display-only —
 * none of them makes an authorization decision.
 */
const DOCUMENTED_EXCEPTIONS: Array<{ file: string; rule: string; reason: string }> = [
  {
    file: 'modules/community/community.service.ts',
    rule: 'subscriptions-query',
    reason:
      'Reads the newest subscription solely to render a plan label on a community profile badge. Display only — no branch, no gate.',
  },
];

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

interface Rule {
  id: string;
  description: string;
  test: (source: string) => boolean;
}

/**
 * Strip comments before scanning.
 *
 * Essential, not cosmetic: the compliant modules document the rule in prose ("never from
 * `plan_type`"), and matching those comments would make correct code fail.
 */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

export const ARCHITECTURE_RULES: Rule[] = [
  {
    id: 'plan-limits-import',
    description: 'imports PLAN_LIMITS (authorization must not read the pricing table)',
    test: (s) => /import[\s\S]{0,200}?\bPLAN_LIMITS\b[\s\S]{0,200}?from/.test(s),
  },
  {
    id: 'subscription-service-import',
    description: 'imports the billing subscription service or barrel',
    test: (s) =>
      /from\s+['"][^'"]*billing\/services\/subscription\.service['"]/.test(s) ||
      /from\s+['"][^'"]*\.\.\/billing['"]/.test(s),
  },
  {
    id: 'subscriptions-query',
    description: 'queries prisma.subscriptions directly',
    test: (s) => /\b(?:prisma|tx|client|db)\s*\.\s*subscriptions\s*\./.test(s) || /\bsubscriptions:\s*\{/.test(s),
  },
  {
    id: 'plan-type-comparison',
    description: 'compares plan_type directly',
    test: (s) => /\bplan_type\s*[=!]==?/.test(s) || /\bplan_type\s*\)?\s*===/.test(s),
  },
  {
    id: 'trial-expiry-reimplementation',
    description: 'reimplements trial-expiry policy (compares end_date against the clock)',
    /**
     * Detects the POLICY — a SUBSCRIPTION `end_date` compared against the clock.
     *
     * Two things are deliberately not matched:
     *
     *   - The copy. "Your trial has expired." legitimately lives at the gate that REPORTS the
     *     decision (`sessions.service.ts`), which now asks the engine for `status === 'EXPIRED'`.
     *     Flagging the message would fail the very file that was migrated to do the right thing.
     *
     *   - Other `end_date` columns. `wellness_challenges.end_date` is a challenge programme
     *     window, not a membership lapse; the active-challenge predicate must be free to filter
     *     on it. Hence the subscription-flavoured identifier requirement.
     */
    test: (s) => {
      const subscriptionEndDate = String.raw`\w*(?:sub|subscription|trial|membership)\w*\.end_date`;
      return (
        new RegExp(String.raw`new Date\([^)]*\)\s*[<>]=?\s*${subscriptionEndDate}`, 'i').test(s) ||
        new RegExp(String.raw`${subscriptionEndDate}\s*[<>]=?\s*(?:now\b|new Date\()`, 'i').test(s)
      );
    },
  },
  {
    id: 'duplicated-membership-limit',
    description: 'restates an approved membership limit as a literal',
    test: (s) => /\bmaxActiveChallenges\s*[:=]\s*\d/.test(s),
  },
];

// ---------------------------------------------------------------------------
// Repo walk
// ---------------------------------------------------------------------------

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      listSourceFiles(full, acc);
      continue;
    }
    if (!entry.endsWith('.ts')) continue;
    if (entry.endsWith('.test.ts')) continue; // tests may mock anything
    acc.push(full);
  }
  return acc;
}

function toPosix(p: string): string {
  return p.split(sep).join('/');
}

function isAllowed(relPath: string): boolean {
  return ALLOWED_PREFIXES.some((a) => relPath.startsWith(`${a.path}/`) || relPath === a.path);
}

function hasException(relPath: string, ruleId: string): boolean {
  return DOCUMENTED_EXCEPTIONS.some((e) => e.file === relPath && e.rule === ruleId);
}

interface Violation {
  file: string;
  rule: string;
  description: string;
}

export function findViolations(): Violation[] {
  const violations: Violation[] = [];

  for (const file of listSourceFiles(SRC_ROOT)) {
    const relPath = toPosix(relative(SRC_ROOT, file));
    if (isAllowed(relPath)) continue;

    const source = stripComments(readFileSync(file, 'utf8'));

    for (const rule of ARCHITECTURE_RULES) {
      if (!rule.test(source)) continue;
      if (hasException(relPath, rule.id)) continue;
      violations.push({ file: relPath, rule: rule.id, description: rule.description });
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// The repository must be clean
// ---------------------------------------------------------------------------

describe('entitlement boundary — repository state', () => {
  it('has no feature module bypassing the entitlement engine', () => {
    const violations = findViolations();

    const rendered = violations.map((v) => `  ${v.file} -> ${v.rule}: ${v.description}`).join('\n');
    expect(rendered).toBe('');
  });

  it('keeps the challenge module free of billing coupling', () => {
    const wellness = stripComments(
      readFileSync(join(SRC_ROOT, 'modules/wellness/wellness.service.ts'), 'utf8')
    );

    expect(/\bPLAN_LIMITS\b/.test(wellness)).toBe(false);
    expect(/\bplan_type\s*[=!]==?/.test(wellness)).toBe(false);
    expect(/\bprisma\s*\.\s*subscriptions\b/.test(wellness)).toBe(false);
    // It must consume the engine instead.
    expect(wellness).toMatch(/from '\.\.\/entitlements'/);
  });

  it('has exactly one entitlement resolver and one active-count predicate', () => {
    const files = listSourceFiles(SRC_ROOT);
    const count = (needle: RegExp) =>
      files.filter((f) => needle.test(readFileSync(f, 'utf8'))).length;

    expect(count(/export function resolveEntitlements/)).toBe(1);
    expect(count(/export async function getMembershipEntitlements/)).toBe(1);
    expect(count(/export async function getActiveChallengeCount/)).toBe(1);
  });

  it('has no reverse dependency from entitlements to a feature module', () => {
    const entitlements = listSourceFiles(join(SRC_ROOT, 'modules/entitlements'));

    for (const file of entitlements) {
      const source = stripComments(readFileSync(file, 'utf8'));
      const imports = source.match(/from\s+['"]([^'"]+)['"]/g) ?? [];
      for (const imp of imports) {
        expect(imp).not.toMatch(/wellness|journal|moods|sleep|community|goals|habits|sessions/);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The detector itself must work
// ---------------------------------------------------------------------------

describe('entitlement boundary — detector', () => {
  const forbidden: Array<[string, string]> = [
    ['plan-limits-import', `import { PLAN_LIMITS } from '../billing/billing.constants';`],
    [
      'subscription-service-import',
      `import { getSubscription } from '../billing/services/subscription.service';`,
    ],
    ['subscriptions-query', `const s = await prisma.subscriptions.findFirst({ where: { user_id } });`],
    ['plan-type-comparison', `if (sub.plan_type === 'pro') { allow(); }`],
    ['trial-expiry-reimplementation', `if (new Date() > sub.end_date) { deny(); }`],
    ['duplicated-membership-limit', `const maxActiveChallenges = 3;`],
  ];

  it.each(forbidden)('flags a forbidden fixture: %s', (ruleId, fixture) => {
    const rule = ARCHITECTURE_RULES.find((r) => r.id === ruleId)!;
    expect(rule.test(stripComments(fixture))).toBe(true);
  });

  it('does not flag a feature module consuming the public entitlements API', () => {
    const approved = `
      import { getMembershipEntitlements, requireEntitlement } from '../entitlements';

      export async function doThing(userId: string) {
        const entitlements = await getMembershipEntitlements(userId);
        requireEntitlement(entitlements, 'canUseAI');
      }
    `;

    for (const rule of ARCHITECTURE_RULES) {
      expect({ rule: rule.id, flagged: rule.test(stripComments(approved)) }).toEqual({
        rule: rule.id,
        flagged: false,
      });
    }
  });

  it('flags the expiry POLICY but not the expiry MESSAGE', () => {
    const rule = ARCHITECTURE_RULES.find((r) => r.id === 'trial-expiry-reimplementation')!;

    // Reporting a decision the engine made is correct — this is what `sessions.service.ts` does.
    const reportsDecision = `
      if (entitlements.status === 'EXPIRED') {
        badRequest('Your trial has expired. Please upgrade to continue.');
      }
    `;
    expect(rule.test(stripComments(reportsDecision))).toBe(false);

    // Computing the decision locally is the violation.
    expect(rule.test(`if (new Date() > latestTrialSubscription.end_date) deny();`)).toBe(true);
    expect(rule.test(`if (sub.end_date < now) deny();`)).toBe(true);
  });

  it('does not flag a challenge programme window, which is a different end_date', () => {
    const rule = ARCHITECTURE_RULES.find((r) => r.id === 'trial-expiry-reimplementation')!;

    // `wellness_challenges.end_date` bounds a challenge, not a membership. The active-challenge
    // predicate must stay free to filter on it.
    expect(rule.test(`AND c.end_date >= now()`)).toBe(false);
    expect(rule.test(`challenge.end_date < new Date()`)).toBe(false);
  });

  it('does not flag prose that merely mentions the forbidden constructs', () => {
    // The compliant modules document this rule in comments; matching those would fail correct code.
    const documented = `
      // Membership authorization comes from the entitlement engine only — never from plan_type,
      // PLAN_LIMITS, or prisma.subscriptions.
      /* We must not compare plan_type === 'pro' here. */
      import { getMembershipEntitlements } from '../entitlements';
    `;

    for (const rule of ARCHITECTURE_RULES) {
      expect({ rule: rule.id, flagged: rule.test(stripComments(documented)) }).toEqual({
        rule: rule.id,
        flagged: false,
      });
    }
  });

  it('allows billing to use its own financial configuration', () => {
    expect(isAllowed('modules/billing/services/payg.service.ts')).toBe(true);
    expect(isAllowed('modules/billing/billing.webhook.ts')).toBe(true);
  });

  it('allows admin reporting and user-facing subscription display', () => {
    expect(isAllowed('modules/admin/admin.service.ts')).toBe(true);
    expect(isAllowed('modules/users/user.service.ts')).toBe(true);
  });

  it('allows the entitlements module to read the subscription service', () => {
    expect(isAllowed('modules/entitlements/entitlements.service.ts')).toBe(true);
  });

  it('closes every other module by default', () => {
    for (const closed of [
      'modules/wellness/wellness.service.ts',
      'modules/journal/journal.service.ts',
      'modules/moods/moods.service.ts',
      'modules/sleep/sleep.service.ts',
      'modules/community/community.service.ts',
      'modules/goals/goals.service.ts',
      'modules/sessions/sessions.service.ts',
    ]) {
      expect(isAllowed(closed)).toBe(false);
    }
  });

  it('keeps every documented exception justified and display-only', () => {
    for (const exception of DOCUMENTED_EXCEPTIONS) {
      expect(exception.reason.length).toBeGreaterThan(40);
      expect(ARCHITECTURE_RULES.map((r) => r.id)).toContain(exception.rule);
    }
  });
});
