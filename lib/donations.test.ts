import { describe, it, expect, vi } from 'vitest';

vi.mock('@/shared/lib/prisma');

import { parseAmountToCents } from './donations';

describe('parseAmountToCents', () => {
    it.each([
        ['5.00', 500],
        ['3', 300],
        ['1,000.50', 100050],
        [' 4.99 ', 499],
    ])('parses %s to %i cents', (input, cents) => {
        expect(parseAmountToCents(input)).toBe(cents);
    });

    it.each(['', 'abc', '-5', 'NaN', 'Infinity', '1e309', '5.00.1'])('rejects %s', (input) => {
        expect(parseAmountToCents(input)).toBeNull();
    });

    it('rejects non-strings', () => {
        expect(parseAmountToCents(null)).toBeNull();
        expect(parseAmountToCents(undefined)).toBeNull();
    });
});
