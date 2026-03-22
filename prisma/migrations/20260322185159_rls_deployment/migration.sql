-- Comprehensive RLS Lockdown for Prisma-driven Backend
-- Strategy: Enable RLS on all tables, and completely DENY public PostgREST access.
-- Prisma will bypass this because it connects via the superuser connection.

ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimeSlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Participant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoginToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Donation" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny_Public_Access" ON "Event" FOR ALL TO public USING (false);
CREATE POLICY "Deny_Public_Access" ON "TimeSlot" FOR ALL TO public USING (false);
CREATE POLICY "Deny_Public_Access" ON "Participant" FOR ALL TO public USING (false);
CREATE POLICY "Deny_Public_Access" ON "Vote" FOR ALL TO public USING (false);
CREATE POLICY "Deny_Public_Access" ON "LoginToken" FOR ALL TO public USING (false);
CREATE POLICY "Deny_Public_Access" ON "WebhookEvent" FOR ALL TO public USING (false);
CREATE POLICY "Deny_Public_Access" ON "Donation" FOR ALL TO public USING (false);
