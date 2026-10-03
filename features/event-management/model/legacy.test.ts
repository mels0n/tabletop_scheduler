import { describe, it, expect } from 'vitest';
import { LEGACY_GRACE_UNTIL, LEGACY_PARTICIPANT_CUTOFF, isLegacyUnlinkedParticipant } from './legacy';

describe('isLegacyUnlinkedParticipant', () => {
    const before = new Date(LEGACY_PARTICIPANT_CUTOFF.getTime() - 1);
    const during = new Date('2026-10-10T00:00:00Z');

    it('is true only for an unlinked row created strictly before the cutoff', () => {
        expect(LEGACY_PARTICIPANT_CUTOFF.toISOString()).toBe('2026-10-04T00:00:00.000Z');
        expect(isLegacyUnlinkedParticipant({ chatId: null, discordId: null, createdAt: before }, during)).toBe(true);
        expect(isLegacyUnlinkedParticipant({ chatId: null, discordId: null, createdAt: before.toISOString() }, during)).toBe(true);
        expect(isLegacyUnlinkedParticipant({ chatId: null, discordId: null, createdAt: LEGACY_PARTICIPANT_CUTOFF }, during)).toBe(false);
    });

    it('is false for a linked row or one without a creation time', () => {
        expect(isLegacyUnlinkedParticipant({ chatId: '1', discordId: null, createdAt: before }, during)).toBe(false);
        expect(isLegacyUnlinkedParticipant({ chatId: null, discordId: 'd', createdAt: before }, during)).toBe(false);
        expect(isLegacyUnlinkedParticipant({ chatId: null, discordId: null }, during)).toBe(false);
    });

    it('closes for every row at LEGACY_GRACE_UNTIL', () => {
        const row = { chatId: null, discordId: null, createdAt: before };
        expect(LEGACY_GRACE_UNTIL.toISOString()).toBe('2026-11-03T00:00:00.000Z');
        expect(isLegacyUnlinkedParticipant(row, new Date(LEGACY_GRACE_UNTIL.getTime() - 1))).toBe(true);
        expect(isLegacyUnlinkedParticipant(row, LEGACY_GRACE_UNTIL)).toBe(false);
        expect(isLegacyUnlinkedParticipant(row, new Date('2027-01-01T00:00:00Z'))).toBe(false);
    });
});
