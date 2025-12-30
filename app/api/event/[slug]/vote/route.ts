import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import Logger from "@/lib/logger";

import { checkEventQuorum } from "@/lib/quorum";

const log = Logger.get("API:Vote");

/**
 * @function POST
 * @description Handles vote submission for a specific event.
 *
 * Responsibilities:
 * 1. Data Validation: Ensures name and vote array are present.
 * 2. Participant Upsert (Atomic):
 *    - Updates existing participant if known ID provided.
 *    - Or Creates new participant (inheriting Telegram identity if matched).
 * 3. Vote persistence: Deletes old votes for the user and inserts new ones.
 * 4. Real-time Feedback (Telegram):
 *    - Sends "User X updated availability" notification to the chat.
 *    - Updates the "Pinned Dashboard" with the new vote counts (Status Message).
 * 5. Quorum Detection:
 *    - Checks if the new vote triggered a "Viable" (Min Players) or "Perfect" (All + Host) state.
 *    - Notifies the Event Manager privately if a threshold is crossed for the first time.
 *
 * @param {Request} req - JSON Payload: { name, telegramId, votes: [{ slotId, preference, canHost }], participantId? }
 * @param {Object} context - Route parameters.
 * @param {string} context.params.slug - The event identifier (Note: actually treated as ID in logic but slug in route).
 */
