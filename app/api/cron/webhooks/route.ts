import { NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";

const log = Logger.get("Cron:Webhooks");

// Vercel Cron Config
export const dynamic = 'force-dynamic'; // Ensure not cached
export const maxDuration = 60; // Allow 60s execution

/**
 * @function GET
 * @description Processes pending webhook events.
 * 
 * Logic:
 * 1. Find PENDING webhooks where nextAttempt <= now.
 * 2. Loop through them (batch size 50).
 * 3. POST JSON payload.
 * 4. On Success (200-299): Status -> DELIVERED.
 * 5. On Failure:
 *    - Increment attempts.
 *    - Schedule next attempt + 5 minutes.
 *    - If total time > 1 hour (approx 12 attempts), Status -> FAILED.
 */
export async function GET() {
    try {
        const { processWebhook } = await import("@/shared/lib/webhook-sender");
        const now = new Date();
        const pending = await prisma.webhookEvent.findMany({
            where: {
                status: { in: ["PENDING", "RETRY"] },
                nextAttempt: { lte: now }
            },
            take: 50,
            orderBy: { nextAttempt: 'asc' }
        });

        log.info("Processing pending webhooks", { count: pending.length });

        const results = await Promise.allSettled(pending.map(webhook => processWebhook(webhook.id)));

        // Summarize
        const delivered = results.filter(r => r.status === 'fulfilled' && (r.value as any).status === 'DELIVERED').length;
        const retrying = results.filter(r => r.status === 'fulfilled' && (r.value as any).status === 'RETRY').length;
        const failed = results.filter(r => r.status === 'fulfilled' && (r.value as any).status === 'FAILED').length;

        return NextResponse.json({
            processed: pending.length,
            delivered,
            retrying,
            failed
        });

    } catch (error) {
        log.error("Webhook processing failed", error as Error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
