/**
 * Architecture-only ESLint configuration.
 *
 * SCOPE IS DELIBERATELY MINIMAL. This config enables exactly one rule: the entitlement-boundary
 * import restriction. It intentionally does NOT extend `eslint:recommended` or the TypeScript
 * plugin presets — the repository has never had an ESLint config, so turning on a preset here
 * would surface a large backlog of pre-existing style findings and bury the one rule that is
 * actually about correctness. Adding broader linting is a separate, deliberate piece of work.
 *
 * SECOND NET, NOT THE NET. There is no CI in this repository, so the primary enforcement of this
 * boundary is `src/architecture.entitlements-boundary.test.ts`, which runs with the normal test
 * suite and also catches patterns imports cannot express (`prisma.subscriptions` queries,
 * `plan_type` comparisons, re-implemented trial expiry, restated membership limits).
 *
 * THE RULE: a feature module must not decide membership permissions from billing internals.
 * Authorization goes through the entitlements public API (`modules/entitlements`).
 *
 * Areas that legitimately use billing data are excluded below:
 *   - modules/billing       money: prices, minutes, PAYG rates, Stripe
 *   - modules/admin         admin reporting and membership management
 *   - modules/entitlements  the engine itself
 *   - modules/users         user-facing subscription display (/users/me)
 *   - plugins               auth resolves signup_type (account flow, not authorization)
 *   - scripts, config       operational scripts and client construction
 */

const BILLING_INTERNALS_MESSAGE =
  'Feature modules must not derive membership permissions from billing internals. ' +
  'Use the entitlements public API instead: ' +
  "import { getMembershipEntitlements, requireEntitlement } from '<...>/modules/entitlements'. " +
  'See modules/entitlements/index.ts for the architecture rule.';

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js', '*.cjs'],
  rules: {},
  overrides: [
    {
      // Every source file...
      files: ['src/**/*.ts'],
      // ...except the areas that legitimately own or display billing data, and tests, which may
      // mock anything.
      excludedFiles: [
        'src/modules/billing/**',
        'src/modules/admin/**',
        'src/modules/entitlements/**',
        'src/modules/users/**',
        'src/plugins/**',
        'src/scripts/**',
        'src/config/**',
        'src/**/*.test.ts',
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '../billing',
                message: BILLING_INTERNALS_MESSAGE,
              },
            ],
            patterns: [
              {
                group: [
                  '**/billing/billing.constants',
                  '**/billing/services/subscription.service',
                  '**/billing/services/payg.service',
                  '**/billing/billing.webhook',
                ],
                message: BILLING_INTERNALS_MESSAGE,
              },
            ],
          },
        ],
      },
    },
  ],
};
