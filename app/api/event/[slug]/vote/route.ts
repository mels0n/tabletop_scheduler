import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { readIdentity } from "@/shared/lib/session";

import { checkEventQuorum } from "@/shared/lib/quorum";
import { processWaitlistPromotion } from "@/features/event-management/server/waitlist";
import { resolvePassiveChatId } from "@/features/auth/server/passive-link";
import { normalizeHandle } from "@/shared/lib/handle";

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
 * @param {Request} req - JSON Payload: { name, telegramId, votes: [{ slotId, preference, canHost }], participantId?, linkTelegram?, linkDiscord? }
 *   `linkTelegram`/`linkDiscord` (each default true): when explicitly false, opts this
 *   vote out of that platform's identity linking — `linkTelegram=false` skips passive
 *   chatId resolution/self-heal, `linkDiscord=false` doesn't write discordId/discordUsername.
 *   Legacy clients may still send the combined `linkIdentity`, which is used as the
 *   fallback for both when the per-platform flags are absent.
 *   Body-supplied `discordId`/`discordUsername` are accepted but IGNORED: Discord identity
 *   is read from the httpOnly OAuth session cookies (tabletop_user_discord_id/_name), so a
 *   request can never attach a Discord account its sender doesn't hold a session for.
 * @param {Object} context - Route parameters.
 * @param {string} context.params.slug - The event identifier (Note: actually treated as ID in logic but slug in route).
 */
