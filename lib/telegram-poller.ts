import { sendTelegramMessage } from "./telegram";
import prisma from "./prisma";
import Logger from "./logger";
import { getBaseUrl } from "./url";

const log = Logger.get("TelegramPoller");

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
 * Checks all active events for pending reminders.
 * Intended to be called via external cron (e.g., API route or start.sh) to support serverless architectures.
 *
 * @param {string} token - The Telegram Bot Token.
 */
export async function checkReminders(token: string) {
    // Intent: Find candidates: Active or Draft, Reminders Enabled, Not yet notified of Viable Quorum.
    const events = await prisma.event.findMany({
        where: {
            status: { in: ["ACTIVE", "DRAFT"] },
            reminderEnabled: true,
            quorumViableNotified: false
        }
    });

    const now = new Date();

    for (const event of events) {
        if (!event.telegramChatId || !event.reminderTime || !event.reminderDays) continue;

        try {
            // Intent: Calculate Timezone-aware "Current Time" to compare against "Reminder Time".
            const tz = event.timezone || "UTC";

            // Intent: Format current time in user's timezone for string comparison.
            const timeString = new Date().toLocaleTimeString('en-US', {
                timeZone: tz,
                hour12: false,
                hour: "2-digit",
                minute: "2-digit"
            });

            // Intent: Parse target reminder time (HH:MM) supporting both 24h and 12h (AM/PM) formats
            let [targetH, targetM] = event.reminderTime.split(':').map(part => parseInt(part.replace(/\D/g, '')));

            // Adjust for AM/PM if present
            if (event.reminderTime.toLowerCase().includes('pm') && targetH < 12) targetH += 12;
            if (event.reminderTime.toLowerCase().includes('am') && targetH === 12) targetH = 0;

            // Intent: Get Current Time in user's TZ broken down for minute-math
            const timeParts = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                hour: 'numeric',
                minute: 'numeric',
                hour12: false
            }).formatToParts(now);

            const currentH = parseInt(timeParts.find(p => p.type === 'hour')?.value || "0");
            const currentM = parseInt(timeParts.find(p => p.type === 'minute')?.value || "0");

            const currentTotalMinutes = currentH * 60 + currentM;
            const targetTotalMinutes = targetH * 60 + targetM;

            const diff = currentTotalMinutes - targetTotalMinutes;

            // Intent: Handle day wrapping logic if needed (currently simplified to same-day window)
            // if (diff < 0) { ... }

            // Intent: Validate strict execution window (0 to 90 minutes late).
            // This accommodates hourly cron jobs with potential delays.
            if (diff < 0 || diff > 90) {
                // Debug log to help diagnose missed reminders
                log.debug(`Skipping reminder for ${event.slug}`, {
                    reason: "Time window mismatch",
                    diff,
                    current: `${currentH}:${currentM}`,
                    target: `${targetH}:${targetM}`,
                    tz
                });
                continue;
            }

            // Intent: Prevent duplicate sends within the same "Logical Day".
            // If sent < 18 hours ago, assume it was for this cycle.
            if (event.lastReminderSent) {
                const msSinceLast = now.getTime() - event.lastReminderSent.getTime();
                if (msSinceLast < 18 * 60 * 60 * 1000) continue;
            }

            // Intent: Check if today is a configured reminder day.
            const dayString = new Date().toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' });
            // Map Mon, Tue... to 0-6. 0=Sun
            const dayMap: Record<string, number> = { "Sun": 0, "Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6 };
            const currentDay = dayMap[dayString];

            const targetDays = event.reminderDays.split(',').map(d => parseInt(d));
            if (!targetDays.includes(currentDay)) continue;

            // Intent: Send Reminder
            const { getBaseUrl } = await import("./url");
            const baseUrl = getBaseUrl(null);
            const link = `${baseUrl}/e/${event.slug}`;

            await sendTelegramMessage(
                event.telegramChatId,
                `🔔 <b>Reminder</b>\n\nPlease cast your votes for <b>${event.title}</b>!\n\n👉 <a href="${link}">Vote Here</a>`,
                token
            );

            // Intent: Update Last Sent State
            await prisma.event.update({
                where: { id: event.id },
                data: { lastReminderSent: now }
            });

            log.info("Reminder sent", { slug: event.slug, time: timeString });

        } catch (err) {
            log.error(`Failed to process reminder for ${event.slug}`, err as Error);
        }
    }
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

                    const { deleteWebhook } = await import("./telegram");
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

