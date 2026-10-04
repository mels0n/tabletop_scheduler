-- Per-participant cooldown for the "updated their availability" group post. The vote route
-- stamps this when it announces a vote and skips the post while the stamp is younger than
-- VOTE_ANNOUNCE_COOLDOWN_MINUTES. The pinned dashboard is still refreshed on every vote.
-- No backfill: existing rows stay null, so their next vote is announced as before.
ALTER TABLE "Participant" ADD COLUMN IF NOT EXISTS "lastAnnouncedAt" TIMESTAMP(3);
