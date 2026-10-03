import { NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { NotFoundError, ValidationError, toResponse } from "@/shared/errors";
import { pushSlotUpdates, slotSuggestionSchema } from "@/features/event-management";
import { escapeHtml } from "@/shared/lib/escape";

const log = Logger.get("API:Slot:Suggest");

/** Any visitor may suggest a time while the event is open; no admin check by design. */
export async function POST(request: Request, props: { params: Promise<{ slug: string }> }) {
    const { slug } = await props.params;
    try {
        const { startTime, endTime, suggesterName } = slotSuggestionSchema.parse(await request.json());

        // Find the event to ensure it exists
        const event = await prisma.event.findUnique({
            where: { slug },
            select: { id: true, status: true }
        });

        if (!event) {
            throw new NotFoundError("Event not found.");
        }

        if (event.status === 'FINALIZED' || event.status === 'CANCELLED') {
            throw new ValidationError("Event is no longer accepting suggestions.");
        }

        // Create the slot
        await prisma.timeSlot.create({
            data: {
                eventId: event.id,
                startTime: new Date(startTime),
                endTime: new Date(endTime)
            }
        });

        // Notify Discord/Telegram
        const name = String(suggesterName).substring(0, 50); // limit length
        await pushSlotUpdates(event.id, `A new time option was suggested by <b>${escapeHtml(name)}</b>`);

        return NextResponse.json({ success: true });

    } catch (error) {
        return toResponse(error, log);
    }
}
