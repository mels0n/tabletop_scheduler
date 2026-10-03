import Logger from "@/shared/lib/logger";
import { htmlToDiscordMarkdown } from "@/shared/lib/discordMarkdown";
import { sendTelegramMessage } from "@/features/telegram/lib/telegram-client";
import { sendDiscordMessage, sendDiscordDM } from "@/features/discord/model/discord";

const log = Logger.get("Notifications");

/**
 * Telegram and Discord are peers. Every send goes to each platform the target
 * is linked to, independently: a missing token, missing link, or failed send on
 * one platform never prevents delivery on the other.
 */

/** A message authored once. Telegram gets `html`; Discord gets `discord`, or `html` converted. */
export interface NotificationMessage {
    html: string;
    discord?: string;
}

/** Where a group/channel post goes. Pass the Event row (or a pick of it). */
export interface EventChannels {
    telegramChatId?: string | null;
    discordChannelId?: string | null;
}

/** Where a direct message goes. Map from Participant (`chatId`, `discordId`) or the Event's manager fields. */
export interface UserTargets {
    telegramChatId?: string | null;
    discordUserId?: string | null;
}

export type DeliveryOutcome =
    | { status: "sent"; messageId: string }
    | { status: "failed"; error: string }
    | { status: "skipped"; reason: "not_linked" | "not_configured" };

export interface DeliveryResult {
    telegram: DeliveryOutcome;
    discord: DeliveryOutcome;
}

export function isDelivered(result: DeliveryResult): boolean {
    return result.telegram.status === "sent" || result.discord.status === "sent";
}

function toDiscord(message: NotificationMessage): string {
    return message.discord ?? htmlToDiscordMarkdown(message.html);
}

function describeError(error: unknown): string {
    if (!error) return "unknown error";
    if (typeof error === "string") return error;
    if (error instanceof Error) return error.message;
    const e = error as { code?: unknown; message?: unknown };
    if (e.code !== undefined || e.message !== undefined) return `${e.code ?? ""} ${e.message ?? ""}`.trim();
    return JSON.stringify(error);
}

async function viaTelegram(chatId: string | null | undefined, html: string): Promise<DeliveryOutcome> {
    if (!chatId) return { status: "skipped", reason: "not_linked" };
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return { status: "skipped", reason: "not_configured" };
    try {
        const id = await sendTelegramMessage(chatId, html, token);
        return id ? { status: "sent", messageId: String(id) } : { status: "failed", error: "telegram send returned no message id" };
    } catch (e) {
        return { status: "failed", error: describeError(e) };
    }
}

async function viaDiscord(
    target: string | null | undefined,
    content: string,
    send: (target: string, content: string, token: string) => Promise<{ id?: string; error?: unknown }>
): Promise<DeliveryOutcome> {
    if (!target) return { status: "skipped", reason: "not_linked" };
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return { status: "skipped", reason: "not_configured" };
    try {
        const res = await send(target, content, token);
        return res.id ? { status: "sent", messageId: res.id } : { status: "failed", error: describeError(res.error) };
    } catch (e) {
        return { status: "failed", error: describeError(e) };
    }
}

function logFailures(kind: string, result: DeliveryResult, context?: Record<string, unknown>) {
    for (const platform of ["telegram", "discord"] as const) {
        const outcome = result[platform];
        if (outcome.status === "failed") {
            log.warn(`${kind} failed on ${platform}`, { ...context, error: outcome.error });
        }
    }
}

/** Posts a message to the event's linked Telegram group and Discord channel. */
export async function broadcastToEvent(
    channels: EventChannels,
    message: NotificationMessage,
    context?: Record<string, unknown>
): Promise<DeliveryResult> {
    const [telegram, discord] = await Promise.all([
        viaTelegram(channels.telegramChatId, message.html),
        viaDiscord(channels.discordChannelId, toDiscord(message), sendDiscordMessage),
    ]);
    const result = { telegram, discord };
    logFailures("broadcast", result, context);
    return result;
}

/** Sends a direct message to a user on every platform they have linked. */
export async function sendDirectMessage(
    target: UserTargets,
    message: NotificationMessage,
    context?: Record<string, unknown>
): Promise<DeliveryResult> {
    const [telegram, discord] = await Promise.all([
        viaTelegram(target.telegramChatId, message.html),
        viaDiscord(target.discordUserId, toDiscord(message), sendDiscordDM),
    ]);
    const result = { telegram, discord };
    logFailures("direct message", result, context);
    return result;
}
