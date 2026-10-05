"use server";

import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { cookies } from "next/headers";
import { getBaseUrl } from "@/shared/lib/url";
import { escapeDiscordMarkdown } from "@/shared/lib/escape";
import { z } from "zod";

import {
    getDiscordUser,
    sendDiscordMessage,
    pinDiscordMessage,
    getGuildChannels
} from "@/features/integrations/discord/model/discord";
import { dmManagerLink, recoverManagerLink } from "@/features/event-management/server/recovery";
import { generateStatusMessage } from "@/shared/lib/status";
import { verifyValue } from "@/shared/lib/session";
import { AppError, ForbiddenError, ValidationError } from "@/shared/errors";
import { requireEventAdmin } from "@/features/auth/server/verify";
import { guildCookieName, guildGrantPurpose, isDiscordSnowflake } from "@/features/integrations/discord/model/oauth-state";
import { getServerConfig } from "@/shared/config/server";
import { handleParam, slugParam } from "@/shared/lib/action-params";

const log = Logger.get("DiscordActions");

const recoverArgs = z.object({ slug: slugParam, username: handleParam });

export async function recoverDiscordManagerLink(slug: string, username: string) {
    if (!recoverArgs.safeParse({ slug, username }).success) {
        return toActionError(new ValidationError(), "Could not send the link. Please try again.");
    }
    username = username.replace('@', '').trim();
    const event = await prisma.event.findUnique({ where: { slug } });

    if (!event || !event.managerDiscordId) {
        return { error: "No Discord account linked to this event." };
    }

    const normalize = (name: string) => name.toLowerCase().replace('@', '').trim();
    const inputName = normalize(username);
    let storedName = event.managerDiscordUsername ? normalize(event.managerDiscordUsername) : null;

    if (!storedName || storedName !== inputName) {
        const discordBotToken = getServerConfig().discord.botToken;
        if (discordBotToken) {
            const discordUser = await getDiscordUser(event.managerDiscordId, discordBotToken);

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
        // The public path: re-matches the typed handle against the stored manager and DMs
        // only that Discord identity. dmManagerLink is admin only and would refuse this caller.
        return await recoverManagerLink(slug, username, "discord");
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

/**
 * The bot sits in ~100 guilds, so a guild ID from the client proves nothing. Only the guild
 * this admin just added the bot to (recorded by the OAuth callback in a signed, one-hour,
 * per-event cookie) may be listed or bound.
 */
async function requireGuildGrant(slug: string, guildId: string): Promise<void> {
    const cookieStore = await cookies();
    if (verifyValue(guildGrantPurpose(slug), cookieStore.get(guildCookieName(slug))?.value) !== guildId) {
        throw new ForbiddenError("Discord connection expired. Connect the server again.");
    }
}

/** Throws `ValidationError` unless `slug` is well formed, before it reaches a cookie name or query. */
function requireSlug(slug: unknown): void {
    if (!slugParam.safeParse(slug).success) throw new ValidationError();
}

/** `isDiscordSnowflake` rejects anything that is not a string of digits, so a bad type fails here too. */
function requireSnowflakes(...ids: string[]): void {
    if (!ids.every(isDiscordSnowflake)) throw new ValidationError("Invalid Discord ID");
}

export async function connectDiscordChannel(slug: string, guildId: string, channelId: string): Promise<ConnectChannelResult> {
    try {
        requireSlug(slug);
        await requireEventAdmin(slug);
        requireSnowflakes(guildId, channelId);
        await requireGuildGrant(slug, guildId);
    } catch (e) {
        return toActionError(e, "Failed to connect channel.");
    }

    const event = await prisma.event.findUnique({ where: { slug } });
    if (!event) return { error: "Event not found" };

    const token = getServerConfig().discord.botToken ?? undefined;
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
        const announcement = `📅 **Event Planning: ${escapeDiscordMarkdown(event.title)}**\nTime to vote!\n${baseUrl}/e/${slug}`;
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
        requireSlug(slug);
        await requireEventAdmin(slug);
        requireSnowflakes(guildId);
        await requireGuildGrant(slug, guildId);
    } catch (e) {
        return toActionError(e, "Failed to fetch channels");
    }

    const token = getServerConfig().discord.botToken ?? undefined;
    if (!token) return { error: "Server Configuration Error" };

    try {
        const channels = await getGuildChannels(guildId, token);
        return { success: true, channels };
    } catch {
        return { error: "Failed to fetch channels" };
    }
}

/**
 * Admin only: sends a Magic Link to the manager via Discord DM.
 *
 * Thin alias of the platform-neutral `dmManagerLink` (recovery.ts), kept for the
 * Discord UI. The link goes only to the manager's Discord DMs.
 *
 * @param {string} slug - The event slug.
 */
export async function dmDiscordManagerLink(slug: string) {
    // Delegates to the platform-neutral sender, limited to the Discord DM.
    return dmManagerLink(slug, "discord");
}
