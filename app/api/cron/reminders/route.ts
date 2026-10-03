
import { NextResponse } from "next/server";
import Logger from "@/shared/lib/logger";
import { requireCronAuth } from "@/shared/lib/cron-auth";
import { toResponse } from "@/shared/errors";
import { getServerConfig } from "@/shared/config/server";

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
 * @returns {NextResponse} 200 with per-type counts; 500 when a whole run threw, so the
 * scheduler (pg_cron, the GitHub backstop's `curl --fail`) records the failure.
 */
export async function GET(request: Request) {
    try {
        requireCronAuth(request);
    } catch (e) {
        return toResponse(e, log.forRequest(request));
    }

    log.info("triggering reminder check via API");

    try {
        // Intent: Telegram and Discord are peers. Only skip when neither bot is configured.
        const { telegram, discord } = getServerConfig();
        if (!telegram.token && !discord.botToken) {
            return NextResponse.json({ success: true, skipped: "no bot configured" });
        }

        const { runReminders } = await import("@/features/notifications");
        const { ok, voting, session } = await runReminders();
        if (!ok) {
            return toResponse(new Error("Reminder run failed"), log.forRequest(request));
        }

        return NextResponse.json({ success: true, voting, session });
    } catch (e) {
        return toResponse(e, log.forRequest(request));
    }
}
