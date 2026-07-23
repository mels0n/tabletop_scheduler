import { describe, it, expect } from 'vitest';
import { normalizeHandle, formatHandle } from './handle';

describe('normalizeHandle', () => {
    it('strips a single leading @', () => {
        expect(normalizeHandle('@mels0n')).toBe('mels0n');
    });

    it('strips repeated leading @ (already-doubled data)', () => {
        expect(normalizeHandle('@@mels0n')).toBe('mels0n');
    });

    it('lowercases and trims', () => {
        expect(normalizeHandle('  @MelS0n  ')).toBe('mels0n');
    });

    it('accepts a handle with no @', () => {
        expect(normalizeHandle('mels0n')).toBe('mels0n');
    });

    it('returns null for empty/whitespace/nullish input', () => {
        expect(normalizeHandle('')).toBeNull();
        expect(normalizeHandle('   ')).toBeNull();
        expect(normalizeHandle('@')).toBeNull();
        expect(normalizeHandle(null)).toBeNull();
        expect(normalizeHandle(undefined)).toBeNull();
    });

    it('can preserve case when lowercase is disabled (Discord)', () => {
        expect(normalizeHandle('@MelS0n', { lowercase: false })).toBe('MelS0n');
    });
});

describe('formatHandle', () => {
    it('adds exactly one @ regardless of input @ count', () => {
        expect(formatHandle('mels0n')).toBe('@mels0n');
        expect(formatHandle('@mels0n')).toBe('@mels0n');
        expect(formatHandle('@@mels0n')).toBe('@mels0n');
    });

    it('returns empty string for nullish/empty input', () => {
        expect(formatHandle(null)).toBe('');
        expect(formatHandle(undefined)).toBe('');
        expect(formatHandle('')).toBe('');
    });
});
