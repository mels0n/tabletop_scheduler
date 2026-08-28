-- Adds LoginToken.telegramUsername to the hosted database.
--
-- The column was added to both schema files (and to the sqlite migration history)
-- on 2026-07-23, but the hosted apply was manual and never ran. Every Prisma
-- query on LoginToken then named a column Postgres did not have, taking down all
-- magic-link auth until 2026-08-28. This migration is the fix, applied by the
-- deploy rather than by hand.
--
-- IF NOT EXISTS because 0_init already creates the table with this column on a
-- fresh database; only the pre-existing production database is missing it.

ALTER TABLE "LoginToken" ADD COLUMN IF NOT EXISTS "telegramUsername" TEXT;
