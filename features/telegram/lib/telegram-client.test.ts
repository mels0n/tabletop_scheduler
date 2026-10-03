import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendTelegramMessage, sendTelegramMessageResult, editMessageTextResult, pinChatMessageResult, syncWebhook, webhookUrlFor, pinChatMessage } from './telegram-client';
import prisma from '@/shared/lib/prisma';

vi.mock('@/shared/lib/prisma');

const mockPrisma = prisma as unknown as { event: { updateMany: ReturnType<typeof vi.fn> } };

function reply(status: number, body: unknown) {
    const text = JSON.stringify(body);
    return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => text } as Response;
}

const MIGRATED = {
    ok: false,
    error_code: 400,
    description: 'Bad Request: group chat was upgraded to a supergroup chat',
    parameters: { migrate_to_chat_id: -1009999 },
};

describe('telegram-client', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.resetAllMocks();
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        mockPrisma.event.updateMany.mockResolvedValue({ count: 1 });
    });

    afterEach(() => vi.unstubAllGlobals());

    describe('group upgraded to supergroup', () => {
        it('repoints bound events and retries the send once in the new chat', async () => {
            fetchMock
                .mockResolvedValueOnce(reply(400, MIGRATED))
                .mockResolvedValueOnce(reply(200, { ok: true, result: { message_id: 77 } }));

            const id = await sendTelegramMessage('-123', 'hi', 'tok');

            expect(id).toBe(77);
            expect(mockPrisma.event.updateMany).toHaveBeenCalledWith({
                where: { telegramChatId: '-123' },
                data: { telegramChatId: '-1009999' },
            });
            expect(JSON.parse(fetchMock.mock.calls[1][1].body).chat_id).toBe(-1009999);
        });

        it('retries only once', async () => {
            fetchMock.mockResolvedValue(reply(400, MIGRATED));

            expect(await sendTelegramMessage('-123', 'hi', 'tok')).toBeNull();
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });
    });

    describe('error results', () => {
        const KICKED = { ok: false, error_code: 403, description: 'Forbidden: bot was kicked from the group chat' };

        it('surfaces the Telegram description and status from send, edit and pin', async () => {
            fetchMock.mockResolvedValue(reply(403, KICKED));

            const expected = { ok: false, error: KICKED.description, status: 403 };
            expect(await sendTelegramMessageResult('-1', 'hi', 'tok')).toEqual(expected);
            expect(await editMessageTextResult('-1', 5, 'hi', 'tok')).toEqual(expected);
            expect(await pinChatMessageResult('-1', 5, 'tok')).toEqual(expected);
            expect(await sendTelegramMessage('-1', 'hi', 'tok')).toBeNull();
        });

        it('reports status 0 with the cause when no response arrives', async () => {
            fetchMock.mockRejectedValue(new TypeError('fetch failed'));

            const result = await sendTelegramMessageResult('-1', 'hi', 'tok');
            expect(result).toMatchObject({ ok: false, status: 0 });
        });

        it('returns the message id on success', async () => {
            fetchMock.mockResolvedValue(reply(200, { ok: true, result: { message_id: 9 } }));
            expect(await sendTelegramMessageResult('-1', 'hi', 'tok')).toEqual({ ok: true, value: 9 });
        });
    });

    it('asks for pin rights in HTML, not markdown', async () => {
        fetchMock
            .mockResolvedValueOnce(reply(400, { ok: false, error_code: 400, description: 'Bad Request: not enough rights to pin a message' }))
            .mockResolvedValueOnce(reply(200, { ok: true, result: { message_id: 1 } }));

        await pinChatMessage('-1', 5, 'tok');

        const text = JSON.parse(fetchMock.mock.calls[1][1].body).text as string;
        expect(text).toContain('<b>Admin</b>');
        expect(text).not.toContain('**');
    });

    describe('syncWebhook', () => {
        it('does not call setWebhook when the registration already matches', async () => {
            fetchMock.mockResolvedValueOnce(reply(200, { ok: true, result: { url: webhookUrlFor('https://app.test', 'tok') } }));

            expect(await syncWebhook('https://app.test', 'tok')).toBe(true);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(String(fetchMock.mock.calls[0][0])).toContain('/getWebhookInfo');
        });

        it('registers when the URL differs', async () => {
            fetchMock
                .mockResolvedValueOnce(reply(200, { ok: true, result: { url: 'https://app.test/api/telegram/webhook' } }))
                .mockResolvedValueOnce(reply(200, { ok: true, result: true }));

            expect(await syncWebhook('https://app.test', 'tok')).toBe(true);
            expect(String(fetchMock.mock.calls[1][0])).toContain('/setWebhook');
            const body = JSON.parse(fetchMock.mock.calls[1][1].body);
            expect(body.url).toBe(webhookUrlFor('https://app.test', 'tok'));
            expect(body.secret_token).toMatch(/^[0-9a-f]{64}$/);
        });

        it('changes the URL when the secret changes (rotated token)', () => {
            expect(webhookUrlFor('https://app.test', 'a')).not.toBe(webhookUrlFor('https://app.test', 'b'));
        });
    });
});
