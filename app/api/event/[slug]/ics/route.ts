import { NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import { format } from "date-fns";
import Logger from "@/shared/lib/logger";

const log = Logger.get("API:ICS");

/**
 * @function GET
 * @description Generates an ICS (iCalendar) file for a finalized event.
 *
 * Usage:
 * - Links in Telegram messages or the "Add to Calendar" button in the UI point here.
 * - Allows users to import the event into Outlook, Apple Calendar, etc.
 *
 * Logic:
 * 1. Checks if the event is FINALIZED and has a `finalizedSlotId`.
 * 2. Fetches the finalized time slot.
 * 3. Formats timestamps into UTC "Basic ISO" format (required by ICS spec).
 * 4. Returns a `text/calendar` response with a Content-Disposition header to trigger download.
 *
 * @param {Request} req - Incoming request.
 * @param {Object} context - Route parameters.
 * @param {string} context.params.slug - The event identifier.
 * @returns {NextResponse} The ICS file download or Error.
 */
export async function GET(
    req: Request,
    { params }: { params: { slug: string } }
) {
    try {
        log.debug("Generating ICS", { slug: params.slug });
        const event = await prisma.event.findUnique({
            where: { slug: params.slug },
            include: { timeSlots: true, finalizedHost: true }
        });

        if (!event || event.status !== 'FINALIZED' || !event.finalizedSlotId) {
            return newResponse("Event not finalized or not found", 404);
        }

        const slot = event.timeSlots.find((s: any) => s.id === event.finalizedSlotId);
        if (!slot) return newResponse("Slot not found", 404);

        // Intent: Basic ICS format compliance
        const start = formatDateICS(new Date(slot.startTime));
        const end = formatDateICS(new Date(slot.endTime));

        // Determine Base URL purely for the Description link
        const { getBaseUrl } = await import("@/shared/lib/url");
        const origin = getBaseUrl(req.headers);
        const url = `${origin}/e/${event.slug}`;

        // Intent: Escape newlines for ICS format compatibility
        const descText = `${event.description ? event.description + '\\n\\n' : ''}Hosted by ${event.finalizedHost?.name || 'TBD'}.\\nView Event: ${url}`;

        const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TabletopTime//EN
BEGIN:VEVENT
UID:${event.slug}@tabletoptime.local
DTSTAMP:${formatDateICS(new Date())}
DTSTART:${start}
DTEND:${end}
SUMMARY:${event.title}
DESCRIPTION:${descText}
END:VEVENT
END:VCALENDAR`.trim();

        return new NextResponse(icsContent, {
            headers: {
                "Content-Type": "text/calendar",
                "Content-Disposition": `attachment; filename="${event.slug}.ics"`
            }
        });

    } catch (error) {
        log.error("ICS generation failed", error as Error);
        return newResponse("Error", 500);
    }
}

function newResponse(text: string, status: number) {
    return new NextResponse(text, { status });
}

/**
 * @function formatDateICS
 * @description Formats a Javascript Date object into the strict ICS format string.
 * Format: YYYYMMDDTHHmmSSZ (UTC)
 */
function formatDateICS(date: Date) {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}
