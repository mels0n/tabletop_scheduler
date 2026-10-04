import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getWebhookSecret, handleTelegramUpdate, telegramUpdateSchema } from "@/features/telegram";
import { getServerConfig } from "@/shared/config/server";
import Logger from "@/shared/lib/logger";

const log = Logger.get("API:Webhook");

function secretMatches(given: string | null, expected: string): boolean {
    if (!given) return false;
    const a = Buffer.from(given, "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Telegram webhook transport. Authenticates the update, then hands it to the shared
 * handler (`handleTelegramUpdate`), which the long-polling transport also uses.
 *
 * The URL is public and every command has side effects, so a POST without the secret
 * registered via setWebhook is rejected with 401. After authentication the route always
 * answers 200, even when handling fails: any other status makes Telegram redeliver the
 * update and re-run its side effects (duplicate dashboards, login links, DMs).
 *
 * Transition note: right after a deploy that changes the secret, an in-flight update
 * arrives with the old header and is rejected. Startup re-registers the webhook when the
 * registration differs, so delivery resumes on Telegram's next retry.
 */
export async function POST(req: Request) {
    const token = getServerConfig().telegram.token;
    if (!token) {
        log.error("Config Error: TELEGRAM_BOT_TOKEN missing");
        return NextResponse.json({ error: "Config Error" }, { status: 500 });
    }

    if (!secretMatches(req.headers.get("x-telegram-bot-api-secret-token"), getWebhookSecret(token))) {
        log.warn("Rejected webhook update: missing or invalid secret token");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const update = telegramUpdateSchema.parse(await req.json());
        await handleTelegramUpdate(update);
    } catch (error) {
        log.error("Telegram webhook update failed", error as Error);
    }

    return NextResponse.json({ ok: true });
}
