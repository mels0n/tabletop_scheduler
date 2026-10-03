import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import prisma from '@/shared/lib/prisma';
import { sendDirectMessage } from '@/features/notifications';
import { verifyEventAdmin } from '@/features/auth/server/actions';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/auth/server/actions', () => ({ verifyEventAdmin: vi.fn() }));
vi.mock('@/features/notifications', () => ({
    sendDirectMessage: vi.fn(),
    broadcastToEvent: vi.fn(),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/shared/lib/url', () => ({ getBaseUrl: () => 'https://example.test' }));
vi.mock('@/shared/lib/eventMessage', () => ({
    buildFinalizedMessage: () => '<b>finalized</b>',
    buildCampaignFinalizedMessage: () => '<b>campaign finalized</b>',
}));
vi.mock('@/features/telegram', () => ({
    sendTelegramMessage: vi.fn(),
    deleteMessage: vi.fn(),
    pinChatMessage: vi.fn(),
}));
vi.mock('@/features/integrations/discord/model/discord', () => ({
    sendDiscordMessage: vi.fn(),
    pinDiscordMessage: vi.fn(),
    unpinDiscordMessage: vi.fn(),
    deleteDiscordMessage: vi.fn(),
}));

import * as telegram from '@/features/telegram';
import * as discord from '@/features/integrations/discord/model/discord';

const mockPrisma = prisma as any;
const mockSend = sendDirectMessage as unknown as ReturnType<typeof vi.fn>;

const createdAt = new Date('2026-01-01T00:00:00Z');
const discordOnlyVote = {
    participantId: 7,
    preference: 'YES',
    createdAt,
    participant: { id: 7, name: 'Dee', chatId: null, discordId: 'd-7' },
};

const finalizedEvent = {
    id: 1,
    slug: 'evt',
    title: 'Game Night',
    fromUrl: null,
    telegramChatId: '-100',
    pinnedMessageId: 5,
    discordChannelId: 'chan-1',
    discordMessageId: 'old-msg',
    timeSlots: [{ id: 3, startTime: createdAt, endTime: createdAt }],
    finalizedSlotId: 3,
};

const eventMeta = { id: 1, status: 'DRAFT', maxPlayers: 4, minPlayers: 1, title: 'Game Night', eventType: 'ONE_SHOT', minSessions: null, timezone: 'UTC' };

function oneShotRequest(fields: Record<string, string> = { slotId: '3' }) {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.set(k, v);
    return { formData: async () => form, headers: new Headers() } as unknown as Request;
}

function campaignRequest(body: unknown) {
    return { json: async () => body, headers: new Headers({ 'content-type': 'application/json' }) } as unknown as Request;
}

const params = { params: Promise.resolve({ slug: 'evt' }) };

describe('POST /api/event/[slug]/finalize', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        (verifyEventAdmin as any).mockResolvedValue(true);
        process.env.TELEGRAM_BOT_TOKEN = 'tg-token';
        process.env.DISCORD_BOT_TOKEN = 'dc-token';
        // First read: event metadata; second read (inside the transaction): the finalized event.
        mockPrisma.event.findUnique.mockResolvedValueOnce(eventMeta).mockResolvedValueOnce(finalizedEvent);
        mockPrisma.event.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.timeSlot.findFirst.mockResolvedValue({ id: 3, eventId: 1, startTime: createdAt, endTime: createdAt });
        mockPrisma.vote.findMany.mockResolvedValue([discordOnlyVote]);
        mockPrisma.event.update.mockResolvedValue(finalizedEvent);
        mockPrisma.participant.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockPrisma));
        (telegram.sendTelegramMessage as any).mockResolvedValue(99);
        (discord.sendDiscordMessage as any).mockResolvedValue({ id: 'new-msg' });
    });

    it('DMs a Discord-only accepted participant', async () => {
        await POST(oneShotRequest(), params);

        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend.mock.calls[0][0]).toEqual({ telegramChatId: null, discordUserId: 'd-7' });
        expect(mockSend.mock.calls[0][1].html).toContain('You made the cut!');
    });

    it('deletes the old Discord dashboard message after unpinning, then posts and stores the new one', async () => {
        await POST(oneShotRequest(), params);

        expect(discord.unpinDiscordMessage).toHaveBeenCalledWith('chan-1', 'old-msg', 'dc-token');
        expect(discord.deleteDiscordMessage).toHaveBeenCalledWith('chan-1', 'old-msg', 'dc-token');
        expect(discord.pinDiscordMessage).toHaveBeenCalledWith('chan-1', 'new-msg', 'dc-token');
        expect(mockPrisma.event.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { discordMessageId: 'new-msg' } });
    });

    it('still announces on Discord when Telegram throws', async () => {
        (telegram.deleteMessage as any).mockRejectedValue(new Error('telegram down'));

        await POST(oneShotRequest(), params);

        expect(discord.sendDiscordMessage).toHaveBeenCalled();
        expect(mockPrisma.event.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { discordMessageId: 'new-msg' } });
    });

    it('still announces on Telegram when Discord throws', async () => {
        (discord.unpinDiscordMessage as any).mockRejectedValue(new Error('discord down'));

        await POST(oneShotRequest(), params);

        expect(telegram.sendTelegramMessage).toHaveBeenCalled();
        expect(mockPrisma.event.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { pinnedMessageId: 99 } });
    });

    it('scopes the slot, vote lookup and participant updates to the event, with a DRAFT precondition', async () => {
        await POST(oneShotRequest(), params);

        expect(mockPrisma.timeSlot.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 3, eventId: 1 } }));
        expect(mockPrisma.vote.findMany.mock.calls[0][0].where).toMatchObject({ timeSlotId: 3, participant: { eventId: 1 } });
        expect(mockPrisma.participant.updateMany).toHaveBeenCalled();
        for (const call of mockPrisma.participant.updateMany.mock.calls) {
            expect(call[0].where.eventId).toBe(1);
        }
        expect(mockPrisma.event.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 1, status: 'DRAFT' },
        }));
    });

    it('returns 404 and changes nothing when slotId belongs to another event', async () => {
        mockPrisma.timeSlot.findFirst.mockResolvedValue(null);

        const res = await POST(oneShotRequest({ slotId: '999' }), params);

        expect(res!.status).toBe(404);
        expect(mockPrisma.event.updateMany).not.toHaveBeenCalled();
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
        expect(mockPrisma.participant.updateMany).not.toHaveBeenCalled();
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('returns 404 when houseId is not a participant of this event', async () => {
        mockPrisma.participant.findFirst.mockResolvedValue(null);

        const res = await POST(oneShotRequest({ slotId: '3', houseId: '77' }), params);

        expect(res!.status).toBe(404);
        expect(mockPrisma.participant.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 77, eventId: 1 } }));
        expect(mockPrisma.event.updateMany).not.toHaveBeenCalled();
    });

    it('returns 409 and sends nothing when the event is no longer a draft', async () => {
        mockPrisma.event.updateMany.mockResolvedValue({ count: 0 });

        const res = await POST(oneShotRequest(), params);

        expect(res!.status).toBe(409);
        expect(await res!.json()).toEqual({ error: 'Event is not open for finalizing', code: 'conflict' });
        expect(mockPrisma.participant.updateMany).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('returns 400 for a non-numeric slotId', async () => {
        const res = await POST(oneShotRequest({ slotId: 'abc' }), params);
        expect(res!.status).toBe(400);
    });

    it('returns 403 when the caller is not the event admin', async () => {
        (verifyEventAdmin as any).mockResolvedValue(false);

        const res = await POST(oneShotRequest(), params);

        expect(res!.status).toBe(403);
        expect(mockPrisma.event.findUnique).not.toHaveBeenCalled();
    });
});

