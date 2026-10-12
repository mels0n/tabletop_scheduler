import { describe, it, expect } from 'vitest';
import { hashToken, newToken } from './token';

describe('newToken', () => {
    it('is 128 random bits as 32 lowercase hex chars', () => {
        expect(newToken()).toMatch(/^[0-9a-f]{32}$/);
        expect(newToken()).not.toBe(newToken());
    });

    it('hashes the same way as older token formats, so old tokens keep verifying', () => {
        const legacyUuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
        const legacyShort = 'cafef00d';
        expect(hashToken(legacyUuid)).toMatch(/^[0-9a-f]{64}$/);
        expect(hashToken(legacyShort)).toBe(hashToken('cafef00d'));
        expect(hashToken(legacyUuid)).not.toBe(hashToken(newToken()));
    });
});
