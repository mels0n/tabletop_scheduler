import { sendTelegramMessage, deleteWebhook } from "./telegram-client";
import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { TelegramUpdate } from "../model/types";
import {
    CONNECT_CODE_INVALID,
    CONNECT_INSTRUCTIONS,
    parseConnectCommand,
    verifyConnectCode,
} from "../model/connect-code";

const log = Logger.get("TelegramService");

// Intent: State tracking for singleton polling instance
let isPolling = false;
let lastUpdateId = 0;

/**
 * Initiates the Telegram Long Polling loop.
 * Only one instance should run to avoid race conditions.
 *
 * @returns {Promise<void>}
 */
export async function startPolling() {
    if (isPolling) {
        log.warn("Polling already started.");
        return;
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        log.warn("Token not found. Polling skipped.");
        return;
    }

    isPolling = true;
    log.info("🚀 Starting Telegram Long Polling...");

    // Intent: Start recursive polling loop
    poll(token);

    // Intent: Double-invoke to handle potential network stalls? (Legacy behavior maintained)
    poll(token);
}

/**
 * Core polling loop that fetches updates from Telegram.
 * Handles 409 Conflicts (Webhook Active) by auto-cleaning webhooks.
 *
 * @param {string} token - The Telegram Bot Token.
 */
