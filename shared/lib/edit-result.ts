/**
 * Outcome of editing a previously posted bot message (the pinned dashboard).
 * - `edited`: the message now shows the new content (including "not modified").
 * - `gone`: the message definitively no longer exists or can never be edited; reposting is correct.
 * - `failed`: anything else (rate limit, 5xx, timeout, unknown). The edit may even have landed,
 *   so callers must NOT repost; the next update tries again.
 */
export type EditResult = "edited" | "gone" | "failed";
