/**
 * @file discordMarkdown.ts
 * @description Converts the Telegram-flavored HTML produced by eventMessage.ts /
 * status.ts into Discord-safe markdown.
 *
 * Input contract: every user-supplied value in the HTML was escaped with `escapeHtml`,
 * so any literal `<` in the input belongs to a template tag. The converter therefore
 * treats only the known template tags (`<b>`, `<i>`, `<code>`, `<a href>`, `<br>`) as
 * markup. Everything else is a text node: entities are decoded once and Discord markdown
 * metacharacters are backslash-escaped, so an escaped `&lt;a href=...&gt;` in a user's
 * name comes out as visible text and never as a masked link.
 *
 * Two Discord rendering constraints shape the link conversion:
 * 1. Masked links whose label contains emoji render as raw text, so a leading
 *    emoji is hoisted outside the brackets: `🔗 [View Event](<url>)`.
 * 2. Bare URLs in message content auto-unfurl into preview embeds; wrapping the
 *    URL in angle brackets suppresses that.
 */

import { escapeDiscordMarkdown } from "./escape";

// One or more emoji (each with optional variation selector) plus whitespace.
// Built via the constructor because the tsconfig ES5 target rejects u-flag
// regex literals at type-check time; the Node runtime supports them fine.
const LEADING_EMOJI = new RegExp('^\\s*((?:\\p{Extended_Pictographic}\\uFE0F?\\s*)+)(.*)$', 'u');

const ENTITIES: Record<string, string> = {
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " ",
    "&amp;": "&",
};

/** Single-pass entity decode, so "&amp;lt;" becomes "&lt;" and not "<". */
function decodeEntities(s: string): string {
    return s.replace(/&(?:lt|gt|quot|#39|nbsp|amp);/g, (e) => ENTITIES[e]);
}

/** A text node: decoded, then made inert for Discord markdown. */
function text(s: string): string {
    return escapeDiscordMarkdown(decodeEntities(s.replace(/ \| /g, ' • ')));
}

/** Link targets are template-built; keep them from closing the `<...>` wrapper. */
function linkTarget(href: string): string {
    return decodeEntities(href).replace(/>/g, '%3E').replace(/\s/g, '%20');
}

function convertAnchor(href: string, rawLabel: string): string {
    const url = linkTarget(href);
    const label = decodeEntities(rawLabel);
    const emojiMatch = label.match(LEADING_EMOJI);
    if (!emojiMatch) {
        return `[${escapeDiscordMarkdown(label)}](<${url}>)`;
    }

    const emoji = emojiMatch[1].trim();
    const rest = emojiMatch[2].trim();

    // Emoji-only label: a masked link would break, so fall back to a bare
    // (still embed-suppressed) URL.
    if (!rest) {
        return `${emoji} <${url}>`;
    }

    return `${emoji} [${escapeDiscordMarkdown(rest)}](<${url}>)`;
}

// Template markup only. Anchor labels and code spans are template text with no nested tags.
const MARKUP = /<a href="([^"]*)">([\s\S]*?)<\/a>|<code>([\s\S]*?)<\/code>|<\/?(?:b|strong)>|<\/?(?:i|em)>|<br\s*\/?>/g;

function convertMarkup(match: RegExpMatchArray): string {
    const [tag, href, label, code] = match;
    if (href !== undefined) return convertAnchor(href, label);
    // Inline code renders its content raw, so it is decoded but not backslash-escaped.
    if (code !== undefined) return `\`${decodeEntities(code).replace(/`/g, "'")}\``;
    if (/^<br/.test(tag)) return '\n';
    if (/^<\/?(?:b|strong)>$/.test(tag)) return '**';
    return '*';
}

export function htmlToDiscordMarkdown(html: string): string {
    let out = "";
    let last = 0;
    for (const match of html.matchAll(MARKUP)) {
        const index = match.index ?? 0;
        out += text(html.slice(last, index)) + convertMarkup(match);
        last = index + match[0].length;
    }
    return out + text(html.slice(last));
}
