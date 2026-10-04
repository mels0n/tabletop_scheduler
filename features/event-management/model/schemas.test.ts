import { describe, it, expect } from 'vitest';
import {
    createEventSchema,
    voteSchema,
    slotSchema,
    slotSuggestionSchema,
    locationSchema,
    validateSlugsSchema,
    oneShotFinalizeSchema,
    campaignFinalizeSchema,
    isValidTimezone,
    MAX_EVENT_SLOTS,
} from './schemas';

const slot = { startTime: '2026-11-01T18:00:00.000Z', endTime: '2026-11-01T22:00:00.000Z' };
const validEvent = { title: 'Game Night', slots: [slot], timezone: 'America/New_York' };

describe('createEventSchema', () => {
    it('accepts a minimal valid payload and applies defaults', () => {
        const parsed = createEventSchema.parse(validEvent);
        expect(parsed.minPlayers).toBe(3);
        expect(parsed.maxPlayers).toBeNull();
        expect(parsed.eventType).toBe('ONE_SHOT');
        expect(parsed.fromUrl).toBeNull();
    });

    it('accepts the browser payload shape with null optional fields', () => {
        const parsed = createEventSchema.parse({
            ...validEvent, description: '', minPlayers: 4, maxPlayers: null, fromUrl: null, fromUrlId: null,
        });
        expect(parsed.minPlayers).toBe(4);
    });

    it('accepts only https://t.me/ invite links (or none) as telegramLink', () => {
        expect(createEventSchema.parse({ ...validEvent, telegramLink: 'https://t.me/+abcDEF123' }).telegramLink)
            .toBe('https://t.me/+abcDEF123');
        expect(createEventSchema.parse({ ...validEvent, telegramLink: '' }).telegramLink).toBeNull();
        expect(createEventSchema.parse({ ...validEvent, telegramLink: null }).telegramLink).toBeNull();
        for (const bad of ['javascript:alert(1)', 'http://t.me/x', 'https://evil.example/t.me/', 'https://t.me.evil.example/x', '//t.me/x']) {
            expect(createEventSchema.safeParse({ ...validEvent, telegramLink: bad }).success).toBe(false);
        }
    });

    it('rejects an invalid timezone', () => {
        expect(createEventSchema.safeParse({ ...validEvent, timezone: 'Mars/Olympus_Mons' }).success).toBe(false);
    });

    it('accepts UTC and legacy zone aliases the runtime understands', () => {
        expect(isValidTimezone('UTC')).toBe(true);
        expect(isValidTimezone('Asia/Kolkata')).toBe(true);
        expect(isValidTimezone('Not/AZone')).toBe(false);
    });

    it('caps title, description and slot count', () => {
        expect(createEventSchema.safeParse({ ...validEvent, title: '' }).success).toBe(false);
        expect(createEventSchema.safeParse({ ...validEvent, title: 'x'.repeat(121) }).success).toBe(false);
        expect(createEventSchema.safeParse({ ...validEvent, description: 'x'.repeat(2001) }).success).toBe(false);
        expect(createEventSchema.safeParse({ ...validEvent, slots: [] }).success).toBe(false);
        expect(MAX_EVENT_SLOTS).toBe(500);
        expect(createEventSchema.safeParse({ ...validEvent, slots: Array(500).fill(slot) }).success).toBe(true);
        expect(createEventSchema.safeParse({ ...validEvent, slots: Array(501).fill(slot) }).success).toBe(false);
    });

    it('rejects a slot whose end is not after its start, and non-ISO dates', () => {
        expect(createEventSchema.safeParse({ ...validEvent, slots: [{ startTime: slot.endTime, endTime: slot.startTime }] }).success).toBe(false);
        expect(createEventSchema.safeParse({ ...validEvent, slots: [{ startTime: 'garbage', endTime: slot.endTime }] }).success).toBe(false);
    });

    it('enforces player bounds', () => {
        expect(createEventSchema.safeParse({ ...validEvent, minPlayers: 0 }).success).toBe(false);
        expect(createEventSchema.safeParse({ ...validEvent, minPlayers: '3' }).success).toBe(false);
        expect(createEventSchema.safeParse({ ...validEvent, minPlayers: 4, maxPlayers: 3 }).success).toBe(false);
        expect(createEventSchema.safeParse({ ...validEvent, maxPlayers: -1 }).success).toBe(false);
    });

    it('requires https for fromUrl', () => {
        expect(createEventSchema.safeParse({ ...validEvent, fromUrl: 'http://example.com/hook' }).success).toBe(false);
        expect(createEventSchema.safeParse({ ...validEvent, fromUrl: 'https://example.com/hook' }).success).toBe(true);
    });

    it('requires minSessions for campaigns', () => {
        expect(createEventSchema.safeParse({ ...validEvent, eventType: 'CAMPAIGN' }).success).toBe(false);
        expect(createEventSchema.safeParse({ ...validEvent, eventType: 'CAMPAIGN', minSessions: 4 }).success).toBe(true);
        expect(createEventSchema.safeParse({ ...validEvent, eventType: 'OTHER' }).success).toBe(false);
    });
});

