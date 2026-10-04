-- Per-identity direct message preference. A linked Telegram or Discord user can turn off
-- bot direct messages from the profile page; delivery skips an opted-out target. No row
-- means direct messages are on, so existing users keep their current behaviour.
--
-- Additive only. IF NOT EXISTS keeps this safe on a database where the table was created
-- by hand.

CREATE TABLE IF NOT EXISTS "DmPreference" (
    "platform" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "dmOptOut" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DmPreference_pkey" PRIMARY KEY ("platform","platformId")
);

-- Every hosted table gets RLS with a deny-all policy (see 20261003000200_enable_rls).
ALTER TABLE "DmPreference" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny_Public_Access" ON "DmPreference";
CREATE POLICY "Deny_Public_Access" ON "DmPreference" FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
