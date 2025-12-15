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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "finalizedHouseId" INTEGER,
    CONSTRAINT "Event_finalizedHouseId_fkey" FOREIGN KEY ("finalizedHouseId") REFERENCES "House" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("adminToken", "createdAt", "description", "finalizedSlotId", "id", "managerChatId", "managerTelegram", "maxPlayers", "minPlayers", "pinnedMessageId", "slug", "status", "telegramChatId", "telegramLink", "title", "updatedAt") SELECT "adminToken", "createdAt", "description", "finalizedSlotId", "id", "managerChatId", "managerTelegram", "maxPlayers", "minPlayers", "pinnedMessageId", "slug", "status", "telegramChatId", "telegramLink", "title", "updatedAt" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
