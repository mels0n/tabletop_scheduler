import { createHash } from "crypto";
import Logger from "@/shared/lib/logger";
import { reliableFetch } from "@/shared/lib/fetch";
import type { EditResult } from "@/shared/lib/edit-result";

const log = Logger.get("Telegram");

/**
 * When a basic group is upgraded to a supergroup, Telegram rejects sends to the old id
 * with `parameters.migrate_to_chat_id`. Returns the new id from an error body, or null.
 */
function migratedChatId(errorBody: string): number | null {
    try {
        const id = JSON.parse(errorBody)?.parameters?.migrate_to_chat_id;
        return typeof id === "number" ? id : null;
    } catch {
        return null;
    }
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

/**
 * @function sendTelegramMessage
 * @description Sends a rich text message to a specific Telegram Chat ID.
 * Defaults to 'HTML' parse mode to support bold/italic/links.
 *
 * @param {string | number} chatId - The target Telegram chat or user ID.
 * @param {string} text - Message content (HTML tags supported).
 * @param {string} token - The Bot API Token.
 * @returns {Promise<number | null>} The sent Message ID, or null if failed.
 */
export async function sendTelegramMessage(chatId: string | number, text: string, token: string): Promise<number | null> {
    return postMessage(chatId, text, token, true);
}

async function postMessage(chatId: string | number, text: string, token: string, allowMigrationRetry: boolean): Promise<number | null> {
    if (!token) {
        log.error("Token is missing");
        return null;
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
                parse_mode: 'HTML'
            })
        });

        if (!res.ok) {
            const err = await res.text();
            const newChatId = allowMigrationRetry ? migratedChatId(err) : null;
            if (newChatId !== null) {
                await adoptMigratedChat(chatId, newChatId);
                return postMessage(newChatId, text, token, false);
            }
            log.error("API Error (sendMessage)", { error: err });
            return null;
        }

        const data = await res.json();
        log.debug(`Message sent successfully. ID: ${data.result?.message_id}`);
        return data.result?.message_id;
    } catch (e) {
        log.error("Failed to send message", e as Error);
        return null;
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
 * @function pinChatMessage
 * @description Pins a message to the top of the chat for high visibility.
 * Error Handling: Specifically checks for "not enough rights" to inform the user.
 *
 * @param {string | number} chatId - Target Chat ID.
 * @param {number} messageId - Message to pin.
 * @param {string} token - Bot Token.
 */
export async function pinChatMessage(chatId: string | number, messageId: number, token: string) {
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
            const err = await res.text();
            log.error("API Error (pinChatMessage)", { error: err });

            // Intent: Handle "not enough rights" error specifically to improve UX.
            // If the bot can't pin, it alerts the chat to fix permissions.
            try {
                const jsonErr = JSON.parse(err);
                if (jsonErr.error_code === 400 && jsonErr.description?.includes("not enough rights")) {
                    await sendTelegramMessage(chatId, "⚠️ I tried to pin the message above, but I don't have permission. Please promote me to <b>Admin</b> with <b>Pin Messages</b> rights!", token);
                }
            } catch (parseErr) {
                // ignore parsing error
            }
            return;
        }

        log.info(`Message ${messageId} pinned successfully.`);
    } catch (e) {
        log.error("Failed to pin message", e as Error);
    }
}

/**
 * @function editMessageText
 * @description Modifies the content of an existing message.
 * Crucial for the "Real-Time Dashboard" effect where the status message updates in-place.
 *
 * @param {string | number} chatId - Target Chat ID.
 * @param {number} messageId - Message to edit.
 * @param {string} text - New content.
 * @param {string} token - Bot Token.
 * @returns {Promise<EditResult>} 'edited' when the message shows `text` (including "message is
 * not modified"); 'gone' on 400 "message to edit not found" / "message can't be edited";
 * 'failed' for anything else (rate limit, 5xx, timeout), where the caller must not repost.
 */
export async function editMessageText(chatId: string | number, messageId: number, text: string, token: string): Promise<EditResult> {
    return editMessage(chatId, messageId, text, token, true);
}

async function editMessage(chatId: string | number, messageId: number, text: string, token: string, allowMigrationRetry: boolean): Promise<EditResult> {
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
            const err = await res.text();
            // Intent: Re-rendering an unchanged dashboard is a success, not a reason to repost it.
            if (err.includes("message is not modified")) return "edited";
            if (res.status === 400 && (err.includes("message to edit not found") || err.includes("message can't be edited"))) return "gone";
            // Group upgraded to a supergroup: record the new id and retry once there. Message
            // ids do not carry over, so the retry usually fails and the caller reposts, now
            // into the right chat.
            const newChatId = allowMigrationRetry ? migratedChatId(err) : null;
            if (newChatId !== null) {
                await adoptMigratedChat(chatId, newChatId);
                return editMessage(newChatId, messageId, text, token, false);
            }
            log.error("API Error (editMessageText)", { error: err });
            return "failed";
        }
        log.debug(`Message ${messageId} edited successfully.`);
        return "edited";
    } catch (e) {
        log.error("Failed to edit message", e as Error);
        return "failed";
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
 *
 * @param {string} token - Bot Token.
 * @returns {Promise<string | null>} The username (without @), or null.
 */
export async function getBotUsername(token: string): Promise<string | null> {
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
