-- Adds session reminders: a per-event opt-in plus lead time, and a per-session
-- sent marker so each scheduled session is announced once.
--
-- IF NOT EXISTS keeps a re-run harmless if the columns were already added by hand.

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "sessionReminderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "sessionReminderLeadMinutes" INTEGER;
ALTER TABLE "TimeSlot" ADD COLUMN IF NOT EXISTS "sessionReminderSentAt" TIMESTAMP(3);
