import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cookies } from 'next/headers';
import { POST } from './route';

describe('POST /api/auth/clear-session', () => {
    const store = {
        getAll: vi.fn(),
        delete: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        (cookies as any).mockResolvedValue(store);
    });

    it('deletes identity, display-name and every admin cookie present', async () => {
        store.getAll.mockReturnValue([
            { name: 'tabletop_admin_abc', value: 'x' },
            { name: 'tabletop_admin_def', value: 'y' },
            { name: 'unrelated', value: 'z' },
        ]);

        const res = await POST();
        expect(await res.json()).toEqual({ cleared: true });

        const deleted = store.delete.mock.calls.map((c) => c[0]);
        expect(deleted).toEqual(expect.arrayContaining([
            'tabletop_user_chat_id',
            'tabletop_user_telegram_name',
            'tabletop_user_discord_id',
            'tabletop_user_discord_name',
            'tabletop_admin_abc',
            'tabletop_admin_def',
        ]));
        expect(deleted).not.toContain('unrelated');
    });
});
