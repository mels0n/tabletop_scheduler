import { describe, it, expect, vi, beforeEach } from 'vitest';

const { reliableFetch } = vi.hoisted(() => ({ reliableFetch: vi.fn() }));
vi.mock('@/shared/lib/fetch', () => ({ reliableFetch }));

import { editMessageText } from './telegram-client';

const tgError = (status: number, description: string) =>
    new Response(JSON.stringify({ ok: false, error_code: status, description }), { status });

describe('editMessageText', () => {
    beforeEach(() => vi.resetAllMocks());

    it.each([
        ['edited', new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 })],
        ['edited', tgError(400, 'Bad Request: message is not modified: specified new message content is the same')],
        ['gone', tgError(400, 'Bad Request: message to edit not found')],
        ['gone', tgError(400, "Bad Request: message can't be edited")],
        ['failed', tgError(429, 'Too Many Requests: retry after 35')],
        ['failed', tgError(502, 'Bad Gateway')],
        ['failed', tgError(400, 'Bad Request: chat not found')],
    ])('returns %s', async (expected, res) => {
        reliableFetch.mockResolvedValue(res);
        expect(await editMessageText('1', 2, 'hi', 'tok')).toBe(expected);
    });

    it('returns failed on a network error or timeout', async () => {
        reliableFetch.mockRejectedValue(new Error('aborted'));
        expect(await editMessageText('1', 2, 'hi', 'tok')).toBe('failed');
    });
});
