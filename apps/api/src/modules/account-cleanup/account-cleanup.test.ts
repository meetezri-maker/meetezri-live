import { readFileSync } from 'fs';
import path from 'path';
import { CleanupAdapter, CleanupInventory, runAccountCleanup } from './account-cleanup';
import { parseAllowlistTsv } from './account-cleanup.allowlist';

const entries = parseAllowlistTsv(readFileSync(path.resolve(__dirname, '../../../scripts/account-cleanup/delete-account-allowlist.tsv'), 'utf8'));
const baseInventory: CleanupInventory = {
  counts: { auth_users_total: 1000 },
  profiles: entries,
  authUsers: entries,
  storageObjects: [{ bucketId: 'avatars', name: 'safe.png', ownerId: entries[0].id }],
  authDeletionIds: entries.map((entry) => entry.id),
  purchasedBalances: [],
  community: { postIds: [], posts: 26, nonTargetLikes: 1, nonTargetViews: 107, nonTargetComments: 0 },
  globalReferences: 49,
};

function adapter(inventory: CleanupInventory = baseInventory): jest.Mocked<CleanupAdapter> {
  return {
    inspect: jest.fn().mockResolvedValue(inventory),
    exportManifest: jest.fn().mockResolvedValue(undefined),
    anonymizeCommunityPosts: jest.fn().mockResolvedValue(undefined),
    nullGlobalReferences: jest.fn().mockResolvedValue(undefined),
    deleteStorageObjects: jest.fn().mockResolvedValue(undefined),
    verifyStorageEmpty: jest.fn().mockResolvedValue(undefined),
    deleteApplicationDataAndProfiles: jest.fn().mockResolvedValue(undefined),
    hardDeleteAuthUsers: jest.fn().mockResolvedValue(undefined),
    verifyFinalState: jest.fn().mockResolvedValue(undefined),
  };
}

describe('account cleanup orchestration', () => {
  test('dry-run performs zero database, Storage, or Auth mutation calls', async () => {
    const a = adapter();
    const manifest = await runAccountCleanup(entries, a, { now: () => new Date('2026-10-20T00:00:00Z') });
    expect(manifest.mode).toBe('dry-run');
    expect(a.exportManifest).toHaveBeenCalledTimes(1);
    for (const write of [a.anonymizeCommunityPosts, a.nullGlobalReferences, a.deleteStorageObjects, a.deleteApplicationDataAndProfiles, a.hardDeleteAuthUsers]) expect(write).not.toHaveBeenCalled();
  });
  test('non-allowlisted Storage owner can never be selected', async () => {
    const bad = { ...baseInventory, storageObjects: [{ bucketId: 'avatars', name: 'bad.png', ownerId: '11111111-1111-4111-8111-111111111111' }] };
    await expect(runAccountCleanup(entries, adapter(bad))).rejects.toThrow('Storage deletion list contains non-allowlisted');
  });
  test('non-allowlisted Auth UUID can never be selected', async () => {
    const bad = { ...baseInventory, authDeletionIds: [...baseInventory.authDeletionIds.slice(1), '11111111-1111-4111-8111-111111111111'] };
    await expect(runAccountCleanup(entries, adapter(bad))).rejects.toThrow('Auth deletion list contains non-allowlisted');
  });
  test('apply requires all three gates before any destructive call', async () => {
    const a = adapter();
    await expect(runAccountCleanup(entries, a, { apply: true })).rejects.toThrow('--confirm-production');
    expect(a.anonymizeCommunityPosts).not.toHaveBeenCalled();
  });
  test('apply preserves approved counts and uses only allowlisted deletion inputs', async () => {
    const a = adapter();
    const manifest = await runAccountCleanup(entries, a, { apply: true, confirmProduction: true, actor: '22222222-2222-4222-8222-222222222222' });
    expect(manifest.inventory.community).toMatchObject({ posts: 26, nonTargetLikes: 1, nonTargetViews: 107, nonTargetComments: 0 });
    expect(manifest.inventory.globalReferences).toBe(49);
    expect(a.deleteStorageObjects).toHaveBeenCalledWith(baseInventory.storageObjects);
    expect(a.hardDeleteAuthUsers).toHaveBeenCalledWith(entries.map((entry) => entry.id));
  });
});
