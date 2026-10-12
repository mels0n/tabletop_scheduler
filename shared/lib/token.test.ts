import { describe, it, expect } from 'vitest';
import { hashToken, newToken, toBase62 } from './token';

describe('newToken', () => {
    it('is 128 random bits as 22 base62 chars', () => {
        expect(newToken()).toMatch(/^[0-9A-Za-z]{22}$/);
        expect(newToken()).not.toBe(newToken());
    });

    it('hashes the same way as older token formats, so old tokens keep verifying', () => {
        const legacyUuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
        expect(hashToken(legacyUuid)).toMatch(/^[0-9a-f]{64}$/);
        expect(hashToken('cafef00d')).toBe(hashToken('cafef00d'));
        expect(hashToken(legacyUuid)).not.toBe(hashToken(newToken()));
    });
});

describe('toBase62', () => {
    it('pads to 22 chars and covers the full 128-bit range', () => {
        expect(toBase62(new Uint8Array(16))).toBe('0'.repeat(22));
        expect(toBase62(new Uint8Array(16).fill(255))).toMatch(/^[0-9A-Za-z]{22}$/);
        const one = new Uint8Array(16);
        one[15] = 61;
        expect(toBase62(one)).toBe('0'.repeat(21) + 'z');
    });

    it('rejects anything but 16 bytes', () => {
        expect(() => toBase62(new Uint8Array(8))).toThrow();
    });
});
