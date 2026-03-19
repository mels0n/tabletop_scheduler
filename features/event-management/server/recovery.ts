"use server";

import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { headers } from "next/headers";
import { getBaseUrl } from "@/shared/lib/url";
import { hashToken } from "@/shared/lib/token";
import { randomUUID, randomBytes } from "crypto";
import { sendTelegramMessage } from "@/features/telegram/lib/telegram-client";

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

    const baseUrl = getBaseUrl(headers());
    return `${baseUrl}/api/event/${slug}/auth?token=${rawToken}`;
}

/**
 * Initiates the recovery process for a manager link via Telegram DM.
 * Verifies the handle, generates a magic link, and sends it via Telegram.
 */
export async function recoverManagerLink(slug: string, handle: string) {
    const event = await prisma.event.findUnique({ where: { slug } });

    if (!event || !event.managerTelegram) {
        return { error: "No manager linked to this event." };
    }

    const normalize = (h: string) => h.toLowerCase().replace('@', '').trim();

    const formattedHandle = handle.startsWith("@") ? handle : `@${handle}`;

    if (normalize(event.managerTelegram) !== normalize(handle)) {
        log.warn("Manager recovery failed: Handle mismatch", { slug, inputHandle: formattedHandle });
        return { error: "Telegram handle does not match our records." };
    }

    if (!event.managerChatId) {
        return { error: "Handle matched, but the bot hasn't connected with you yet. Please open the bot and click 'Start' first." };
    }

    const magicLink = await generateManagerMagicLink(slug);
    await sendTelegramMessage(
        event.managerChatId,
        `🔐 <b>Login Request</b>\n\nClick here to manage "${event.title}":\n${magicLink}`,
        process.env.TELEGRAM_BOT_TOKEN!
    );

    log.info("Manager recovery DM sent", { slug, chatId: event.managerChatId });
    return { success: true, message: "Recovery link sent to your Telegram DMs!" };
}

/**
 * Sends a magic link to the manager's Telegram DM without requiring handle verification.
 * Used for the "I already know who I am" one-click flow from the manage page.
 */
export async function dmManagerLink(slug: string) {
    const event = await prisma.event.findUnique({ where: { slug } });

    if (!event || !event.managerTelegram) {
        return { error: "No manager linked to this event." };
    }

    if (!event.managerChatId) {
        return { error: `Bot doesn't know you yet. Please start the bot first!` };
    }

    const magicLink = await generateManagerMagicLink(slug);
    log.info("Sending DM recovery link", { slug, chatId: event.managerChatId });

    await sendTelegramMessage(
        event.managerChatId,
        `🔑 <b>Manager Link Recovery</b>\n\nClick here to manage <b>${event.title}</b>:\n${magicLink}`,
        process.env.TELEGRAM_BOT_TOKEN!
    );

    return { success: true };
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
