import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setAdminCookie } from './actions';
import { cookies } from 'next/headers';

// verifyEventAdmin is covered by verify.test.ts.
describe('setAdminCookie', () => {
    const mockCookieStore = {
        set: vi.fn(),
        get: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        (cookies as any).mockReturnValue(mockCookieStore);
    });

    it('sets a secure http-only cookie scoped to the event', async () => {
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
