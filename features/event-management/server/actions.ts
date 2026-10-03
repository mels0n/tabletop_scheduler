"use server";

import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { verifyEventAdmin } from "@/features/auth/server/actions";
import { normalizeHandle, formatHandle } from "@/shared/lib/handle";
import { escapeHtml, escapeDiscordMarkdown } from "@/shared/lib/escape";

const log = Logger.get("EventActions");

// Allowed session reminder lead times in minutes: 1 hour, 2 hours, 1 day, 2 days.
const SESSION_REMINDER_LEADS = [120, 1440, 2880];

/**
 * Checks the manager's connection status (Telegram linkage). Public callers get only the
 * boolean; the manager's handle is returned to the event admin alone.
 */
export async function checkManagerStatus(slug: string): Promise<{ hasManagerChatId: boolean; handle?: string | null }> {
    const event = await prisma.event.findUnique({
        where: { slug },
        select: { managerChatId: true, managerTelegram: true }
    });

    const status = { hasManagerChatId: !!event?.managerChatId };
    if (!event || !(await verifyEventAdmin(slug))) return status;
    return { ...status, handle: event.managerTelegram };
}

/**
 * Checks if the event is connected to a Telegram group chat.
 */
export async function checkEventStatus(slug: string) {
    const event = await prisma.event.findUnique({
        where: { slug },
        select: { telegramChatId: true }
    });

    return {
        hasTelegramChatId: !!event?.telegramChatId
    };
}

/**
 * Updates the manager's Telegram handle.
 */
export async function updateManagerHandle(slug: string, handle: string) {
    if (!(await verifyEventAdmin(slug))) return { error: "Unauthorized" };

    // Canonicalize: accept the handle with or without '@' and store it '@'-less
    // (lowercased), matching every other write path. Display code re-adds one '@'.
    const cleanHandle = normalizeHandle(handle);
    if (!cleanHandle || cleanHandle.length < 2) {
        return { error: "Handle must be at least 2 characters." };
    }

    try {
        await prisma.event.update({
            where: { slug },
            data: { managerTelegram: cleanHandle }
        });
        log.info("Manager handle updated", { slug, handle: cleanHandle });
        return { success: true, handle: formatHandle(cleanHandle) };
    } catch (e) {
        log.error("Failed to update handle", e as Error);
        return { error: "Failed to update handle." };
    }
}

/**
 * Updates the Telegram invite link associated with the event.
 */
export async function updateTelegramInviteLink(slug: string, link: string) {
    if (!(await verifyEventAdmin(slug))) return { error: "Unauthorized" };

    if (!link || !link.startsWith("https://t.me/")) {
        return { error: "Invalid Telegram link. It should start with https://t.me/" };
    }

    try {
        await prisma.event.update({
            where: { slug },
            data: { telegramLink: link }
        });
        log.info("Telegram invite link updated", { slug });
        return { success: true };
    } catch (e) {
        log.error("Failed to update telegram link", e as Error);
        return { error: "Failed to save link." };
    }
}

/**
 * Permanently deletes an event and all associated data.
 */
export async function deleteEvent(slug: string) {
    if (!(await verifyEventAdmin(slug))) return { error: "Unauthorized" };

    const event = await prisma.event.findUnique({
        where: { slug }
    });

    if (!event) {
        return { error: "Event not found" };
    }

    log.warn("Deleting event", { slug, title: event.title });

    // Unpin dashboards: each platform independently, failures never block deletion.
    try {
        if (event.telegramChatId && event.pinnedMessageId && process.env.TELEGRAM_BOT_TOKEN) {
            const { unpinChatMessage } = await import("@/features/telegram");
            await unpinChatMessage(event.telegramChatId, event.pinnedMessageId, process.env.TELEGRAM_BOT_TOKEN);
        }
    } catch (e) {
        log.warn("Failed to unpin Telegram dashboard on delete", { slug, error: String(e) });
    }
    try {
        if (event.discordChannelId && event.discordMessageId && process.env.DISCORD_BOT_TOKEN) {
            const { unpinDiscordMessage } = await import("@/features/discord/model/discord");
            await unpinDiscordMessage(event.discordChannelId, event.discordMessageId, process.env.DISCORD_BOT_TOKEN);
        }
    } catch (e) {
        log.warn("Failed to unpin Discord dashboard on delete", { slug, error: String(e) });
    }

    // One delete: the schema cascades to slots, participants, votes, finalized sessions
    // and queued webhooks. Announce only after it has committed.
    try {
        await prisma.event.delete({ where: { id: event.id } });
        log.info("Event deleted successfully", { slug });
    } catch (e) {
        log.error("Failed to delete event", e as Error);
        return { error: "Failed to delete event" };
    }

    const { broadcastToEvent } = await import("@/features/notifications");
    await broadcastToEvent(
        event,
        {
            html: `🚫 <b>Event Cancelled</b>\n\nThe event "${escapeHtml(event.title)}" has been removed by the organizer.`,
            discord: `🚫 **Event Deleted**\n\nThe event "**${escapeDiscordMarkdown(event.title)}**" has been removed by the organizer.`,
        },
        { slug, kind: "event-deleted" }
    );

    return { success: true };
}

/**
 * Marks an event as CANCELLED without deleting it.
 */
