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
    let statusMsg = `📊 <b>${event.title}</b>\n`;
    statusMsg += `👥 ${participantCount} participant${participantCount === 1 ? '' : 's'}\n\n`;

    event.timeSlots.forEach((slot: any) => {
        const yes = slot.votes.filter((v: any) => v.preference === 'YES').length;
        const maybe = slot.votes.filter((v: any) => v.preference === 'MAYBE').length;

        const tz = event.timezone || 'UTC';
        const dateStr = new Date(slot.startTime).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', timeZone: tz
        });
        const timeStr = new Date(slot.startTime).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', timeZone: tz, timeZoneName: 'short'
        });

        const { perfect } = checkSlotQuorum(slot, event.minPlayers, participantCount);
        const prefix = perfect ? "🌟" : "📅";

        statusMsg += `${prefix} <b>${dateStr} @ ${timeStr}</b>  ✅ ${yes}  ⚠️ ${maybe}\n`;
    });

    const url = baseUrl || 'http://localhost:3000';
    statusMsg += `\n<a href="${url}/e/${event.slug}">🔗 Vote Here</a>`;
    return statusMsg;
}
