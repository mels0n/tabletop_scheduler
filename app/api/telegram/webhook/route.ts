import { NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import { sendTelegramMessage, getWebhookSecret } from "@/features/telegram/lib/telegram-client";
import Logger from "@/shared/lib/logger";
import { normalizeHandle } from "@/shared/lib/handle";
import {
    CONNECT_CODE_INVALID,
    CONNECT_INSTRUCTIONS,
    parseConnectCommand,
    verifyConnectCode,
} from "@/features/telegram/model/connect-code";

const log = Logger.get("API:Webhook");

/**
 * @function POST
 * @description Central Handler for Telegram Webhook updates.
 *
 * Responsibilities:
 * 0. Authentication: rejects any POST not carrying the secret token registered
 *    with setWebhook. This URL is public and every command below has side effects.
 * 1. Command Parsing: Handles `/start` and `/connect <slug> <code>` (the code is shown on
 *    the manage page; a bare slug or a pasted event link only gets instructions back).
 * 2. Identity Management:
 *    - Automatically links "Participating" Telegram users to their DB Participant records (Passive Capture).
 *    - Automatically links "Event Managers" to their Event records (Passive Capture).
 * 3. Recovery: Handles short recovery tokens (`/start rec_...`) minted for the event admin.
 * 4. Login: Handles "Global Login" requests (`/start login`, and any bare `/start`
 *    in a private chat, since clients sometimes drop the deep-link payload).
 *
 * Pattern: One Webhook to Rule Them All.
 * Instead of separate endpoints, all bot traffic flows here and is routed by message content.
 *
 * @param {Request} req - The incoming webhook payload from Telegram.
 * @returns {NextResponse} 200 OK (Always return OK to stop Telegram from retrying).
 */
export async function POST(req: Request) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        log.error("Config Error: TELEGRAM_BOT_TOKEN missing");
        return NextResponse.json({ error: "Config Error" }, { status: 500 });
    }

    // Authenticate the update. This endpoint is a public URL, and every command it
    // handles has side effects (linking a chat to an event, issuing a magic login
    // link), so an unauthenticated POST is a real attack surface. Telegram echoes the
    // secret registered by ensureWebhook on every genuine update.
    //
    // Transition note: immediately after a deploy that introduces or changes this
    // secret, the in-flight update arrives without the header and is rejected. The
    // instrumentation hook re-registers the webhook on server start, so Telegram's
    // next retry carries the header and delivery resumes on its own.
    if (req.headers.get("x-telegram-bot-api-secret-token") !== getWebhookSecret(token)) {
        log.warn("Rejected webhook update: missing or invalid secret token");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const update = await req.json();

        if (update.message && update.message.text) {
            const text = update.message.text as string;
            const chatId = update.message.chat.id;

            log.debug("Received webhook message", { chatId, text: text.substring(0, 20) + "..." });

            // 1. Explicit Command: /connect <slug> <code>
            // The code comes from the manage page, so only the event admin can bind a chat.
            if (text.startsWith("/connect")) {
                const { slug, code } = parseConnectCommand(text);
                await connectEvent(slug, code, chatId, token);
            }
            // 2. A pasted event link no longer binds anything (every invited player has the
            // link). Point the sender at the connect command instead.
            else if (/\/e\/[a-zA-Z0-9]+/.test(text)) {
                await sendTelegramMessage(chatId, CONNECT_INSTRUCTIONS, token);
            }
            // 3. Start Payload Handling (Deep Links)
            else if (text.startsWith("/start")) {
                const parts = text.split(" ");
                if (parts.length > 1 && parts[1].startsWith("rec_")) {
                    // Short Recovery Link (rec_TOKEN), minted only for the event admin.
                    const recToken = parts[1].replace("rec_", "");
                    await handleShortLinkRecovery(chatId, update.message.from, recToken, token);
                } else if (parts.length > 1 && (parts[1] === "login" || parts[1] === "recover_handle")) {
                    // Global Login Flow
                    await handleGlobalLogin(chatId, update.message.from, token);
                } else {
                    // Generic slug payload (from ?startgroup=slug): the "Add to Group"
                    // button in the web UI. Adding the bot does not bind the chat; the
                    // admin sends the connect command from the manage page.
                    const potentialSlug = parts.length > 1 ? parts[1].trim() : "";

                    if (potentialSlug && /^[a-zA-Z0-9]+$/.test(potentialSlug)) {
                        await sendTelegramMessage(chatId, CONNECT_INSTRUCTIONS, token);
                    } else if (update.message.chat?.type === "private") {
                        // Bare or unrecognized /start in a DM: either the user found the
                        // bot directly and pressed START, or the client dropped the
                        // deep-link payload (Telegram Desktop does this when the chat is
                        // already open, which is how ?start=login silently did nothing).
                        // Silence is indistinguishable from a broken bot, so treat any
                        // bare /start in a private chat as a login request.
                        await handleGlobalLogin(chatId, update.message.from, token);
                    }

                    // Groups stay silent: a bare /start there is usually meant for
                    // another bot, and answering would be spam.
                }
            }

            // PASSIVE CAPTURE: Always try to capture/update Participant Chat ID
            // Intent: If a user talks to the bot, we grab their ID to allow future private notifications.
            if (update.message.from?.username) {
                await captureParticipantIdentity(chatId, update.message.from);
                await captureManagerIdentity(chatId, update.message.from);
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        log.error("Telegram Webhook Error", error as Error);
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}

/**
 * @function captureManagerIdentity
 * @description Passively updates Manager records with their Telegram Chat ID if matched by username.
 */
async function captureManagerIdentity(chatId: number, user: any) {
    const username = user.username;
    // CRITICAL: Use the User's ID for personal messaging, not the Group Chat ID
    const userId = user.id?.toString();

    if (!username || !userId) return;

    const handle = username.toLowerCase().replace('@', '');
    const formattedHandle = `@${handle}`;

    try {
        // Find events where this user is the manager but has NO chat ID yet
        const count = await prisma.event.updateMany({
            where: {
                managerTelegram: {
                    in: [handle, formattedHandle]
                },
                managerChatId: null
            },
            data: {
                managerChatId: userId
            }
        });

        if (count.count > 0) {
            log.info("Passively captured Manager Chat IDs", { handle, count: count.count, userId });
        }
    } catch (e) {
        log.error("Failed passive manager capture", e as Error);
    }
}

/**
 * @function captureParticipantIdentity
 * @description Passively updates Participant records with their Telegram Chat ID if matched by username.
 */
async function captureParticipantIdentity(chatId: number, user: any) {
    const username = user.username;
    // CRITICAL: Use the User's ID for personal messaging, not the Group Chat ID
    const userId = user.id?.toString();

    if (!userId) return;

    // Normalize handle: remove @, lowercase
    const handle = username ? username.toLowerCase().replace('@', '') : null;

    // Find all participants with this handle that MISS a chatId
    try {
        if (!handle) return;

        const formattedHandle = `@${handle}`;

        const count = await prisma.participant.updateMany({
            where: {
                OR: [
                    { telegramId: handle },
                    { telegramId: formattedHandle },
                ],
                chatId: null // Only update if missing
            },
            data: {
                chatId: userId
            }
        });

        if (count.count > 0) {
            log.info("Passively captured participant Chat IDs", { handle, count: count.count, userId });
        }
    } catch (e) {
        log.error("Failed passive capture", e as Error);
    }
}

/**
 * @function handleGlobalLogin
 * @description Generates a Magic Login Link valid for 15 minutes.
 */
async function handleGlobalLogin(chatId: number, user: any, token: string) {
    const { getBaseUrl } = await import("@/shared/lib/url");
    const { hashToken } = await import("@/shared/lib/token");

    // 1. Create Login Token (Generate Plaintext -> Hash -> Store)
    const plaintextToken = crypto.randomUUID();
    const tokenHash = hashToken(plaintextToken);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 min expiry

    // Store HASH in DB. Capture the Telegram username too (mirrors Discord's
    // discordUsername) so the login route can set a display cookie and the vote
    // form can show a Telegram identity badge instead of an empty handle field.
    const handle = normalizeHandle(user?.username);
    await prisma.loginToken.create({
        data: {
            token: tokenHash,
            chatId: chatId.toString(),
            telegramUsername: handle || null,
            expiresAt
        }
    });

    const baseUrl = getBaseUrl();
    // Send PLAINTEXT in Link
    const magicLink = `${baseUrl}/auth/login?token=${plaintextToken}`;

    await sendTelegramMessage(chatId, `🔐 <b>Magic Login</b>\n\nClick here to access <b>My Events</b>:\n${magicLink}\n\n(Valid for 15 minutes)`, token);
}


/**
 * @function connectEvent
 * @description Binds a Telegram chat to an event (`telegramChatId`) for `/connect <slug> <code>`.
 * The code is shown only on the manage page, so knowing the slug is not enough. Binding a
 * chat never sets or changes the event's manager identity.
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

    log.info("Connected chat to event", { chatId, slug });

    // Pinned Dashboard Logic (Poller Parity)
    try {
        const fullEvent = await prisma.event.findUnique({
            where: { id: event.id },
            include: { timeSlots: { include: { votes: true } } }
        });
        const participants = await prisma.participant.count({ where: { eventId: event.id } });
        const { generateStatusMessage } = await import("@/shared/lib/status");
        const { pinChatMessage } = await import("@/features/telegram/lib/telegram-client");
        const { getBaseUrl } = await import("@/shared/lib/url");

        if (fullEvent) {
            const baseUrl = getBaseUrl();
            const statusMsg = generateStatusMessage(fullEvent, participants, baseUrl);

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
 * @function handleShortLinkRecovery
 * @description Handles the "Short Link" (rec_TOKEN) recovery flow for when deep links are truncated or fail.
 */
async function handleShortLinkRecovery(chatId: number, user: any, recoveryToken: string, botToken: string) {
    const { hashToken } = await import("@/shared/lib/token");

    // 1. Hash the incoming token to match DB
    const tokenHash = hashToken(recoveryToken);

    // 2. Find event by HASHED token
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

    // 3. Clear the token (security: one-time use)
    await prisma.event.update({
        where: { id: event.id },
        data: { recoveryToken: null, recoveryTokenExpires: null }
    });

    // 4. User Identity Logic
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