export async function cancelEvent(slug: string) {
    if (!(await verifyEventAdmin(slug))) return { error: "Unauthorized" };

    const event = await prisma.event.findUnique({
        where: { slug }
    });

    if (!event) {
        return { error: "Event not found" };
    }

    log.warn("Cancelling event", { slug, title: event.title });

    try {
        // Idempotent: only the call that flips the status edits dashboards or announces.
        const { count } = await prisma.event.updateMany({
            where: { id: event.id, status: { not: 'CANCELLED' } },
            data: { status: 'CANCELLED' }
        });
        if (count !== 1) {
            log.info("Event already cancelled", { slug });
            return { success: true };
        }

        const { getBaseUrl } = await import("@/shared/lib/url");
        const baseUrl = getBaseUrl();

        // Edit the pinned dashboards: each platform independently.
        try {
            if (event.telegramChatId && event.pinnedMessageId && process.env.TELEGRAM_BOT_TOKEN) {
                const { editMessageText } = await import("@/features/telegram");
                await editMessageText(
                    event.telegramChatId,
                    event.pinnedMessageId,
                    `🚫 <b>Event Cancelled</b> (was: ${event.finalizedSlotId ? 'Finalized' : 'Planned'})\n\n` +
                    `The event "<b>${escapeHtml(event.title)}</b>" has been cancelled by the host.\n\n` +
                    `<a href="${baseUrl}/e/${slug}">View Event Details</a>`,
                    process.env.TELEGRAM_BOT_TOKEN
                );
            }
        } catch (e) {
            log.warn("Failed to edit Telegram dashboard on cancel", { slug, error: String(e) });
        }

        try {
            if (event.discordChannelId && event.discordMessageId && process.env.DISCORD_BOT_TOKEN) {
                const { editDiscordMessage } = await import("@/features/discord/model/discord");
                await editDiscordMessage(
                    event.discordChannelId,
                    event.discordMessageId,
                    `🚫 **Event Cancelled** (was: ${event.finalizedSlotId ? 'Finalized' : 'Planned'})\n\nThe event "**${escapeDiscordMarkdown(event.title)}**" has been cancelled by the host.\n\n[View Event Details](<${baseUrl}/e/${slug}>)`,
                    process.env.DISCORD_BOT_TOKEN
                );
            }
        } catch (e) {
            log.warn("Failed to edit Discord dashboard on cancel", { slug, error: String(e) });
        }

        const { broadcastToEvent } = await import("@/features/notifications");
        await broadcastToEvent(
            event,
            {
                html: `🚫 <b>Event Cancelled</b>\n\nThe event "${escapeHtml(event.title)}" has been cancelled by the organizer.`,
                discord: `🚫 **Event Cancelled**\n\nThe event "**${escapeDiscordMarkdown(event.title)}**" has been cancelled by the organizer.`,
            },
            { slug, kind: "event-cancelled" }
        );

        if (event.fromUrl) {
            log.info("Queueing cancellation webhook", { slug, fromUrl: event.fromUrl });
            const payload = {
                type: "CANCELLED",
                eventId: event.id,
                fromUrlId: event.fromUrlId,
                slug: event.slug,
                title: event.title,
                timestamp: new Date().toISOString()
            };
            await prisma.webhookEvent.create({
                data: {
                    eventId: event.id,
                    url: event.fromUrl,
                    payload: JSON.stringify(payload),
                    status: "PENDING",
                    nextAttempt: new Date()
                }
            });
        }

        log.info("Event cancelled successfully", { slug });
        return { success: true };
    } catch (e) {
        log.error("Failed to cancel event", e as Error);
        return { error: "Failed to cancel event" };
    }
}

/**
 * Updates the automated reminder settings for an event.
 *
 * @param {string} slug - The event slug.
 * @param {boolean} enabled - Whether reminders are active.
 * @param {string} time - The time of day for reminders (HH:MM).
 * @param {number[]} days - Array of days (offsets) before the event to send reminders.
 * @returns {Promise<Object>} Success status or error.
 */
export async function updateReminderSettings(slug: string, enabled: boolean, time: string, days: number[]) {
    try {
        if (!(await verifyEventAdmin(slug))) return { success: false, error: "Unauthorized" };

        const event = await prisma.event.findUnique({ where: { slug } });
        if (!event) return { success: false, error: "Event not found" };

        // Intent: Validate time format to ensure cron compatibility
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (enabled && !timeRegex.test(time)) return { success: false, error: "Invalid time format" };

        await prisma.event.update({
            where: { id: event.id },
            data: {
                reminderEnabled: enabled,
                reminderTime: time,
                reminderDays: days.join(','),
                // Intent: Do NOT reset notification flags here. Changing schedule shouldn't spam users if quorum was already reached.
            }
        });

        // Trigger revalidation if needed
        return { success: true };
    } catch (e) {
        log.error("Failed to update reminder settings", e as Error);
        return { success: false, error: "Internal Error" };
    }
}

/**
 * Updates the session reminder settings (a one-time post before each scheduled session).
 *
 * @param {string} slug - The event slug.
 * @param {boolean} enabled - Whether session reminders are active.
 * @param {number} leadMinutes - Minutes before session start (120, 1440 or 2880).
 * @returns {Promise<Object>} Success status or error.
 */
export async function updateSessionReminderSettings(slug: string, enabled: boolean, leadMinutes: number) {
    try {
        if (!(await verifyEventAdmin(slug))) return { success: false, error: "Unauthorized" };

        if (typeof enabled !== "boolean" || !SESSION_REMINDER_LEADS.includes(leadMinutes)) {
            return { success: false, error: "Invalid lead time" };
        }

        const event = await prisma.event.findUnique({ where: { slug } });
        if (!event) return { success: false, error: "Event not found" };

        await prisma.event.update({
            where: { id: event.id },
            data: {
                sessionReminderEnabled: enabled,
                sessionReminderLeadMinutes: leadMinutes,
            }
        });

        return { success: true };
    } catch (e) {
        log.error("Failed to update session reminder settings", e as Error);
        return { success: false, error: "Internal Error" };
    }
}
