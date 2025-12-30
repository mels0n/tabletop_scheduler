import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import Logger from "@/lib/logger";

const log = Logger.get("API:CronCleanup");

export const dynamic = 'force-dynamic'; // Intent: Ensure not cached by Vercel Edge Cache.

/**
 * @function GET
 * @description Cron Job Handler for Automatic Data Retention / Cleanup.
 *
 * Responsibilities:
 * 1. Security: Validates requester source (Localhost Loopback OR Vercel Cron Secret).
 * 2. Retention Logic: Defines different expiration periods based on event status:
 *    - FINALIZED: Kept for X days after the *event start time* (e.g., to view details post-event).
 *    - CANCELLED: Kept for Y days (e.g., for reference).
 *    - DRAFT: Kept for Z days after *creation* or *last proposed slot* (to clear abandoned polls).
 * 3. Execution: Deletes expired events and their relational data (participants, votes, slots) transactionally.
 * 4. Cleanup: Unpins associated Telegram messages to keep chat history clean.
 *
 * @param {Request} req - The incoming request.
 * @returns {NextResponse} JSON summary of the operation.
 */
export async function GET(req: Request) {
    try {
        log.info("Cleanup job started");

        // Security: Restrict to Localhost (Docker internal cron) OR Authorized Vercel Cron
        // Requests from 127.0.0.1 or ::1 allowed.
        const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
        const isLocal = ip.includes("127.0.0.1") || ip.includes("::1");

        // Check for CRON_SECRET authorization
        const authHeader = req.headers.get("authorization");
        // Bearer token check
        const isAuthorized = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

        // STRICT SECURITY: We ONLY allow local requests (from loopback) OR verified secret.
        if (!isLocal && !isAuthorized) {
            log.warn("Blocked external cron attempt", { ip, hasAuth: !!authHeader });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Configurable Retention (Default: 1 Day)
        const daysFinalized = parseInt(process.env.CLEANUP_RETENTION_DAYS_FINALIZED || "1");
        const daysDraft = parseInt(process.env.CLEANUP_RETENTION_DAYS_DRAFT || "1");
        const daysCancelled = parseInt(process.env.CLEANUP_RETENTION_DAYS_CANCELLED || "1");

        const now = new Date();

        const cutoffFinalized = new Date(now);
        cutoffFinalized.setDate(now.getDate() - daysFinalized);

        const cutoffDraft = new Date(now);
        cutoffDraft.setDate(now.getDate() - daysDraft);

        const cutoffCancelled = new Date(now);
        cutoffCancelled.setDate(now.getDate() - daysCancelled);

        // Fetch candidate events that might be expired.
        const candidateEvents = await prisma.event.findMany({
            where: {
                OR: [
                    { status: 'FINALIZED' },
                    { status: 'CANCELLED' },
                    { timeSlots: { some: {} } }
                ]
            },
            include: {
                timeSlots: true
            }
        });

        // Intent: Filter in memory to handle complex logic involving relation (timeSlots) dates.
        const eventsToDelete = candidateEvents.filter(event => {
            if (event.status === 'CANCELLED') {
                if (event.finalizedSlotId) {
                    const slot = event.timeSlots.find(s => s.id === event.finalizedSlotId);
                    if (slot && new Date(slot.startTime) < cutoffCancelled) return true;
                }
                return new Date(event.updatedAt) < cutoffCancelled;
            }
            else if (event.status === 'FINALIZED') {
                if (!event.finalizedSlotId) return false;
                const slot = event.timeSlots.find(s => s.id === event.finalizedSlotId);
                if (!slot) return false;
                // Delete finalized events after their start date + retention
                return new Date(slot.startTime) < cutoffFinalized;
            }
            else {
                // Drafts Logic
                if (event.timeSlots.length === 0) {
                    return new Date(event.createdAt) < cutoffDraft;
                }
                const lastEndTime = event.timeSlots.reduce((max, slot) => {
                    return slot.endTime > max ? slot.endTime : max;
                }, new Date(0));

                return lastEndTime < cutoffDraft;
            }
        });

        let deletedCount = 0;
        let errors = 0;

        if (eventsToDelete.length > 0) {
            const { unpinChatMessage } = await import("@/features/telegram");
            const token = process.env.TELEGRAM_BOT_TOKEN;

            for (const event of eventsToDelete) {
                try {
                    // Cleanup Telegram pins
                    if (event.telegramChatId && event.pinnedMessageId && token) {
                        await unpinChatMessage(event.telegramChatId, event.pinnedMessageId, token);
                    }

                    // Database Deletion
                    // Uses local transaction to ensure safe, cascading cleanup.
                    await prisma.$transaction(async (tx) => {
                        await tx.vote.deleteMany({ where: { timeSlot: { eventId: event.id } } });
                        await tx.timeSlot.deleteMany({ where: { eventId: event.id } });
                        await tx.participant.deleteMany({ where: { eventId: event.id } });
                        await tx.event.delete({ where: { id: event.id } });
                    });

                    log.info(`Deleted expired event: ${event.slug} (${event.title})`);
                    deletedCount++;
                } catch (e) {
                    log.error(`Failed to delete event ${event.slug}`, e as Error);
                    errors++;
                }
            }
        }

        return NextResponse.json({
            success: true,
            deleted: deletedCount,
            errors,
            scanned: candidateEvents.length
        });

    } catch (error) {
        log.error("Cron Error", error as Error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
