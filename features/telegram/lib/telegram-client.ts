import { createHash } from "crypto";
import Logger from "@/shared/lib/logger";
import { reliableFetch } from "@/shared/lib/fetch";
import type { EditResult } from "@/shared/lib/edit-result";

const log = Logger.get("Telegram");

/**
 * Outcome of a Bot API call that can fail meaningfully. On failure `error` is Telegram's own
 * `description` (for example "Forbidden: bot was kicked from the group chat" or
 * "Bad Request: chat not found") and `status` is the HTTP status, or 0 when no response
 * arrived (network error, timeout, missing token).
 */
export type TelegramResult<T> = { ok: true; value: T } | { ok: false; error: string; status: number };

interface TelegramErrorBody {
    description: string;
    /** Set when a basic group was upgraded to a supergroup. */
    migrateToChatId: number | null;
}

/** Reads `description` and `parameters.migrate_to_chat_id` from a Bot API error body. */
function parseErrorBody(status: number, raw: string): TelegramErrorBody {
    try {
        const body = JSON.parse(raw);
        const id = body?.parameters?.migrate_to_chat_id;
        return {
            description: typeof body?.description === "string" ? body.description : `HTTP ${status}`,
            migrateToChatId: typeof id === "number" ? id : null,
        };
    } catch {
        return { description: raw.trim() || `HTTP ${status}`, migrateToChatId: null };
    }
}

function failure(error: string, status: number): { ok: false; error: string; status: number } {
    return { ok: false, error, status };
}

function errorMessage(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

/** Repoints every event bound to the old group at the upgraded supergroup. Never throws. */
async function adoptMigratedChat(oldChatId: string | number, newChatId: number): Promise<void> {
    try {
        const { default: prisma } = await import("@/shared/lib/prisma");
        const { count } = await prisma.event.updateMany({
            where: { telegramChatId: String(oldChatId) },
            data: { telegramChatId: String(newChatId) },
        });
        log.info("Telegram group migrated to supergroup; updated bound events", { oldChatId, newChatId, count });
    } catch (e) {
        log.error("Failed to record Telegram chat migration", e as Error);
    }
}

export interface SendMessageOptions {
    /**
     * Ask Telegram not to unfurl links in the message. Defaults to true for a private chat
     * (a DM: positive chat id), where links are often one-time login links that a preview
     * fetch could expose, and false for groups and channels.
     */
    disableLinkPreview?: boolean;
}

/** Telegram user (private chat) ids are positive; group, supergroup and channel ids are negative. */
function isPrivateChat(chatId: string | number): boolean {
    const n = typeof chatId === "number" ? chatId : Number(chatId);
    return Number.isFinite(n) && n > 0;
}

/**
 * Sends an HTML message and reports Telegram's error on failure. When the group was upgraded
 * to a supergroup, bound events are repointed and the send is retried once in the new chat.
 * Link previews are off by default in DMs (see `SendMessageOptions`).
 */
export async function sendTelegramMessageResult(
    chatId: string | number,
    text: string,
    token: string,
    options: SendMessageOptions = {},
): Promise<TelegramResult<number>> {
    const disableLinkPreview = options.disableLinkPreview ?? isPrivateChat(chatId);
    return postMessage(chatId, text, token, true, disableLinkPreview);
}

/**
 * @function sendTelegramMessage
 * @description Sends a rich text message (HTML parse mode) to a Telegram chat.
 * Convenience form of `sendTelegramMessageResult` for callers that only need the id.
 *
 * @returns {Promise<number | null>} The sent message id, or null if the send failed.
 */
export async function sendTelegramMessage(
    chatId: string | number,
    text: string,
    token: string,
    options: SendMessageOptions = {},
): Promise<number | null> {
    const result = await sendTelegramMessageResult(chatId, text, token, options);
    return result.ok ? result.value : null;
}

async function postMessage(
    chatId: string | number,
    text: string,
    token: string,
    allowMigrationRetry: boolean,
    disableLinkPreview: boolean,
): Promise<TelegramResult<number>> {
    if (!token) {
        log.error("Token is missing");
        return failure("Telegram bot token is missing", 0);
    }
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    log.debug(`Sending message to ${chatId}`, { textSnippet: text.substring(0, 50) });

    try {
        const res = await reliableFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML',
                ...(disableLinkPreview ? { link_preview_options: { is_disabled: true } } : {}),
            })
        });

        if (!res.ok) {
            const err = parseErrorBody(res.status, await res.text());
            if (allowMigrationRetry && err.migrateToChatId !== null) {
                await adoptMigratedChat(chatId, err.migrateToChatId);
                return postMessage(err.migrateToChatId, text, token, false, disableLinkPreview);
            }
            log.error("API Error (sendMessage)", { status: res.status, error: err.description });
            return failure(err.description, res.status);
        }

        const data = await res.json();
        const messageId = data.result?.message_id;
        if (typeof messageId !== "number") return failure("Telegram response carried no message id", res.status);
        log.debug(`Message sent successfully. ID: ${messageId}`);
        return { ok: true, value: messageId };
    } catch (e) {
        log.error("Failed to send message", e as Error);
        return failure(errorMessage(e), 0);
    }
}

