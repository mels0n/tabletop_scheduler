import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from './route';
import prisma from '@/shared/lib/prisma';
import { sendDirectMessage } from '@/features/notifications';
import { checkEventQuorum } from '@/shared/lib/quorum';
import { signValue } from '@/shared/lib/session';
import { syncDashboard } from '@/features/event-management/server/dashboard-sync';
import { broadcastToEvent } from '@/features/notifications';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/notifications', () => ({
    sendDirectMessage: vi.fn(),
    broadcastToEvent: vi.fn(),
    isDelivered: (r: any) => r.telegram.status === 'sent' || r.discord.status === 'sent',
}));
vi.mock('@/shared/lib/quorum', () => ({
    checkEventQuorum: vi.fn(),
}));
// syncDashboard runs in after() on every POST; stub it out so the tests only exercise
// what they target.
vi.mock('@/features/event-management/server/dashboard-sync', () => ({
    syncDashboard: vi.fn(),
}));

// after() callbacks are queued here and run by flushAfter(), standing in for Next running
// them once the response has been sent.
const { afterQueue } = vi.hoisted(() => ({ afterQueue: [] as Array<() => unknown> }));
vi.mock('next/server', async (importOriginal) => ({
    ...(await importOriginal<typeof import('next/server')>()),
    after: (task: () => unknown) => { afterQueue.push(task); },
}));
async function flushAfter() {
    while (afterQueue.length) await afterQueue.shift()!();
}

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
    event: { findUnique: ReturnType<typeof vi.fn>, findFirst: ReturnType<typeof vi.fn>, updateMany: ReturnType<typeof vi.fn> },
    participant: { findUnique: ReturnType<typeof vi.fn>, findFirst: ReturnType<typeof vi.fn>, create: ReturnType<typeof vi.fn>, update: ReturnType<typeof vi.fn>, count: ReturnType<typeof vi.fn> },
    vote: { findMany: ReturnType<typeof vi.fn>, deleteMany: ReturnType<typeof vi.fn>, createMany: ReturnType<typeof vi.fn> },
    timeSlot: { findMany: ReturnType<typeof vi.fn> },
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

