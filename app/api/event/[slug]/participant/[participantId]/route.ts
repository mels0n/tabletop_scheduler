import { NextRequest, NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import { verifyEventAdmin } from "@/features/auth/server/actions";

export async function DELETE(
    req: NextRequest,
    props: { params: Promise<{ slug: string; participantId: string }> }
) {
    const params = await props.params;
    try {
        const { slug, participantId } = params;
        const participantIdInt = parseInt(participantId, 10);

        if (isNaN(participantIdInt)) {
            return NextResponse.json(
                { error: "Invalid participant ID." },
                { status: 400 }
            );
        }

        // Verify the user is the admin of the event
        const isAdmin = await verifyEventAdmin(slug);
        if (!isAdmin) {
            return NextResponse.json(
                { error: "Unauthorized. Only event creators can remove participants." },
                { status: 403 }
            );
        }

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
            return NextResponse.json(
                { error: "Participant not found in this event." },
                { status: 404 }
            );
        }

        // --- NOTIFICATION: Removed by Admin ---
        if (participant.status === 'ACCEPTED' && participant.event.status === 'FINALIZED') {
            const { sendDirectMessage } = await import("@/features/notifications");
            await sendDirectMessage(
                { telegramChatId: participant.chatId, discordUserId: participant.discordId },
                {
                    html: `⚠️ <b>Event Update</b>\n\nYou have been removed from the finalized event <b>${participant.event.title}</b> by the organizer.`,
                    discord: `⚠️ **Event Update**\n\nYou have been removed from the finalized event **${participant.event.title}** by the organizer.`,
                },
                { slug, participantId: participantIdInt, kind: "participant-removed" }
            );
        }

        // Wrap deletions in a transaction to ensure both or neither happen
        await prisma.$transaction([
            // Delete associated votes first (foreign key constraint)
            prisma.vote.deleteMany({
                where: { participantId: participantIdInt },
            }),
            // Then delete the participant
            prisma.participant.delete({
                where: { id: participantIdInt },
            }),
        ]);

        // Process Waitlist Promotion if someone was removed
        const { processWaitlistPromotion } = await import("@/features/event-management/server/waitlist");
        await processWaitlistPromotion(participant.eventId);

        // Sync dashboard to reflect the removed votes and any new promotions
        const { syncDashboard } = await import("@/app/api/event/[slug]/slot/notify");
        await syncDashboard(participant.eventId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting participant:", error);
        return NextResponse.json(
            { error: "Failed to delete participant." },
            { status: 500 }
        );
    }
}
