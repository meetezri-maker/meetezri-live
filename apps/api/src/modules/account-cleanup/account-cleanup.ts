import { AllowlistEntry, EXPECTED_ALLOWLIST_COUNT, assertCanonicalAllowlist, assertIdentityMatches, assertOnlyAllowlisted, canonicalAllowlistHashes } from './account-cleanup.allowlist';

export const DELETED_POST_CONTENT = "This post was removed because the author's account was deleted.";
export const DELETED_AUTHOR_NAME = 'Deleted user';
export type StorageObject = Readonly<{ bucketId: string; name: string; ownerId: string }>;
export type CleanupInventory = Readonly<{
  counts: Readonly<Record<string, number>>;
  profiles: readonly { id: string; email: string | null }[];
  authUsers: readonly { id: string; email: string | null }[];
  storageObjects: readonly StorageObject[];
  authDeletionIds: readonly string[];
  purchasedBalances: readonly { id: string; credits: number | null; creditsSeconds: number | null; purchasedCredits: number | null; purchasedCreditsSeconds: number | null }[];
  community: Readonly<{ postIds: readonly string[]; posts: number; nonTargetLikes: number; nonTargetViews: number; nonTargetComments: number }>;
  globalReferences: number;
}>;
export type CleanupManifest = Readonly<{
  mode: 'dry-run' | 'apply'; actor: string | null; generatedAt: string;
  allowlist: { count: number; uuidHash: string; identityHash: string; identityMatches: number };
  businessClarification: { activeRealPaidAccounts: 0; liveFinancialObligations: 0; billingBlocker: 'CLEARED BY BUSINESS CONFIRMATION'; stripeMutationPermitted: false; note: string };
  inventory: CleanupInventory;
  zeroImpact: { nonAllowlistedAccountsSelected: 0; nonAllowlistedDbRowsSelected: 0; nonAllowlistedStorageObjectsSelected: 0 };
}>;
export interface CleanupAdapter {
  inspect(entries: readonly AllowlistEntry[]): Promise<CleanupInventory>;
  exportManifest(manifest: CleanupManifest): Promise<void>;
  anonymizeCommunityPosts(ids: readonly string[]): Promise<void>;
  nullGlobalReferences(ids: readonly string[]): Promise<void>;
  deleteStorageObjects(objects: readonly StorageObject[]): Promise<void>;
  verifyStorageEmpty(ids: readonly string[]): Promise<void>;
  deleteApplicationDataAndProfiles(ids: readonly string[]): Promise<void>;
  hardDeleteAuthUsers(ids: readonly string[]): Promise<void>;
  verifyFinalState(ids: readonly string[], before: CleanupInventory): Promise<void>;
}
export type CleanupOptions = Readonly<{ apply?: boolean; confirmProduction?: boolean; actor?: string; now?: () => Date }>;

export async function runAccountCleanup(rawEntries: readonly AllowlistEntry[], adapter: CleanupAdapter, options: CleanupOptions = {}): Promise<CleanupManifest> {
  const entries = assertCanonicalAllowlist(rawEntries); const ids = entries.map((entry) => entry.id);
  const inventory = await adapter.inspect(entries);
  assertIdentityMatches(entries, inventory.profiles, inventory.authUsers);
  assertOnlyAllowlisted(inventory.storageObjects.map((object) => object.ownerId), entries, 'Storage deletion list');
  assertOnlyAllowlisted(inventory.authDeletionIds, entries, 'Auth deletion list');
  if (inventory.authDeletionIds.length !== EXPECTED_ALLOWLIST_COUNT) throw new Error(`Auth deletion count mismatch: expected ${EXPECTED_ALLOWLIST_COUNT}, got ${inventory.authDeletionIds.length}`);
  const hashes = canonicalAllowlistHashes(entries);
  const manifest: CleanupManifest = {
    mode: options.apply ? 'apply' : 'dry-run', actor: options.actor ?? null, generatedAt: (options.now?.() ?? new Date()).toISOString(),
    allowlist: { count: entries.length, uuidHash: hashes.uuidHash, identityHash: hashes.identityHash, identityMatches: entries.length },
    businessClarification: {
      activeRealPaidAccounts: 0, liveFinancialObligations: 0, billingBlocker: 'CLEARED BY BUSINESS CONFIRMATION', stripeMutationPermitted: false,
      note: 'Business confirmed no live payment method and test-only Stripe activity. No cancellation, refund, or Stripe mutation is authorized.',
    },
    inventory, zeroImpact: { nonAllowlistedAccountsSelected: 0, nonAllowlistedDbRowsSelected: 0, nonAllowlistedStorageObjectsSelected: 0 },
  };
  await adapter.exportManifest(manifest);
  if (!options.apply) return manifest;
  if (!options.confirmProduction || !options.actor) throw new Error('Apply mode requires --apply --confirm-production --actor=<admin-user-id>');
  await adapter.anonymizeCommunityPosts(ids);
  await adapter.nullGlobalReferences(ids);
  // No Supabase admin sign-out-by-user-id API exists. Hard deletion below removes sessions and refresh tokens; issued access JWTs expire naturally.
  await adapter.deleteStorageObjects(inventory.storageObjects);
  await adapter.verifyStorageEmpty(ids);
  await adapter.deleteApplicationDataAndProfiles(ids);
  await adapter.hardDeleteAuthUsers(inventory.authDeletionIds);
  await adapter.verifyFinalState(ids, inventory);
  return manifest;
}
