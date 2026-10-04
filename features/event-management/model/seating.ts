/**
 * Who may take an open seat on a finalized event, given how many players are already
 * ACCEPTED. Shared by waitlist promotion and the vote route so both apply one rule.
 *
 * - YES takes any open seat (below `max`).
 * - MAYBE ("If Needed") is seated only while the event is below its minimum, mirroring
 *   finalize, which adds If Needed players only to reach the minimum. No minimum (0) means
 *   never.
 * - NO never takes a seat.
 * - No preference (no vote on the finalized slot) counts as NO: never seated. The site
 *   submits every unpainted slot as NO, and the API treats an omitted slot the same way.
 *
 * Pure and client-safe.
 */
export function canTakeOpenSeat(preference: string | undefined, accepted: number, min: number, max: number): boolean {
    if (preference === "YES") return accepted < max;
    if (preference === "MAYBE") return accepted < Math.min(min, max);
    return false;
}
