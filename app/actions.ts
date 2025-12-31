"use server";

import { cookies } from "next/headers";
import Logger from "@/shared/lib/logger";

const log = Logger.get("Actions");

/**
 * Sets a secure, HTTP-only cookie for admin authentication.
 *
 * @param {string} slug - The event slug identifier.
 * @param {string} token - The administrative token.
 */
export async function setAdminCookie(slug: string, token: string) {
    const cookieStore = cookies();
    const isProd = process.env.NODE_ENV === "production";
    const opts = {
        httpOnly: true,
        secure: isProd,
        sameSite: (isProd ? "none" : "lax") as "none" | "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30 // Intent: Persist session for 30 days
    };
    cookieStore.set(`tabletop_admin_${slug}`, token, opts);
}

import prisma from "@/shared/lib/prisma";

/**
 * Initiates the recovery process for a manager link via Telegram DM.
 *
 * @param {string} slug - The event slug.
 * @param {string} handle - The Telegram handle provided by the user.
 * @returns {Promise<Object>} Success message or error description.
 */
export async function recoverManagerLink(slug: string, handle: string) {
    const event = await prisma.event.findUnique({ where: { slug } });

    if (!event || !event.managerTelegram) {
        return { error: "No manager linked to this event." };
    }

    const normalize = (h: string) => h.toLowerCase().replace('@', '').trim();

    // Intent: Verify that the provided handle matches the stored manager handle (ignoring case and '@' prefix)
    if (normalize(event.managerTelegram) === normalize(handle)) {
        // Intent: Securely deliver the magic link via Telegram DM instead of returning it in the response.
        if (!event.managerChatId) {
            return { error: "Handle matched, but the bot hasn't connected with you yet. Please open the bot and click 'Start' first." };
        }

        const { sendTelegramMessage } = await import("@/features/telegram");
        const { getBaseUrl } = await import("@/shared/lib/url");
        const { headers } = await import("next/headers");

        const baseUrl = getBaseUrl(headers());
        const magicLink = `${baseUrl}/api/event/${slug}/auth?token=${event.adminToken}`;

        await sendTelegramMessage(
            event.managerChatId,
            `🔐 <b>Login Request</b>\n\nClick here to manage "${event.title}":\n${magicLink}`,
            process.env.TELEGRAM_BOT_TOKEN!
        );

        log.info("Manager recovery DM sent", { slug, chatId: event.managerChatId });
        return { success: true, message: "Recovery link sent to your Telegram DMs!" };
    }

    log.warn("Manager recovery failed: Handle mismatch", { slug, inputHandle: handle });
    return { error: "Telegram handle does not match our records." };
    log.warn("Manager recovery failed: Handle mismatch", { slug, inputHandle: handle });
    return { error: "Telegram handle does not match our records." };
}

/**
 * Initiates the recovery process for a manager link via Discord DM.
 *
 * @param {string} slug - The event slug.
 * @param {string} username - The Discord username provided by the user.
 * @returns {Promise<Object>} Success message or error description.
 */
export async function recoverDiscordManagerLink(slug: string, username: string) {
    const event = await prisma.event.findUnique({ where: { slug } });

    if (!event || !event.managerDiscordId) {
        return { error: "No Discord account linked to this event." };
    }

    const { dmDiscordManagerLink } = await import("@/app/actions");
    const normalize = (name: string) => name.toLowerCase().replace('@', '').trim();
    const inputName = normalize(username);

    let storedName = event.managerDiscordUsername ? normalize(event.managerDiscordUsername) : null;

    // Intent: Handle legacy events where username wasn't saved, or name changed.
    // If we don't have a stored name, or even if we do, we might want to verify against real-time data if mismatch?
    // Let's rely on stored first. If mismatch or null, try to fetch fresh from Discord if we have the ID.
    if (!storedName || storedName !== inputName) {
        if (process.env.DISCORD_BOT_TOKEN) {
            const { getDiscordUser } = await import("@/features/discord/model/discord");
            const discordUser = await getDiscordUser(event.managerDiscordId, process.env.DISCORD_BOT_TOKEN);

            if (discordUser) {
                // Heuristic: Check against current username and global name? Discord now uses unique usernames (mostly).
                // API returns 'username' and 'discriminator' (0 for new names).
                const realName = normalize(discordUser.username);

                if (realName === inputName) {
                    // Self-healing: Update the stored username for future speed
                    await prisma.event.update({
                        where: { id: event.id },
                        data: { managerDiscordUsername: discordUser.username }
                    });
                    storedName = realName;
                }
            }
        }
    }

    if (storedName === inputName) {
        return await dmDiscordManagerLink(slug);
    }

    log.warn("Manager Discord recovery failed: Username mismatch", { slug, input: username, stored: storedName });
    return { error: "Discord username does not match our records." };
}

