import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { sendTelegramMessageResult, sendDiscordMessage, sendDiscordDM } = vi.hoisted(() => ({
    sendTelegramMessageResult: vi.fn(),
    sendDiscordMessage: vi.fn(),
    sendDiscordDM: vi.fn(),
}));

vi.mock("@/features/telegram/lib/telegram-client", () => ({ sendTelegramMessageResult }));
vi.mock("@/features/integrations/discord/model/discord", () => ({ sendDiscordMessage, sendDiscordDM }));
vi.mock("@/shared/lib/prisma");

import prisma from "@/shared/lib/prisma";
import { broadcastToEvent, sendDirectMessage, isDelivered } from "./deliver";
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

describe("sendDirectMessage DM opt-out", () => {
    const findPreference = prisma.dmPreference.findUnique as unknown as ReturnType<typeof vi.fn>;
    const optedOutOn = (platform: "telegram" | "discord") =>
        async ({ where }: { where: { platform_platformId: { platform: string } } }) =>
            where.platform_platformId.platform === platform ? { dmOptOut: true } : null;

    beforeEach(() => {
        vi.resetAllMocks();
        vi.stubEnv("TELEGRAM_BOT_TOKEN", "tg-token");
        vi.stubEnv("DISCORD_BOT_TOKEN", "dc-token");
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("skips an opted-out platform with reason opted_out and still delivers on the other", async () => {
        findPreference.mockImplementation(optedOutOn("telegram"));
        sendDiscordDM.mockResolvedValue({ id: "d1" });

        const result = await sendDirectMessage({ telegramChatId: "111", discordUserId: "222" }, { html: "hi" });

        expect(result.telegram).toEqual({ status: "skipped", reason: "opted_out" });
        expect(sendTelegramMessageResult).not.toHaveBeenCalled();
        expect(result.discord).toEqual({ status: "sent", messageId: "d1" });
        expect(isDelivered(result)).toBe(true);
        expect(findPreference).toHaveBeenCalledWith(
            expect.objectContaining({ where: { platform_platformId: { platform: "telegram", platformId: "111" } } })
        );
    });

    it("delivers nothing when every linked platform is opted out", async () => {
        findPreference.mockResolvedValue({ dmOptOut: true });

        const result = await sendDirectMessage({ telegramChatId: "111", discordUserId: "222" }, { html: "hi" });

        expect(result).toEqual({
            telegram: { status: "skipped", reason: "opted_out" },
            discord: { status: "skipped", reason: "opted_out" },
        });
        expect(isDelivered(result)).toBe(false);
        expect(sendTelegramMessageResult).not.toHaveBeenCalled();
        expect(sendDiscordDM).not.toHaveBeenCalled();
    });

    it("respectOptOut: false sends a requested message despite the preference", async () => {
        findPreference.mockResolvedValue({ dmOptOut: true });
        sendTelegramMessageResult.mockResolvedValue({ ok: true, value: 7 });

        const result = await sendDirectMessage(
            { telegramChatId: "111", discordUserId: null },
            { html: "login link" },
            { purpose: "test" },
            { respectOptOut: false }
        );

        expect(result.telegram).toEqual({ status: "sent", messageId: "7" });
        expect(findPreference).not.toHaveBeenCalled();
    });

    it("does not look up a preference for a platform the target has not linked", async () => {
        findPreference.mockResolvedValue(null);
        sendDiscordDM.mockResolvedValue({ id: "d1" });

        const result = await sendDirectMessage({ telegramChatId: null, discordUserId: "222" }, { html: "hi" });

        expect(result.telegram).toEqual({ status: "skipped", reason: "not_linked" });
        expect(findPreference).toHaveBeenCalledTimes(1);
    });

    it("fails closed when the preference lookup fails: nothing is sent and an error is logged", async () => {
        findPreference.mockRejectedValue(new Error("db down"));
        sendDiscordDM.mockResolvedValue({ id: "d1" });
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

        const result = await sendDirectMessage({ discordUserId: "222" }, { html: "hi" });

        expect(result.discord).toEqual({ status: "failed", error: "preference_unavailable" });
        expect(sendDiscordDM).not.toHaveBeenCalled();
        expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("DM preference lookup failed"));
        // Transient: a reminder retries it later rather than marking the user unreachable.
        expect(isPermanentFailure("discord", result.discord)).toBe(false);
        errorLog.mockRestore();
    });

    it("a requested message (respectOptOut: false) never depends on the preference lookup", async () => {
        findPreference.mockRejectedValue(new Error("db down"));
        sendDiscordDM.mockResolvedValue({ id: "d1" });

        const result = await sendDirectMessage({ discordUserId: "222" }, { html: "login" }, undefined, { respectOptOut: false });

        expect(result.discord).toEqual({ status: "sent", messageId: "d1" });
    });
});