describe('POST /api/event/[slug]/vote: linkIdentity opt-out', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        cookieJar.clear();
        afterQueue.length = 0;
        mockPrisma.event.findUnique.mockResolvedValue(baseEvent);
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(prisma));
        mockPrisma.vote.findMany.mockResolvedValue([]);
        mockPrisma.timeSlot.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        (checkEventQuorum as any).mockReturnValue({ perfect: false, viable: false });
    });

    it('links neither the verified chatId nor discordId/discordUsername when linkIdentity is false', async () => {
        mockPrisma.participant.create.mockResolvedValue({ id: 42 });
        cookieJar.set('tabletop_user_chat_id', signValue('identity:telegram', '777'));
        cookieJar.set('tabletop_user_discord_id', signValue('identity:discord', 'cookie-discord-1'));
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
            { params: Promise.resolve({ slug: '1' }) }
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
        cookieJar.set('tabletop_user_discord_id', signValue('identity:discord', 'cookie-discord-1'));
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
            { params: Promise.resolve({ slug: '1' }) }
        );
        await res;

        // Telegram off: chatId stays null.
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
            { params: Promise.resolve({ slug: '1' }) }
        );
        await res;

        const createData = mockPrisma.participant.create.mock.calls[0][0].data;
        expect(createData).not.toHaveProperty('discordId');
        expect(createData).not.toHaveProperty('discordUsername');
    });

    it('sources Discord identity from the cookie on participant update as well', async () => {
        mockPrisma.participant.findFirst.mockResolvedValue({ id: 47, eventId: 1, chatId: '123' });
        mockPrisma.participant.update.mockResolvedValue({ id: 47 });
        cookieJar.set('tabletop_participant_test-event', signValue('participant:test-event', '47'));
        cookieJar.set('tabletop_user_discord_id', signValue('identity:discord', 'cookie-discord-2'));
        cookieJar.set('tabletop_user_discord_name', 'CookieUser2');

        const res = await POST(
            mockRequest({
                name: 'Chris',
                participantId: 47,
                discordId: 'forged-discord-id',
                discordUsername: 'ForgedUser',
                votes: [{ slotId: 1, preference: 'YES', canHost: false }],
            }),
            { params: Promise.resolve({ slug: '1' }) }
        );
        await res;

        const updateData = mockPrisma.participant.update.mock.calls[0][0].data;
        expect(updateData.discordId).toBe('cookie-discord-2');
        expect(updateData.discordUsername).toBe('CookieUser2');
    });

    it('links Telegram from the verified chat cookie but skips Discord when linkTelegram=true and linkDiscord=false', async () => {
        mockPrisma.participant.create.mockResolvedValue({ id: 45 });
        cookieJar.set('tabletop_user_chat_id', signValue('identity:telegram', '999'));
        cookieJar.set('tabletop_user_discord_id', signValue('identity:discord', 'cookie-discord-1'));
        cookieJar.set('tabletop_user_discord_name', 'CookieUser');

        await POST(
            mockRequest({
                name: 'Chris',
                telegramId: '@someone',
                linkTelegram: true,
                linkDiscord: false,
                votes: [{ slotId: 1, preference: 'YES', canHost: false }],
            }),
            { params: Promise.resolve({ slug: '1' }) }
        );

        const createData = mockPrisma.participant.create.mock.calls[0][0].data;
        expect(createData.chatId).toBe('999');
        expect(createData).not.toHaveProperty('discordId');
        expect(createData).not.toHaveProperty('discordUsername');
    });

    it('never resolves a chatId from a typed handle', async () => {
        mockPrisma.participant.create.mockResolvedValue({ id: 48 });
        mockPrisma.participant.findFirst.mockResolvedValue({ chatId: '999' });
        mockPrisma.event.findFirst.mockResolvedValue({ managerChatId: '888' });

        await POST(
            mockRequest({ name: 'Mallory', telegramId: '@victim', votes: [{ slotId: 1, preference: 'YES', canHost: false }] }),
            { params: Promise.resolve({ slug: '1' }) }
        );

        expect(mockPrisma.participant.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.event.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.participant.create.mock.calls[0][0].data.chatId).toBeNull();
    });

    it('ignores an unsigned chat cookie', async () => {
        mockPrisma.participant.create.mockResolvedValue({ id: 49 });
        cookieJar.set('tabletop_user_chat_id', '999');

        await POST(
            mockRequest({ name: 'Mallory', votes: [{ slotId: 1, preference: 'YES', canHost: false }] }),
            { params: Promise.resolve({ slug: '1' }) }
        );

        expect(mockPrisma.participant.create.mock.calls[0][0].data.chatId).toBeNull();
    });

    it('self-heals a missing chatId on update from the verified chat cookie only', async () => {
        mockPrisma.participant.findFirst.mockResolvedValue({ id: 47, eventId: 1, chatId: null, discordId: null });
        mockPrisma.participant.update.mockResolvedValue({ id: 47 });
        cookieJar.set('tabletop_participant_test-event', signValue('participant:test-event', '47'));
        cookieJar.set('tabletop_user_chat_id', signValue('identity:telegram', '555'));

        await POST(
            mockRequest({ name: 'Chris', participantId: 47, telegramId: 'chris', votes: [{ slotId: 1, preference: 'YES', canHost: false }] }),
            { params: Promise.resolve({ slug: '1' }) }
        );

        expect(mockPrisma.participant.update.mock.calls[0][0].data.chatId).toBe('555');
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
            { params: Promise.resolve({ slug: '1' }) }
        );
        await res;

        const createData = mockPrisma.participant.create.mock.calls[0][0].data;
        expect(createData.telegramId).toBe('mels0n');
    });
});

