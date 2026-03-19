"use server";

import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { cookies, headers } from "next/headers";
import { getBaseUrl } from "@/shared/lib/url";
import { hashToken } from "@/shared/lib/token";
import { randomUUID } from "crypto";

import {
    getDiscordUser,
    sendDiscordMessage,
    pinDiscordMessage,
    getGuildChannels,
    createDMChannel
} from "@/features/discord/model/discord";
import { dmManagerLink, generateManagerMagicLink } from "@/features/event-management/server/recovery";
import { generateStatusMessage } from "@/shared/lib/status";

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
        return await dmManagerLink(slug);
    }

    log.warn("Manager Discord recovery failed: Username mismatch", { slug, input: username, stored: storedName });
    return { error: "Discord username does not match our records." };
}

export async function connectDiscordChannel(slug: string, guildId: string, channelId: string) {
    const event = await prisma.event.findUnique({ where: { slug } });
    if (!event) return { error: "Event not found" };

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return { error: "Server Configuration Error: Discord Token missing" };

    try {
        const cookieStore = cookies();
        const discordUserId = cookieStore.get("tabletop_user_discord_id")?.value;
        const discordUsername = cookieStore.get("tabletop_user_discord_name")?.value;

        const dataToUpdate: any = {
            discordGuildId: guildId,
            discordChannelId: channelId
        };

        if (discordUserId) {
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

        const baseUrl = getBaseUrl(headers());
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
            const cleanMsg = statusMsg.replace(/<[^>]*>?/gm, '');

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

export async function listDiscordChannels(guildId: string) {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return { error: "Server Configuration Error" };

    try {
        const channels = await getGuildChannels(guildId, token);
        return { success: true, channels };
    } catch (e) {
        return { error: "Failed to fetch channels" };
    }
}

/**
 * Sends a Magic Link to the manager via Discord DM.
 *
 * Transport-only wrapper around `generateManagerMagicLink`.
 * Identical in intent to the Telegram `dmManagerLink`.
 *
 * @param {string} slug - The event slug.
 */
export async function dmDiscordManagerLink(slug: string) {
    const event = await prisma.event.findUnique({ where: { slug } });
    if (!event || !event.managerDiscordId) return { error: "No manager linked." };

    const botToken = process.env.DISCORD_BOT_TOKEN || "";

    // 1. Generate link (rotates adminToken, builds auth-endpoint URL)
    const magicLink = await generateManagerMagicLink(slug);

    // 2. Open DM Channel
    const dmRes = await createDMChannel(event.managerDiscordId, botToken);
    if (dmRes.error || !dmRes.id) {
        return { error: "Could not open DM channel. Bot might be blocked." };
    }

    // 3. Send Message
    const msg = `**Magic Link Request**\nHere is your link to manage **${event.title}**:\n${magicLink}\n\n(This link expires when a new one is requested)`;
    const sendRes = await sendDiscordMessage(dmRes.id, msg, botToken);

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
    username = username.replace('@', '').trim();
    const botToken = process.env.DISCORD_BOT_TOKEN;

    if (!botToken) return { success: false, error: "Server Configuration Error: Discord Token missing" };
    if (!username) return { success: false, error: "Please enter a username" };

    const normalizedUsername = username.toLowerCase().replace('@', '');

    let targetDiscordId: string | null = null;
    let targetDiscordUsername: string | null = null;

    try {
        const cookieStore = cookies();
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
        if (!targetDiscordId) {
            // Search participant records by username
            const participantByUsername = await prisma.participant.findFirst({
                where: {
                    discordId: { not: null },
                    OR: [
                        { discordUsername: { contains: normalizedUsername } },
                        { name: { contains: normalizedUsername } }
                    ]
                },
                select: { discordId: true, discordUsername: true }
            });

            if (participantByUsername) {
                targetDiscordId = participantByUsername.discordId;
                targetDiscordUsername = participantByUsername.discordUsername;
            } else {
                // Search event manager records by username
                const managerByUsername = await prisma.event.findFirst({
                    where: {
                        managerDiscordId: { not: null },
                        managerDiscordUsername: { contains: normalizedUsername }
                    },
                    select: { managerDiscordId: true, managerDiscordUsername: true }
                });

                if (managerByUsername) {
                    targetDiscordId = managerByUsername.managerDiscordId;
                    targetDiscordUsername = managerByUsername.managerDiscordUsername;
                }
            }
        }

        // 3. If no user found after all attempts
        if (!targetDiscordId) {
            return { success: false, error: "We couldn't find a record for this username. Have you voted on an event using the 'Log in with Discord' button before?" };
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

        const baseUrl = getBaseUrl(headers());
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
