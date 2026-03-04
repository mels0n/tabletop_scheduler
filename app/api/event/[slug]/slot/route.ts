import { NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import { verifyEventAdmin } from "@/features/auth/server/actions";
import Logger from "@/shared/lib/logger";

const log = Logger.get("API:Slot:Create");

import { pushSlotUpdates } from "./notify";

export async function POST(
    req: Request,
    { params }: { params: { slug: string } }
) {
    try {
        const { slug } = params;
        const body = await req.json();
        const { startTime, endTime } = body;

        if (!startTime || !endTime) {
            return NextResponse.json({ error: "Missing start or end time" }, { status: 400 });
        }

        const isAdmin = await verifyEventAdmin(slug);
        if (!isAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const eventInfo = await prisma.event.findUnique({ where: { slug } });
        if (!eventInfo) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        const newSlot = await prisma.timeSlot.create({
            data: {
                eventId: eventInfo.id,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
            }
        });

        // Trigger notifications
        await pushSlotUpdates(eventInfo.id, "A new time option was added by the creator");

        return NextResponse.json({ success: true, slot: newSlot });
    } catch (error) {
        log.error("Failed to create slot", error as Error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