/**
 * Directly requests a recovery link sent to the manager's DM.
 * Assumes the caller is already context-aware or authorized to trigger this.
 *
 * @param {string} slug - The event slug.
 * @returns {Promise<Object>} Success status or error object.
 */
export async function dmManagerLink(slug: string) {
    const event = await prisma.event.findUnique({ where: { slug } });

    if (!event || !event.managerTelegram) {
        return { error: "No manager linked to this event." };
    }

    if (!event.managerChatId) {
        return { error: `Bot doesn't know you yet. Please start the bot first!` };
    }

    const { sendTelegramMessage } = await import("@/features/telegram");

    const { getBaseUrl } = await import("@/shared/lib/url");
    const { headers } = await import("next/headers");
    const headerList = headers();

    // Intent: Determine correct base URL, prioritizing dynamic headers for correct environment resolution.
    const baseUrl = getBaseUrl(headerList);
    const magicLink = `${baseUrl}/api/event/${slug}/auth?token=${event.adminToken}`;

    log.info("Sending DM recovery link", { slug, chatId: event.managerChatId });

    await sendTelegramMessage(event.managerChatId, `🔑 <b>Manager Link Recovery</b>\n\nClick here to manage <b>${event.title}</b>:\n${magicLink}`, process.env.TELEGRAM_BOT_TOKEN!);

    return { success: true };
}

/**
 * Checks the manager's connection status (Telegram linkage).
 *
 * @param {string} slug - The event slug.
 * @returns {Promise<Object>} Object containing connection status and recorded handle.
 */
export async function checkManagerStatus(slug: string) {
    const event = await prisma.event.findUnique({
        where: { slug },
        select: { managerChatId: true, managerTelegram: true }
    });

    return {
        hasManagerChatId: !!event?.managerChatId,
        handle: event?.managerTelegram
    };
}

/**
 * Checks if the event is connected to a Telegram group chat.
 *
 * @param {string} slug - The event slug.
 * @returns {Promise<Object>} Object indicating if a Telegram chat ID is present.
 */
export async function checkEventStatus(slug: string) {
    const event = await prisma.event.findUnique({
        where: { slug },
        select: { telegramChatId: true }
    });

    return {
        hasTelegramChatId: !!event?.telegramChatId
    };
}

/**
 * Updates the manager's Telegram handle.
 *
 * @param {string} slug - The event slug.
 * @param {string} handle - The new Telegram handle.
 * @returns {Promise<Object>} Success status and formatted handle, or error.
 */
export async function updateManagerHandle(slug: string, handle: string) {
    if (!handle || handle.trim().length < 2) {
        return { error: "Handle must be at least 2 characters." };
    }

    // Intent: Enforce standard Telegram handle format (start with @)
    const formattedHandle = handle.startsWith("@") ? handle : `@${handle}`;

    try {
        await prisma.event.update({
            where: { slug },
            data: { managerTelegram: formattedHandle }
        });
        log.info("Manager handle updated", { slug, handle: formattedHandle });
        return { success: true, handle: formattedHandle };
    } catch (e) {
        log.error("Failed to update handle", e as Error);
        return { error: "Failed to update handle." };
    }
}

/**
 * Updates the Telegram invite link associated with the event.
 *
 * @param {string} slug - The event slug.
 * @param {string} link - The Telegram invite link (must start with https://t.me/).
 * @returns {Promise<Object>} Success status or error.
 */
export async function updateTelegramInviteLink(slug: string, link: string) {
    if (!link || !link.startsWith("https://t.me/")) {
        return { error: "Invalid Telegram link. It should start with https://t.me/" };
    }

    try {
        await prisma.event.update({
            where: { slug },
            data: { telegramLink: link }
        });
        log.info("Telegram invite link updated", { slug });
        return { success: true };
    } catch (e) {
        log.error("Failed to update telegram link", e as Error);
        return { error: "Failed to save link." };
    }
}

