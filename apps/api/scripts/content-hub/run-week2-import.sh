#!/usr/bin/env bash
#
# Runs the Week 2 importer against the SESSION pooler.
#
# `DATABASE_URL` in .env points at Supabase's TRANSACTION pooler (PgBouncer, port 6543), which
# cannot hold the interactive transactions the Content Hub service layer opens — the Week 1 import
# hit P2028 there. The SESSION pooler can: same pooler host, port 5432, no pgbouncer flag.
#
# It is derived from DATABASE_URL rather than read from DIRECT_URL, because DIRECT_URL still names
# the legacy `db.<ref>.supabase.co` host, which no longer accepts connections from here.
#
# Read-only scripts are unaffected and keep using the default.
#
# Usage:
#   scripts/content-hub/run-week2-import.sh [--apply --confirm-production --actor=<id>]

set -euo pipefail
cd "$(dirname "$0")/../.."

POOLED="$(sed -n 's/^DATABASE_URL=//p' .env | tr -d '"' | head -1)"

if [ -z "$POOLED" ]; then
  echo "REFUSED: DATABASE_URL is not set in .env" >&2
  exit 2
fi

DATABASE_URL="${POOLED/:6543/:5432}"
DATABASE_URL="${DATABASE_URL/pgbouncer=true&/}"
export DATABASE_URL

exec npx ts-node-dev --transpile-only --respawn=false scripts/content-hub/import-week2.ts "$@"
