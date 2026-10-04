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
            voteAnnounceCooldownMinutes: 60,
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
    it('defaults to webhook on Vercel', () => {
        const cfg = load({ VERCEL: '1', TELEGRAM_BOT_TOKEN: 't', NEXT_PUBLIC_BASE_URL: 'https://x.example' });
        expect(cfg.telegram).toEqual({ token: 't', mode: 'webhook' });
    });

    it('defaults to webhook when hosted', () => {
        const cfg = load({ NEXT_PUBLIC_IS_HOSTED: 'true', CRON_SECRET: 'c', TELEGRAM_BOT_TOKEN: 't', NEXT_PUBLIC_BASE_URL: 'https://x.example' });
        expect(cfg.telegram.mode).toBe('webhook');
    });

    it('defaults to polling off Vercel, even with a public base URL', () => {
        const cfg = load({ TELEGRAM_BOT_TOKEN: 't', NEXT_PUBLIC_BASE_URL: 'https://x.example' });
        expect(cfg.telegram).toEqual({ token: 't', mode: 'polling' });
    });

    it('uses webhook off Vercel only when TELEGRAM_MODE=webhook', () => {
        const cfg = load({ TELEGRAM_BOT_TOKEN: 't', TELEGRAM_MODE: 'webhook', NEXT_PUBLIC_BASE_URL: 'https://x.example' });
        expect(cfg.telegram.mode).toBe('webhook');
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

    it('rejects a bot token without a base URL when hosted', () => {
        const err = loadError({ NEXT_PUBLIC_IS_HOSTED: 'true', CRON_SECRET: 'c', DISCORD_BOT_TOKEN: 'd' });
        expect(err.message).toContain('NEXT_PUBLIC_BASE_URL is required when a bot token is configured');
    });

    // Self-host stays up without a base URL: instrumentation logs an error and bot links fail until it is set.
    it('boots a self-host box with a Discord bot token and no base URL', () => {
        const cfg = load({ DISCORD_BOT_TOKEN: 'd' });
        expect(cfg.baseUrl).toBeNull();
        expect(cfg.discord.botToken).toBe('d');
    });

    it('boots a self-host box with a Telegram token and no base URL, polling by default', () => {
        const cfg = load({ TELEGRAM_BOT_TOKEN: 't' });
        expect(cfg.baseUrl).toBeNull();
        expect(cfg.telegram).toEqual({ token: 't', mode: 'polling' });
    });

    it('boots a production self-host box with a bot token and no base URL', () => {
        const cfg = load({ NODE_ENV: 'production', SESSION_SECRET: 's', TELEGRAM_BOT_TOKEN: 't', TELEGRAM_MODE: 'off' });
        expect(cfg.baseUrl).toBeNull();
        expect(cfg.telegram.mode).toBe('off');
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

describe('getServerConfig: vote announcement cooldown', () => {
    it('defaults to 60 minutes and accepts 0 (disabled) through 1440', () => {
        expect(load().voteAnnounceCooldownMinutes).toBe(60);
        expect(load({ VOTE_ANNOUNCE_COOLDOWN_MINUTES: '0' }).voteAnnounceCooldownMinutes).toBe(0);
        expect(load({ VOTE_ANNOUNCE_COOLDOWN_MINUTES: '15' }).voteAnnounceCooldownMinutes).toBe(15);
        expect(load({ VOTE_ANNOUNCE_COOLDOWN_MINUTES: '1440' }).voteAnnounceCooldownMinutes).toBe(1440);
    });

    it.each(['1441', '-1', '1.5', 'abc'])('rejects %s', (value) => {
        const err = loadError({ VOTE_ANNOUNCE_COOLDOWN_MINUTES: value });
        expect(err.message).toContain('VOTE_ANNOUNCE_COOLDOWN_MINUTES');
    });
});
