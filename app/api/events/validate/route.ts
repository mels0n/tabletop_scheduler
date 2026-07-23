
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";

/**
 * @function POST
 * @description Validates a list of event slugs (History Tracker).
 *
 * Use Case:
 * - The Client-side `HistoryTracker` component stores visited events in LocalStorage.
 * - This endpoint allows the client to periodically "prune" its history list by checking
 *   which events still exist in the database (e.g., separating deleted/expired events).
 *
 * @param {NextRequest} req - JSON Payload: { slugs: string[] }
 * @returns {NextResponse} JSON:
 *   - validSlugs: string[] of events that exist in DB.
 *   - events: per-slug { slug, id, status, scheduledDate } so the client can reflect
 *     true finalized/cancelled state even when the user is not Telegram/Discord synced,
 *     and so it can resolve the numeric event id needed to look up a locally-stored
 *     participantId (`tabletop_participant_<eventId>`) for un-synced history entries.
 */
const resolveScheduledDate = (e: {
    finalizedSlotId: number | null;
    timeSlots: { id: number; startTime: Date }[];
    finalizedSessions: { timeSlot: { startTime: Date } }[];
}): string | undefined => {
    const finalizedSlot = e.timeSlots.find(s => s.id === e.finalizedSlotId);
    if (finalizedSlot) return finalizedSlot.startTime.toISOString();
    if (e.finalizedSessions.length > 0) {
        const sorted = [...e.finalizedSessions].sort(
            (a, b) => a.timeSlot.startTime.getTime() - b.timeSlot.startTime.getTime()
        );
        return sorted[0].timeSlot.startTime.toISOString();
    }
    return undefined;
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { slugs } = body;

        if (!slugs || !Array.isArray(slugs)) {
            return NextResponse.json({ error: "Invalid slugs" }, { status: 400 });
        }

        if (slugs.length === 0) {
            return NextResponse.json({ validSlugs: [], events: [] });
        }

        const foundEvents = await prisma.event.findMany({
            where: {
                slug: { in: slugs }
            },
            select: {
                id: true,
                slug: true,
                status: true,
                finalizedSlotId: true,
                timeSlots: { select: { id: true, startTime: true } },
                finalizedSessions: { select: { timeSlot: { select: { startTime: true } } } }
            }
        });

        const validSlugs = foundEvents.map(e => e.slug);
        const events = foundEvents.map(e => ({
            slug: e.slug,
            id: e.id,
            status: e.status,
            scheduledDate: resolveScheduledDate(e)
        }));

        return NextResponse.json({ validSlugs, events });
    } catch (e) {
        console.error("Validation error", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
