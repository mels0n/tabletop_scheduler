import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { runReminders } = vi.hoisted(() => ({ runReminders: vi.fn() }));
vi.mock('@/features/notifications', () => ({ runReminders }));

import { GET } from './route';

const SECRET = 'cron-secret-for-tests';
const call = () =>
    GET(new Request('https://tabletop.example/api/cron/reminders', {
        headers: { host: 'tabletop.example', authorization: `Bearer ${SECRET}` },
    }));

describe('GET /api/cron/reminders', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        process.env.CRON_SECRET = SECRET;
        process.env.DISCORD_BOT_TOKEN = 'dc-token';
    });

    afterEach(() => {
        delete process.env.CRON_SECRET;
        delete process.env.DISCORD_BOT_TOKEN;
    });

    it('returns 200 with the summary when both runs completed', async () => {
        runReminders.mockResolvedValue({ ok: true, voting: { sent: 1, failed: 0 }, session: { sent: 0, failed: 0 } });

        const res = await call();

        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ success: true, voting: { sent: 1 } });
    });

    it('returns 500 when a whole run threw, so the scheduler sees the failure', async () => {
        runReminders.mockResolvedValue({ ok: false, voting: { sent: 0, failed: 1 }, session: { sent: 0, failed: 0 } });

        const res = await call();

        expect(res.status).toBe(500);
    });
});
