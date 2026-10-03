-- AlterTable
ALTER TABLE "Event" ADD COLUMN "sessionReminderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN "sessionReminderLeadMinutes" INTEGER;

-- AlterTable
ALTER TABLE "TimeSlot" ADD COLUMN "sessionReminderSentAt" DATETIME;
