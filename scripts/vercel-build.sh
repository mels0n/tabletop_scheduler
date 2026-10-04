#!/bin/sh
# ==============================================================================
# Vercel build entrypoint (hosted target: Vercel + Supabase Postgres).
#
# Referenced by vercel.json -> buildCommand, so the hosted build is defined in
# the repo instead of in Vercel project settings where nobody can review it.
#
# Order matters:
#   1. generate       - build the Prisma client from the HOSTED schema.
#   2. migrate deploy - apply any pending migrations to the production DB.
#   3. data migrations - run pending backfills (scripts/data-migrations), each
#                        once, in a transaction, recorded in AppMigration.
#   4. next build     - compile the app.
#
# `set -e` means a failed migration fails the deploy. That is deliberate: the
# alternative is shipping code that expects columns the database does not have,
# which is exactly the failure this script exists to prevent.
#
# Migrations run ONLY for production deployments. Preview has no database
# configured, so there is nothing to migrate there, and keeping the gate means a
# feature branch can never apply DDL to the production schema.
# ==============================================================================
set -e

SCHEMA=prisma/hosted/schema.prisma

echo "▶ prisma generate ($SCHEMA)"
npx prisma generate --schema="$SCHEMA"

if [ "$VERCEL_ENV" = "production" ]; then
    echo "▶ prisma migrate deploy (production)"
    npx prisma migrate deploy --schema="$SCHEMA"
    echo "▶ data migrations (production)"
    node scripts/run-data-migrations.mjs
else
    echo "▶ skipping migrate deploy and data migrations (VERCEL_ENV=${VERCEL_ENV:-unset}, not production)"
fi

echo "▶ next build"
npx next build
