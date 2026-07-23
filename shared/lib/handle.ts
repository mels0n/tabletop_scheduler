/**
 * Handle normalization — the single source of truth for user handles.
 *
 * Handles (Telegram @usernames, Discord names) are STORED without a leading '@'
 * so equality checks stay trivial and display code can prepend exactly one '@'.
 * Users may type their handle with or without '@'; both forms normalize to the
 * same canonical value. Telegram handles are case-insensitive, so we lowercase by
 * default; pass { lowercase: false } to preserve case (e.g. Discord usernames).
 */
export function normalizeHandle(
    handle: string | null | undefined,
    opts: { lowercase?: boolean } = {}
): string | null {
    if (!handle) return null;
    const { lowercase = true } = opts;
    let clean = handle.trim().replace(/^@+/, "").trim();
    if (lowercase) clean = clean.toLowerCase();
    return clean.length > 0 ? clean : null;
}

/**
 * Display form of a handle: exactly one leading '@', tolerant of input that
 * already has zero, one, or several '@'. Returns '' for empty/nullish input so
 * callers can render it directly.
 */
export function formatHandle(handle: string | null | undefined): string {
    const clean = normalizeHandle(handle);
    return clean ? `@${clean}` : "";
}
