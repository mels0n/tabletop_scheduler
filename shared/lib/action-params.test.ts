import { describe, it, expect } from 'vitest';
import { slugParam, platformParam, handleParam, participantIdParam, HANDLE_MAX_LENGTH } from './action-params';

describe('action-params', () => {
    it('slugParam accepts url-safe slugs up to 64 characters', () => {
        expect(slugParam.safeParse('aB3_-xyz').success).toBe(true);
        expect(slugParam.safeParse('a'.repeat(64)).success).toBe(true);
    });

    it.each([
        ['empty', ''],
        ['too long', 'a'.repeat(65)],
        ['space', 'a b'],
        ['slash', 'a/b'],
        ['dot', 'a.b'],
        ['newline', 'abc\n'],
        ['number', 123],
        ['null', null],
        ['object', { a: 1 }],
    ])('slugParam rejects %s', (_label, value) => {
        expect(slugParam.safeParse(value).success).toBe(false);
    });

    it('platformParam accepts only telegram and discord', () => {
        expect(platformParam.safeParse('telegram').success).toBe(true);
        expect(platformParam.safeParse('discord').success).toBe(true);
        expect(platformParam.safeParse('slack').success).toBe(false);
        expect(platformParam.safeParse(undefined).success).toBe(false);
    });

    it('handleParam bounds length and requires a string', () => {
        expect(handleParam.safeParse('@name').success).toBe(true);
        expect(handleParam.safeParse('x'.repeat(HANDLE_MAX_LENGTH)).success).toBe(true);
        expect(handleParam.safeParse('x'.repeat(HANDLE_MAX_LENGTH + 1)).success).toBe(false);
        expect(handleParam.safeParse(['a']).success).toBe(false);
    });

    it('participantIdParam accepts only positive 32-bit integers', () => {
        expect(participantIdParam.safeParse(7).success).toBe(true);
        for (const bad of [0, -1, 1.5, 2_147_483_648, '7', NaN, null]) {
            expect(participantIdParam.safeParse(bad).success).toBe(false);
        }
    });
});