// Basic types for Telegram Update
interface TelegramUpdate {
    update_id: number;
    message?: {
        text?: string;
        chat: {
            id: number;
        };
        from?: {
            id: number;
            username?: string;
        };
    };
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
        // 1. Explicit Command: /connect [slug]
        if (text.startsWith("/connect")) {
            const parts = text.split(" ");
            if (parts.length < 2) {
                await sendTelegramMessage(chatId, "Please provide the Event Slug. Usage: `/connect [slug]`", token);
                return;
            }
            const slug = parts[1].trim();
            await connectEvent(slug, chatId, user, token);
        }
        // 2. Start Command (with Payloads)
        else if (text.startsWith("/start")) {
            const parts = text.split(" ");

            // Payload: setup_recovery_[slug]_[token]
            if (parts.length > 1 && parts[1].startsWith("setup_recovery_")) {
                const payload = parts[1].replace("setup_recovery_", "");

                // Format: slug_token
                const lastUnderscoreIndex = payload.lastIndexOf('_');
                if (lastUnderscoreIndex === -1) {
                    await sendTelegramMessage(chatId, "⚠️ Invalid Link format.", token);
                    return;
                }

                const slug = payload.substring(0, lastUnderscoreIndex);
                const recoveryToken = payload.substring(lastUnderscoreIndex + 1);

                await handleRecoverySetup(chatId, user, slug, recoveryToken, token);
                return;
            }
            // New Short Token Recovery
            else if (parts.length > 1 && parts[1].startsWith("rec_")) {
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
                if (parts.length > 1 && parts[1]) {
                    // Assume payload is a slug for connection (e.g. from ?startgroup=slug)
                    // Basic alphanumeric check to prevent weird injections, though prisma is safe
                    const potentialSlug = parts[1].trim();
                    if (/^[a-zA-Z0-9]+$/.test(potentialSlug)) {
                        await connectEvent(potentialSlug, chatId, user, token);
                        return;
                    }
                }

                // Intent: Silent fail/no-op for plain /start to avoid spam
                return;
            }
        }
        // 3. Auto-Detect Link: https://.../e/[slug]
        else if (text.includes("/e/")) {
            // Matches: (http://...)/e/(slug)
            const linkMatch = text.match(/(https?:\/\/[^\s]+)\/e\/([a-zA-Z0-9]+)/);
            if (linkMatch && linkMatch[1] && linkMatch[2]) {
                const origin = linkMatch[1];
                const slug = linkMatch[2];
                log.info(`Detected Event Link: ${origin} -> ${slug}`);
                await connectEvent(slug, chatId, user, token, origin);
                return;
            }

            // Fallback match
            const slugMatch = text.match(/\/e\/([a-zA-Z0-9]+)/);
            if (slugMatch && slugMatch[1]) {
                await connectEvent(slugMatch[1], chatId, user, token);
            }
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
 * Handles logic for verifying and linking a manager via the "Recovery" flow (Magic Link).
 */
async function handleRecoverySetup(chatId: number, user: any, slug: string, recoveryToken: string, token: string) {
    // Verify Security Token
    const { verifyRecoveryToken } = await import("./token");
    if (!verifyRecoveryToken(slug, recoveryToken)) {
        await sendTelegramMessage(chatId, "⚠️ <b>Link Expired or Invalid</b>\n\nPlease go back to the Manage page and click the button again.", token);
        return;
    }

    const event = await prisma.event.findUnique({ where: { slug } });

    if (!event) {
        await sendTelegramMessage(chatId, "⚠️ Event not found.", token);
        return;
    }

    const senderUsername = user?.username?.toLowerCase();
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
            await sendTelegramMessage(chatId, `⚠️ <b>Identity Mismatch</b>\n\nYou are @${senderUsername}, but this event is managed by @${managerHandle}.`, token);
            return;
        }
    }

