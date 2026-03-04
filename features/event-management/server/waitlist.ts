import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { syncDashboard } from "@/app/api/event/[slug]/slot/notify";

const log = Logger.get("WaitlistService");

export async function processWaitlistPromotion(eventId: number) {
    try {
        const event = await prisma.event.findUnique({
            where: { id: eventId }
        });

        if (!event || event.status !== 'FINALIZED' || !event.maxPlayers) {
            return;
        }

        // Re-fetch counts to see if a spot opened up
        const count = await prisma.participant.count({
            where: { eventId, status: 'ACCEPTED' }
        });

        if (count >= event.maxPlayers) {
            return; // No spots available
        }

        const spotsAvailable = event.maxPlayers - count;

        // Fetch WAITLIST candidates with their votes for the finalized slot
        const candidates = await prisma.participant.findMany({
            where: { eventId, status: 'WAITLIST' },
            include: {
                votes: {
                    where: { timeSlotId: event.finalizedSlotId! }
                }
            }
        });

        if (candidates.length === 0) {
            return; // No one to promote
        }

        // Sort candidates in memory
        candidates.sort((a, b) => {
            const voteA = a.votes[0];
            const voteB = b.votes[0];

            // Safety Check: Users should have a vote for this slot if on waitlist
            if (!voteA) return 1;
            if (!voteB) return -1;

            // 1. Preference: YES (0) < MAYBE (1)
            const getScore = (p: string) => (p === 'YES' ? 0 : 1);
            const scoreA = getScore(voteA.preference);
            const scoreB = getScore(voteB.preference);

            if (scoreA !== scoreB) {
                return scoreA - scoreB;
            }

            // 2. Time: Oldest First
            return voteA.createdAt.getTime() - voteB.createdAt.getTime();
        });

        const waitlist = candidates.slice(0, spotsAvailable);
        let userPromoted = false;

        for (const candidate of waitlist) {
            // Promote
            await prisma.participant.update({
                where: { id: candidate.id },
                data: { status: 'ACCEPTED' }
            });
            userPromoted = true;

            // Notify Candidate via Telegram
            if (candidate.chatId && process.env.TELEGRAM_BOT_TOKEN) {
                const { sendTelegramMessage } = await import("@/features/telegram");
                await sendTelegramMessage(
                    candidate.chatId,
                    `🎟️ <b>You're In!</b>\n\nA spot opened up for <b>${event.title}</b> and you've been moved off the waitlist!`,
                    process.env.TELEGRAM_BOT_TOKEN
                );
            }

            // Notify Candidate via Discord (if mapped)
            if (candidate.discordId && process.env.DISCORD_BOT_TOKEN) {
                const { createDMChannel, sendDiscordMessage } = await import("@/features/discord/model/discord");
                const dm = await createDMChannel(candidate.discordId, process.env.DISCORD_BOT_TOKEN);
                if (dm?.id) {
                    await sendDiscordMessage(dm.id, `🎟️ **You're In!**\n\nA spot opened up for **${event.title}** and you've been moved off the waitlist!`, process.env.DISCORD_BOT_TOKEN);
                }
            }

            log.info("Auto-promoted user from waitlist", { eventId, participantId: candidate.id });
        }

        if (userPromoted) {
            await syncDashboard(eventId);
        }

    } catch (error) {
        log.error("Failed to process waitlist promotion", error as Error);
    }
}
