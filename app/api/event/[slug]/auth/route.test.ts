import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/shared/lib/prisma';
import { hashToken } from '@/shared/lib/token';
import { verifyValue } from '@/shared/lib/session';
import { GET } from './route';

vi.mock('@/shared/lib/prisma');

const mockPrisma = prisma as unknown as { event: { findUnique: ReturnType<typeof vi.fn> } };
const RAW = 'raw-admin-token';

function call(query: string) {
    const req = new NextRequest(`http://selfhost.lan:3000/api/event/abc/auth${query}`);
    return GET(req, { params: Promise.resolve({ slug: 'abc' }) });
}

describe('GET /api/event/[slug]/auth', () => {
    const store = { set: vi.fn(), get: vi.fn() };

    beforeEach(() => {
        vi.resetAllMocks();
        (cookies as any).mockResolvedValue(store);
        mockPrisma.event.findUnique.mockResolvedValue({
            slug: 'abc',
            adminToken: hashToken(RAW),
            managerDiscordId: '987654321',
            managerDiscordUsername: 'chris',
            managerChatId: '555',
        });
    });

    it('redirects relative to the request origin when the token is missing', async () => {
        const res = await call('');
        expect(res.headers.get('location')).toBe('http://selfhost.lan:3000/e/abc');
    });

    it('rejects the stored hash used as the token', async () => {
        const res = await call(`?token=${hashToken(RAW)}`);
        expect(res.headers.get('location')).toBe('http://selfhost.lan:3000/e/abc?error=invalid_token');
        expect(store.set).not.toHaveBeenCalled();
    });

    it('accepts the raw token, sets the admin cookie and signed identity cookies', async () => {
        const res = await call(`?token=${RAW}`);
        expect(res.headers.get('location')).toBe('http://selfhost.lan:3000/e/abc/manage');

        const byName = new Map(store.set.mock.calls.map((c) => [c[0], c[1]]));
        expect(byName.get('tabletop_admin_abc')).toBe(RAW);
        expect(verifyValue(byName.get('tabletop_user_discord_id'))).toBe('987654321');
        expect(verifyValue(byName.get('tabletop_user_chat_id'))).toBe('555');
        expect(byName.get('tabletop_user_discord_name')).toBe('chris');
    });
});
