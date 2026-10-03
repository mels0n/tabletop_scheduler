import { NextResponse } from "next/server";
import { ensureWebhook } from "@/features/telegram";
import { requireCronAuth } from "@/shared/lib/cron-auth";
import { getServerConfig } from "@/shared/config/server";
import { ConfigError, toResponse } from "@/shared/errors";
import Logger from "@/shared/lib/logger";

const log = Logger.get("API:TelegramSetup");

export const dynamic = 'force-dynamic'; // Ensure this never caches

/**
 * Re-registers the Telegram webhook. Maintenance endpoint: requires `Authorization: Bearer
 * <CRON_SECRET>` (see `requireCronAuth`). Failures return a generic error; details go to
 * the log only, because exception text can carry the bot token.
 */
export async function GET(request: Request) {
    try {
        requireCronAuth(request);

        const { telegram, baseUrl } = getServerConfig();
        if (!telegram.token || !baseUrl) {
            throw new ConfigError("Telegram setup needs TELEGRAM_BOT_TOKEN and NEXT_PUBLIC_BASE_URL");
        }

        log.info("Manual Telegram webhook setup triggered");
        const success = await ensureWebhook(baseUrl, telegram.token);
        if (!success) {
            log.warn("ensureWebhook returned false");
            return NextResponse.json({ success: false, error: "Webhook setup failed" }, { status: 500 });
        }
        return NextResponse.json({ success: true, message: "Webhook configured successfully" });
    } catch (e) {
        return toResponse(e, log);
    }
}
