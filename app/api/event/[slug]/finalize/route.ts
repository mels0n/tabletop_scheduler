import { NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import { redirect } from "next/navigation";
import Logger from "@/shared/lib/logger";

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

        const { verifyEventAdmin } = await import("@/features/auth/server/actions");
        if (!await verifyEventAdmin(params.slug)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        const currentEvent = await prisma.event.findUnique({ where: { slug: params.slug }, select: { maxPlayers: true, minPlayers: true, title: true } });
        const max = currentEvent?.maxPlayers;
        const min = currentEvent?.minPlayers || 0;

        let acceptedIds: number[] = [];
        let waitlistIds: number[] = [];
        let acceptedNames: string[] = [];
        let waitlistNames: string[] = [];

        // Sort Helper: Oldest First
        const byTime = (a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime();

        const yesVotes = votes.filter(v => v.preference === 'YES').sort(byTime);
        const maybeVotes = votes.filter(v => v.preference === 'MAYBE').sort(byTime);

        // Core Logic:
        // 1. Take as many YES votes as possible (up to Max)
        const yesAccepted = max ? yesVotes.slice(0, max) : yesVotes;

        // 2. Check if we met Min Players
        let currentCount = yesAccepted.length;
        let maybeAccepted: typeof votes = [];

        if (currentCount < min) {
            const needed = min - currentCount;
            // Fill gap with MAYBE votes
            maybeAccepted = maybeVotes.slice(0, needed);
            currentCount += maybeAccepted.length;
        }

        // 3. Combine Accepted
        const allAccepted = [...yesAccepted, ...maybeAccepted];

        // 4. Everyone else -> Waitlist
        // (Waitlist priority: YES > MAYBE > Time)
        const yesWaitlist = max ? yesVotes.slice(max) : []; // Excess Yes
        const maybeWaitlist = maybeVotes.slice(maybeAccepted.length); // Excess Maybe

        const allWaitlist = [...yesWaitlist, ...maybeWaitlist];
        // Ensure waitlist is sorted by Preference then Time (Yes first)
        allWaitlist.sort((a, b) => {
            if (a.preference !== b.preference) {
                return a.preference === 'YES' ? -1 : 1;
            }
            return a.createdAt.getTime() - b.createdAt.getTime();
        });

        acceptedIds = allAccepted.map(v => v.participantId);
        waitlistIds = allWaitlist.map(v => v.participantId);
        acceptedNames = allAccepted.map(v => v.participant.name);
        waitlistNames = allWaitlist.map(v => v.participant.name);

        // --- ATOMIC DB UPDATE ---
        const transactionResult = await prisma.$transaction(async (tx) => {
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

            // If external URL provided, enqueue the webhook task immediately
            // If external URL provided, enqueue the webhook task immediately
            // Capture slot details for the payload
            const sTime = updatedEvent.timeSlots.find(s => s.id === updatedEvent.finalizedSlotId);

            // If external URL provided, enqueue the webhook task immediately
            let webhookId: string | null = null;
            if (updatedEvent.fromUrl) {
                const { getBaseUrl } = await import("@/shared/lib/url");
                const origin = getBaseUrl(req.headers);

                const wh = await tx.webhookEvent.create({
                    data: {
                        eventId: updatedEvent.id,
                        url: updatedEvent.fromUrl,
                        status: "PENDING",
                        nextAttempt: new Date(), // Process immediately
                        payload: JSON.stringify({
                            type: "FINALIZED",
                            eventId: updatedEvent.id,
                            fromUrlId: updatedEvent.fromUrlId || null,
                            slug: updatedEvent.slug,
                            link: `${origin}/e/${updatedEvent.slug}`,
                            title: updatedEvent.title,
                            finalizedSlot: {
                                id: updatedEvent.finalizedSlotId,
                                startTime: sTime?.startTime.toISOString(),
                                endTime: sTime?.endTime.toISOString()
                            },
                            attendees: acceptedNames,
                            waitlist: waitlistNames,
                            location: updatedEvent.location,
                            timestamp: new Date().toISOString()
                        })
                    }
                });
                webhookId = wh.id;
            }

            return { event: updatedEvent, webhookId };
        });

        const { event: finalizedEvent, webhookId } = transactionResult;

        // Inline Hook Delivery
        if (webhookId) {
            const { processWebhook } = await import("@/shared/lib/webhook-sender");
            await processWebhook(webhookId);
        }

        const { getBaseUrl } = await import("@/shared/lib/url");
        const origin = getBaseUrl(req.headers);
        const eventLink = `${origin}/e/${params.slug}`;

        // --- DM NOTIFICATIONS ---
        // Feature: Opt-in DMs (We use chatId presence as opt-in/capability)
        if (process.env.TELEGRAM_BOT_TOKEN) {
            const { sendTelegramMessage } = await import("@/features/telegram");

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
        if (finalizedEvent.telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
            const { sendTelegramMessage, deleteMessage, pinChatMessage } = await import("@/features/telegram");
            const { buildFinalizedMessage } = await import("@/shared/lib/eventMessage");
            const slotTime = finalizedEvent.timeSlots.find((s: any) => s.id === parseInt(slotId.toString()))!;

            // Step 1: Remove the previous voting message (dashboard).
            // Why? To remove clutter and prevent users from trying to vote on a closed event.
            if (finalizedEvent.pinnedMessageId) {
                await deleteMessage(finalizedEvent.telegramChatId, finalizedEvent.pinnedMessageId, process.env.TELEGRAM_BOT_TOKEN);
            }

            // Step 3: Construct & Send the "Finalized" message.
            const msg = buildFinalizedMessage(finalizedEvent, slotTime, origin, acceptedNames, waitlistNames);
            const msgId = await sendTelegramMessage(finalizedEvent.telegramChatId, msg, process.env.TELEGRAM_BOT_TOKEN);

            // Step 4: Pin the new message and track its ID.
            if (msgId) {
                await pinChatMessage(finalizedEvent.telegramChatId, msgId, process.env.TELEGRAM_BOT_TOKEN);

                // CRITICAL: Update the pinnedMessageId in the database.
                // Why? Allows subsequent updates (like Location Edit) to modify THIS exact message.
                await prisma.event.update({
                    where: { id: finalizedEvent.id },
                    data: { pinnedMessageId: msgId }
                });
            }
        }

        // Action: Discord Notification Cycle
        if (finalizedEvent.discordChannelId && process.env.DISCORD_BOT_TOKEN) {
            const { sendDiscordMessage, pinDiscordMessage, unpinDiscordMessage } = await import("@/features/discord/model/discord");
            const { buildFinalizedMessage } = await import("@/shared/lib/eventMessage");
            const slotTime = finalizedEvent.timeSlots.find((s: any) => s.id === parseInt(slotId.toString()))!;

            // Step 1: Unpin the previous voting message (dashboard).
            if (finalizedEvent.discordMessageId) {
                await unpinDiscordMessage(finalizedEvent.discordChannelId, finalizedEvent.discordMessageId, process.env.DISCORD_BOT_TOKEN);
            }

            // Step 3: Construct & Send the "Finalized" message.
            const htmlMsg = buildFinalizedMessage(finalizedEvent, slotTime, origin, acceptedNames, waitlistNames);
            // Convert HTML to Markdown for Discord
            const discordMsg = htmlMsg
                .replace(/<b>(.*?)<\/b>/g, '**$1**')
                .replace(/<a href="(.*?)">(.*?)<\/a>/g, '[$2]($1)')
                .replace(/ \| /g, ' • ') // Cleaner separator for links
                .replace(/<br\s*\/?>/g, '\n')
                .replace(/&nbsp;/g, ' ');

            const res = await sendDiscordMessage(finalizedEvent.discordChannelId, discordMsg, process.env.DISCORD_BOT_TOKEN);
            const msgId = res.id;

            // Step 4: Pin the new message and track its ID.
            if (msgId) {
                await pinDiscordMessage(finalizedEvent.discordChannelId, msgId, process.env.DISCORD_BOT_TOKEN);

                await prisma.event.update({
                    where: { id: finalizedEvent.id },
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
