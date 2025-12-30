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

        // --- SELECTION ALGORITHM ---
        const sId = parseInt(slotId.toString());

        // 1. Fetch all votes for this slot
        const votes = await prisma.vote.findMany({
            where: {
                timeSlotId: sId,
                preference: { in: ['YES', 'MAYBE'] }
            },
            include: { participant: true }
        });

        // 2. Fetch Event Settings
        const currentEvent = await prisma.event.findUnique({ where: { slug: params.slug }, select: { maxPlayers: true, title: true } });
        const max = currentEvent?.maxPlayers;

        let acceptedIds: number[] = [];
        let waitlistIds: number[] = [];
        let acceptedNames: string[] = [];
        let waitlistNames: string[] = [];

        if (max && votes.length > max) {
            // Sort: YES < MAYBE, then Oldest CreatedAt < Newest CreatedAt
            votes.sort((a, b) => {
                const prefTimeout = (p: string) => p === 'YES' ? 0 : 1;
                if (prefTimeout(a.preference) !== prefTimeout(b.preference)) {
                    return prefTimeout(a.preference) - prefTimeout(b.preference);
                }
                return a.createdAt.getTime() - b.createdAt.getTime();
            });

            const selected = votes.slice(0, max);
            const waiting = votes.slice(max);

            acceptedIds = selected.map(v => v.participantId);
            waitlistIds = waiting.map(v => v.participantId);
            acceptedNames = selected.map(v => v.participant.name);
            waitlistNames = waiting.map(v => v.participant.name);
        } else {
            // Everyone gets in
            acceptedIds = votes.map(v => v.participantId);
            acceptedNames = votes.map(v => v.participant.name);
        }

        // --- ATOMIC DB UPDATE ---
        const event = await prisma.$transaction(async (tx) => {
            // 1. Update Event
            const updatedEvent = await tx.event.update({
                where: { slug: params.slug },
                data: updateData,
                include: {
                    timeSlots: true,
                    finalizedHost: true
                }
            });

            // 2. Update Participants
            if (acceptedIds.length > 0) {
                await tx.participant.updateMany({
                    where: { id: { in: acceptedIds } },
                    data: { status: 'ACCEPTED' }
                });
            }
            if (waitlistIds.length > 0) {
                await tx.participant.updateMany({
                    where: { id: { in: waitlistIds } },
                    data: { status: 'WAITLIST' }
                });
            }

            return updatedEvent;
        });

        const { getBaseUrl } = await import("@/lib/url");
        const origin = getBaseUrl(req.headers);
        const eventLink = `${origin}/e/${params.slug}`;

        // --- DM NOTIFICATIONS ---
        // Feature: Opt-in DMs (We use chatId presence as opt-in/capability)
        if (process.env.TELEGRAM_BOT_TOKEN) {
            const { sendTelegramMessage } = await import("@/lib/telegram");

            // Notify Accepted
            const acceptedParticipants = votes.filter(v => acceptedIds.includes(v.participantId));
            for (const p of acceptedParticipants) {
                if (p.participant.chatId) {
                    await sendTelegramMessage(
                        p.participant.chatId,
                        `🎟️ <b>You made the cut!</b>\n\nYou are confirmed for <b>${currentEvent?.title}</b>.\n<a href="${eventLink}">View Details</a>`,
                        process.env.TELEGRAM_BOT_TOKEN
                    );
                }
            }

            // Notify Waitlisted
            const waitlistedParticipants = votes.filter(v => waitlistIds.includes(v.participantId));
            for (const p of waitlistedParticipants) {
                if (p.participant.chatId) {
                    await sendTelegramMessage(
                        p.participant.chatId,
                        `⚠️ <b>Event Full</b>\n\nYou are on the <b>Waitlist</b> for <b>${currentEvent?.title}</b>.\nWe'll let you know if a spot opens up!`,
                        process.env.TELEGRAM_BOT_TOKEN
                    );
                }
            }
        }

        // Action: Telegram Notification Cycle (Public Group)
        if (event.telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
            const { sendTelegramMessage, deleteMessage, pinChatMessage } = await import("@/lib/telegram");
            const { buildFinalizedMessage } = await import("@/lib/eventMessage");
            const slotTime = event.timeSlots.find((s: any) => s.id === parseInt(slotId.toString()))!;

            // Step 1: Remove the previous voting message (dashboard).
            // Why? To remove clutter and prevent users from trying to vote on a closed event.
            if (event.pinnedMessageId) {
                await deleteMessage(event.telegramChatId, event.pinnedMessageId, process.env.TELEGRAM_BOT_TOKEN);
            }

            // Step 3: Construct & Send the "Finalized" message.
            const msg = buildFinalizedMessage(event, slotTime, origin, acceptedNames, waitlistNames);
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

        // Action: Discord Notification Cycle
        if (event.discordChannelId && process.env.DISCORD_BOT_TOKEN) {
            const { sendDiscordMessage, pinDiscordMessage, unpinDiscordMessage } = await import("@/lib/discord");
            const { buildFinalizedMessage } = await import("@/lib/eventMessage");
            const slotTime = event.timeSlots.find((s: any) => s.id === parseInt(slotId.toString()))!;

            // Step 1: Unpin the previous voting message (dashboard).
            if (event.discordMessageId) {
                await unpinDiscordMessage(event.discordChannelId, event.discordMessageId, process.env.DISCORD_BOT_TOKEN);
            }

            // Step 3: Construct & Send the "Finalized" message.
            const htmlMsg = buildFinalizedMessage(event, slotTime, origin, acceptedNames, waitlistNames);
            // Convert HTML to Markdown for Discord
            const discordMsg = htmlMsg
                .replace(/<b>(.*?)<\/b>/g, '**$1**')
                .replace(/<a href="(.*?)">(.*?)<\/a>/g, '[$2]($1)')
                .replace(/ \| /g, ' • ') // Cleaner separator for links
                .replace(/<br\s*\/?>/g, '\n')
                .replace(/&nbsp;/g, ' ');

            const res = await sendDiscordMessage(event.discordChannelId, discordMsg, process.env.DISCORD_BOT_TOKEN);
            const msgId = res.id;

            // Step 4: Pin the new message and track its ID.
            if (msgId) {
                await pinDiscordMessage(event.discordChannelId, msgId, process.env.DISCORD_BOT_TOKEN);

                await prisma.event.update({
                    where: { id: event.id },
                    data: { discordMessageId: msgId }
                });
            } else {
                log.warn("Failed to send Discord finalize message", { error: res.error });
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
