import { NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import { verifyEventAdmin } from "@/features/auth/server/actions";
import Logger from "@/shared/lib/logger";
import { pushSlotUpdates } from "../notify";

const log = Logger.get("API:Slot:Manage");

export async function PATCH(
    req: Request,
    { params }: { params: { slug: string; slotId: string } }
) {
    try {
        const { slug, slotId } = params;
        const body = await req.json();
        const { startTime, endTime } = body;
        const slotIdInt = parseInt(slotId, 10);

        if (isNaN(slotIdInt)) {
            return NextResponse.json({ error: "Invalid slot ID" }, { status: 400 });
        }

        if (!startTime || !endTime) {
            return NextResponse.json({ error: "Missing start or end time" }, { status: 400 });
        }

        const isAdmin = await verifyEventAdmin(slug);
        if (!isAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const eventInfo = await prisma.event.findUnique({
            where: { slug },
            include: { timeSlots: true }
        });

        if (!eventInfo) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        const existingSlot = eventInfo.timeSlots.find(s => s.id === slotIdInt);
        if (!existingSlot) {
            return NextResponse.json({ error: "Slot not found" }, { status: 404 });
        }

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

        await pushSlotUpdates(eventInfo.id, "A time option was modified by the creator");

        return NextResponse.json({ success: true });
    } catch (error) {
        log.error("Failed to update slot", error as Error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: { slug: string; slotId: string } }
) {
    try {
        const { slug, slotId } = params;
        const slotIdInt = parseInt(slotId, 10);

        if (isNaN(slotIdInt)) {
            return NextResponse.json({ error: "Invalid slot ID" }, { status: 400 });
        }

        const isAdmin = await verifyEventAdmin(slug);
        if (!isAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const eventInfo = await prisma.event.findUnique({
            where: { slug },
            include: { timeSlots: true }
        });

        if (!eventInfo) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        const existingSlot = eventInfo.timeSlots.find(s => s.id === slotIdInt);
        if (!existingSlot) {
            return NextResponse.json({ error: "Slot not found" }, { status: 404 });
        }

        // Wipe old votes and delete the time slot
        await prisma.$transaction([
            prisma.vote.deleteMany({
                where: { timeSlotId: slotIdInt },
            }),
            prisma.timeSlot.delete({
                where: { id: slotIdInt },
            }),
        ]);

        await pushSlotUpdates(eventInfo.id, "A time option was removed by the creator");

        return NextResponse.json({ success: true });
    } catch (error) {
        log.error("Failed to delete slot", error as Error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
