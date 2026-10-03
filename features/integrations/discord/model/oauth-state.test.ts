import { describe, it, expect } from 'vitest';
import {
    encodeOAuthState,
    parseOAuthState,
    safeReturnTo,
    nonceMatches,
    newOAuthNonce,
    manageSlugFrom,
    guildCookieName,
    isDiscordSnowflake,
} from './oauth-state';

const BASE = 'https://tabletop.example';

describe('Discord OAuth state', () => {
    it('round trips nonce, flow and returnTo', () => {
        const nonce = newOAuthNonce();
        const raw = encodeOAuthState({ nonce, flow: 'connect', returnTo: '/e/abc/manage' });
        expect(parseOAuthState(raw, BASE)).toEqual({ nonce, flow: 'connect', returnTo: '/e/abc/manage' });
    });

    it('makes a 16-byte base64url nonce', () => {
        const nonce = newOAuthNonce();
        expect(nonce).toMatch(/^[A-Za-z0-9_-]{22}$/);
        expect(newOAuthNonce()).not.toBe(nonce);
    });

    it('rejects unparsable state or a state without a nonce', () => {
        expect(parseOAuthState(null, BASE)).toBeNull();
        expect(parseOAuthState('not json', BASE)).toBeNull();
        expect(parseOAuthState(JSON.stringify({ flow: 'login', returnTo: '/' }), BASE)).toBeNull();
    });

    it('defaults a missing returnTo to / and an unknown flow to login', () => {
        expect(parseOAuthState(JSON.stringify({ nonce: 'n' }), BASE)).toEqual({ nonce: 'n', flow: 'login', returnTo: '/' });
        expect(parseOAuthState(JSON.stringify({ nonce: 'n', flow: 'admin' }), BASE)?.flow).toBe('login');
    });

    it.each([
        'https://evil.example',
        '//evil.example',
        '/\\evil.example',
        '\\\\evil.example',
        '/\t/evil.example',
        'javascript:alert(1)',
        'e/abc/manage',
        '',
        undefined,
        42,
    ])('falls back to / for an unsafe returnTo %j', (raw) => {
        expect(safeReturnTo(raw, BASE)).toBe('/');
    });

    it('keeps a same-origin relative path', () => {
        expect(safeReturnTo('/e/abc/manage', BASE)).toBe('/e/abc/manage');
        expect(safeReturnTo('/profile?tab=events', BASE)).toBe('/profile?tab=events');
    });

    it('compares nonces exactly and safely', () => {
        expect(nonceMatches('abc', 'abc')).toBe(true);
        expect(nonceMatches('abc', 'abd')).toBe(false);
        expect(nonceMatches('abc', 'abcd')).toBe(false);
        expect(nonceMatches(undefined, 'abc')).toBe(false);
        expect(nonceMatches('', '')).toBe(false);
    });

    it('extracts the slug from a manage path only', () => {
        expect(manageSlugFrom('/e/abc123/manage')).toBe('abc123');
        expect(manageSlugFrom('/e/abc123/manage?x=1')).toBe('abc123');
        expect(manageSlugFrom('/e/abc123')).toBeNull();
        expect(manageSlugFrom('/foo/e/abc123/manage')).toBeNull();
    });

    it('validates Discord snowflakes and names the guild cookie per event', () => {
        expect(isDiscordSnowflake('123456789012345678')).toBe(true);
        expect(isDiscordSnowflake('1234')).toBe(false);
        expect(isDiscordSnowflake('123456789012345678/../x')).toBe(false);
        expect(guildCookieName('abc')).toBe('tabletop_discord_guild_abc');
    });
});
