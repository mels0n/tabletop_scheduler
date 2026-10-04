import { NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { requireCronAuth } from "@/shared/lib/cron-auth";
import { toResponse } from "@/shared/errors";
import { attemptClaimedWebhook, claimableWhere } from "@/features/integrations/webhooks";

const log = Logger.get("Cron:Webhooks");

// Triggered by pg_cron on hosted, the start.sh loop on self-host, GitHub Actions as backstop.
export const dynamic = 'force-dynamic'; // Ensure not cached
export const maxDuration = 60; // Allow 60s execution

const BATCH_SIZE = 50;
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
 * Outcome per row (sequential, at most 50 per run), recorded by `attemptClaimedWebhook`, the
 * same code the immediate post-response attempt (`processWebhookRow`) uses:
 * - 2xx: status DELIVERED, lock released.
 * - refused destination (not https, or resolves to a private address): FAILED at once.
 * - other failure: attempts + 1. At 12 attempts the row becomes FAILED; otherwise RETRY with
 *   `nextAttempt = now + attempts^2 * 5 minutes` and the lock released.
 *
 * Most rows are delivered by the immediate attempt; this run is the retry path for the rest.
 */
export async function GET(req: Request) {
    try {
        requireCronAuth(req);

        const startedAt = Date.now();
        const now = new Date(startedAt);
        const claimable = claimableWhere(now);

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
            const outcome = await attemptClaimedWebhook(row);
            if (outcome === "delivered") summary.sent++;
            else if (outcome === "retry") summary.retried++;
            else summary.failed++;
        }

        return NextResponse.json(summary);
    } catch (error) {
        return toResponse(error, log.forRequest(req));
    }
}