export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
    const params = await props.params;
    try {
        // Intent: Parse 'slug' as ID because the frontend passes the numerical ID here.
        // Legacy: Ideally strictly slug-based, but currently numeric ID is used in API calls.
        const eventId = parseInt(params.slug);
        const body = await req.json();
        const { name, participantId, linkIdentity, linkTelegram, linkDiscord } = body;
        let { telegramId, votes } = body;

        // Security: Discord identity comes from the OAuth session cookies only. The body's
        // discordId/discordUsername (still sent by clients) are ignored so a forged payload
        // can't attach an arbitrary Discord user to a participant (and later cause the bot
        // to DM someone who never authorized us).
        const cookieStore = await cookies();
        const discordId = readIdentity(cookieStore).discordId ?? undefined;
        const discordUsername = discordId ? cookieStore.get("tabletop_user_discord_name")?.value : undefined;

        // Canonicalize the handle at the write boundary: users may type it with or
        // without '@', so store it '@'-less and lowercased. Display code re-adds one '@'.
        telegramId = normalizeHandle(telegramId);

        // Feature: Per-platform vote-time identity toggles. The client now sends a
        // separate flag per platform; both default to true so a missing field keeps
        // the historical "link everything" behavior. Older clients that only send the
        // combined `linkIdentity` fall back to it, so a deploy-window opt-out is honored.
        const shouldLinkTelegram = linkTelegram !== undefined ? linkTelegram !== false : linkIdentity !== false;
        const shouldLinkDiscord = linkDiscord !== undefined ? linkDiscord !== false : linkIdentity !== false;

        if (!name || !votes || !Array.isArray(votes)) {
            log.warn("Invalid vote data", { eventId });
            return NextResponse.json({ error: "Invalid data" }, { status: 400 });
        }

        const validVotes = votes.filter(v => v.preference === 'YES' || v.preference === 'NO' || v.preference === 'MAYBE');
        if (validVotes.length !== votes.length) {
            log.warn("Invalid vote preference found", { eventId, votes });
            // For resilience, we just continue with valid votes or we can return 400
            // Since frontend now filters it, any mismatch means malformed client. 
            // We just re-assign votes to validVotes
        }
        votes = validVotes;

        // Check for Max Players Regulation (if Finalized)
        const targetEvent = await prisma.event.findUnique({
            where: { id: eventId },
            select: { status: true, maxPlayers: true, slug: true, finalizedSlotId: true }
        });

        // Intent: Determine status for the participant
        let nextStatus = undefined; // Undefined means no change or pending if new

        if (targetEvent?.status === 'FINALIZED') {
            // 1. Check if this vote is a "NO" for the finalized slot
            const finalizedVote = votes.find((v: any) => v.slotId === targetEvent.finalizedSlotId);

            if (finalizedVote && finalizedVote.preference === 'NO') {
                // User is voluntarily leaving the finalized slot
                nextStatus = 'PENDING';
            }
            else if (targetEvent.maxPlayers) {
                // 2. Logic for YES/MAYBE votes when Max Players is active
                const acceptedCount = await prisma.participant.count({
                    where: { eventId, status: 'ACCEPTED' }
                });

                if (acceptedCount >= targetEvent.maxPlayers) {
                    // event full -> waitlist
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
                    // spots open -> accept
                    nextStatus = 'ACCEPTED';
                }
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
                    // Feature: Passive Identity Linking (Self-Healing)
                    // If this participant still has no verified chatId, this re-vote is a
                    // chance to self-heal via the same resolution as new-participant creation.
                    // Only attempt it when a chatId is missing, and never overwrite one already set.
                    let resolvedChatId: string | null = null;
                    if (!existing.chatId && telegramId && shouldLinkTelegram) {
                        resolvedChatId = await resolvePassiveChatId(tx, telegramId);
                    }

                    participant = await tx.participant.update({
                        where: { id: participantId },
                        data: {
                            name,
                            telegramId,
                            status: nextStatus,
                            // Opt-out (or no Discord session): leave discordId/discordUsername untouched.
                            ...(shouldLinkDiscord && discordId ? { discordId, discordUsername } : {}),
                            // Only include chatId when we actually resolved one; avoid churn.
                            ...(resolvedChatId ? { chatId: resolvedChatId } : {})
                        }
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
                // Try to find an existing verified chatId for this user so their new Participant
                // row isn't invisible to cross-device profile sync (which resolves events strictly
                // by numeric chatId). Checks other Participant rows first, then falls back to the
                // Event manager record (see resolvePassiveChatId for both steps).
                let existingChatId = null;
                if (telegramId && shouldLinkTelegram) {
                    existingChatId = await resolvePassiveChatId(tx, telegramId);
                }

                participant = await tx.participant.create({
                    data: {
                        eventId,
                        name,
                        telegramId,
                        // Opt-out (or no Discord session): don't stamp Discord identity onto a fresh row.
                        ...(shouldLinkDiscord && discordId ? { discordId, discordUsername } : {}),
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

        // --- NOTIFICATION PREPARATION ---
        const userDisplay = telegramId ? `@${telegramId.replace('@', '')}` : name;

        // --- FINALIZED EVENT: WAITLIST AUTO-PROMOTION LOGIC ---
        if (event && event.status === 'FINALIZED' && event.maxPlayers) {
            await processWaitlistPromotion(event.id);
        }

        // --- UNIFIED DASHBOARD SYNCHRONIZATION ---
        const { syncDashboard } = await import("@/app/api/event/[slug]/slot/notify");
        await syncDashboard(eventId);

        if (event && (event.telegramChatId || event.discordChannelId)) {
            const { broadcastToEvent } = await import("@/features/notifications");
            await broadcastToEvent(
                { telegramChatId: event.telegramChatId, discordChannelId: event.discordChannelId },
                {
                    html: `🚀 <b>${userDisplay}</b> just updated their availability for <b>${event.title}</b>!`,
                    discord: `🚀 **${userDisplay}** updated availability for **${event.title}**!`,
                },
                { slug: event.slug, kind: "vote-update" }
            );
        }

        // --- QUORUM & MANAGER NOTIFICATION LOGIC ---

        if (event && !(event.quorumPerfectNotified && event.quorumViableNotified)) {
            const { sendDirectMessage, isDelivered } = await import("@/features/notifications");
            const { getBaseUrl } = await import("@/shared/lib/url");
            const baseUrl = getBaseUrl();
            const link = `${baseUrl}/e/${event.slug}/manage`;
            const managerTarget = { telegramChatId: event.managerChatId, discordUserId: event.managerDiscordId };
            const hasManagerLink = Boolean(event.managerChatId || event.managerDiscordId);

            // Check Quorum Status
            const participantsCount = await prisma.participant.count({ where: { eventId } });
            const quorum = checkEventQuorum(event as any, participantsCount);

            // Flag only once the DM landed on some platform. With no manager link, or a failed
            // send, the flag stays unset: the next vote retries, and voting reminders (which stop
            // at viable quorum) keep running as they always have for unlinked managers.

            // 1. Perfect Match (Supersedes Viable)
            if (quorum.perfect) {
                if (!event.quorumPerfectNotified) {
                    const result = hasManagerLink
                        ? await sendDirectMessage(
                            managerTarget,
                            { html: `🌟 <b>Perfect Match Found</b> for <b>${event.title}</b>!\n\nEveryone can make it and you have a host!\n\n👉 <a href="${link}">Finalize Now</a>` },
                            { slug: event.slug, kind: "quorum-perfect" }
                        )
                        : null;

                    if (result && isDelivered(result)) {
                        // Update both flags to prevent downgrading or double-pinging
                        await prisma.event.update({
                            where: { id: eventId },
                            data: { quorumPerfectNotified: true, quorumViableNotified: true }
                        });
                        log.info("Notified Perfect Quorum", { slug: event.slug });
                    }
                }
            }
            // 2. Viable Match
            else if (quorum.viable) {
                if (!event.quorumViableNotified) {
                    const result = hasManagerLink
                        ? await sendDirectMessage(
                            managerTarget,
                            { html: `🎉 <b>Viable Quorum Reached</b> for <b>${event.title}</b>!\n\nYou have enough players for a game.\n\n👉 <a href="${link}">Manage Event</a>` },
                            { slug: event.slug, kind: "quorum-viable" }
                        )
                        : null;

                    if (result && isDelivered(result)) {
                        await prisma.event.update({
                            where: { id: eventId },
                            data: { quorumViableNotified: true }
                        });
                        log.info("Notified Viable Quorum", { slug: event.slug });
                    }
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
