import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { broadcastToEvent } from "@/features/notifications";
import { htmlToDiscordMarkdown } from "@/shared/lib/discordMarkdown";

const log = Logger.get("API:Slot:Notify");

interface DashboardTargets {
    telegramChatId: string | null;
    pinnedMessageId: number | null;
    discordChannelId: string | null;
    discordMessageId: string | null;
}

/**
 * Edits the Discord dashboard message in place. If the edit fails (message deleted,
 * bot lost access) or none is stored yet, posts a fresh one, pins it and stores its id.
 * A successful edit never posts a duplicate.
 */
export async function refreshDiscordDashboard(
    event: Pick<DashboardTargets, "discordChannelId" | "discordMessageId">,
    eventId: number,
    html: string
): Promise<void> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!event.discordChannelId || !token) return;
    const { sendDiscordMessage, editDiscordMessage, pinDiscordMessage } = await import("@/features/discord/model/discord");
    const content = htmlToDiscordMarkdown(html);

    if (event.discordMessageId && (await editDiscordMessage(event.discordChannelId, event.discordMessageId, content, token))) {
        return;
    }

    const res = await sendDiscordMessage(event.discordChannelId, content, token);
    if (res.id) {
        await pinDiscordMessage(event.discordChannelId, res.id, token);
        await prisma.event.update({ where: { id: eventId }, data: { discordMessageId: res.id } });
    }
}

/**
 * Brings the Telegram pinned dashboard up to date. Edits in place when possible; if the
 * edit fails (message deleted, bot lost access) or none is stored yet, posts a fresh one,
 * pins it and stores its id. A successful edit never posts a duplicate.
 */
export async function refreshTelegramDashboard(
    event: Pick<DashboardTargets, "telegramChatId" | "pinnedMessageId">,
    eventId: number,
    html: string
): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!event.telegramChatId || !token) return;
    const { sendTelegramMessage, editMessageText, pinChatMessage } = await import("@/features/telegram");

    if (event.pinnedMessageId && (await editMessageText(event.telegramChatId, event.pinnedMessageId, html, token))) {
        return;
    }

    const newMsgId = await sendTelegramMessage(event.telegramChatId, html, token);
    if (newMsgId) {
        await pinChatMessage(event.telegramChatId, newMsgId, token);
        await prisma.event.update({ where: { id: eventId }, data: { pinnedMessageId: newMsgId } });
    }
}

/** Updates the pinned dashboard on each platform; one platform's failure never skips the other. */
async function refreshDashboards(event: DashboardTargets, eventId: number, statusMsg: string): Promise<void> {
    try {
        await refreshTelegramDashboard(event, eventId, statusMsg);
    } catch (error) {
        log.error("Telegram dashboard update failed", error as Error);
    }

    try {
        await refreshDiscordDashboard(event, eventId, statusMsg);
    } catch (error) {
        log.error("Discord dashboard update failed", error as Error);
    }
}

export async function pushSlotUpdates(eventId: number, messageSnippet: string) {
    try {
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: {
                timeSlots: { include: { votes: true } },
                finalizedHost: true
            }
        });

        if (!event) return;

        const participantsCount = await prisma.participant.count({ where: { eventId } });

        const { getBaseUrl } = await import("@/shared/lib/url");
        const baseUrl = getBaseUrl();

        let statusMsg = "";

        if (event.status === "FINALIZED" && event.finalizedSlotId) {
            const { buildFinalizedMessage } = await import("@/shared/lib/eventMessage");
            const slotTime = event.timeSlots.find(s => s.id === event.finalizedSlotId);

            if (slotTime) {
                const acceptedParticipants = await prisma.participant.findMany({
                    where: { eventId, status: 'ACCEPTED' },
                    orderBy: { createdAt: 'asc' },
                    select: { name: true }
                });
                const waitlistParticipants = await prisma.participant.findMany({
                    where: { eventId, status: 'WAITLIST' },
                    orderBy: { createdAt: 'asc' },
                    select: { name: true }
                });
                statusMsg = buildFinalizedMessage(
                    event as any,
                    slotTime as any,
                    baseUrl,
                    acceptedParticipants.map(p => p.name),
                    waitlistParticipants.map(p => p.name)
                );
            } else {
                const { generateStatusMessage } = await import("@/shared/lib/status");
                statusMsg = generateStatusMessage(event, participantsCount, baseUrl);
            }
        } else {
            const { generateStatusMessage } = await import("@/shared/lib/status");
            statusMsg = generateStatusMessage(event, participantsCount, baseUrl);
        }

        // Announcement goes to each linked platform independently.
        await broadcastToEvent(
            event,
            { html: `📅 <b>Time Options Updated!</b>

${messageSnippet} for <b>${event.title}</b>.` },
            { eventId, kind: "slot-update" }
        );

        await refreshDashboards(event, eventId, statusMsg);
    } catch (error) {
        log.error("Failed to push slot updates", error as Error);
    }
}

export async function syncDashboard(eventId: number) {
    try {
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: {
                timeSlots: { include: { votes: true } },
                finalizedHost: true
            }
        });

        if (!event) return;

        const participantsCount = await prisma.participant.count({ where: { eventId } });

        const { getBaseUrl } = await import("@/shared/lib/url");
        const baseUrl = getBaseUrl();

        let statusMsg = "";

        if (event.status === "FINALIZED" && event.finalizedSlotId) {
            const { buildFinalizedMessage } = await import("@/shared/lib/eventMessage");
            const slotTime = event.timeSlots.find(s => s.id === event.finalizedSlotId);

            if (slotTime) {
                const acceptedParticipants = await prisma.participant.findMany({
                    where: { eventId, status: 'ACCEPTED' },
                    orderBy: { createdAt: 'asc' },
                    select: { name: true }
                });
                const waitlistParticipants = await prisma.participant.findMany({
                    where: { eventId, status: 'WAITLIST' },
                    orderBy: { createdAt: 'asc' },
                    select: { name: true }
                });
                statusMsg = buildFinalizedMessage(
                    event as any,
                    slotTime as any,
                    baseUrl,
                    acceptedParticipants.map(p => p.name),
                    waitlistParticipants.map(p => p.name)
                );
            } else {
                const { generateStatusMessage } = await import("@/shared/lib/status");
                statusMsg = generateStatusMessage(event, participantsCount, baseUrl);
            }
        } else {
            const { generateStatusMessage } = await import("@/shared/lib/status");
            statusMsg = generateStatusMessage(event, participantsCount, baseUrl);
        }

        await refreshDashboards(event, eventId, statusMsg);
    } catch (error) {
        log.error("Failed to sync dashboard", error as Error);
    }
}
