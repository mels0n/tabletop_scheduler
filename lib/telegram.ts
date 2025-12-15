import Logger from "@/lib/logger";

const log = Logger.get("Telegram");

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
export async function sendTelegramMessage(chatId: string | number, text: string, token: string) {
    if (!token) {
        log.error("Token is missing");
        return null;
    }
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    log.debug(`Sending message to ${chatId}`, { textSnippet: text.substring(0, 50) });

    try {
        const res = await fetch(url, {
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
        const res = await fetch(url, {
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
        const res = await fetch(url, {
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
                    await sendTelegramMessage(chatId, "⚠️ I tried to pin the message above, but I don't have permission. Please promote me to **Admin** with 'Pin Messages' rights!", token);
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
 */
export async function editMessageText(chatId: string | number, messageId: number, text: string, token: string) {
    log.debug(`Editing message ${messageId} in chat ${chatId}`);
    const url = `https://api.telegram.org/bot${token}/editMessageText`;
    try {
        const res = await fetch(url, {
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
            log.error("API Error (editMessageText)", { error: err });
        } else {
            log.debug(`Message ${messageId} edited successfully.`);
        }
    } catch (e) {
        log.error("Failed to edit message", e as Error);
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
        const res = await fetch(url, {
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
        const res = await fetch(url, {
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
 * @function deleteWebhook
 * @description Removes the configured Webhook.
 * Necessary when switching from Hosted (Webhook) to Local (Long Polling) development.
 *
 * @param {string} token - Bot Token.
 * @returns {Promise<boolean>} Success status.
 */
export async function deleteWebhook(token: string) {
    const url = `https://api.telegram.org/bot${token}/deleteWebhook`;
    try {
        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok || !data.ok) {
            log.warn("Failed to delete webhook", { error: data.description });
            return false;
        }

        log.info("Webhook deleted successfully.");
        return true;
    } catch (e) {
        log.error("Error deleting webhook", e as Error);
        return false;
    }
}

/**
 * @function ensureWebhook
 * @description Configures the Bot to send updates to this application's API endpoint.
 * Run during startup in hosted environments.
 *
 * @param {string} domain - The public domain of the Next.js app.
 * @param {string} token - Bot Token.
 * @returns {Promise<boolean>} Success status.
 */
export async function ensureWebhook(domain: string, token: string) {
    const webhookUrl = `${domain}/api/telegram/webhook`;
    const url = `https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`;

    log.info(`Setting Webhook to: ${webhookUrl}`);

    try {
        const res = await fetch(url);
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
