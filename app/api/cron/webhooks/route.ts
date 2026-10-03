import { NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { requireCronAuth } from "@/shared/lib/cron-auth";
import { toResponse } from "@/shared/errors";
import { deliverWebhook, WebhookRefusedError } from "@/features/integrations/webhooks/server/deliver";

const log = Logger.get("Cron:Webhooks");

// Vercel Cron Config
export const dynamic = 'force-dynamic'; // Ensure not cached
export const maxDuration = 60; // Allow 60s execution

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 12;
const BACKOFF_MINUTES = 5;
/** A claim older than this is treated as abandoned (the run that took it crashed or timed out). */
const LOCK_TTL_MS = 10 * 60 * 1000;
/**
 * Work budget per run, well inside `maxDuration`. Once it is spent no further row is started;
 * the rest of this run's claim is released so the next run picks those rows up immediately
 * instead of waiting out the lock TTL.
 */
const RUN_BUDGET_MS = 45 * 1000;

/**
 * @function GET
 * @description Delivers queued webhook events (the outbox).
 *
 * Claiming: the due ids are selected (status PENDING/RETRY, `nextAttempt <= now`, not locked or
 * lock older than 10 minutes), then claimed with a conditional `updateMany` that stamps
 * `lockedAt = now`. The lock condition is re-checked inside that update, so two overlapping runs
 * can never both claim a row. Only rows carrying this run's `lockedAt` are processed.
 *
 * Time budget: no row is started once 45 seconds have passed since the run began; claimed rows
 * that were not started get `lockedAt` reset to null before the response.
 *
 * Outcome per row (sequential, at most 50 per run):
 * - 2xx: status DELIVERED, lock released.
 * - refused destination (not https, or resolves to a private address): FAILED at once.
 * - other failure: attempts + 1. At 12 attempts the row becomes FAILED; otherwise RETRY with
 *   `nextAttempt = now + attempts^2 * 5 minutes` and the lock released.
 */
export async function GET(req: Request) {
    try {
        requireCronAuth(req);

        const startedAt = Date.now();
        const now = new Date(startedAt);
        const staleBefore = new Date(now.getTime() - LOCK_TTL_MS);
        const claimable = {
            status: { in: ["PENDING", "RETRY"] },
            nextAttempt: { lte: now },
            OR: [{ lockedAt: null }, { lockedAt: { lt: staleBefore } }],
        };

        const candidates = await prisma.webhookEvent.findMany({
            where: claimable,
            select: { id: true },
            orderBy: { nextAttempt: 'asc' },
            take: BATCH_SIZE,
        });

        const summary = { processed: 0, sent: 0, retried: 0, failed: 0, deferred: 0 };
        if (candidates.length === 0) return NextResponse.json(summary);

        const ids = candidates.map(c => c.id);
        const claim = await prisma.webhookEvent.updateMany({
            where: { id: { in: ids }, ...claimable },
            data: { lockedAt: now },
        });
        if (claim.count === 0) return NextResponse.json(summary);

        const claimed = await prisma.webhookEvent.findMany({
            where: { id: { in: ids }, lockedAt: now },
            orderBy: { nextAttempt: 'asc' },
        });

        log.info("Processing webhooks", { count: claimed.length });

        for (const [index, row] of claimed.entries()) {
            if (Date.now() - startedAt >= RUN_BUDGET_MS) {
                const unstarted = claimed.slice(index).map(r => r.id);
                await prisma.webhookEvent.updateMany({
                    where: { id: { in: unstarted }, lockedAt: now },
                    data: { lockedAt: null },
                });
                summary.deferred = unstarted.length;
                log.info("Webhook run budget spent; released the rest of the claim", { deferred: unstarted.length });
                break;
            }
            summary.processed++;
            try {
                await deliverWebhook(row);
                await prisma.webhookEvent.update({
                    where: { id: row.id },
                    data: { status: "DELIVERED", attempts: { increment: 1 }, lockedAt: null },
                });
                summary.sent++;
            } catch (error) {
                const attempts = row.attempts + 1;
                if (error instanceof WebhookRefusedError || attempts >= MAX_ATTEMPTS) {
                    await prisma.webhookEvent.update({
                        where: { id: row.id },
                        data: { status: "FAILED", attempts, lockedAt: null },
                    });
                    summary.failed++;
                } else {
                    const delayMs = attempts * attempts * BACKOFF_MINUTES * 60 * 1000;
                    await prisma.webhookEvent.update({
                        where: { id: row.id },
                        data: {
                            status: "RETRY",
                            attempts,
                            nextAttempt: new Date(Date.now() + delayMs),
                            lockedAt: null,
                        },
                    });
                    summary.retried++;
                }
                log.warn("Webhook delivery failed", { id: row.id, attempts, error: String(error) });
            }
        }

        return NextResponse.json(summary);
    } catch (error) {
        return toResponse(error, log.forRequest(req));
    }
}