    await prisma.event.update({
        where: { id: event.id },
        data: updateData
    });

    log.info("Manager recovery linked successfully", { slug, manager: senderUsername });
    await sendTelegramMessage(chatId, `✅ <b>Recovery Setup Complete!</b>\n\nI've verified you as the manager of <b>${event.title}</b>.${claimMessage}\n\nThe event page on your device should update in a few seconds.`, token);
}

/**
 * Handles "Global Login" or "Recovery Handle" flow to send a magic link to the user.
 */
async function handleGlobalLogin(chatId: number, user: any, token: string) {
    const chatStr = chatId.toString();

    // Intent: Check for existing valid token (reuse to prevent Link Preview race conditions)
    const existing = await prisma.loginToken.findFirst({
        where: { chatId: chatStr },
        orderBy: { expiresAt: 'desc' }
    });

    let tokenValue = "";

    if (existing && existing.expiresAt.getTime() - Date.now() > 2 * 60 * 1000) {
        // Reuse existing if > 2 mins left
        tokenValue = existing.token;
    } else {
        // Create new
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);

        const loginToken = await prisma.loginToken.create({
            data: {
                chatId: chatStr,
                expiresAt
            }
        });
        tokenValue = loginToken.token;
    }

    // Use a fixed hardcoded fallback just in case getBaseUrl is getting weird in polling
    const baseUrl = getBaseUrl(null);
    const magicLink = `${baseUrl}/auth/login?token=${tokenValue}`;

    await sendTelegramMessage(chatId, `🔐 <b>Magic Login</b>\n\nClick here to access <b>My Events</b>:\n${magicLink}\n\n(Valid for 15 minutes)`, token);
}

/**
 * Connects a group chat (or user) to an event.
 */
async function connectEvent(slug: string, chatId: number, user: any, token: string, detectedBaseUrl?: string) {
    const event = await prisma.event.findUnique({ where: { slug } });
    if (!event) return;

    // Auto-Capture Manager Logic
    const senderUsername = user?.username;
    const senderId = user?.id?.toString();

    let updateData: any = { telegramChatId: chatId.toString() };
    let capturedMsg = "";

    // 1. If no manager is set yet, assume the person connecting the bot is the manager.
    if (!event.managerTelegram && senderUsername) {
        updateData.managerTelegram = senderUsername;
        if (senderId) updateData.managerChatId = senderId;
        capturedMsg = `\n\n👮 <b>Manager Set:</b> @${senderUsername}`;
    }
    // 2. If the sender IS the manager, update their Chat ID
    else if (event.managerTelegram && senderUsername &&
        event.managerTelegram.toLowerCase().replace('@', '') === senderUsername.toLowerCase()) {
        if (senderId) {
            updateData.managerChatId = senderId;
            capturedMsg = `\n\n✅ <b>Manager Verified</b>`;
        }
    }

    await prisma.event.update({
        where: { id: event.id },
        data: updateData
    });

    // Pinned Dashboard
    try {
        const fullEvent = await prisma.event.findUnique({
            where: { id: event.id },
            include: { timeSlots: { include: { votes: true } } }
        });
        const participants = await prisma.participant.count({ where: { eventId: event.id } });
        const { generateStatusMessage } = await import("./status");
        const { pinChatMessage } = await import("./telegram");

        if (fullEvent) {
            const baseUrl = detectedBaseUrl || getBaseUrl(null);
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
    // 1. Find event by token
    const event = await prisma.event.findUnique({
        where: { recoveryToken },
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
