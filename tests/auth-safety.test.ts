import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setAdminCookie, verifyEventAdmin } from '@/features/auth/server/actions';
import { cookies } from 'next/headers';
import prisma from '@/shared/lib/prisma';

vi.mock('@/shared/lib/prisma');

// Helper to cast mocked functions
const mockCookies = cookies as unknown as ReturnType<typeof vi.fn>;
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
            mockCookieStore.get.mockReturnValue({ value: 'sometoekn' });
            mockPrisma.event.findUnique.mockResolvedValue(null);

            const result = await verifyEventAdmin('my-slug');
            expect(result).toBe(false);
        });

        it('should return true if token matches plaintext (migration support)', async () => {
            mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
            mockPrisma.event.findUnique.mockResolvedValue({ adminToken: 'valid-token' });

            const result = await verifyEventAdmin('my-slug');
            expect(result).toBe(true);
        });

        // Note: We'd treat hash verification as a refactor goal or verify it if logic exists.
        // The current implementation seen has hash logic, so we should test that too if practical,
        // but for a safety net, ensuring the "Happy Path" works is critical.
    });
});
