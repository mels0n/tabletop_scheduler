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
 * Initiates the recovery process for a manager link via Telegram DM.
 */
export async function recoverManagerLink(slug: string, handle: string) {
    const event = await prisma.event.findUnique({ where: { slug } });

    if (!event || !event.managerTelegram) {
        return { error: "No manager linked to this event." };
    }

    const normalize = (h: string) => h.toLowerCase().replace('@', '').trim();

    if (normalize(event.managerTelegram) === normalize(handle)) {
        if (!event.managerChatId) {
            return { error: "Handle matched, but the bot hasn't connected with you yet. Please open the bot and click 'Start' first." };
        }

        const baseUrl = getBaseUrl(headers());
        const newToken = randomUUID();
        const newHash = hashToken(newToken);

        await prisma.event.update({
            where: { id: event.id },
            data: { adminToken: newHash }
        });

        const magicLink = `${baseUrl}/api/event/${slug}/auth?token=${newToken}`;

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
}

/**
 * Directly requests a recovery link sent to the manager's DM.
 */
export async function dmManagerLink(slug: string) {
    const event = await prisma.event.findUnique({ where: { slug } });

    if (!event || !event.managerTelegram) {
        return { error: "No manager linked to this event." };
    }

    if (!event.managerChatId) {
        return { error: `Bot doesn't know you yet. Please start the bot first!` };
    }

    const baseUrl = getBaseUrl(headers());
    const newToken = randomUUID();
    const newHash = hashToken(newToken);

    await prisma.event.update({
        where: { id: event.id },
        data: { adminToken: newHash }
    });

    const magicLink = `${baseUrl}/api/event/${slug}/auth?token=${newToken}`;

    log.info("Sending DM recovery link", { slug, chatId: event.managerChatId });

    await sendTelegramMessage(event.managerChatId, `🔑 <b>Manager Link Recovery</b>\n\nClick here to manage <b>${event.title}</b>:\n${magicLink}`, process.env.TELEGRAM_BOT_TOKEN!);

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
