-- Ledger of applied data migrations (scripts/data-migrations). scripts/run-data-migrations.mjs
-- inserts one row per backfill in the same transaction as the backfill itself, so a
-- backfill is applied exactly once and a failed one leaves no row behind.
--
-- IF NOT EXISTS keeps this safe on a database where the table was created by hand.

CREATE TABLE IF NOT EXISTS "AppMigration" (
    "id" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppMigration_pkey" PRIMARY KEY ("id")
);

-- Every hosted table gets RLS with a deny-all policy (see 20261003000200_enable_rls).
ALTER TABLE "AppMigration" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny_Public_Access" ON "AppMigration";
CREATE POLICY "Deny_Public_Access" ON "AppMigration" FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
