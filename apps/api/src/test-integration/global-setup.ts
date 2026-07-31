/**
 * Jest `globalSetup` for the integration project — runs ONCE before any integration suite.
 *
 * Migrating per-suite would be slow and would race between workers, so bootstrap happens here and
 * the suites assume a ready schema.
 */

import { bootstrapIntegrationDatabase } from './bootstrap';

export default async function globalSetup(): Promise<void> {
  const info = await bootstrapIntegrationDatabase();
  // eslint-disable-next-line no-console
  console.log(`[integration] ready: ${info.host}:${info.port}/${info.database}`);
}
