
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
 * @returns {NextResponse} JSON { validSlugs: string[] } of events that exist in DB.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { slugs } = body;

        if (!slugs || !Array.isArray(slugs)) {
            return NextResponse.json({ error: "Invalid slugs" }, { status: 400 });
        }

        if (slugs.length === 0) {
            return NextResponse.json({ validSlugs: [] });
        }

        // Optimization: Fetch only 'slug' field to minimize data persistence load.
        const foundEvents = await prisma.event.findMany({
            where: {
                slug: { in: slugs }
            },
            select: { slug: true }
        });

        const validSlugs = foundEvents.map(e => e.slug);

        return NextResponse.json({ validSlugs });
    } catch (e) {
        console.error("Validation error", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