/**
 * Permanently deletes an event and all associated data.
 *
 * @param {string} slug - The event slug.
 * @returns {Promise<Object>} Success status or error.
 */
export async function deleteEvent(slug: string) {
    const event = await prisma.event.findUnique({
        where: { slug }
    });

    if (!event) {
        return { error: "Event not found" };
    }

    log.warn("Deleting event", { slug, title: event.title });

    // Intent: Cleanup external Telegram state (unpin message, notify chat) before database deletion.
    if (process.env.TELEGRAM_BOT_TOKEN) {
        const { sendTelegramMessage, unpinChatMessage } = await import("@/features/telegram");

        if (event.telegramChatId) {
            // Intent: Unpin the event message to clean up the chat interface.
            if (event.pinnedMessageId) {
                await unpinChatMessage(event.telegramChatId, event.pinnedMessageId, process.env.TELEGRAM_BOT_TOKEN);
            }

            // Intent: Inform the group that the event has been deleted.
            await sendTelegramMessage(
                event.telegramChatId,
                `🚫 <b>Event Cancelled</b>\n\nThe event "${event.title}" has been removed by the organizer.`,
                process.env.TELEGRAM_BOT_TOKEN
            );
        }
    }

    // Intent: Cleanup external Discord state
    if (process.env.DISCORD_BOT_TOKEN && event.discordChannelId) {
        const { sendDiscordMessage, unpinDiscordMessage } = await import("@/features/discord/model/discord");

        if (event.discordMessageId) {
            await unpinDiscordMessage(event.discordChannelId, event.discordMessageId, process.env.DISCORD_BOT_TOKEN);
        }

        await sendDiscordMessage(
            event.discordChannelId,
            `🚫 **Event Deleted**\n\nThe event "**${event.title}**" has been removed by the organizer.`,
            process.env.DISCORD_BOT_TOKEN
        );
    }

    // Intent: Perform transactional deletion to ensure data consistency.
    // Explicitly delete child records (Votes, TimeSlots, Participants)
    // to handle schemas where CASCADE deletion might not be configured or reliable.
    try {
        await prisma.$transaction(async (tx) => {
            // 1. Delete Votes (via TimeSlots or Participants)
            // Intent: Manual cleanup is safer than relying on implicit DB cascades in this context.
            await tx.vote.deleteMany({
                where: { timeSlot: { eventId: event.id } }
            });

            // 2. Delete TimeSlots
            await tx.timeSlot.deleteMany({
                where: { eventId: event.id }
            });

            // 3. Delete Participants
            await tx.participant.deleteMany({
                where: { eventId: event.id }
            });

            // 4. Delete Event
            await tx.event.delete({
                where: { id: event.id }
            });
        });

        log.info("Event deleted successfully", { slug });
        return { success: true };
    } catch (e) {
        log.error("Failed to delete event", e as Error);
        return { error: "Failed to delete event" };
    }
}

/**
 * Marks an event as CANCELLED without deleting it.
 *
 * @param {string} slug - The event slug.
 * @returns {Promise<Object>} Success status or error.
 */
