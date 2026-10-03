import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { getBaseUrl } from "@/shared/lib/url";
import { SESSION_REMINDER_LEADS } from "../../model/leads";
import { broadcastToEvent } from "../deliver";
import { isSessionReminderDue } from "./schedule";
import { classifyDelivery, escapeHtml, liveChannels, type ReminderRunSummary } from "./types";

const log = Logger.get("SessionReminders");

function formatSessionTime(start: Date, timezone: string): string {
    const options: Intl.DateTimeFormatOptions = {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
    };
    try {
        return new Intl.DateTimeFormat("en-US", { ...options, timeZone: timezone }).format(start);
    } catch {
        return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(start);
    }
}

/** Upper bound on any allowed lead, used to keep the slot query to the next few days. */
const MAX_LEAD_MS = Math.max(...SESSION_REMINDER_LEADS) * 60_000;

/**
 * Posts a one-time heads-up to the linked group/channel before each scheduled
 * session of finalized events (one-shot and campaign). No DMs.
 *
 * One query loads every candidate event with its unsent upcoming slots. Each due slot
 * is claimed with a conditional `updateMany` before sending, so overlapping runs never
 * double-post; the claim is released when nothing was delivered so the next run retries.
 * Partial delivery (one platform sent) counts as sent and keeps the claim.
 */
export async function runSessionReminders(now: Date): Promise<ReminderRunSummary> {
    const summary: ReminderRunSummary = { sent: 0, failed: 0 };
    const unsentUpcoming = { startTime: { gt: now }, sessionReminderSentAt: null };

    const events = await prisma.event.findMany({
        where: {
            status: "FINALIZED",
            sessionReminderEnabled: true,
            sessionReminderLeadMinutes: { not: null },
            timeSlots: { some: unsentUpcoming },
        },
        select: {
            id: true,
            slug: true,
            title: true,
            timezone: true,
            location: true,
            eventType: true,
            finalizedSlotId: true,
            sessionReminderLeadMinutes: true,
            telegramChatId: true,
            discordChannelId: true,
            finalizedSessions: { select: { timeSlotId: true } },
            timeSlots: {
                where: { ...unsentUpcoming, startTime: { gt: now, lte: new Date(now.getTime() + MAX_LEAD_MS) } },
                select: { id: true, startTime: true },
            },
        },
    });

    for (const event of events) {
        try {
            const scheduled =
                event.eventType === "CAMPAIGN"
                    ? new Set(event.finalizedSessions.map(s => s.timeSlotId))
                    : new Set(event.finalizedSlotId ? [event.finalizedSlotId] : []);

            for (const slot of event.timeSlots) {
                if (!scheduled.has(slot.id)) continue;
                if (!isSessionReminderDue(slot.startTime, event.sessionReminderLeadMinutes, now)) continue;

                const channels = liveChannels(event);
                if (!channels) break;

                const claim = await prisma.timeSlot.updateMany({
                    where: { id: slot.id, sessionReminderSentAt: null },
                    data: { sessionReminderSentAt: now },
                });
                if (claim.count !== 1) continue;

                const link = `${getBaseUrl()}/e/${event.slug}`;
                const when = formatSessionTime(slot.startTime, event.timezone || "UTC");
                const lines = [
                    `📅 <b>Session reminder</b>`,
                    ``,
                    `<b>${escapeHtml(event.title)}</b> starts ${escapeHtml(when)}.`,
                ];
                if (event.location) lines.push(`📍 ${escapeHtml(event.location)}`);
                lines.push(``, `👉 <a href="${link}">Event details</a>`);

                const context = { slug: event.slug, slotId: slot.id, kind: "session_reminder" };
                let outcome: ReturnType<typeof classifyDelivery>;
                try {
                    outcome = classifyDelivery(channels, await broadcastToEvent(channels, { html: lines.join("\n") }, context), context);
                } catch (err) {
                    await releaseClaim(slot.id, now);
                    throw err;
                }

                if (outcome.outcome === "delivered") {
                    summary.sent++;
                    log.info("Session reminder sent", { slug: event.slug, slotId: slot.id });
                    continue;
                }

                await releaseClaim(slot.id, now);
                if (outcome.outcome === "nothing_to_do") {
                    log.debug("Session reminder skipped, no platform available", { slug: event.slug });
                } else {
                    summary.failed++;
                    if (!outcome.permanentOnly) {
                        log.warn("Session reminder not delivered; will retry next run", { slug: event.slug, slotId: slot.id });
                    }
                }
            }
        } catch (err) {
            summary.failed++;
            log.error(`Failed to process session reminder for ${event.slug}`, err as Error);
        }
    }

    return summary;
}

/** Undoes this run's claim only (matched on the exact timestamp it wrote). */
async function releaseClaim(slotId: number, now: Date): Promise<void> {
    await prisma.timeSlot.updateMany({
        where: { id: slotId, sessionReminderSentAt: now },
        data: { sessionReminderSentAt: null },
    });
}
