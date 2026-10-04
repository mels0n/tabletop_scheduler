-- Per-row ownership marker. Set when the signed participant cookie is first issued for a row.
-- No backfill: existing rows stay null, which marks them as created before participant cookies
-- existed. Such a row stays editable by its stored id until the first browser claims it.
ALTER TABLE "Participant" ADD COLUMN IF NOT EXISTS "ownerCookieIssuedAt" TIMESTAMP(3);
