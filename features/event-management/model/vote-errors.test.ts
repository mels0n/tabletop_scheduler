import { describe, it, expect } from 'vitest';
import { PARTICIPANT_NOT_OWNED, voteErrorMessage } from './vote-errors';

describe('voteErrorMessage', () => {
    it('asks the voter to sign in when the row is not theirs', () => {
        const message = voteErrorMessage({ error: 'x', code: PARTICIPANT_NOT_OWNED });
        expect(message).toMatch(/sign in with that account to edit this vote/);
        expect(message).not.toContain('—');
    });

    it('falls back to a generic message for anything else', () => {
        expect(voteErrorMessage({ error: 'x', code: 'validation' })).toBe('Failed to save votes');
        expect(voteErrorMessage(null)).toBe('Failed to save votes');
        expect(voteErrorMessage('not json')).toBe('Failed to save votes');
    });
});
