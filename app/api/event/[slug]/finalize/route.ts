import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import Logger from "@/lib/logger";

const log = Logger.get("API:Finalize");

/**
 * @function POST
 * @description Handles the "Finalize Event" action from the Manager Dashboard.
 *
 * Responsibilities:
 * 1. Validates inputs (Slot ID, Host ID, Location).
 * 2. Updates the Database:
 *    - Sets Status to "FINALIZED".
 *    - Locks in the chosen `finalizedSlotId` and `finalizedHostId`.
 * 3. Telegram Integration:
 *    - Deletes the previous dynamic "Voting Dashboard" message (to prevent stale voting).
 *    - Sends a new "Event Finalized" message with calendar links and static details.
 *    - Pins the new message and updates `pinnedMessageId` in DB for future reference.
 * 4. Redirects the user back to the management interface.
 *
 * @param {Request} req - The POST request containing form data.
 * @param {Object} context - Route parameters.
 * @param {string} context.params.slug - The event identifier.
 */
export async function POST(
    req: Request,
    { params }: { params: { slug: string } }
) {
    try {
        const formData = await req.formData();
        const slotId = formData.get("slotId");
        const hostId = formData.get("houseId"); // Intent: Mapped from UI "houseId" to DB "finalizedHostId"
        const location = formData.get("location");

        log.info("Request received", { slug: params.slug });

        if (!slotId) {
            log.warn("Missing Slot ID", { slug: params.slug });
            return NextResponse.json({ error: "Missing Slot ID" }, { status: 400 });
        }

        const updateData: any = {
            status: "FINALIZED",
            finalizedSlotId: parseInt(slotId.toString()),
            location: location ? location.toString() : null
        };

        if (hostId) {
            updateData.finalizedHostId = parseInt(hostId.toString());
        }

        // Action: Atomic DB Update
        const event = await prisma.event.update({
            where: { slug: params.slug },
            data: updateData,
            include: {
                timeSlots: true,
                finalizedHost: true
            }
        });

        // Action: Telegram Notification Cycle
        if (event.telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
            const { sendTelegramMessage, deleteMessage, pinChatMessage } = await import("@/lib/telegram");
            const { buildFinalizedMessage } = await import("@/lib/eventMessage");
            const slotTime = event.timeSlots.find((s: any) => s.id === parseInt(slotId.toString()))!;

            // Step 1: Remove the previous voting message (dashboard).
            // Why? To remove clutter and prevent users from trying to vote on a closed event.
            if (event.pinnedMessageId) {
                await deleteMessage(event.telegramChatId, event.pinnedMessageId, process.env.TELEGRAM_BOT_TOKEN);
            }

            // Step 2: Determine origin dynamically for absolute links.
            const { getBaseUrl } = await import("@/lib/url");
            const origin = getBaseUrl(req.headers);

            // Step 3: Construct & Send the "Finalized" message.
            const msg = buildFinalizedMessage(event, slotTime, origin);
            const msgId = await sendTelegramMessage(event.telegramChatId, msg, process.env.TELEGRAM_BOT_TOKEN);

            // Step 4: Pin the new message and track its ID.
            if (msgId) {
                await pinChatMessage(event.telegramChatId, msgId, process.env.TELEGRAM_BOT_TOKEN);

                // CRITICAL: Update the pinnedMessageId in the database.
                // Why? Allows subsequent updates (like Location Edit) to modify THIS exact message.
                await prisma.event.update({
                    where: { id: event.id },
                    data: { pinnedMessageId: msgId }
                });
            }
        }

        log.info("Event finalized successfully", { slug: params.slug });

    } catch (error) {
        log.error("Finalize failed", error as Error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }

    // Redirect back to manage page
    redirect(`/e/${params.slug}/manage`);
}
