
import { NextResponse } from "next/server";
import Logger from "@/lib/logger";

const log = Logger.get("CronReminders");

export const dynamic = 'force-dynamic'; // Intent: Ensure fresh execution; no caching.

/**
 * @function GET
 * @description Cron endpoint to invoke the Telegram Reminder logic.
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
    const authHeader = request.headers.get('authorization');

    // basic security check for CRON_SECRET if desired, but Vercel protects cron routes usually
    // or we can rely on obfuscating the URL if strictly necessary, but for now open
    // Ideally, check for process.env.CRON_SECRET
    if (process.env.CRON_SECRET && `Bearer ${process.env.CRON_SECRET}` !== authHeader) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    log.info("triggering reminder check via API");

    try {
        const { checkReminders } = await import("@/lib/telegram-poller");
        const token = process.env.TELEGRAM_BOT_TOKEN;

        if (!token) {
            return NextResponse.json({ error: "No Bot Token" }, { status: 500 });
        }

        // Intent: Execute the core business logic defined in the library.
        await checkReminders(token);

        return NextResponse.json({ success: true });
    } catch (e) {
        log.error("Failed to run reminders", e as Error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
