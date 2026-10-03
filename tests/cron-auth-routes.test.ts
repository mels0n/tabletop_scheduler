import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/notifications', () => ({ runReminders: vi.fn(async () => ({})) }));
vi.mock('@/features/telegram/lib/telegram-client', () => ({ ensureWebhook: vi.fn() }));

import prisma from '@/shared/lib/prisma';
import { GET as cleanup } from '@/app/api/cron/cleanup/route';
import { GET as reminders } from '@/app/api/cron/reminders/route';
import { GET as webhooks } from '@/app/api/cron/webhooks/route';
import { GET as telegramSetup } from '@/app/api/telegram/setup/route';
import { ensureWebhook } from '@/features/telegram/lib/telegram-client';

const mockPrisma = prisma as any;
const SECRET = 'cron-secret-for-tests';

function req(path: string, headers: Record<string, string> = {}) {
    return new Request(`https://tabletop.example${path}`, { headers: { host: 'tabletop.example', ...headers } });
}

const routes = [
    ['cleanup', cleanup, '/api/cron/cleanup'],
    ['reminders', reminders, '/api/cron/reminders'],
    ['webhooks', webhooks, '/api/cron/webhooks'],
    ['telegram setup', telegramSetup, '/api/telegram/setup'],
] as const;

describe('cron and maintenance routes require CRON_SECRET', () => {
    beforeEach(() => {
        process.env.CRON_SECRET = SECRET;
        mockPrisma.event.findMany.mockResolvedValue([]);
        mockPrisma.webhookEvent.findMany.mockResolvedValue([]);
    });

    afterEach(() => {
        delete process.env.CRON_SECRET;
        delete process.env.TELEGRAM_BOT_TOKEN;
    });

    it.each(routes)('%s: no bearer -> 401', async (_name, handler, path) => {
        const res = await handler(req(path));
        expect(res.status).toBe(401);
        expect(await res.json()).toMatchObject({ code: 'unauthorized' });
    });

    it.each(routes)('%s: spoofed X-Forwarded-For loopback without bearer -> 401', async (_name, handler, path) => {
        const res = await handler(req(path, { 'x-forwarded-for': '127.0.0.1' }));
        expect(res.status).toBe(401);
    });

    it.each(routes)('%s: wrong bearer -> 401', async (_name, handler, path) => {
        const res = await handler(req(path, { authorization: 'Bearer nope' }));
        expect(res.status).toBe(401);
    });

    it('cleanup with the right bearer runs', async () => {
        const res = await cleanup(req('/api/cron/cleanup', { authorization: `Bearer ${SECRET}` }));
        expect(res.status).toBe(200);
    });

    it('webhooks with the right bearer runs', async () => {
        const res = await webhooks(req('/api/cron/webhooks', { authorization: `Bearer ${SECRET}` }));
        expect(res.status).toBe(200);
    });

    it('telegram setup never echoes the exception text', async () => {
        process.env.TELEGRAM_BOT_TOKEN = '123:secret-bot-token';
        (ensureWebhook as any).mockRejectedValue(new Error('fetch https://api.telegram.org/bot123:secret-bot-token failed'));

        const res = await telegramSetup(req('/api/telegram/setup', { authorization: `Bearer ${SECRET}` }));

        expect(res.status).toBe(500);
        expect(JSON.stringify(await res.json())).not.toContain('secret-bot-token');
    });
});
