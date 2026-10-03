import { NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import { verifyEventAdmin } from "@/features/auth/server/actions";
import Logger from "@/shared/lib/logger";
import { ForbiddenError, NotFoundError, ValidationError, toResponse } from "@/shared/errors";
import { idParam, slotSchema } from "@/features/event-management/model/schemas";
import { pushSlotUpdates } from "@/features/event-management/server/dashboard-sync";

const log = Logger.get("API:Slot:Manage");

/**
 * Shared guard for slot edits: caller is the event admin, the event is still editable, and the
 * slot belongs to this event. Returns the event id; throws a typed error otherwise.
 */
async function requireEditableSlot(slug: string, slotId: number): Promise<number> {
    if (!(await verifyEventAdmin(slug))) {
        throw new ForbiddenError();
    }

    const eventInfo = await prisma.event.findUnique({ where: { slug }, select: { id: true, status: true } });
    if (!eventInfo) {
        throw new NotFoundError("Event not found");
    }

    if (eventInfo.status === 'FINALIZED' || eventInfo.status === 'CANCELLED') {
        throw new ValidationError("Cannot modify slots on a finalized or cancelled event.");
    }

    const existingSlot = await prisma.timeSlot.findFirst({
        where: { id: slotId, eventId: eventInfo.id },
        select: { id: true }
    });
    if (!existingSlot) {
        throw new NotFoundError("Slot not found");
    }

    return eventInfo.id;
}

export async function PATCH(req: Request, props: { params: Promise<{ slug: string; slotId: string }> }) {
    const { slug, slotId } = await props.params;
    try {
        const slotIdInt = idParam.parse(slotId);
        const eventId = await requireEditableSlot(slug, slotIdInt);
        const { startTime, endTime } = slotSchema.parse(await req.json());

        // Wipe old votes and update the time slot
        await prisma.$transaction([
            prisma.vote.deleteMany({
                where: { timeSlotId: slotIdInt },
            }),
            prisma.timeSlot.update({
                where: { id: slotIdInt },
                data: {
                    startTime: new Date(startTime),
                    endTime: new Date(endTime),
                }
            }),
        ]);

        await pushSlotUpdates(eventId, "A time option was modified by the creator");

        return NextResponse.json({ success: true });
    } catch (error) {
        return toResponse(error, log);
    }
}

export async function DELETE(_req: Request, props: { params: Promise<{ slug: string; slotId: string }> }) {
    const { slug, slotId } = await props.params;
    try {
        const slotIdInt = idParam.parse(slotId);
        const eventId = await requireEditableSlot(slug, slotIdInt);

        // Wipe old votes and delete the time slot
        await prisma.$transaction([
            prisma.vote.deleteMany({
                where: { timeSlotId: slotIdInt },
            }),
            prisma.timeSlot.delete({
                where: { id: slotIdInt },
            }),
        ]);

        await pushSlotUpdates(eventId, "A time option was removed by the creator");

        return NextResponse.json({ success: true });
    } catch (error) {
        return toResponse(error, log);
    }
}
