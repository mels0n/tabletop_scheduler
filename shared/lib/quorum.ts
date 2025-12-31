/**
 * @interface EventWithSlots
 * @description Structure of an event needed for quorum calculation.
 */
interface EventWithSlots {
    minPlayers: number;
    timeSlots: TimeSlotWithVotes[];
}

/**
 * @interface TimeSlotWithVotes
 * @description Structure of a time slot with explicit voting data.
 */
interface TimeSlotWithVotes {
    id: number;
    votes: { preference: string; canHost: boolean }[];
}

/**
 * @interface QuorumResult
 * @description The outcome of a quorum check.
 * @property {boolean} viable - "Enough people CAN make it" (YES + MAYBE >= Min).
 * @property {boolean} perfect - "Everyone is committed and we have a host" (YES == Total + Host).
 */
interface QuorumResult {
    viable: boolean;
    perfect: boolean;
}

/**
 * @function checkSlotQuorum
 * @description Analyzes a specific time slot to determine its viability.
 *
 * Algorithms:
 * 1. Viability: Sum(YES + MAYBE) must be >= Minimum Players.
 *    - Why MAYBE? We want to identify *potential* games even if commitments aren't solid yet.
 *
 * 2. Perfection:
 *    - All participants have voted YES (100% attendance).
 *    - Total attendance >= Minimum Players.
 *    - At least one participant acts as 'Host' (canHost = true).
 *
 * @param {TimeSlotWithVotes} slot - The slot to analyze.
 * @param {number} minPlayers - Minimum required players.
 * @param {number} totalParticipants - Total number of people involved in the event.
 * @returns {QuorumResult} The calculated status.
 */
export function checkSlotQuorum(slot: TimeSlotWithVotes, minPlayers: number, totalParticipants: number): QuorumResult {
    const yesVotes = slot.votes.filter(v => v.preference === 'YES');
    const maybeVotes = slot.votes.filter(v => v.preference === 'MAYBE');
    const yesCount = yesVotes.length;
    const maybeCount = maybeVotes.length;
    const hasHost = slot.votes.some(v => v.canHost);

    // Intent: Determine if a game is physically possible, even if not ideal.
    const viable = (yesCount + maybeCount) >= minPlayers;

    // Intent: Identify the "Golden Ticket" scenario where logic should probably auto-suggest this slot.
    // Logic: If everyone voted YES, then by definition NO one voted NO or MAYBE.
    const perfect = yesCount === totalParticipants && hasHost && totalParticipants >= minPlayers;

    return { viable, perfect };
}

/**
 * @function checkEventQuorum
 * @description Aggregates quorum status across ALL slots for an event.
 * Useful for high-level UI indicators (e.g., "This event needs attention" vs "Ready to finalize").
 *
 * @param {EventWithSlots} event - The full event data.
 * @param {number} totalParticipants - Total participant count.
 * @returns {QuorumResult} Best-case status found across any slot.
 */
export function checkEventQuorum(event: EventWithSlots, totalParticipants: number): QuorumResult {
    let hasViable = false;
    let hasPerfect = false;

    for (const slot of event.timeSlots) {
        const result = checkSlotQuorum(slot, event.minPlayers, totalParticipants);
        if (result.viable) hasViable = true;
        if (result.perfect) hasPerfect = true;
    }

    return { viable: hasViable, perfect: hasPerfect };
}
