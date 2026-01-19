"use server";

import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { headers } from "next/headers";
import { getBaseUrl } from "@/shared/lib/url";
import { hashToken } from "@/shared/lib/token";
import { randomUUID } from "crypto";
import { sendTelegramMessage, getBotUsername } from "@/features/telegram/lib/telegram-client";

const log = Logger.get("MagicLinkActions");

/**
 * Sends a "Magic Link" to a user's global Telegram DM to log them in and view all their events.
 */
export async function sendGlobalMagicLink(handle: string) {
    const normalize = (h: string) => h.toLowerCase().replace('@', '').trim();
    const cleanHandle = normalize(handle);
    const formattedHandle = handle.startsWith('@') ? handle : `@${handle}`;

    if (cleanHandle.length < 2) {
        return { error: "Please enter a valid Telegram handle." };
    }

    try {
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

        let chatId = participant?.chatId;
        if (!chatId) {
            const manager = await prisma.event.findFirst({
                where: {
                    managerTelegram: formattedHandle,
                    NOT: { managerChatId: null }
                },
                select: { managerChatId: true }
            });
            chatId = manager?.managerChatId;
        }

        if (chatId) {
            const rawToken = randomUUID();
            const tokenHash = hashToken(rawToken);

            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 15);

            await prisma.loginToken.create({
                data: {
                    token: tokenHash,
                    chatId: chatId,
                    expiresAt
                }
            });

            const baseUrl = getBaseUrl(headers());
            const magicLink = `${baseUrl}/auth/login?token=${rawToken}`;

            await sendTelegramMessage(
                chatId,
                `🔐 <b>Magic Login Requested</b>\n\nSomeone (hopefully you) requested a link to view all your events.\n\n👉 <a href="${magicLink}">Click here to Login</a>\n\n(Valid for 15 minutes)`,
                process.env.TELEGRAM_BOT_TOKEN!
            );

            return { success: true, message: "Magic Link sent to your Telegram DMs!" };

        } else {
            const exists = await prisma.participant.count({
                where: { OR: [{ telegramId: cleanHandle }, { telegramId: formattedHandle }] }
            }) > 0 || await prisma.event.count({
                where: { managerTelegram: formattedHandle }
            }) > 0;

            if (exists) {
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
