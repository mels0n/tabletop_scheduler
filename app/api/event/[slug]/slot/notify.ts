import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";

const log = Logger.get("API:Slot:Notify");

export async function pushSlotUpdates(eventId: number, messageSnippet: string) {
    try {
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: { timeSlots: { include: { votes: true } } }
        });

        if (!event) return;

        const participantsCount = await prisma.participant.count({ where: { eventId } });

        const { getBaseUrl } = await import("@/shared/lib/url");
        const { headers } = await import("next/headers");
        const headerList = headers();
        const baseUrl = getBaseUrl(headerList);
        const { generateStatusMessage } = await import("@/shared/lib/status");

        const statusMsg = generateStatusMessage(event, participantsCount, baseUrl);

        // Telegram
        if (event.telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
            const { sendTelegramMessage, editMessageText, pinChatMessage } = await import("@/features/telegram");
            await sendTelegramMessage(event.telegramChatId, `📅 <b>Time Options Updated!</b>\n\n${messageSnippet} for <b>${event.title}</b>.`, process.env.TELEGRAM_BOT_TOKEN);

            if (event.pinnedMessageId) {
                await editMessageText(event.telegramChatId, event.pinnedMessageId, statusMsg, process.env.TELEGRAM_BOT_TOKEN);
            } else {
                const newMsgId = await sendTelegramMessage(event.telegramChatId, statusMsg, process.env.TELEGRAM_BOT_TOKEN);
                if (newMsgId) {
                    await pinChatMessage(event.telegramChatId, newMsgId, process.env.TELEGRAM_BOT_TOKEN);
                    await prisma.event.update({ where: { id: eventId }, data: { pinnedMessageId: newMsgId } });
                }
            }
        }

        // Discord
        if (event.discordChannelId && process.env.DISCORD_BOT_TOKEN) {
            const { sendDiscordMessage, editDiscordMessage, pinDiscordMessage } = await import("@/features/discord/model/discord");
            await sendDiscordMessage(event.discordChannelId, `📅 **Time Options Updated!**\n\n${messageSnippet} for **${event.title}**.`, process.env.DISCORD_BOT_TOKEN);

            const discordMsg = statusMsg
                .replace(/<b>(.*?)<\/b>/g, '**$1**')
                .replace(/<a href="(.*?)">(.*?)<\/a>/g, '[$2]($1)')
                .replace(/<br\s*\/?>/g, '\n')
                .replace(/&nbsp;/g, ' ');

            if (event.discordMessageId) {
                await editDiscordMessage(event.discordChannelId, event.discordMessageId, discordMsg, process.env.DISCORD_BOT_TOKEN);
            } else {
                const res = await sendDiscordMessage(event.discordChannelId, discordMsg, process.env.DISCORD_BOT_TOKEN);
                if (res.id) {
                    await pinDiscordMessage(event.discordChannelId, res.id, process.env.DISCORD_BOT_TOKEN);
                    await prisma.event.update({ where: { id: eventId }, data: { discordMessageId: res.id } });
                }
            }
        }
    } catch (error) {
        log.error("Failed to push slot updates", error as Error);
    }
}