describe('POST /api/event/[slug]/finalize (campaign)', () => {
    const campaignMeta = { ...eventMeta, eventType: 'CAMPAIGN', minSessions: 2 };

    beforeEach(() => {
        vi.resetAllMocks();
        (verifyEventAdmin as any).mockResolvedValue(true);
        mockPrisma.event.findUnique.mockResolvedValueOnce(campaignMeta).mockResolvedValueOnce({ ...finalizedEvent, finalizedSlotId: null });
        mockPrisma.event.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.vote.findMany.mockResolvedValue([discordOnlyVote]);
        mockPrisma.participant.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.finalizedSession.createMany.mockResolvedValue({ count: 2 });
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockPrisma));
        (discord.sendDiscordMessage as any).mockResolvedValue({ id: 'new-msg' });
    });

    it('returns 404 and writes nothing when a slot belongs to another event', async () => {
        mockPrisma.timeSlot.findMany.mockResolvedValue([{ id: 3, eventId: 1, startTime: createdAt, endTime: createdAt }]);

        const res = await POST(campaignRequest({ slotIds: [3, 999] }), params);

        expect(res!.status).toBe(404);
        expect(mockPrisma.timeSlot.findMany.mock.calls[0][0].where).toMatchObject({ eventId: 1 });
        expect(mockPrisma.event.updateMany).not.toHaveBeenCalled();
        expect(mockPrisma.finalizedSession.createMany).not.toHaveBeenCalled();
    });

    it('finalizes with event-scoped participant updates', async () => {
        mockPrisma.timeSlot.findMany.mockResolvedValue([
            { id: 3, eventId: 1, startTime: createdAt, endTime: createdAt },
            { id: 4, eventId: 1, startTime: createdAt, endTime: createdAt },
        ]);

        const res = await POST(campaignRequest({ slotIds: [3, 4] }), params);

        expect(res!.status).toBe(200);
        expect(mockPrisma.event.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1, status: 'DRAFT' } }));
        expect(mockPrisma.participant.updateMany).toHaveBeenCalled();
        for (const call of mockPrisma.participant.updateMany.mock.calls) {
            expect(call[0].where.eventId).toBe(1);
        }
    });

    it('returns 409 when the campaign was already finalized', async () => {
        mockPrisma.timeSlot.findMany.mockResolvedValue([{ id: 3, eventId: 1, startTime: createdAt, endTime: createdAt }]);
        mockPrisma.event.updateMany.mockResolvedValue({ count: 0 });

        const res = await POST(campaignRequest({ slotIds: [3] }), params);

        expect(res!.status).toBe(409);
        expect(mockPrisma.finalizedSession.createMany).not.toHaveBeenCalled();
    });
});
