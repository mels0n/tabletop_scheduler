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

/** Runs a cleanup call whose failure must not stop the caller (e.g. unpinning a deleted message). */
async function bestEffort(fn: () => Promise<unknown>): Promise<void> {
    try {
        await fn();
    } catch (error) {
        log.debug("Best-effort dashboard cleanup failed", { error: String(error) });
    }
}

/**
 * Edits the Discord dashboard message in place. Reposts only when the edit reports the
 * message is definitively `gone` (or none is stored yet): a rate limit, 5xx or timeout
 * leaves the stored message alone, since the edit may have landed and a repost would
 * duplicate the dashboard and burn one of Discord's 50 pins. On repost the old message
 * is unpinned (best effort) before the new one is pinned and its id stored.
 */
export async function refreshDiscordDashboard(
    event: Pick<DashboardTargets, "discordChannelId" | "discordMessageId">,
    eventId: number,
    html: string
): Promise<void> {
    const token = process.env.DISCORD_BOT_TOKEN;
    const channelId = event.discordChannelId;
    const oldMessageId = event.discordMessageId;
    if (!channelId || !token) return;
    const { sendDiscordMessage, editDiscordMessage, pinDiscordMessage, unpinDiscordMessage } = await import("@/features/discord/model/discord");
    const content = htmlToDiscordMarkdown(html);

    if (oldMessageId) {
        const edit = await editDiscordMessage(channelId, oldMessageId, content, token);
        if (edit !== "gone") return;
    }

    const res = await sendDiscordMessage(channelId, content, token);
    if (res.id) {
        if (oldMessageId) {
            await bestEffort(() => unpinDiscordMessage(channelId, oldMessageId, token));
        }
        await pinDiscordMessage(channelId, res.id, token);
        await prisma.event.update({ where: { id: eventId }, data: { discordMessageId: res.id } });
    }
}

/**
 * Brings the Telegram pinned dashboard up to date. Edits in place; reposts only when the
 * edit reports the message is `gone` (or none is stored yet), never on a transient failure,
 * which would otherwise post a duplicate and re-trigger the "promote me to Admin" notice.
 * On repost the old message is unpinned (best effort) before the new one is pinned.
 */
export async function refreshTelegramDashboard(
    event: Pick<DashboardTargets, "telegramChatId" | "pinnedMessageId">,
    eventId: number,
    html: string
): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = event.telegramChatId;
    const oldMessageId = event.pinnedMessageId;
    if (!chatId || !token) return;
    const { sendTelegramMessage, editMessageText, pinChatMessage, unpinChatMessage } = await import("@/features/telegram");

    if (oldMessageId) {
        const edit = await editMessageText(chatId, oldMessageId, html, token);
        if (edit !== "gone") return;
    }

    const newMsgId = await sendTelegramMessage(chatId, html, token);
    if (newMsgId) {
        if (oldMessageId) {
            await bestEffort(() => unpinChatMessage(chatId, oldMessageId, token));
        }
        await pinChatMessage(chatId, newMsgId, token);
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
