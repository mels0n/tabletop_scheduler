import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { sendTelegramMessage, sendDiscordMessage, sendDiscordDM } = vi.hoisted(() => ({
    sendTelegramMessage: vi.fn(),
    sendDiscordMessage: vi.fn(),
    sendDiscordDM: vi.fn(),
}));

vi.mock("@/features/telegram/lib/telegram-client", () => ({ sendTelegramMessage }));
vi.mock("@/features/discord/model/discord", () => ({ sendDiscordMessage, sendDiscordDM }));

import { broadcastToEvent, isDelivered } from "./deliver";

describe("broadcastToEvent", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.stubEnv("TELEGRAM_BOT_TOKEN", "tg-token");
        vi.stubEnv("DISCORD_BOT_TOKEN", "dc-token");
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("still delivers to Discord when Telegram throws", async () => {
        sendTelegramMessage.mockRejectedValue(new Error("telegram down"));
        sendDiscordMessage.mockResolvedValue({ id: "m1" });

        const result = await broadcastToEvent({ telegramChatId: "1", discordChannelId: "2" }, { html: "<b>hi</b>" });

        expect(result.telegram.status).toBe("failed");
        expect(result.discord).toEqual({ status: "sent", messageId: "m1" });
        expect(isDelivered(result)).toBe(true);
        expect(sendDiscordMessage).toHaveBeenCalledWith("2", expect.stringContaining("hi"), "dc-token");
    });

    it("skips platforms with no link", async () => {
        sendDiscordMessage.mockResolvedValue({ id: "m1" });

        const result = await broadcastToEvent({ discordChannelId: "2" }, { html: "x" });

        expect(sendTelegramMessage).not.toHaveBeenCalled();
        expect(result.telegram).toEqual({ status: "skipped", reason: "not_linked" });
        expect(isDelivered(result)).toBe(true);
    });

    it("skips with not_configured when tokens are missing", async () => {
        vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
        vi.stubEnv("DISCORD_BOT_TOKEN", "");

        const result = await broadcastToEvent({ telegramChatId: "1", discordChannelId: "2" }, { html: "x" });

        expect(result.telegram).toEqual({ status: "skipped", reason: "not_configured" });
        expect(result.discord).toEqual({ status: "skipped", reason: "not_configured" });
        expect(isDelivered(result)).toBe(false);
        expect(sendTelegramMessage).not.toHaveBeenCalled();
        expect(sendDiscordMessage).not.toHaveBeenCalled();
    });
});
