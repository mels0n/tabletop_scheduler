import { NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import { getBaseUrl } from "@/shared/lib/url";
import { buildFinalizedMessage } from "@/shared/lib/eventMessage";
import Logger from "@/shared/lib/logger";
import { refreshDiscordDashboard, refreshTelegramDashboard } from "@/app/api/event/[slug]/slot/notify";

import { verifyEventAdmin } from "@/features/auth/server/actions";

const log = Logger.get("API:Location");

/**
 * @function POST
 * @description Handles location updates for an already finalized event.
 *
 * Responsibilities:
 * 1. Updates the `location` field in the database.
 * 2. If the event is finalized, regenerates the "Finalized" message and, independently on
 *    each linked platform, edits the pinned dashboard in place, falling back to
 *    post + pin when the old message is gone.
 *    - This ensures users see the new location without needing a new notification spam.
 *
 * @param {Request} req - JSON body containing `{ location: string }`.
 * @param {Object} context - Route parameters.
 * @param {string} context.params.slug - The event identifier.
 * @returns {NextResponse} Success status and updated location.
 */
export async function POST(
    req: Request,
    { params }: { params: { slug: string } }
) {
    try {
        const { location } = await req.json();

        if (!await verifyEventAdmin(params.slug)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        log.info("Updating location", { slug: params.slug });

        // Action: Database Update
        const event = await prisma.event.update({
            where: { slug: params.slug },
            data: { location },
            include: {
                timeSlots: true,
                finalizedHost: true
            }
        });

        // Action: Dashboard Sync (Telegram and Discord, independent)
        // Intent: Keep the "pinned" message up-to-date with the latest location info.
        const slot = event.finalizedSlotId ? event.timeSlots.find(s => s.id === event.finalizedSlotId) : undefined;
        if (slot) {
            const msg = buildFinalizedMessage(event, slot, getBaseUrl(req.headers));

            try {
                await refreshTelegramDashboard(event, event.id, msg);
            } catch (e) {
                log.error("Telegram location sync failed", e as Error);
            }

            try {
                // Edits in place; falls back to post + pin + store id if the message is gone.
                await refreshDiscordDashboard(event, event.id, msg);
            } catch (e) {
                log.error("Discord location sync failed", e as Error);
            }
        }

        return NextResponse.json({ success: true, location: event.location });
    } catch (error) {
        log.error("Location update failed", error as Error);
        return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
    }
}
