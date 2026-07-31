/**
 * Membership Entitlements V1 — admin override hook.
 *
 * SCOPE: this file is a hook and nothing more. Phase 1 ships no admin endpoint, no storage, no
 * default provider, and no UI — per the project brief ("Support admin override hooks. Do NOT
 * implement new admin functionality."). With no provider registered, `resolveEntitlementOverride`
 * returns `null` and the resolver behaves exactly as if this file did not exist.
 *
 * A later phase registers a provider once — at application bootstrap — that reads whatever store
 * it chooses (a new table, the currently-dead `feature_flags` table, or an admin-set profile
 * column). The resolver never learns where overrides come from.
 */

import type { EntitlementOverride } from './entitlements.types';

export type EntitlementOverrideProvider = (
  userId: string
) => Promise<EntitlementOverride | null | undefined> | EntitlementOverride | null | undefined;

let provider: EntitlementOverrideProvider | null = null;

/**
 * Install the process-wide override provider. Idempotent by replacement — calling it again
 * replaces the previous provider, which keeps test setup simple and bootstrap order forgiving.
 */
export function registerEntitlementOverrideProvider(next: EntitlementOverrideProvider): void {
  provider = next;
}

/** Remove the provider. Primarily for test teardown. */
export function clearEntitlementOverrideProvider(): void {
  provider = null;
}

export function hasEntitlementOverrideProvider(): boolean {
  return provider !== null;
}

/**
 * Look up an override for a user.
 *
 * NEVER throws and never rejects. An override store being unavailable must degrade to "no
 * override", not to an entitlement lookup failure — otherwise a broken admin table would deny
 * every member in the product.
 */
export async function resolveEntitlementOverride(
  userId: string
): Promise<EntitlementOverride | null> {
  if (!provider) return null;
  try {
    return (await provider(userId)) ?? null;
  } catch (error) {
    console.warn('[entitlements] override provider failed; continuing without override', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
