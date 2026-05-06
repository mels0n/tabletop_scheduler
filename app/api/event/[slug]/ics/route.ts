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

        if (!event || event.status !== 'FINALIZED') {
            return newResponse("Event not finalized or not found", 404);
        }

        // Determine Base URL purely for the Description link
        const { getBaseUrl } = await import("@/shared/lib/url");
        const origin = getBaseUrl(req.headers);
        const url = `${origin}/e/${event.slug}`;
        const dtstamp = formatDateICS(new Date());

        // Campaign: ?slot=<slotId> downloads a single session; no param downloads all sessions.
        if (event.eventType === 'CAMPAIGN') {
            const slotParam = new URL(req.url).searchParams.get('slot');

            const sessions = await prisma.finalizedSession.findMany({
                where: {
                    eventId: event.id,
                    ...(slotParam ? { timeSlotId: parseInt(slotParam) } : {})
                },
                include: { timeSlot: true },
                orderBy: { timeSlot: { startTime: 'asc' } }
            });

            if (sessions.length === 0) {
                return newResponse("Session not found", 404);
            }

            const participants = await prisma.participant.findMany({
                where: { eventId: event.id, status: 'ACCEPTED' },
                select: { name: true }
            });
            const playerList = participants.length > 0
                ? `Players: ${participants.map((p: { name: string }) => p.name).join(', ')}\\n\\n`
                : '';

            const baseDesc = `${event.description ? event.description + '\\n\\n' : ''}Hosted by ${event.finalizedHost?.name || 'TBD'}.\\nView Event: ${url}`;

            const allSessions = await prisma.finalizedSession.findMany({ where: { eventId: event.id }, orderBy: { timeSlot: { startTime: 'asc' } }, include: { timeSlot: true } });

            const vevents = sessions.map((session: any) => {
                const sessionNumber = allSessions.findIndex((s: any) => s.id === session.id) + 1;
                const start = formatDateICS(new Date(session.timeSlot.startTime));
                const end = formatDateICS(new Date(session.timeSlot.endTime));
                return `BEGIN:VEVENT\nUID:${event.slug}-session-${sessionNumber}@tabletoptime.local\nDTSTAMP:${dtstamp}\nDTSTART:${start}\nDTEND:${end}\nSUMMARY:${event.title} — Session ${sessionNumber}\nDESCRIPTION:${playerList}${baseDesc}\nEND:VEVENT`;
            }).join('\n');

            const filename = slotParam
                ? `${event.slug}-session-${sessions[0] ? allSessions.findIndex((s: any) => s.id === sessions[0].id) + 1 : 1}.ics`
                : `${event.slug}-campaign.ics`;

            return new NextResponse(`BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//TabletopTime//EN\n${vevents}\nEND:VCALENDAR`.trim(), {
                headers: { "Content-Type": "text/calendar", "Content-Disposition": `attachment; filename="${filename}"` }
            });
        }

        // Intent: ONE_SHOT — existing single-slot logic.
        if (!event.finalizedSlotId) {
            return newResponse("Event not finalized or not found", 404);
        }

        const slot = event.timeSlots.find((s: any) => s.id === event.finalizedSlotId);
        if (!slot) return newResponse("Slot not found", 404);

        // Intent: Basic ICS format compliance
        const start = formatDateICS(new Date(slot.startTime));
        const end = formatDateICS(new Date(slot.endTime));

        // Intent: Escape newlines for ICS format compatibility
        const descText = `${event.description ? event.description + '\\n\\n' : ''}Hosted by ${event.finalizedHost?.name || 'TBD'}.\\nView Event: ${url}`;

        const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TabletopTime//EN
BEGIN:VEVENT
UID:${event.slug}@tabletoptime.local
DTSTAMP:${dtstamp}
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
