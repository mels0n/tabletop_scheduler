import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { deliverWebhook, WebhookRefusedError, type OutboxRow } from "./deliver";

const log = Logger.get("Webhooks");

/** A row is FAILED once this many attempts have failed. */
export const MAX_ATTEMPTS = 12;
const BACKOFF_MINUTES = 5;
/** A claim older than this is treated as abandoned (the run that took it crashed or timed out). */
export const LOCK_TTL_MS = 10 * 60 * 1000;

/** Outcome of one delivery attempt on a row this caller has claimed. */
export type WebhookAttemptOutcome = "delivered" | "retry" | "failed";

/**
 * The claim condition shared by the cron and the immediate attempt: status PENDING or RETRY,
 * due (`nextAttempt <= now`), and not locked, or locked longer ago than the lock TTL.
 * Used inside a conditional `updateMany`, so two claimants can never both win a row.
 */
export function claimableWhere(now: Date) {
    return {
        status: { in: ["PENDING", "RETRY"] },
        nextAttempt: { lte: now },
        OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(now.getTime() - LOCK_TTL_MS) } }],
    };
}

/**
 * Delivers one row the caller has already claimed (its `lockedAt` was set by the caller) and
 * records the outcome, always releasing the lock:
 * - 2xx: DELIVERED.
 * - refused destination (bad protocol, credentials in the URL, or resolves to a private
 *   address): FAILED at once.
 * - other failure, including a host that does not resolve (DNS timeout, SERVFAIL,
 *   EAI_AGAIN, NXDOMAIN): attempts + 1. At 12 attempts FAILED; otherwise RETRY with
 *   `nextAttempt = now + attempts^2 * 5 minutes`.
 */
export async function attemptClaimedWebhook(row: OutboxRow & { attempts: number }): Promise<WebhookAttemptOutcome> {
    try {
        await deliverWebhook(row);
        await prisma.webhookEvent.update({
            where: { id: row.id },
            data: { status: "DELIVERED", attempts: { increment: 1 }, lockedAt: null },
        });
        return "delivered";
    } catch (error) {
        const attempts = row.attempts + 1;
        log.warn("Webhook delivery failed", { id: row.id, attempts, error: String(error) });
        if (error instanceof WebhookRefusedError || attempts >= MAX_ATTEMPTS) {
            await prisma.webhookEvent.update({
                where: { id: row.id },
                data: { status: "FAILED", attempts, lockedAt: null },
            });
            return "failed";
        }
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
        return "retry";
    }
}

/**
 * Claims and delivers one queued webhook row by id. Used for the immediate attempt scheduled
 * with `after()` at each enqueue point; the cron is the retry path for anything this leaves.
 *
 * The claim is the same conditional `updateMany` the cron uses (`claimableWhere`), so a cron
 * run that overlaps can never deliver the row a second time. Returns `skipped` when the claim
 * matches nothing (already delivered, already claimed, or not yet due), otherwise the outcome
 * of `attemptClaimedWebhook`.
 */
export async function processWebhookRow(id: string): Promise<WebhookAttemptOutcome | "skipped"> {
    const now = new Date();
    const claim = await prisma.webhookEvent.updateMany({
        where: { id, ...claimableWhere(now) },
        data: { lockedAt: now },
    });
    if (claim.count === 0) return "skipped";

    const row = await prisma.webhookEvent.findFirst({ where: { id, lockedAt: now } });
    if (!row) return "skipped";
    return attemptClaimedWebhook(row);
}
