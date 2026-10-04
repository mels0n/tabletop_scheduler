import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { getBaseUrl } from "@/shared/lib/url";
import { broadcastToEvent } from "../deliver";
import { currentVotingTarget, isVotingReminderDue } from "./schedule";
import { classifyDelivery, escapeHtml, liveChannels, type ReminderRunSummary } from "./types";

const log = Logger.get("VotingReminders");

/**
 * Posts "please vote" nudges for open events whose schedule is due. Works for
 * Telegram-only, Discord-only, and dual-linked events alike.
 *
 * Claim before sending: `lastReminderSent` is stamped with a conditional `updateMany`
 * (only if it is still older than the current target instant), so two overlapping runs
 * (pg_cron plus the GitHub backstop) can never both post. The message is built before the
 * claim, and if nothing was delivered the claim is released so the next run retries.
 * Only events with a proposed time still ahead are nudged, so abandoned drafts go quiet.
 */
export async function runVotingReminders(now: Date): Promise<ReminderRunSummary> {
    const summary: ReminderRunSummary = { sent: 0, failed: 0 };

    const events = await prisma.event.findMany({
        where: {
            status: { in: ["ACTIVE", "DRAFT"] },
            reminderEnabled: true,
            // Reaching quorum stops the nudges, whether or not the manager DM landed.
            quorumReachedAt: null,
            timeSlots: { some: { startTime: { gt: now } } },
        },
        select: {
            id: true,
            slug: true,
            title: true,
            timezone: true,
            reminderTime: true,
            reminderDays: true,
            lastReminderSent: true,
            telegramChatId: true,
            discordChannelId: true,
        },
    });

    for (const event of events) {
        try {
            const schedule = {
                reminderTime: event.reminderTime,
                reminderDays: event.reminderDays,
                timezone: event.timezone,
                lastReminderSent: event.lastReminderSent,
            };
            const target = currentVotingTarget(schedule, now);
            if (!target || !isVotingReminderDue(schedule, now)) continue;

            const channels = liveChannels(event);
            if (!channels) continue;

            // Build everything that can throw before claiming, so a throw never burns the reminder.
            const link = `${getBaseUrl()}/e/${event.slug}`;
            const html =
                `🔔 <b>Voting reminder</b>\n\nPlease cast your votes for <b>${escapeHtml(event.title)}</b>!\n\n` +
                `👉 <a href="${link}">Vote Here</a>`;

            const claim = await prisma.event.updateMany({
                where: {
                    id: event.id,
                    OR: [{ lastReminderSent: null }, { lastReminderSent: { lt: target } }],
                },
                data: { lastReminderSent: now },
            });
            if (claim.count !== 1) continue;

            const context = { slug: event.slug, kind: "voting_reminder" };
            let outcome: ReturnType<typeof classifyDelivery>;
            try {
                outcome = classifyDelivery(channels, await broadcastToEvent(channels, { html }, context), context);
            } catch (err) {
                await releaseClaim(event.id, now, event.lastReminderSent);
                throw err;
            }

            if (outcome.outcome === "delivered") {
                summary.sent++;
                log.info("Voting reminder sent", { slug: event.slug });
                continue;
            }

            await releaseClaim(event.id, now, event.lastReminderSent);
            if (outcome.outcome === "nothing_to_do") {
                log.debug("Voting reminder skipped, no platform available", { slug: event.slug });
            } else {
                summary.failed++;
                if (!outcome.permanentOnly) {
                    log.warn("Voting reminder not delivered; will retry next run", { slug: event.slug });
                }
            }
        } catch (err) {
            summary.failed++;
            log.error(`Failed to process voting reminder for ${event.slug}`, err as Error);
        }
    }

    return summary;
}

/** Undoes this run's claim only (matched on the exact timestamp it wrote). */
async function releaseClaim(eventId: number, now: Date, previous: Date | null): Promise<void> {
    await prisma.event.updateMany({
        where: { id: eventId, lastReminderSent: now },
        data: { lastReminderSent: previous },
    });
}
