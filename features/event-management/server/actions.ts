"use server";

import { after } from "next/server";
import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { verifyEventAdmin } from "@/features/auth/server/verify";
import { normalizeHandle, formatHandle } from "@/shared/lib/handle";
import { escapeHtml, escapeDiscordMarkdown } from "@/shared/lib/escape";
// Allowed session reminder lead times (2 hours, 1 day, 2 days), shared with the manage page.
import { isSessionReminderLead } from "@/features/notifications/model/leads";
import { reminderSettingsSchema } from "../model/schemas";
import { getServerConfig } from "@/shared/config/server";
import { processWebhookRow } from "@/features/integrations/webhooks";

const log = Logger.get("EventActions");

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
    const { telegram: { token: telegramToken }, discord: { botToken: discordToken } } = getServerConfig();
    try {
        if (event.telegramChatId && event.pinnedMessageId && telegramToken) {
            const { unpinChatMessage } = await import("@/features/telegram");
            await unpinChatMessage(event.telegramChatId, event.pinnedMessageId, telegramToken);
        }
    } catch (e) {
        log.warn("Failed to unpin Telegram dashboard on delete", { slug, error: String(e) });
    }
    try {
        if (event.discordChannelId && event.discordMessageId && discordToken) {
            const { unpinDiscordMessage } = await import("@/features/integrations/discord/model/discord");
            await unpinDiscordMessage(event.discordChannelId, event.discordMessageId, discordToken);
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
 * Marks an event as CANCELLED without deleting it. When the event came from an integration
 * (`fromUrl`), a CANCELLED webhook row is queued in the same transaction as the status flip;
 * dashboards and announcements follow the commit, and the first delivery attempt runs after the
 * action returns (`after()`). The webhooks cron retries it if that attempt fails.
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
        // The status flip and the CANCELLED webhook row commit together: an integration is
        // never left believing the event is live because the enqueue failed after the flip.
        // Idempotent: only the call that flips the status queues, edits dashboards or announces.
        const { flipped, webhookRowId } = await prisma.$transaction(async (tx) => {
            const { count } = await tx.event.updateMany({
                where: { id: event.id, status: { not: 'CANCELLED' } },
                data: { status: 'CANCELLED' }
            });
            if (count !== 1) return { flipped: false, webhookRowId: null };
            if (!event.fromUrl) return { flipped: true, webhookRowId: null };

            log.info("Queueing cancellation webhook", { slug, fromUrl: event.fromUrl });
            const payload = {
                type: "CANCELLED",
                eventId: event.id,
                fromUrlId: event.fromUrlId,
                slug: event.slug,
                title: event.title,
                timestamp: new Date().toISOString()
            };
            const row = await tx.webhookEvent.create({
                data: {
                    eventId: event.id,
                    url: event.fromUrl,
                    payload: JSON.stringify(payload),
                    status: "PENDING",
                    nextAttempt: new Date()
                }
            });
            return { flipped: true, webhookRowId: row.id };
        });
        if (!flipped) {
            log.info("Event already cancelled", { slug });
            return { success: true };
        }

        // Post-commit: a missing base URL drops the link, it never fails the cancellation.
        const { getBaseUrlOrNull } = await import("@/shared/lib/url");
        const baseUrl = getBaseUrlOrNull();
        const { telegram: { token: telegramToken }, discord: { botToken: discordToken } } = getServerConfig();

        // Edit the pinned dashboards: each platform independently.
        try {
            if (event.telegramChatId && event.pinnedMessageId && telegramToken) {
                const { editMessageText } = await import("@/features/telegram");
                await editMessageText(
                    event.telegramChatId,
                    event.pinnedMessageId,
                    `🚫 <b>Event Cancelled</b> (was: ${event.finalizedSlotId ? 'Finalized' : 'Planned'})\n\n` +
                    `The event "<b>${escapeHtml(event.title)}</b>" has been cancelled by the host.` +
                    (baseUrl ? `\n\n<a href="${baseUrl}/e/${slug}">View Event Details</a>` : ''),
                    telegramToken
                );
            }
        } catch (e) {
            log.warn("Failed to edit Telegram dashboard on cancel", { slug, error: String(e) });
        }

        try {
            if (event.discordChannelId && event.discordMessageId && discordToken) {
                const { editDiscordMessage } = await import("@/features/integrations/discord/model/discord");
                await editDiscordMessage(
                    event.discordChannelId,
                    event.discordMessageId,
                    `🚫 **Event Cancelled** (was: ${event.finalizedSlotId ? 'Finalized' : 'Planned'})\n\nThe event "**${escapeDiscordMarkdown(event.title)}**" has been cancelled by the host.${baseUrl ? `\n\n[View Event Details](<${baseUrl}/e/${slug}>)` : ''}`,
                    discordToken
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

        if (webhookRowId) {
            // First delivery attempt once the action has returned; the webhooks cron retries it.
            try {
                after(() => processWebhookRow(webhookRowId).then(
                    (outcome) => log.info("Immediate webhook attempt", { id: webhookRowId, outcome }),
                    (e) => log.error("Immediate webhook attempt failed", e as Error),
                ));
            } catch (e) {
                log.warn("Could not schedule the immediate webhook attempt; the cron will deliver it", { id: webhookRowId, error: String(e) });
            }
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

        // Server actions are public endpoints: validate every argument (weekdays 0..6,
        // unique, at most 7; HH:MM when enabled so the cron can parse it).
        const parsed = reminderSettingsSchema.safeParse({ enabled, time, days });
        if (!parsed.success) {
            const timeIssue = parsed.error.issues.some((i) => i.path[0] === "time");
            return { success: false, error: timeIssue ? "Invalid time format" : "Invalid reminder settings" };
        }

        const event = await prisma.event.findUnique({ where: { slug } });
        if (!event) return { success: false, error: "Event not found" };

        const reminderDays = parsed.data.days.join(',');
        const changed =
            event.reminderEnabled !== parsed.data.enabled ||
            event.reminderTime !== parsed.data.time ||
            event.reminderDays !== reminderDays;

        await prisma.event.update({
            where: { id: event.id },
            data: {
                reminderEnabled: parsed.data.enabled,
                reminderTime: parsed.data.time,
                reminderDays,
                // Reminders dedupe on the target instant, so stamping "now" means a target that
                // already passed today (turned on late, or time moved earlier) waits for its next
                // occurrence instead of firing at once.
                ...(changed ? { lastReminderSent: new Date() } : {}),
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

        if (typeof enabled !== "boolean" || typeof leadMinutes !== "number" || !isSessionReminderLead(leadMinutes)) {
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
