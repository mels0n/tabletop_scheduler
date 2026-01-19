-- AlterTable
ALTER TABLE "Event" ADD COLUMN "fromUrl" TEXT;
ALTER TABLE "Event" ADD COLUMN "fromUrlId" TEXT;

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttempt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WebhookEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WebhookEvent_status_nextAttempt_idx" ON "WebhookEvent"("status", "nextAttempt");