export async function cancelEvent(slug: string) {
    const event = await prisma.event.findUnique({
        where: { slug }
    });

    if (!event) {
        return { error: "Event not found" };
    }

    log.warn("Cancelling event", { slug, title: event.title });

    try {
        // Intent: Update status first to preventing further interactions immediately.
        await prisma.event.update({
            where: { id: event.id },
            data: { status: 'CANCELLED' }
        });

        const { getBaseUrl } = await import("@/shared/lib/url");
        const { headers } = await import("next/headers");
        const baseUrl = getBaseUrl(headers());

        // Intent: Update Telegram message to reflect cancellation but keep it visible (pinned).
        if (event.telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
            const { editMessageText, sendTelegramMessage } = await import("@/features/telegram");
            const token = process.env.TELEGRAM_BOT_TOKEN;

            if (event.pinnedMessageId) {
                // Intent: Edit the pinned message to show cancellation
                // We keep it pinned so everyone sees it
                await editMessageText(
                    event.telegramChatId,
                    event.pinnedMessageId,
                    `🚫 <b>Event Cancelled</b> (was: ${event.finalizedSlotId ? 'Finalized' : 'Planned'})\n\n` +
                    `The event "<b>${event.title}</b>" has been cancelled by the host.\n\n` +
                    `<a href="${baseUrl}/e/${slug}">View Event Details</a>`,
                    token
                );
            }

            // Intent: Send a fresh message so users get a notification (editing doesn't notify)
            await sendTelegramMessage(
                event.telegramChatId,
                `🚫 <b>Event Cancelled</b>\n\nThe event "${event.title}" has been cancelled by the organizer.`,
                token
            );
        }

        // Intent: Update Discord message
        if (event.discordChannelId && process.env.DISCORD_BOT_TOKEN) {
            const { editDiscordMessage, sendDiscordMessage } = await import("@/features/discord/model/discord");
            const token = process.env.DISCORD_BOT_TOKEN!;

            if (event.discordMessageId) {
                await editDiscordMessage(
                    event.discordChannelId,
                    event.discordMessageId,
                    `🚫 **Event Cancelled** (was: ${event.finalizedSlotId ? 'Finalized' : 'Planned'})\n\nThe event "**${event.title}**" has been cancelled by the host.\n\n[View Event Details](${baseUrl}/e/${slug})`,
                    token
                );
            }

            await sendDiscordMessage(
                event.discordChannelId,
                `🚫 **Event Cancelled**\n\nThe event "**${event.title}**" has been cancelled by the organizer.`,
                token
            );
        }

        log.info("Event cancelled successfully", { slug });
        return { success: true };
    } catch (e) {
        log.error("Failed to cancel event", e as Error);
        return { error: "Failed to cancel event" };
    }
}

/**
 * Sends a "Magic Link" to a user's global Telegram DM to log them in and view all their events.
 *
 * @param {string} handle - The user's Telegram handle.
 * @returns {Promise<Object>} Success message, error, or deep link if unverified.
 */
export async function sendGlobalMagicLink(handle: string) {
    const normalize = (h: string) => h.toLowerCase().replace('@', '').trim();
    const cleanHandle = normalize(handle);
    const formattedHandle = handle.startsWith('@') ? handle : `@${handle}`;

    if (cleanHandle.length < 2) {
        return { error: "Please enter a valid Telegram handle." };
    }

    try {
        // Intent: Find User by Chat ID (look for ANY record that has a chat ID for this handle)
        // We look in Participant records first as they are most common
        const participant = await prisma.participant.findFirst({
            where: {
                OR: [
                    { telegramId: cleanHandle },
                    { telegramId: formattedHandle }
                ],
                NOT: { chatId: null }
            },
            select: { chatId: true }
        });

        // Intent: Fallback to Manager records if no Participant record found
        let chatId = participant?.chatId;
        if (!chatId) {
            const manager = await prisma.event.findFirst({
                where: {
                    managerTelegram: formattedHandle, // Managers usually have @ enforced
                    NOT: { managerChatId: null }
                },
                select: { managerChatId: true }
            });
            chatId = manager?.managerChatId;
        }

        // Logic Branch: Send link if verified, otherwise guide to verification.
        if (chatId) {
            // Case A: User is Known & Verified (Has Chat ID) -> Send Link
            const { sendTelegramMessage } = await import("@/features/telegram");
            const { getBaseUrl } = await import("@/shared/lib/url");
            const { headers } = await import("next/headers");

            // Intent: Create short-lived authentication token (15 mins)
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 15);

            const loginToken = await prisma.loginToken.create({
                data: {
                    chatId: chatId,
                    expiresAt
                }
            });

            const baseUrl = getBaseUrl(headers());
            const magicLink = `${baseUrl}/auth/login?token=${loginToken.token}`;

            await sendTelegramMessage(
                chatId,
                `🔐 <b>Magic Login Requested</b>\n\nSomeone (hopefully you) requested a link to view all your events.\n\n👉 <a href="${magicLink}">Click here to Login</a>\n\n(Valid for 15 minutes)`,
                process.env.TELEGRAM_BOT_TOKEN!
            );

            return { success: true, message: "Magic Link sent to your Telegram DMs!" };

        } else {
            // Case B: User has records but NO Chat ID (or no records at all)
            // We can't verify them, so we can't send a link.
            // We prompt them to start the bot.

            // Intent: Check if user exists at all to provide specific error message ("Unlinked" vs "No User")
            const exists = await prisma.participant.count({
                where: { OR: [{ telegramId: cleanHandle }, { telegramId: formattedHandle }] }
            }) > 0 || await prisma.event.count({
                where: { managerTelegram: formattedHandle }
            }) > 0;

            if (exists) {
                const { getBotUsername } = await import("@/features/telegram");
                const botName = await getBotUsername(process.env.TELEGRAM_BOT_TOKEN!) || "TabletopSchedulerBot";
                return {
                    error: "UNLINKED",
                    message: "We found your events, but the bot hasn't verified you yet.",
                    deepLink: `https://t.me/${botName}?start=recover_handle`
                };
            } else {
                return { error: "No events found for this handle." };
            }
        }

    } catch (e) {
        log.error("Global recovery failed", e as Error);
        return { error: "System error. Please try again." };
    }
}

