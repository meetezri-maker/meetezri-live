import { readFileSync } from 'fs';
import path from 'path';

describe('deleted community author database contract', () => {
  const migration = readFileSync(path.resolve(__dirname, '../../../prisma/migrations/20261020120000_nullable_deleted_community_author/migration.sql'), 'utf8');
  const executor = readFileSync(path.resolve(__dirname, '../../../scripts/account-cleanup/delete-allowlisted-accounts.ts'), 'utf8');

  test('profile deletion sets post author NULL instead of cascading the post', () => {
    expect(migration).toContain('ALTER COLUMN "user_id" DROP NOT NULL');
    expect(migration).toContain('ON DELETE SET NULL');
    expect(migration).not.toContain('ON DELETE CASCADE');
  });
  test('anonymization removes personal post and snapshot data', () => {
    expect(executor).toContain('SET author_user_id = NULL, author_name = $2, author_avatar_url = NULL');
    expect(executor).toContain('SET user_id = NULL, content = $2, tags = ARRAY[]::text[]');
  });
  test('executor never deletes non-target likes, views, or comments', () => {
    expect(executor).not.toMatch(/DELETE FROM public\.community_post_(likes|views)/);
    expect(executor).not.toContain('DELETE FROM public.community_comments');
    expect(executor).toContain('Community ${key} preservation check failed');
  });
  test('global rows are preserved by nulling creator references', () => {
    expect(executor).toContain('SET ${q(column)}=NULL');
    expect(executor).not.toMatch(/DELETE FROM public\.(admin_backup_records|system_settings|nudges|nudge_templates)/);
  });
});
