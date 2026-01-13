/*
  Warnings:

  - A unique constraint covering the columns `[participantId,timeSlotId]` on the table `Vote` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "Participant_eventId_idx" ON "Participant"("eventId");

-- CreateIndex
CREATE INDEX "TimeSlot_eventId_idx" ON "TimeSlot"("eventId");

-- CreateIndex
CREATE INDEX "Vote_participantId_idx" ON "Vote"("participantId");

-- CreateIndex
CREATE INDEX "Vote_timeSlotId_idx" ON "Vote"("timeSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_participantId_timeSlotId_key" ON "Vote"("participantId", "timeSlotId");
