import { NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import { redirect } from "next/navigation";
import Logger from "@/shared/lib/logger";
import { verifyEventAdmin } from "@/features/auth";
import { ConflictError, ForbiddenError, NotFoundError, toResponse } from "@/shared/errors";
import { campaignFinalizeSchema, oneShotFinalizeSchema } from "@/features/event-management/model/schemas";
import { escapeHtml } from "@/shared/lib/escape";

const log = Logger.get("API:Finalize");

const NOT_OPEN = "Event is not open for finalizing";

/** The one-shot modal posts FormData; campaign clients post JSON. Both become a plain object. */
async function readBody(req: Request): Promise<unknown> {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) return req.json();
    const form = await req.formData();
    return Object.fromEntries(form.entries());
}

/**
 * Throws `NotFoundError` unless `houseId` (when given) is a participant of this event.
 * `finalizedHostId` has a foreign key but no event scope, so the check lives here.
 */
async function assertHostInEvent(houseId: number | null, eventId: number): Promise<void> {
    if (houseId === null) return;
    const host = await prisma.participant.findFirst({ where: { id: houseId, eventId }, select: { id: true } });
    if (!host) throw new NotFoundError("Host not found");
}

/**
 * @function POST
 * @description Handles event finalization for both ONE_SHOT and CAMPAIGN events.
 *
 * ONE_SHOT: Accepts FormData with slotId/houseId/location. Redirects on success.
 * CAMPAIGN: Accepts JSON with slotIds[]/houseId/location. Returns JSON on success.
 *
 * Every slot, host and participant is resolved within this event (404 otherwise), and the
 * status flip is conditional on the event still being DRAFT (409 otherwise), so a request
 * can neither touch another event nor re-finalize (and re-notify) this one.
 */
