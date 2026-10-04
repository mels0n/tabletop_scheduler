-- Indexes for real query patterns, cascading deletes from Event, and three new columns.
--
-- Cascades: deleting an Event removes its time slots, participants, votes, finalized
-- sessions and queued webhooks in one statement. Before this, WebhookEvent was
-- ON DELETE RESTRICT, so any event created with a callback URL could not be deleted.
--
-- Written to be re-runnable: IF NOT EXISTS on columns and indexes, and each foreign key
-- is dropped and re-added in a single ALTER TABLE statement.

-- New columns
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "quorumReachedAt" TIMESTAMP(3);
ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);
ALTER TABLE "Donation" ADD COLUMN IF NOT EXISTS "amountCents" INTEGER;

-- Indexes
CREATE INDEX IF NOT EXISTS "Event_managerChatId_idx" ON "Event"("managerChatId");
CREATE INDEX IF NOT EXISTS "Event_managerDiscordId_idx" ON "Event"("managerDiscordId");
CREATE INDEX IF NOT EXISTS "Event_managerTelegram_idx" ON "Event"("managerTelegram");
CREATE INDEX IF NOT EXISTS "Event_status_idx" ON "Event"("status");
CREATE INDEX IF NOT EXISTS "Participant_chatId_idx" ON "Participant"("chatId");
CREATE INDEX IF NOT EXISTS "Participant_discordId_idx" ON "Participant"("discordId");
CREATE INDEX IF NOT EXISTS "Participant_telegramId_idx" ON "Participant"("telegramId");
CREATE INDEX IF NOT EXISTS "LoginToken_discordId_createdAt_idx" ON "LoginToken"("discordId", "createdAt");
CREATE INDEX IF NOT EXISTS "LoginToken_expiresAt_idx" ON "LoginToken"("expiresAt");

-- Cascading deletes (FinalizedSession already cascades from 0_init)
ALTER TABLE "TimeSlot"
    DROP CONSTRAINT IF EXISTS "TimeSlot_eventId_fkey",
    ADD CONSTRAINT "TimeSlot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Participant"
    DROP CONSTRAINT IF EXISTS "Participant_eventId_fkey",
    ADD CONSTRAINT "Participant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Vote"
    DROP CONSTRAINT IF EXISTS "Vote_participantId_fkey",
    ADD CONSTRAINT "Vote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Vote"
    DROP CONSTRAINT IF EXISTS "Vote_timeSlotId_fkey",
    ADD CONSTRAINT "Vote_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebhookEvent"
    DROP CONSTRAINT IF EXISTS "WebhookEvent_eventId_fkey",
    ADD CONSTRAINT "WebhookEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
