/**
 * @file calendar.ts
 * @description Utility functions for generating deep links to external calendar services
 * (Google Calendar, Outlook).
 *
 * @see components/AddToCalendar.tsx for usage.
 */

/**
 * @function googleCalendarUrl
 * @description Generates a Google Calendar 'Add Event' deep link.
 * Logic: Formats dates to UTC 'Basic ISO' format (YYYYMMDDTHHMMSSZ) required by Google.
 *
 * @param {Object} event - Event details.
 * @param {string} event.title - Event title.
 * @param {string} [event.description] - Optional description.
 * @param {string} [event.location] - Optional location string.
 * @param {Date} start - Start date object.
 * @param {Date} end - End date object.
 * @returns {string} The formatted URL.
 */
export function googleCalendarUrl(event: { title: string, description?: string | null, location?: string | null }, start: Date, end: Date) {
    // Intent: Remove separators for Google's required format.
    const startStr = start.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endStr = end.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const text = encodeURIComponent(event.title);
    const details = encodeURIComponent(event.description || "");
    const location = encodeURIComponent(event.location || "");

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${startStr}/${endStr}&details=${details}&location=${location}`;
}

/**
 * @function outlookCalendarUrl
 * @description Generates an Outlook/Office365 'Add Event' deep link.
 * Logic: Uses standard ISO strings for start/end times as supported by the Outlook API.
 *
 * @param {Object} event - Event details.
 * @param {string} event.title - Event title.
 * @param {string} [event.description] - Optional description.
 * @param {string} [event.location] - Optional location string.
 * @param {Date} start - Start date object.
 * @param {Date} end - End date object.
 * @returns {string} The formatted URL.
 */
export function outlookCalendarUrl(event: { title: string, description?: string | null, location?: string | null }, start: Date, end: Date) {
    const startStr = start.toISOString();
    const endStr = end.toISOString();
    const text = encodeURIComponent(event.title);
    const details = encodeURIComponent(event.description || "");
    const location = encodeURIComponent(event.location || "");

    return `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&startdt=${startStr}&enddt=${endStr}&subject=${text}&body=${details}&location=${location}`;
}
