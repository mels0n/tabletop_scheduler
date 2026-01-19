import { NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import { getBaseUrl } from "@/shared/lib/url";
import { buildFinalizedMessage } from "@/shared/lib/eventMessage";
import { editMessageText } from "@/features/telegram";
import Logger from "@/shared/lib/logger";

const log = Logger.get("API:Location");

/**
 * @function POST
 * @description Handles location updates for an already finalized event.
 *
 * Responsibilities:
 * 1. Updates the `location` field in the database.
 * 2. If the event is linked to Telegram and has a pinned "Finalized" message:
 *    - Regenerates the message HTML with the new location logic.
 *    - Edits the existing Telegram message in-place using `editMessageText`.
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

        const { verifyEventAdmin } = await import("@/features/auth/server/actions");
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

        // Action: Telegram Sync
        // Intent: Keep the "pinned" message up-to-date with the latest location info.
        if (event.telegramChatId && event.pinnedMessageId && process.env.TELEGRAM_BOT_TOKEN && event.finalizedSlotId) {
            const slot = event.timeSlots.find(s => s.id === event.finalizedSlotId);
            if (slot) {
                const origin = getBaseUrl(req.headers);
                const msg = buildFinalizedMessage(event, slot, origin);

                await editMessageText(
                    event.telegramChatId,
                    event.pinnedMessageId,
                    msg,
                    process.env.TELEGRAM_BOT_TOKEN
                );
            }
        }

        return NextResponse.json({ success: true, location: event.location });
    } catch (error) {
        log.error("Location update failed", error as Error);
        return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
    }
}
