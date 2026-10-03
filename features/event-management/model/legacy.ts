import { getServerConfig } from "@/shared/config/server";

/**
 * Permanent grace for participant rows created before vote ownership was enforced.
 *
 * Until the deploy that introduced the signed `tabletop_participant_<slug>` cookie, a browser
 * proved nothing about which row it had created. Rows from before then have no cookie and,
 * unless the voter signed in, no identity either. A deploy must never lock those voters out
 * (many have no Telegram or Discord to recover with), so the grace has no expiry: it is bounded
 * by the row's creation time, not by the clock. The cutoff is `LEGACY_PARTICIPANT_CUTOFF`
 * (see `shared/config/server.ts`).
 */

/**
 * True for a row the vote route may accept without proof of ownership: unlinked (no
 * Telegram or Discord identity) and created before the cutoff. The caller must also check
 * that the browser holds no participant cookie for the event, then issue one.
 */
export function isLegacyUnlinkedParticipant(row: {
    chatId: string | null;
    discordId: string | null;
    createdAt?: Date | string | null;
}, cutoff: Date = getServerConfig().legacyParticipantCutoff): boolean {
    if (row.chatId || row.discordId || !row.createdAt) return false;
    const created = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
    return created.getTime() < cutoff.getTime();
}
