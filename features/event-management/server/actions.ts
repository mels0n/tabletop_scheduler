"use server";

import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { verifyEventAdmin } from "@/features/auth/server/actions";

const log = Logger.get("EventActions");

/**
 * Checks the manager's connection status (Telegram linkage).
 */
export async function checkManagerStatus(slug: string) {
    const event = await prisma.event.findUnique({
        where: { slug },
        select: { managerChatId: true, managerTelegram: true }
    });

    return {
        hasManagerChatId: !!event?.managerChatId,
        handle: event?.managerTelegram
    };
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
    if (!await verifyEventAdmin(slug)) return { error: "Unauthorized" };

    if (!handle || handle.trim().length < 2) {
        return { error: "Handle must be at least 2 characters." };
    }

    const formattedHandle = handle.startsWith("@") ? handle : `@${handle}`;

    try {
        await prisma.event.update({
            where: { slug },
            data: { managerTelegram: formattedHandle }
        });
        log.info("Manager handle updated", { slug, handle: formattedHandle });
        return { success: true, handle: formattedHandle };
    } catch (e) {
        log.error("Failed to update handle", e as Error);
        return { error: "Failed to update handle." };
    }
}

/**
 * Updates the Telegram invite link associated with the event.
 */
export async function updateTelegramInviteLink(slug: string, link: string) {
    if (!await verifyEventAdmin(slug)) return { error: "Unauthorized" };

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
    if (!await verifyEventAdmin(slug)) return { error: "Unauthorized" };

    const event = await prisma.event.findUnique({
        where: { slug }
    });

    if (!event) {
        return { error: "Event not found" };
    }

    log.warn("Deleting event", { slug, title: event.title });

    if (process.env.TELEGRAM_BOT_TOKEN) {
        const { sendTelegramMessage, unpinChatMessage } = await import("@/features/telegram");

        if (event.telegramChatId) {
            if (event.pinnedMessageId) {
                await unpinChatMessage(event.telegramChatId, event.pinnedMessageId, process.env.TELEGRAM_BOT_TOKEN);
            }
            await sendTelegramMessage(
                event.telegramChatId,
                `🚫 <b>Event Cancelled</b>\n\nThe event "${event.title}" has been removed by the organizer.`,
                process.env.TELEGRAM_BOT_TOKEN
            );
        }
    }

    if (process.env.DISCORD_BOT_TOKEN && event.discordChannelId) {
        const { sendDiscordMessage, unpinDiscordMessage } = await import("@/features/discord/model/discord");

        if (event.discordMessageId) {
            await unpinDiscordMessage(event.discordChannelId, event.discordMessageId, process.env.DISCORD_BOT_TOKEN);
        }

        await sendDiscordMessage(
            event.discordChannelId,
            `🚫 **Event Deleted**\n\nThe event "**${event.title}**" has been removed by the organizer.`,
            process.env.DISCORD_BOT_TOKEN
        );
    }

    try {
        await prisma.$transaction(async (tx) => {
            await tx.vote.deleteMany({ where: { timeSlot: { eventId: event.id } } });
            await tx.timeSlot.deleteMany({ where: { eventId: event.id } });
            await tx.participant.deleteMany({ where: { eventId: event.id } });
            await tx.event.delete({ where: { id: event.id } });
        });

        log.info("Event deleted successfully", { slug });
        return { success: true };
    } catch (e) {
        log.error("Failed to delete event", e as Error);
        return { error: "Failed to delete event" };
    }
}

/**
 * Marks an event as CANCELLED without deleting it.
 */
export async function cancelEvent(slug: string) {
    if (!await verifyEventAdmin(slug)) return { error: "Unauthorized" };

    const event = await prisma.event.findUnique({
        where: { slug }
    });

    if (!event) {
        return { error: "Event not found" };
    }

    log.warn("Cancelling event", { slug, title: event.title });

    try {
        await prisma.event.update({
            where: { id: event.id },
            data: { status: 'CANCELLED' }
        });

        const { getBaseUrl } = await import("@/shared/lib/url");
        const { headers } = await import("next/headers");
        const baseUrl = getBaseUrl(headers());

        if (event.telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
            const { editMessageText, sendTelegramMessage } = await import("@/features/telegram");
            const token = process.env.TELEGRAM_BOT_TOKEN;

            if (event.pinnedMessageId) {
                await editMessageText(
                    event.telegramChatId,
                    event.pinnedMessageId,
                    `🚫 <b>Event Cancelled</b> (was: ${event.finalizedSlotId ? 'Finalized' : 'Planned'})\n\n` +
                    `The event "<b>${event.title}</b>" has been cancelled by the host.\n\n` +
                    `<a href="${baseUrl}/e/${slug}">View Event Details</a>`,
                    token
                );
            }

            await sendTelegramMessage(
                event.telegramChatId,
                `🚫 <b>Event Cancelled</b>\n\nThe event "${event.title}" has been cancelled by the organizer.`,
                token
            );
        }

        if (event.discordChannelId && process.env.DISCORD_BOT_TOKEN) {
            const { editDiscordMessage, sendDiscordMessage } = await import("@/features/discord/model/discord");
            const token = process.env.DISCORD_BOT_TOKEN!;

            if (event.discordMessageId) {
                await editDiscordMessage(
                    event.discordChannelId,
                    event.discordMessageId,
                    `🚫 **Event Cancelled** (was: ${event.finalizedSlotId ? 'Finalized' : 'Planned'})\n\nThe event "**${event.title}**" has been cancelled by the host.\n\n[View Event Details](${baseUrl}/e/${slug})`,
                    token
                );
            }

            await sendDiscordMessage(
                event.discordChannelId,
                `🚫 **Event Cancelled**\n\nThe event "**${event.title}**" has been cancelled by the organizer.`,
                token
            );
        }

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
        if (!await verifyEventAdmin(slug)) return { success: false, error: "Unauthorized" };

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