describe('POST /api/event/[slug]/vote - manager quorum alerts', () => {
    const mockSend = sendDirectMessage as unknown as ReturnType<typeof vi.fn>;
    const mockQuorum = checkEventQuorum as unknown as ReturnType<typeof vi.fn>;
    const mockEventUpdate = (prisma as any).event.update as ReturnType<typeof vi.fn>;
    const mockParticipantCount = (prisma as any).participant.count as ReturnType<typeof vi.fn>;
    const sent = { status: 'sent', messageId: '1' };
    const notLinked = { status: 'skipped', reason: 'not_linked' };
    const failed = { status: 'failed', error: 'boom' };

    const body = { name: 'Chris', linkIdentity: false, votes: [{ slotId: 1, preference: 'YES', canHost: false }] };

    beforeEach(() => {
        vi.resetAllMocks();
        cookieJar.clear();
        afterQueue.length = 0;
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(prisma));
        mockPrisma.vote.findMany.mockResolvedValue([]);
        mockPrisma.timeSlot.findMany.mockResolvedValue([{ id: 1 }]);
        mockPrisma.participant.create.mockResolvedValue({ id: 1 });
        mockPrisma.event.updateMany.mockResolvedValue({ count: 1 });
        mockParticipantCount.mockResolvedValue(4);
        mockQuorum.mockReturnValue({ perfect: false, viable: true });
    });

    it('DMs a Discord-only manager on viable quorum and sets the flag', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...baseEvent, title: 'Game Night', managerDiscordId: 'd-mgr' });
        mockSend.mockResolvedValue({ telegram: notLinked, discord: sent });

        await POST(mockRequest(body), { params: Promise.resolve({ slug: '1' }) });
        await flushAfter();

        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend.mock.calls[0][0]).toEqual({ telegramChatId: null, discordUserId: 'd-mgr' });
        expect(mockSend.mock.calls[0][1].html).toContain('Viable Quorum Reached');
        expect(mockEventUpdate).toHaveBeenCalledWith({ where: { id: 1 }, data: { quorumViableNotified: true } });
    });

    it('sets both flags on perfect quorum for a Discord-only manager', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...baseEvent, title: 'Game Night', managerDiscordId: 'd-mgr' });
        mockQuorum.mockReturnValue({ perfect: true, viable: true });
        mockSend.mockResolvedValue({ telegram: notLinked, discord: sent });

        await POST(mockRequest(body), { params: Promise.resolve({ slug: '1' }) });
        await flushAfter();

        expect(mockSend.mock.calls[0][1].html).toContain('Perfect Match Found');
        expect(mockEventUpdate).toHaveBeenCalledWith({ where: { id: 1 }, data: { quorumPerfectNotified: true, quorumViableNotified: true } });
    });

    it('leaves the flag unset when delivery failed on every platform (retries next vote)', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...baseEvent, title: 'Game Night', managerChatId: '55', managerDiscordId: 'd-mgr' });
        mockSend.mockResolvedValue({ telegram: failed, discord: failed });

        await POST(mockRequest(body), { params: Promise.resolve({ slug: '1' }) });
        await flushAfter();

        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockEventUpdate).not.toHaveBeenCalled();
    });

    it('neither sends nor sets the flag when the manager has no linked platform', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...baseEvent, title: 'Game Night' });

        await POST(mockRequest(body), { params: Promise.resolve({ slug: '1' }) });
        await flushAfter();

        expect(mockSend).not.toHaveBeenCalled();
        expect(mockEventUpdate).not.toHaveBeenCalled();
    });

    it('does not re-alert when the viable flag is already set', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...baseEvent, title: 'Game Night', managerDiscordId: 'd-mgr', quorumViableNotified: true });

        await POST(mockRequest(body), { params: Promise.resolve({ slug: '1' }) });
        await flushAfter();

        expect(mockSend).not.toHaveBeenCalled();
        expect(mockEventUpdate).not.toHaveBeenCalled();
    });

    it('records quorumReachedAt inside the transaction the first time quorum is met', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...baseEvent, title: 'Game Night', quorumReachedAt: null });
        const order: string[] = [];
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            order.push('tx-start');
            const out = await cb(prisma);
            order.push('tx-end');
            return out;
        });
        mockPrisma.event.updateMany.mockImplementation(async () => { order.push('quorum'); return { count: 1 }; });

        await POST(mockRequest(body), { params: Promise.resolve({ slug: '1' }) });

        expect(mockPrisma.event.updateMany).toHaveBeenCalledWith({
            where: { id: 1, quorumReachedAt: null },
            data: { quorumReachedAt: expect.any(Date) },
        });
        expect(order).toEqual(['tx-start', 'quorum', 'tx-end']);
    });

    it('sets quorumReachedAt even when the manager DM fails, but not the notified flag', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...baseEvent, title: 'Game Night', managerDiscordId: 'd-mgr', quorumReachedAt: null });
        mockSend.mockResolvedValue({ telegram: notLinked, discord: failed });

        await POST(mockRequest(body), { params: Promise.resolve({ slug: '1' }) });
        await flushAfter();

        expect(mockPrisma.event.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { quorumReachedAt: expect.any(Date) } }));
        expect(mockEventUpdate).not.toHaveBeenCalled();
    });

    it('leaves quorumReachedAt alone when it is already set or quorum is not met', async () => {
        const quorumWrite = expect.objectContaining({ data: { quorumReachedAt: expect.any(Date) } });
        mockPrisma.event.findUnique.mockResolvedValue({ ...baseEvent, title: 'Game Night', quorumReachedAt: new Date('2026-10-01T00:00:00Z') });
        await POST(mockRequest(body), { params: Promise.resolve({ slug: '1' }) });
        expect(mockPrisma.event.updateMany).not.toHaveBeenCalledWith(quorumWrite);

        mockPrisma.event.findUnique.mockResolvedValue({ ...baseEvent, title: 'Game Night', quorumReachedAt: null });
        mockQuorum.mockReturnValue({ perfect: false, viable: false });
        await POST(mockRequest(body), { params: Promise.resolve({ slug: '1' }) });
        expect(mockPrisma.event.updateMany).not.toHaveBeenCalledWith(quorumWrite);
    });

    it('defers dashboard sync, group broadcast and the quorum DM until after the response', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...baseEvent, title: 'Game Night', discordChannelId: 'dc1', managerDiscordId: 'd-mgr' });
        mockSend.mockResolvedValue({ telegram: notLinked, discord: sent });

        const res = await POST(mockRequest(body), { params: Promise.resolve({ slug: '1' }) });

        expect(res.status).toBe(200);
        expect(syncDashboard).not.toHaveBeenCalled();
        expect(broadcastToEvent).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();

        await flushAfter();

        expect(syncDashboard).toHaveBeenCalledWith(1);
        expect(broadcastToEvent).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('still sends the DM when the dashboard sync throws', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...baseEvent, title: 'Game Night', managerDiscordId: 'd-mgr' });
        (syncDashboard as any).mockRejectedValue(new Error('down'));
        mockSend.mockResolvedValue({ telegram: notLinked, discord: sent });

        await POST(mockRequest(body), { params: Promise.resolve({ slug: '1' }) });
        await flushAfter();

        expect(mockSend).toHaveBeenCalledTimes(1);
    });
});

