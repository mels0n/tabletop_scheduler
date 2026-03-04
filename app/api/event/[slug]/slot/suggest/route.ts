import { NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { pushSlotUpdates } from "../notify";

const log = Logger.get("API:Slot:Suggest");

export async function POST(
    request: Request,
    { params }: { params: { slug: string } }
) {
    try {
        const body = await request.json();
        const { startTime, endTime, suggesterName } = body;

        if (!startTime || !endTime || !suggesterName) {
            return NextResponse.json({ error: "Start time, end time, and your name are required." }, { status: 400 });
        }

        // Find the event to ensure it exists
        const event = await prisma.event.findUnique({
            where: { slug: params.slug },
            select: { id: true, status: true }
        });

        if (!event) {
            return NextResponse.json({ error: "Event not found." }, { status: 404 });
        }

        if (event.status === 'FINALIZED' || event.status === 'CANCELLED') {
            return NextResponse.json({ error: "Event is no longer accepting suggestions." }, { status: 400 });
        }

        const start = new Date(startTime);
        const end = new Date(endTime);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return NextResponse.json({ error: "Invalid date format." }, { status: 400 });
        }

        if (start >= end) {
            return NextResponse.json({ error: "Start time must be before end time." }, { status: 400 });
        }

        // Create the slot
        await prisma.timeSlot.create({
            data: {
                eventId: event.id,
                startTime: start,
                endTime: end
            }
        });

        // Notify Discord/Telegram
        const safeName = suggesterName.substring(0, 50); // limit length
        await pushSlotUpdates(event.id, `A new time option was suggested by <b>${safeName}</b>`);

        return NextResponse.json({ success: true });

    } catch (error) {
        log.error(`Failed to suggest slot for event ${params.slug}`, error as Error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
