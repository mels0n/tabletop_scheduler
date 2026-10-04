import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetServerConfigForTests } from '@/shared/config/server';
import { stubConfigEnv } from '@/shared/config/test-env';

const { logMock, startPolling, syncWebhook } = vi.hoisted(() => ({
    logMock: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    startPolling: vi.fn(),
    syncWebhook: vi.fn(),
}));
vi.mock('@/shared/lib/logger', () => ({ default: { get: () => logMock } }));
vi.mock('@/features/telegram', () => ({ startPolling, syncWebhook }));

import { register } from './instrumentation';

const MISSING_BASE_URL = /NEXT_PUBLIC_BASE_URL/;

describe('instrumentation register()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        startPolling.mockResolvedValue(undefined);
        syncWebhook.mockResolvedValue(true);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        resetServerConfigForTests();
    });

    function boot(env: Record<string, string>) {
        stubConfigEnv(env);
        vi.stubEnv('NEXT_RUNTIME', 'nodejs');
        resetServerConfigForTests();
        return register();
    }

    it('stays up and logs an error when a bot token is set without NEXT_PUBLIC_BASE_URL', async () => {
        await expect(boot({ DISCORD_BOT_TOKEN: 'd' })).resolves.toBeUndefined();
        expect(logMock.error).toHaveBeenCalledWith(expect.stringMatching(MISSING_BASE_URL));
    });

    it('still starts the Telegram poller on a self-host box without a base URL', async () => {
        await boot({ TELEGRAM_BOT_TOKEN: 't' });
        expect(logMock.error).toHaveBeenCalledWith(expect.stringMatching(MISSING_BASE_URL));
        expect(startPolling).toHaveBeenCalled();
    });

    it('logs no base URL error when it is set', async () => {
        await boot({ TELEGRAM_BOT_TOKEN: 't', NEXT_PUBLIC_BASE_URL: 'https://x.example' });
        expect(logMock.error).not.toHaveBeenCalled();
        expect(startPolling).toHaveBeenCalled();
    });

    it('logs nothing about the base URL when no bot is configured', async () => {
        await boot({});
        expect(logMock.error).not.toHaveBeenCalled();
    });
});
