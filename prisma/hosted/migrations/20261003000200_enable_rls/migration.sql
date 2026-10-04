-- Row level security on every application table.
--
-- The app talks to Postgres through Prisma as the table owner, which bypasses RLS. The
-- Supabase Data API (PostgREST) uses the anon and authenticated roles; with RLS on and a
-- deny-all policy, those roles can read and write nothing. Without this, anyone holding
-- the project's anon key could read Event (admin token hashes) and LoginToken.
--
-- This SQL previously lived in the SQLite migration folder, so it never ran on a fresh
-- hosted database. It is idempotent: enabling RLS twice is a no-op and each policy is
-- dropped before it is recreated, so it is safe on a database where it was applied by hand.
--
-- The policy targets PUBLIC, which every role (anon and authenticated included) belongs
-- to; that also keeps it valid on a plain Postgres database such as Prisma's shadow DB.
--
-- Every new table needs the same two statements in the migration that creates it.

ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimeSlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Participant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinalizedSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoginToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Donation" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny_Public_Access" ON "Event";
CREATE POLICY "Deny_Public_Access" ON "Event" FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny_Public_Access" ON "TimeSlot";
CREATE POLICY "Deny_Public_Access" ON "TimeSlot" FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny_Public_Access" ON "Participant";
CREATE POLICY "Deny_Public_Access" ON "Participant" FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny_Public_Access" ON "Vote";
CREATE POLICY "Deny_Public_Access" ON "Vote" FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny_Public_Access" ON "FinalizedSession";
CREATE POLICY "Deny_Public_Access" ON "FinalizedSession" FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny_Public_Access" ON "LoginToken";
CREATE POLICY "Deny_Public_Access" ON "LoginToken" FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny_Public_Access" ON "WebhookEvent";
CREATE POLICY "Deny_Public_Access" ON "WebhookEvent" FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny_Public_Access" ON "Donation";
CREATE POLICY "Deny_Public_Access" ON "Donation" FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

-- Prisma's own ledger sits in the public schema too. It exists on a real deploy but not on
-- a shadow database, hence the guard.
DO $$
BEGIN
    IF to_regclass('public."_prisma_migrations"') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "Deny_Public_Access" ON public."_prisma_migrations"';
        EXECUTE 'CREATE POLICY "Deny_Public_Access" ON public."_prisma_migrations" FOR ALL TO PUBLIC USING (false) WITH CHECK (false)';
    END IF;
END
$$;
