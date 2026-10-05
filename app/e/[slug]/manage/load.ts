import type { Prisma } from "@prisma/client";
import prisma from "@/shared/lib/prisma";
import { verifyEventAdmin } from "@/features/auth";
import { getBotUsername } from "@/features/telegram";
import { getServerConfig } from "@/shared/config/server";

/**
 * The fields the Management Dashboard reads. Deliberately excludes adminToken, the recovery
 * token and connect nonce, webhook fields and the pinned message ids, and trims every relation
 * to what the page and toManageParticipant use.
 */
export const manageEventSelect = {
    id: true,
    slug: true,
    title: true,
    description: true,
    location: true,
    status: true,
    eventType: true,
    minPlayers: true,
    maxPlayers: true,
    minSessions: true,
    finalizedSlotId: true,
    finalizedHostId: true,
    telegramLink: true,
    telegramChatId: true,
    managerTelegram: true,
    managerChatId: true,
    discordGuildId: true,
    discordChannelId: true,
    managerDiscordId: true,
    reminderEnabled: true,
    reminderTime: true,
    reminderDays: true,
    sessionReminderEnabled: true,
    sessionReminderLeadMinutes: true,
    timeSlots: {
        select: {
            id: true,
            startTime: true,
            endTime: true,
            votes: {
                select: {
                    preference: true,
                    canHost: true,
                    participant: { select: { id: true, name: true, status: true } },
                },
            },
        },
        orderBy: { startTime: 'asc' },
    },
    participants: {
        select: {
            id: true,
            name: true,
            status: true,
            telegramId: true,
            chatId: true,
            discordId: true,
            discordUsername: true,
        },
    },
    finalizedHost: { select: { id: true, name: true } },
    finalizedSessions: {
        select: { id: true, timeSlot: { select: { id: true, startTime: true, endTime: true } } },
        orderBy: { timeSlot: { startTime: 'asc' } },
    },
} satisfies Prisma.EventSelect;

export type ManageEventRow = Prisma.EventGetPayload<{ select: typeof manageEventSelect }>;

export type ManagePageData =
    | { isAdmin: false }
    | { isAdmin: true; event: ManageEventRow | null; botUsername: string };

/**
 * Runs the admin check, the event query and the bot-name lookup concurrently. The event is
 * discarded unless the caller is an admin, so a non-admin never receives event data.
 */
export async function loadManagePage(slug: string): Promise<ManagePageData> {
    const [isAdmin, event, botName] = await Promise.all([
        verifyEventAdmin(slug),
        prisma.event.findUnique({ where: { slug }, select: manageEventSelect }),
        getBotUsername(getServerConfig().telegram.token || ''),
    ]);
    if (!isAdmin) return { isAdmin: false };
    return { isAdmin: true, event, botUsername: botName || 'TabletopSchedulerBot' };
}
