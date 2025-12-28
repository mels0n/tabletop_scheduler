-- AlterTable
ALTER TABLE "Event" ADD COLUMN "discordChannelId" TEXT;
ALTER TABLE "Event" ADD COLUMN "discordGuildId" TEXT;
ALTER TABLE "Event" ADD COLUMN "discordInviteLink" TEXT;
ALTER TABLE "Event" ADD COLUMN "discordMessageId" TEXT;
ALTER TABLE "Event" ADD COLUMN "managerDiscordId" TEXT;

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN "discordId" TEXT;
ALTER TABLE "Participant" ADD COLUMN "discordUsername" TEXT;
