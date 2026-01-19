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
import { dmManagerLink, generateShortRecoveryToken } from "@/features/event-management/server/recovery";
import { generateStatusMessage } from "@/shared/lib/status";

const log = Logger.get("DiscordActions");

export async function recoverDiscordManagerLink(slug: string, username: string) {
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
 * @param {string} slug - The event slug.
 */
export async function dmDiscordManagerLink(slug: string) {
    const event = await prisma.event.findUnique({ where: { slug } });
    if (!event || !event.managerDiscordId) return { error: "No manager linked." };

    const { token } = await generateShortRecoveryToken(slug);
    if (!token) return { error: "Failed to generate token." };

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
    const token = process.env.DISCORD_BOT_TOKEN;

    if (!token) return { success: false, error: "Server Configuration Error: Discord Token missing" };
    if (!username) return { success: false, error: "Please enter a username" };

    const normalized = username.toLowerCase().replace('@', '');

    try {
        // 1. Find User by Username (Case Insensitive-ish)
        // We prioritize explicit Participant records where we captured identity.
        const userRecords = await prisma.participant.findMany({
            where: {
                discordId: { not: null },
                OR: [
                    { discordUsername: { contains: normalized } },
                    { name: { contains: normalized } }
                ]
            },
            select: { discordId: true, discordUsername: true, name: true },
            take: 1
        });

        const match = userRecords[0];

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
                select: { managerDiscordId: true, managerDiscordUsername: true },
                take: 1
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
        const rawToken = randomUUID();
        const tokenHash = hashToken(rawToken);

        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);

        await prisma.loginToken.create({
            data: {
                token: tokenHash,
                discordId: targetId,
                discordUsername: targetUsername || username,
                expiresAt
            }
        });

        const baseUrl = getBaseUrl(headers());
        const magicLink = `${baseUrl}/auth/login?token=${rawToken}`;

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
        log.error("Discord Magic Link Error", e as Error);
        return { success: false, error: "Internal Server Error" };
    }
}
