import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/shared/lib/prisma';
import { hashToken } from '@/shared/lib/token';
import { GET } from './route';

vi.mock('@/shared/lib/prisma');

const mockPrisma = prisma as unknown as { event: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } };
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

    it('accepts the raw token and sets only the admin cookie, never an identity cookie from event fields', async () => {
        const res = await call(`?token=${RAW}`);
        expect(res.headers.get('location')).toBe('http://selfhost.lan:3000/e/abc/manage');

        const names = store.set.mock.calls.map((c) => c[0]);
        expect(names).toEqual(['tabletop_admin_abc']);
        expect(store.set.mock.calls[0][1]).toBe(RAW);
    });

    it('accepts a legacy plaintext row, upgrades it to the hash, and sets the admin cookie', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ slug: 'abc', adminToken: RAW });

        const res = await call(`?token=${RAW}`);

        expect(res.headers.get('location')).toBe('http://selfhost.lan:3000/e/abc/manage');
        expect(mockPrisma.event.update).toHaveBeenCalledWith({
            where: { slug: 'abc' },
            data: { adminToken: hashToken(RAW) },
        });
        expect(store.set.mock.calls.map((c) => c[0])).toEqual(['tabletop_admin_abc']);
    });

    it('rejects a wrong token for a legacy plaintext row without upgrading it', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ slug: 'abc', adminToken: RAW });

        const res = await call('?token=nope');

        expect(res.headers.get('location')).toBe('http://selfhost.lan:3000/e/abc?error=invalid_token');
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });
});
