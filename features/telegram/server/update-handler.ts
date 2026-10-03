import "server-only";
import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { getServerConfig } from "@/shared/config/server";
import { escapeHtml } from "@/shared/lib/escape";
import { normalizeHandle } from "@/shared/lib/handle";
import { hashToken } from "@/shared/lib/token";
import { getBaseUrl } from "@/shared/lib/url";
import { generateStatusMessage } from "@/shared/lib/status";
import { sendTelegramMessage, pinChatMessage } from "../lib/telegram-client";
import type { TelegramUpdate, TelegramUser } from "../model/types";
import {
    CONNECT_CODE_INVALID,
    CONNECT_INSTRUCTIONS,
    parseConnectCommand,
    verifyConnectCode,
} from "../model/connect-code";

const log = Logger.get("Telegram:Updates");

/**
 * The one Telegram update handler. Both transports call it: the webhook route
 * (`app/api/telegram/webhook/route.ts`) and the long-polling loop
 * (`features/telegram/lib/telegram-service.ts`). Command routing lives here only.
 *
 * Commands:
 * - `/connect <slug> <code>` binds the chat to an event. The code is shown only on the
 *   manage page; a bare slug, `/start <slug>`, or a pasted event link gets instructions.
 * - `/start rec_<token>` completes a manager recovery minted from the manage page.
 * - `/start login` (or `recover_handle`, or a bare `/start` in a private chat, since
 *   clients sometimes drop the deep-link payload) DMs a 15-minute magic login link.
 *   A bare `/start` in a group stays silent: it is usually meant for another bot.
 * - Passive capture: when a user with a username speaks, their user id is recorded on
 *   participant and manager rows that carry that handle and have no chat id yet.
 *
 * Errors propagate to the caller, which logs them. The webhook still answers 200 so
 * Telegram does not redeliver and re-run side effects.
 */

// Idempotency: the last MAX_REMEMBERED_UPDATES update ids seen by THIS instance.
// Per-instance only: on serverless each warm lambda keeps its own set, so a redelivery
// that lands on a different instance is processed again. The handlers tolerate that
// (binding, capture and recovery are idempotent writes; a repeated login request just
// mints another short-lived link). The set exists to absorb same-instance retries.
const MAX_REMEMBERED_UPDATES = 1000;
const processedUpdateIds = new Set<number>();

/** Records the id and reports whether it had been seen before. Insertion order = LRU order. */
function alreadyProcessed(updateId: number): boolean {
    if (processedUpdateIds.has(updateId)) return true;
    processedUpdateIds.add(updateId);
    if (processedUpdateIds.size > MAX_REMEMBERED_UPDATES) {
        const oldest = processedUpdateIds.values().next().value;
        if (oldest !== undefined) processedUpdateIds.delete(oldest);
    }
    return false;
}

/** Clears the processed-update memory. Tests only. */
export function resetProcessedUpdatesForTests(): void {
    processedUpdateIds.clear();
}

const EVENT_LINK = /\/e\/[a-zA-Z0-9]+/;
const SLUG = /^[a-zA-Z0-9]+$/;

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
    if (typeof update.update_id === "number" && alreadyProcessed(update.update_id)) {
        log.debug("Skipping already processed update", { updateId: update.update_id });
        return;
    }

    const message = update.message;
    if (!message?.text) return;

    const token = getServerConfig().telegram.token;
    if (!token) {
        log.error("Received a Telegram update but TELEGRAM_BOT_TOKEN is not configured");
        return;
    }

    const text = message.text;
    const chatId = message.chat.id;
    const user = message.from;

    log.debug("Received message", { chatId, text: text.substring(0, 20) });

    if (text.startsWith("/connect")) {
        const { slug, code } = parseConnectCommand(text);
        await connectEvent(slug, code, chatId, token);
    } else if (EVENT_LINK.test(text)) {
        // A pasted event link binds nothing (every invited player has the link).
        await sendTelegramMessage(chatId, CONNECT_INSTRUCTIONS, token);
    } else if (text.startsWith("/start")) {
        await handleStart(text, chatId, message.chat.type, user, token);
    }

    if (user?.username) {
        await captureParticipantIdentity(user);
        await captureManagerIdentity(user);
    }
}

async function handleStart(
    text: string,
    chatId: number,
    chatType: string | undefined,
    user: TelegramUser | undefined,
    token: string
): Promise<void> {
    const payload = text.split(" ")[1]?.trim() ?? "";

    if (payload.startsWith("rec_")) {
        await handleShortLinkRecovery(chatId, user, payload.slice("rec_".length), token);
    } else if (payload === "login" || payload === "recover_handle") {
        await handleGlobalLogin(chatId, user, token);
    } else if (payload && SLUG.test(payload)) {
        // ?startgroup=<slug> from "Add to Group": adding the bot binds nothing.
        await sendTelegramMessage(chatId, CONNECT_INSTRUCTIONS, token);
    } else if (chatType === "private") {
        // Bare or unrecognized /start in a DM: silence would look like a broken bot.
        await handleGlobalLogin(chatId, user, token);
    }
}

/** Bare handle (lowercase, no @) and its @-prefixed form, as stored by older rows. */
function handleVariants(username: string): [string, string] {
    const handle = username.toLowerCase().replace("@", "");
    return [handle, `@${handle}`];
}

async function captureManagerIdentity(user: TelegramUser): Promise<void> {
    // The user's own id, never the group chat id, so DMs reach the person.
    const userId = user.id?.toString();
    if (!user.username || !userId) return;
    const [handle, formatted] = handleVariants(user.username);

    try {
        const { count } = await prisma.event.updateMany({
            where: { managerTelegram: { in: [handle, formatted] }, managerChatId: null },
            data: { managerChatId: userId },
        });
        if (count > 0) log.info("Passively captured manager chat ids", { handle, count });
    } catch (e) {
        log.error("Failed passive manager capture", e as Error);
    }
}

