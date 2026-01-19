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
        const now = new Date();
        const pending = await prisma.webhookEvent.findMany({
            where: {
                status: "PENDING",
                nextAttempt: { lte: now }
            },
            take: 50,
            orderBy: { nextAttempt: 'asc' }
        });

        log.info("Processing pending webhooks", { count: pending.length });

        const results = await Promise.allSettled(pending.map(async (webhook) => {
            try {
                // 1. Attempt Delivery
                const res = await fetch(webhook.url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Tabletop-Event-Id": webhook.eventId.toString(),
                        "X-Webhook-Id": webhook.id
                    },
                    body: webhook.payload,
                    signal: AbortSignal.timeout(10000) // 10s timeout per request
                });

                if (res.ok) {
                    // Success
                    await prisma.webhookEvent.update({
                        where: { id: webhook.id },
                        data: {
                            status: "DELIVERED",
                            attempts: { increment: 1 }
                        }
                    });
                    return { id: webhook.id, status: "DELIVERED" };
                } else {
                    throw new Error(`HTTP ${res.status}`);
                }

            } catch (error) {
                // Failure Handling
                const attempts = webhook.attempts + 1;

                // Policy: Check if we've exceeded 1 hour from creation
                // 1 Hour = 60 mins = 3600000 ms
                const age = now.getTime() - webhook.createdAt.getTime();
                const TIMEOUT_MS = 60 * 60 * 1000;

                if (age > TIMEOUT_MS) {
                    // HARD FAIL
                    await prisma.webhookEvent.update({
                        where: { id: webhook.id },
                        data: {
                            status: "FAILED",
                            attempts: attempts
                        }
                    });
                    return { id: webhook.id, status: "FAILED", error: String(error) };
                } else {
                    // RETRY in 5 mins
                    const nextTime = new Date(now.getTime() + 5 * 60 * 1000);
                    await prisma.webhookEvent.update({
                        where: { id: webhook.id },
                        data: {
                            nextAttempt: nextTime,
                            attempts: attempts
                        }
                    });
                    return { id: webhook.id, status: "RETRY", error: String(error) };
                }
            }
        }));

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
