/**
 * Rollout grace for participant rows created before vote ownership was enforced.
 *
 * Until the deploy that introduced the signed `tabletop_participant_<slug>` cookie, a browser
 * proved nothing about which row it had created. Rows from before then have no cookie and,
 * unless the voter signed in, no identity either, so the vote route would lock them out.
 */

/** Rows created before this instant may use the one-time grace path. */
export const LEGACY_PARTICIPANT_CUTOFF = new Date("2026-10-04T00:00:00Z");

/**
 * The grace path closes at this instant for every row. A legacy voter who has not come back
 * by then has to re-join (or sign in) like anyone else, so the unproven path cannot linger.
 */
export const LEGACY_GRACE_UNTIL = new Date("2026-11-03T00:00:00Z");

/**
 * True for a row the vote route may accept without proof of ownership: unlinked (no
 * Telegram or Discord identity), created before the cutoff, and only while `now` is before
 * LEGACY_GRACE_UNTIL. The caller must also check that the browser holds no participant
 * cookie for the event, then issue one.
 */
export function isLegacyUnlinkedParticipant(row: {
    chatId: string | null;
    discordId: string | null;
    createdAt?: Date | string | null;
}, now: Date = new Date()): boolean {
    if (now.getTime() >= LEGACY_GRACE_UNTIL.getTime()) return false;
    if (row.chatId || row.discordId || !row.createdAt) return false;
    const created = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
    return created.getTime() < LEGACY_PARTICIPANT_CUTOFF.getTime();
}
