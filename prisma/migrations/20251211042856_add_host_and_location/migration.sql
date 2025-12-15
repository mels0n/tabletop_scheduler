/*
  Warnings:

  - You are about to drop the `House` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `finalizedHouseId` on the `Event` table. All the data in the column will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "House";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "adminToken" TEXT,
    "telegramLink" TEXT,
    "telegramChatId" TEXT,
    "managerTelegram" TEXT,
    "managerChatId" TEXT,
    "pinnedMessageId" INTEGER,
    "minPlayers" INTEGER NOT NULL DEFAULT 3,
    "maxPlayers" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "finalizedSlotId" INTEGER,
    "finalizedHostId" INTEGER,
    "location" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_finalizedHostId_fkey" FOREIGN KEY ("finalizedHostId") REFERENCES "Participant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("adminToken", "createdAt", "description", "finalizedSlotId", "id", "managerChatId", "managerTelegram", "maxPlayers", "minPlayers", "pinnedMessageId", "slug", "status", "telegramChatId", "telegramLink", "title", "updatedAt") SELECT "adminToken", "createdAt", "description", "finalizedSlotId", "id", "managerChatId", "managerTelegram", "maxPlayers", "minPlayers", "pinnedMessageId", "slug", "status", "telegramChatId", "telegramLink", "title", "updatedAt" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