/**
 * @function unpinChatMessage
 * @description Unpins a specific message to remove it from the top of the chat.
 * Useful for keeping the chat clean when posting new status updates.
 *
 * @param {string | number} chatId - Target Chat ID.
 * @param {number} messageId - The ID of the message to unpin.
 * @param {string} token - Bot Token.
 * @returns {Promise<boolean>} Success status.
 */
export async function unpinChatMessage(chatId: string | number, messageId: number, token: string) {
    log.debug(`Attempting to UNPIN message ${messageId} in chat ${chatId}`);
    const url = `https://api.telegram.org/bot${token}/unpinChatMessage`;
    try {
        const res = await reliableFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId
            })
        });

        if (!res.ok) {
            const err = await res.text();
            log.warn("API Error (unpinChatMessage)", { error: err });
            return false;
        }

        log.debug(`Message ${messageId} unpinned successfully.`);
        return true;
    } catch (e) {
        log.error("Failed to unpin message", e as Error);
        return false;
    }
}

/**
 * Pins a message silently and reports Telegram's error on failure. When the bot lacks pin
 * rights it also asks the chat to promote it.
 */
export async function pinChatMessageResult(chatId: string | number, messageId: number, token: string): Promise<TelegramResult<void>> {
    log.debug(`Attempting to pin message ${messageId} in chat ${chatId}`);
    const url = `https://api.telegram.org/bot${token}/pinChatMessage`;
    try {
        const res = await reliableFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                disable_notification: true
            })
        });

        if (!res.ok) {
            const err = parseErrorBody(res.status, await res.text());
            log.error("API Error (pinChatMessage)", { status: res.status, error: err.description });

            // Intent: If the bot can't pin, it alerts the chat to fix permissions.
            if (res.status === 400 && err.description.includes("not enough rights")) {
                await sendTelegramMessage(chatId, "⚠️ I tried to pin the message above, but I don't have permission. Please promote me to <b>Admin</b> with <b>Pin Messages</b> rights!", token);
            }
            return failure(err.description, res.status);
        }

        log.info(`Message ${messageId} pinned successfully.`);
        return { ok: true, value: undefined };
    } catch (e) {
        log.error("Failed to pin message", e as Error);
        return failure(errorMessage(e), 0);
    }
}

/**
 * @function pinChatMessage
 * @description Pins a message to the top of the chat. Convenience form of
 * `pinChatMessageResult` for callers that do not act on the outcome.
 */
export async function pinChatMessage(chatId: string | number, messageId: number, token: string): Promise<void> {
    await pinChatMessageResult(chatId, messageId, token);
}

/**
 * Edits a message's HTML text and reports Telegram's error on failure. "message is not
 * modified" counts as success. When the group was upgraded to a supergroup, bound events are
 * repointed and the edit is retried once there (message ids do not carry over, so the retry
 * usually fails and the caller reposts, now into the right chat).
 */
