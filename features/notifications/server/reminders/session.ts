import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { getBaseUrl } from "@/shared/lib/url";
import { broadcastToEvent, isDelivered } from "../deliver";
import { isSessionReminderDue } from "./schedule";
import { escapeHtml, isNothingLinked, type ReminderRunSummary } from "./types";

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

interface Candidate {
    slotId: number;
    startTime: Date;
    sentAt: Date | null;
}

/**
 * Posts a one-time heads-up to the linked group/channel before each scheduled
 * session of finalized events (one-shot and campaign). No DMs.
 */
export async function runSessionReminders(now: Date): Promise<ReminderRunSummary> {
    const summary: ReminderRunSummary = { sent: 0, failed: 0 };

    const events = await prisma.event.findMany({
        where: {
            status: "FINALIZED",
            sessionReminderEnabled: true,
            sessionReminderLeadMinutes: { not: null },
        },
        include: { finalizedSessions: { include: { timeSlot: true } } },
    });

    for (const event of events) {
        try {
            const candidates: Candidate[] = [];

            if (event.eventType === "CAMPAIGN") {
                for (const session of event.finalizedSessions) {
                    candidates.push({
                        slotId: session.timeSlotId,
                        startTime: session.timeSlot.startTime,
                        sentAt: session.timeSlot.sessionReminderSentAt,
                    });
                }
            } else if (event.finalizedSlotId) {
                const slot = await prisma.timeSlot.findUnique({ where: { id: event.finalizedSlotId } });
                if (slot) {
                    candidates.push({ slotId: slot.id, startTime: slot.startTime, sentAt: slot.sessionReminderSentAt });
                }
            }

            for (const candidate of candidates) {
                const due = isSessionReminderDue(
                    {
                        startTime: candidate.startTime,
                        leadMinutes: event.sessionReminderLeadMinutes,
                        sentAt: candidate.sentAt,
                    },
                    now
                );
                if (!due) continue;

                const link = `${getBaseUrl(null)}/e/${event.slug}`;
                const when = formatSessionTime(candidate.startTime, event.timezone || "UTC");
                const lines = [
                    `📅 <b>Session reminder</b>`,
                    ``,
                    `<b>${escapeHtml(event.title)}</b> starts ${escapeHtml(when)}.`,
                ];
                if (event.location) lines.push(`📍 ${escapeHtml(event.location)}`);
                lines.push(``, `👉 <a href="${link}">Event details</a>`);

                const result = await broadcastToEvent(
                    event,
                    { html: lines.join("\n") },
                    { slug: event.slug, slotId: candidate.slotId, kind: "session_reminder" }
                );

                if (isDelivered(result)) {
                    await prisma.timeSlot.update({
                        where: { id: candidate.slotId },
                        data: { sessionReminderSentAt: now },
                    });
                    summary.sent++;
                    log.info("Session reminder sent", { slug: event.slug, slotId: candidate.slotId });
                } else if (isNothingLinked(result)) {
                    log.debug("Session reminder skipped, no group or channel linked", { slug: event.slug });
                } else {
                    summary.failed++;
                    log.warn("Session reminder not delivered; will retry next run", { slug: event.slug, result });
                }
            }
        } catch (err) {
            summary.failed++;
            log.error(`Failed to process session reminder for ${event.slug}`, err as Error);
        }
    }

    return summary;
}
