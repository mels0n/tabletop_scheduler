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
#   3. next build     - compile the app.
#
# `set -e` means a failed migration fails the deploy. That is deliberate: the
# alternative is shipping code that expects columns the database does not have,
# which is exactly the failure this script exists to prevent.
#
# Migrations run ONLY for production deployments. Preview builds share the same
# DATABASE_URL, so letting them apply DDL would let any feature branch mutate
# the live schema.
# ==============================================================================
set -e

SCHEMA=prisma/hosted/schema.prisma

echo "▶ prisma generate ($SCHEMA)"
npx prisma generate --schema="$SCHEMA"

if [ "$VERCEL_ENV" = "production" ]; then
    echo "▶ prisma migrate deploy (production)"
    npx prisma migrate deploy --schema="$SCHEMA"
else
    echo "▶ skipping migrate deploy (VERCEL_ENV=${VERCEL_ENV:-unset}, not production)"
fi

echo "▶ next build"
npx next build
