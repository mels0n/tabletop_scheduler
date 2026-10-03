"use server";

import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { cookies } from "next/headers";
import { getBaseUrl } from "@/shared/lib/url";
import { hashToken } from "@/shared/lib/token";
import { randomUUID } from "crypto";

import {
    getDiscordUser,
    sendDiscordMessage,
    pinDiscordMessage,
    getGuildChannels,
    createDMChannel
} from "@/features/integrations/discord/model/discord";
import { dmManagerLink } from "@/features/event-management/server/recovery";
import { generateStatusMessage } from "@/shared/lib/status";
import { verifyValue } from "@/shared/lib/session";
import { AppError, ForbiddenError, ValidationError } from "@/shared/errors";
import { verifyEventAdmin } from "@/features/auth/server/actions";
import { guildCookieName, isDiscordSnowflake } from "@/features/integrations/discord/model/oauth-state";

const log = Logger.get("DiscordActions");

export async function recoverDiscordManagerLink(slug: string, username: string) {
    username = username.replace('@', '').trim();
    const event = await prisma.event.findUnique({ where: { slug } });

    if (!event || !event.managerDiscordId) {
        return { error: "No Discord account linked to this event." };
    }

    const normalize = (name: string) => name.toLowerCase().replace('@', '').trim();
    const inputName = normalize(username);
    let storedName = event.managerDiscordUsername ? normalize(event.managerDiscordUsername) : null;

    if (!storedName || storedName !== inputName) {
        if (process.env.DISCORD_BOT_TOKEN) {
            const discordUser = await getDiscordUser(event.managerDiscordId, process.env.DISCORD_BOT_TOKEN);

            if (discordUser) {
                const realName = normalize(discordUser.username);
                if (realName === inputName) {
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

type ActionFailure = { success?: undefined; error: string; code?: string };
type ConnectChannelResult = { success: true; error?: undefined; code?: undefined } | ActionFailure;
type ListChannelsResult =
    | { success: true; channels: { id: string; name: string }[]; error?: undefined; code?: undefined }
    | (ActionFailure & { channels?: undefined });

/** Serialises expected errors for the client; anything else is logged and made generic. */
function toActionError(e: unknown, fallback: string): ActionFailure {
    if (e instanceof AppError && e.status < 500) return { error: e.message, code: e.code };
    log.error(fallback, e as Error);
    return { error: fallback };
}

// TODO(Task 12): replace with requireEventAdmin from features/auth/server/verify.ts.
async function requireEventAdmin(slug: string): Promise<void> {
    if (!(await verifyEventAdmin(slug))) throw new ForbiddenError();
}

/**
 * The bot sits in ~100 guilds, so a guild ID from the client proves nothing. Only the guild
 * this admin just added the bot to (recorded by the OAuth callback in a signed, one-hour,
 * per-event cookie) may be listed or bound.
 */
async function requireGuildGrant(slug: string, guildId: string): Promise<void> {
    const cookieStore = await cookies();
    if (verifyValue(cookieStore.get(guildCookieName(slug))?.value) !== guildId) {
        throw new ForbiddenError("Discord connection expired. Connect the server again.");
    }
}

function requireSnowflakes(...ids: string[]): void {
    if (!ids.every(isDiscordSnowflake)) throw new ValidationError("Invalid Discord ID");
}

export async function connectDiscordChannel(slug: string, guildId: string, channelId: string): Promise<ConnectChannelResult> {
    try {
        await requireEventAdmin(slug);
        requireSnowflakes(guildId, channelId);
        await requireGuildGrant(slug, guildId);
    } catch (e) {
        return toActionError(e, "Failed to connect channel.");
    }

    const event = await prisma.event.findUnique({ where: { slug } });
    if (!event) return { error: "Event not found" };

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return { error: "Server Configuration Error: Discord Token missing" };

    try {
        // The channel must belong to the granted guild, or the bot could be pointed at a
        // channel in any other server it is in.
        const channels = await getGuildChannels(guildId, token);
        if (!channels.some((c) => c.id === channelId)) {
            return { error: "That channel is not in the connected server.", code: "validation" };
        }

        // Binding a channel never changes who manages the event.
        await prisma.event.update({
            where: { id: event.id },
            data: { discordGuildId: guildId, discordChannelId: channelId }
        });

        const baseUrl = getBaseUrl();
        const announcement = `📅 **Event Planning: ${event.title}**\nTime to vote!\n${baseUrl}/e/${slug}`;
        const sendResult = await sendDiscordMessage(channelId, announcement, token);

        if (sendResult.error) {
            if (sendResult.error.code === 50001) {
                return { error: "MISSING_PERMISSIONS" };
            }
            return { error: `Discord Error: ${sendResult.error.message || 'Unknown'}` };
        }

        const msgId = sendResult.id;

        if (msgId) {
            const participants = await prisma.participant.count({ where: { eventId: event.id } });
            const fullEvent = await prisma.event.findUnique({
                where: { id: event.id },
                include: { timeSlots: { include: { votes: true } } }
            });
            const statusMsg = generateStatusMessage(fullEvent!, participants, baseUrl);
            const { htmlToDiscordMarkdown } = await import("@/shared/lib/discordMarkdown");

            const dashResult = await sendDiscordMessage(channelId, `**EVENT STATUS**\n${htmlToDiscordMarkdown(statusMsg)}`, token);

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

export async function listDiscordChannels(slug: string, guildId: string): Promise<ListChannelsResult> {
    try {
        await requireEventAdmin(slug);
        requireSnowflakes(guildId);
        await requireGuildGrant(slug, guildId);
    } catch (e) {
        return toActionError(e, "Failed to fetch channels");
    }

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return { error: "Server Configuration Error" };

    try {
        const channels = await getGuildChannels(guildId, token);
        return { success: true, channels };
    } catch {
        return { error: "Failed to fetch channels" };
    }
}

/**
 * Sends a Magic Link to the manager via Discord DM.
 *
 * Thin alias of the platform-neutral `dmManagerLink` (recovery.ts), kept for the
 * Discord UI. The link goes to every platform the manager has linked.
 *
 * @param {string} slug - The event slug.
 */
export async function dmDiscordManagerLink(slug: string) {
    // Delegates to the platform-neutral sender: DMs every linked platform.
    return dmManagerLink(slug);
}



/**
 * Generates a global magic link for Discord users to access "My Events".
 * @param username The Discord username (or handle) to link.
 */
export async function sendDiscordMagicLogin(username: string): Promise<{ success: boolean; message?: string; error?: string; deepLink?: string }> {
    username = username.replace('@', '').trim();
    const botToken = process.env.DISCORD_BOT_TOKEN;

    if (!botToken) return { success: false, error: "Server Configuration Error: Discord Token missing" };
    if (!username) return { success: false, error: "Please enter a username" };

    const normalizedUsername = username.toLowerCase().replace('@', '');

    let targetDiscordId: string | null = null;
    let targetDiscordUsername: string | null = null;

    try {
        const cookieStore = await cookies();
        const cookieDiscordId = cookieStore.get("tabletop_user_discord_id")?.value;

        // 1. Fast-path: Prioritize Discord ID from cookie (most reliable identity signal)
        if (cookieDiscordId) {
            // Check if they are a participant
            const participantById = await prisma.participant.findFirst({
                where: { discordId: cookieDiscordId },
                select: { discordId: true, discordUsername: true }
            });
            if (participantById) {
                targetDiscordId = participantById.discordId;
                targetDiscordUsername = participantById.discordUsername;
            } else {
                // Check if they are an event manager
                const managerById = await prisma.event.findFirst({
                    where: { managerDiscordId: cookieDiscordId },
                    select: { managerDiscordId: true, managerDiscordUsername: true }
                });
                if (managerById) {
                    targetDiscordId = managerById.managerDiscordId;
                    targetDiscordUsername = managerById.managerDiscordUsername;
                }
            }
        }

        // 2. Fallback: Find User by Username (if cookie ID didn't yield a match)
        // Security: EXACT match only. Substring matching (`contains`, and matching against
        // the free-text display name) let a stranger typing a fragment trigger a bot DM to
        // whichever user happened to match — unsolicited contact under Discord's Developer
        // Policy. Exact compare happens in JS because Prisma's case-insensitive mode isn't
        // portable across our sqlite/postgres dual targets; linked rows are few (24h purge).
        if (!targetDiscordId) {
            const matchesInput = (stored: string | null) =>
                !!stored && stored.toLowerCase().replace('@', '') === normalizedUsername;

            const linkedParticipants = await prisma.participant.findMany({
                where: { discordId: { not: null }, discordUsername: { not: null } },
                select: { discordId: true, discordUsername: true }
            });
            const participantMatch = linkedParticipants.find(p => matchesInput(p.discordUsername));

            if (participantMatch) {
                targetDiscordId = participantMatch.discordId;
                targetDiscordUsername = participantMatch.discordUsername;
            } else {
                const linkedManagers = await prisma.event.findMany({
                    where: { managerDiscordId: { not: null }, managerDiscordUsername: { not: null } },
                    select: { managerDiscordId: true, managerDiscordUsername: true }
                });
                const managerMatch = linkedManagers.find(e => matchesInput(e.managerDiscordUsername));

                if (managerMatch) {
                    targetDiscordId = managerMatch.managerDiscordId;
                    targetDiscordUsername = managerMatch.managerDiscordUsername;
                }
            }
        }

        // 3. If no user found after all attempts
        if (!targetDiscordId) {
            return { success: false, error: "We couldn't find a record for this username. Have you voted on an event using the 'Log in with Discord' button before?" };
        }

        // 3b. Cooldown: one unexpired link per minute per Discord account, so the form
        // can't be scripted into a DM-spam vector against a known username.
        const recentToken = await prisma.loginToken.findFirst({
            where: {
                discordId: targetDiscordId,
                createdAt: { gt: new Date(Date.now() - 60_000) }
            }
        });
        if (recentToken) {
            return { success: false, error: "A login link was just sent to this account. Please wait a minute before requesting another." };
        }

        // 4. Generate Token
        const rawToken = randomUUID();
        const tokenHash = hashToken(rawToken);

        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15); // Valid for 15 minutes

        await prisma.loginToken.create({
            data: {
                token: tokenHash,
                discordId: targetDiscordId,
                discordUsername: targetDiscordUsername || username, // Use found username or original input
                expiresAt
            }
        });

        const baseUrl = getBaseUrl();
        const magicLink = `${baseUrl}/auth/login?token=${rawToken}`;

        // 5. Create DM & Send
        const channel = await createDMChannel(targetDiscordId, botToken);
        if (channel.error || !channel.id) {
            return { success: false, error: "Could not open a DM. Please check your privacy settings or ensure the bot is not blocked." };
        }

        const msg = `🔐 **Magic Login**\n\nClick here to access **My Events**:\n${magicLink}\n\n(Valid for 15 minutes)`;
        const sent = await sendDiscordMessage(channel.id, msg, botToken);

        if (sent.error) {
            return { success: false, error: "Failed to send DM. Check privacy settings." };
        }

        return { success: true, message: "Link sent! Check your Discord DMs." };

    } catch (e) {
        log.error("Discord Magic Link Error", e as Error);
        return { success: false, error: "Internal Server Error" };
    }
}
