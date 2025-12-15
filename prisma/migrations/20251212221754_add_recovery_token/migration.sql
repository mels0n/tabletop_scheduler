/*
  Warnings:

  - A unique constraint covering the columns `[recoveryToken]` on the table `Event` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Event" ADD COLUMN "recoveryToken" TEXT;
ALTER TABLE "Event" ADD COLUMN "recoveryTokenExpires" DATETIME;

-- CreateIndex
CREATE UNIQUE INDEX "Event_recoveryToken_key" ON "Event"("recoveryToken");