async function poll(token: string) {
    if (!isPolling) return;

    try {
        const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
        const res = await fetch(url);

        if (!res.ok) {
            // Intent: Handle 409 Conflict which indicates either another poller is active or a webhook is set.
            if (res.status === 409) {
                const errData = await res.json();
                const description = errData.description || "";

                if (description.includes("terminated by other getUpdates request")) {
                    log.warn("Conflict: Keep-alive terminated by another instance. Retrying...");
                    // Intent: Random backoff to desynchronize instances
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
                    poll(token);
                    return;
                }

                if (description.includes("webhook is active")) {
                    log.warn("Webhook conflict detected. Deleting Webhook to enable Polling...");

                    await deleteWebhook(token);

                    // Intent: Wait for propagation
                    await new Promise(resolve => setTimeout(resolve, 5000));

                    // Retry
                    poll(token);
                    return;
                }

                log.warn(`Unknown 409 Conflict: ${description}`);
            }
            throw new Error(`Telegram API Error: ${res.statusText}`);
        }

        const data = await res.json();

        if (data.ok && data.result.length > 0) {
            for (const update of (data.result as TelegramUpdate[])) {
                lastUpdateId = Math.max(lastUpdateId, update.update_id);
                await processUpdate(update, token);
            }
        }
    } catch (error) {
        log.error("Polling Error (Retrying in 5s)", error as Error);
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Intent: Continue polling immediately
    poll(token);
}

/**
 * Processes a single Telegram Update (Message).
 * Contains command routing logic.
 *
 * @param {TelegramUpdate} update - The update object.
 * @param {string} token - The bot token.
 */
async function processUpdate(update: TelegramUpdate, token: string) {
    if (!update.message || !update.message.text) return;

    const text = update.message.text as string;
    const chatId = update.message.chat.id;
    const user = update.message.from;
    const username = user?.username;

    // Intent: Passively capture user identity mappings (username -> chatId) whenever they speak.
    if (username) {
        await captureParticipantIdentity(chatId, user);
        await captureManagerIdentity(chatId, user);
    }

    log.debug(`Received message`, { text, chatId, userId: user?.id, username });

    try {
        // 1. Explicit Command: /connect <slug> <code>
        // The code comes from the manage page, so only the event admin can bind a chat.
        if (text.startsWith("/connect")) {
            const { slug, code } = parseConnectCommand(text);
            await connectEvent(slug, code, chatId, token);
        }
        // 2. Start Command (with Payloads)
        else if (text.startsWith("/start")) {
            const parts = text.split(" ");

            // Short Token Recovery, minted only for the event admin
            if (parts.length > 1 && parts[1].startsWith("rec_")) {
                const recToken = parts[1].replace("rec_", "");
                await handleShortLinkRecovery(chatId, user, recToken, token);
                return;
            }
            // Paint: login or recover_handle
            else if (parts.length > 1 && (parts[1] === "login" || parts[1] === "recover_handle")) {
                await handleGlobalLogin(chatId, user, token);
                return;
            }
            // Standard /start (Welcome) or Generic Payload (Event Slug)
            else {
                // A slug payload (from ?startgroup=slug) does not bind the chat; the admin
                // sends the connect command from the manage page.
                if (parts.length > 1 && /^[a-zA-Z0-9]+$/.test(parts[1].trim())) {
                    await sendTelegramMessage(chatId, CONNECT_INSTRUCTIONS, token);
                    return;
                }

                // Intent: Silent fail/no-op for plain /start to avoid spam
                return;
            }
        }
        // 3. A pasted event link no longer binds anything (every invited player has the
        // link). Point the sender at the connect command instead.
        else if (/\/e\/[a-zA-Z0-9]+/.test(text)) {
            await sendTelegramMessage(chatId, CONNECT_INSTRUCTIONS, token);
        }
    } catch (err) {
        log.error("Error processing update", err as Error);
    }
}

// --- LOGIC FUNCTIONS (Mirrored from route.ts) ---

/**
 * Attempts to link a Telegram User ID to an Event Manager based on Username match.
 */
async function captureManagerIdentity(chatId: number, user: any) {
    const username = user?.username;
    const userId = user?.id?.toString();

    if (!username || !userId) return;

    const handle = username.toLowerCase().replace('@', '');
    const formattedHandle = `@${handle}`;

    try {
        const count = await prisma.event.updateMany({
            where: {
                managerTelegram: { in: [handle, formattedHandle] },
                managerChatId: null
            },
            data: { managerChatId: userId }
        });

        if (count.count > 0) {
            log.info("Passively captured Manager Chat IDs", { handle, count: count.count });
        }
    } catch (e) {
        log.error("Failed passive manager capture", e as Error);
    }
}

/**
 * Attempts to link a Telegram User ID to a Participant based on Username match.
 */
async function captureParticipantIdentity(chatId: number, user: any) {
    const username = user?.username;
    const userId = user?.id?.toString();

    if (!userId) return;

    const handle = username ? username.toLowerCase().replace('@', '') : null;

    try {
        if (!handle) return;
        const formattedHandle = `@${handle}`;

        const count = await prisma.participant.updateMany({
            where: {
                OR: [{ telegramId: handle }, { telegramId: formattedHandle }],
                chatId: null
            },
            data: { chatId: userId }
        });

        if (count.count > 0) {
            log.info("Passively captured participant Chat IDs", { handle, count: count.count });
        }
    } catch (e) {
        log.error("Failed passive capture", e as Error);
    }
}
/**
 * Handles "Global Login" or "Recovery Handle" flow to send a magic link to the user.
 */
/**
 * Handles "Global Login" or "Recovery Handle" flow to send a magic link to the user.
 */
async function handleGlobalLogin(chatId: number, user: any, token: string) {
    const chatStr = chatId.toString();
    const { hashToken } = await import("@/shared/lib/token");

    // Intent: Check for existing valid token (reuse to prevent Link Preview race conditions)
    // Note: We can only reuse if we have the plaintext. But we only store the hash now.
    // So we CANNOT reuse efficiently without storing plaintext, which defeats the purpose.
    // However, for UX, if they spam the button, we should just invalidate the old one or make a new one.
    // Security takes precedence: We generate a new one.

    const plaintextToken = crypto.randomUUID();
    const tokenHash = hashToken(plaintextToken);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await prisma.loginToken.create({
        data: {
            token: tokenHash,
            chatId: chatStr,
            expiresAt
        }
    });

    // Use a fixed hardcoded fallback just in case getBaseUrl is getting weird in polling
    const { getBaseUrl } = await import("@/shared/lib/url");
    const baseUrl = getBaseUrl();
    const magicLink = `${baseUrl}/auth/login?token=${plaintextToken}`;

    await sendTelegramMessage(chatId, `🔐 <b>Magic Login</b>\n\nClick here to access <b>My Events</b>:\n${magicLink}\n\n(Valid for 15 minutes)`, token);
}

/**
 * Binds a chat to an event for `/connect <slug> <code>`. The code is shown only on the
 * manage page. Binding never sets or changes the event's manager identity.
 */
async function connectEvent(slug: string | null, code: string | null, chatId: number, token: string) {
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
        data: { telegramChatId: chatId.toString() }
    });

    // Pinned Dashboard
    try {
        const fullEvent = await prisma.event.findUnique({
            where: { id: event.id },
            include: { timeSlots: { include: { votes: true } } }
        });
        const participants = await prisma.participant.count({ where: { eventId: event.id } });
        const { generateStatusMessage } = await import("@/shared/lib/status");
        const { pinChatMessage } = await import("./telegram-client");
        const { getBaseUrl } = await import("@/shared/lib/url");

        if (fullEvent) {
            const baseUrl = getBaseUrl();
            const statusMsg = generateStatusMessage(fullEvent, participants, baseUrl);

            // Send Dashboard immediately (No "Connected!" message)
            const dashboardMsgId = await sendTelegramMessage(chatId, statusMsg, token);

            if (dashboardMsgId) {
                await pinChatMessage(chatId, dashboardMsgId, token);
                await prisma.event.update({
                    where: { id: event.id },
                    data: { pinnedMessageId: dashboardMsgId }
                });
            }
        }
    } catch (e) {
        log.error("Failed to initialize dashboard pin", e as Error);
    }
}

