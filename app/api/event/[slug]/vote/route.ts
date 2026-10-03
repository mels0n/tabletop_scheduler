import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";

import { checkEventQuorum } from "@/shared/lib/quorum";
import { processWaitlistPromotion } from "@/features/event-management/server/waitlist";
import { normalizeHandle } from "@/shared/lib/handle";
import {
    identityCookieOptions,
    participantCookieName,
    participantPurpose,
    readDiscordDisplayName,
    readIdentity,
    signValue,
    verifyValue,
} from "@/shared/lib/session";
import { AppError, NotFoundError, ValidationError, toResponse } from "@/shared/errors";
import { idParam, voteSchema } from "@/features/event-management/model/schemas";
import { isLegacyParticipant } from "@/entities/participant";
import { PARTICIPANT_NOT_OWNED } from "@/features/event-management/model/vote-errors";
import { escapeDiscordMarkdown, escapeHtml } from "@/shared/lib/escape";

const log = Logger.get("API:Vote");

/** 403 for an edit of a participant row this browser cannot prove it owns. The client keys its message on `code`. */
class ParticipantNotOwnedError extends AppError {
    constructor() {
        super("You can only change your own response. Sign in with Telegram or Discord to edit this vote.", 403, PARTICIPANT_NOT_OWNED);
    }
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
 *      cookie matches the row's chatId/discordId. Anyone else gets 403 with
 *      `code: 'participant_not_owned'`.
 *    - Legacy rows: a row with no `ownerCookieIssuedAt` marker was created before participant
 *      cookies existed, so it is accepted by its stored id from any browser. The same
 *      transaction marks it with a conditional update (`ownerCookieIssuedAt: null` in the
 *      where), and the response issues the cookie. If that update matches nothing, another
 *      browser claimed the row first and the normal check applies. A marked row never
 *      reverts, so the legacy path is single-use per row and needs no date cutoff.
 *    - Or Creates new participant, marked in the same create, and sets the signed participant
 *      cookie on the response.
 *    - Identity is linked only from verified (signed) cookies: the Telegram chatId from
 *      `tabletop_user_chat_id`, Discord from `tabletop_user_discord_id`. A typed handle never
 *      resolves to a chatId.
 * 3. Vote persistence: every slotId must belong to this event (400 otherwise); old votes for
 *    the user are replaced. The capacity count and status decision run in the same transaction.
 * 4. Quorum Detection (in the transaction): the first time the vote makes the event viable,
 *    `quorumReachedAt` is stamped. That alone stops voting reminders, independent of whether
 *    the manager could be reached.
 * 5. After the response (`after()`): dashboard sync, the "X updated availability" group post,
 *    and the manager's quorum DM. Slow or failing Telegram/Discord calls can no longer time
 *    out the vote and make the client retry. `quorumViableNotified`/`quorumPerfectNotified`
 *    are set only when the DM was delivered.
 *
 * @param {Request} req - JSON Payload: { name, telegramId, votes: [{ slotId, preference, canHost }], participantId?, linkTelegram?, linkDiscord? }
 *   `linkTelegram`/`linkDiscord` (each default true): when explicitly false, opts this
 *   vote out of that platform's identity linking — `linkTelegram=false` doesn't write the
 *   verified chatId, `linkDiscord=false` doesn't write discordId/discordUsername.
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
        // Display name only beside a verified id; the cookie is client-writable.
        const discordUsername = discordId ? readDiscordDisplayName(cookieStore) : null;

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