export async function POST(
    req: Request,
    { params }: { params: { slug: string } } // slug is actually eventId in path for some reason? No, route is /api/event/[slug]/vote.
) {
    try {
        // Intent: Parse 'slug' as ID because the frontend passes the numerical ID here.
        // Legacy: Ideally strictly slug-based, but currently numeric ID is used in API calls.
        const eventId = parseInt(params.slug);
        const body = await req.json();
        const { name, telegramId, votes, participantId } = body;

        if (!name || !votes || !Array.isArray(votes)) {
            log.warn("Invalid vote data", { eventId });
            return NextResponse.json({ error: "Invalid data" }, { status: 400 });
        }

        // Check for Max Players Regulation (if Finalized)
        const targetEvent = await prisma.event.findUnique({
            where: { id: eventId },
            select: { status: true, maxPlayers: true, slug: true }
        });

        // Intent: Determine status for the participant
        let nextStatus = undefined; // Undefined means no change or pending if new

        if (targetEvent?.status === 'FINALIZED' && targetEvent.maxPlayers) {
            const acceptedCount = await prisma.participant.count({
                where: { eventId, status: 'ACCEPTED' }
            });

            if (acceptedCount >= targetEvent.maxPlayers) {
                // If it's full, new joiners go to WAITLIST
                nextStatus = 'WAITLIST';

                // Exception: If current user is already ACCEPTED, keep them ACCEPTED 
                if (participantId) {
                    const current = await prisma.participant.findUnique({
                        where: { id: participantId },
                        select: { status: true }
                    });
                    if (current?.status === 'ACCEPTED') nextStatus = 'ACCEPTED';
                }
            } else {
                // If not full, they can be ACCEPTED (Auto-accept logic for late joiners)
                nextStatus = 'ACCEPTED';
            }
        }

        // Action: Atomic Transaction for Participant & Votes

        const result = await prisma.$transaction(async (tx: any) => {
            let participant;
            let existingVotes: any[] = [];

            // 1. Check if updating existing participant
            if (participantId) {
                const existing = await tx.participant.findUnique({
                    where: { id: participantId }
                });

                // Security: Ensure participant belongs to this event before updating.
                if (existing && existing.eventId === eventId) {
                    participant = await tx.participant.update({
                        where: { id: participantId },
                        data: { name, telegramId, status: nextStatus }
                    });

                    // Intent: Fetch existing votes to preserve timestamps for Fairness
                    existingVotes = await tx.vote.findMany({
                        where: { participantId }
                    });

                    // Clear old votes to replace with new ones
                    await tx.vote.deleteMany({
                        where: { participantId }
                    });
                }
            }

            // 2. If no valid existing participant found, create new
            if (!participant) {
                // Feature: Passive Identity Linking
                // Try to find an existing chatId for this user from other events to link them immediately.
                let existingChatId = null;
                if (telegramId) {
                    const linkedParams = {
                        where: {
                            OR: [
                                { telegramId: telegramId },
                                { telegramId: telegramId.startsWith('@') ? telegramId : `@${telegramId}` }
                            ],
                            NOT: { chatId: null }
                        },
                        select: { chatId: true }
                    };
                    const match = await tx.participant.findFirst(linkedParams);
                    existingChatId = match?.chatId;
                }

                participant = await tx.participant.create({
                    data: {
                        eventId,
                        name,
                        telegramId,
                        chatId: existingChatId, // Inherit identity if known
                        status: nextStatus || 'PENDING'
                    },
                });
            }

            // 3. Create votes with Timestamp Preservation
            const voteData = votes.map((v: any) => {
                // Check if we have an existing vote for this slot/preference
                const match = existingVotes.find(ev => ev.timeSlotId === v.slotId && ev.preference === v.preference);

                return {
                    participantId: participant.id,
                    timeSlotId: v.slotId,
                    preference: v.preference,
                    canHost: v.canHost || false,
                    // Critical: Use old timestamp if preference is unchanged, else New Date
                    createdAt: match ? match.createdAt : new Date()
                };
            });

            await tx.vote.createMany({
                data: voteData,
            });

            return participant;
        });

        // --- POST-TRANSACTION LOGIC (Notifications) ---

        // --- POST-TRANSACTION LOGIC (Notifications) ---

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: { timeSlots: { include: { votes: true } } }
        });

        const userDisplay = telegramId ? `@${telegramId.replace('@', '')}` : name;
        const participants = await prisma.participant.count({ where: { eventId } });

        // Detect URL dynamically
        const { getBaseUrl } = await import("@/lib/url");
        const { headers } = await import("next/headers");
        const headerList = headers();
        const baseUrl = getBaseUrl(headerList);
        const { generateStatusMessage } = await import("@/lib/status");
        const statusMsg = generateStatusMessage(event, participants, baseUrl);

        // --- TELEGRAM LOGIC ---
        if (event && event.telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
            const { sendTelegramMessage } = await import("@/lib/telegram");

            // Notification: Announce activity to group
            await sendTelegramMessage(event.telegramChatId, `🚀 <b>${userDisplay}</b> just updated their availability for <b>${event.title}</b>!`, process.env.TELEGRAM_BOT_TOKEN);

            // --- PINNED MESSAGE DASHBOARD SYNCHRONIZATION ---
            const { editMessageText, pinChatMessage } = await import("@/lib/telegram");

            if (event.pinnedMessageId) {
                // Update existing pin
                await editMessageText(event.telegramChatId, event.pinnedMessageId, statusMsg, process.env.TELEGRAM_BOT_TOKEN);
            } else {
                // Create new pin if missing
                const newMsgId = await sendTelegramMessage(event.telegramChatId, statusMsg, process.env.TELEGRAM_BOT_TOKEN);
                if (newMsgId) {
                    await pinChatMessage(event.telegramChatId, newMsgId, process.env.TELEGRAM_BOT_TOKEN);
                    // Save the pinned ID for future updates
                    await prisma.event.update({
                        where: { id: eventId },
                        data: { pinnedMessageId: newMsgId }
                    });
                }
            }
        }

        // --- DISCORD LOGIC ---
        log.info("Checking Discord integration", {
            hasChannel: !!event?.discordChannelId,
            channelId: event?.discordChannelId,
            envToken: !!process.env.DISCORD_BOT_TOKEN
        });

        if (event && event.discordChannelId && process.env.DISCORD_BOT_TOKEN) {
            const { sendDiscordMessage, editDiscordMessage, pinDiscordMessage } = await import("@/lib/discord");

            // Notification
            await sendDiscordMessage(event.discordChannelId, `🚀 **${userDisplay}** updated availability for **${event.title}**!`, process.env.DISCORD_BOT_TOKEN);

            // Dashboard Sync
            // Simple HTML -> Markdown Converter
            const discordMsg = statusMsg
                .replace(/<b>(.*?)<\/b>/g, '**$1**')
                .replace(/<a href="(.*?)">(.*?)<\/a>/g, '[$2]($1)')
                .replace(/<br\s*\/?>/g, '\n')
                .replace(/&nbsp;/g, ' '); // Basic entities

            if (event.discordMessageId) {
                await editDiscordMessage(event.discordChannelId, event.discordMessageId, discordMsg, process.env.DISCORD_BOT_TOKEN);
                log.info("Discord dashboard updated", { msgId: event.discordMessageId });
            } else {
                const res = await sendDiscordMessage(event.discordChannelId, discordMsg, process.env.DISCORD_BOT_TOKEN);
                if (res.id) {
                    await pinDiscordMessage(event.discordChannelId, res.id, process.env.DISCORD_BOT_TOKEN);
                    await prisma.event.update({
                        where: { id: eventId },
                        data: { discordMessageId: res.id }
                    });
                    log.info("Discord dashboard created and pinned", { newMsgId: res.id });
                } else {
                    log.warn("Failed to create Discord dashboard message", { error: res.error });
                }
            }
        }

        // --- FINALIZED EVENT: WAITLIST AUTO-PROMOTION LOGIC ---
        if (event && event.status === 'FINALIZED' && event.maxPlayers) {
            // Re-fetch counts to see if a spot opened up
            const count = await prisma.participant.count({
                where: { eventId, status: 'ACCEPTED' }
            });

            if (count < event.maxPlayers) {
                const spotsAvailable = event.maxPlayers - count;

                // Find next in line
                const waitlist = await prisma.participant.findMany({
                    where: { eventId, status: 'WAITLIST' },
                    orderBy: { createdAt: 'asc' }, // FCFS
                    take: spotsAvailable
                });

                for (const candidate of waitlist) {
                    // Promote
                    await prisma.participant.update({
                        where: { id: candidate.id },
                        data: { status: 'ACCEPTED' }
                    });

                    // Notify Candidate via Telegram
                    if (candidate.chatId && process.env.TELEGRAM_BOT_TOKEN) {
                        const { sendTelegramMessage } = await import("@/lib/telegram");
                        await sendTelegramMessage(
                            candidate.chatId,
                            `🎟️ <b>You're In!</b>\n\nA spot opened up for <b>${event.title}</b> and you've been moved off the waitlist!`,
                            process.env.TELEGRAM_BOT_TOKEN
                        );
                    }

                    // Notify Candidate via Discord (if mapped)
                    if (candidate.discordId && process.env.DISCORD_BOT_TOKEN) {
                        const { createDMChannel, sendDiscordMessage } = await import("@/lib/discord");
                        const dm = await createDMChannel(candidate.discordId, process.env.DISCORD_BOT_TOKEN);
                        if (dm.id) {
                            await sendDiscordMessage(dm.id, `🎟️ **You're In!**\n\nA spot opened up for **${event.title}** and you've been moved off the waitlist!`, process.env.DISCORD_BOT_TOKEN);
                        }
                    }

                    log.info("Auto-promoted user from waitlist", { eventId, participantId: candidate.id });
                }
            }
        }

        // --- QUORUM & MANAGER NOTIFICATION LOGIC ---

        if (event && event.managerChatId && process.env.TELEGRAM_BOT_TOKEN) {
            const { sendTelegramMessage } = await import("@/lib/telegram");
            const { getBaseUrl } = await import("@/lib/url");
            const { headers } = await import("next/headers");
            const baseUrl = getBaseUrl(headers());
            const link = `${baseUrl}/e/${event.slug}/manage`;

            // Check Quorum Status
            const participantsCount = await prisma.participant.count({ where: { eventId } });
            const quorum = checkEventQuorum(event as any, participantsCount);

            // 1. Perfect Match (Supersedes Viable)
            if (quorum.perfect) {
                if (!event.quorumPerfectNotified) {
                    await sendTelegramMessage(
                        event.managerChatId,
                        `🌟 <b>Perfect Match Found</b> for <b>${event.title}</b>!\n\nEveryone can make it and you have a host!\n\n👉 <a href="${link}">Finalize Now</a>`,
                        process.env.TELEGRAM_BOT_TOKEN
                    );

                    // Update both flags to prevent downgrading or double-pinging
                    await prisma.event.update({
                        where: { id: eventId },
                        data: { quorumPerfectNotified: true, quorumViableNotified: true }
                    });
                    log.info("Notified Perfect Quorum", { slug: event.slug });
                }
            }
            // 2. Viable Match
            else if (quorum.viable) {
                if (!event.quorumViableNotified) {
                    await sendTelegramMessage(
                        event.managerChatId,
                        `🎉 <b>Viable Quorum Reached</b> for <b>${event.title}</b>!\n\nYou have enough players for a game.\n\n👉 <a href="${link}">Manage Event</a>`,
                        process.env.TELEGRAM_BOT_TOKEN
                    );

                    await prisma.event.update({
                        where: { id: eventId },
                        data: { quorumViableNotified: true }
                    });
                    log.info("Notified Viable Quorum", { slug: event.slug });
                }
            }
        }

        log.info(`Vote processed successfully`, { participantId: result.id, eventId });
        return NextResponse.json({ success: true, participantId: result.id });
    } catch (error) {
        log.error("Vote failed", error as Error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
