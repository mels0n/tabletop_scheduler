
import { NextResponse } from "next/server";
import Logger from "@/shared/lib/logger";
import { requireCronAuth } from "@/shared/lib/cron-auth";
import { toResponse } from "@/shared/errors";

const log = Logger.get("CronReminders");

export const dynamic = 'force-dynamic'; // Intent: Ensure fresh execution; no caching.

/**
 * @function GET
 * @description Cron endpoint to run voting and session reminders for Telegram and Discord events.
 *
 * Pattern: Trigger-Action.
 * Why? Next.js Server Actions or long-running processes (like poller loops) are hard to keep alive in Serverless.
 * This endpoint provides a "hook" that can be hit externally (Vercel Cron) or internally (Docker Loop)
 * to spin up the reminder check logic on demand.
 *
 * @param {Request} request - The trigger request.
 * @returns {NextResponse} Success/Failure status.
 */
export async function GET(request: Request) {
    try {
        requireCronAuth(request);
    } catch (e) {
        return toResponse(e, log);
    }

    log.info("triggering reminder check via API");

    try {
        // Intent: Telegram and Discord are peers. Only skip when neither bot is configured.
        if (!process.env.TELEGRAM_BOT_TOKEN && !process.env.DISCORD_BOT_TOKEN) {
            return NextResponse.json({ success: true, skipped: "no bot configured" });
        }

        const { runReminders } = await import("@/features/notifications");
        const summary = await runReminders();

        return NextResponse.json({ success: true, ...summary });
    } catch (e) {
        log.error("Failed to run reminders", e as Error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