export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
    const { slug } = await props.params;
    try {
        log.info("Request received", { slug });

        if (!(await verifyEventAdmin(slug))) {
            throw new ForbiddenError();
        }

        const currentEvent = await prisma.event.findUnique({
            where: { slug },
            select: { id: true, status: true, maxPlayers: true, minPlayers: true, title: true, eventType: true, minSessions: true, timezone: true }
        });

        if (!currentEvent) {
            throw new NotFoundError("Event not found");
        }

        if (currentEvent.eventType === 'CAMPAIGN') {
            return await handleCampaignFinalize(req, slug, currentEvent);
        }

        // ─── ONE-SHOT PATH ────────────────────────────────────────────────────────

        const input = oneShotFinalizeSchema.parse(await readBody(req));

        const slot = await prisma.timeSlot.findFirst({
            where: { id: input.slotId, eventId: currentEvent.id },
            select: { id: true }
        });
        if (!slot) {
            throw new NotFoundError("Slot not found");
        }
        await assertHostInEvent(input.houseId, currentEvent.id);

        const updateData: { status: string; finalizedSlotId: number; location: string | null; finalizedHostId?: number } = {
            status: "FINALIZED",
            finalizedSlotId: slot.id,
            location: input.location
        };

        if (input.houseId !== null) {
            updateData.finalizedHostId = input.houseId;
        }

        const votes = await prisma.vote.findMany({
            where: { timeSlotId: slot.id, preference: { in: ['YES', 'MAYBE'] }, participant: { eventId: currentEvent.id } },
            include: { participant: true }
        });

        const max = currentEvent.maxPlayers;
        const min = currentEvent.minPlayers || 0;

        let acceptedIds: number[] = [];
        let waitlistIds: number[] = [];
        let acceptedNames: string[] = [];
        let waitlistNames: string[] = [];

        const byTime = (a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime();
        const yesVotes = votes.filter(v => v.preference === 'YES').sort(byTime);
        const maybeVotes = votes.filter(v => v.preference === 'MAYBE').sort(byTime);

        const yesAccepted = max ? yesVotes.slice(0, max) : yesVotes;
        let currentCount = yesAccepted.length;
        let maybeAccepted: typeof votes = [];

        if (currentCount < min) {
            const needed = min - currentCount;
            maybeAccepted = maybeVotes.slice(0, needed);
            currentCount += maybeAccepted.length;
        }

        const allAccepted = [...yesAccepted, ...maybeAccepted];
        const yesWaitlist = max ? yesVotes.slice(max) : [];
        const maybeWaitlist = maybeVotes.slice(maybeAccepted.length);
        const allWaitlist = [...yesWaitlist, ...maybeWaitlist];
        allWaitlist.sort((a, b) => {
            if (a.preference !== b.preference) return a.preference === 'YES' ? -1 : 1;
            return a.createdAt.getTime() - b.createdAt.getTime();
        });

        acceptedIds = allAccepted.map(v => v.participantId);
        waitlistIds = allWaitlist.map(v => v.participantId);
        acceptedNames = allAccepted.map(v => v.participant.name);
        waitlistNames = allWaitlist.map(v => v.participant.name);

        const finalizedEvent = await prisma.$transaction(async (tx) => {
            // Precondition: only a DRAFT event can be finalized, exactly once.
            const claimed = await tx.event.updateMany({
                where: { id: currentEvent.id, status: 'DRAFT' },
                data: updateData
            });
            if (claimed.count !== 1) {
                throw new ConflictError(NOT_OPEN);
            }

            const updatedEvent = await tx.event.findUnique({
                where: { id: currentEvent.id },
                include: { timeSlots: true, finalizedHost: true }
            });
            if (!updatedEvent) {
                throw new NotFoundError("Event not found");
            }

            if (acceptedIds.length > 0) {
                await tx.participant.updateMany({
                    where: { id: { in: acceptedIds }, eventId: currentEvent.id },
                    data: { status: 'ACCEPTED' }
                });
            }
            if (waitlistIds.length > 0) {
                await tx.participant.updateMany({
                    where: { id: { in: waitlistIds }, eventId: currentEvent.id },
                    data: { status: 'WAITLIST' }
                });
            }

            const sTime = updatedEvent.timeSlots.find(s => s.id === updatedEvent.finalizedSlotId);

            // The webhook row is queued in the same transaction; /api/cron/webhooks delivers it.
            if (updatedEvent.fromUrl) {
                const { getBaseUrlOrNull } = await import("@/shared/lib/url");
                const origin = getBaseUrlOrNull();
                await tx.webhookEvent.create({
                    data: {
                        eventId: updatedEvent.id,
                        url: updatedEvent.fromUrl,
                        status: "PENDING",
                        nextAttempt: new Date(),
                        payload: JSON.stringify({
                            type: "FINALIZED",
                            eventType: "ONE_SHOT",
                            eventId: updatedEvent.id,
                            fromUrlId: updatedEvent.fromUrlId || null,
                            slug: updatedEvent.slug,
                            ...(origin ? { link: `${origin}/e/${updatedEvent.slug}` } : {}),
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
            }

            return updatedEvent;
        });

        const { getBaseUrlOrNull } = await import("@/shared/lib/url");
        const origin = getBaseUrlOrNull();
        const detailsLink = origin ? `\n<a href="${origin}/e/${slug}">View Details</a>` : "";

        // Intent: Announce to the group first so a slow run of DMs can never cost the announcement.
        const { buildFinalizedMessage } = await import("@/shared/lib/eventMessage");
        const slotTime = finalizedEvent.timeSlots.find((s: any) => s.id === slot.id)!;
        await announceFinalized(finalizedEvent, buildFinalizedMessage(finalizedEvent, slotTime, origin, acceptedNames, waitlistNames));

        const { sendDirectMessage } = await import("@/features/notifications");
        const acceptedParticipants = votes.filter(v => acceptedIds.includes(v.participantId));
        const waitlistedParticipants = votes.filter(v => waitlistIds.includes(v.participantId));
        await Promise.all([
            ...acceptedParticipants.map(p => sendDirectMessage(
                { telegramChatId: p.participant.chatId, discordUserId: p.participant.discordId },
                { html: `🎟️ <b>You made the cut!</b>\n\nYou are confirmed for <b>${escapeHtml(currentEvent.title)}</b>.${detailsLink}` },
                { slug, kind: "finalize-accepted" }
            )),
            ...waitlistedParticipants.map(p => sendDirectMessage(
                { telegramChatId: p.participant.chatId, discordUserId: p.participant.discordId },
                { html: `⚠️ <b>Event Full</b>\n\nYou are on the <b>Waitlist</b> for <b>${escapeHtml(currentEvent.title)}</b>.\nWe'll let you know if a spot opens up!` },
                { slug, kind: "finalize-waitlist" }
            )),
        ]);

        log.info("One-shot event finalized successfully", { slug });

    } catch (error) {
        return toResponse(error, log.forRequest(req));
    }

    redirect(`/e/${slug}/manage`);
}

// ─── CAMPAIGN FINALIZATION ─────────────────────────────────────────────────────

interface CampaignEventMeta {
    id: number;
    maxPlayers: number | null;
    minPlayers: number;
    title: string;
    eventType: string;
    minSessions: number | null;
    timezone: string;
}

async function handleCampaignFinalize(
    req: Request,
    slug: string,
    currentEvent: CampaignEventMeta
): Promise<NextResponse> {
    const { slotIds, houseId, location, participantIds } = campaignFinalizeSchema.parse(await req.json());

    // Every submitted slot must belong to this event.
    const validSlots = await prisma.timeSlot.findMany({
        where: { id: { in: slotIds }, eventId: currentEvent.id },
        orderBy: { startTime: 'asc' }
    });

    if (validSlots.length !== slotIds.length) {
        throw new NotFoundError("One or more slots not found");
    }
    await assertHostInEvent(houseId, currentEvent.id);

    // Fetch all votes across selected slots: needed for DM notifications regardless of selection path
    const allVotes = await prisma.vote.findMany({
        where: { timeSlotId: { in: slotIds }, preference: { in: ['YES', 'MAYBE'] }, participant: { eventId: currentEvent.id } },
        include: { participant: true }
    });

    // ── CAMPAIGN SELECTION ────────────────────────────────────────────────────────
    // If the UI passed an explicit participant list (DM selected the group + toggled extras),
    // use that directly. Otherwise fall back to the vote-based algorithm.
    let acceptedIds: number[];
    let waitlistIds: number[];
    let acceptedNames: string[];
    let waitlistNames: string[];

    if (participantIds && participantIds.length > 0) {
        // Explicit list from the UI: everyone on it is ACCEPTED, no waitlist
        const participants = await prisma.participant.findMany({
            where: { id: { in: participantIds }, eventId: currentEvent.id },
            select: { id: true, name: true }
        });
        acceptedIds = participants.map(p => p.id);
        acceptedNames = participants.map(p => p.name);
        waitlistIds = [];
        waitlistNames = [];
    } else {
        // Vote-based fallback: best preference across selected slots
        const participantBest = new Map<number, { preference: string; earliestTime: Date; participant: any }>();
        for (const vote of allVotes) {
            const existing = participantBest.get(vote.participantId);
            if (!existing) {
                participantBest.set(vote.participantId, { preference: vote.preference, earliestTime: vote.createdAt, participant: vote.participant });
            } else {
                if (vote.preference === 'YES' && existing.preference === 'MAYBE') {
                    existing.preference = 'YES';
                    existing.earliestTime = vote.createdAt;
                } else if (vote.createdAt < existing.earliestTime) {
                    existing.earliestTime = vote.createdAt;
                }
            }
        }

        const candidates = Array.from(participantBest.values());
        const max = currentEvent.maxPlayers;
        const min = currentEvent.minPlayers || 0;
        const byTime = (a: any, b: any) => a.earliestTime.getTime() - b.earliestTime.getTime();
        const yesCandidates = candidates.filter(v => v.preference === 'YES').sort(byTime);
        const maybeCandidates = candidates.filter(v => v.preference === 'MAYBE').sort(byTime);
        const yesAccepted = max ? yesCandidates.slice(0, max) : yesCandidates;
        const count = yesAccepted.length;
        let maybeAccepted: typeof candidates = [];
        if (count < min) { maybeAccepted = maybeCandidates.slice(0, min - count); }
        const allAccepted = [...yesAccepted, ...maybeAccepted];
        const allWaitlist = [...(max ? yesCandidates.slice(max) : []), ...maybeCandidates.slice(maybeAccepted.length)];
        allWaitlist.sort((a, b) => { if (a.preference !== b.preference) return a.preference === 'YES' ? -1 : 1; return a.earliestTime.getTime() - b.earliestTime.getTime(); });
        acceptedIds = allAccepted.map(v => v.participant.id);
        waitlistIds = allWaitlist.map(v => v.participant.id);
        acceptedNames = allAccepted.map(v => v.participant.name);
        waitlistNames = allWaitlist.map(v => v.participant.name);
    }

    // ── ATOMIC DB UPDATE ─────────────────────────────────────────────────────────
    const updateData: { status: string; location: string | null; finalizedHostId?: number } = { status: "FINALIZED", location };
    if (houseId !== null) updateData.finalizedHostId = houseId;

    const finalizedEvent = await prisma.$transaction(async (tx) => {
        // Precondition: only a DRAFT campaign can be finalized, exactly once.
        const claimed = await tx.event.updateMany({
            where: { id: currentEvent.id, status: 'DRAFT' },
            data: updateData
        });
        if (claimed.count !== 1) {
            throw new ConflictError(NOT_OPEN);
        }

        const updatedEvent = await tx.event.findUnique({
            where: { id: currentEvent.id },
            include: { timeSlots: true, finalizedHost: true }
        });
        if (!updatedEvent) {
            throw new NotFoundError("Event not found");
        }

        await tx.finalizedSession.createMany({
            data: validSlots.map(s => ({ eventId: updatedEvent.id, timeSlotId: s.id }))
        });

        // Reset everyone first so stale ACCEPTED statuses from prior runs don't linger
        await tx.participant.updateMany({ where: { eventId: updatedEvent.id }, data: { status: 'PENDING' } });

        if (acceptedIds.length > 0) {
            await tx.participant.updateMany({ where: { id: { in: acceptedIds }, eventId: updatedEvent.id }, data: { status: 'ACCEPTED' } });
        }
        if (waitlistIds.length > 0) {
            await tx.participant.updateMany({ where: { id: { in: waitlistIds }, eventId: updatedEvent.id }, data: { status: 'WAITLIST' } });
        }

        // The webhook row is queued in the same transaction; /api/cron/webhooks delivers it.
        if (updatedEvent.fromUrl) {
            const { getBaseUrlOrNull } = await import("@/shared/lib/url");
            const origin = getBaseUrlOrNull();
            await tx.webhookEvent.create({
                data: {
                    eventId: updatedEvent.id,
                    url: updatedEvent.fromUrl,
                    status: "PENDING",
                    nextAttempt: new Date(),
                    payload: JSON.stringify({
                        type: "FINALIZED",
                        eventType: "CAMPAIGN",
                        eventId: updatedEvent.id,
                        fromUrlId: updatedEvent.fromUrlId || null,
                        slug: updatedEvent.slug,
                        ...(origin ? { link: `${origin}/e/${updatedEvent.slug}` } : {}),
                        title: updatedEvent.title,
                        finalizedSessions: validSlots.map(s => ({
                            id: s.id,
                            startTime: s.startTime.toISOString(),
                            endTime: s.endTime.toISOString()
                        })),
                        attendees: acceptedNames,
                        waitlist: waitlistNames,
                        location: updatedEvent.location,
                        timestamp: new Date().toISOString()
                    })
                }
            });
        }

        return updatedEvent;
    });

    const { getBaseUrlOrNull } = await import("@/shared/lib/url");
    const origin = getBaseUrlOrNull();
    const detailsLink = origin ? `\n\n<a href="${origin}/e/${slug}">View Details</a>` : "";

    // ── GROUP CHANNEL NOTIFICATIONS ───────────────────────────────────────────────
    // Intent: Announce to the group first so a slow run of DMs can never cost the announcement.
    const { buildCampaignFinalizedMessage } = await import("@/shared/lib/eventMessage");
    await announceFinalized(finalizedEvent, buildCampaignFinalizedMessage(finalizedEvent, validSlots, origin, acceptedNames, waitlistNames));

    // ── DM NOTIFICATIONS ─────────────────────────────────────────────────────────
    const { sendDirectMessage } = await import("@/features/notifications");

    const sessionList = validSlots
        .map(s => `📅 ${s.startTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: currentEvent.timezone || 'UTC' })}`)
        .join('\n');

    // One DM per participant even when they voted on several sessions.
    const uniqueParticipants = (ids: number[]) => {
        const seen = new Set<number>();
        return allVotes.filter(v => {
            if (!ids.includes(v.participantId) || seen.has(v.participantId)) return false;
            seen.add(v.participantId);
            return true;
        });
    };

    await Promise.all([
        ...uniqueParticipants(acceptedIds).map(vote => sendDirectMessage(
            { telegramChatId: vote.participant.chatId, discordUserId: vote.participant.discordId },
            { html: `🎟️ <b>You're in the campaign!</b>\n\nYou are confirmed for <b>${escapeHtml(currentEvent.title)}</b>.\n\nSessions locked in:\n${sessionList}${detailsLink}` },
            { slug, kind: "finalize-campaign-accepted" }
        )),
        ...uniqueParticipants(waitlistIds).map(vote => sendDirectMessage(
            { telegramChatId: vote.participant.chatId, discordUserId: vote.participant.discordId },
            { html: `⚠️ <b>Campaign Waitlist</b>\n\nYou are on the <b>Waitlist</b> for <b>${escapeHtml(currentEvent.title)}</b>.\nYou may be called in as a substitute if a regular player can't make a session.` },
            { slug, kind: "finalize-campaign-waitlist" }
        )),
    ]);

    log.info("Campaign finalized successfully", { slug, sessionCount: slotIds.length });

    const warning = currentEvent.minSessions && slotIds.length < currentEvent.minSessions
        ? `Only ${slotIds.length} of ${currentEvent.minSessions} target sessions selected`
        : null;

    return NextResponse.json({ success: true, warning, sessionCount: slotIds.length });
}

// ─── GROUP ANNOUNCEMENT ────────────────────────────────────────────────────────

/**
 * Replaces the event's pinned status message on each linked platform with the finalized
 * announcement. Telegram and Discord are independent: each runs in its own try/catch so
 * a failure (or absence) on one never blocks the other.
 */
async function announceFinalized(
    event: { id: number; slug: string; telegramChatId: string | null; pinnedMessageId: number | null; discordChannelId: string | null; discordMessageId: string | null },
    htmlMsg: string
) {
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    if (event.telegramChatId && telegramToken) {
        try {
            const { sendTelegramMessage, deleteMessage, pinChatMessage } = await import("@/features/telegram");
            if (event.pinnedMessageId) {
                await deleteMessage(event.telegramChatId, event.pinnedMessageId, telegramToken);
            }
            const msgId = await sendTelegramMessage(event.telegramChatId, htmlMsg, telegramToken);
            if (msgId) {
                await pinChatMessage(event.telegramChatId, msgId, telegramToken);
                await prisma.event.update({ where: { id: event.id }, data: { pinnedMessageId: msgId } });
            }
        } catch (e) {
            log.warn("Telegram finalize announcement failed", { slug: event.slug, error: (e as Error)?.message });
        }
    }

    const discordToken = process.env.DISCORD_BOT_TOKEN;
    if (event.discordChannelId && discordToken) {
        try {
            const { sendDiscordMessage, pinDiscordMessage, unpinDiscordMessage, deleteDiscordMessage } = await import("@/features/integrations/discord/model/discord");
            const { htmlToDiscordMarkdown } = await import("@/shared/lib/discordMarkdown");

            if (event.discordMessageId) {
                await unpinDiscordMessage(event.discordChannelId, event.discordMessageId, discordToken);
                await deleteDiscordMessage(event.discordChannelId, event.discordMessageId, discordToken);
            }
            const res = await sendDiscordMessage(event.discordChannelId, htmlToDiscordMarkdown(htmlMsg), discordToken);
            if (res.id) {
                await pinDiscordMessage(event.discordChannelId, res.id, discordToken);
                await prisma.event.update({ where: { id: event.id }, data: { discordMessageId: res.id } });
            } else {
                log.warn("Failed to send Discord finalize message", { error: res.error });
            }
        } catch (e) {
            log.warn("Discord finalize announcement failed", { slug: event.slug, error: (e as Error)?.message });
        }
    }
}
