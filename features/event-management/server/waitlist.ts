import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { escapeHtml, escapeDiscordMarkdown } from "@/shared/lib/escape";
import { syncDashboard } from "@/app/api/event/[slug]/slot/notify";

const log = Logger.get("WaitlistService");

interface CandidateVote {
    preference: string;
    createdAt: Date;
}

interface Candidate {
    id: number;
    chatId: string | null;
    discordId: string | null;
    votes: CandidateVote[];
}

/** Best vote across the finalized slot(s): YES beats MAYBE, then the earliest. */
function bestVote(votes: CandidateVote[]): CandidateVote | undefined {
    const score = (p: string) => (p === 'YES' ? 0 : 1);
    return [...votes].sort((a, b) =>
        score(a.preference) - score(b.preference) || a.createdAt.getTime() - b.createdAt.getTime()
    )[0];
}

/** YES before MAYBE, then oldest vote first; candidates without a vote go last. */
function rankCandidates(candidates: Candidate[]): Candidate[] {
    const getScore = (p: string) => (p === 'YES' ? 0 : 1);
    return [...candidates].sort((a, b) => {
        const voteA = bestVote(a.votes);
        const voteB = bestVote(b.votes);
        if (!voteA) return 1;
        if (!voteB) return -1;
        const byPreference = getScore(voteA.preference) - getScore(voteB.preference);
        if (byPreference !== 0) return byPreference;
        return voteA.createdAt.getTime() - voteB.createdAt.getTime();
    });
}

/**
 * Fills open seats on a finalized event from its waitlist, best candidate first.
 *
 * Concurrency: every promotion happens in one transaction that first touches the event row
 * (a row lock on Postgres, a write lock on SQLite), counts ACCEPTED, flips the candidate with a
 * conditional `updateMany` (status still WAITLIST), and recounts; an overbooked recount reverts
 * that promotion. Two concurrent runs therefore cannot both take the last seat, and a
 * candidate promoted by another run is skipped. Notifications go out after the commit.
 *
 * Campaigns have no `finalizedSlotId`; their candidates are ranked by votes on the
 * `FinalizedSession` slots instead.
 *
 * Never throws: failures are logged and the caller carries on.
 */
export async function processWaitlistPromotion(eventId: number): Promise<void> {
    try {
        const event = await prisma.event.findUnique({
            where: { id: eventId }
        });

        if (!event || event.status !== 'FINALIZED' || !event.maxPlayers) {
            return;
        }
        const maxPlayers = event.maxPlayers;

        const slotIds = event.finalizedSlotId !== null
            ? [event.finalizedSlotId]
            : (await prisma.finalizedSession.findMany({
                where: { eventId },
                select: { timeSlotId: true }
            })).map(s => s.timeSlotId);

        // Fetch WAITLIST candidates with their votes for the finalized slot(s)
        const candidates: Candidate[] = await prisma.participant.findMany({
            where: { eventId, status: 'WAITLIST' },
            include: {
                votes: {
                    where: slotIds.length === 1 ? { timeSlotId: slotIds[0] } : { timeSlotId: { in: slotIds } }
                }
            }
        });

        if (candidates.length === 0) {
            return; // No one to promote
        }

        const ranked = rankCandidates(candidates);

        const promoted = await prisma.$transaction(async (tx) => {
            // Serialize promotions for this event (see function comment).
            await tx.event.updateMany({ where: { id: eventId }, data: { updatedAt: new Date() } });

            let accepted = await tx.participant.count({ where: { eventId, status: 'ACCEPTED' } });
            const out: Candidate[] = [];

            for (const candidate of ranked) {
                if (accepted >= maxPlayers) break;

                const claimed = await tx.participant.updateMany({
                    where: { id: candidate.id, eventId, status: 'WAITLIST' },
                    data: { status: 'ACCEPTED' }
                });
                if (claimed.count !== 1) continue; // Already moved by someone else.

                accepted = await tx.participant.count({ where: { eventId, status: 'ACCEPTED' } });
                if (accepted > maxPlayers) {
                    await tx.participant.updateMany({
                        where: { id: candidate.id, eventId, status: 'ACCEPTED' },
                        data: { status: 'WAITLIST' }
                    });
                    break;
                }
                out.push(candidate);
            }

            return out;
        });

        for (const candidate of promoted) {
            // Notify candidate on every linked platform (independent)
            const { sendDirectMessage } = await import("@/features/notifications");
            await sendDirectMessage(
                { telegramChatId: candidate.chatId, discordUserId: candidate.discordId },
                {
                    html: `🎟️ <b>You're In!</b>\n\nA spot opened up for <b>${escapeHtml(event.title)}</b> and you've been moved off the waitlist!`,
                    discord: `🎟️ **You're In!**\n\nA spot opened up for **${escapeDiscordMarkdown(event.title)}** and you've been moved off the waitlist!`,
                },
                { eventId, participantId: candidate.id, kind: "waitlist-promotion" }
            );

            log.info("Auto-promoted user from waitlist", { eventId, participantId: candidate.id });
        }

        if (promoted.length > 0) {
            await syncDashboard(eventId);
        }

    } catch (error) {
        log.error("Failed to process waitlist promotion", error as Error);
    }
}
