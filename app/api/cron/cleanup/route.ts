import { NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { getServerConfig } from "@/shared/config/server";
import type { Prisma } from "@prisma/client";
import { requireCronAuth } from "@/shared/lib/cron-auth";
import { toResponse } from "@/shared/errors";

const log = Logger.get("API:CronCleanup");

export const dynamic = 'force-dynamic'; // Intent: Ensure not cached by Vercel Edge Cache.

/**
 * @function GET
 * @description Cron Job Handler for Automatic Data Retention / Cleanup.
 *
 * Responsibilities:
 * 1. Security: `requireCronAuth` (Bearer CRON_SECRET; rejected outright when no secret is set).
 * 2. Retention Logic: Defines different expiration periods based on event status:
 *    - FINALIZED one-shot: X days after the finalized slot starts.
 *    - FINALIZED campaign: X days after its last finalized session ends.
 *    - CANCELLED: Y days after cancellation (last update).
 *    - DRAFT: Z days without an edit, unless a proposed slot still ends inside that window.
 * 3. Execution: Deletes expired events in batches; the schema cascades to participants, votes, slots,
 *    finalized sessions and queued webhooks.
 * 4. Cleanup: Unpins associated Telegram messages to keep chat history clean.
 *
 * @param {Request} req - The incoming request.
 * @returns {NextResponse} JSON summary of the operation.
 */
export async function GET(req: Request) {
    // Security: Bearer CRON_SECRET (or loopback Host on a self-host box with no secret).
    try {
        requireCronAuth(req);
    } catch (e) {
        return toResponse(e, log.forRequest(req));
    }

    try {
        log.info("Cleanup job started");

        const { cleanupRetentionDays, telegram, discord } = getServerConfig();
        const now = Date.now();
        const cutoffFinalized = new Date(now - cleanupRetentionDays.finalized * DAY_MS);
        const cutoffDraft = new Date(now - cleanupRetentionDays.draft * DAY_MS);
        const cutoffCancelled = new Date(now - cleanupRetentionDays.cancelled * DAY_MS);

        const expired = expiredEventsWhere(cutoffFinalized, cutoffDraft, cutoffCancelled);

        let deletedCount = 0;
        let errors = 0;
        let scanned = 0;
        let deletedLoginTokens = 0;
        let cursor = 0;

        // Keyset pagination by id: rows that fail to delete are not re-read in the same run.
        for (;;) {
            const batch = await prisma.event.findMany({
                where: { AND: [expired, { id: { gt: cursor } }] },
                orderBy: { id: "asc" },
                take: BATCH_SIZE,
                select: CANDIDATE_FIELDS,
            });
            if (batch.length === 0) break;
            cursor = batch[batch.length - 1].id;
            scanned += batch.length;

            const toDelete = await dropLiveOneShots(batch, cutoffFinalized);
            if (toDelete.length > 0) {
                const { unpinChatMessage } = await import("@/features/telegram");
                const { unpinDiscordMessage } = await import("@/features/integrations/discord");

                for (const event of toDelete) {
                    // Cleanup pins: each platform independently; a failure never blocks deletion.
                    try {
                        if (event.telegramChatId && event.pinnedMessageId && telegram.token) {
                            await unpinChatMessage(event.telegramChatId, event.pinnedMessageId, telegram.token);
                        }
                    } catch (e) {
                        log.warn(`Failed to unpin Telegram message for ${event.slug}`, e as Error);
                    }

                    try {
                        if (event.discordChannelId && event.discordMessageId && discord.botToken) {
                            await unpinDiscordMessage(event.discordChannelId, event.discordMessageId, discord.botToken);
                        }
                    } catch (e) {
                        log.warn(`Failed to unpin Discord message for ${event.slug}`, e as Error);
                    }

                    try {
                        // Cascades to slots, participants, votes, finalized sessions and webhook rows.
                        await prisma.event.delete({ where: { id: event.id } });
                        log.info(`Deleted expired event: ${event.slug}`);
                        deletedCount++;
                    } catch (e) {
                        log.error(`Failed to delete event ${event.slug}`, e as Error);
                        errors++;
                    }
                }
            }

            if (batch.length < BATCH_SIZE) break;
        }

        try {
            deletedLoginTokens = await prisma.loginToken.deleteMany({
                where: { expiresAt: { lt: new Date() } }
            }).then(result => result.count);
            log.info(`Deleted expired LoginToken rows: ${deletedLoginTokens}`);
        } catch (cleanupError) {
            log.warn("Failed to delete expired LoginToken rows", cleanupError as Error);
        }

        return NextResponse.json({
            success: true,
            deleted: deletedCount,
            deletedLoginTokens,
            errors,
            scanned
        });

    } catch (error) {
        log.error("Cron Error", error as Error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 200;

/** Only what deletion and pin cleanup need; no user text is loaded. */
const CANDIDATE_FIELDS = {
    id: true,
    slug: true,
    status: true,
    eventType: true,
    finalizedSlotId: true,
    telegramChatId: true,
    pinnedMessageId: true,
    discordChannelId: true,
    discordMessageId: true,
} satisfies Prisma.EventSelect;

type Candidate = Prisma.EventGetPayload<{ select: typeof CANDIDATE_FIELDS }>;

/**
 * Events past retention. Everything except the one-shot rule is decided in the database;
 * one-shots are pre-filtered here and confirmed against their finalized slot in
 * `dropLiveOneShots`, because `finalizedSlotId` is not a relation Prisma can filter through.
 */
function expiredEventsWhere(cutoffFinalized: Date, cutoffDraft: Date, cutoffCancelled: Date): Prisma.EventWhereInput {
    return {
        OR: [
            // Campaign: its last finalized session ended before the cutoff.
            {
                status: "FINALIZED",
                eventType: "CAMPAIGN",
                finalizedSessions: { some: {}, none: { timeSlot: { endTime: { gte: cutoffFinalized } } } },
            },
            // Campaign finalized without any session rows: fall back to the last edit.
            {
                status: "FINALIZED",
                eventType: "CAMPAIGN",
                finalizedSessions: { none: {} },
                updatedAt: { lt: cutoffFinalized },
            },
            // One-shot: some slot started before the cutoff (confirmed against the finalized slot below).
            {
                status: "FINALIZED",
                eventType: { not: "CAMPAIGN" },
                finalizedSlotId: { not: null },
                timeSlots: { some: { startTime: { lt: cutoffFinalized } } },
            },
            { status: "CANCELLED", updatedAt: { lt: cutoffCancelled } },
            // Draft: no edit inside the window and no proposed slot still ending inside it.
            {
                status: "DRAFT",
                updatedAt: { lt: cutoffDraft },
                timeSlots: { none: { endTime: { gte: cutoffDraft } } },
            },
        ],
    };
}

/** Keeps a finalized one-shot only if its own finalized slot started before the cutoff. */
async function dropLiveOneShots(batch: Candidate[], cutoffFinalized: Date): Promise<Candidate[]> {
    const oneShots = batch.filter((e) => e.status === "FINALIZED" && e.eventType !== "CAMPAIGN");
    if (oneShots.length === 0) return batch;

    const expiredSlots = await prisma.timeSlot.findMany({
        where: {
            id: { in: oneShots.map((e) => e.finalizedSlotId).filter((id): id is number => id !== null) },
            startTime: { lt: cutoffFinalized },
        },
        select: { id: true, eventId: true },
    });
    const expiredSlotOwner = new Map(expiredSlots.map((s) => [s.id, s.eventId]));

    return batch.filter((e) => {
        if (e.status !== "FINALIZED" || e.eventType === "CAMPAIGN") return true;
        return e.finalizedSlotId !== null && expiredSlotOwner.get(e.finalizedSlotId) === e.id;
    });
}
