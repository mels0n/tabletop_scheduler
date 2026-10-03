import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/shared/lib/prisma');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import prisma from '@/shared/lib/prisma';
import { POST } from './route';

const mockPrisma = prisma as any;
const TOKEN = 'kofi-test-token';

const payload = {
    verification_token: TOKEN,
    message_id: 'msg-1',
    timestamp: '2026-03-22T20:00:41Z',
    type: 'Donation',
    is_public: true,
    from_name: 'Jo Supporter',
    message: 'Great tool',
    amount: '5.00',
    url: 'https://ko-fi.com/Home/CoffeeShop?txid=abc',
    email: 'jo@example.com',
    currency: 'USD',
    is_subscription_payment: false,
    is_first_subscription_payment: false,
    kofi_transaction_id: 'txn-1',
    shop_items: null,
    tier_name: null,
    shipping: { street_address: '1 Secret Lane' },
    discord_username: null,
    discord_userid: null,
};

function kofiRequest(data: unknown) {
    const form = new FormData();
    form.set('data', typeof data === 'string' ? data : JSON.stringify(data));
    return new Request('https://example.test/api/kofi/webhook', { method: 'POST', body: form });
}

describe('POST /api/kofi/webhook', () => {
    const spies: Array<{ mock: { calls: unknown[][] }; mockRestore: () => void }> = [];
    const logged = () => spies.flatMap((s) => s.mock.calls.map((c: unknown[]) => c.map(String).join(' '))).join('\n');

    beforeEach(() => {
        process.env.KOFI_VERIFICATION_TOKEN = TOKEN;
        mockPrisma.donation.upsert.mockReset();
        mockPrisma.donation.upsert.mockResolvedValue({});
        for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) {
            spies.push(vi.spyOn(console, m).mockImplementation(() => {}));
        }
    });

    afterEach(() => {
        delete process.env.KOFI_VERIFICATION_TOKEN;
        spies.splice(0).forEach((s) => s.mockRestore());
    });

    it('rejects a wrong token with 401 without logging any payload field', async () => {
        const res = await POST(kofiRequest({ ...payload, verification_token: 'wrong' }));

        expect(res.status).toBe(401);
        const out = logged();
        expect(out).not.toContain('jo@example.com');
        expect(out).not.toContain('Jo Supporter');
        expect(out).not.toContain('Secret Lane');
        expect(out).not.toContain('wrong');
        expect(mockPrisma.donation.upsert).not.toHaveBeenCalled();
    });

    it('does not echo the raw body when JSON is malformed', async () => {
        const res = await POST(kofiRequest('{"email":"jo@example.com",'));

        expect(res.status).toBe(400);
        expect(logged()).not.toContain('jo@example.com');
    });

    it('stores a verified donation without rawPayload and logs only message_id, type and amount', async () => {
        const res = await POST(kofiRequest(payload));

        expect(res.status).toBe(200);
        const data = mockPrisma.donation.upsert.mock.calls[0][0].create;
        expect(data).not.toHaveProperty('rawPayload');
        expect(data.amount).toBe('5.00');
        expect(data.kofiTransactionId).toBe('txn-1');

        const out = logged();
        expect(out).toContain('msg-1');
        expect(out).not.toContain('jo@example.com');
        expect(out).not.toContain('Jo Supporter');
        expect(out).not.toContain(TOKEN);
    });

    it('returns 500 when the database write fails so Ko-fi retries', async () => {
        mockPrisma.donation.upsert.mockRejectedValue(new Error('db down'));

        const res = await POST(kofiRequest(payload));

        expect(res.status).toBe(500);
    });

    it('returns 500 when no verification token is configured', async () => {
        delete process.env.KOFI_VERIFICATION_TOKEN;

        const res = await POST(kofiRequest(payload));

        expect(res.status).toBe(500);
        expect(mockPrisma.donation.upsert).not.toHaveBeenCalled();
    });
});