export async function editMessageTextResult(chatId: string | number, messageId: number, text: string, token: string): Promise<TelegramResult<void>> {
    return editMessage(chatId, messageId, text, token, true);
}

/**
 * @function editMessageText
 * @description Modifies the content of an existing message (the live dashboard).
 *
 * @returns {Promise<EditResult>} 'edited' when the message shows `text` (including "message is
 * not modified"); 'gone' on 400 "message to edit not found" / "message can't be edited";
 * 'failed' for anything else (rate limit, 5xx, timeout), where the caller must not repost.
 */
export async function editMessageText(chatId: string | number, messageId: number, text: string, token: string): Promise<EditResult> {
    const result = await editMessageTextResult(chatId, messageId, text, token);
    if (result.ok) return "edited";
    const gone = result.error.includes("message to edit not found") || result.error.includes("message can't be edited");
    return result.status === 400 && gone ? "gone" : "failed";
}

async function editMessage(chatId: string | number, messageId: number, text: string, token: string, allowMigrationRetry: boolean): Promise<TelegramResult<void>> {
    log.debug(`Editing message ${messageId} in chat ${chatId}`);
    const url = `https://api.telegram.org/bot${token}/editMessageText`;
    try {
        const res = await reliableFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                text: text,
                parse_mode: 'HTML'
            })
        });

        if (!res.ok) {
            const err = parseErrorBody(res.status, await res.text());
            // Intent: Re-rendering an unchanged dashboard is a success, not a reason to repost it.
            if (err.description.includes("message is not modified")) return { ok: true, value: undefined };
            if (allowMigrationRetry && err.migrateToChatId !== null) {
                await adoptMigratedChat(chatId, err.migrateToChatId);
                return editMessage(err.migrateToChatId, messageId, text, token, false);
            }
            log.error("API Error (editMessageText)", { status: res.status, error: err.description });
            return failure(err.description, res.status);
        }
        log.debug(`Message ${messageId} edited successfully.`);
        return { ok: true, value: undefined };
    } catch (e) {
        log.error("Failed to edit message", e as Error);
        return failure(errorMessage(e), 0);
    }
}

/**
 * @function deleteMessage
 * @description Programmatically deletes a message.
 * Used for house-keeping, e.g., removing old alerts or superseded dashboard messages.
 *
 * @param {string | number} chatId - Target Chat ID.
 * @param {number} messageId - Message to delete.
 * @param {string} token - Bot Token.
 * @returns {Promise<boolean>} Success status.
 */
export async function deleteMessage(chatId: string | number, messageId: number, token: string) {
    log.debug(`Deleting message ${messageId} in chat ${chatId}`);
    const url = `https://api.telegram.org/bot${token}/deleteMessage`;
    try {
        const res = await reliableFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId
            })
        });

        if (!res.ok) {
            const err = await res.text();
            log.warn("API Error (deleteMessage)", { error: err });
            return false;
        }

        log.debug(`Message ${messageId} deleted successfully.`);
        return true;
    } catch (e) {
        log.error("Failed to delete message", e as Error);
        return false;
    }
}

/**
 * @function getBotUsername
 * @description Retrieves the Bot's username from the API.
 * Uses 'next.revalidate' to cache the result for 1 hour, reducing API load.
 * Without a token (Telegram not configured) it returns null without contacting
 * Telegram, so self-hosted installs make no outbound request.
 *
 * @param {string | null | undefined} token - Bot Token.
 * @returns {Promise<string | null>} The username (without @), or null.
 */
export async function getBotUsername(token: string | null | undefined): Promise<string | null> {
    if (!token) return null;
    const url = `https://api.telegram.org/bot${token}/getMe`;
    try {
        const res = await reliableFetch(url, {
            method: 'GET',
            next: { revalidate: 3600 } // Intent: Cache for 1 hour as username rarely changes.
        });

        if (!res.ok) {
            log.error("Failed to fetch bot info", { status: res.status });
            return null;
        }

        const data = await res.json();
        return data.result?.username || null;
    } catch (e) {
        log.error("Error fetching bot info", e as Error);
        return null;
    }
}

