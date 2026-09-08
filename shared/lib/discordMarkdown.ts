/**
 * @file discordMarkdown.ts
 * @description Converts the Telegram-flavored HTML produced by eventMessage.ts /
 * status.ts into Discord-safe markdown.
 *
 * Two Discord rendering constraints shape the link conversion:
 * 1. Masked links whose label contains emoji render as raw text, so a leading
 *    emoji is hoisted outside the brackets: `🔗 [View Event](<url>)`.
 * 2. Bare URLs in message content auto-unfurl into preview embeds; wrapping the
 *    URL in angle brackets suppresses that.
 */

// One or more emoji (each with optional variation selector) plus whitespace.
// Built via the constructor because the tsconfig ES5 target rejects u-flag
// regex literals at type-check time; the Node runtime supports them fine.
const LEADING_EMOJI = new RegExp('^\\s*((?:\\p{Extended_Pictographic}\\uFE0F?\\s*)+)(.*)$', 'u');

function convertAnchor(_match: string, url: string, label: string): string {
    const emojiMatch = label.match(LEADING_EMOJI);
    if (!emojiMatch) {
        return `[${label}](<${url}>)`;
    }

    const emoji = emojiMatch[1].trim();
    const rest = emojiMatch[2].trim();

    // Emoji-only label: a masked link would break, so fall back to a bare
    // (still embed-suppressed) URL.
    if (!rest) {
        return `${emoji} <${url}>`;
    }

    return `${emoji} [${rest}](<${url}>)`;
}

export function htmlToDiscordMarkdown(html: string): string {
    return html
        .replace(/<b>(.*?)<\/b>/g, '**$1**')
        .replace(/<a href="(.*?)">(.*?)<\/a>/g, convertAnchor)
        .replace(/ \| /g, ' • ')
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/&nbsp;/g, ' ');
}
