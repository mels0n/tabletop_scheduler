import { NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { syncDashboard } from "@/app/api/event/[slug]/slot/notify";

import { verifyEventAdmin } from "@/features/auth/server/actions";
import { ForbiddenError, toResponse } from "@/shared/errors";
import { locationSchema } from "@/features/event-management/model/schemas";

const log = Logger.get("API:Location");

/**
 * @function POST
 * @description Handles location updates for an event.
 *
 * Responsibilities:
 * 1. Updates the `location` field in the database.
 * 2. Re-renders the pinned dashboard on each linked platform via `syncDashboard`, the same
 *    path every other change uses, so the finalized message keeps its attendee and
 *    waitlist lists. Users see the new location without a new notification.
 *
 * @param {Request} req - JSON body containing `{ location: string | null }` (max 200 chars). Admin only (403).
 * @param {Object} context - Route parameters.
 * @param {string} context.params.slug - The event identifier.
 * @returns {NextResponse} Success status and updated location.
 */
export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
    const params = await props.params;
    try {
        if (!(await verifyEventAdmin(params.slug))) {
            throw new ForbiddenError();
        }

        const { location } = locationSchema.parse(await req.json());

        log.info("Updating location", { slug: params.slug });

        const event = await prisma.event.update({
            where: { slug: params.slug },
            data: { location },
            select: { id: true, location: true }
        });

        // Never throws: each platform is attempted independently and failures are logged.
        await syncDashboard(event.id);

        return NextResponse.json({ success: true, location: event.location });
    } catch (error) {
        return toResponse(error, log);
    }
}
