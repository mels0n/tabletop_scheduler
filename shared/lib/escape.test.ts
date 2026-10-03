import { describe, it, expect } from 'vitest';
import { escapeHtml, escapeDiscordMarkdown } from './escape';

const EVIL = '<a href="https://evil">x</a>';

describe('escapeHtml', () => {
    it('turns an injected link into literal text', () => {
        expect(escapeHtml(EVIL)).toBe('&lt;a href=&quot;https://evil&quot;&gt;x&lt;/a&gt;');
    });

    it('escapes ampersands first so entities are not double-decoded', () => {
        expect(escapeHtml('Tom & Jerry <3')).toBe('Tom &amp; Jerry &lt;3');
        expect(escapeHtml('&lt;')).toBe('&amp;lt;');
    });

    it('leaves plain text alone', () => {
        expect(escapeHtml("Catan night, Bob's place")).toBe("Catan night, Bob's place");
    });
});

describe('escapeDiscordMarkdown', () => {
    it('neutralises a masked link', () => {
        expect(escapeDiscordMarkdown('[Claim seat](https://evil)')).toBe('\\[Claim seat\\]\\(https://evil\\)');
    });

    it('escapes every markdown metacharacter', () => {
        expect(escapeDiscordMarkdown('*_~`|[]()>#\\')).toBe('\\*\\_\\~\\`\\|\\[\\]\\(\\)\\>\\#\\\\');
    });

    it('escapes the Review Focus link string so no markup survives', () => {
        expect(escapeDiscordMarkdown(EVIL)).toBe('<a href="https://evil"\\>x</a\\>');
    });

    it('leaves plain text alone', () => {
        expect(escapeDiscordMarkdown('Game night at 7')).toBe('Game night at 7');
    });
});
