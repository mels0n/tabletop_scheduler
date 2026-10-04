import { NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import { verifyEventAdmin } from "@/features/auth";
import Logger from "@/shared/lib/logger";
import { ForbiddenError, NotFoundError, ValidationError, toResponse } from "@/shared/errors";
import { MAX_EVENT_SLOTS, pushSlotUpdates, slotSchema } from "@/features/event-management";

const log = Logger.get("API:Slot:Create");


export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
    const { slug } = await props.params;
    try {
        if (!(await verifyEventAdmin(slug))) {
            throw new ForbiddenError();
        }

        const { startTime, endTime } = slotSchema.parse(await req.json());

        const eventInfo = await prisma.event.findUnique({ where: { slug }, select: { id: true, status: true } });
        if (!eventInfo) {
            throw new NotFoundError("Event not found");
        }

        if (eventInfo.status === 'FINALIZED' || eventInfo.status === 'CANCELLED') {
            throw new ValidationError("Cannot modify slots on a finalized or cancelled event.");
        }

        if ((await prisma.timeSlot.count({ where: { eventId: eventInfo.id } })) >= MAX_EVENT_SLOTS) {
            throw new ValidationError("This event already has the maximum number of time options.");
        }

        const newSlot = await prisma.timeSlot.create({
            data: {
                eventId: eventInfo.id,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
            },
            select: { id: true, startTime: true, endTime: true }
        });

        // Trigger notifications
        await pushSlotUpdates(eventInfo.id, "A new time option was added by the creator");

        return NextResponse.json({
            success: true,
            slot: { id: newSlot.id, startTime: newSlot.startTime, endTime: newSlot.endTime }
        });
    } catch (error) {
        return toResponse(error, log.forRequest(req));
    }
}
