import { describe, it, expect, vi, beforeEach } from 'vitest';

const { reliableFetch } = vi.hoisted(() => ({ reliableFetch: vi.fn() }));
vi.mock('@/shared/lib/fetch', () => ({ reliableFetch }));

import { editDiscordMessage } from './discord';

const respond = (status: number, body: unknown = {}) =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

describe('editDiscordMessage', () => {
    beforeEach(() => vi.resetAllMocks());

    it.each([
        ['edited', respond(200, { id: 'm1' })],
        ['gone', respond(404, { code: 10003, message: 'Unknown Channel' })],
        ['gone', respond(400, { code: 10008, message: 'Unknown Message' })],
        ['failed', respond(429, { retry_after: 30 })],
        ['failed', respond(500, 'oops')],
        ['failed', respond(403, { code: 50001, message: 'Missing Access' })],
    ])('returns %s', async (expected, res) => {
        reliableFetch.mockResolvedValue(res);
        expect(await editDiscordMessage('c1', 'm1', 'hi', 'tok')).toBe(expected);
    });

    it('returns failed on a network error or timeout', async () => {
        reliableFetch.mockRejectedValue(new Error('aborted'));
        expect(await editDiscordMessage('c1', 'm1', 'hi', 'tok')).toBe('failed');
    });
});
