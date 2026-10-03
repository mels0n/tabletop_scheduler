"use server";

import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { getBaseUrl } from "@/shared/lib/url";
import { hashToken } from "@/shared/lib/token";
import { randomUUID, randomBytes } from "crypto";
import { sendDirectMessage, isDelivered } from "@/features/notifications";
import { normalizeHandle } from "@/shared/lib/handle";

const log = Logger.get("RecoveryActions");

/**
 * Rotates the event's adminToken and returns a ready-to-use magic link URL.
 *
 * This is the single source of truth for manager authentication link generation.
 * All transports (Telegram, Discord) call this and only handle the delivery.
 *
 * @param {string} slug - The event slug.
 * @returns {Promise<string>} The fully-qualified magic link URL.
 */
export async function generateManagerMagicLink(slug: string): Promise<string> {
    const rawToken = randomUUID();
    const tokenHash = hashToken(rawToken);

    await prisma.event.update({
        where: { slug },
        data: { adminToken: tokenHash }
    });

    const baseUrl = getBaseUrl();
    return `${baseUrl}/api/event/${slug}/auth?token=${rawToken}`;
}

type ManagerLinkEvent = {
    title: string;
    managerChatId: string | null;
    managerDiscordId: string | null;
};

/**
 * Rotates the admin token and DMs the magic link on every platform the manager
 * has linked (Telegram, Discord, or both). Succeeds if at least one DM lands.
 */
async function deliverManagerLink(slug: string, event: ManagerLinkEvent) {
    const magicLink = await generateManagerMagicLink(slug);
    const result = await sendDirectMessage(
        { telegramChatId: event.managerChatId, discordUserId: event.managerDiscordId },
        { html: `🔐 <b>Manager Link Recovery</b>\n\nClick here to manage <b>${event.title}</b>:\n${magicLink}\n\nThis link expires when a new one is requested.` },
        { slug, purpose: "manager-recovery" }
    );

    if (!isDelivered(result)) {
        log.warn("Manager recovery DM was not delivered", { slug, telegram: result.telegram.status, discord: result.discord.status });
        return { error: "Could not deliver the link. Check that the bot can message you, then try again." };
    }

    const platforms = [
        result.telegram.status === "sent" ? "Telegram" : null,
        result.discord.status === "sent" ? "Discord" : null,
    ].filter(Boolean).join(" and ");
    log.info("Manager recovery DM sent", { slug, platforms });
    return { success: true, message: `Recovery link sent to your ${platforms} DMs!` };
}

/**
 * Initiates the recovery process for a manager link.
 * Verifies the handle (Telegram handle or Discord username), generates a magic
 * link, and DMs it on every platform the manager has linked.
 */
export async function recoverManagerLink(slug: string, handle: string) {
    const event = await prisma.event.findUnique({ where: { slug } });

    if (!event || (!event.managerTelegram && !event.managerDiscordId)) {
        return { error: "No manager linked to this event." };
    }

    const input = normalizeHandle(handle);
    const matchesTelegram = !!input && normalizeHandle(event.managerTelegram) === input;
    const matchesDiscord = !!input && normalizeHandle(event.managerDiscordUsername) === input;

    if (!matchesTelegram && !matchesDiscord) {
        log.warn("Manager recovery failed: Handle mismatch", { slug, inputHandle: handle });
        return { error: "Handle does not match our records." };
    }

    if (!event.managerChatId && !event.managerDiscordId) {
        return { error: "Handle matched, but the bot hasn't connected with you yet. Please open the bot and click 'Start' first." };
    }

    return deliverManagerLink(slug, event);
}

/**
 * Sends a magic link to the manager's linked DMs (Telegram and/or Discord) without
 * requiring handle verification. Used for the one-click flow from the manage page.
 */
export async function dmManagerLink(slug: string) {
    const event = await prisma.event.findUnique({ where: { slug } });

    if (!event || (!event.managerTelegram && !event.managerDiscordId)) {
        return { error: "No manager linked to this event." };
    }

    if (!event.managerChatId && !event.managerDiscordId) {
        return { error: `Bot doesn't know you yet. Please start the bot first!` };
    }

    return deliverManagerLink(slug, event);
}

/**
 * Generates a short, temporary recovery token for non-Telegram workflows.
 */
export async function generateShortRecoveryToken(slug: string) {
    const rawToken = randomBytes(4).toString('hex');
    const tokenHash = hashToken(rawToken);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    try {
        await prisma.event.update({
            where: { slug },
            data: {
                recoveryToken: tokenHash,
                recoveryTokenExpires: expiresAt
            }
        });
        return { success: true, token: rawToken };
    } catch (e) {
        log.error("Failed to generate recovery token", e as Error);
        return { error: "Failed to generate token" };
    }
}