describe('POST /api/event/[slug]/vote - user text in group messages', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        cookieJar.clear();
        afterQueue.length = 0;
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(prisma));
        mockPrisma.vote.findMany.mockResolvedValue([]);
        mockPrisma.timeSlot.findMany.mockResolvedValue([{ id: 1 }]);
        mockPrisma.participant.create.mockResolvedValue({ id: 1 });
        mockPrisma.event.updateMany.mockResolvedValue({ count: 1 });
        (checkEventQuorum as any).mockReturnValue({ perfect: false, viable: false });
    });

    it('escapes a hostile voter name and title in the availability broadcast', async () => {
        const hostile = '<a href="https://evil">x</a>';
        mockPrisma.event.findUnique.mockResolvedValue({ ...baseEvent, title: 'D&D <night>', telegramChatId: 'tg1', discordChannelId: 'dc1' });

        await POST(mockRequest({ name: hostile, linkIdentity: false, votes: [{ slotId: 1, preference: 'YES', canHost: false }] }), { params: Promise.resolve({ slug: '1' }) });
        await flushAfter();

        expect(broadcastToEvent).toHaveBeenCalledTimes(1);
        const message = (broadcastToEvent as any).mock.calls[0][1];
        expect(message.html).toContain('&lt;a href=&quot;https://evil&quot;&gt;x&lt;/a&gt;');
        expect(message.html).toContain('D&amp;D &lt;night&gt;');
        expect(message.html).not.toContain('<a href');
        expect(message.discord).toContain(String.raw`<a href="https://evil"\>x</a\>`);
        expect(message.discord).not.toContain('](');
    });
});