/**
 * Generates a short, temporary recovery token for non-Telegram workflows.
 *
 * @param {string} slug - The event slug.
 * @returns {Promise<Object>} Object containing the token or error.
 */
export async function generateShortRecoveryToken(slug: string) {
    // Intent: Check for existing valid token first to prevent race conditions (e.g. multi-tab usage)
    const existing = await prisma.event.findUnique({
        where: { slug },
        select: { recoveryToken: true, recoveryTokenExpires: true }
    });

    // Intent: Reuse existing token if it has sufficient validity remaining (> 2 mins)
    if (existing?.recoveryToken && existing.recoveryTokenExpires) {
        const timeRemaining = existing.recoveryTokenExpires.getTime() - Date.now();
        if (timeRemaining > 2 * 60 * 1000) {
            return { success: true, token: existing.recoveryToken };
        }
    }

    const crypto = await import('crypto');
    // Intent: Generate a short 8-character hex token (4 bytes) for ease of manual entry if needed
    const token = crypto.randomBytes(4).toString('hex');

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    try {
        await prisma.event.update({
            where: { slug },
            data: {
                recoveryToken: token,
                recoveryTokenExpires: expiresAt
            }
        });
        return { success: true, token };
    } catch (e) {
        log.error("Failed to generate recovery token", e as Error);
        return { error: "Failed to generate token" };
    }
}

/**
 * Connects the event to a specific Discord Channel.
 *
 * @param {string} slug - The event slug.
 * @param {string} guildId - The Discord Server ID.
 * @param {string} channelId - The target Channel ID.
 * @param {string} discordToken - The Bot Token (serverside environment variable only).
 */
