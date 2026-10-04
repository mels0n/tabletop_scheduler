import { describe, it, expect, afterEach, vi } from 'vitest';
import { getBaseUrl, getBaseUrlOrNull, getBaseUrlFromHeaders } from './url';
import { ConfigError } from '@/shared/errors';
import { resetServerConfigForTests } from '@/shared/config/server';
import { stubConfigEnv } from '@/shared/config/test-env';

afterEach(() => {
    vi.unstubAllEnvs();
    resetServerConfigForTests();
});

describe('getBaseUrl', () => {
    it('returns the configured base URL without a trailing slash', () => {
        stubConfigEnv({ NEXT_PUBLIC_BASE_URL: 'https://tabletoptime.us/' });
        resetServerConfigForTests();
        expect(getBaseUrl()).toBe('https://tabletoptime.us');
    });

    it('throws ConfigError when no base URL is configured, never falling back to request headers', () => {
        stubConfigEnv({});
        resetServerConfigForTests();
        expect(() => getBaseUrl()).toThrow(ConfigError);
    });
});

describe('getBaseUrlFromHeaders (display only)', () => {
    it('prefers the configured base URL over the request host', () => {
        stubConfigEnv({ NEXT_PUBLIC_BASE_URL: 'https://tabletoptime.us' });
        resetServerConfigForTests();
        expect(getBaseUrlFromHeaders(new Headers({ host: 'evil.example' }))).toBe('https://tabletoptime.us');
    });

    it('falls back to the request host when unset', () => {
        stubConfigEnv({});
        resetServerConfigForTests();
        expect(getBaseUrlFromHeaders(new Headers({ host: 'nas.local:3000' }))).toBe('http://nas.local:3000');
        expect(getBaseUrlFromHeaders(new Headers({ host: 'x.example', 'x-forwarded-proto': 'https, http' }))).toBe('https://x.example');
    });
});

describe('getBaseUrlOrNull', () => {
    it('returns null instead of throwing when no base URL is configured', () => {
        stubConfigEnv({});
        resetServerConfigForTests();
        expect(getBaseUrlOrNull()).toBeNull();
    });

    it('returns the configured base URL', () => {
        stubConfigEnv({ NEXT_PUBLIC_BASE_URL: 'https://tabletoptime.us/' });
        resetServerConfigForTests();
        expect(getBaseUrlOrNull()).toBe('https://tabletoptime.us');
    });
});
