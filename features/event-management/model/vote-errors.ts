/**
 * Error codes the vote route returns and the copy the voting UI shows for them.
 * Client-safe: no server imports. No em dashes in user-facing copy.
 */

/** 403 code: the browser cannot prove it owns the participant row it tried to edit. */
export const PARTICIPANT_NOT_OWNED = "participant_not_owned";

const GENERIC = "Failed to save votes";

/** The alert text for a failed vote response body (already parsed JSON, or anything else). */
export function voteErrorMessage(body: unknown): string {
    const code = typeof body === "object" && body !== null ? (body as { code?: unknown }).code : undefined;
    if (code === PARTICIPANT_NOT_OWNED) {
        return "This vote was saved from another browser. If you linked it to Telegram or Discord, sign in with that account to edit this vote.";
    }
    return GENERIC;
}