export async function connectDiscordChannel(slug: string, guildId: string, channelId: string) {
    const event = await prisma.event.findUnique({ where: { slug } });
    if (!event) return { error: "Event not found" };

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return { error: "Server Configuration Error: Discord Token missing" };

    try {
        const { cookies } = await import("next/headers");
        const cookieStore = cookies();
        const discordUserId = cookieStore.get("tabletop_user_discord_id")?.value;
        const discordUsername = cookieStore.get("tabletop_user_discord_name")?.value;

        // 1. Save Connection
        // Intent: Also link the manager if this is the first connection or recovery needed
        const dataToUpdate: any = {
            discordGuildId: guildId,
            discordChannelId: channelId
        };

        if (discordUserId) {
            // Intent: Always ensure manager ID and username are up to date if the user is authenticated
            // This allows fixing missing usernames by just reconnecting/refreshing the bot channel.
            if (!event.managerDiscordId || event.managerDiscordId === discordUserId) {
                dataToUpdate.managerDiscordId = discordUserId;
                if (discordUsername) {
                    dataToUpdate.managerDiscordUsername = discordUsername;
                }
            }
        }

        await prisma.event.update({
            where: { id: event.id },
            data: dataToUpdate
        });

        // 2. Send Hello / Init Dashboard
        const { sendDiscordMessage, pinDiscordMessage } = await import("@/features/discord/model/discord");
        const { getBaseUrl } = await import("@/shared/lib/url");
        const { headers } = await import("next/headers");
        const baseUrl = getBaseUrl(headers());

        // Intent: Announce the event professionally instead of "Beep Boop"
        const announcement = `📅 **Event Planning: ${event.title}**\nTime to vote!\n${baseUrl}/e/${slug}`;

        // Intent: Try to send. This acts as our permission check.
        const sendResult = await sendDiscordMessage(channelId, announcement, token);

        if (sendResult.error) {
            // Check for specific "Missing Access" code from Discord API
            if (sendResult.error.code === 50001) {
                return { error: "MISSING_PERMISSIONS" };
            }
            return { error: `Discord Error: ${sendResult.error.message || 'Unknown'}` };
        }

        const msgId = sendResult.id;

        // 3. Create & Pin Dashboard (if announcement succeeded)
        if (msgId) {
            // Calculate Dashboard State
            const participants = await prisma.participant.count({ where: { eventId: event.id } });
            const { generateStatusMessage } = await import("@/shared/lib/status");
            const fullEvent = await prisma.event.findUnique({
                where: { id: event.id },
                include: { timeSlots: { include: { votes: true } } }
            });
            const statusMsg = generateStatusMessage(fullEvent!, participants, baseUrl);
            const cleanMsg = statusMsg.replace(/<[^>]*>?/gm, ''); // Quick strip tags

            // We use the announcement as the anchor, but also create the dashboard message separately?
            // User requested: "announce the event... once it works it should have the 'connected' message"
            // Actually, the previous code sent "Beep Boop" AND then a Dashboard.
            // Let's stick to the pattern: Send Announcement -> Pin it? Or Send Announcement -> Send Dashboard -> Pin Dashboard?
            // The dashboard is the "Persistent" status.
            // Let's keep the dashboard separate but ensure the announcement is what we test with.

            // Post Dashboard
            const dashResult = await sendDiscordMessage(channelId, `**EVENT STATUS**\n${cleanMsg}\n\n[View Event](${baseUrl}/e/${slug})`, token);

            if (dashResult.id) {
                await pinDiscordMessage(channelId, dashResult.id, token);
                await prisma.event.update({
                    where: { id: event.id },
                    data: { discordMessageId: dashResult.id }
                });
            }
        }

        return { success: true };
    } catch (e) {
        log.error("Failed to connect Discord", e as Error);
        return { error: "Failed to connect channel." };
    }
}

/**
 * Fetches the list of text channels for a given Discord Guild.
 *
 * @param {string} guildId - The Discord Server ID.
 * @returns {Promise<Object>} List of channels or error.
 */
export async function listDiscordChannels(guildId: string) {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return { error: "Server Configuration Error" };

    try {
        const { getGuildChannels } = await import("@/features/discord/model/discord");
        const channels = await getGuildChannels(guildId, token);
        return { success: true, channels };
    } catch (e) {
        return { error: "Failed to fetch channels" };
    }
}

/**
 * Updates the automated reminder settings for an event.
 *
 * @param {string} slug - The event slug.
 * @param {boolean} enabled - Whether reminders are active.
 * @param {string} time - The time of day for reminders (HH:MM).
 * @param {number[]} days - Array of days (offsets) before the event to send reminders.
 * @returns {Promise<Object>} Success status or error.
 */
export async function updateReminderSettings(slug: string, enabled: boolean, time: string, days: number[]) {
    try {
        const event = await prisma.event.findUnique({ where: { slug } });
        if (!event) return { success: false, error: "Event not found" };

        // Intent: Validate time format to ensure cron compatibility
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (enabled && !timeRegex.test(time)) return { success: false, error: "Invalid time format" };

        await prisma.event.update({
            where: { id: event.id },
            data: {
                reminderEnabled: enabled,
                reminderTime: time,
                reminderDays: days.join(','),
                // Intent: Do NOT reset notification flags here. Changing schedule shouldn't spam users if quorum was already reached.
            }
        });

        // Trigger revalidation if needed
        return { success: true };
    } catch (e) {
        console.error("Failed to update reminder settings", e);
        return { success: false, error: "Internal Error" };
    }
}
/**
 * Sends a Magic Link to the manager via Discord DM.
 * @param {string} slug - The event slug.
 */
