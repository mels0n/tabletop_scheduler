import { describe, it, expect } from 'vitest';
import { htmlToDiscordMarkdown } from './discordMarkdown';

describe('htmlToDiscordMarkdown', () => {
    it('converts bold tags to Discord markdown', () => {
        expect(htmlToDiscordMarkdown('<b>Event Finalized!</b>')).toBe('**Event Finalized!**');
    });

    it('hoists a leading emoji out of the link label so Discord renders the masked link', () => {
        // Discord fails to render masked links whose label contains emoji;
        // the emoji must sit outside the brackets.
        const input = '<a href="https://tabletoptime.us/e/abc123">🔗 View Event Details</a>';
        expect(htmlToDiscordMarkdown(input)).toBe('🔗 [View Event Details](<https://tabletoptime.us/e/abc123>)');
    });

    it('wraps link URLs in angle brackets to suppress auto-embed previews', () => {
        const input = '<a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=MTG%20Sealed">📅 Google Calendar</a>';
        const out = htmlToDiscordMarkdown(input);
        expect(out).toBe('📅 [Google Calendar](<https://calendar.google.com/calendar/render?action=TEMPLATE&text=MTG%20Sealed>)');
    });

    it('leaves emoji-free labels intact', () => {
        const input = '<a href="https://tabletoptime.us/e/abc123">View Event</a>';
        expect(htmlToDiscordMarkdown(input)).toBe('[View Event](<https://tabletoptime.us/e/abc123>)');
    });

    it('falls back to a bare suppressed URL when the label is only emoji', () => {
        const input = '<a href="https://tabletoptime.us/e/abc123">🔗</a>';
        expect(htmlToDiscordMarkdown(input)).toBe('🔗 <https://tabletoptime.us/e/abc123>');
    });

    it('converts pipe separators, line breaks, and non-breaking spaces', () => {
        const input = '<a href="https://a.example">📅 Google Calendar</a> | <a href="https://b.example">📧 Outlook</a><br/>x&nbsp;y';
        expect(htmlToDiscordMarkdown(input)).toBe(
            '📅 [Google Calendar](<https://a.example>) • 📧 [Outlook](<https://b.example>)\nx y'
        );
    });

    it('converts a realistic finalize message without leaving emoji inside any label', () => {
        const input = '🎉 <b>Event Finalized!</b>\n\n<b>MTG Sealed</b> is happening on:\n📅 Sat, Oct 24\n⏰ 12:00 PM CDT\n🏠 Hosted by <b>Chris</b>\n📍 Chris House\n\n<a href="https://tabletoptime.us/e/abc123">🔗 View Event Details</a>\n<a href="https://calendar.google.com/x">📅 Google Calendar</a> | <a href="https://outlook.live.com/x">📧 Outlook</a> | <a href="https://tabletoptime.us/api/event/abc123/ics">📎 ICS</a>\n\nSee you there!';
        const out = htmlToDiscordMarkdown(input);

        expect(out).toContain('**Event Finalized!**');
        expect(out).toContain('🔗 [View Event Details](<https://tabletoptime.us/e/abc123>)');
        expect(out).toContain('📎 [ICS](<https://tabletoptime.us/api/event/abc123/ics>)');
        expect(out).toContain(') • ');
        // No masked link may keep an emoji inside its label. (RegExp constructor
        // because the ES5 tsconfig target rejects u-flag regex literals.)
        expect(out).not.toMatch(new RegExp('\\[[^\\]]*\\p{Extended_Pictographic}[^\\]]*\\]\\(', 'u'));
        // No unsuppressed URL may remain (every link URL is angle-wrapped).
        expect(out).not.toMatch(/\]\((?!<)/);
        expect(out).not.toContain('<a href');
        expect(out).not.toContain('<b>');
    });
});
