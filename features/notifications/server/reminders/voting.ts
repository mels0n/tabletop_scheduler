import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { getBaseUrl } from "@/shared/lib/url";
import { broadcastToEvent, isDelivered } from "../deliver";
import { isVotingReminderDue } from "./schedule";
import { escapeHtml, isNothingLinked, type ReminderRunSummary } from "./types";

const log = Logger.get("VotingReminders");

/**
 * Posts "please vote" nudges for open events whose schedule is due. Works for
 * Telegram-only, Discord-only, and dual-linked events alike.
 */
export async function runVotingReminders(now: Date): Promise<ReminderRunSummary> {
    const summary: ReminderRunSummary = { sent: 0, failed: 0 };

    const events = await prisma.event.findMany({
        where: {
            status: { in: ["ACTIVE", "DRAFT"] },
            reminderEnabled: true,
            quorumViableNotified: false,
        },
    });

    for (const event of events) {
        try {
            const due = isVotingReminderDue(
                {
                    reminderTime: event.reminderTime,
                    reminderDays: event.reminderDays,
                    timezone: event.timezone,
                    lastReminderSent: event.lastReminderSent,
                },
                now
            );
            if (!due) continue;

            const link = `${getBaseUrl()}/e/${event.slug}`;
            const html =
                `🔔 <b>Voting reminder</b>\n\nPlease cast your votes for <b>${escapeHtml(event.title)}</b>!\n\n` +
                `👉 <a href="${link}">Vote Here</a>`;

            const result = await broadcastToEvent(event, { html }, { slug: event.slug, kind: "voting_reminder" });

            if (isDelivered(result)) {
                await prisma.event.update({ where: { id: event.id }, data: { lastReminderSent: now } });
                summary.sent++;
                log.info("Voting reminder sent", { slug: event.slug });
            } else if (isNothingLinked(result)) {
                log.debug("Voting reminder skipped, no group or channel linked", { slug: event.slug });
            } else {
                summary.failed++;
                log.warn("Voting reminder not delivered; will retry next run", { slug: event.slug, result });
            }
        } catch (err) {
            summary.failed++;
            log.error(`Failed to process voting reminder for ${event.slug}`, err as Error);
        }
    }

    return summary;
}
