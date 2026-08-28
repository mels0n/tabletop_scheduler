-- Baseline for the hosted (Postgres) target.
--
-- Written to be idempotent so it can run against BOTH an empty database and the
-- pre-existing production database, which was created with `prisma db push` and
-- had no _prisma_migrations ledger. Applying this migration is what creates that
-- ledger, so no manual `migrate resolve --applied` step is needed.
--
-- Every statement is a no-op when the object already exists. Foreign keys use
-- DROP IF EXISTS + ADD because Postgres has no ADD CONSTRAINT IF NOT EXISTS;
-- Prisma runs each migration in a transaction, so the constraint is never
-- observably absent.

-- CreateTable
CREATE TABLE IF NOT EXISTS "Event" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "adminToken" TEXT,
    "telegramLink" TEXT,
    "telegramChatId" TEXT,
    "managerTelegram" TEXT,
    "managerChatId" TEXT,
    "pinnedMessageId" INTEGER,
    "discordGuildId" TEXT,
    "discordChannelId" TEXT,
    "discordMessageId" TEXT,
    "discordInviteLink" TEXT,
    "managerDiscordId" TEXT,
    "managerDiscordUsername" TEXT,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderTime" TEXT,
    "reminderDays" TEXT,
    "lastReminderSent" TIMESTAMP(3),
    "quorumViableNotified" BOOLEAN NOT NULL DEFAULT false,
    "quorumPerfectNotified" BOOLEAN NOT NULL DEFAULT false,
    "recoveryToken" TEXT,
    "recoveryTokenExpires" TIMESTAMP(3),
    "minPlayers" INTEGER NOT NULL DEFAULT 3,
    "maxPlayers" INTEGER,
    "eventType" TEXT NOT NULL DEFAULT 'ONE_SHOT',
    "minSessions" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "finalizedSlotId" INTEGER,
    "finalizedHostId" INTEGER,
    "location" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "fromUrl" TEXT,
    "fromUrlId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TimeSlot" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Participant" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "telegramId" TEXT,
    "chatId" TEXT,
    "discordId" TEXT,
    "discordUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Vote" (
    "id" SERIAL NOT NULL,
    "participantId" INTEGER NOT NULL,
    "timeSlotId" INTEGER NOT NULL,
    "preference" TEXT NOT NULL,
    "canHost" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LoginToken" (
    "token" TEXT NOT NULL,
    "chatId" TEXT,
    "telegramUsername" TEXT,
    "discordId" TEXT,
    "discordUsername" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginToken_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttempt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FinalizedSession" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "timeSlotId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinalizedSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Donation" (
    "id" TEXT NOT NULL,
    "kofiTransactionId" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "message" TEXT,
    "amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "type" TEXT NOT NULL DEFAULT 'Donation',
    "rawPayload" TEXT,
    "donatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Event_recoveryToken_key" ON "Event"("recoveryToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TimeSlot_eventId_idx" ON "TimeSlot"("eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Participant_eventId_idx" ON "Participant"("eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Vote_participantId_idx" ON "Vote"("participantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Vote_timeSlotId_idx" ON "Vote"("timeSlotId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Vote_participantId_timeSlotId_key" ON "Vote"("participantId", "timeSlotId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WebhookEvent_status_nextAttempt_idx" ON "WebhookEvent"("status", "nextAttempt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FinalizedSession_timeSlotId_key" ON "FinalizedSession"("timeSlotId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinalizedSession_eventId_idx" ON "FinalizedSession"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Donation_kofiTransactionId_key" ON "Donation"("kofiTransactionId");

-- AddForeignKey
ALTER TABLE "Event" DROP CONSTRAINT IF EXISTS "Event_finalizedHostId_fkey";
ALTER TABLE "Event" ADD CONSTRAINT "Event_finalizedHostId_fkey" FOREIGN KEY ("finalizedHostId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeSlot" DROP CONSTRAINT IF EXISTS "TimeSlot_eventId_fkey";
ALTER TABLE "TimeSlot" ADD CONSTRAINT "TimeSlot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" DROP CONSTRAINT IF EXISTS "Participant_eventId_fkey";
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" DROP CONSTRAINT IF EXISTS "Vote_participantId_fkey";
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" DROP CONSTRAINT IF EXISTS "Vote_timeSlotId_fkey";
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" DROP CONSTRAINT IF EXISTS "WebhookEvent_eventId_fkey";
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalizedSession" DROP CONSTRAINT IF EXISTS "FinalizedSession_eventId_fkey";
ALTER TABLE "FinalizedSession" ADD CONSTRAINT "FinalizedSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalizedSession" DROP CONSTRAINT IF EXISTS "FinalizedSession_timeSlotId_fkey";
ALTER TABLE "FinalizedSession" ADD CONSTRAINT "FinalizedSession_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

