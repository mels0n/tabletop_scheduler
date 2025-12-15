-- AlterTable
ALTER TABLE "Participant" ADD COLUMN "chatId" TEXT;

-- CreateTable
CREATE TABLE "LoginToken" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
