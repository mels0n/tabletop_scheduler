import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/prisma');

// React's non-server build makes `cache` a pass-through. Stand in a memoizing version so the
// test proves getEventForPage is routed through `cache` and loads once per request scope.
// Recorded at import time (the global beforeEach clears mock call history).
const cachedFns = vi.hoisted(() => [] as unknown[]);
vi.mock('react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react')>();
    return {
        ...actual,
        cache: <A extends unknown[], R>(fn: (...args: A) => R) => {
            cachedFns.push(fn);
            const memo = new Map<string, R>();
            return (...args: A): R => {
                const key = JSON.stringify(args);
                if (!memo.has(key)) memo.set(key, fn(...args));
                return memo.get(key) as R;
            };
        },
    };
});

import prisma from '@/shared/lib/prisma';
import {
    eventPageSelect,
    getEventForPage,
    toManageParticipant,
    toPublicEvent,
    toPublicParticipant,
    toPublicSlot,
} from './dto';

const mockPrisma = prisma as unknown as { event: { findUnique: ReturnType<typeof vi.fn> } };

const FORBIDDEN = [
    'adminToken', 'recoveryToken', 'recoveryTokenExpires', 'fromUrl', 'fromUrlId',
    'managerChatId', 'managerDiscordId', 'managerTelegram', 'managerDiscordUsername',
    'telegramChatId', 'pinnedMessageId', 'discordPinnedMessageId', 'discordMessageId',
    'chatId', 'discordId', 'telegramId',
];

// A row with every column populated, including everything that must never leave the server.
const eventRow = {
    id: 1, slug: 'abc', title: 'Game Night', description: 'desc', status: 'FINALIZED',
    eventType: 'ONE_SHOT', timezone: 'UTC', minPlayers: 3, maxPlayers: 5, finalizedSlotId: 9,
    finalizedHostId: 2, location: '1 Main St', telegramLink: 'https://t.me/x',
    createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-02'),
    adminToken: 'hash', recoveryToken: 'rec', recoveryTokenExpires: new Date(),
    fromUrl: 'https://example.test/hook', fromUrlId: 'ctx',
    managerChatId: '111', managerDiscordId: '222', managerTelegram: '@gm', managerDiscordUsername: 'gm',
    telegramChatId: '-100', pinnedMessageId: 5, discordMessageId: '333',
    finalizedHost: { id: 2, name: 'Host' },
};

const participantRow = {
    id: 2, name: 'Host', status: 'ACCEPTED', telegramId: 'hosty', chatId: '777',
    discordId: '888', discordUsername: 'hosty#1', eventId: 1, createdAt: new Date(),
};

const slotRow = {
    id: 9, eventId: 1, startTime: new Date('2026-02-01T18:00:00Z'), endTime: new Date('2026-02-01T22:00:00Z'),
    sessionReminderSentAt: null,
    votes: [{ id: 1, participantId: 2, timeSlotId: 9, preference: 'YES', canHost: true, createdAt: new Date() }],
};

function assertNoForbiddenKeys(value: unknown) {
    const json = JSON.stringify(value);
    for (const key of FORBIDDEN) {
        expect(json, `leaked key ${key}`).not.toContain(`"${key}"`);
    }
}

describe('event page DTOs', () => {
    it('toPublicEvent exposes only the public event fields', () => {
        const dto = toPublicEvent(eventRow);
        expect(Object.keys(dto).sort()).toEqual([
            'createdAt', 'description', 'eventType', 'finalizedHost', 'finalizedSlotId', 'id',
            'location', 'maxPlayers', 'minPlayers', 'slug', 'status', 'timezone', 'title',
        ]);
        expect(dto.finalizedHost).toEqual({ id: 2, name: 'Host', address: '1 Main St' });
        assertNoForbiddenKeys(dto);
    });

    it('toPublicParticipant has no platform IDs and derives flags', () => {
        const dto = toPublicParticipant(participantRow, 2);
        expect(Object.keys(dto).sort()).toEqual(['hasDiscord', 'hasTelegram', 'id', 'isHost', 'name', 'status']);
        expect(dto).toMatchObject({ isHost: true, hasTelegram: true, hasDiscord: true });
        expect(toPublicParticipant({ ...participantRow, chatId: null, discordId: null }, null))
            .toMatchObject({ isHost: false, hasTelegram: false, hasDiscord: false });
        assertNoForbiddenKeys(dto);
    });

    it('toManageParticipant adds handles only', () => {
        const dto = toManageParticipant(participantRow, null);
        expect(Object.keys(dto).sort()).toEqual([
            'discordUsername', 'hasDiscord', 'hasTelegram', 'id', 'isHost', 'name', 'status', 'telegramHandle',
        ]);
        expect(dto.telegramHandle).toBe('hosty');
        assertNoForbiddenKeys(dto);
    });

    it('toPublicSlot maps votes to participantId/value/canHost', () => {
        const dto = toPublicSlot(slotRow);
        expect(Object.keys(dto).sort()).toEqual(['endTime', 'id', 'startTime', 'votes']);
        expect(dto.votes[0]).toMatchObject({ participantId: 2, value: 'YES', canHost: true });
        expect(Object.keys(dto.votes[0]).sort()).toEqual(['canHost', 'createdAt', 'participantId', 'value']);
    });

    it('the select never asks for tokens, hook URLs, pinned IDs or manager IDs', () => {
        for (const key of ['adminToken', 'recoveryToken', 'fromUrl', 'managerChatId', 'managerDiscordId',
            'telegramChatId', 'pinnedMessageId', 'discordMessageId']) {
            expect(Object.keys(eventPageSelect)).not.toContain(key);
        }
    });
});

describe('getEventForPage', () => {
    beforeEach(() => {
        mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'abc' });
    });

    it('is wrapped in React cache', () => {
        expect(cachedFns).toHaveLength(1);
        expect(typeof cachedFns[0]).toBe('function');
    });

    it('loads the event once for generateMetadata and the page body', async () => {
        const [a, b] = await Promise.all([getEventForPage('abc'), getEventForPage('abc')]);
        expect(a).toBe(b);
        expect(mockPrisma.event.findUnique).toHaveBeenCalledTimes(1);
        expect(mockPrisma.event.findUnique).toHaveBeenCalledWith({ where: { slug: 'abc' }, select: eventPageSelect });
    });
});
