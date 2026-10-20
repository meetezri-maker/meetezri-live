/**
 * One-time SOLACE allowlisted account cleanup.
 *
 * DEFAULT: read-only dry-run. This file contains no cohort discovery logic: deletion
 * targets come only from delete-account-allowlist.tsv after canonical hash checks.
 *
 * Apply is intentionally gated:
 *   pnpm --filter @meetezri/api exec ts-node-dev --transpile-only --no-notify --exit-child \
 *     scripts/account-cleanup/delete-allowlisted-accounts.ts \
 *     --apply --confirm-production --actor=<admin-user-id>
 *
 * Never invokes Stripe. Storage objects are removed through the Storage API.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { Pool, PoolClient } from 'pg';
import {
  AllowlistEntry,
  parseAllowlistTsv,
} from '../../src/modules/account-cleanup/account-cleanup.allowlist';
import {
  CleanupAdapter,
  CleanupInventory,
  CleanupManifest,
  DELETED_AUTHOR_NAME,
  DELETED_POST_CONTENT,
  StorageObject,
  runAccountCleanup,
} from '../../src/modules/account-cleanup/account-cleanup';

type AdminClient = {
  storage: { from(bucket: string): { remove(paths: string[]): Promise<{ error: { message: string } | null }> } };
  auth: { admin: { deleteUser(id: string, shouldSoftDelete?: boolean): Promise<{ error: { message: string } | null }> } };
};

type Link = {
  schema_name: string;
  table_name: string;
  column_name: string;
  is_nullable: 'YES' | 'NO';
  delete_action: string | null;
  has_profile_fk: boolean;
};

const GLOBAL_REFERENCES = [
  ['public', 'admin_backup_records', 'created_by'],
  ['public', 'system_settings', 'updated_by'],
  ['public', 'nudges', 'created_by'],
  ['public', 'nudge_templates', 'created_by'],
] as const;

const SOFT_DELETE_REFERENCES = new Set([
  'public.payment_transactions.user_id',
  'public.stripe_webhook_events.user_id',
  'public.subscription_cleanup_archive.user_id',
]);

const q = (identifier: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) throw new Error(`Unsafe SQL identifier: ${identifier}`);
  return `"${identifier}"`;
};
const n = (value: unknown) => Number(value ?? 0);

class PostgresCleanupAdapter implements CleanupAdapter {
  private links: Link[] = [];
  constructor(
    private readonly pool: Pool,
    private readonly supabase: AdminClient,
    private readonly manifestPath: string
  ) {}

  private async discoverLinks(): Promise<Link[]> {
    const result = await this.pool.query<Link>(`
      WITH profile_fks AS (
        SELECT ns.nspname AS schema_name, cl.relname AS table_name, a.attname AS column_name,
               CASE c.confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
                 WHEN 'r' THEN 'RESTRICT' ELSE 'NO ACTION' END AS delete_action
        FROM pg_constraint c
        JOIN pg_class cl ON cl.oid = c.conrelid
        JOIN pg_namespace ns ON ns.oid = cl.relnamespace
        JOIN pg_class fcl ON fcl.oid = c.confrelid
        JOIN pg_namespace fns ON fns.oid = fcl.relnamespace
        JOIN LATERAL unnest(c.conkey) WITH ORDINALITY ck(attnum, ord) ON true
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ck.attnum
        WHERE c.contype = 'f' AND fns.nspname = 'public' AND fcl.relname = 'profiles'
      )
      SELECT cols.table_schema AS schema_name, cols.table_name, cols.column_name,
             cols.is_nullable, pf.delete_action, (pf.column_name IS NOT NULL) AS has_profile_fk
      FROM information_schema.columns cols
      LEFT JOIN profile_fks pf
        ON pf.schema_name = cols.table_schema AND pf.table_name = cols.table_name
       AND pf.column_name = cols.column_name
      WHERE cols.table_schema = 'public'
        AND cols.data_type = 'uuid'
        AND (
          pf.column_name IS NOT NULL OR
          cols.column_name IN ('user_id', 'author_user_id', 'created_by', 'updated_by', 'actor_id', 'assigned_to', 'companion_id')
        )
      ORDER BY 1, 2, 3
    `);
    return result.rows;
  }

  private async countByLink(link: Link, ids: readonly string[], client: Pool | PoolClient = this.pool): Promise<number> {
    const result = await client.query(
      `SELECT COUNT(*)::bigint AS count FROM ${q(link.schema_name)}.${q(link.table_name)}
       WHERE ${q(link.column_name)} = ANY($1::uuid[])`,
      [ids]
    );
    return n(result.rows[0]?.count);
  }

  async inspect(entries: readonly AllowlistEntry[]): Promise<CleanupInventory> {
    const ids = entries.map((entry) => entry.id);
    const [profiles, authUsers, storage, balances] = await Promise.all([
      this.pool.query('SELECT id::text, email FROM public.profiles WHERE id = ANY($1::uuid[]) ORDER BY id', [ids]),
      this.pool.query('SELECT id::text, email FROM auth.users WHERE id = ANY($1::uuid[]) ORDER BY id', [ids]),
      this.pool.query(
        `SELECT bucket_id AS "bucketId", name, owner_id::text AS "ownerId"
         FROM storage.objects WHERE owner_id = ANY($1::text[]) ORDER BY bucket_id, name`,
        [ids]
      ),
      this.pool.query(
        `SELECT id::text, credits, credits_seconds AS "creditsSeconds",
                purchased_credits AS "purchasedCredits",
                purchased_credits_seconds AS "purchasedCreditsSeconds"
         FROM public.profiles
         WHERE id = ANY($1::uuid[])
           AND (COALESCE(purchased_credits,0) <> 0 OR COALESCE(purchased_credits_seconds,0) <> 0)
         ORDER BY id`,
        [ids]
      ),
    ]);

    this.links = await this.discoverLinks();
    const counts: Record<string, number> = {};
    for (const link of this.links) {
      const count = await this.countByLink(link, ids);
      const key = `${link.schema_name}.${link.table_name}.${link.column_name}`;
      if (count > 0) counts[key] = count;
      const classified =
        link.has_profile_fk ||
        key === 'public.community_post_author_snapshots.author_user_id' ||
        SOFT_DELETE_REFERENCES.has(key) ||
        GLOBAL_REFERENCES.some(([schema, table, column]) => key === `${schema}.${table}.${column}`);
      if (count > 0 && !classified) throw new Error(`Unclassified user-linked rows block cleanup: ${key}=${count}`);
    }

    const [authCounts, community, globals, totals] = await Promise.all([
      this.pool.query(
        `SELECT
          (SELECT COUNT(*) FROM auth.identities WHERE user_id = ANY($1::uuid[]))::bigint AS identities,
          (SELECT COUNT(*) FROM auth.sessions WHERE user_id = ANY($1::uuid[]))::bigint AS sessions,
          (SELECT COUNT(*) FROM auth.refresh_tokens WHERE user_id = ANY($2::text[]))::bigint AS refresh_tokens,
          (SELECT COUNT(*) FROM public.session_messages m JOIN public.app_sessions a ON a.id=m.session_id WHERE a.user_id=ANY($1::uuid[]))::bigint AS session_messages`,
        [ids, ids]
      ),
      this.pool.query(
        `WITH target_posts AS (
           SELECT id FROM public.community_posts WHERE user_id = ANY($1::uuid[])
         )
         SELECT
           (SELECT COALESCE(array_agg(id::text ORDER BY id), ARRAY[]::text[]) FROM target_posts) AS post_ids,
           (SELECT COUNT(*) FROM target_posts)::bigint AS posts,
           (SELECT COUNT(*) FROM public.community_post_likes l JOIN target_posts p ON p.id=l.post_id WHERE NOT (l.user_id = ANY($1::uuid[])))::bigint AS non_target_likes,
           (SELECT COUNT(*) FROM public.community_post_views v JOIN target_posts p ON p.id=v.post_id WHERE NOT (v.user_id = ANY($1::uuid[])))::bigint AS non_target_views,
           (SELECT COUNT(*) FROM public.community_comments c JOIN target_posts p ON p.id=c.post_id WHERE NOT (c.user_id = ANY($1::uuid[])))::bigint AS non_target_comments`,
        [ids]
      ),
      this.pool.query(
        `SELECT
          (SELECT COUNT(*) FROM public.admin_backup_records WHERE created_by = ANY($1::uuid[])) +
          (SELECT COUNT(*) FROM public.system_settings WHERE updated_by = ANY($1::uuid[])) +
          (SELECT COUNT(*) FROM public.nudges WHERE created_by = ANY($1::uuid[])) +
          (SELECT COUNT(*) FROM public.nudge_templates WHERE created_by = ANY($1::uuid[])) AS count`,
        [ids]
      ),
      this.pool.query(
        `SELECT
          (SELECT COUNT(*) FROM public.profiles)::bigint AS profiles_total,
          (SELECT COUNT(*) FROM auth.users)::bigint AS auth_users_total`
      ),
    ]);

    counts['auth.identities.user_id'] = n(authCounts.rows[0].identities);
    counts['auth.sessions.user_id'] = n(authCounts.rows[0].sessions);
    counts['auth.refresh_tokens.user_id'] = n(authCounts.rows[0].refresh_tokens);
    counts['public.session_messages.via_app_sessions'] = n(authCounts.rows[0].session_messages);
    counts['storage.objects.owner_id'] = storage.rowCount ?? storage.rows.length;
    counts.profiles_total = n(totals.rows[0].profiles_total);
    counts.auth_users_total = n(totals.rows[0].auth_users_total);

    const c = community.rows[0];
    const inventory: CleanupInventory = {
      counts,
      profiles: profiles.rows,
      authUsers: authUsers.rows,
      storageObjects: storage.rows,
      authDeletionIds: authUsers.rows.map((row) => row.id),
      purchasedBalances: balances.rows,
      community: {
        postIds: c.post_ids,
        posts: n(c.posts),
        nonTargetLikes: n(c.non_target_likes),
        nonTargetViews: n(c.non_target_views),
        nonTargetComments: n(c.non_target_comments),
      },
      globalReferences: n(globals.rows[0].count),
    };
    this.lastInventory = inventory;
    return inventory;
  }

  async exportManifest(manifest: CleanupManifest): Promise<void> {
    await mkdir(path.dirname(this.manifestPath), { recursive: true });
    await writeFile(this.manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  }

  async anonymizeCommunityPosts(ids: readonly string[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const before = await client.query(
        `WITH p AS (SELECT id FROM public.community_posts WHERE user_id = ANY($1::uuid[]))
         SELECT
           (SELECT COUNT(*) FROM public.community_post_likes x JOIN p ON p.id=x.post_id WHERE NOT (x.user_id = ANY($1::uuid[])))::bigint AS likes,
           (SELECT COUNT(*) FROM public.community_post_views x JOIN p ON p.id=x.post_id WHERE NOT (x.user_id = ANY($1::uuid[])))::bigint AS views,
           (SELECT COUNT(*) FROM public.community_comments x JOIN p ON p.id=x.post_id WHERE NOT (x.user_id = ANY($1::uuid[])))::bigint AS comments`,
        [ids]
      );
      await client.query(
        `UPDATE public.community_post_author_snapshots s
         SET author_user_id = NULL, author_name = $2, author_avatar_url = NULL
         FROM public.community_posts p
         WHERE p.id = s.post_id AND p.user_id = ANY($1::uuid[])`,
        [ids, DELETED_AUTHOR_NAME]
      );
      const updated = await client.query(
        `UPDATE public.community_posts
         SET user_id = NULL, content = $2, tags = ARRAY[]::text[]
         WHERE user_id = ANY($1::uuid[])`,
        [ids, DELETED_POST_CONTENT]
      );
      const after = await client.query(
        `SELECT
           (SELECT COUNT(*) FROM public.community_post_likes l JOIN public.community_posts p ON p.id=l.post_id WHERE p.content=$2 AND NOT (l.user_id = ANY($1::uuid[])))::bigint AS likes,
           (SELECT COUNT(*) FROM public.community_post_views v JOIN public.community_posts p ON p.id=v.post_id WHERE p.content=$2 AND NOT (v.user_id = ANY($1::uuid[])))::bigint AS views,
           (SELECT COUNT(*) FROM public.community_comments c JOIN public.community_posts p ON p.id=c.post_id WHERE p.content=$2 AND NOT (c.user_id = ANY($1::uuid[])))::bigint AS comments`,
        [ids, DELETED_POST_CONTENT]
      );
      for (const key of ['likes', 'views', 'comments']) {
        if (n(before.rows[0][key]) !== n(after.rows[0][key])) throw new Error(`Community ${key} preservation check failed`);
      }
      if (updated.rowCount !== this.expectedCommunityPosts()) throw new Error(`Community post count changed since dry-run: ${updated.rowCount}`);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK'); throw error;
    } finally { client.release(); }
  }

  private expectedCommunityPosts(): number {
    const value = this.lastInventory?.community.posts;
    if (value === undefined) throw new Error('Missing pre-delete inventory');
    return value;
  }
  private lastInventory: CleanupInventory | null = null;

  async nullGlobalReferences(ids: readonly string[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      let changed = 0;
      for (const [schema, table, column] of GLOBAL_REFERENCES) {
        const result = await client.query(`UPDATE ${q(schema)}.${q(table)} SET ${q(column)}=NULL WHERE ${q(column)}=ANY($1::uuid[])`, [ids]);
        changed += result.rowCount ?? 0;
      }
      if (changed !== this.lastInventory?.globalReferences) throw new Error(`Global reference count changed since dry-run: ${changed}`);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async deleteStorageObjects(objects: readonly StorageObject[]): Promise<void> {
    const byBucket = new Map<string, string[]>();
    for (const object of objects) byBucket.set(object.bucketId, [...(byBucket.get(object.bucketId) ?? []), object.name]);
    for (const [bucket, names] of byBucket) {
      for (let offset = 0; offset < names.length; offset += 1000) {
        const { error } = await this.supabase.storage.from(bucket).remove(names.slice(offset, offset + 1000));
        if (error) throw error;
      }
    }
  }

  async verifyStorageEmpty(ids: readonly string[]): Promise<void> {
    const result = await this.pool.query('SELECT COUNT(*)::bigint AS count FROM storage.objects WHERE owner_id = ANY($1::text[])', [ids]);
    if (n(result.rows[0].count) !== 0) throw new Error('Target-owned Storage objects remain');
  }

  async deleteApplicationDataAndProfiles(ids: readonly string[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const link of this.links) {
        const key = `${link.schema_name}.${link.table_name}.${link.column_name}`;
        if (key === 'public.community_posts.user_id' || key === 'public.community_post_author_snapshots.author_user_id' || GLOBAL_REFERENCES.some(([s,t,c]) => key === `${s}.${t}.${c}`)) continue;
        if (!link.has_profile_fk && !SOFT_DELETE_REFERENCES.has(key)) {
          const count = await this.countByLink(link, ids, client);
          if (count > 0) throw new Error(`Unclassified user-linked rows block apply: ${key}=${count}`);
          continue;
        }
        if (!link.has_profile_fk && SOFT_DELETE_REFERENCES.has(key)) {
          await client.query(`DELETE FROM ${q(link.schema_name)}.${q(link.table_name)} WHERE ${q(link.column_name)}=ANY($1::uuid[])`, [ids]);
        } else if (link.delete_action === 'NO ACTION' || link.delete_action === 'RESTRICT') {
          if (link.is_nullable === 'YES') await client.query(`UPDATE ${q(link.schema_name)}.${q(link.table_name)} SET ${q(link.column_name)}=NULL WHERE ${q(link.column_name)}=ANY($1::uuid[])`, [ids]);
          else await client.query(`DELETE FROM ${q(link.schema_name)}.${q(link.table_name)} WHERE ${q(link.column_name)}=ANY($1::uuid[])`, [ids]);
        }
      }
      const deleted = await client.query('DELETE FROM public.profiles WHERE id = ANY($1::uuid[])', [ids]);
      if (deleted.rowCount !== ids.length) throw new Error(`Profile delete count mismatch: ${deleted.rowCount}`);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async hardDeleteAuthUsers(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      const { error } = await this.supabase.auth.admin.deleteUser(id, false);
      if (error) throw new Error(`Auth deletion failed for ${id}: ${error.message}`);
    }
  }

  async verifyFinalState(ids: readonly string[], before: CleanupInventory): Promise<void> {
    const result = await this.pool.query(
      `SELECT
        (SELECT COUNT(*) FROM public.profiles WHERE id=ANY($1::uuid[]))::bigint AS profiles,
        (SELECT COUNT(*) FROM auth.users WHERE id=ANY($1::uuid[]))::bigint AS users,
        (SELECT COUNT(*) FROM auth.identities WHERE user_id=ANY($1::uuid[]))::bigint AS identities,
        (SELECT COUNT(*) FROM auth.sessions WHERE user_id=ANY($1::uuid[]))::bigint AS sessions,
        (SELECT COUNT(*) FROM auth.refresh_tokens WHERE user_id=ANY($2::text[]))::bigint AS tokens,
        (SELECT COUNT(*) FROM storage.objects WHERE owner_id=ANY($1::text[]))::bigint AS storage,
        (SELECT COUNT(*) FROM public.community_post_author_snapshots WHERE author_user_id=ANY($1::uuid[]))::bigint AS snapshot_refs,
        (SELECT COUNT(*) FROM public.community_posts WHERE user_id=ANY($1::uuid[]))::bigint AS post_refs,
        (SELECT COUNT(*) FROM auth.users)::bigint AS auth_users_total,
        (SELECT COUNT(*) FROM public.profiles)::bigint AS profiles_total,
        (SELECT COUNT(*) FROM public.community_post_likes WHERE post_id=ANY($3::uuid[]) AND NOT (user_id=ANY($1::uuid[])))::bigint AS preserved_likes,
        (SELECT COUNT(*) FROM public.community_post_views WHERE post_id=ANY($3::uuid[]) AND NOT (user_id=ANY($1::uuid[])))::bigint AS preserved_views,
        (SELECT COUNT(*) FROM public.community_comments WHERE post_id=ANY($3::uuid[]) AND NOT (user_id=ANY($1::uuid[])))::bigint AS preserved_comments`,
      [ids, ids, before.community.postIds]
    );
    const row = result.rows[0];
    for (const key of ['profiles','users','identities','sessions','tokens','storage','snapshot_refs','post_refs']) {
      if (n(row[key]) !== 0) throw new Error(`Final verification failed: ${key}=${row[key]}`);
    }
    if (n(row.auth_users_total) !== before.counts.auth_users_total - ids.length) throw new Error('Non-target Auth account count changed');
    if (n(row.profiles_total) !== before.counts.profiles_total - ids.length) throw new Error('Non-target profile count changed');
    if (n(row.preserved_likes) !== before.community.nonTargetLikes || n(row.preserved_views) !== before.community.nonTargetViews || n(row.preserved_comments) !== before.community.nonTargetComments) throw new Error('Non-target community interaction count changed');
  }

}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const confirmProduction = args.includes('--confirm-production');
  const actor = args.find((arg) => arg.startsWith('--actor='))?.slice('--actor='.length);
  const allowlistPath = path.resolve(__dirname, 'delete-account-allowlist.tsv');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const manifestArg = args.find((arg) => arg.startsWith('--manifest='))?.slice('--manifest='.length);
  const manifestPath = path.resolve(manifestArg ?? `outputs/account-cleanup/pre-delete-manifest-${stamp}.json`);

  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!connectionString || !supabaseUrl || !serviceKey) throw new Error('Missing database or Supabase service credentials');
  const entries = parseAllowlistTsv(await readFile(allowlistPath, 'utf8'));
  const databaseUrl = new URL(connectionString);
  databaseUrl.searchParams.delete('sslmode');
  databaseUrl.searchParams.delete('ssl');
  const pool = new Pool({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: false }, max: 2 });
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const adapter = new PostgresCleanupAdapter(pool, supabase, manifestPath);
  try {
    if (apply) {
      if (!confirmProduction || !actor) throw new Error('Apply mode requires --apply --confirm-production --actor=<admin-user-id>');
      const admin = await pool.query("SELECT id FROM public.profiles WHERE id=$1::uuid AND role IN ('admin','super_admin')", [actor]);
      if (admin.rowCount !== 1) throw new Error('Actor must be an existing admin or super_admin profile');
    }
    const manifest = await runAccountCleanup(entries, adapter, { apply, confirmProduction, actor });
    if (args.includes('--json')) console.log(JSON.stringify({ manifestPath, ...manifest }, null, 2));
    else console.log(JSON.stringify({ manifestPath, mode: manifest.mode, allowlist: manifest.allowlist, counts: manifest.inventory.counts, community: manifest.inventory.community, globalReferences: manifest.inventory.globalReferences, storageObjects: manifest.inventory.storageObjects.length, authUsers: manifest.inventory.authDeletionIds.length, purchasedBalances: manifest.inventory.purchasedBalances }, null, 2));
  } finally { await pool.end(); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
