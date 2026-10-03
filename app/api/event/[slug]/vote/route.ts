import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";

import { checkEventQuorum } from "@/shared/lib/quorum";
import { processWaitlistPromotion } from "@/features/event-management/server/waitlist";
import { resolvePassiveChatId } from "@/features/auth/server/passive-link";
import { normalizeHandle } from "@/shared/lib/handle";
import { identityCookieOptions, readIdentity, signValue, verifyValue } from "@/shared/lib/session";
import { ForbiddenError, NotFoundError, ValidationError, toResponse } from "@/shared/errors";
import { idParam, voteSchema } from "@/features/event-management/model/schemas";

const log = Logger.get("API:Vote");

/** Signed cookie proving this browser created a participant row: value `signValue(String(participantId))`. */
function participantCookieName(eventSlug: string): string {
    return `tabletop_participant_${eventSlug}`;
}

/**
 * @function POST
 * @description Handles vote submission for a specific event.
 *
 * Responsibilities:
 * 1. Data Validation: `voteSchema` (bounded name, at most 100 unique slot IDs).
 * 2. Participant Upsert (Atomic):
 *    - Updates an existing participant only when the caller owns it: the signed
 *      `tabletop_participant_<slug>` cookie names that participant, or a verified identity
 *      cookie matches the row's chatId/discordId. Anyone else gets 403.
 *    - Or Creates new participant (inheriting Telegram identity if matched) and sets the
 *      signed participant cookie on the response.
 * 3. Vote persistence: every slotId must belong to this event (400 otherwise); old votes for
 *    the user are replaced. The capacity count and status decision run in the same transaction.
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
 *   is read from the signed OAuth session cookie (tabletop_user_discord_id), so a
 *   request can never attach a Discord account its sender doesn't hold a session for.
 * @param {Object} context - Route parameters.
 * @param {string} context.params.slug - The numeric event ID (the clients post to /api/event/<id>/vote).
 */
export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
    const { slug: eventIdParam } = await props.params;
    try {
        const eventId = idParam.parse(eventIdParam);
        const body = voteSchema.parse(await req.json());
        const { name, participantId, linkIdentity, linkTelegram, linkDiscord, votes } = body;

        // Security: Discord identity comes from the signed OAuth session cookie only. The body's
        // discordId/discordUsername (still sent by clients) are ignored so a forged payload
        // can't attach an arbitrary Discord user to a participant (and later cause the bot
        // to DM someone who never authorized us).
        const cookieStore = await cookies();
        const identity = readIdentity(cookieStore);
        const discordId = identity.discordId;
        const discordUsername = discordId ? cookieStore.get("tabletop_user_discord_name")?.value ?? null : null;

        // Canonicalize the handle at the write boundary: users may type it with or
        // without '@', so store it '@'-less and lowercased. Display code re-adds one '@'.
        const telegramId = normalizeHandle(body.telegramId ?? null);

        // Feature: Per-platform vote-time identity toggles. The client now sends a
        // separate flag per platform; both default to true so a missing field keeps
        // the historical "link everything" behavior. Older clients that only send the
        // combined `linkIdentity` fall back to it, so a deploy-window opt-out is honored.
        const shouldLinkTelegram = linkTelegram !== undefined ? linkTelegram !== false : linkIdentity !== false;
        const shouldLinkDiscord = linkDiscord !== undefined ? linkDiscord !== false : linkIdentity !== false;

        const targetEvent = await prisma.event.findUnique({
            where: { id: eventId },
            select: { status: true, maxPlayers: true, slug: true, finalizedSlotId: true }
        });
        if (!targetEvent) {
            throw new NotFoundError("Event not found");
        }

        const cookieName = participantCookieName(targetEvent.slug);
        const ownedParticipantId = verifyValue(cookieStore.get(cookieName)?.value);
        const ownsParticipant = (row: { id: number; chatId: string | null; discordId: string | null }) =>
            ownedParticipantId === String(row.id)
            || (identity.chatId !== null && row.chatId === identity.chatId)
            || (identity.discordId !== null && row.discordId === identity.discordId);

        // Action: Atomic Transaction for Participant & Votes

        const result = await prisma.$transaction(async (tx: any) => {
            // 1. Every vote must target one of this event's slots.
            const eventSlots: { id: number }[] = await tx.timeSlot.findMany({
                where: { eventId },
                select: { id: true }
            });
            const eventSlotIds = new Set(eventSlots.map(s => s.id));
            if (votes.some(v => !eventSlotIds.has(v.slotId))) {
                throw new ValidationError("Vote references a slot that is not part of this event");
            }

            // 2. Existing participant: must belong to this event and to the caller.
            let existing: any = null;
            if (participantId) {
                existing = await tx.participant.findFirst({
                    where: { id: participantId, eventId }
                });
                if (existing && !ownsParticipant(existing)) {
                    throw new ForbiddenError("You can only change your own response");
                }
            }

            // 3. Status for a finalized event, decided against a count taken in this transaction.
            let nextStatus: string | undefined = undefined; // Undefined means no change or pending if new

            if (targetEvent.status === 'FINALIZED') {
                const finalizedVote = votes.find(v => v.slotId === targetEvent.finalizedSlotId);

                if (finalizedVote && finalizedVote.preference === 'NO') {
                    // User is voluntarily leaving the finalized slot
                    nextStatus = 'PENDING';
                }
                else if (targetEvent.maxPlayers) {
                    // Touch the event row first: on Postgres this takes a row lock, so concurrent
                    // votes for the same event serialize and cannot both take the last seat.
                    await tx.event.updateMany({ where: { id: eventId }, data: { updatedAt: new Date() } });

                    const acceptedCount = await tx.participant.count({
                        where: { eventId, status: 'ACCEPTED' }
                    });

                    if (existing?.status === 'ACCEPTED') {
                        nextStatus = 'ACCEPTED';
                    } else {
                        nextStatus = acceptedCount >= targetEvent.maxPlayers ? 'WAITLIST' : 'ACCEPTED';
                    }
                }
            }

            let participant: any;
            let existingVotes: any[] = [];

            if (existing) {
                // Feature: Passive Identity Linking (Self-Healing)
                // If this participant still has no verified chatId, this re-vote is a
                // chance to self-heal via the same resolution as new-participant creation.
                // Only attempt it when a chatId is missing, and never overwrite one already set.
                let resolvedChatId: string | null = null;
                if (!existing.chatId && telegramId && shouldLinkTelegram) {
                    resolvedChatId = await resolvePassiveChatId(tx, telegramId);
                }

                participant = await tx.participant.update({
                    where: { id: existing.id },
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
                    where: { participantId: existing.id }
                });

                // Clear old votes to replace with new ones
                await tx.vote.deleteMany({
                    where: { participantId: existing.id }
                });
            }

            // 4. If no valid existing participant found, create new
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

            // 5. Create votes with Timestamp Preservation
            const voteData = votes.map(v => {
                // Check if we have an existing vote for this slot/preference
                const match = existingVotes.find(ev => ev.timeSlotId === v.slotId && ev.preference === v.preference);

                return {
                    participantId: participant.id,
                    timeSlotId: v.slotId,
                    preference: v.preference,
                    canHost: v.canHost,
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
        const response = NextResponse.json({ success: true, participantId: result.id });
        // Proof of ownership for later edits from this browser (refreshed on every authorized vote).
        response.cookies.set(cookieName, signValue(String(result.id)), identityCookieOptions());
        return response;
    } catch (error) {
        return toResponse(error, log);
    }
}
