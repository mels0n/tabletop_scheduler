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

// Discord identity is sourced from the httpOnly session cookies, never the body.
// cookieJar is the per-test cookie state; vi.hoisted so the hoisted mock factory can see it.
const { cookieJar } = vi.hoisted(() => ({ cookieJar: new Map<string, string>() }));
vi.mock('next/headers', () => ({
    cookies: () => ({
        get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    }),
    headers: () => new Headers(),
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
        cookieJar.clear();
        mockPrisma.event.findUnique.mockResolvedValue(baseEvent);
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(prisma));
        mockPrisma.vote.findMany.mockResolvedValue([]);
    });

    it('skips passive chatId resolution and discordId/discordUsername write when linkIdentity is false', async () => {
        mockPrisma.participant.create.mockResolvedValue({ id: 42 });
        cookieJar.set('tabletop_user_discord_id', 'cookie-discord-1');
        cookieJar.set('tabletop_user_discord_name', 'CookieUser');

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

    it('links Discord from the session cookie (not the body) when linkDiscord=true and linkTelegram=false', async () => {
        mockPrisma.participant.create.mockResolvedValue({ id: 44 });
        cookieJar.set('tabletop_user_discord_id', 'cookie-discord-1');
        cookieJar.set('tabletop_user_discord_name', 'CookieUser');

        const res = await POST(
            mockRequest({
                name: 'Chris',
                telegramId: '@someone',
                discordId: 'forged-discord-id',
                discordUsername: 'ForgedUser',
                linkTelegram: false,
                linkDiscord: true,
                votes: [{ slotId: 1, preference: 'YES', canHost: false }],
            }),
            { params: { slug: '1' } }
        );
        await res;

        // Telegram off: no passive resolution, chatId stays null.
        expect(mockPrisma.participant.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.event.findFirst).not.toHaveBeenCalled();

        const createData = mockPrisma.participant.create.mock.calls[0][0].data;
        expect(createData.chatId).toBeNull();
        // Discord on: identity written from the authenticated cookie, body values ignored.
        expect(createData.discordId).toBe('cookie-discord-1');
        expect(createData.discordUsername).toBe('CookieUser');
    });

    it('does not write Discord identity when no Discord session cookie exists, even if the body supplies one', async () => {
        mockPrisma.participant.create.mockResolvedValue({ id: 46 });

        const res = await POST(
            mockRequest({
                name: 'Mallory',
                discordId: 'victim-discord-id',
                discordUsername: 'Victim',
                linkDiscord: true,
                votes: [{ slotId: 1, preference: 'YES', canHost: false }],
            }),
            { params: { slug: '1' } }
        );
        await res;

        const createData = mockPrisma.participant.create.mock.calls[0][0].data;
        expect(createData).not.toHaveProperty('discordId');
        expect(createData).not.toHaveProperty('discordUsername');
    });

    it('sources Discord identity from the cookie on participant update as well', async () => {
        mockPrisma.participant.findUnique.mockResolvedValue({ id: 47, eventId: 1, chatId: '123' });
        mockPrisma.participant.update.mockResolvedValue({ id: 47 });
        cookieJar.set('tabletop_user_discord_id', 'cookie-discord-2');
        cookieJar.set('tabletop_user_discord_name', 'CookieUser2');

        const res = await POST(
            mockRequest({
                name: 'Chris',
                participantId: 47,
                discordId: 'forged-discord-id',
                discordUsername: 'ForgedUser',
                votes: [{ slotId: 1, preference: 'YES', canHost: false }],
            }),
            { params: { slug: '1' } }
        );
        await res;

        const updateData = mockPrisma.participant.update.mock.calls[0][0].data;
        expect(updateData.discordId).toBe('cookie-discord-2');
        expect(updateData.discordUsername).toBe('CookieUser2');
    });

    it('resolves Telegram but skips Discord write when linkTelegram=true and linkDiscord=false', async () => {
        mockPrisma.participant.findFirst.mockResolvedValue({ chatId: '999' });
        mockPrisma.participant.create.mockResolvedValue({ id: 45 });
        cookieJar.set('tabletop_user_discord_id', 'cookie-discord-1');
        cookieJar.set('tabletop_user_discord_name', 'CookieUser');

        const res = await POST(
            mockRequest({
                name: 'Chris',
                telegramId: '@someone',
                discordId: 'discord-1',
                discordUsername: 'SomeUser',
                linkTelegram: true,
                linkDiscord: false,
                votes: [{ slotId: 1, preference: 'YES', canHost: false }],
            }),
            { params: { slug: '1' } }
        );
        await res;

        // Telegram on: passive resolution runs and its chatId is inherited.
        expect(mockPrisma.participant.findFirst).toHaveBeenCalled();
        const createData = mockPrisma.participant.create.mock.calls[0][0].data;
        expect(createData.chatId).toBe('999');
        // Discord off: identity not written.
        expect(createData).not.toHaveProperty('discordId');
        expect(createData).not.toHaveProperty('discordUsername');
    });

    it('stores telegramId canonicalized (no leading @, lowercased) regardless of how the voter typed it', async () => {
        mockPrisma.participant.create.mockResolvedValue({ id: 43 });

        const res = await POST(
            mockRequest({
                name: 'Chris',
                telegramId: '@MelS0n',
                linkIdentity: false,
                votes: [{ slotId: 1, preference: 'YES', canHost: false }],
            }),
            { params: { slug: '1' } }
        );
        await res;

        const createData = mockPrisma.participant.create.mock.calls[0][0].data;
        expect(createData.telegramId).toBe('mels0n');
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
