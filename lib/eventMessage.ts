import { googleCalendarUrl, outlookCalendarUrl } from "@/lib/calendar";

/**
 * @interface EventData
 * @description Essential event details required for message generation.
 */
interface EventData {
    slug: string;
    title: string;
    description: string | null;
    finalizedHost: { name: string } | null;
    location: string | null;
    timezone?: string;
}

/**
 * @interface SlotData
 * @description The finalized time range for the event.
 */
interface SlotData {
    startTime: Date;
    endTime: Date;
}

/**
 * @function buildFinalizedMessage
 * @description Constructs a rich HTML formatted message for Telegram.
 * Features:
 * 1. Bold header and details.
 * 2. Deep links to "Add to Calendar" providers (Google, Outlook, ICS).
 * 3. Formatted dates localized to the event's timezone (defaulting to UTC).
 *
 * @param {EventData} event - The event details.
 * @param {SlotData} slot - The selected time slot.
 * @param {string} origin - The base URL of the application (for calculating absolute links).
 * @returns {string} HTML string compatible with Telegram's parse_mode='HTML'.
 */
export function buildFinalizedMessage(
    event: EventData,
    slot: SlotData,
    origin: string
): string {
    const slotTime = new Date(slot.startTime);
    const slotEndTime = new Date(slot.endTime);

    const icsLink = `${origin}/api/event/${event.slug}/ics`;

    // Intent: Structure metadata for external calendar services.
    const calendarEvent = {
        title: event.title,
        description: `${event.description ? event.description + '\n\n' : ''}Hosted by ${event.finalizedHost?.name || 'TBD'}.\nView Event: ${origin}/e/${event.slug}`,
        location: event.location,
        slug: event.slug
    };

    const googleLink = googleCalendarUrl(calendarEvent, slotTime, slotEndTime);
    const outlookLink = outlookCalendarUrl(calendarEvent, slotTime, slotEndTime);

    let locString = event.location ? `\n📍 ${event.location}` : "";
    let hostString = event.finalizedHost ? `\n🏠 Hosted by <b>${event.finalizedHost.name}</b>` : "";

    // Intent: Format time in the Event's specific timezone for clarity.
    const timeString = slotTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: event.timezone || 'UTC',
        timeZoneName: 'short'
    });

    const dateString = slotTime.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: event.timezone || 'UTC'
    });

    const eventUrl = `${origin}/e/${event.slug}`;

    return `🎉 <b>Event Finalized!</b>\n\n<b>${event.title}</b> is happening on:\n📅 ${dateString}\n⏰ ${timeString}${hostString}${locString}\n\n<a href="${eventUrl}">🔗 View Event Details</a>\n<a href="${googleLink}">📅 Google Calendar</a> | <a href="${outlookLink}">📧 Outlook</a> | <a href="${icsLink}">📎 ICS</a>\n\nSee you there!`;
}