        // Signed cookie proving this browser created a participant row on this event.
        const cookieName = participantCookieName(targetEvent.slug);
        const cookiePurpose = participantPurpose(targetEvent.slug);
        const ownedParticipantId = verifyValue(cookiePurpose, cookieStore.get(cookieName)?.value);
        const ownsParticipant = (row: { id: number; chatId: string | null; discordId: string | null }) =>
            ownedParticipantId === String(row.id)
            || (identity.chatId !== null && row.chatId === identity.chatId)
            || (identity.discordId !== null && row.discordId === identity.discordId);
        // One instant for every ownership marker this request writes.
        const now = new Date();

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
                if (existing && isLegacyParticipant(existing)) {
                    // Created before participant cookies existed: the stored id is all this voter
                    // has. Claim the row for this browser; the response issues the cookie. The
                    // conditional where makes exactly one concurrent claimant win.
                    const claim = await tx.participant.updateMany({
                        where: { id: existing.id, ownerCookieIssuedAt: null },
                        data: { ownerCookieIssuedAt: now }
                    });
                    if (claim?.count !== 1 && !ownsParticipant(existing)) {
                        throw new ParticipantNotOwnedError();
                    }
                } else if (existing && !ownsParticipant(existing)) {
                    throw new ParticipantNotOwnedError();
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
                // Self-heal a missing chatId from the verified Telegram cookie only; never
                // overwrite one already set.
                const resolvedChatId = !existing.chatId && shouldLinkTelegram ? identity.chatId : null;

                participant = await tx.participant.update({
                    where: { id: existing.id },
                    data: {
                        name,
                        telegramId,
                        status: nextStatus,
                        // Opt-out (or no Discord session): leave discordId/discordUsername untouched.
                        // The display name never replaces one the row already has.
                        ...(shouldLinkDiscord && discordId ? { discordId } : {}),
                        ...(shouldLinkDiscord && discordId && discordUsername && !existing.discordUsername
                            ? { discordUsername }
                            : {}),
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
                participant = await tx.participant.create({
                    data: {
                        eventId,
                        name,
                        telegramId,
                        // Opt-out (or no Discord session): don't stamp Discord identity onto a fresh row.
                        ...(shouldLinkDiscord && discordId ? { discordId, ...(discordUsername ? { discordUsername } : {}) } : {}),
                        // Verified Telegram identity only (signed cookie), so cross-device profile sync finds the row.
                        chatId: shouldLinkTelegram ? identity.chatId : null,
                        status: nextStatus || 'PENDING',
                        // The response issues this row's participant cookie.
                        ownerCookieIssuedAt: now
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

            // 6. Quorum: record the first time it is reached, in the same transaction as the vote.
            const event = await tx.event.findUnique({
                where: { id: eventId },
                include: { timeSlots: { include: { votes: true } } }
            });
            let quorum = { viable: false, perfect: false };
            if (event && !(event.quorumReachedAt && event.quorumPerfectNotified && event.quorumViableNotified)) {
                const participantsCount = await tx.participant.count({ where: { eventId } });
                quorum = checkEventQuorum(event, participantsCount);
                if ((quorum.viable || quorum.perfect) && !event.quorumReachedAt) {
                    await tx.event.updateMany({
                        where: { id: eventId, quorumReachedAt: null },
                        data: { quorumReachedAt: new Date() }
                    });
                }
            }

            return { participant, event, quorum };
        });

        const { event, quorum } = result;

        // --- FINALIZED EVENT: WAITLIST AUTO-PROMOTION LOGIC ---
        if (event && event.status === 'FINALIZED' && event.maxPlayers) {
            await processWaitlistPromotion(event.id);
        }

        // --- FAN-OUT AFTER THE RESPONSE ---
        // Each step is isolated: one failing never skips the next.
        if (event) {
            const userDisplay = telegramId ? `@${telegramId.replace('@', '')}` : name;
            after(async () => {
                try {
                    const { syncDashboard } = await import("@/features/event-management/server/dashboard-sync");
                    await syncDashboard(eventId);
                } catch (e) {
                    log.error("Dashboard sync after vote failed", e as Error);
                }

                try {
                    await broadcastVoteUpdate(event, userDisplay);
                } catch (e) {
                    log.error("Vote broadcast failed", e as Error);
                }

                try {
                    await notifyManagerOfQuorum(event, quorum);
                } catch (e) {
                    log.error("Quorum DM failed", e as Error);
                }
            });
        }

        const participantRow = result.participant;
        log.info(`Vote processed successfully`, { participantId: participantRow.id, eventId });
        const response = NextResponse.json({ success: true, participantId: participantRow.id });
        // Proof of ownership for later edits from this browser (refreshed on every authorized vote).
        response.cookies.set(cookieName, signValue(cookiePurpose, String(participantRow.id)), identityCookieOptions());
        return response;
    } catch (error) {
        return toResponse(error, log.forRequest(req));
    }
}

interface VotedEvent {
    id: number;
    slug: string;
    title: string;
    telegramChatId: string | null;
    discordChannelId: string | null;
    managerChatId: string | null;
    managerDiscordId: string | null;
    quorumPerfectNotified: boolean;
    quorumViableNotified: boolean;
}

/** Posts "X updated their availability" to the event's linked group/channel. */
async function broadcastVoteUpdate(event: VotedEvent, userDisplay: string): Promise<void> {
    if (!event.telegramChatId && !event.discordChannelId) return;
    const { broadcastToEvent } = await import("@/features/notifications");
    await broadcastToEvent(
        { telegramChatId: event.telegramChatId, discordChannelId: event.discordChannelId },
        {
            html: `🚀 <b>${escapeHtml(userDisplay)}</b> just updated their availability for <b>${escapeHtml(event.title)}</b>!`,
            discord: `🚀 **${escapeDiscordMarkdown(userDisplay)}** updated availability for **${escapeDiscordMarkdown(event.title)}**!`,
        },
        { slug: event.slug, kind: "vote-update" }
    );
}

/**
 * DMs the manager the first time a quorum threshold is crossed. The notified flags are set
 * only once the DM landed on some platform; with no manager link or a failed send they stay
 * unset and a later vote retries. Voting reminders stop on `quorumReachedAt`, not on these.
 */
async function notifyManagerOfQuorum(event: VotedEvent, quorum: { viable: boolean; perfect: boolean }): Promise<void> {
    if (!event.managerChatId && !event.managerDiscordId) return;

    const { sendDirectMessage, isDelivered } = await import("@/features/notifications");
    const { getBaseUrl } = await import("@/shared/lib/url");
    const link = `${getBaseUrl()}/e/${event.slug}/manage`;
    const managerTarget = { telegramChatId: event.managerChatId, discordUserId: event.managerDiscordId };

    // 1. Perfect Match (Supersedes Viable)
    if (quorum.perfect) {
        if (event.quorumPerfectNotified) return;
        const result = await sendDirectMessage(
            managerTarget,
            { html: `🌟 <b>Perfect Match Found</b> for <b>${escapeHtml(event.title)}</b>!\n\nEveryone can make it and you have a host!\n\n👉 <a href="${link}">Finalize Now</a>` },
            { slug: event.slug, kind: "quorum-perfect" }
        );
        if (isDelivered(result)) {
            // Update both flags to prevent downgrading or double-pinging
            await prisma.event.update({
                where: { id: event.id },
                data: { quorumPerfectNotified: true, quorumViableNotified: true }
            });
            log.info("Notified Perfect Quorum", { slug: event.slug });
        }
        return;
    }

    // 2. Viable Match
    if (quorum.viable && !event.quorumViableNotified) {
        const result = await sendDirectMessage(
            managerTarget,
            { html: `🎉 <b>Viable Quorum Reached</b> for <b>${escapeHtml(event.title)}</b>!\n\nYou have enough players for a game.\n\n👉 <a href="${link}">Manage Event</a>` },
            { slug: event.slug, kind: "quorum-viable" }
        );
        if (isDelivered(result)) {
            await prisma.event.update({
                where: { id: event.id },
                data: { quorumViableNotified: true }
            });
            log.info("Notified Viable Quorum", { slug: event.slug });
        }
    }
}
