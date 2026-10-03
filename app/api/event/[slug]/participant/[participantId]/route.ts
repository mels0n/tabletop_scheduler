import { NextRequest, NextResponse } from "next/server";
import { escapeHtml, escapeDiscordMarkdown } from "@/shared/lib/escape";
import prisma from "@/shared/lib/prisma";
import { verifyEventAdmin } from "@/features/auth/server/actions";
import Logger from "@/shared/lib/logger";
import { ForbiddenError, NotFoundError, toResponse } from "@/shared/errors";
import { idParam } from "@/features/event-management/model/schemas";

const log = Logger.get("API:Participant:Delete");

export async function DELETE(
    req: NextRequest,
    props: { params: Promise<{ slug: string; participantId: string }> }
) {
    const params = await props.params;
    try {
        const { slug, participantId } = params;

        // Verify the user is the admin of the event
        if (!(await verifyEventAdmin(slug))) {
            throw new ForbiddenError("Only event creators can remove participants.");
        }

        const participantIdInt = idParam.parse(participantId);

        // Verify participant exists and belongs to the event
        const participant = await prisma.participant.findFirst({
            where: {
                id: participantIdInt,
                event: {
                    slug: slug,
                },
            },
            include: {
                event: {
                    select: { status: true, title: true }
                }
            }
        });

        if (!participant) {
            throw new NotFoundError("Participant not found in this event.");
        }

        // --- NOTIFICATION: Removed by Admin ---
        if (participant.status === 'ACCEPTED' && participant.event.status === 'FINALIZED') {
            const { sendDirectMessage } = await import("@/features/notifications");
            await sendDirectMessage(
                { telegramChatId: participant.chatId, discordUserId: participant.discordId },
                {
                    html: `⚠️ <b>Event Update</b>\n\nYou have been removed from the finalized event <b>${escapeHtml(participant.event.title)}</b> by the organizer.`,
                    discord: `⚠️ **Event Update**\n\nYou have been removed from the finalized event **${escapeDiscordMarkdown(participant.event.title)}** by the organizer.`,
                },
                { slug, participantId: participantIdInt, kind: "participant-removed" }
            );
        }

        // Wrap deletions in a transaction to ensure both or neither happen
        await prisma.$transaction([
            // Delete associated votes first (foreign key constraint)
            prisma.vote.deleteMany({
                where: { participantId: participantIdInt, participant: { eventId: participant.eventId } },
            }),
            // Then delete the participant
            prisma.participant.delete({
                where: { id: participantIdInt, eventId: participant.eventId },
            }),
        ]);

        // Process Waitlist Promotion if someone was removed
        const { processWaitlistPromotion } = await import("@/features/event-management/server/waitlist");
        await processWaitlistPromotion(participant.eventId);

        // Sync dashboard to reflect the removed votes and any new promotions
        const { syncDashboard } = await import("@/features/event-management/server/dashboard-sync");
        await syncDashboard(participant.eventId);

        return NextResponse.json({ success: true });
    } catch (error) {
        return toResponse(error, log);
    }
}