async function captureParticipantIdentity(user: TelegramUser): Promise<void> {
    const userId = user.id?.toString();
    if (!user.username || !userId) return;
    const [handle, formatted] = handleVariants(user.username);

    try {
        const { count } = await prisma.participant.updateMany({
            where: { OR: [{ telegramId: handle }, { telegramId: formatted }], chatId: null },
            data: { chatId: userId },
        });
        if (count > 0) log.info("Passively captured participant chat ids", { handle, count });
    } catch (e) {
        log.error("Failed passive participant capture", e as Error);
    }
}

/** Issues a single-use, 15-minute magic login link. Only the hash is stored. */
async function handleGlobalLogin(chatId: number, user: TelegramUser | undefined, token: string): Promise<void> {
    const plaintextToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // The Telegram username lets the login route set a display cookie (mirrors Discord's
    // discordUsername) so the vote form can show the identity badge.
    await prisma.loginToken.create({
        data: {
            token: hashToken(plaintextToken),
            chatId: chatId.toString(),
            telegramUsername: normalizeHandle(user?.username) || null,
            expiresAt,
        },
    });

    const magicLink = `${getBaseUrl()}/auth/login?token=${plaintextToken}`;
    await sendTelegramMessage(
        chatId,
        `🔐 <b>Magic Login</b>\n\nClick here to access <b>My Events</b>:\n${escapeHtml(magicLink)}\n\n(Valid for 15 minutes)`,
        token
    );
}

/**
 * Binds a chat to an event (`telegramChatId`) for `/connect <slug> <code>`, then posts and
 * pins the dashboard. Binding never sets or changes the event's manager identity.
 */
async function connectEvent(slug: string | null, code: string | null, chatId: number, token: string): Promise<void> {
    if (!slug || !code) {
        await sendTelegramMessage(chatId, CONNECT_INSTRUCTIONS, token);
        return;
    }

    const event = await prisma.event.findUnique({ where: { slug } });
    if (!event || !verifyConnectCode(slug, event.adminToken, code)) {
        log.warn("Connect refused: unknown event or invalid code", { slug });
        await sendTelegramMessage(chatId, CONNECT_CODE_INVALID, token);
        return;
    }

    await prisma.event.update({
        where: { id: event.id },
        data: { telegramChatId: chatId.toString() },
    });
    log.info("Connected chat to event", { chatId, slug });

    try {
        const fullEvent = await prisma.event.findUnique({
            where: { id: event.id },
            include: { timeSlots: { include: { votes: true } } },
        });
        if (!fullEvent) return;

        const participants = await prisma.participant.count({ where: { eventId: event.id } });
        const statusMsg = generateStatusMessage(fullEvent, participants, getBaseUrl());

        const dashboardMsgId = await sendTelegramMessage(chatId, statusMsg, token);
        if (dashboardMsgId) {
            await pinChatMessage(chatId, dashboardMsgId, token);
            await prisma.event.update({
                where: { id: event.id },
                data: { pinnedMessageId: dashboardMsgId },
            });
        }
    } catch (e) {
        log.error("Failed to initialize dashboard pin", e as Error);
    }
}

/** `/start rec_<token>`: the short recovery token minted on the manage page (one-time use). */
async function handleShortLinkRecovery(
    chatId: number,
    user: TelegramUser | undefined,
    recoveryToken: string,
    token: string
): Promise<void> {
    const event = await prisma.event.findUnique({
        where: { recoveryToken: hashToken(recoveryToken) },
    });

    if (!event) {
        await sendTelegramMessage(chatId, "⚠️ <b>Invalid Recovery Link</b>\n\nThis link is invalid or has expired.", token);
        return;
    }

    if (!event.recoveryTokenExpires || new Date() > event.recoveryTokenExpires) {
        await sendTelegramMessage(chatId, "⚠️ <b>Expired Link</b>\n\nThis recovery link has expired. Please refresh the Manage page to get a new one.", token);
        return;
    }

    await prisma.event.update({
        where: { id: event.id },
        data: { recoveryToken: null, recoveryTokenExpires: null },
    });

    const senderUsername = user?.username?.toLowerCase();
    if (!user || !senderUsername) {
        await sendTelegramMessage(chatId, "⚠️ Could not verify identity. Please ensure you have a Telegram username set.", token);
        return;
    }

    const managerHandle = event.managerTelegram?.toLowerCase().replace("@", "");
    const updateData: { managerChatId: string; managerTelegram?: string } = { managerChatId: user.id.toString() };
    let claimMessage = "";

    if (!managerHandle) {
        // No manager yet: the holder of the recovery token claims it.
        updateData.managerTelegram = senderUsername;
        claimMessage = `\n\n👮 <b>Manager Set:</b> @${escapeHtml(senderUsername)}`;
        log.info("Manager claimed event via short-link recovery", { slug: event.slug, manager: senderUsername });
    } else if (senderUsername !== managerHandle) {
        await sendTelegramMessage(
            chatId,
            `⚠️ <b>Identity Mismatch</b>\n\nYou are @${escapeHtml(senderUsername)}, but this event is managed by @${escapeHtml(managerHandle)}.`,
            token
        );
        return;
    }

    await prisma.event.update({ where: { id: event.id }, data: updateData });
    log.info("Manager recovery linked via short-link", { slug: event.slug, manager: senderUsername, chatId: user.id });

    await sendTelegramMessage(
        chatId,
        `✅ <b>Recovery Setup Complete!</b>\n\nI've verified you as the manager of <b>${escapeHtml(event.title)}</b>.${claimMessage}\n\nThe event page on your device should update in a few seconds.`,
        token
    );
}