export async function dmDiscordManagerLink(slug: string) {
    const event = await prisma.event.findUnique({ where: { slug } });
    if (!event || !event.managerDiscordId) return { error: "No manager linked." };

    const { token } = await generateShortRecoveryToken(slug);
    if (!token) return { error: "Failed to generate token." };

    const { createDMChannel, sendDiscordMessage } = await import('@/features/discord/model/discord');
    const tokenVal = process.env.DISCORD_BOT_TOKEN || "";

    // 1. Open DM Channel
    const dmRes = await createDMChannel(event.managerDiscordId, tokenVal);
    if (dmRes.error || !dmRes.id) {
        return { error: "Could not open DM channel. Bot might be blocked." };
    }

    // 2. Send Message
    const magicLink = `${process.env.NEXT_PUBLIC_BASE_URL}/e/${slug}/manage?token=${token}`;
    const msg = `**Magic Link Request**\nHere is your link to manage **${event.title}**:\n${magicLink}\n\n(This link expires in 1 hour)`;

    const sendRes = await sendDiscordMessage(dmRes.id, msg, tokenVal);

    if (sendRes.error) {
        return { error: "Failed to send DM." };
    }

    return { success: true };
}

/**
 * Generates a global magic link for Discord users to access "My Events".
 * @param username The Discord username (or handle) to link.
 */
export async function sendDiscordMagicLogin(username: string): Promise<{ success: boolean; message?: string; error?: string; deepLink?: string }> {
    const prisma = (await import("@/shared/lib/prisma")).default;
    const { createDMChannel, sendDiscordMessage } = await import('@/features/discord/model/discord');
    const { getBaseUrl } = await import("@/shared/lib/url");
    const { headers } = await import("next/headers");
    const token = process.env.DISCORD_BOT_TOKEN;

    if (!token) return { success: false, error: "Server Configuration Error: Discord Token missing" };
    if (!username) return { success: false, error: "Please enter a username" };

    const normalized = username.toLowerCase().replace('@', '');

    try {
        // 1. Find User by Username (Case Insensitive-ish)
        // We prioritize explicit Participant records where we captured identity.
        const userRecords = await prisma.participant.findMany({
            where: {
                discordId: { not: null }
            },
            select: { discordId: true, discordUsername: true, name: true }
        });

        // Manual fuzzy match since SQLite/Postgres 'search' varies and we rely on 'discordUsername' which might be inconsistent.
        // We look for 'discordUsername' matching or 'name' matching if no discordUsername.
        const match = userRecords.find(p =>
            (p.discordUsername && p.discordUsername.toLowerCase().includes(normalized)) ||
            (p.name && p.name.toLowerCase().includes(normalized))
        );

        let targetId = match?.discordId;
        let targetUsername = match?.discordUsername;

        // 2. Fallback: Check Event Manager records
        if (!targetId) {
            // Intent: If the user never voted but is an event manager (and we captured their username)
            const managerRecords = await prisma.event.findMany({
                where: {
                    managerDiscordId: { not: null },
                    managerDiscordUsername: { contains: normalized }
                },
                select: { managerDiscordId: true, managerDiscordUsername: true }
            });

            // Just take the first match
            const mgr = managerRecords[0];
            if (mgr) {
                targetId = mgr.managerDiscordId;
                targetUsername = mgr.managerDiscordUsername;
            }
        }

        if (!targetId) {
            return { success: false, error: "We couldn't find a record for this username. Have you voted on an event using the 'Log in with Discord' button before?" };
        }

        // 3. Generate Token
        // Expiry: 15 minutes
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);

        const loginToken = await prisma.loginToken.create({
            data: {
                discordId: targetId,
                discordUsername: targetUsername || username,
                expiresAt
            }
        });

        const baseUrl = getBaseUrl(headers());
        const magicLink = `${baseUrl}/auth/login?token=${loginToken.token}`;

        // 4. Create DM & Send
        const channel = await createDMChannel(targetId, token);
        if (channel.error || !channel.id) {
            return { success: false, error: "Could not open a DM. Please check your privacy settings." };
        }

        const msg = `🔐 **Magic Login**\n\nClick here to access **My Events**:\n${magicLink}\n\n(Valid for 15 minutes)`;
        const sent = await sendDiscordMessage(channel.id, msg, token);

        if (sent.error) {
            return { success: false, error: "Failed to send DM. Check privacy settings." };
        }

        return { success: true, message: "Link sent! Check your Discord DMs." };

    } catch (e) {
        console.error("Discord Magic Link Error", e);
        return { success: false, error: "Internal Server Error" };
    }
}
