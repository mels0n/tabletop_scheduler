import { NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import { sendTelegramMessage } from "@/features/telegram/lib/telegram-client";
import Logger from "@/shared/lib/logger";

const log = Logger.get("API:Webhook");

/**
 * @function POST
 * @description Central Handler for Telegram Webhook updates.
 *
 * Responsibilities:
 * 1. Command Parsing: Handles `/start`, `/connect`, and automatic link detection (`/e/[slug]`).
 * 2. Identity Management:
 *    - Automatically links "Participating" Telegram users to their DB Participant records (Passive Capture).
 *    - Automatically links "Event Managers" to their Event records (Passive Capture).
 * 3. Recovery: Handles Magic Link callbacks (`setup_recovery_...`) to regain access to an event.
 * 4. Login: Handles "Global Login" requests (`/start login`).
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

    try {
        const update = await req.json();

        if (update.message && update.message.text) {
            const text = update.message.text as string;
            const chatId = update.message.chat.id;

            log.debug("Received webhook message", { chatId, text: text.substring(0, 20) + "..." });

            // 1. Explicit Command: /connect [slug]
            if (text.startsWith("/connect")) {
                const parts = text.split(" ");
                if (parts.length < 2) {
                    await sendTelegramMessage(chatId, "Please provide the Event Slug. Usage: `/connect [slug]`", token);
                    return NextResponse.json({ ok: true });
                }
                const slug = parts[1].trim();
                await connectEvent(slug, chatId, update.message.from, token);
            }
            // 2. Auto-Detect Link: https://.../e/[slug]
            // Intent: Allow users to paste the event URL into the chat to connect it.
            else if (text.includes("/e/")) {
                // Extracts slug from standard URL format.
                // Works with any domain (localhost, tunnel, production).
                const match = text.match(/\/e\/([a-zA-Z0-9]+)/);
                if (match && match[1]) {
                    const slug = match[1];
                    await connectEvent(slug, chatId, update.message.from, token);
                }
            }
            // 3. Start Payload Handling (Deep Links)
            else if (text.startsWith("/start")) {
                const parts = text.split(" ");
                // Sub-payload: /start setup_recovery_[slug]_[token]
                if (parts.length > 1 && parts[1].startsWith("setup_recovery_")) {
                    const payload = parts[1].replace("setup_recovery_", "");

                    // Format: slug_token
                    const lastUnderscoreIndex = payload.lastIndexOf('_');
                    if (lastUnderscoreIndex === -1) {
                        await sendTelegramMessage(chatId, "⚠️ Invalid Link format.", token);
                        return NextResponse.json({ ok: true });
                    }

                    const slug = payload.substring(0, lastUnderscoreIndex);
                    const recoveryToken = payload.substring(lastUnderscoreIndex + 1);

                    await handleRecoverySetup(chatId, update.message.from, slug, recoveryToken, token);
                } else if (parts.length > 1 && parts[1].startsWith("rec_")) {
                    // Short Recovery Link (rec_TOKEN)
                    const recToken = parts[1].replace("rec_", "");
                    await handleShortLinkRecovery(chatId, update.message.from, recToken, token);
                } else if (parts.length > 1 && (parts[1] === "login" || parts[1] === "recover_handle")) {
                    // Global Login Flow
                    await handleGlobalLogin(chatId, update.message.from, token);
                } else {
                    // Check for generic slug payload (from ?startgroup=slug)
                    // Intent: Support "Add to Group" button from the web UI.
                    if (parts.length > 1 && parts[1]) {
                        const potentialSlug = parts[1].trim();
                        // Validation: slug is alphanumeric
                        if (/^[a-zA-Z0-9]+$/.test(potentialSlug)) {
                            await connectEvent(potentialSlug, chatId, update.message.from, token);
                        }
                    }

                    // Silent fail for non-recognized start commands to avoid spam
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
 * @function handleRecoverySetup
 * @description Handles the "Establish Manager Link" flow via a signed token.
 */
async function handleRecoverySetup(chatId: number, user: any, slug: string, recoveryToken: string, token: string) {
    // Verify Security Token
    const { verifyRecoveryToken } = await import("@/features/auth/model/token");
    if (!verifyRecoveryToken(slug, recoveryToken)) {
        await sendTelegramMessage(chatId, "⚠️ <b>Link Expired or Invalid</b>\n\nPlease go back to the Manage page and click the button again.", token);
        return;
    }

    const event = await prisma.event.findUnique({ where: { slug } });

    if (!event) {
        await sendTelegramMessage(chatId, "⚠️ Event not found.", token);
        return;
    }

    const senderUsername = user.username?.toLowerCase();
    if (!senderUsername) {
        await sendTelegramMessage(chatId, "⚠️ Could not verify identity. Please ensure you have a Telegram username set.", token);
        return;
    }

    const managerHandle = event.managerTelegram?.toLowerCase().replace('@', '');
    let updateData: any = { managerChatId: user.id.toString() };
    let claimMessage = "";

    // 1. If NO manager is set, this user CLAIMS it.
    if (!managerHandle) {
        updateData.managerTelegram = senderUsername;
        claimMessage = `\n\n👮 <b>Manager Set:</b> @${senderUsername}`;
        log.info("Manager claimed event via recovery", { slug, manager: senderUsername });
    }
    // 2. If manager IS set, verify identity
    else {
        if (senderUsername !== managerHandle) {
            // Security: Don't link if handles mismatch
            await sendTelegramMessage(chatId, `⚠️ <b>Identity Mismatch</b>\n\nYou are @${senderUsername}, but this event is managed by @${managerHandle}.`, token);
            return;
        }
    }

    // Link matches!
    await prisma.event.update({
        where: { id: event.id },
        data: updateData
    });

    log.info("Manager recovery linked successfully", { slug, manager: senderUsername, chatId: user.id });

    // Send success
    await sendTelegramMessage(chatId, `✅ <b>Recovery Setup Complete!</b>\n\nI've verified you as the manager of <b>${event.title}</b>.${claimMessage}\n\nThe event page on your device should update in a few seconds.`, token);
}

/**
 * @function handleGlobalLogin
 * @description Generates a Magic Login Link valid for 15 minutes.
 */
async function handleGlobalLogin(chatId: number, user: any, token: string) {
    const { getBaseUrl } = await import("@/shared/lib/url");
    const { headers } = await import("next/headers");
    const { hashToken } = await import("@/shared/lib/token");
    const { v4: uuidv4 } = await import("uuid");

    // 1. Create Login Token (Generate Plaintext -> Hash -> Store)
    const plaintextToken = uuidv4();
    const tokenHash = hashToken(plaintextToken);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 min expiry

    // Store HASH in DB
    await prisma.loginToken.create({
        data: {
            token: tokenHash,
            chatId: chatId.toString(),
            expiresAt
        }
    });

    const baseUrl = getBaseUrl(headers());
    // Send PLAINTEXT in Link
    const magicLink = `${baseUrl}/auth/login?token=${plaintextToken}`;

    await sendTelegramMessage(chatId, `🔐 <b>Magic Login</b>\n\nClick here to access <b>My Events</b>:\n${magicLink}\n\n(Valid for 15 minutes)`, token);
}

/**
 * @function connectEvent
 * @description Links a Telegram Group (or DM) to an Event (`telegramChatId`).
 * Also initiates the "Manager Capture" logic if the command sender looks like the declared manager.
 */
async function connectEvent(slug: string, chatId: number, user: any, token: string) {
    const event = await prisma.event.findUnique({ where: { slug } });

    if (!event) {
        log.warn("Connect failed: Event not found", { slug });
        return;
    }

    // Auto-Capture Manager Logic
    const senderUsername = user?.username;
    const senderId = user?.id?.toString();

    log.debug("Checking Manager Link for Connect", {
        slug,
        sender: senderUsername,
        senderId,
        currentManager: event.managerTelegram,
        isManagerMatch: event.managerTelegram?.toLowerCase().replace('@', '') === senderUsername?.toLowerCase()
    });

    let updateData: any = { telegramChatId: chatId.toString() };
    let capturedMsg = "";

    // 1. If no manager is set yet, assume the person connecting the bot is the manager.
    if (!event.managerTelegram && senderUsername) {
        updateData.managerTelegram = senderUsername;
        if (senderId) {
            updateData.managerChatId = senderId;
        }
        capturedMsg = `\n\n👮 <b>Manager Set:</b> @${senderUsername}`;
        log.info("Manager claimed event via connect", { slug, manager: senderUsername, chatId: senderId });
    }
    // 2. If the sender IS the manager, update their Chat ID (Repair/Link DM)
    else if (event.managerTelegram && senderUsername &&
        event.managerTelegram.toLowerCase().replace('@', '') === senderUsername.toLowerCase()) {
        if (senderId) {
            updateData.managerChatId = senderId;
            capturedMsg = `\n\n✅ <b>Manager Verified</b>`;
            log.info("Manager verified via connect", { slug, manager: senderUsername, chatId: senderId });
        }
    } else {
        log.info("Connect only (No manager link)", { slug, sender: senderUsername });
    }

    // Connect
    await prisma.event.update({
        where: { id: event.id },
        data: updateData
    });

    log.info("Connected chat to event", { chatId, slug, updates: updateData });

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
        const { headers } = await import("next/headers");

        if (fullEvent) {
            const baseUrl = getBaseUrl(headers());
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
    let updateData: any = { managerChatId: user.id.toString() };
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
