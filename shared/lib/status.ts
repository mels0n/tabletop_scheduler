import { checkSlotQuorum } from "./quorum";

/**
 * @function generateStatusMessage
 * @description Generates a real-time status dashboard summary for Telegram.
 * Features:
 * 1. Overview of participant count.
 * 2. Per-slot breakdown of YES/MAYBE votes.
 * 3. Visual indicators (Stars) for "Perfect" slots (100% attendance + Host).
 *
 * @param {any} event - The event object including timeSlots and votes.
 * @param {number} participantCount - Total number of unique voters.
 * @param {string} [baseUrl] - Base URL for generating the voting link (defaults to localhost).
 * @returns {string} HTML formatted status message.
 */
export function generateStatusMessage(event: any, participantCount: number, baseUrl?: string) {
    let statusMsg = `📊 <b>${event.title}</b>\n\n`;
    statusMsg += `👥 <b>Participants:</b> ${participantCount}\n\n`;
    statusMsg += `<b>Current Votes:</b>\n`;

    event.timeSlots.forEach((slot: any) => {
        const yes = slot.votes.filter((v: any) => v.preference === 'YES').length;
        const maybe = slot.votes.filter((v: any) => v.preference === 'MAYBE').length;

        // Intent: Use event's timezone or default to UTC for consistent display.
        const tz = event.timezone || 'UTC';
        const dateStr = new Date(slot.startTime).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', timeZone: tz
        });
        const timeStr = new Date(slot.startTime).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', timeZone: tz, timeZoneName: 'short'
        });

        // Intent: Highlight "Perfect" slots where everyone can make it and a host is available.
        // This drives the group towards consensus.
        const { perfect } = checkSlotQuorum(slot, event.minPlayers, participantCount);

        const isPerfect = perfect;
        const prefix = isPerfect ? "🌟 " : "▫️ ";

        statusMsg += `${prefix}<b>${dateStr} @ ${timeStr}</b>\n`;
        statusMsg += `   ✅ ${yes}  ⚠️ ${maybe}\n`;
    });

    // Use provided key or default to localhost if missing (though caller should provide it).
    // Intent: Fallback ensures the link is never broken in dev environments.
    const url = baseUrl || 'http://localhost:3000';
    statusMsg += `\n<a href="${url}/e/${event.slug}">🔗 Vote Here</a>`;
    return statusMsg;
}
