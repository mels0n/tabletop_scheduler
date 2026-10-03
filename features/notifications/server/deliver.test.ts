import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { sendTelegramMessageResult, sendDiscordMessage, sendDiscordDM } = vi.hoisted(() => ({
    sendTelegramMessageResult: vi.fn(),
    sendDiscordMessage: vi.fn(),
    sendDiscordDM: vi.fn(),
}));

vi.mock("@/features/telegram/lib/telegram-client", () => ({ sendTelegramMessageResult }));
vi.mock("@/features/integrations/discord/model/discord", () => ({ sendDiscordMessage, sendDiscordDM }));

import { broadcastToEvent, isDelivered } from "./deliver";
import { isPermanentFailure } from "./reminders/types";

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
        sendTelegramMessageResult.mockRejectedValue(new Error("telegram down"));
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

        expect(sendTelegramMessageResult).not.toHaveBeenCalled();
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
        expect(sendTelegramMessageResult).not.toHaveBeenCalled();
        expect(sendDiscordMessage).not.toHaveBeenCalled();
    });
});

describe("Telegram dead-chat errors", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.stubEnv("TELEGRAM_BOT_TOKEN", "tg-token");
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it("carries Telegram's 403 description into the failed result so it reads as permanent", async () => {
        const actual = await vi.importActual<typeof import("@/features/telegram/lib/telegram-client")>("@/features/telegram/lib/telegram-client");
        sendTelegramMessageResult.mockImplementation(actual.sendTelegramMessageResult);
        const body = { ok: false, error_code: 403, description: "Forbidden: bot was kicked from the group chat" };
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            headers: new Headers(),
            text: async () => JSON.stringify(body),
            json: async () => body,
        }));

        const result = await broadcastToEvent({ telegramChatId: "-100" }, { html: "hi" });

        expect(result.telegram.status).toBe("failed");
        const error = result.telegram.status === "failed" ? result.telegram.error : "";
        expect(error.toLowerCase()).toContain("forbidden");
        expect(isPermanentFailure("telegram", result.telegram)).toBe(true);
    });

    it("reports a sent message with its id", async () => {
        sendTelegramMessageResult.mockResolvedValue({ ok: true, value: 42 });

        const result = await broadcastToEvent({ telegramChatId: "-100" }, { html: "hi" });

        expect(result.telegram).toEqual({ status: "sent", messageId: "42" });
    });
});
