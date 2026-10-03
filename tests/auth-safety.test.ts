import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setAdminCookie, verifyEventAdmin } from '@/features/auth/server/actions';
import { cookies } from 'next/headers';
import prisma from '@/shared/lib/prisma';
import { hashToken } from '@/shared/lib/token';

vi.mock('@/shared/lib/prisma');

// Helper to cast mocked functions
const mockPrisma = prisma as unknown as { event: { findUnique: ReturnType<typeof vi.fn> } };

describe('Auth Safety Net (app/actions.ts)', () => {
    const mockCookieStore = {
        set: vi.fn(),
        get: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        // Setup cookie store mock
        (cookies as any).mockReturnValue(mockCookieStore);
    });

    describe('setAdminCookie', () => {
        it('should set a secure http-only cookie', async () => {
            await setAdminCookie('my-slug', 'my-token');

            expect(mockCookieStore.set).toHaveBeenCalledWith(
                'tabletop_admin_my-slug',
                'my-token',
                expect.objectContaining({
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    maxAge: expect.any(Number),
                })
            );
        });
    });

    describe('verifyEventAdmin', () => {
        it('should return false if no cookie is present', async () => {
            mockCookieStore.get.mockReturnValue(undefined);

            const result = await verifyEventAdmin('my-slug');
            expect(result).toBe(false);
        });

        it('should return false if event not found', async () => {
            mockCookieStore.get.mockImplementation((name: string) =>
                name === 'tabletop_admin_my-slug' ? { value: 'sometoken' } : undefined
            );
            mockPrisma.event.findUnique.mockResolvedValue(null);

            const result = await verifyEventAdmin('my-slug');
            expect(result).toBe(false);
        });

        it('should return false if the stored value is plaintext (legacy compare removed)', async () => {
            mockCookieStore.get.mockImplementation((name: string) =>
                name === 'tabletop_admin_my-slug' ? { value: 'valid-token' } : undefined
            );
            mockPrisma.event.findUnique.mockResolvedValue({ adminToken: 'valid-token' });

            const result = await verifyEventAdmin('my-slug');
            expect(result).toBe(false);
        });

        it('should return true if the hash of the cookie token matches', async () => {
            mockCookieStore.get.mockImplementation((name: string) =>
                name === 'tabletop_admin_my-slug' ? { value: 'valid-token' } : undefined
            );
            mockPrisma.event.findUnique.mockResolvedValue({ adminToken: hashToken('valid-token') });

            const result = await verifyEventAdmin('my-slug');
            expect(result).toBe(true);
        });
    });
});
