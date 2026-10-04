import Logger from "@/shared/lib/logger";
import type { DeliveryOutcome, DeliveryResult, EventChannels } from "../deliver";

const log = Logger.get("Reminders");

export interface ReminderRunSummary {
    sent: number;
    failed: number;
}

export function escapeHtml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type Platform = "telegram" | "discord";

/**
 * Channels that returned a permanent error (bot removed, channel deleted). Reminders skip
 * them for the life of this server instance instead of retrying every run; nothing is
 * persisted, so a cold start or a re-link tries again.
 */
const deadChannels = new Set<string>();

const channelKey = (platform: Platform, id: string) => `${platform}:${id}`;

export function resetDeadChannelsForTests(): void {
    deadChannels.clear();
}

/**
 * True for errors that will never succeed on retry: Discord 10003 Unknown Channel and
 * 50001 Missing Access; Telegram 403 (bot kicked or blocked) and 400 chat not found.
 */
export function isPermanentFailure(platform: Platform, outcome: DeliveryOutcome): boolean {
    if (outcome.status !== "failed") return false;
    const error = outcome.error.toLowerCase();
    if (platform === "discord") return /(^|\D)(10003|50001)(\D|$)/.test(error);
    return error.includes("forbidden") || error.includes("chat not found");
}

/** The event's linked channels minus any known dead ones, or null when nothing is left to post to. */
export function liveChannels(event: { telegramChatId: string | null; discordChannelId: string | null }): EventChannels | null {
    const telegramChatId =
        event.telegramChatId && !deadChannels.has(channelKey("telegram", event.telegramChatId)) ? event.telegramChatId : null;
    const discordChannelId =
        event.discordChannelId && !deadChannels.has(channelKey("discord", event.discordChannelId)) ? event.discordChannelId : null;
    if (!telegramChatId && !discordChannelId) return null;
    return { telegramChatId, discordChannelId };
}

export type ReminderOutcome =
    /** At least one platform delivered. Partial delivery counts as sent: retrying would duplicate on the platform that worked. */
    | "delivered"
    /** Every platform skipped (not linked or bot not configured). Not a failure; nothing is logged above debug. */
    | "nothing_to_do"
    /** Nothing delivered and at least one platform failed. */
    | "failed";

/**
 * Classifies a broadcast and records permanently dead channels (warned once each).
 * `permanentOnly` is true when every failure was permanent, so the caller need not warn again.
 */
export function classifyDelivery(
    channels: EventChannels,
    result: DeliveryResult,
    context: Record<string, unknown>
): { outcome: ReminderOutcome; permanentOnly: boolean } {
    let anyTransient = false;
    for (const platform of ["telegram", "discord"] as const) {
        const outcome = result[platform];
        if (outcome.status !== "failed") continue;
        const id = platform === "telegram" ? channels.telegramChatId : channels.discordChannelId;
        if (id && isPermanentFailure(platform, outcome)) {
            const key = channelKey(platform, id);
            if (!deadChannels.has(key)) {
                deadChannels.add(key);
                log.warn(`Reminder channel unreachable on ${platform}; skipping it from now on`, { ...context, error: outcome.error });
            }
        } else {
            anyTransient = true;
        }
    }

    if (result.telegram.status === "sent" || result.discord.status === "sent") {
        return { outcome: "delivered", permanentOnly: false };
    }
    if (result.telegram.status === "skipped" && result.discord.status === "skipped") {
        return { outcome: "nothing_to_do", permanentOnly: false };
    }
    return { outcome: "failed", permanentOnly: !anyTransient };
}
