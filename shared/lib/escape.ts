/**
 * Escaping for user-supplied text interpolated into bot messages. Apply at every
 * interpolation of user data (titles, names, locations), never to the template itself.
 */

const HTML_ENTITIES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
};

/** Escapes text for Telegram `parse_mode: "HTML"` (and any HTML text or attribute context). */
export function escapeHtml(s: string): string {
    return s.replace(/[&<>"]/g, (ch) => HTML_ENTITIES[ch]);
}

/** Backslash-escapes Discord markdown metacharacters so user text renders literally. */
export function escapeDiscordMarkdown(s: string): string {
    return s.replace(/[\\*_~`|[\]()>#]/g, (ch) => `\\${ch}`);
}
