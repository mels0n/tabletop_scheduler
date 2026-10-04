import { vi } from 'vitest';

export const prisma = {
    event: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
    },
    participant: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
        count: vi.fn(),
        delete: vi.fn(),
    },
    vote: {
        deleteMany: vi.fn(),
        findMany: vi.fn(),
        createMany: vi.fn(),
    },
    timeSlot: {
        count: vi.fn(),
        deleteMany: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
    },
    webhookEvent: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
    },
    loginToken: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
    },
    finalizedSession: {
        findMany: vi.fn(),
        createMany: vi.fn(),
        deleteMany: vi.fn(),
        count: vi.fn(),
    },
    donation: {
        findMany: vi.fn(),
        upsert: vi.fn(),
    },
    dmPreference: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
    },
    // Supports both forms: interactive (callback) and batch (array of pending queries).
    $transaction: vi.fn((arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma))),
};

export default prisma;

/** A transaction client: the same delegates as the mock above, each method a fresh `vi.fn()`. */
export type TxStub = Omit<typeof prisma, '$transaction'>;

/**
 * A transaction client distinct from the top-level mock. `$transaction.mockImplementation` hands
 * it to the callback, so a test can assert a call went through `tx` and none reached the
 * top-level mock. Passing the top-level mock as `tx` (`cb(prisma)`) cannot tell the two apart.
 */
export function createTxStub(): TxStub {
    const tx: Record<string, unknown> = {};
    for (const [name, delegate] of Object.entries(prisma)) {
        if (name.startsWith('$')) continue;
        tx[name] = Object.fromEntries(Object.keys(delegate).map((method) => [method, vi.fn()]));
    }
    return tx as TxStub;
}