/**
 * @function getWebhookSecret
 * @description Shared secret used to authenticate incoming webhook requests.
 *
 * Telegram echoes the value registered via setWebhook back on every update in the
 * X-Telegram-Bot-Api-Secret-Token header, which is the only thing distinguishing a
 * real update from anyone POSTing to the public endpoint.
 *
 * Derived from the bot token rather than stored in its own env var: the sender and
 * the verifier are the same deployment, so a derived value can never fall out of
 * sync, and rotating the bot token rotates the secret automatically.
 *
 * @param {string} token - Bot Token.
 * @returns {string} 64 hex chars (Telegram allows 1-256 of A-Z a-z 0-9 _ -).
 */
export function getWebhookSecret(token: string): string {
    return createHash("sha256").update(`tabletop-webhook:${token}`).digest("hex");
}

/**
 * @function webhookUrlFor
 * @description The URL this deployment registers with Telegram.
 *
 * Telegram's getWebhookInfo never returns the secret_token, so a changed secret (a rotated
 * bot token) is undetectable from the registration alone. A short fingerprint of the
 * secret rides along as a query parameter instead: if the secret changes, the URL changes,
 * and the startup comparison re-registers. The fingerprint is a hash of the secret, so it
 * reveals nothing usable; the route ignores the parameter.
 */
export function webhookUrlFor(domain: string, token: string): string {
    const fingerprint = createHash("sha256").update(getWebhookSecret(token)).digest("hex").slice(0, 12);
    return `${domain.replace(/\/+$/, "")}/api/telegram/webhook?v=${fingerprint}`;
}

/**
 * @function getWebhookInfo
 * @description Reads the current webhook registration. Null when the call fails.
 */
export async function getWebhookInfo(token: string): Promise<{ url: string } | null> {
    try {
        const res = await reliableFetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
        const data = await res.json();
        if (!res.ok || !data.ok) {
            log.warn("Failed to read webhook info", { error: data.description });
            return null;
        }
        return { url: typeof data.result?.url === "string" ? data.result.url : "" };
    } catch (e) {
        log.error("Error reading webhook info", e as Error);
        return null;
    }
}

/**
 * @function syncWebhook
 * @description Startup path: registers the webhook only when Telegram's registration
 * differs from this deployment's URL (which encodes the secret fingerprint), so a cold
 * start costs one read instead of a write.
 *
 * @returns {Promise<boolean>} True when the registration is (now) correct.
 */
export async function syncWebhook(domain: string, token: string): Promise<boolean> {
    const desired = webhookUrlFor(domain, token);
    const current = await getWebhookInfo(token);
    if (current?.url === desired) {
        log.debug("Telegram webhook already registered");
        return true;
    }
    return ensureWebhook(domain, token);
}

/**
 * @function ensureWebhook
 * @description Unconditionally registers this deployment's webhook URL and secret.
 *
 * @param {string} domain - The public domain of the Next.js app.
 * @param {string} token - Bot Token.
 * @returns {Promise<boolean>} Success status.
 */
export async function ensureWebhook(domain: string, token: string) {
    const webhookUrl = webhookUrlFor(domain, token);
    log.info(`Setting Webhook to: ${webhookUrl}`);

    try {
        // secret_token: Telegram returns this on every update so the handler can reject
        // forged POSTs to the public webhook endpoint.
        const res = await reliableFetch(`https://api.telegram.org/bot${token}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl, secret_token: getWebhookSecret(token) }),
        });
        const data = await res.json();

        if (!res.ok || !data.ok) {
            log.error("Failed to set webhook", { error: data.description });
            return false;
        }

        log.info("✅ Webhook set successfully.");
        return true;
    } catch (e) {
        log.error("Error setting webhook", e as Error);
        return false;
    }
}
