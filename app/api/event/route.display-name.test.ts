import { describe, it, expect, vi, beforeEach } from 'vitest';

// The manager display name stored at create time comes from a client-writable cookie, so it
// goes through readDiscordDisplayName (length and control-character checks) like every
// other reader.
const { cookieJar } = vi.hoisted(() => ({ cookieJar: new Map<string, string>() }));
vi.mock('@/shared/lib/prisma');
vi.mock('@/features/integrations/webhooks', () => ({ processWebhookRow: vi.fn() }));
vi.mock('next/headers', () => ({
    cookies: async () => ({
        get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    }),
    headers: async () => new Headers(),
}));

import prisma from '@/shared/lib/prisma';
import { signValue } from '@/shared/lib/session';
import { POST } from './route';

const mockPrisma = prisma as any;
const slot = { startTime: '2026-11-01T18:00:00.000Z', endTime: '2026-11-01T22:00:00.000Z' };
const valid = { title: 'Game Night', description: '', minPlayers: 3, maxPlayers: null, eventType: 'ONE_SHOT', timezone: 'Europe/London', slots: [slot], fromUrl: null, fromUrlId: null };

function request(body: unknown) {
    return new Request('https://tabletop.example/api/event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('POST /api/event: manager Discord display name', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        cookieJar.clear();
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockPrisma));
        mockPrisma.event.create.mockImplementation(async ({ data }: any) => ({ id: 11, slug: data.slug, title: data.title }));
        cookieJar.set('tabletop_user_discord_id', signValue('identity:discord', '123456789012345678'));
    });

    it('drops an oversized or control-character display name instead of storing it', async () => {
        for (const name of ['x'.repeat(65), 'Owner\nInjected']) {
            mockPrisma.event.create.mockClear();
            cookieJar.set('tabletop_user_discord_name', name);

            expect((await POST(request(valid))).status).toBe(200);

            expect(mockPrisma.event.create.mock.calls[0][0].data.managerDiscordUsername).toBeNull();
        }
    });

    it('stores a trimmed, valid display name', async () => {
        cookieJar.set('tabletop_user_discord_name', '  Owner  ');

        await POST(request(valid));

        expect(mockPrisma.event.create.mock.calls[0][0].data.managerDiscordUsername).toBe('Owner');
    });
});
