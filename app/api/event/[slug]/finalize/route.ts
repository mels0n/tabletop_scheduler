import { NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import { redirect } from "next/navigation";
import Logger from "@/shared/lib/logger";
import { verifyEventAdmin } from "@/features/auth/server/actions";

const log = Logger.get("API:Finalize");

/**
 * @function POST
 * @description Handles event finalization for both ONE_SHOT and CAMPAIGN events.
 *
 * ONE_SHOT: Accepts FormData with slotId/houseId/location. Redirects on success.
 * CAMPAIGN: Accepts JSON with slotIds[]/houseId/location. Returns JSON on success.
 */
export async function POST(
    req: Request,
    { params }: { params: { slug: string } }
) {
    try {
        log.info("Request received", { slug: params.slug });

        if (!await verifyEventAdmin(params.slug)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const currentEvent = await prisma.event.findUnique({
            where: { slug: params.slug },
            select: { id: true, maxPlayers: true, minPlayers: true, title: true, eventType: true, minSessions: true }
        });

        if (!currentEvent) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        if (currentEvent.eventType === 'CAMPAIGN') {
            return await handleCampaignFinalize(req, params.slug, currentEvent);
        }

        // ─── ONE-SHOT PATH (original logic, unchanged) ────────────────────────────

        const formData = await req.formData();
        const slotId = formData.get("slotId");
        const hostId = formData.get("houseId");
        const location = formData.get("location");

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

        const sId = parseInt(slotId.toString());

        const votes = await prisma.vote.findMany({
            where: { timeSlotId: sId, preference: { in: ['YES', 'MAYBE'] } },
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

        const transactionResult = await prisma.$transaction(async (tx) => {
            const updatedEvent = await tx.event.update({
                where: { slug: params.slug },
                data: updateData,
                include: { timeSlots: true, finalizedHost: true }
            });

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

            const sTime = updatedEvent.timeSlots.find(s => s.id === updatedEvent.finalizedSlotId);

            let webhookId: string | null = null;
            if (updatedEvent.fromUrl) {
                const { getBaseUrl } = await import("@/shared/lib/url");
                const origin = getBaseUrl(req.headers);
                const wh = await tx.webhookEvent.create({
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

        if (webhookId) {
            const { processWebhook } = await import("@/shared/lib/webhook-sender");
            await processWebhook(webhookId);
        }

        const { getBaseUrl } = await import("@/shared/lib/url");
        const origin = getBaseUrl(req.headers);
        const eventLink = `${origin}/e/${params.slug}`;

        if (process.env.TELEGRAM_BOT_TOKEN) {
            const { sendTelegramMessage } = await import("@/features/telegram");
            const acceptedParticipants = votes.filter(v => acceptedIds.includes(v.participantId));
            for (const p of acceptedParticipants) {
                if (p.participant.chatId) {
                    await sendTelegramMessage(
                        p.participant.chatId,
                        `🎟️ <b>You made the cut!</b>\n\nYou are confirmed for <b>${currentEvent.title}</b>.\n<a href="${eventLink}">View Details</a>`,
                        process.env.TELEGRAM_BOT_TOKEN
                    );
                }
            }
            const waitlistedParticipants = votes.filter(v => waitlistIds.includes(v.participantId));
            for (const p of waitlistedParticipants) {
                if (p.participant.chatId) {
                    await sendTelegramMessage(
                        p.participant.chatId,
                        `⚠️ <b>Event Full</b>\n\nYou are on the <b>Waitlist</b> for <b>${currentEvent.title}</b>.\nWe'll let you know if a spot opens up!`,
                        process.env.TELEGRAM_BOT_TOKEN
                    );
                }
            }
        }

        if (finalizedEvent.telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
            const { sendTelegramMessage, deleteMessage, pinChatMessage } = await import("@/features/telegram");
            const { buildFinalizedMessage } = await import("@/shared/lib/eventMessage");
            const slotTime = finalizedEvent.timeSlots.find((s: any) => s.id === parseInt(slotId.toString()))!;

            if (finalizedEvent.pinnedMessageId) {
                await deleteMessage(finalizedEvent.telegramChatId, finalizedEvent.pinnedMessageId, process.env.TELEGRAM_BOT_TOKEN);
            }
            const msg = buildFinalizedMessage(finalizedEvent, slotTime, origin, acceptedNames, waitlistNames);
            const msgId = await sendTelegramMessage(finalizedEvent.telegramChatId, msg, process.env.TELEGRAM_BOT_TOKEN);
            if (msgId) {
                await pinChatMessage(finalizedEvent.telegramChatId, msgId, process.env.TELEGRAM_BOT_TOKEN);
                await prisma.event.update({ where: { id: finalizedEvent.id }, data: { pinnedMessageId: msgId } });
            }
        }

        if (finalizedEvent.discordChannelId && process.env.DISCORD_BOT_TOKEN) {
            const { sendDiscordMessage, pinDiscordMessage, unpinDiscordMessage } = await import("@/features/discord/model/discord");
            const { buildFinalizedMessage } = await import("@/shared/lib/eventMessage");
            const slotTime = finalizedEvent.timeSlots.find((s: any) => s.id === parseInt(slotId.toString()))!;

            if (finalizedEvent.discordMessageId) {
                await unpinDiscordMessage(finalizedEvent.discordChannelId, finalizedEvent.discordMessageId, process.env.DISCORD_BOT_TOKEN);
            }
            const htmlMsg = buildFinalizedMessage(finalizedEvent, slotTime, origin, acceptedNames, waitlistNames);
            const discordMsg = htmlMsg
                .replace(/<b>(.*?)<\/b>/g, '**$1**')
                .replace(/<a href="(.*?)">(.*?)<\/a>/g, '[$2]($1)')
                .replace(/ \| /g, ' • ')
                .replace(/<br\s*\/?>/g, '\n')
                .replace(/&nbsp;/g, ' ');

            const res = await sendDiscordMessage(finalizedEvent.discordChannelId, discordMsg, process.env.DISCORD_BOT_TOKEN);
            const msgId = res.id;
            if (msgId) {
                await pinDiscordMessage(finalizedEvent.discordChannelId, msgId, process.env.DISCORD_BOT_TOKEN);
                await prisma.event.update({ where: { id: finalizedEvent.id }, data: { discordMessageId: msgId } });
            } else {
                log.warn("Failed to send Discord finalize message", { error: res.error });
            }
        }

        log.info("One-shot event finalized successfully", { slug: params.slug });

    } catch (error) {
        log.error("Finalize failed", error as Error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }

    redirect(`/e/${params.slug}/manage`);
}

// ─── CAMPAIGN FINALIZATION ─────────────────────────────────────────────────────

interface CampaignEventMeta {
    id: number;
    maxPlayers: number | null;
    minPlayers: number;
    title: string;
    eventType: string;
    minSessions: number | null;
}

async function handleCampaignFinalize(
    req: Request,
    slug: string,
    currentEvent: CampaignEventMeta
): Promise<NextResponse> {
    let body: { slotIds: number[]; houseId?: string; location?: string; participantIds?: number[] };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { slotIds, houseId, location, participantIds } = body;

    if (!slotIds || !Array.isArray(slotIds) || slotIds.length === 0) {
        return NextResponse.json({ error: "slotIds must be a non-empty array" }, { status: 400 });
    }

    // Validate all submitted slots belong to this event
    const validSlots = await prisma.timeSlot.findMany({
        where: { id: { in: slotIds }, event: { slug } },
        orderBy: { startTime: 'asc' }
    });

    if (validSlots.length !== slotIds.length) {
        return NextResponse.json({ error: "One or more slot IDs are invalid for this event" }, { status: 400 });
    }

    // Fetch all votes across selected slots — needed for DM notifications regardless of selection path
    const allVotes = await prisma.vote.findMany({
        where: { timeSlotId: { in: slotIds }, preference: { in: ['YES', 'MAYBE'] } },
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
        // Explicit list from the UI — everyone on it is ACCEPTED, no waitlist
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
        let count = yesAccepted.length;
        let maybeAccepted: typeof candidates = [];
        if (count < min) { maybeAccepted = maybeCandidates.slice(0, min - count); count += maybeAccepted.length; }
        const allAccepted = [...yesAccepted, ...maybeAccepted];
        const allWaitlist = [...(max ? yesCandidates.slice(max) : []), ...maybeCandidates.slice(maybeAccepted.length)];
        allWaitlist.sort((a, b) => { if (a.preference !== b.preference) return a.preference === 'YES' ? -1 : 1; return a.earliestTime.getTime() - b.earliestTime.getTime(); });
        acceptedIds = allAccepted.map(v => v.participant.id);
        waitlistIds = allWaitlist.map(v => v.participant.id);
        acceptedNames = allAccepted.map(v => v.participant.name);
        waitlistNames = allWaitlist.map(v => v.participant.name);
    }

    // ── ATOMIC DB UPDATE ─────────────────────────────────────────────────────────
    const updateData: any = { status: "FINALIZED", location: location || null };
    if (houseId) updateData.finalizedHostId = parseInt(houseId);

    const transactionResult = await prisma.$transaction(async (tx) => {
        const updatedEvent = await tx.event.update({
            where: { slug },
            data: updateData,
            include: { timeSlots: true, finalizedHost: true }
        });

        await tx.finalizedSession.createMany({
            data: slotIds.map(slotId => ({ eventId: updatedEvent.id, timeSlotId: slotId }))
        });

        // Reset everyone first so stale ACCEPTED statuses from prior runs don't linger
        await tx.participant.updateMany({ where: { eventId: updatedEvent.id }, data: { status: 'PENDING' } });

        if (acceptedIds.length > 0) {
            await tx.participant.updateMany({ where: { id: { in: acceptedIds } }, data: { status: 'ACCEPTED' } });
        }
        if (waitlistIds.length > 0) {
            await tx.participant.updateMany({ where: { id: { in: waitlistIds } }, data: { status: 'WAITLIST' } });
        }

        let webhookId: string | null = null;
        if (updatedEvent.fromUrl) {
            const { getBaseUrl } = await import("@/shared/lib/url");
            const origin = getBaseUrl(req.headers as any);
            const wh = await tx.webhookEvent.create({
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
                        link: `${origin}/e/${updatedEvent.slug}`,
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
            webhookId = wh.id;
        }

        return { event: updatedEvent, webhookId };
    });

    const { event: finalizedEvent, webhookId } = transactionResult;

    if (webhookId) {
        const { processWebhook } = await import("@/shared/lib/webhook-sender");
        await processWebhook(webhookId);
    }

    const { getBaseUrl } = await import("@/shared/lib/url");
    const origin = getBaseUrl(req.headers as any);
    const eventLink = `${origin}/e/${slug}`;

    // ── DM NOTIFICATIONS ─────────────────────────────────────────────────────────
    if (process.env.TELEGRAM_BOT_TOKEN) {
        const { sendTelegramMessage } = await import("@/features/telegram");

        const sessionList = validSlots
            .map(s => `📅 ${s.startTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`)
            .join('\n');

        const notifiedAccepted = new Set<number>();
        for (const vote of allVotes.filter(v => acceptedIds.includes(v.participantId))) {
            if (!notifiedAccepted.has(vote.participantId) && vote.participant.chatId) {
                notifiedAccepted.add(vote.participantId);
                await sendTelegramMessage(
                    vote.participant.chatId,
                    `🎟️ <b>You're in the campaign!</b>\n\nYou are confirmed for <b>${currentEvent.title}</b>.\n\nSessions locked in:\n${sessionList}\n\n<a href="${eventLink}">View Details</a>`,
                    process.env.TELEGRAM_BOT_TOKEN
                );
            }
        }

        const notifiedWaitlist = new Set<number>();
        for (const vote of allVotes.filter(v => waitlistIds.includes(v.participantId))) {
            if (!notifiedWaitlist.has(vote.participantId) && vote.participant.chatId) {
                notifiedWaitlist.add(vote.participantId);
                await sendTelegramMessage(
                    vote.participant.chatId,
                    `⚠️ <b>Campaign Waitlist</b>\n\nYou are on the <b>Waitlist</b> for <b>${currentEvent.title}</b>.\nYou may be called in as a substitute if a regular player can't make a session.`,
                    process.env.TELEGRAM_BOT_TOKEN
                );
            }
        }
    }

    // ── GROUP CHANNEL NOTIFICATIONS ───────────────────────────────────────────────
    if (finalizedEvent.telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
        const { sendTelegramMessage, deleteMessage, pinChatMessage } = await import("@/features/telegram");
        const { buildCampaignFinalizedMessage } = await import("@/shared/lib/eventMessage");

        if (finalizedEvent.pinnedMessageId) {
            await deleteMessage(finalizedEvent.telegramChatId, finalizedEvent.pinnedMessageId, process.env.TELEGRAM_BOT_TOKEN);
        }
        const msg = buildCampaignFinalizedMessage(finalizedEvent, validSlots, origin, acceptedNames, waitlistNames);
        const msgId = await sendTelegramMessage(finalizedEvent.telegramChatId, msg, process.env.TELEGRAM_BOT_TOKEN);
        if (msgId) {
            await pinChatMessage(finalizedEvent.telegramChatId, msgId, process.env.TELEGRAM_BOT_TOKEN);
            await prisma.event.update({ where: { id: finalizedEvent.id }, data: { pinnedMessageId: msgId } });
        }
    }

    if (finalizedEvent.discordChannelId && process.env.DISCORD_BOT_TOKEN) {
        const { sendDiscordMessage, pinDiscordMessage, unpinDiscordMessage } = await import("@/features/discord/model/discord");
        const { buildCampaignFinalizedMessage } = await import("@/shared/lib/eventMessage");

        if (finalizedEvent.discordMessageId) {
            await unpinDiscordMessage(finalizedEvent.discordChannelId, finalizedEvent.discordMessageId, process.env.DISCORD_BOT_TOKEN);
        }
        const htmlMsg = buildCampaignFinalizedMessage(finalizedEvent, validSlots, origin, acceptedNames, waitlistNames);
        const discordMsg = htmlMsg
            .replace(/<b>(.*?)<\/b>/g, '**$1**')
            .replace(/<a href="(.*?)">(.*?)<\/a>/g, '[$2]($1)')
            .replace(/ \| /g, ' • ')
            .replace(/<br\s*\/?>/g, '\n')
            .replace(/&nbsp;/g, ' ');

        const res = await sendDiscordMessage(finalizedEvent.discordChannelId, discordMsg, process.env.DISCORD_BOT_TOKEN);
        if (res.id) {
            await pinDiscordMessage(finalizedEvent.discordChannelId, res.id, process.env.DISCORD_BOT_TOKEN);
            await prisma.event.update({ where: { id: finalizedEvent.id }, data: { discordMessageId: res.id } });
        } else {
            log.warn("Failed to send Discord campaign finalize message", { error: res.error });
        }
    }

    log.info("Campaign finalized successfully", { slug, sessionCount: slotIds.length });

    const warning = currentEvent.minSessions && slotIds.length < currentEvent.minSessions
        ? `Only ${slotIds.length} of ${currentEvent.minSessions} target sessions selected`
        : null;

    return NextResponse.json({ success: true, warning, sessionCount: slotIds.length });
}
