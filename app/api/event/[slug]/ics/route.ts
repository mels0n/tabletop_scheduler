import { NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
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
 * 4. Escapes every user-supplied TEXT value per RFC 5545 (see `escapeIcsText`), so a title
 *    or name containing a newline cannot inject calendar properties.
 * 5. Returns a `text/calendar` response with a Content-Disposition header to trigger download.
 *
 * @param {Request} req - Incoming request.
 * @param {Object} context - Route parameters.
 * @param {string} context.params.slug - The event identifier.
 * @returns {NextResponse} The ICS file download or Error.
 */
export async function GET(req: Request, props: { params: Promise<{ slug: string }> }) {
    const params = await props.params;
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
        const { getBaseUrlFromHeaders } = await import("@/shared/lib/url");
        const origin = getBaseUrlFromHeaders(req.headers);
        const url = `${origin}/e/${event.slug}`;
        const dtstamp = formatDateICS(new Date());

        // DESCRIPTION is assembled from individually escaped parts joined by the escaped
        // line break, so user text can never end the property early.
        const descriptionParts = (prefix: string[]) => [
            ...prefix,
            ...(event.description ? [escapeIcsText(event.description), ""] : []),
            `Hosted by ${escapeIcsText(event.finalizedHost?.name || 'TBD')}.`,
            `View Event: ${escapeIcsText(url)}`,
        ].join(ICS_NEWLINE);

        // Campaign: ?slot=<slotId> downloads a single session; no param downloads all sessions.
        if (event.eventType === 'CAMPAIGN') {
            const slotParam = new URL(req.url).searchParams.get('slot');
            const slotId = slotParam ? parseInt(slotParam, 10) : null;
            if (slotParam && (!Number.isInteger(slotId) || (slotId as number) <= 0)) {
                return newResponse("Session not found", 404);
            }

            const sessions = await prisma.finalizedSession.findMany({
                where: {
                    eventId: event.id,
                    ...(slotId ? { timeSlotId: slotId } : {})
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
            const playerPrefix = participants.length > 0
                ? [`Players: ${participants.map((p: { name: string }) => escapeIcsText(p.name)).join(', ')}`, ""]
                : [];

            const baseDesc = descriptionParts(playerPrefix);

            const allSessions = await prisma.finalizedSession.findMany({ where: { eventId: event.id }, orderBy: { timeSlot: { startTime: 'asc' } }, include: { timeSlot: true } });

            const vevents = sessions.map((session: any) => {
                const sessionNumber = allSessions.findIndex((s: any) => s.id === session.id) + 1;
                const start = formatDateICS(new Date(session.timeSlot.startTime));
                const end = formatDateICS(new Date(session.timeSlot.endTime));
                return [
                    "BEGIN:VEVENT",
                    `UID:${event.slug}-session-${sessionNumber}@tabletoptime.local`,
                    `DTSTAMP:${dtstamp}`,
                    `DTSTART:${start}`,
                    `DTEND:${end}`,
                    `SUMMARY:${escapeIcsText(event.title)} (Session ${sessionNumber})`,
                    `DESCRIPTION:${baseDesc}`,
                    "END:VEVENT",
                ].join(ICS_LINE_END);
            });

            const filename = slotParam
                ? `${event.slug}-session-${sessions[0] ? allSessions.findIndex((s: any) => s.id === sessions[0].id) + 1 : 1}.ics`
                : `${event.slug}-campaign.ics`;

            return new NextResponse(calendar(vevents), {
                headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` }
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

        const vevent = [
            "BEGIN:VEVENT",
            `UID:${event.slug}@tabletoptime.local`,
            `DTSTAMP:${dtstamp}`,
            `DTSTART:${start}`,
            `DTEND:${end}`,
            `SUMMARY:${escapeIcsText(event.title)}`,
            `DESCRIPTION:${descriptionParts([])}`,
            "END:VEVENT",
        ].join(ICS_LINE_END);

        return new NextResponse(calendar([vevent]), {
            headers: {
                "Content-Type": "text/calendar; charset=utf-8",
                "Content-Disposition": `attachment; filename="${event.slug}.ics"`
            }
        });

    } catch (error) {
        log.error("ICS generation failed", error as Error);
        return newResponse("Error", 500);
    }
}

/** RFC 5545 content lines end in CRLF. */
const ICS_LINE_END = "\r\n";
/** An escaped line break inside a TEXT value. */
const ICS_NEWLINE = "\\n";

function calendar(vevents: string[]): string {
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TabletopTime//EN", ...vevents, "END:VCALENDAR"].join(ICS_LINE_END);
}

/**
 * Escapes a TEXT property value per RFC 5545 section 3.3.11: backslash, semicolon and comma
 * are backslash-escaped, and any line break becomes the two characters `\n`. Other control
 * characters are dropped.
 */
function escapeIcsText(value: string): string {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r\n|\r|\n/g, "\\n")
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
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
