-- AlterTable
ALTER TABLE "Event" ADD COLUMN "managerDiscordUsername" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LoginToken" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT,
    "discordId" TEXT,
    "discordUsername" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_LoginToken" ("chatId", "createdAt", "expiresAt", "token") SELECT "chatId", "createdAt", "expiresAt", "token" FROM "LoginToken";
DROP TABLE "LoginToken";
ALTER TABLE "new_LoginToken" RENAME TO "LoginToken";
CREATE TABLE "new_Participant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "telegramId" TEXT,
    "chatId" TEXT,
    "discordId" TEXT,
    "discordUsername" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "Participant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Participant" ("chatId", "createdAt", "discordId", "discordUsername", "eventId", "id", "name", "telegramId") SELECT "chatId", "createdAt", "discordId", "discordUsername", "eventId", "id", "name", "telegramId" FROM "Participant";
DROP TABLE "Participant";
ALTER TABLE "new_Participant" RENAME TO "Participant";
CREATE TABLE "new_Vote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "participantId" INTEGER NOT NULL,
    "timeSlotId" INTEGER NOT NULL,
    "preference" TEXT NOT NULL,
    "canHost" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Vote_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Vote" ("canHost", "id", "participantId", "preference", "timeSlotId") SELECT "canHost", "id", "participantId", "preference", "timeSlotId" FROM "Vote";
DROP TABLE "Vote";
ALTER TABLE "new_Vote" RENAME TO "Vote";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