describe('voteSchema', () => {
    const vote = { slotId: 1, preference: 'YES', canHost: false };

    it('accepts the client payload, ignoring body Discord fields', () => {
        const parsed = voteSchema.parse({ name: 'Chris', telegramId: '', participantId: null, discordId: 'x', votes: [vote] });
        expect(parsed.votes).toHaveLength(1);
        expect(parsed).not.toHaveProperty('discordId');
    });

    it('rejects string participant IDs, long names and bad preferences', () => {
        expect(voteSchema.safeParse({ name: 'C', participantId: '7', votes: [vote] }).success).toBe(false);
        expect(voteSchema.safeParse({ name: 'x'.repeat(61), votes: [vote] }).success).toBe(false);
        expect(voteSchema.safeParse({ name: 'C', votes: [{ ...vote, preference: 'LOVE' }] }).success).toBe(false);
    });

    it('rejects duplicate slot IDs and more than 1000 votes', () => {
        expect(voteSchema.safeParse({ name: 'C', votes: [vote, vote] }).success).toBe(false);
        const most = Array.from({ length: 1000 }, (_, i) => ({ ...vote, slotId: i + 1 }));
        expect(voteSchema.safeParse({ name: 'C', votes: most }).success).toBe(true);
        const many = Array.from({ length: 1001 }, (_, i) => ({ ...vote, slotId: i + 1 }));
        expect(voteSchema.safeParse({ name: 'C', votes: many }).success).toBe(false);
    });
});

describe('slot schemas', () => {
    it('slotSchema requires start before end', () => {
        expect(slotSchema.safeParse(slot).success).toBe(true);
        expect(slotSchema.safeParse({ startTime: slot.endTime, endTime: slot.startTime }).success).toBe(false);
    });

    it('slotSuggestionSchema requires a bounded name', () => {
        expect(slotSuggestionSchema.safeParse({ ...slot, suggesterName: 'Dee' }).success).toBe(true);
        expect(slotSuggestionSchema.safeParse({ ...slot, suggesterName: '' }).success).toBe(false);
        expect(slotSuggestionSchema.safeParse({ ...slot, suggesterName: 'x'.repeat(51) }).success).toBe(false);
    });
});

describe('locationSchema', () => {
    it('caps location at 200 characters and allows clearing', () => {
        expect(locationSchema.parse({ location: '' }).location).toBe('');
        expect(locationSchema.parse({ location: null }).location).toBeNull();
        expect(locationSchema.safeParse({ location: 'x'.repeat(201) }).success).toBe(false);
        expect(locationSchema.safeParse({ location: 42 }).success).toBe(false);
    });
});

describe('validateSlugsSchema', () => {
    it('caps the batch at 50 slugs', () => {
        expect(validateSlugsSchema.safeParse({ slugs: Array(50).fill('abc') }).success).toBe(true);
        expect(validateSlugsSchema.safeParse({ slugs: Array(51).fill('abc') }).success).toBe(false);
        expect(validateSlugsSchema.safeParse({ slugs: [123] }).success).toBe(false);
    });
});

describe('finalize schemas', () => {
    it('oneShotFinalizeSchema coerces form fields to integers', () => {
        const parsed = oneShotFinalizeSchema.parse({ slotId: '3', houseId: '9', location: 'My place' });
        expect(parsed).toEqual({ slotId: 3, houseId: 9, location: 'My place' });
    });

    it('oneShotFinalizeSchema treats empty optional fields as absent', () => {
        expect(oneShotFinalizeSchema.parse({ slotId: '3', houseId: '', location: '' })).toEqual({ slotId: 3, houseId: null, location: null });
        expect(oneShotFinalizeSchema.safeParse({ slotId: 'abc' }).success).toBe(false);
        expect(oneShotFinalizeSchema.safeParse({}).success).toBe(false);
    });

    it('campaignFinalizeSchema requires unique slot IDs', () => {
        expect(campaignFinalizeSchema.safeParse({ slotIds: [] }).success).toBe(false);
        const ids = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
        expect(campaignFinalizeSchema.safeParse({ slotIds: ids(MAX_EVENT_SLOTS) }).success).toBe(true);
        expect(campaignFinalizeSchema.safeParse({ slotIds: ids(MAX_EVENT_SLOTS + 1) }).success).toBe(false);
        expect(campaignFinalizeSchema.safeParse({ slotIds: [1, 1] }).success).toBe(false);
        expect(campaignFinalizeSchema.parse({ slotIds: [1, 2], houseId: '5' }).houseId).toBe(5);
    });
});
