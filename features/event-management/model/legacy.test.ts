import { describe, it, expect } from 'vitest';
import { LEGACY_PARTICIPANT_CUTOFF, isLegacyUnlinkedParticipant } from './legacy';

describe('isLegacyUnlinkedParticipant', () => {
    const before = new Date(LEGACY_PARTICIPANT_CUTOFF.getTime() - 1);

    it('is true only for an unlinked row created strictly before the cutoff', () => {
        expect(LEGACY_PARTICIPANT_CUTOFF.toISOString()).toBe('2026-10-04T00:00:00.000Z');
        expect(isLegacyUnlinkedParticipant({ chatId: null, discordId: null, createdAt: before })).toBe(true);
        expect(isLegacyUnlinkedParticipant({ chatId: null, discordId: null, createdAt: before.toISOString() })).toBe(true);
        expect(isLegacyUnlinkedParticipant({ chatId: null, discordId: null, createdAt: LEGACY_PARTICIPANT_CUTOFF })).toBe(false);
    });

    it('is false for a linked row or one without a creation time', () => {
        expect(isLegacyUnlinkedParticipant({ chatId: '1', discordId: null, createdAt: before })).toBe(false);
        expect(isLegacyUnlinkedParticipant({ chatId: null, discordId: 'd', createdAt: before })).toBe(false);
        expect(isLegacyUnlinkedParticipant({ chatId: null, discordId: null })).toBe(false);
    });
});
