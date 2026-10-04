import { describe, it, expect } from 'vitest';
import { isLegacyParticipant } from './ownership';

describe('isLegacyParticipant', () => {
    it('is true for a row that has never had a participant cookie issued for it', () => {
        expect(isLegacyParticipant({ ownerCookieIssuedAt: null })).toBe(true);
        expect(isLegacyParticipant({})).toBe(true);
    });

    it('is false once a participant cookie has been issued for the row', () => {
        expect(isLegacyParticipant({ ownerCookieIssuedAt: new Date('2026-10-03T00:00:00Z') })).toBe(false);
    });

    it('ignores identity: a linked row without the marker is still legacy', () => {
        const linked = { id: 1, chatId: '1', discordId: 'd', ownerCookieIssuedAt: null };
        expect(isLegacyParticipant(linked)).toBe(true);
    });
});
