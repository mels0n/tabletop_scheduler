/**
 * Ownership marker for participant rows created before vote ownership was enforced.
 *
 * `Participant.ownerCookieIssuedAt` is set the first time a signed `tabletop_participant_<slug>`
 * cookie is issued for a row. Every row created since that cookie existed is marked in the same
 * create. Rows created before then carry no marker: their browsers hold only the stored
 * participant id, and many of those voters have no Telegram or Discord to recover with. A deploy
 * must never lock them out, so an unmarked row stays editable by its stored id. The first browser
 * to touch it receives the cookie and the row is marked (a conditional update, so exactly one
 * browser wins); from then on the normal cookie or identity check applies.
 *
 * The marker is per row and never expires on a clock, so no configuration or cutoff is involved.
 */

/** True for a row no participant cookie has ever been issued for (the legacy state). */
export function isLegacyParticipant(row: { ownerCookieIssuedAt?: Date | string | null }): boolean {
    return row.ownerCookieIssuedAt == null;
}
