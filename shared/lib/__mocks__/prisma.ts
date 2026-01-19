import { vi } from 'vitest';

export const prisma = {
    event: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
    },
    participant: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        deleteMany: vi.fn(),
        count: vi.fn(),
    },
    vote: {
        deleteMany: vi.fn(),
    },
    timeSlot: {
        deleteMany: vi.fn(),
    },
    webhookEvent: {
        create: vi.fn(),
    },
    loginToken: {
        create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
};

export default prisma;