/**
 * Handles event management claiming via a short, 4-byte token (no login required flow).
 */
async function handleShortLinkRecovery(chatId: number, user: any, recoveryToken: string, botToken: string) {
    const { hashToken } = await import("@/shared/lib/token");
    const tokenHash = hashToken(recoveryToken);

    // 1. Find event by HASHED token
    const event = await prisma.event.findUnique({
        where: { recoveryToken: tokenHash },
    });

    if (!event) {
        await sendTelegramMessage(chatId, "⚠️ <b>Invalid Recovery Link</b>\n\nThis link is invalid or has expired.", botToken);
        return;
    }

    if (!event.recoveryTokenExpires || new Date() > event.recoveryTokenExpires) {
        await sendTelegramMessage(chatId, "⚠️ <b>Expired Link</b>\n\nThis recovery link has expired. Please refresh the Manage page to get a new one.", botToken);
        return;
    }

    // 2. Clear the token (security: one-time use)
    await prisma.event.update({
        where: { id: event.id },
        data: { recoveryToken: null, recoveryTokenExpires: null }
    });

    // 3. User Identity Logic
    const senderUsername = user.username?.toLowerCase();
    if (!senderUsername) {
        await sendTelegramMessage(chatId, "⚠️ Could not verify identity. Please ensure you have a Telegram username set.", botToken);
        return;
    }

    const managerHandle = event.managerTelegram?.toLowerCase().replace('@', '');
    const updateData: any = { managerChatId: user.id.toString() };
    let claimMessage = "";

    // If NO manager is set, this user CLAIMS it.
    if (!managerHandle) {
        updateData.managerTelegram = senderUsername;
        claimMessage = `\n\n👮 <b>Manager Set:</b> @${senderUsername}`;
        log.info("Manager claimed event via short-link recovery", { slug: event.slug, manager: senderUsername });
    }
    // If manager IS set, verify identity
    else {
        if (senderUsername !== managerHandle) {
            await sendTelegramMessage(chatId, `⚠️ <b>Identity Mismatch</b>\n\nYou are @${senderUsername}, but this event is managed by @${managerHandle}.`, botToken);
            return;
        }
    }

    // Link matches!
    await prisma.event.update({
        where: { id: event.id },
        data: updateData
    });

    log.info("Manager recovery linked successfully via short-link", { slug: event.slug, manager: senderUsername, chatId: user.id });

    // Send success
    await sendTelegramMessage(chatId, `✅ <b>Recovery Setup Complete!</b>\n\nI've verified you as the manager of <b>${event.title}</b>.${claimMessage}\n\nThe event page on your device should update in a few seconds.`, botToken);
}
