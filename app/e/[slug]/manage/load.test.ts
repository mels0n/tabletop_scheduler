import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/shared/lib/prisma';
import { verifyEventAdmin } from '@/features/auth';
import { getBotUsername } from '@/features/telegram';
import { loadManagePage } from './load';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/auth', () => ({ verifyEventAdmin: vi.fn() }));
vi.mock('@/features/telegram', () => ({ getBotUsername: vi.fn() }));

const mockPrisma = prisma as unknown as { event: { findUnique: ReturnType<typeof vi.fn> } };

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBotUsername).mockResolvedValue('SomeBot');
    mockPrisma.event.findUnique.mockResolvedValue({ id: 1 });
});

describe('loadManagePage', () => {
    it('starts the event query before the admin check resolves', async () => {
        let resolveAdmin!: (v: boolean) => void;
        vi.mocked(verifyEventAdmin).mockReturnValue(new Promise(r => { resolveAdmin = r; }));
        const pending = loadManagePage('evt');
        await Promise.resolve();
        expect(mockPrisma.event.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { slug: 'evt' } }));
        resolveAdmin(true);
        await pending;
    });

    it('returns { isAdmin: false } and no event when the admin check fails', async () => {
        vi.mocked(verifyEventAdmin).mockResolvedValue(false);
        expect(await loadManagePage('evt')).toEqual({ isAdmin: false });
    });

    it('returns the event and bot name for an admin', async () => {
        vi.mocked(verifyEventAdmin).mockResolvedValue(true);
        expect(await loadManagePage('evt')).toEqual({ isAdmin: true, event: { id: 1 }, botUsername: 'SomeBot' });
    });

    it('falls back to TabletopSchedulerBot when the bot lookup returns null', async () => {
        vi.mocked(verifyEventAdmin).mockResolvedValue(true);
        vi.mocked(getBotUsername).mockResolvedValue(null);
        expect(await loadManagePage('evt')).toMatchObject({ isAdmin: true, botUsername: 'TabletopSchedulerBot' });
    });
});
