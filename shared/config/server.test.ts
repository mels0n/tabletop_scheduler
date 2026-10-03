import { describe, it, expect, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { getServerConfig, resetServerConfigForTests } from './server';
import { ConfigError } from '@/shared/errors';
import { stubConfigEnv } from './test-env';

function load(overrides: Record<string, string> = {}) {
    stubConfigEnv(overrides);
    resetServerConfigForTests();
    return getServerConfig();
}

function loadError(overrides: Record<string, string> = {}): ConfigError {
    try {
        load(overrides);
    } catch (e) {
        expect(e).toBeInstanceOf(ConfigError);
        return e as ConfigError;
    }
    throw new Error('expected getServerConfig() to throw');
}

afterEach(() => {
    vi.unstubAllEnvs();
    resetServerConfigForTests();
});

describe('getServerConfig: defaults', () => {
    it('applies safe defaults for an empty self-host environment', () => {
        const cfg = load();
        expect(cfg).toEqual({
            nodeEnv: 'test',
            isHosted: false,
            isVercel: false,
            baseUrl: null,
            sessionSecret: 'dev-session-secret',
            cronSecret: null,
            telegram: { token: null, mode: 'off' },
            discord: { botToken: null, appId: null, clientSecret: null },
            kofiVerificationToken: null,
            logLevel: 'info',
            cleanupRetentionDays: { finalized: 1, draft: 1, cancelled: 1 },
            acceptDataLoss: false,
        });
    });

    it('is cached until reset', () => {
        const first = load({ NEXT_PUBLIC_BASE_URL: 'https://a.example' });
        stubConfigEnv({ NEXT_PUBLIC_BASE_URL: 'https://b.example' });
        expect(getServerConfig()).toBe(first);
        resetServerConfigForTests();
        expect(getServerConfig().baseUrl).toBe('https://b.example');
    });

    it('strips a trailing slash from the base URL and parses numbers and flags', () => {
        const cfg = load({
            NEXT_PUBLIC_BASE_URL: 'https://tabletoptime.us/',
            CLEANUP_RETENTION_DAYS_FINALIZED: '3',
            CLEANUP_RETENTION_DAYS_DRAFT: '30',
            CLEANUP_RETENTION_DAYS_CANCELLED: '7',
            LOG_LEVEL: 'debug',
            PRISMA_ACCEPT_DATA_LOSS: 'true',
        });
        expect(cfg.baseUrl).toBe('https://tabletoptime.us');
        expect(cfg.cleanupRetentionDays).toEqual({ finalized: 3, draft: 30, cancelled: 7 });
        expect(cfg.logLevel).toBe('debug');
        expect(cfg.acceptDataLoss).toBe(true);
    });
});

describe('getServerConfig: telegram mode', () => {
    it('is webhook when a token and base URL are set', () => {
        const cfg = load({ TELEGRAM_BOT_TOKEN: 't', NEXT_PUBLIC_BASE_URL: 'https://x.example' });
        expect(cfg.telegram).toEqual({ token: 't', mode: 'webhook' });
    });

    it('selects polling on a self-host box with TELEGRAM_MODE=polling and a base URL', () => {
        const cfg = load({ TELEGRAM_BOT_TOKEN: 't', TELEGRAM_MODE: 'polling', NEXT_PUBLIC_BASE_URL: 'http://nas.local:3000' });
        expect(cfg.telegram.mode).toBe('polling');
        expect(cfg.baseUrl).toBe('http://nas.local:3000');
    });

    it('honours an explicit TELEGRAM_MODE', () => {
        const cfg = load({ TELEGRAM_BOT_TOKEN: 't', NEXT_PUBLIC_BASE_URL: 'https://x.example', TELEGRAM_MODE: 'off' });
        expect(cfg.telegram.mode).toBe('off');
    });
});

describe('getServerConfig: validation', () => {
    it('requires CRON_SECRET when hosted and names the key', () => {
        const err = loadError({ NEXT_PUBLIC_IS_HOSTED: 'true', NEXT_PUBLIC_BASE_URL: 'https://x.example' });
        expect(err.message).toContain('CRON_SECRET');
        expect(err.status).toBe(500);
        expect(err.code).toBe('config');
    });

    it('requires CRON_SECRET on Vercel production', () => {
        const err = loadError({ VERCEL: '1', VERCEL_ENV: 'production', SESSION_SECRET: 's', NEXT_PUBLIC_BASE_URL: 'https://x.example' });
        expect(err.message).toContain('CRON_SECRET');
        expect(err.message).not.toContain('SESSION_SECRET');
    });

    it('does not require CRON_SECRET on a Vercel Preview of a self-host fork', () => {
        const cfg = load({ VERCEL: '1', VERCEL_ENV: 'preview', NODE_ENV: 'production', NEXT_PUBLIC_BASE_URL: 'https://x.example' });
        expect(cfg.cronSecret).toBeNull();
    });

    it('requires SESSION_SECRET in production off Vercel', () => {
        const err = loadError({ NODE_ENV: 'production' });
        expect(err.message).toContain('SESSION_SECRET');
    });

    it('requires SESSION_SECRET on Vercel production', () => {
        const err = loadError({ VERCEL: '1', VERCEL_ENV: 'production', NODE_ENV: 'production', CRON_SECRET: 'c' });
        expect(err.message).toContain('SESSION_SECRET');
    });

    it('uses an ephemeral secret with one warning on a Vercel Preview without SESSION_SECRET', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const env = { VERCEL: '1', VERCEL_ENV: 'preview', NODE_ENV: 'production', NEXT_PUBLIC_IS_HOSTED: 'true', CRON_SECRET: 'c', VERCEL_DEPLOYMENT_ID: 'dpl_1' };
            const cfg = load(env);
            expect(cfg.sessionSecret).not.toBe('dev-session-secret');
            expect(cfg.sessionSecret).toBe(createHmac('sha256', 'c').update('preview-session:dpl_1').digest('hex'));
            expect(warn).toHaveBeenCalledTimes(1);
            expect(String(warn.mock.calls[0][0])).toContain('SESSION_SECRET');

            const random = load({ VERCEL: '1', VERCEL_ENV: 'preview', NODE_ENV: 'production' });
            expect(random.sessionSecret).toMatch(/^[0-9a-f]{64}$/);
            expect(random.sessionSecret).not.toBe('dev-session-secret');
        } finally {
            warn.mockRestore();
        }
    });

    it('lists every missing key in one error', () => {
        const err = loadError({ NODE_ENV: 'production', NEXT_PUBLIC_IS_HOSTED: 'true', NEXT_PUBLIC_BASE_URL: 'https://x.example' });
        expect(err.message).toContain('SESSION_SECRET');
        expect(err.message).toContain('CRON_SECRET');
    });

    it('rejects a bot token without a base URL on Vercel', () => {
        const err = loadError({ VERCEL: '1', VERCEL_ENV: 'production', SESSION_SECRET: 's', CRON_SECRET: 'c', TELEGRAM_BOT_TOKEN: 't' });
        expect(err.message).toContain('NEXT_PUBLIC_BASE_URL is required when a bot token is configured');
    });

    it('rejects a Discord bot token without a base URL even when self-hosted', () => {
        const err = loadError({ DISCORD_BOT_TOKEN: 'd' });
        expect(err.message).toContain('NEXT_PUBLIC_BASE_URL is required when a bot token is configured');
    });

    it('rejects a Telegram token without a base URL on a self-host box (implicit polling)', () => {
        const err = loadError({ TELEGRAM_BOT_TOKEN: 't' });
        expect(err.message).toContain('NEXT_PUBLIC_BASE_URL');
    });

    it('rejects explicit polling without a base URL on a self-host box', () => {
        const err = loadError({ TELEGRAM_BOT_TOKEN: 't', TELEGRAM_MODE: 'polling' });
        expect(err.message).toContain('NEXT_PUBLIC_BASE_URL is required when a bot token is configured');
    });

    it('rejects a Telegram token without a base URL even when TELEGRAM_MODE=off', () => {
        const err = loadError({ TELEGRAM_BOT_TOKEN: 't', TELEGRAM_MODE: 'off' });
        expect(err.message).toContain('NEXT_PUBLIC_BASE_URL');
    });

    it('rejects polling without a base URL when hosted', () => {
        const err = loadError({ NEXT_PUBLIC_IS_HOSTED: 'true', CRON_SECRET: 'c', TELEGRAM_BOT_TOKEN: 't', TELEGRAM_MODE: 'polling' });
        expect(err.message).toContain('NEXT_PUBLIC_BASE_URL is required when a bot token is configured');
    });

    it('rejects non-numeric retention, an unknown log level, a bad mode and a bad URL, listing each key', () => {
        const err = loadError({
            CLEANUP_RETENTION_DAYS_DRAFT: 'abc',
            LOG_LEVEL: 'loud',
            TELEGRAM_MODE: 'carrier-pigeon',
            NEXT_PUBLIC_BASE_URL: 'not a url',
        });
        expect(err.message).toContain('CLEANUP_RETENTION_DAYS_DRAFT');
        expect(err.message).toContain('LOG_LEVEL');
        expect(err.message).toContain('TELEGRAM_MODE');
        expect(err.message).toContain('NEXT_PUBLIC_BASE_URL');
    });

    it('skips presence checks during next build, so a build without runtime secrets still compiles', () => {
        const cfg = load({ NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build', NEXT_PUBLIC_IS_HOSTED: 'true' });
        expect(cfg.cronSecret).toBeNull();
        expect(cfg.sessionSecret).not.toBe('');
    });
});

describe('getServerConfig: telegram edge cases', () => {
    it('is off without a token even if TELEGRAM_MODE is set', () => {
        expect(load({ TELEGRAM_MODE: 'webhook' }).telegram).toEqual({ token: null, mode: 'off' });
    });

    it('refuses explicit polling on Vercel', () => {
        const err = loadError({ VERCEL: '1', CRON_SECRET: 'c', NEXT_PUBLIC_BASE_URL: 'https://x.example', TELEGRAM_BOT_TOKEN: 't', TELEGRAM_MODE: 'polling' });
        expect(err.message).toContain('TELEGRAM_MODE');
    });
});
