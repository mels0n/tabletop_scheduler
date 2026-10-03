import { describe, it, expect, afterEach, vi } from 'vitest';
import { isLegacyUnlinkedParticipant } from './legacy';
import { resetServerConfigForTests } from '@/shared/config/server';
import { stubConfigEnv } from '@/shared/config/test-env';

describe('isLegacyUnlinkedParticipant', () => {
    const cutoff = new Date('2026-10-04T00:00:00Z');
    const before = new Date(cutoff.getTime() - 1);

    afterEach(() => {
        vi.unstubAllEnvs();
        resetServerConfigForTests();
    });

    it('is true only for an unlinked row created strictly before the cutoff', () => {
        expect(isLegacyUnlinkedParticipant({ chatId: null, discordId: null, createdAt: before }, cutoff)).toBe(true);
        expect(isLegacyUnlinkedParticipant({ chatId: null, discordId: null, createdAt: before.toISOString() }, cutoff)).toBe(true);
        expect(isLegacyUnlinkedParticipant({ chatId: null, discordId: null, createdAt: cutoff }, cutoff)).toBe(false);
    });

    it('is false for a linked row or one without a creation time', () => {
        expect(isLegacyUnlinkedParticipant({ chatId: '1', discordId: null, createdAt: before }, cutoff)).toBe(false);
        expect(isLegacyUnlinkedParticipant({ chatId: null, discordId: 'd', createdAt: before }, cutoff)).toBe(false);
        expect(isLegacyUnlinkedParticipant({ chatId: null, discordId: null }, cutoff)).toBe(false);
    });

    it('never expires: the verdict depends on the row, not on the clock', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
            vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
            expect(isLegacyUnlinkedParticipant({ chatId: null, discordId: null, createdAt: before }, cutoff)).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });

    it('reads the cutoff from server config by default', () => {
        const row = { chatId: null, discordId: null, createdAt: new Date('2026-10-10T00:00:00Z') };
        stubConfigEnv();
        resetServerConfigForTests();
        expect(isLegacyUnlinkedParticipant(row)).toBe(false);

        stubConfigEnv({ LEGACY_PARTICIPANT_CUTOFF: '2026-10-20T00:00:00Z' });
        resetServerConfigForTests();
        expect(isLegacyUnlinkedParticipant(row)).toBe(true);
    });
});
