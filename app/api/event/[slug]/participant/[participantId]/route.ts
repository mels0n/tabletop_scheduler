import { NextRequest, NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import { verifyEventAdmin } from "@/features/auth/server/actions";

export async function DELETE(
    req: NextRequest,
    { params }: { params: { slug: string; participantId: string } }
) {
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
        });

        if (!participant) {
            return NextResponse.json(
                { error: "Participant not found in this event." },
                { status: 404 }
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

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting participant:", error);
        return NextResponse.json(
            { error: "Failed to delete participant." },
            { status: 500 }
        );
    }
}
