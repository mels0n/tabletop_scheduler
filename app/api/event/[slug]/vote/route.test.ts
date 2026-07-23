import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { resolvePassiveChatId } from '@/features/auth/server/passive-link';
import prisma from '@/shared/lib/prisma';

vi.mock('@/shared/lib/prisma');
// syncDashboard is dynamically imported unconditionally at the end of every POST; stub it
// out so the test only exercises the participant/vote persistence being tested here.
vi.mock('@/app/api/event/[slug]/slot/notify', () => ({
    syncDashboard: vi.fn(),
}));

const mockPrisma = prisma as unknown as {
    event: { findUnique: ReturnType<typeof vi.fn>, findFirst: ReturnType<typeof vi.fn> },
    participant: { findUnique: ReturnType<typeof vi.fn>, findFirst: ReturnType<typeof vi.fn>, create: ReturnType<typeof vi.fn>, update: ReturnType<typeof vi.fn> },
    vote: { findMany: ReturnType<typeof vi.fn>, deleteMany: ReturnType<typeof vi.fn>, createMany: ReturnType<typeof vi.fn> },
    $transaction: ReturnType<typeof vi.fn>,
};

function mockRequest(body: any) {
    return { json: async () => body } as unknown as Request;
}

const baseEvent = {
    id: 1,
    status: 'VOTING',
    maxPlayers: null,
    slug: 'test-event',
    finalizedSlotId: null,
    telegramChatId: null,
    discordChannelId: null,
    managerChatId: null,
    quorumPerfectNotified: false,
    quorumViableNotified: false,
    timeSlots: [],
};

describe('POST /api/event/[slug]/vote — linkIdentity opt-out', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockPrisma.event.findUnique.mockResolvedValue(baseEvent);
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(prisma));
        mockPrisma.vote.findMany.mockResolvedValue([]);
    });

    it('skips passive chatId resolution and discordId/discordUsername write when linkIdentity is false', async () => {
        mockPrisma.participant.create.mockResolvedValue({ id: 42 });

        const res = await POST(
            mockRequest({
                name: 'Chris',
                telegramId: '@someone',
                discordId: 'discord-1',
                discordUsername: 'SomeUser',
                linkIdentity: false,
                votes: [{ slotId: 1, preference: 'YES', canHost: false }],
            }),
            { params: { slug: '1' } }
        );
        await res;

        expect(mockPrisma.participant.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.event.findFirst).not.toHaveBeenCalled();

        const createData = mockPrisma.participant.create.mock.calls[0][0].data;
        expect(createData).not.toHaveProperty('discordId');
        expect(createData).not.toHaveProperty('discordUsername');
        expect(createData.chatId).toBeNull();
    });
});

describe('resolvePassiveChatId', () => {
    it('matches an existing Participant chatId regardless of @ prefix on either side', async () => {
        const tx = {
            participant: {
                findFirst: vi.fn().mockResolvedValue({ chatId: '111' })
            },
            event: {
                findFirst: vi.fn()
            }
        };

        const result = await resolvePassiveChatId(tx, '@pyaniz');

        expect(result).toBe('111');
        expect(tx.participant.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                telegramId: { in: ['pyaniz', '@pyaniz'] },
                NOT: { chatId: null }
            })
        }));
        // Found via Participant; should never fall back to the Event manager lookup.
        expect(tx.event.findFirst).not.toHaveBeenCalled();
    });

    it('falls back to Event.managerTelegram/managerChatId when no Participant row matches', async () => {
        const tx = {
            participant: {
                findFirst: vi.fn().mockResolvedValue(null)
            },
            event: {
                findFirst: vi.fn().mockResolvedValue({ managerChatId: '171713700' })
            }
        };

        const result = await resolvePassiveChatId(tx, 'mels0n');

        expect(result).toBe('171713700');
        expect(tx.event.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                managerTelegram: { in: ['mels0n', '@mels0n'] },
                NOT: { managerChatId: null }
            })
        }));
    });

    it('returns null when neither a Participant nor an Event manager record matches', async () => {
        const tx = {
            participant: { findFirst: vi.fn().mockResolvedValue(null) },
            event: { findFirst: vi.fn().mockResolvedValue(null) }
        };

        const result = await resolvePassiveChatId(tx, 'nobody');

        expect(result).toBeNull();
    });
});
