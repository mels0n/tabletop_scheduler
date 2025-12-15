-- AlterTable
ALTER TABLE "Event" ADD COLUMN "adminToken" TEXT;
ALTER TABLE "Event" ADD COLUMN "telegramLink" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Vote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "participantId" INTEGER NOT NULL,
    "timeSlotId" INTEGER NOT NULL,
    "preference" TEXT NOT NULL,
    "canHost" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Vote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Vote_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Vote" ("id", "participantId", "preference", "timeSlotId") SELECT "id", "participantId", "preference", "timeSlotId" FROM "Vote";
DROP TABLE "Vote";
ALTER TABLE "new_Vote" RENAME TO "Vote";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
