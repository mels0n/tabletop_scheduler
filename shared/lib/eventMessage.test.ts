import { describe, it, expect } from 'vitest';
import { buildFinalizedMessage, buildCampaignFinalizedMessage } from './eventMessage';
import { generateStatusMessage } from './status';
import { htmlToDiscordMarkdown } from './discordMarkdown';

// Review Focus 1: a hostile string in any user field must stay literal text on both platforms.
const EVIL = '<a href="https://evil">x</a>';
const EVIL_HTML = '&lt;a href=&quot;https://evil&quot;&gt;x&lt;/a&gt;';

const event = {
    slug: 'abc123',
    title: EVIL,
    description: EVIL,
    finalizedHost: { name: EVIL },
    location: EVIL,
    timezone: 'UTC',
};
const slot = { startTime: new Date('2026-10-10T18:00:00Z'), endTime: new Date('2026-10-10T22:00:00Z') };

/** Every `<a` in the HTML must be one of the template's own links, never user text. */
function anchorTargets(html: string): string[] {
    return [...html.matchAll(/<a href="([^"]*)">/g)].map((m) => m[1]);
}

function expectLiteralOnDiscord(html: string) {
    const md = htmlToDiscordMarkdown(html);
    // No masked link to the hostile URL, and the anchor text survives as visible text.
    expect(md).not.toMatch(/\]\(<?https:\/\/evil/);
    expect(md).not.toContain('[x]');
    expect(md).toContain('href=');
    return md;
}

describe('buildFinalizedMessage escaping', () => {
    const html = buildFinalizedMessage(event, slot, 'https://tabletoptime.us', [EVIL], [EVIL]);

    it('escapes the title, host, location, attendee and waitlist names exactly once', () => {
        // title + host + location + attendee + waitlist
        expect(html.split(EVIL_HTML).length - 1).toBe(5);
        expect(html).not.toContain(EVIL);
        expect(html).not.toContain('&amp;lt;');
    });

    it('only links to the app and calendar providers', () => {
        for (const href of anchorTargets(html)) {
            expect(href).not.toBe('https://evil');
            expect(href).toMatch(/^https:\/\/(tabletoptime\.us|calendar\.google\.com|outlook\.live\.com)\//);
        }
    });

    it('stays literal after conversion to Discord markdown', () => {
        expectLiteralOnDiscord(html);
    });
});

describe('buildCampaignFinalizedMessage escaping', () => {
    it('escapes the title, host, location and names', () => {
        const html = buildCampaignFinalizedMessage(event, [slot], 'https://tabletoptime.us', [EVIL], [EVIL]);
        expect(html.split(EVIL_HTML).length - 1).toBe(5);
        expect(html).not.toContain(EVIL);
        expectLiteralOnDiscord(html);
    });
});

describe('generateStatusMessage (dashboard) escaping', () => {
    it('escapes the event title', () => {
        const html = generateStatusMessage(
            { ...event, minPlayers: 2, timeSlots: [{ ...slot, votes: [] }] },
            1,
            'https://tabletoptime.us'
        );
        expect(html).toContain(`<b>${EVIL_HTML}</b>`);
        expect(html).not.toContain(EVIL);
        expect(anchorTargets(html)).toEqual(['https://tabletoptime.us/e/abc123']);
        expectLiteralOnDiscord(html);
    });
});