describe('POST /api/event/[slug]/vote - validation and ownership', () => {
    const vote = { slotId: 1, preference: 'YES', canHost: false };
    const call = (body: any, slug = '1') => POST(mockRequest(body), { params: Promise.resolve({ slug }) });

    beforeEach(() => {
        vi.resetAllMocks();
        cookieJar.clear();
        afterQueue.length = 0;
        mockPrisma.event.findUnique.mockResolvedValue(baseEvent);
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(prisma));
        mockPrisma.vote.findMany.mockResolvedValue([]);
        mockPrisma.timeSlot.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        mockPrisma.participant.create.mockResolvedValue({ id: 50 });
        mockPrisma.participant.update.mockResolvedValue({ id: 47 });
        (checkEventQuorum as any).mockReturnValue({ perfect: false, viable: false });
    });

    it("rejects a vote on another event's slot with 400 and writes nothing", async () => {
        const res = await call({ name: 'Mallory', votes: [vote, { ...vote, slotId: 999 }] });

        expect(res.status).toBe(400);
        expect(mockPrisma.timeSlot.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: 1 } }));
        expect(mockPrisma.participant.create).not.toHaveBeenCalled();
        expect(mockPrisma.vote.createMany).not.toHaveBeenCalled();
    });

    it('rejects a string participantId and malformed bodies with 400', async () => {
        expect((await call({ name: 'C', participantId: '47', votes: [vote] })).status).toBe(400);
        expect((await call({ name: '', votes: [vote] })).status).toBe(400);
        expect((await call({ name: 'C', votes: [vote, vote] })).status).toBe(400);
        expect((await call({ name: 'C', votes: [vote] }, 'abc')).status).toBe(400);
    });

    it('returns 404 for an unknown event', async () => {
        mockPrisma.event.findUnique.mockResolvedValue(null);
        expect((await call({ name: 'C', votes: [vote] })).status).toBe(404);
    });

    it('sets a signed participant cookie when a participant is created', async () => {
        const res = await call({ name: 'Chris', votes: [vote] });

        expect(res.status).toBe(200);
        const cookie = (res as any).cookies.get('tabletop_participant_test-event');
        expect(cookie.value).toBe(signValue('participant:test-event', '50'));
        expect(cookie.httpOnly).toBe(true);
    });

    it("refuses to edit someone else's participant row with 403 participant_not_owned", async () => {
        mockPrisma.participant.findFirst.mockResolvedValue({ id: 47, eventId: 1, chatId: '555', discordId: 'victim' });

        const res = await call({ name: 'Mallory', participantId: 47, votes: [vote] });

        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: expect.any(String), code: 'participant_not_owned' });
        expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        expect(mockPrisma.vote.deleteMany).not.toHaveBeenCalled();
    });

    it('ignores an unsigned participant cookie', async () => {
        mockPrisma.participant.findFirst.mockResolvedValue({ id: 47, eventId: 1, chatId: null, discordId: null });
        cookieJar.set('tabletop_participant_test-event', '47');

        const res = await call({ name: 'Mallory', participantId: 47, votes: [vote] });

        expect(res.status).toBe(403);
    });

    it('rejects a participant cookie signed for a different participant', async () => {
        mockPrisma.participant.findFirst.mockResolvedValue({ id: 47, eventId: 1, chatId: null, discordId: null });
        cookieJar.set('tabletop_participant_test-event', signValue('participant:test-event', '48'));

        expect((await call({ name: 'Mallory', participantId: 47, votes: [vote] })).status).toBe(403);
    });

    describe('legacy grace for rows created before the participant cookie existed', () => {
        const BEFORE = new Date('2026-10-01T12:00:00Z');
        const AFTER = new Date('2026-10-04T00:00:01Z');

        // The grace window closes at LEGACY_GRACE_UNTIL (2026-11-03); pin the clock inside it.
        beforeEach(() => {
            vi.useFakeTimers({ toFake: ['Date'] });
            vi.setSystemTime(new Date('2026-10-10T00:00:00Z'));
        });
        afterEach(() => {
            vi.useRealTimers();
        });

        it('refuses the grace for every row once the grace window has closed', async () => {
            vi.setSystemTime(new Date('2026-11-03T00:00:00Z'));
            mockPrisma.participant.findFirst.mockResolvedValue({ id: 47, eventId: 1, chatId: null, discordId: null, createdAt: BEFORE });

            const res = await call({ name: 'Old Voter', participantId: 47, votes: [vote] });

            expect(res.status).toBe(403);
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        });

        it('accepts an unlinked pre-cutoff row once and issues the participant cookie', async () => {
            mockPrisma.participant.findFirst.mockResolvedValue({ id: 47, eventId: 1, chatId: null, discordId: null, createdAt: BEFORE });

            const res = await call({ name: 'Old Voter', participantId: 47, votes: [vote] });

            expect(res.status).toBe(200);
            expect(mockPrisma.participant.update).toHaveBeenCalled();
            expect(mockPrisma.participant.create).not.toHaveBeenCalled();
            const cookie = (res as any).cookies.get('tabletop_participant_test-event');
            expect(cookie.value).toBe(signValue('participant:test-event', '47'));
        });

        it('refuses an unlinked row created after the cutoff', async () => {
            mockPrisma.participant.findFirst.mockResolvedValue({ id: 47, eventId: 1, chatId: null, discordId: null, createdAt: AFTER });

            const res = await call({ name: 'Mallory', participantId: 47, votes: [vote] });

            expect(res.status).toBe(403);
            expect(await res.json()).toMatchObject({ code: 'participant_not_owned' });
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        });

        it('refuses a pre-cutoff row that is linked to an identity', async () => {
            mockPrisma.participant.findFirst.mockResolvedValue({ id: 47, eventId: 1, chatId: '555', discordId: null, createdAt: BEFORE });

            expect((await call({ name: 'Mallory', participantId: 47, votes: [vote] })).status).toBe(403);
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        });

        it('refuses the grace when this browser already holds a participant cookie for the event', async () => {
            mockPrisma.participant.findFirst.mockResolvedValue({ id: 47, eventId: 1, chatId: null, discordId: null, createdAt: BEFORE });
            cookieJar.set('tabletop_participant_test-event', signValue('participant:test-event', '48'));

            expect((await call({ name: 'Mallory', participantId: 47, votes: [vote] })).status).toBe(403);
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        });
    });

    it('never overwrites an existing discordUsername from the display-name cookie', async () => {
        mockPrisma.participant.findFirst.mockResolvedValue({ id: 47, eventId: 1, chatId: null, discordId: 'd-47', discordUsername: 'RealName' });
        cookieJar.set('tabletop_user_discord_id', signValue('identity:discord', 'd-47'));
        cookieJar.set('tabletop_user_discord_name', 'Spoofed');

        const res = await call({ name: 'Dee', participantId: 47, votes: [vote] });

        expect(res.status).toBe(200);
        const data = mockPrisma.participant.update.mock.calls[0][0].data;
        expect(data.discordId).toBe('d-47');
        expect(data).not.toHaveProperty('discordUsername');
    });

    it('ignores the display-name cookie when the discord id does not verify', async () => {
        cookieJar.set('tabletop_user_discord_id', 'd-47');
        cookieJar.set('tabletop_user_discord_name', 'Spoofed');

        await call({ name: 'Dee', votes: [vote] });

        const data = mockPrisma.participant.create.mock.calls[0][0].data;
        expect(data).not.toHaveProperty('discordId');
        expect(data).not.toHaveProperty('discordUsername');
    });

    it('allows an edit when a verified identity matches the row', async () => {
        mockPrisma.participant.findFirst.mockResolvedValue({ id: 47, eventId: 1, chatId: null, discordId: 'd-47' });
        cookieJar.set('tabletop_user_discord_id', signValue('identity:discord', 'd-47'));

        const res = await call({ name: 'Dee', participantId: 47, linkIdentity: false, votes: [vote] });

        expect(res.status).toBe(200);
        expect(mockPrisma.participant.update).toHaveBeenCalled();
    });

    it('scopes the participant lookup to the event', async () => {
        mockPrisma.participant.findFirst.mockResolvedValue(null);

        await call({ name: 'Chris', participantId: 47, linkIdentity: false, votes: [vote] });

        expect(mockPrisma.participant.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 47, eventId: 1 } }));
        // Not in this event: a fresh participant is created instead of touching row 47.
        expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        expect(mockPrisma.participant.create).toHaveBeenCalled();
    });

    it('waitlists a new voter on a full finalized event, counting inside the transaction', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...baseEvent, status: 'FINALIZED', maxPlayers: 2, finalizedSlotId: 1 });
        const order: string[] = [];
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            order.push('tx-start');
            const out = await cb(prisma);
            order.push('tx-end');
            return out;
        });
        mockPrisma.participant.count.mockImplementation(async () => { order.push('count'); return 2; });

        await call({ name: 'Late', linkIdentity: false, votes: [vote] });

        expect(mockPrisma.participant.create.mock.calls[0][0].data.status).toBe('WAITLIST');
        expect(order.indexOf('count')).toBeGreaterThan(order.indexOf('tx-start'));
        expect(order.indexOf('count')).toBeLessThan(order.indexOf('tx-end'));
    });
});
