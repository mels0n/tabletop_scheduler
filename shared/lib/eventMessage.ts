import { googleCalendarUrl, outlookCalendarUrl } from "@/shared/lib/calendar";
import { escapeHtml } from "@/shared/lib/escape";

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

/** One "- name" line per participant, each name HTML-escaped. */
function nameList(names: string[]): string {
    return names.map((n) => `- ${escapeHtml(n)}`).join('\n');
}

/**
 * @function buildFinalizedMessage
 * @description Constructs a rich HTML formatted message for Telegram.
 * Features:
 * 1. Bold header and details.
 * 2. Deep links to "Add to Calendar" providers (Google, Outlook, ICS).
 * 3. Formatted dates localized to the event's timezone (defaulting to UTC).
 *
 * Every user-supplied value (title, host, location, names) is HTML-escaped once, here,
 * at interpolation. Callers pass raw values.
 *
 * @param {EventData} event - The event details.
 * @param {SlotData} slot - The selected time slot.
 * @param {string[]} [attendees] - List of accepted participant names.
 * @param {string[]} [waitlist] - List of waitlisted participant names.
 * @returns {string} HTML string compatible with Telegram's parse_mode='HTML'.
 */
export function buildFinalizedMessage(
    event: EventData,
    slot: SlotData,
    origin: string | null,
    attendees: string[] = [],
    waitlist: string[] = []
): string {
    const slotTime = new Date(slot.startTime);
    const slotEndTime = new Date(slot.endTime);

    // Intent: Structure metadata for external calendar services.
    const calendarEvent = {
        title: event.title,
        description: `${event.description ? event.description + '\n\n' : ''}Hosted by ${event.finalizedHost?.name || 'TBD'}.${origin ? `\nView Event: ${origin}/e/${event.slug}` : ''}`,
        location: event.location,
        slug: event.slug
    };

    const googleLink = googleCalendarUrl(calendarEvent, slotTime, slotEndTime);
    const outlookLink = outlookCalendarUrl(calendarEvent, slotTime, slotEndTime);

    const locString = event.location ? `\n📍 ${escapeHtml(event.location)}` : "";
    const hostString = event.finalizedHost ? `\n🏠 Hosted by <b>${escapeHtml(event.finalizedHost.name)}</b>` : "";

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

    // Intent: Add Attendee Lists if applicable (Max Players logic)
    let listString = "";
    if (waitlist.length > 0) {
        // If there's a waitlist, we definitely want to show who made it.
        listString += `\n\n👥 <b>Attendees:</b>\n${nameList(attendees)}`;
        listString += `\n\n⚠️ <b>Waitlist (Next Up):</b>\n${nameList(waitlist)}`;
    }

    // Without a configured origin there is no absolute link to give, so those links are dropped.
    const calendarLinks = `<a href="${escapeHtml(googleLink)}">📅 Google Calendar</a> | <a href="${escapeHtml(outlookLink)}">📧 Outlook</a>`;
    const linkBlock = origin
        ? `<a href="${escapeHtml(`${origin}/e/${event.slug}`)}">🔗 View Event Details</a>\n${calendarLinks} | <a href="${escapeHtml(`${origin}/api/event/${event.slug}/ics`)}">📎 ICS</a>`
        : calendarLinks;

    return `🎉 <b>Event Finalized!</b>\n\n<b>${escapeHtml(event.title)}</b> is happening on:\n📅 ${dateString}\n⏰ ${timeString}${hostString}${locString}${listString}\n\n${linkBlock}\n\nSee you there!`;
}

/**
 * @function buildCampaignFinalizedMessage
 * @description Constructs a rich HTML formatted Telegram message for a finalized campaign.
 * Lists every session with its date and time. No per-session calendar provider links —
 * just a single bulk ICS download and an event link.
 *
 * @param {EventData} event - The event details.
 * @param {SlotData[]} slots - All finalized session slots, sorted by startTime.
 * @param {string | null} origin - The base URL origin; null drops the absolute links.
 * @param {string[]} [attendees] - List of accepted participant names.
 * @param {string[]} [waitlist] - List of waitlisted participant names.
 * @returns {string} HTML string compatible with Telegram's parse_mode='HTML'.
 */
export function buildCampaignFinalizedMessage(
    event: EventData,
    slots: SlotData[],
    origin: string | null,
    attendees: string[] = [],
    waitlist: string[] = []
): string {

    const tz = event.timezone || 'UTC';

    // Intent: Build a numbered session list with date and time for each slot.
    const sessionLines = slots.map((slot, i) => {
        const slotTime = new Date(slot.startTime);

        const dateString = slotTime.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            timeZone: tz
        });

        const timeString = slotTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: tz,
            timeZoneName: 'short'
        });

        return `  ${i + 1}. 📅 ${dateString} ⏰ ${timeString}`;
    }).join('\n');

    const hostString = event.finalizedHost ? `\n🏠 Hosted by <b>${escapeHtml(event.finalizedHost.name)}</b>` : "";
    const locString = event.location ? `\n📍 ${escapeHtml(event.location)}` : "";

    // Intent: Add Attendee Lists if applicable (Max Players logic)
    let listString = "";
    if (waitlist.length > 0) {
        listString += `\n\n👥 <b>Attendees:</b>\n${nameList(attendees)}`;
        listString += `\n\n⚠️ <b>Waitlist (Next Up):</b>\n${nameList(waitlist)}`;
    }

    return `🎉 <b>Campaign Finalized!</b>\n\n<b>${escapeHtml(event.title)}</b>\n\n${sessionLines}${hostString}${locString}${listString}${origin ? `\n\n<a href="${escapeHtml(`${origin}/e/${event.slug}`)}">🔗 View Event Details</a> | <a href="${escapeHtml(`${origin}/api/event/${event.slug}/ics`)}">📎 Download ICS</a>` : ''}\n\nSee you there!`;
}
